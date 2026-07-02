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

  useEffect(() => {
    let isUpdatingFromServer = false;

    // Load initial state from shared persistent backend
    const loadState = async () => {
      try {
        const response = await fetch("/api/canvas-state");
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.store && data.schema) {
          isUpdatingFromServer = true;
          loadSnapshot(editor.store, data);
          isUpdatingFromServer = false;
        }
      } catch (err) {
        console.error("Error loading communal canvas state:", err);
      }
    };

    loadState();

    // Debounced save to shared persistent backend
    let saveTimeout: any = null;

    const saveState = async () => {
      try {
        const snapshot = getSnapshot(editor.store);
        await fetch("/api/canvas-state", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(snapshot),
        });
      } catch (err) {
        console.error("Error saving communal canvas state:", err);
      }
    };

    const unsubscribe = editor.store.listen((entry) => {
      if (isUpdatingFromServer) return;
      
      if (entry.source === "user") {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveState();
        }, 1000); // 1s debounce to avoid spamming the backend
      }
    });

    // Poll the server every 5 seconds for updates from other users
    const pollInterval = setInterval(async () => {
      if (isUpdatingFromServer) return;
      
      try {
        const response = await fetch("/api/canvas-state");
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.store && data.schema) {
          const currentSnapshot = getSnapshot(editor.store) as any;
          
          const localKeys = Object.keys(currentSnapshot.store || {});
          const remoteKeys = Object.keys(data.store || {});
          
          if (localKeys.length !== remoteKeys.length || JSON.stringify(currentSnapshot.store) !== JSON.stringify(data.store)) {
            // Only update if the user is not currently active drawing/dragging to prevent cursor jumps
            const inputs = editor.inputs as any;
            if (!inputs.isDown && !inputs.isDragging) {
              isUpdatingFromServer = true;
              loadSnapshot(editor.store, data);
              isUpdatingFromServer = false;
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
  return (
    <div 
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
