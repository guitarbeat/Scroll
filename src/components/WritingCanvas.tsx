import React, { useEffect } from "react";
import { Tldraw, useEditor, getSnapshot, loadSnapshot } from "tldraw";
import "tldraw/tldraw.css";

interface WritingCanvasProps {
  onEditorReady: (editor: any) => void;
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
      
      const source = entry.source as any;
      if (source === "local" || source === "user") {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveState();
        }, 1000); // 1s debounce to avoid spamming the backend
      }
    });

    // Poll the server every 5 seconds for updates from other users
    const pollInterval = setInterval(async () => {
      if (isUpdatingFromServerRef.current) return;
      if (!isInitialLoadCompleteRef.current) return; // Wait until initial load is done
      
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

export default function WritingCanvas({ onEditorReady }: WritingCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ zIndex: 10 }}
    >
      <Tldraw 
        autoFocus={false}
        hideUi={true}
      >
        <EditorRefSetter onEditorReady={onEditorReady} />
        <CommunalSync />
        <CameraLock />
      </Tldraw>
    </div>
  );
}
