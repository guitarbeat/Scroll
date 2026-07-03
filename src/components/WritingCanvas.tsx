import React, { useEffect } from "react";
import { Tldraw, useEditor, getSnapshot, createShapeId } from "tldraw";
import "tldraw/tldraw.css";

// ---------------------------------------------------------------------------
// Session identity — stable random ID + ink color per browser tab
// ---------------------------------------------------------------------------
const SESSION_ID = Math.random().toString(36).slice(2, 11);

// Medieval ink palette — one color assigned per session
const CURSOR_COLORS = [
  { name: "Sepia",      hex: "#7a4f2e" },
  { name: "Vermillion", hex: "#a8251a" },
  { name: "Verdigris",  hex: "#2e7a5a" },
  { name: "Ultramarine",hex: "#1a3ca8" },
  { name: "Oak Gall",   hex: "#3d2b0f" },
  { name: "Saffron",    hex: "#b8860b" },
];
// Deterministically pick a color from the session ID
const SESSION_COLOR =
  CURSOR_COLORS[
    SESSION_ID.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
      CURSOR_COLORS.length
  ];

// ---------------------------------------------------------------------------
// GhostCursors — renders other users' cursors as medieval quill icons
// ---------------------------------------------------------------------------
interface RemoteCursor {
  sessionId: string;
  x: number;
  y: number;
  color: string;
  tool: string;
  ts: number;
}

function GhostCursors({
  cursors,
  mySessionId,
}: {
  cursors: Record<string, RemoteCursor>;
  mySessionId: string;
}) {
  const now = Date.now();
  const entries = Object.entries(cursors).filter(
    ([sid, c]) =>
      sid !== mySessionId &&         // not self
      now - c.ts < 15_000            // seen within 15 s
  );

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(([sid, c]) => {
        const age = now - c.ts;
        // Fade starts at 8 s, reaches 0 at 15 s
        const opacity = age < 8_000 ? 0.85 : Math.max(0, 0.85 * (1 - (age - 8_000) / 7_000));
        const isQuill = c.tool === "draw";
        return (
          <div
            key={sid}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              pointerEvents: "none",
              zIndex: 999,
              opacity,
              transform: "translate(-2px, -2px)",
              transition: "left 0.12s linear, top 0.12s linear, opacity 0.6s ease",
              willChange: "left, top",
            }}
          >
            {/* Quill or cursor SVG */}
            {isQuill ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
              >
                {/* Quill feather */}
                <path
                  d="M15 2 C12 4 5 10 3 17 L7 13 C8 11 11 8 15 2Z"
                  fill={c.color}
                  fillOpacity="0.9"
                />
                <path
                  d="M3 17 L5 14 L7 16Z"
                  fill={c.color}
                  fillOpacity="0.7"
                />
                {/* Quill tip */}
                <path
                  d="M3 17 L2 19"
                  stroke={c.color}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
              >
                <path
                  d="M2 2 L2 13 L5.5 9.5 L8 14 L9.5 13.3 L7 8.5 L11.5 8.5Z"
                  fill={c.color}
                  fillOpacity="0.9"
                  stroke="#fff"
                  strokeWidth="0.5"
                />
              </svg>
            )}
            {/* Color dot below cursor */}
            <div
              style={{
                position: "absolute",
                top: "18px",
                left: "4px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: c.color,
                border: "1.5px solid rgba(255,255,255,0.7)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }}
            />
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
  const lastRegisteredEditorRef = React.useRef<any>(null);

  useEffect(() => {
    if (editor && editor !== lastRegisteredEditorRef.current) {
      lastRegisteredEditorRef.current = editor;
      if (typeof window !== "undefined") {
        (window as any).tldrawEditor = editor;
      }
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  return null;
}

// ---------------------------------------------------------------------------
// CommunalSync — per-shape diff save + merge-only poll + cursor broadcast
// ---------------------------------------------------------------------------
function CommunalSync({
  onCursorsUpdate,
}: {
  onCursorsUpdate: (cursors: Record<string, RemoteCursor>) => void;
}) {
  const editor = useEditor();
  const isInitialLoadCompleteRef = React.useRef(false);
  const isUpdatingFromServerRef  = React.useRef(false);

  // Tracking maps for diff saves
  const knownShapeIdsRef = React.useRef<Set<string>>(new Set());
  const lastSentRef      = React.useRef<Record<string, string>>({});

  // Cursor state
  const lastCursorRef    = React.useRef<{ x: number; y: number } | null>(null);
  const isTouchRef       = React.useRef(false);

  useEffect(() => {
    // ── Helpers ─────────────────────────────────────────────────────────────
    const isShapeRecord = (r: any) =>
      r && (r.typeName === "shape" || r.typeName === "asset");

    const getStoreAndSchema = (snapshot: any) => {
      if (!snapshot) return { store: {}, schema: null };
      // tldraw v5 wraps in { document: { store, schema }, session }
      if (snapshot.document?.store) {
        return { store: snapshot.document.store, schema: snapshot.document.schema ?? null };
      }
      return { store: snapshot.store ?? {}, schema: snapshot.schema ?? null };
    };

    // ── Initial load ────────────────────────────────────────────────────────
    const loadState = async () => {
      try {
        const res = await fetch("/api/sync-state");
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "empty") {
          // Still update cursors even when canvas is empty
          if (data.cursors) onCursorsUpdate(data.cursors);
          return;
        }

        const { shapes = {}, deleted = [], cursors = {} } = data as {
          shapes: Record<string, any>;
          deleted: string[];
          cursors: Record<string, any>;
        };

        isUpdatingFromServerRef.current = true;

        const toPut = Object.values(shapes).filter(isShapeRecord);
        if (toPut.length > 0) editor.store.put(toPut);

        const toRemove = (deleted as string[]).filter((id) => {
          const r = editor.store.get(id as any);
          return r && isShapeRecord(r);
        });
        if (toRemove.length > 0) editor.store.remove(toRemove as any[]);

        // Seed tracking maps so first poll doesn't re-apply everything
        const { store } = getStoreAndSchema(getSnapshot(editor.store));
        for (const [id, record] of Object.entries(store)) {
          if (isShapeRecord(record)) {
            knownShapeIdsRef.current.add(id);
            lastSentRef.current[id] = JSON.stringify(record);
          }
        }

        isUpdatingFromServerRef.current = false;
        onCursorsUpdate(cursors);
      } catch (err) {
        console.error("[CommunalSync] loadState error:", err);
        isUpdatingFromServerRef.current = false;
      } finally {
        isInitialLoadCompleteRef.current = true;
      }
    };

    loadState();

    // ── Save: only the diff ─────────────────────────────────────────────────
    let saveTimeout: any = null;

    const saveState = async (cursorPayload?: { x: number; y: number; tool: string }) => {
      try {
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

        // Always send cursor if provided; skip network if nothing changed
        if (Object.keys(upserted).length === 0 && deletedIds.length === 0 && !cursorPayload) return;

        const body: any = { schema, upserted, deleted: deletedIds };
        if (cursorPayload) {
          body.cursor = {
            sessionId: SESSION_ID,
            x: cursorPayload.x,
            y: cursorPayload.y,
            color: SESSION_COLOR.hex,
            tool: cursorPayload.tool,
          };
        }

        await fetch("/api/sync-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("[CommunalSync] saveState error:", err);
      }
    };

    // ── Store listener — debounced shape save ───────────────────────────────
    const unsubscribe = editor.store.listen((entry) => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return;

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
      } catch (_) {
        hasShapeChange = true;
      }

      if (hasShapeChange) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveState(), 400);
      }
    });

    // ── Cursor tracking — desktop only (skip touch devices) ─────────────────
    const handlePointerMove = (e: PointerEvent) => {
      // Only track mouse cursors, not touch
      if (e.pointerType === "touch") { isTouchRef.current = true; return; }
      if (!isInitialLoadCompleteRef.current) return;

      // Map screen coords to canvas coords
      const container = document.getElementById("sheet");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      lastCursorRef.current = { x, y };
    };

    // Broadcast cursor position periodically (separate cadence from shape poll)
    const cursorBroadcastInterval = setInterval(() => {
      if (!isInitialLoadCompleteRef.current) return;
      if (isTouchRef.current) return; // never broadcast on touch
      if (!lastCursorRef.current) return;
      const { x, y } = lastCursorRef.current;
      const tool = (() => { try { return editor.getCurrentToolId() ?? "draw"; } catch { return "draw"; } })();
      saveState({ x, y, tool });
    }, 1200);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    // ── Poll: merge remote shapes + refresh cursors every 2 s ───────────────
    const pollInterval = setInterval(async () => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return;

      try {
        const res = await fetch("/api/sync-state");
        if (!res.ok) return;
        const data = await res.json();

        // Always update cursors
        if (data.cursors) onCursorsUpdate(data.cursors);

        if (data.status === "empty" || !data.shapes) return;

        const { shapes = {}, deleted = [] } = data as {
          shapes: Record<string, any>;
          deleted: string[];
        };

        const { store: localStore } = getStoreAndSchema(getSnapshot(editor.store));

        const toPut: any[] = [];
        for (const [id, remoteRecord] of Object.entries(shapes)) {
          if (!isShapeRecord(remoteRecord)) continue;
          const remoteSerialized = JSON.stringify(remoteRecord);
          // Apply if: not something we sent ourselves AND differs from local
          if (
            lastSentRef.current[id] !== remoteSerialized &&
            JSON.stringify(localStore[id]) !== remoteSerialized
          ) {
            toPut.push(remoteRecord);
          }
        }

        // FIX: correct deletion filter — remove locally if server deleted it
        // and we didn't delete it ourselves (i.e. it's still in our known set)
        const toRemove = (deleted as string[]).filter(
          (id) =>
            knownShapeIdsRef.current.has(id) &&   // we still think it exists
            localStore[id] !== undefined           // and it's actually in local store
        );

        if (toPut.length > 0 || toRemove.length > 0) {
          isUpdatingFromServerRef.current = true;
          if (toPut.length > 0) editor.store.put(toPut);
          if (toRemove.length > 0) {
            editor.store.remove(toRemove as any[]);
            // Sync our tracking maps
            for (const id of toRemove) {
              knownShapeIdsRef.current.delete(id);
              delete lastSentRef.current[id];
            }
          }
          isUpdatingFromServerRef.current = false;
        }
      } catch (_) {
        isUpdatingFromServerRef.current = false;
      }
    }, 2000);

    return () => {
      unsubscribe();
      if (saveTimeout) clearTimeout(saveTimeout);
      clearInterval(pollInterval);
      clearInterval(cursorBroadcastInterval);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [editor, onCursorsUpdate]);

  return null;
}

function CameraLock() {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    // Force initial camera at origin and 100% zoom
    editor.setCamera({ x: 0, y: 0, z: 1 });

    // Lock camera so that drawings stay aligned with parchment scroll
    const unsubscribe = editor.store.listen(() => {
      const camera = editor.getCamera();
      if (camera.x !== 0 || camera.y !== 0 || camera.z !== 1) {
        editor.setCamera({ x: 0, y: 0, z: 1 });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [editor]);

  return null;
}

function ScrollBoundsUpdater() {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    const sheetWrap = document.getElementById("sheetWrap");
    if (!sheetWrap) return;

    const handleScroll = () => {
      try {
        (editor as any).updateViewportScreenBounds();
      } catch (e) {
        // Fallback gracefully
      }
    };

    sheetWrap.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      sheetWrap.removeEventListener("scroll", handleScroll);
    };
  }, [editor]);

  return null;
}

interface PointerState {
  x: number;
  y: number;
  isDown: boolean;
}

function MagnifierOverlay({ 
  pointer, 
  editor 
}: { 
  pointer: PointerState | null;
  editor: any;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  React.useEffect(() => {
    if (!pointer || !pointer.isDown || !canvasRef.current || !editor) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and draw background
    ctx.clearRect(0, 0, 130, 130);
    
    // Create parchment paper background texture inside magnifier
    ctx.fillStyle = "#f4ebd0"; // Parchment-like base
    ctx.fillRect(0, 0, 130, 130);

    // Subtle paper fiber concentric ring
    ctx.strokeStyle = "rgba(163, 129, 81, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(65, 65, 61, 0, Math.PI * 2);
    ctx.stroke();

    // Center crosshair (subtle medieval style dots)
    ctx.fillStyle = "rgba(163, 129, 81, 0.4)";
    ctx.fillRect(64, 61, 2, 2);
    ctx.fillRect(64, 67, 2, 2);
    ctx.fillRect(61, 64, 2, 2);
    ctx.fillRect(67, 64, 2, 2);

    // Apply scale and translation to center around pointer.x, pointer.y
    ctx.save();
    ctx.translate(65, 65);
    ctx.scale(2.3, 2.3); // 2.3x magnification
    ctx.translate(-pointer.x, -pointer.y);

    try {
      const shapes = editor.getCurrentPageShapes();
      shapes.forEach((shape: any) => {
        if (shape.typeName === "shape") {
          if (shape.type === "draw") {
            const segments = shape.props.segments;
            if (segments && segments.length > 0) {
              ctx.beginPath();
              ctx.lineCap = "round";
              ctx.lineJoin = "round";

              // Map color values
              const colorVal = shape.props.color;
              if (colorVal === "red") {
                ctx.strokeStyle = "#a8251a";
              } else if (colorVal === "blue") {
                ctx.strokeStyle = "#1a5ca8";
              } else {
                ctx.strokeStyle = "#251b12"; // iron gall brown-black
              }

              // Adjust line width for magnification scale
              const baseWidth = shape.props.size === "s" ? 1.5 : shape.props.size === "m" ? 3.5 : 7.0;
              ctx.lineWidth = baseWidth;

              const originX = shape.x;
              const originY = shape.y;

              segments.forEach((seg: any) => {
                const points = seg.points;
                if (points && points.length > 0) {
                  const startPt = points[0];
                  ctx.moveTo(originX + startPt.x, originY + startPt.y);
                  for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(originX + points[i].x, originY + points[i].y);
                  }
                }
              });
              ctx.stroke();
            }
          } else if (shape.type === "text") {
            ctx.fillStyle = "#251b12";
            ctx.font = "italic bold 15px Georgia, serif";
            ctx.fillText(shape.props.text || "", shape.x, shape.y + 12);
          } else if (shape.type === "image") {
            const assetId = shape.props.assetId;
            if (assetId) {
              const asset = editor.getAsset(assetId);
              if (asset && asset.props && asset.props.src) {
                let imgElement = imageCacheRef.current.get(assetId);
                if (!imgElement) {
                  imgElement = new Image();
                  imgElement.src = asset.props.src;
                  imgElement.onload = () => {
                    // Trigger redrawing if possible
                  };
                  imageCacheRef.current.set(assetId, imgElement);
                }
                if (imgElement.complete && imgElement.naturalWidth > 0) {
                  ctx.drawImage(imgElement, shape.x, shape.y, shape.props.w, shape.props.h);
                } else {
                  ctx.strokeStyle = "rgba(163, 129, 81, 0.4)";
                  ctx.lineWidth = 1;
                  ctx.strokeRect(shape.x, shape.y, shape.props.w, shape.props.h);
                }
              }
            }
          }
        }
      });
    } catch (e) {
      // Graceful fallback
    }

    ctx.restore();
  }, [pointer, editor]);

  if (!pointer || !pointer.isDown) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${pointer.x}px`,
        top: `${pointer.y - 110}px`, // Float 110px above finger
        transform: "translateX(-50%)",
        width: "134px",
        height: "134px",
        borderRadius: "50%",
        border: "4px solid #b8860b", // Brass frame
        boxShadow: "0 10px 25px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.3)",
        zIndex: 1000,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#f4ebd0",
      }}
      className="flex items-center justify-center animate-fade-in"
    >
      {/* Decorative inner brass ring */}
      <div
        style={{
          position: "absolute",
          inset: "2px",
          borderRadius: "50%",
          border: "1.5px solid #ebdcb9",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
      {/* Subtle glare overlay */}
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          height: "50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
      <canvas
        ref={canvasRef}
        width={130}
        height={130}
        style={{
          width: "130px",
          height: "130px",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

export default function WritingCanvas({ onEditorReady, isMagnifierActive = false }: WritingCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editor, setEditor] = React.useState<any>(null);
  const [pointer, setPointer] = React.useState<PointerState | null>(null);
  const [remoteCursors, setRemoteCursors] = React.useState<Record<string, RemoteCursor>>({});

  const handleEditorReady = (ed: any) => {
    setEditor(ed);
    if (onEditorReady) onEditorReady(ed);
  };

  // Stable callback reference so CommunalSync effect doesn't re-run
  const handleCursorsUpdate = React.useCallback(
    (cursors: Record<string, RemoteCursor>) => setRemoteCursors(cursors),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Scroll the parchment container manually
      const sheetWrap = document.getElementById("sheetWrap");
      if (sheetWrap) {
        sheetWrap.scrollTop += e.deltaY;
      }
      // Stop propagation so tldraw doesn't zoom/pan
      e.stopPropagation();
    };

    container.addEventListener("wheel", handleWheel, { capture: true });
    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  // Hook up clipboard pasting for images
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          // Prevent default browser/tldraw paste for images
          e.preventDefault();

          const reader = new FileReader();
          reader.onload = async (event) => {
            const result = event.target?.result;
            if (typeof result !== "string") return;

            const img = new Image();
            img.onload = () => {
              // Proportionally scale to prevent massive images on the medieval parchment
              let w = img.width;
              let h = img.height;
              const maxDim = 500; // fits beautifully on standard parchment layout
              if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
              }

              // Create unique IDs using tldraw helpers
              const randId = Math.random().toString(36).substring(2, 11);
              const assetId = ("asset:" + randId) as any;
              const shapeId = createShapeId(randId);

              // Center the pasted image beautifully in the visible container
              const rect = container.getBoundingClientRect();
              const cx = Math.max(20, rect.width / 2 - w / 2);
              const cy = Math.max(20, rect.height / 2 - h / 2);

              // Register asset and render image shape
              editor.run(() => {
                editor.createAssets([
                  {
                    id: assetId,
                    type: "image",
                    typeName: "asset",
                    props: {
                      name: file.name || "parchment_paste.png",
                      src: result,
                      w,
                      h,
                      mimeType: file.type,
                    },
                  },
                ]);

                editor.createShapes([
                  {
                    id: shapeId,
                    type: "image",
                    x: cx,
                    y: cy,
                    props: {
                      assetId,
                      w,
                      h,
                    },
                  },
                ]);
              });
            };
            img.src = result;
          };
          reader.readAsDataURL(file);
        }
      }
    };

    container.addEventListener("paste", handlePaste);
    return () => {
      container.removeEventListener("paste", handlePaste);
    };
  }, [editor]);

  // Capture phase pointer listeners to grab touch/mouse points without Tldraw event swallowing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMagnifierActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPointer({ x, y, isDown: true });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMagnifierActive) {
      if (pointer) setPointer(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if pointer is actively drawing (primary button down, touch down)
    const isPrimaryDown = (e.buttons & 1) === 1 || e.pointerType === "touch";
    setPointer({ x, y, isDown: isPrimaryDown });
  };

  const handlePointerUp = () => {
    setPointer(null);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-auto touch-none select-none"
      style={{ zIndex: 10 }}
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerUp}
    >
      <Tldraw 
        licenseKey={(import.meta as any).env.VITE_TLDRAW_LICENSE_KEY || "tldraw-2026-07-16/WyJSbno4UEg5NyIsWyIqIl0sMTYsIjIwMjYtMDctMTYiXQ.LQDDOTuUGf1MoAbBi9VJ51zhvlQVtcKPlTex82YLal0mcUXaEtekcMIvYoFN1PWjgYKHwn2exAEh0CQf2EaOiQ"}
        autoFocus={false}
        hideUi={true}
      >
        <EditorRefSetter onEditorReady={handleEditorReady} />
        <CommunalSync onCursorsUpdate={handleCursorsUpdate} />
        <CameraLock />
        <ScrollBoundsUpdater />
      </Tldraw>

      {/* Ghost cursors — desktop only, rendered over the canvas */}
      <GhostCursors cursors={remoteCursors} mySessionId={SESSION_ID} />

      {isMagnifierActive && pointer && pointer.isDown && (
        <MagnifierOverlay pointer={pointer} editor={editor} />
      )}
    </div>
  );
}
