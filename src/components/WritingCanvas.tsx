import React, { useEffect } from "react";
import { Tldraw, useEditor, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";

interface WritingCanvasProps {
  onEditorReady: (editor: any) => void;
  isMagnifierActive?: boolean;
}

function EditorRefSetter({ onEditorReady }: { onEditorReady: (editor: any) => void }) {
  const editor = useEditor();
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  return null;
}

function CommunalSync() {
  const editor = useEditor();
  const isInitialLoadCompleteRef = React.useRef(false);
  const isUpdatingFromServerRef = React.useRef(false);
  const lastLocalChangeTimeRef = React.useRef<number>(0);

  useEffect(() => {
    // Helper to identify document-level records (shapes, assets, pages, and the root document)
    const isDocumentRecord = (r: any) => {
      return (
        r &&
        (r.typeName === "shape" ||
          r.typeName === "asset" ||
          r.typeName === "page" ||
          r.typeName === "document")
      );
    };

    // Helper to safely extract store and schema from diverse tldraw snapshot formats
    const getStoreAndSchema = (snap: any) => {
      if (!snap) return null;
      if (snap.document && snap.document.store) {
        return {
          store: snap.document.store,
          schema: snap.document.schema || snap.schema,
        };
      }
      if (snap.store) {
        return {
          store: snap.store,
          schema: snap.schema,
        };
      }
      return null;
    };

    // Load initial state from shared persistent backend
    const loadState = async () => {
      try {
        const response = await fetch("/api/canvas-state");
        if (!response.ok) return;
        const data = await response.json();
        const extracted = getStoreAndSchema(data);
        if (extracted && extracted.store && extracted.schema) {
          isUpdatingFromServerRef.current = true;

          const currentSnapshot = getSnapshot(editor.store) as any;
          const currentExtracted = getStoreAndSchema(currentSnapshot);
          const currentStore = currentExtracted ? currentExtracted.store : {};

          const localDocs: any = {};
          for (const [id, record] of Object.entries(currentStore || {})) {
            if (isDocumentRecord(record)) {
              localDocs[id] = record;
            }
          }

          const remoteDocs: any = {};
          for (const [id, record] of Object.entries(extracted.store || {})) {
            if (isDocumentRecord(record)) {
              remoteDocs[id] = record;
            }
          }

          const toPut: any[] = [];
          const toRemove: any[] = [];

          for (const [id, rr] of Object.entries(remoteDocs)) {
            const lr = localDocs[id];
            if (!lr || JSON.stringify(lr) !== JSON.stringify(rr)) {
              toPut.push(rr);
            }
          }

          for (const [id, lr] of Object.entries(localDocs)) {
            const lrd = lr as any;
            if (lrd.typeName !== "page" && lrd.typeName !== "document" && !remoteDocs[id]) {
              toRemove.push(id);
            }
          }

          if (toPut.length > 0 || toRemove.length > 0) {
            editor.store.put(toPut);
            if (toRemove.length > 0) {
              editor.store.remove(toRemove);
            }
          }

          isUpdatingFromServerRef.current = false;
        }

        // Mark initial load as completed successfully so we can begin saving user edits
        isInitialLoadCompleteRef.current = true;
      } catch (err) {
        console.error("Error loading communal canvas state:", err);
      }
    };

    loadState();

    // Debounced save to shared persistent backend
    let saveTimeout: any = null;

    const saveState = async () => {
      try {
        const snapshot = getSnapshot(editor.store) as any;
        const extracted = getStoreAndSchema(snapshot);
        const storeToFilter = extracted ? extracted.store : null;
        const schema = extracted ? extracted.schema : null;

        if (!storeToFilter) {
          console.warn("[WritingCanvas] No store found in snapshot to save.");
          return;
        }

        const filteredStore: any = {};
        for (const [id, record] of Object.entries(storeToFilter)) {
          if (isDocumentRecord(record)) {
            filteredStore[id] = record;
          }
        }

        const filteredSnapshot = {
          store: filteredStore,
          schema: schema,
        };

        await fetch("/api/canvas-state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(filteredSnapshot),
        });
      } catch (err) {
        console.error("Error saving communal canvas state:", err);
      }
    };

    const unsubscribe = editor.store.listen((entry) => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return; // Prevent overwriting state before it is finished loading
      
      // Check if there are any actual document-level record changes (shapes, pages, etc.)
      let hasDocChanges = false;
      try {
        const changes = entry.changes;
        if (changes) {
          if (changes.added) {
            for (const r of Object.values(changes.added)) {
              if (isDocumentRecord(r)) {
                hasDocChanges = true;
                break;
              }
            }
          }
          if (!hasDocChanges && changes.updated) {
            for (const update of Object.values(changes.updated) as any[]) {
              if (Array.isArray(update)) {
                const [from, to] = update;
                if (isDocumentRecord(from) || isDocumentRecord(to)) {
                  hasDocChanges = true;
                  break;
                }
              }
            }
          }
          if (!hasDocChanges && changes.removed) {
            for (const r of Object.values(changes.removed)) {
              if (isDocumentRecord(r)) {
                hasDocChanges = true;
                break;
              }
            }
          }
        }
      } catch (e) {
        hasDocChanges = true; // Fallback to true on any error to be safe
      }

      if (hasDocChanges) {
        // Record the timestamp of this local change to guard polling
        lastLocalChangeTimeRef.current = Date.now();
        
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveState();
        }, 500); // 500ms debounce for faster, snappier synchronization
      }
    });

    // Poll the server every 5 seconds for updates from other users
    const pollInterval = setInterval(async () => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return; // Wait until initial load is done
      
      // Prevent stale server loads from overwriting recent active edits/erasures
      if (Date.now() - lastLocalChangeTimeRef.current < 4000) {
        return;
      }
      
      try {
        const response = await fetch("/api/canvas-state");
        if (!response.ok) return;
        const data = await response.json();
        const extracted = getStoreAndSchema(data);
        if (extracted && extracted.store && extracted.schema) {
          const currentSnapshot = getSnapshot(editor.store) as any;
          const currentExtracted = getStoreAndSchema(currentSnapshot);
          const currentStore = currentExtracted ? currentExtracted.store : {};
          
          // Get local document records
          const localDocs: any = {};
          for (const [id, record] of Object.entries(currentStore || {})) {
            if (isDocumentRecord(record)) {
              localDocs[id] = record;
            }
          }
          
          // Get remote document records
          const remoteDocs: any = {};
          for (const [id, record] of Object.entries(extracted.store || {})) {
            if (isDocumentRecord(record)) {
              remoteDocs[id] = record;
            }
          }
          
          // Compare local and remote document-level records
          const localKeys = Object.keys(localDocs);
          const remoteKeys = Object.keys(remoteDocs);
          
          let hasChanges = false;
          if (localKeys.length !== remoteKeys.length) {
            hasChanges = true;
          } else {
            // Check if any remote record differs or is missing locally
            for (const id of remoteKeys) {
              if (!localDocs[id] || JSON.stringify(localDocs[id]) !== JSON.stringify(remoteDocs[id])) {
                hasChanges = true;
                break;
              }
            }
          }
          
          if (hasChanges) {
            // Only update if the user is not currently active drawing/dragging to prevent cursor jumps
            const inputs = editor.inputs as any;
            if (!inputs.isDown && !inputs.isDragging) {
              isUpdatingFromServerRef.current = true;
              
              const toPut: any[] = [];
              const toRemove: any[] = [];
              
              for (const [id, rr] of Object.entries(remoteDocs)) {
                const lr = localDocs[id];
                if (!lr || JSON.stringify(lr) !== JSON.stringify(rr)) {
                  toPut.push(rr);
                }
              }
              
              for (const id of localKeys) {
                const lr = localDocs[id];
                if (lr.typeName !== "page" && lr.typeName !== "document" && !remoteDocs[id]) {
                  toRemove.push(id);
                }
              }
              
              if (toPut.length > 0 || toRemove.length > 0) {
                editor.store.put(toPut);
                if (toRemove.length > 0) {
                  editor.store.remove(toRemove);
                }
              }
              
              isUpdatingFromServerRef.current = false;
            }
          }
        }
      } catch (err) {
        // Fail silently during background polling
      }
    }, 5000);

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
      className="absolute inset-0 w-full h-full pointer-events-auto"
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
