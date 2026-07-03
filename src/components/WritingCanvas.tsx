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

    // ── Reconnect + visibility robustness ────────────────────────────────────
    // Re-enter presence (desktop only) after any presence gap.
    const reenterPresence = () => {
      if (isTouchDeviceRef.current) return;
      cursorsChannel.presence
        .enter({ pageX: 0, pageY: 0, color: SESSION_COLOR.hex, tool: "draw", ts: Date.now() })
        .catch(() => {});
    };

    // When Ably reconnects after a drop, reconcile with Redis (to catch any
    // deltas missed while offline) and re-announce our presence. Ably itself
    // queues our outbound publishes while disconnected and flushes them on
    // reconnect, so local strokes made offline are not lost.
    const onConnected = () => {
      if (!isInitialLoadDoneRef.current) return; // initial load handles first connect
      loadFromRedis();
      reenterPresence();
    };
    ably.connection.on("connected", onConnected);

    // Backgrounding the tab: drop our ghost cursor for others; on return,
    // reconcile and re-enter presence.
    const onVisibility = () => {
      if (document.hidden) {
        try { cursorsChannel.presence.leave(); } catch (_) {}
      } else if (isInitialLoadDoneRef.current) {
        loadFromRedis();
        reenterPresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribeStore();
      if (saveTimeout) clearTimeout(saveTimeout);
      shapesChannel.unsubscribe("delta", onShapeDelta);
      cursorsChannel.presence.unsubscribe();
      try { cursorsChannel.presence.leave(); } catch (_) {}
      ably.connection.off("connected", onConnected);
      document.removeEventListener("visibilitychange", onVisibility);
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

// ---------------------------------------------------------------------------
// Magnifier loupe (touch only)
//
// Instead of hand-drawing shapes, we magnify the REAL tldraw canvas by cloning
// its rendered DOM (`.tl-canvas`) into a circular clip and CSS-transforming it
// so the point under the finger is centered and scaled. Because the live
// in-progress stroke is a real DOM node, cloning each frame shows it live.
// ---------------------------------------------------------------------------
const DRAW_TOOLS = new Set(["draw", "eraser", "highlight", "laser"]);
const LOUPE_D = 150;          // loupe diameter in px
const LOUPE_MAG_MIN = 1.5;
const LOUPE_MAG_MAX = 6;
const LOUPE_MAG_DEFAULT = 2.5;

interface LoupeState {
  active: boolean;
  lx: number;                 // finger x relative to the canvas container
  ly: number;                 // finger y relative to the canvas container
  position: "top" | "bottom"; // where the loupe sits (flips to avoid the finger)
  mag: number;                // magnification factor
}

function loadLoupeMag(): number {
  try {
    const v = parseFloat(localStorage.getItem("loupe-mag") || "");
    if (!Number.isNaN(v)) return Math.min(LOUPE_MAG_MAX, Math.max(LOUPE_MAG_MIN, v));
  } catch (_) {}
  return LOUPE_MAG_DEFAULT;
}

function Loupe({ stateRef }: { stateRef: React.MutableRefObject<LoupeState> }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let raf = 0;
    let mounted = true;
    let wasActive = false;

    const loop = () => {
      if (!mounted) return;
      const st = stateRef.current;
      const outer = outerRef.current;
      const host = hostRef.current;
      if (outer && host) {
        if (st.active) {          const container = outer.parentElement as HTMLElement | null;
          const cw = container?.clientWidth ?? 0;
          const ch = container?.clientHeight ?? 0;
          outer.style.display = "block";
          // Follow the finger horizontally (clamped), sit at top or bottom.
          const left = Math.min(Math.max(st.lx - LOUPE_D / 2, 6), Math.max(6, cw - LOUPE_D - 6));
          const top = st.position === "top" ? 6 : Math.max(6, ch - LOUPE_D - 6);
          outer.style.left = `${left}px`;
          outer.style.top = `${top}px`;

          const canvasEl = document.querySelector(".tl-canvas") as HTMLElement | null;
          if (canvasEl) {
            const clone = canvasEl.cloneNode(true) as HTMLElement;
            clone.style.position = "absolute";
            clone.style.left = "0";
            clone.style.top = "0";
            clone.style.margin = "0";
            clone.style.width = `${cw}px`;
            clone.style.height = `${ch}px`;
            clone.style.transformOrigin = "0 0";
            clone.style.transform =
              `translate(${LOUPE_D / 2 - st.lx * st.mag}px, ${LOUPE_D / 2 - st.ly * st.mag}px) scale(${st.mag})`;
            clone.style.pointerEvents = "none";
            host.replaceChildren(clone);
          }
          wasActive = true;
        } else if (wasActive) {
          outer.style.display = "none";
          host.replaceChildren();
          wasActive = false;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(raf); };
  }, [stateRef]);

  return (
    <div
      ref={outerRef}
      style={{
        display: "none",
        position: "absolute",
        width: LOUPE_D,
        height: LOUPE_D,
        borderRadius: "50%",
        border: "4px solid #b8860b",
        boxShadow: "0 10px 25px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.3)",
        zIndex: 1000,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#f4ebd0",
      }}
    >
      <div ref={hostRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      <div style={{ position: "absolute", inset: 2, borderRadius: "50%", border: "1.5px solid #ebdcb9", pointerEvents: "none", zIndex: 10 }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 5, height: 5, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "rgba(122,31,18,0.35)", pointerEvents: "none", zIndex: 12 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 100%)", pointerEvents: "none", zIndex: 11 }} />
    </div>
  );
}


// ---------------------------------------------------------------------------
// WritingCanvas — main export
// ---------------------------------------------------------------------------
export default function WritingCanvas({ onEditorReady }: WritingCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editor, setEditor] = React.useState<any>(null);
  const [remoteCursors, setRemoteCursors] = React.useState<Record<string, RemoteCursor>>({});
  const loupeRef = React.useRef<LoupeState>({ active: false, lx: 0, ly: 0, position: "top", mag: LOUPE_MAG_DEFAULT });
  React.useEffect(() => { loupeRef.current.mag = loadLoupeMag(); }, []);

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

  // Touch gesture handling (mobile). Desktop uses mouse and never triggers this.
  //  - 1 finger + a drawing tool  -> draw, and show the magnifier loupe
  //  - 2 fingers (no active stroke) -> scroll the parchment vertically
  //  - 2 fingers while mid-stroke   -> pinch adjusts loupe magnification
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTool = () => {
      try { return editor?.getCurrentToolId?.() ?? "draw"; } catch { return "draw"; }
    };

    let mode: "none" | "draw" | "scroll" | "pinch" = "none";
    let lastMidY = 0;
    let baseDist = 1;
    let baseMag = loupeRef.current.mag;

    const setLoupeFromTouch = (t: Touch) => {
      const r = container.getBoundingClientRect();
      const lx = t.clientX - r.left;
      const ly = t.clientY - r.top;
      const st = loupeRef.current;
      st.lx = lx;
      st.ly = ly;
      // Finger-avoidance: if the finger is up near where the loupe sits, flip it down.
      st.position = ly < LOUPE_D + 48 ? "bottom" : "top";
      st.active = true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (DRAW_TOOLS.has(getTool())) {
          mode = "draw";
          setLoupeFromTouch(e.touches[0]);
        } else {
          mode = "none";
          loupeRef.current.active = false;
        }
      } else if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        if (mode === "draw") {
          // second finger during a stroke -> adjust loupe magnification
          mode = "pinch";
          baseDist = dist;
          baseMag = loupeRef.current.mag;
        } else {
          // two fingers from rest -> scroll the parchment
          mode = "scroll";
          lastMidY = (a.clientY + b.clientY) / 2;
          loupeRef.current.active = false;
        }
        try { editor?.cancel?.(); } catch (_) {}
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === "draw" && e.touches.length === 1) {
        setLoupeFromTouch(e.touches[0]);
      } else if (mode === "scroll" && e.touches.length >= 2) {
        const a = e.touches[0], b = e.touches[1];
        const midY = (a.clientY + b.clientY) / 2;
        const sw = document.getElementById("sheetWrap");
        if (sw) sw.scrollTop += lastMidY - midY;
        lastMidY = midY;
        e.preventDefault();
      } else if (mode === "pinch" && e.touches.length >= 2) {
        const a = e.touches[0], b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        const mag = Math.min(LOUPE_MAG_MAX, Math.max(LOUPE_MAG_MIN, baseMag * (dist / baseDist)));
        loupeRef.current.mag = mag;
        try { localStorage.setItem("loupe-mag", String(mag)); } catch (_) {}
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        mode = "none";
        loupeRef.current.active = false;
      } else {
        // Dropping from two fingers to one: do not resume drawing from the
        // leftover finger (avoids stray marks). Wait for a fresh touch.
        mode = "none";
        loupeRef.current.active = false;
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    container.addEventListener("touchend", onTouchEnd, { capture: true });
    container.addEventListener("touchcancel", onTouchEnd, { capture: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart, true);
      container.removeEventListener("touchmove", onTouchMove, true);
      container.removeEventListener("touchend", onTouchEnd, true);
      container.removeEventListener("touchcancel", onTouchEnd, true);
    };
  }, [editor]);

  return (
    <div ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-auto touch-none select-none"
      style={{ zIndex: 10 }}
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

      {/* Magnifier loupe — touch only, auto-shows while drawing with one finger */}
      <Loupe stateRef={loupeRef} />
    </div>
  );
}
