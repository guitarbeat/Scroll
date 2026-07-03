import React, { useEffect } from "react";
import Ably from "ably";
import { Tldraw, useEditor, getSnapshot, createShapeId } from "tldraw";
import "tldraw/tldraw.css";

// ---------------------------------------------------------------------------
// Session identity — stable per browser tab
// ---------------------------------------------------------------------------
const SESSION_ID = Math.random().toString(36).slice(2, 11);

const CURSOR_COLORS = [
  { name: "Sepia",       hex: "#7a4f2e" },
  { name: "Vermillion",  hex: "#a8251a" },
  { name: "Verdigris",   hex: "#2e7a5a" },
  { name: "Ultramarine", hex: "#1a3ca8" },
  { name: "Oak Gall",    hex: "#3d2b0f" },
  { name: "Saffron",     hex: "#b8860b" },
];
const SESSION_COLOR =
  CURSOR_COLORS[
    SESSION_ID.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      CURSOR_COLORS.length
  ];

// ---------------------------------------------------------------------------
// Ably singleton — one connection shared for the whole app lifetime
// ---------------------------------------------------------------------------
let ablyClient: Ably.Realtime | null = null;
function getAblyClient(): Ably.Realtime {
  if (ablyClient) return ablyClient;
  ablyClient = new Ably.Realtime({
    authUrl: "/api/ably-token",
    authParams: { clientId: SESSION_ID },
    clientId: SESSION_ID,
  });
  return ablyClient;
}


// ---------------------------------------------------------------------------
// Coordinate helpers — all shapes and cursors stored in page space (virtual
// tldraw coords), not screen pixels. This ensures they land in the same spot
// on every screen size regardless of window width or scroll position.
// ---------------------------------------------------------------------------
function screenToPage(editor: any, screenX: number, screenY: number) {
  try {
    const pt = editor.screenToPage({ x: screenX, y: screenY });
    return { x: pt.x, y: pt.y };
  } catch {
    return { x: screenX, y: screenY };
  }
}

function pageToScreen(editor: any, pageX: number, pageY: number) {
  try {
    const pt = editor.pageToScreen({ x: pageX, y: pageY });
    return { x: pt.x, y: pt.y };
  } catch {
    return { x: pageX, y: pageY };
  }
}

// ---------------------------------------------------------------------------
// GhostCursors — renders remote users' cursors in screen space
// ---------------------------------------------------------------------------
interface RemoteCursor {
  sessionId: string;
  pageX: number;
  pageY: number;
  color: string;
  tool: string;
  ts: number;
}

function GhostCursors({
  cursors,
  mySessionId,
  editor,
}: {
  cursors: Record<string, RemoteCursor>;
  mySessionId: string;
  editor: any;
}) {
  // Re-render on a RAF loop so cursors stay correct as the user scrolls.
  // Only run the loop when there are actually remote cursors to show.
  const [, tick] = React.useReducer((n) => n + 1, 0);
  const hasCursors = editor != null && Object.keys(cursors).some(
    (sid) => sid !== mySessionId && Date.now() - cursors[sid].ts < 15_000
  );
  useEffect(() => {
    if (!hasCursors) return; // no cursors — don't burn RAF cycles
    let frame: number;
    const loop = () => { tick(); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [hasCursors]);

  if (!editor) return null;
  const now = Date.now();
  const entries = Object.entries(cursors).filter(
    ([sid, c]) => sid !== mySessionId && now - c.ts < 15_000
  );
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(([sid, c]) => {
        const age = now - c.ts;
        const opacity = age < 8_000 ? 0.85 : Math.max(0, 0.85 * (1 - (age - 8_000) / 7_000));
        const screen = pageToScreen(editor, c.pageX, c.pageY);
        const isQuill = c.tool === "draw";
        return (
          <div
            key={sid}
            style={{
              position: "absolute",
              left: screen.x,
              top: screen.y,
              pointerEvents: "none",
              zIndex: 999,
              opacity,
              transform: "translate(-2px, -2px)",
              willChange: "left, top",
            }}
          >
            {isQuill ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                <path d="M15 2 C12 4 5 10 3 17 L7 13 C8 11 11 8 15 2Z"
                  fill={c.color} fillOpacity="0.9" />
                <path d="M3 17 L5 14 L7 16Z" fill={c.color} fillOpacity="0.7" />
                <path d="M3 17 L2 19" stroke={c.color} strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                <path d="M2 2 L2 13 L5.5 9.5 L8 14 L9.5 13.3 L7 8.5 L11.5 8.5Z"
                  fill={c.color} fillOpacity="0.9" stroke="#fff" strokeWidth="0.5" />
              </svg>
            )}
            <div style={{
              position: "absolute", top: "18px", left: "4px",
              width: "7px", height: "7px", borderRadius: "50%",
              background: c.color, border: "1.5px solid rgba(255,255,255,0.7)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }} />
          </div>
        );
      })}
    </>
  );
}


interface WritingCanvasProps {
  onEditorReady: (editor: any) => void;
  isMagnifierActive?: boolean;
}

function EditorRefSetter({ onEditorReady }: { onEditorReady: (editor: any) => void }) {
  const editor = useEditor();
  const lastRef = React.useRef<any>(null);
  useEffect(() => {
    if (editor && editor !== lastRef.current) {
      lastRef.current = editor;
      if (typeof window !== "undefined") (window as any).tldrawEditor = editor;
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  return null;
}

// ---------------------------------------------------------------------------
// CommunalSync — Ably realtime for shapes + presence for cursors
//
// Architecture:
//   scroll:shapes   — shape/delete deltas via Ably pub/sub (instant)
//                     Redis still persists the full state for new joiners
//   scroll:cursors  — Ably Presence (enter/update/leave) for ghost cursors
//                     ~50ms throttle, page-space coords, no Redis involved
// ---------------------------------------------------------------------------
function CommunalSync({
  onCursorsUpdate,
}: {
  onCursorsUpdate: (cursors: Record<string, RemoteCursor>) => void;
}) {
  const editor = useEditor();
  const isInitialLoadDoneRef  = React.useRef(false);
  const isApplyingRemoteRef   = React.useRef(false);
  const knownShapeIdsRef      = React.useRef<Set<string>>(new Set());
  const lastSentRef           = React.useRef<Record<string, string>>({});
  const isTouchDeviceRef      = React.useRef(false);
  const lastCursorPageRef     = React.useRef<{ x: number; y: number } | null>(null);
  const cursorThrottleRef     = React.useRef(0);

  useEffect(() => {
    const isShapeRecord = (r: any) =>
      r && (r.typeName === "shape" || r.typeName === "asset");

    const getStoreAndSchema = (snapshot: any) => {
      if (!snapshot) return { store: {} as Record<string, any>, schema: null as any };
      if (snapshot.document?.store)
        return { store: snapshot.document.store, schema: snapshot.document.schema ?? null };
      return { store: snapshot.store ?? {}, schema: snapshot.schema ?? null };
    };

    // ── Step 1: Load full state from Redis (source of truth for new joiners) ──
    const loadFromRedis = async () => {
      try {
        const res = await fetch("/api/sync-state");
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "empty") return;

        const { shapes = {}, deleted = [] } = data as {
          shapes: Record<string, any>;
          deleted: string[];
        };

        isApplyingRemoteRef.current = true;
        const toPut = Object.values(shapes).filter(isShapeRecord);
        if (toPut.length > 0) editor.store.put(toPut);

        const toRemove = (deleted as string[]).filter((id) => {
          const r = editor.store.get(id as any);
          return r && isShapeRecord(r);
        });
        if (toRemove.length > 0) editor.store.remove(toRemove as any[]);

        // Seed diff-tracking maps
        const { store } = getStoreAndSchema(getSnapshot(editor.store));
        for (const [id, record] of Object.entries(store)) {
          if (isShapeRecord(record)) {
            knownShapeIdsRef.current.add(id);
            lastSentRef.current[id] = JSON.stringify(record);
          }
        }
        isApplyingRemoteRef.current = false;
      } catch (err) {
        console.error("[CommunalSync] loadFromRedis error:", err);
        isApplyingRemoteRef.current = false;
      } finally {
        isInitialLoadDoneRef.current = true;
      }
    };

    // ── Step 2: Persist diff to Redis (so future joiners get full history) ──
    const persistToRedis = async (
      upserted: Record<string, any>,
      deletedIds: string[],
      schema: any
    ) => {
      if (Object.keys(upserted).length === 0 && deletedIds.length === 0) return;
      try {
        await fetch("/api/sync-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema, upserted, deleted: deletedIds }),
        });
      } catch (err) {
        console.error("[CommunalSync] persistToRedis error:", err);
      }
    };


    // ── Step 3: Set up Ably ─────────────────────────────────────────────────
    const ably = getAblyClient();
    const shapesChannel  = ably.channels.get("scroll:shapes");
    const cursorsChannel = ably.channels.get("scroll:cursors");

    // ── shapes channel: receive deltas from other clients instantly ──────────
    const onShapeDelta = (msg: Ably.Message) => {
      if (!isInitialLoadDoneRef.current) return;
      const { upserted = {}, deleted = [] } = msg.data as {
        upserted: Record<string, any>;
        deleted: string[];
      };

      const toPut = Object.values(upserted).filter(isShapeRecord);
      // Only apply shapes that weren't sent by us
      const filtered = toPut.filter((r: any) => {
        const serialized = JSON.stringify(r);
        return lastSentRef.current[r.id] !== serialized;
      });

      const toRemove = (deleted as string[]).filter(
        (id) => knownShapeIdsRef.current.has(id) &&
          editor.store.get(id as any) !== undefined
      );

      if (filtered.length === 0 && toRemove.length === 0) return;

      isApplyingRemoteRef.current = true;
      if (filtered.length > 0) editor.store.put(filtered);
      if (toRemove.length > 0) {
        editor.store.remove(toRemove as any[]);
        for (const id of toRemove) {
          knownShapeIdsRef.current.delete(id);
          delete lastSentRef.current[id];
        }
      }
      isApplyingRemoteRef.current = false;
    };

    shapesChannel.subscribe("delta", onShapeDelta);

    // ── shapes: publish our own diffs and persist to Redis ───────────────────
    let saveTimeout: any = null;
    const publishDiff = async () => {
      const snapshot = getSnapshot(editor.store);
      const { store, schema } = getStoreAndSchema(snapshot);

      const upserted: Record<string, any> = {};
      const deletedIds: string[] = [];

      for (const [id, record] of Object.entries(store)) {
        if (!isShapeRecord(record)) continue;
        const serialized = JSON.stringify(record);
        if (lastSentRef.current[id] !== serialized) {
          upserted[id] = record;
          lastSentRef.current[id] = serialized;
          knownShapeIdsRef.current.add(id);
        }
      }
      for (const id of Array.from(knownShapeIdsRef.current)) {
        if (!store[id]) {
          deletedIds.push(id);
          knownShapeIdsRef.current.delete(id);
          delete lastSentRef.current[id];
        }
      }

      if (Object.keys(upserted).length === 0 && deletedIds.length === 0) return;

      // Publish via Ably (instant broadcast to all connected clients)
      shapesChannel.publish("delta", { upserted, deleted: deletedIds });
      // Also persist to Redis for future joiners
      persistToRedis(upserted, deletedIds, schema);
    };

    const unsubscribeStore = editor.store.listen((entry: any) => {
      if (isApplyingRemoteRef.current) return;
      if (!isInitialLoadDoneRef.current) return;

      const changes = entry.changes;
      let hasShapeChange = false;
      try {
        for (const r of Object.values(changes.added || {})) {
          if (isShapeRecord(r)) { hasShapeChange = true; break; }
        }
        if (!hasShapeChange) {
          for (const u of Object.values(changes.updated || {}) as any[]) {
            const rec = Array.isArray(u) ? u[1] : u;
            if (isShapeRecord(rec)) { hasShapeChange = true; break; }
          }
        }
        if (!hasShapeChange) {
          for (const r of Object.values(changes.removed || {})) {
            if (isShapeRecord(r)) { hasShapeChange = true; break; }
          }
        }
      } catch (_) { hasShapeChange = true; }

      if (hasShapeChange) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(publishDiff, 80); // 80ms debounce — fast but not every keystroke
      }
    });


    // ── cursors: Ably Presence (enter with color, update on move) ───────────
    // Presence gives us instant enter/leave events and a live member list —
    // no Redis, no polling, no TTL management needed.
    const cursorsMap: Record<string, RemoteCursor> = {};

    const syncCursors = (members: Ably.PresenceMessage[]) => {
      // Rebuild the map from the full presence set
      for (const key of Object.keys(cursorsMap)) delete cursorsMap[key];
      for (const m of members) {
        if (m.clientId === SESSION_ID) continue;
        const d = m.data as any;
        cursorsMap[m.clientId] = {
          sessionId: m.clientId,
          pageX: d.pageX,
          pageY: d.pageY,
          color: d.color,
          tool: d.tool,
          ts: d.ts,
        };
      }
      onCursorsUpdate({ ...cursorsMap });
    };

    // Subscribe to presence events
    cursorsChannel.presence.subscribe((msg) => {
      cursorsChannel.presence.get().then((members) => syncCursors(members));
    });

    // Enter presence when initial load is done (async)
    const enterPresence = async () => {
      await loadFromRedis();
      if (isTouchDeviceRef.current) return; // don't enter presence on touch
      try {
        await cursorsChannel.presence.enter({
          pageX: 0, pageY: 0,
          color: SESSION_COLOR.hex,
          tool: "draw",
          ts: Date.now(),
        });
      } catch (err) {
        console.warn("[CommunalSync] presence.enter failed:", err);
      }
    };
    enterPresence();

    // Track mouse position in page space and update presence at ~50ms throttle
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") { isTouchDeviceRef.current = true; return; }
      if (!isInitialLoadDoneRef.current) return;

      // Refresh tldraw's viewport bounds before mapping coords so the
      // page-space position is always correct even mid-scroll.
      try { (editor as any).updateViewportScreenBounds?.(); } catch (_) {}

      const pt = screenToPage(editor, e.clientX, e.clientY);
      lastCursorPageRef.current = pt;

      const now = Date.now();
      if (now - cursorThrottleRef.current < 50) return;
      cursorThrottleRef.current = now;

      const tool = (() => { try { return editor.getCurrentToolId() ?? "draw"; } catch { return "draw"; } })();
      cursorsChannel.presence.update({
        pageX: pt.x, pageY: pt.y,
        color: SESSION_COLOR.hex,
        tool,
        ts: now,
      }).catch(() => {});
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    // Leave presence on unmount (tab close, navigation)
    const handleBeforeUnload = () => {
      try { cursorsChannel.presence.leave(); } catch (_) {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribeStore();
      if (saveTimeout) clearTimeout(saveTimeout);
      shapesChannel.unsubscribe("delta", onShapeDelta);
      cursorsChannel.presence.unsubscribe();
      try { cursorsChannel.presence.leave(); } catch (_) {}
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editor, onCursorsUpdate]);

  return null;
}


// ---------------------------------------------------------------------------
// CameraLock — keeps camera at origin/100% so page coords = canvas coords
// ---------------------------------------------------------------------------
function CameraLock() {
  const editor = useEditor();
  useEffect(() => {
    if (!editor) return;
    editor.setCamera({ x: 0, y: 0, z: 1 });
    const unsub = editor.store.listen(() => {
      const cam = editor.getCamera();
      if (cam.x !== 0 || cam.y !== 0 || cam.z !== 1)
        editor.setCamera({ x: 0, y: 0, z: 1 });
    });
    return () => unsub();
  }, [editor]);
  return null;
}

// ---------------------------------------------------------------------------
// ScrollBoundsUpdater — keeps tldraw viewport in sync with parchment scroll
// ---------------------------------------------------------------------------
function ScrollBoundsUpdater() {
  const editor = useEditor();
  useEffect(() => {
    if (!editor) return;
    const sheetWrap = document.getElementById("sheetWrap");
    if (!sheetWrap) return;
    const handler = () => {
      try { (editor as any).updateViewportScreenBounds(); } catch (_) {}
    };
    sheetWrap.addEventListener("scroll", handler, { passive: true });
    return () => sheetWrap.removeEventListener("scroll", handler);
  }, [editor]);
  return null;
}

interface PointerState { x: number; y: number; isDown: boolean; }


// ---------------------------------------------------------------------------
// MagnifierOverlay
// ---------------------------------------------------------------------------
function MagnifierOverlay({ pointer, editor }: { pointer: PointerState | null; editor: any }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  React.useEffect(() => {
    if (!pointer || !pointer.isDown || !canvasRef.current || !editor) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 130, 130);
    ctx.fillStyle = "#f4ebd0";
    ctx.fillRect(0, 0, 130, 130);
    ctx.strokeStyle = "rgba(163, 129, 81, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(65, 65, 61, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(163, 129, 81, 0.4)";
    ctx.fillRect(64, 61, 2, 2);
    ctx.fillRect(64, 67, 2, 2);
    ctx.fillRect(61, 64, 2, 2);
    ctx.fillRect(67, 64, 2, 2);

    ctx.save();
    ctx.translate(65, 65);
    ctx.scale(2.3, 2.3);
    ctx.translate(-pointer.x, -pointer.y);

    try {
      editor.getCurrentPageShapes().forEach((shape: any) => {
        if (shape.typeName !== "shape") return;
        if (shape.type === "draw") {
          const segs = shape.props.segments;
          if (!segs?.length) return;
          ctx.beginPath(); ctx.lineCap = "round"; ctx.lineJoin = "round";
          const cv = shape.props.color;
          ctx.strokeStyle = cv === "red" ? "#a8251a" : cv === "blue" ? "#1a5ca8" : "#251b12";
          ctx.lineWidth = shape.props.size === "s" ? 1.5 : shape.props.size === "m" ? 3.5 : 7.0;
          segs.forEach((seg: any) => {
            const pts = seg.points;
            if (!pts?.length) return;
            ctx.moveTo(shape.x + pts[0].x, shape.y + pts[0].y);
            for (let i = 1; i < pts.length; i++)
              ctx.lineTo(shape.x + pts[i].x, shape.y + pts[i].y);
          });
          ctx.stroke();
        } else if (shape.type === "text") {
          ctx.fillStyle = "#251b12";
          ctx.font = "italic bold 15px Georgia, serif";
          ctx.fillText(shape.props.text || "", shape.x, shape.y + 12);
        } else if (shape.type === "image") {
          const asset = editor.getAsset(shape.props.assetId);
          if (asset?.props?.src) {
            let img = imageCacheRef.current.get(shape.props.assetId);
            if (!img) {
              img = new Image(); img.src = asset.props.src;
              imageCacheRef.current.set(shape.props.assetId, img);
            }
            if (img.complete && img.naturalWidth > 0)
              ctx.drawImage(img, shape.x, shape.y, shape.props.w, shape.props.h);
          }
        }
      });
    } catch (_) {}
    ctx.restore();
  }, [pointer, editor]);

  if (!pointer || !pointer.isDown) return null;
  return (
    <div style={{
      position: "absolute", left: `${pointer.x}px`, top: `${pointer.y - 110}px`,
      transform: "translateX(-50%)", width: "134px", height: "134px",
      borderRadius: "50%", border: "4px solid #b8860b",
      boxShadow: "0 10px 25px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.3)",
      zIndex: 1000, pointerEvents: "none", overflow: "hidden", backgroundColor: "#f4ebd0",
    }} className="flex items-center justify-center animate-fade-in">
      <div style={{ position: "absolute", inset: "2px", borderRadius: "50%",
        border: "1.5px solid #ebdcb9", pointerEvents: "none", zIndex: 10 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%",
        background: "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 100%)",
        pointerEvents: "none", zIndex: 11 }} />
      <canvas ref={canvasRef} width={130} height={130}
        style={{ width: "130px", height: "130px", borderRadius: "50%" }} />
    </div>
  );
}


// ---------------------------------------------------------------------------
// WritingCanvas — main export
// ---------------------------------------------------------------------------
export default function WritingCanvas({ onEditorReady, isMagnifierActive = false }: WritingCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editor, setEditor] = React.useState<any>(null);
  const [pointer, setPointer] = React.useState<PointerState | null>(null);
  const [remoteCursors, setRemoteCursors] = React.useState<Record<string, RemoteCursor>>({});

  const handleEditorReady = (ed: any) => {
    setEditor(ed);
    if (onEditorReady) onEditorReady(ed);
  };

  const handleCursorsUpdate = React.useCallback(
    (c: Record<string, RemoteCursor>) => setRemoteCursors(c), []
  );

  // Wheel → scroll parchment, not zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      document.getElementById("sheetWrap")!?.scrollBy(0, e.deltaY);
      e.stopPropagation();
    };
    container.addEventListener("wheel", handleWheel, { capture: true });
    return () => container.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  // Paste images
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          if (!src) return;
          const img = new Image();
          img.onload = () => {
            let w = img.width, h = img.height;
            const max = 500;
            if (w > max || h > max) { const r = Math.min(max/w, max/h); w = Math.round(w*r); h = Math.round(h*r); }
            const randId = Math.random().toString(36).slice(2, 11);
            const assetId = ("asset:" + randId) as any;
            const shapeId = createShapeId(randId);
            const rect = container.getBoundingClientRect();
            editor.run(() => {
              editor.createAssets([{ id: assetId, type: "image", typeName: "asset",
                props: { name: file.name || "paste.png", src, w, h, mimeType: file.type } }]);
              editor.createShapes([{ id: shapeId, type: "image",
                x: Math.max(20, rect.width/2 - w/2), y: Math.max(20, rect.height/2 - h/2),
                props: { assetId, w, h } }]);
            });
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      }
    };
    container.addEventListener("paste", handlePaste);
    return () => container.removeEventListener("paste", handlePaste);
  }, [editor]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMagnifierActive) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, isDown: true });
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMagnifierActive) { if (pointer) setPointer(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - r.left, y: e.clientY - r.top,
      isDown: (e.buttons & 1) === 1 || e.pointerType === "touch" });
  };
  const handlePointerUp = () => setPointer(null);

  return (
    <div ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-auto touch-none select-none"
      style={{ zIndex: 10 }}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerUp}
    >
      <Tldraw
        licenseKey={(import.meta as any).env.VITE_TLDRAW_LICENSE_KEY ||
          "tldraw-2026-07-16/WyJSbno4UEg5NyIsWyIqIl0sMTYsIjIwMjYtMDctMTYiXQ.LQDDOTuUGf1MoAbBi9VJ51zhvlQVtcKPlTex82YLal0mcUXaEtekcMIvYoFN1PWjgYKHwn2exAEh0CQf2EaOiQ"}
        autoFocus={false}
        hideUi={true}
      >
        <EditorRefSetter onEditorReady={handleEditorReady} />
        <CommunalSync onCursorsUpdate={handleCursorsUpdate} />
        <CameraLock />
        <ScrollBoundsUpdater />
      </Tldraw>

      <GhostCursors cursors={remoteCursors} mySessionId={SESSION_ID} editor={editor} />

      {isMagnifierActive && pointer?.isDown && (
        <MagnifierOverlay pointer={pointer} editor={editor} />
      )}
    </div>
  );
}
