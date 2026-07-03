import React, { useEffect } from "react";
import { Tldraw, useEditor, getSnapshot, loadSnapshot, createShapeId } from "tldraw";
import "tldraw/tldraw.css";

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

function CommunalSync() {
  const editor = useEditor();
  const isInitialLoadCompleteRef = React.useRef(false);
  const isUpdatingFromServerRef = React.useRef(false);

  // Track which shape IDs we've sent so we can detect deletions.
  const knownShapeIdsRef = React.useRef<Set<string>>(new Set());
  // Track the last-seen serialized value per shape ID so we only send diffs.
  const lastSentRef = React.useRef<Record<string, string>>({});

  useEffect(() => {
    const isShapeRecord = (r: any) =>
      r && (r.typeName === "shape" || r.typeName === "asset");

    // ── Initial load ────────────────────────────────────────────────────────
    const loadState = async () => {
      try {
        const response = await fetch("/api/sync-state");
        if (!response.ok) return;
        const data = await response.json();
        if (data.status === "empty" || !data.shapes) return;

        const { shapes, deleted } = data as {
          shapes: Record<string, any>;
          deleted: string[];
        };

        isUpdatingFromServerRef.current = true;

        // Apply all remote shapes that differ from local
        const toPut = Object.values(shapes).filter((r) => isShapeRecord(r));
        if (toPut.length > 0) editor.store.put(toPut);

        // Remove any shapes the server says were deleted
        const toRemove = (deleted || []).filter((id) => {
          const r = editor.store.get(id as any);
          return r && isShapeRecord(r);
        });
        if (toRemove.length > 0) editor.store.remove(toRemove as any[]);

        // Seed our tracking maps from what's now in the store
        const snapshot = getSnapshot(editor.store) as any;
        const store = snapshot?.document?.store || snapshot?.store || {};
        for (const [id, record] of Object.entries(store)) {
          if (isShapeRecord(record)) {
            knownShapeIdsRef.current.add(id);
            lastSentRef.current[id] = JSON.stringify(record);
          }
        }

        isUpdatingFromServerRef.current = false;
      } catch (err) {
        console.error("[CommunalSync] loadState error:", err);
        isUpdatingFromServerRef.current = false;
      } finally {
        isInitialLoadCompleteRef.current = true;
      }
    };

    loadState();

    // ── Save: only the diff ─────────────────────────────────────────────────
    // Collects changed/added/removed shapes since the last save and sends only
    // those keys. Other users' shapes in Redis are never touched.
    let saveTimeout: any = null;

    const saveState = async () => {
      try {
        const snapshot = getSnapshot(editor.store) as any;
        const store = snapshot?.document?.store || snapshot?.store || {};
        const schema = snapshot?.document?.schema || snapshot?.schema;

        const upserted: Record<string, any> = {};
        const deleted: string[] = [];

        // Find added / changed shapes
        for (const [id, record] of Object.entries(store)) {
          if (!isShapeRecord(record)) continue;
          const serialized = JSON.stringify(record);
          if (lastSentRef.current[id] !== serialized) {
            upserted[id] = record;
            lastSentRef.current[id] = serialized;
            knownShapeIdsRef.current.add(id);
          }
        }

        // Find deleted shapes (were known, now gone)
        for (const id of knownShapeIdsRef.current) {
          if (!store[id]) {
            deleted.push(id);
            knownShapeIdsRef.current.delete(id);
            delete lastSentRef.current[id];
          }
        }

        if (Object.keys(upserted).length === 0 && deleted.length === 0) return;

        await fetch("/api/sync-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema, upserted, deleted }),
        });
      } catch (err) {
        console.error("[CommunalSync] saveState error:", err);
      }
    };

    // Listen for any local store changes and debounce the save
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
        saveTimeout = setTimeout(saveState, 400);
      }
    });

    // ── Poll: merge-in remote changes every 2 seconds ───────────────────────
    // Because saves are now per-shape, polling can always apply remote shapes
    // without fear of overwriting local ones — it only adds/updates shapes
    // that differ from local, and removes shapes the server marked deleted.
    // The pointer-down guard is removed so updates appear while drawing.
    const pollInterval = setInterval(async () => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return;

      try {
        const response = await fetch("/api/sync-state");
        if (!response.ok) return;
        const data = await response.json();
        if (data.status === "empty" || !data.shapes) return;

        const { shapes, deleted } = data as {
          shapes: Record<string, any>;
          deleted: string[];
        };

        const snapshot = getSnapshot(editor.store) as any;
        const localStore = snapshot?.document?.store || snapshot?.store || {};

        const toPut: any[] = [];
        for (const [id, remoteRecord] of Object.entries(shapes)) {
          if (!isShapeRecord(remoteRecord)) continue;
          const localRecord = localStore[id];
          // Only apply if the remote version differs from what we last sent
          // (i.e. it came from someone else) and differs from local
          const remoteSerialized = JSON.stringify(remoteRecord);
          if (
            lastSentRef.current[id] !== remoteSerialized &&
            JSON.stringify(localRecord) !== remoteSerialized
          ) {
            toPut.push(remoteRecord);
          }
        }

        const toRemove = (deleted || []).filter((id) => {
          // Only remove if we didn't delete it ourselves (already gone from lastSent)
          return lastSentRef.current[id] !== undefined && !knownShapeIdsRef.current.has(id) === false && localStore[id];
        });

        if (toPut.length > 0 || toRemove.length > 0) {
          isUpdatingFromServerRef.current = true;
          if (toPut.length > 0) editor.store.put(toPut);
          if (toRemove.length > 0) editor.store.remove(toRemove as any[]);
          isUpdatingFromServerRef.current = false;
        }
      } catch (_) {
        // Fail silently during background polling
        isUpdatingFromServerRef.current = false;
      }
    }, 2000);

    return () => {
      unsubscribe();
      if (saveTimeout) clearTimeout(saveTimeout);
      clearInterval(pollInterval);
    };
  }, [editor]);

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

  const handleEditorReady = (ed: any) => {
    setEditor(ed);
    if (onEditorReady) {
      onEditorReady(ed);
    }
  };

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
        <CommunalSync />
        <CameraLock />
        <ScrollBoundsUpdater />
      </Tldraw>

      {isMagnifierActive && pointer && pointer.isDown && (
        <MagnifierOverlay pointer={pointer} editor={editor} />
      )}
    </div>
  );
}
