import React, { useState, useEffect } from "react";
import { DefaultColorStyle, Editor } from "tldraw";
import { Feather, Eraser, Undo2, Redo2, Type } from "lucide-react";

interface MedievalToolbarProps {
  editor: Editor;
}

// Tool labels shown beneath the toolbar when a non-default tool is active
const TOOL_LABELS: Record<string, string> = {
  draw:   "",        // default — no label needed
  text:   "Tap anywhere to place text",
  eraser: "Tap or drag to erase",
};

export default function MedievalToolbar({
  editor,
}: MedievalToolbarProps) {
  const [currentTool, setCurrentTool] = useState("draw");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const tool = editor.getCurrentToolId?.() ?? "draw";
      setCurrentTool(tool);
      setCanUndo(editor.getCanUndo?.() ?? false);
      setCanRedo(editor.getCanRedo?.() ?? false);
    };
    const cleanup = editor.store.listen(update);
    update();
    return cleanup;
  }, [editor]);

  if (!editor) return null;

  const selectTool = (toolId: string) => {
    // Tapping the already-active tool returns to draw mode (natural "deselect")
    const next = toolId === currentTool ? "draw" : toolId;
    editor.setCurrentTool(next);
    setCurrentTool(next);
  };

  const isActive = (toolId: string) => currentTool === toolId;

  const btn = (toolId: string, icon: React.ReactNode, label: string) => (
    <button
      key={toolId}
      onClick={() => selectTool(toolId)}
      aria-label={label}
      title={label}
      style={{ minWidth: 44, minHeight: 44 }}
      className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer
        ${isActive(toolId)
          ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
          : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
        }`}
    >
      {icon}
    </button>
  );

  const divider = (
    <div className="w-[1.5px] h-5 bg-gradient-to-b from-[#cca162]/15 via-[#cca162]/55 to-[#cca162]/15 shrink-0" />
  );

  const hint = TOOL_LABELS[currentTool];

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Contextual hint — only shown for non-draw tools */}
      {hint && (
        <div className="text-[#ebdcb9]/70 text-[10px] font-serif tracking-wide animate-fade-in select-none pointer-events-none">
          {hint}
        </div>
      )}

      <div
        id="medieval-toolbar"
        className="flex items-center gap-1 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] px-3 py-1 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.15)] select-none pointer-events-auto"
        style={{ maxWidth: "min(95vw, 420px)" }}
      >
        {/* Draw (Quill) — primary tool */}
        {btn("draw",   <Feather className="w-3.5 h-3.5" />, "Quill")}

        {/* Text — tap scroll to place text inline */}
        {btn("text",   <Type    className="w-3.5 h-3.5" />, "Write text")}

        {/* Eraser */}
        {btn("eraser", <Eraser  className="w-3.5 h-3.5" />, "Erase")}

        {divider}

        {/* Inkwell (just one ink for now — iron gall black) */}
        <button
          aria-label="Iron Gall Ink"
          className="relative flex items-center justify-center rounded-full transition-transform active:scale-95 cursor-default shrink-0"
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
        >
          <div className="absolute inset-[9px] rounded-full border-2 border-[#cca162]/90 bg-gradient-to-br from-[#d4b382] via-[#916b3d] to-[#5c401f] shadow-md flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#151515] shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative">
              <div className="absolute top-0.5 left-0.5 w-1 h-0.5 bg-white/20 rounded-full" />
            </div>
          </div>
        </button>

        {divider}

        {/* Unified Temporal Controls (Undo & Redo) */}
        <div className="flex items-center bg-[#cca162]/5 border border-[#cca162]/20 rounded-full p-[2px] h-11 shrink-0">
          {/* Undo Part */}
          <button
            onClick={() => editor.undo()}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo last stroke"
            style={{ width: 40, height: 40 }}
            className="flex items-center justify-center rounded-l-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-5 bg-[#cca162]/20 self-center" />

          {/* Redo Part */}
          <button
            onClick={() => editor.redo()}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo next stroke"
            style={{ width: 40, height: 40 }}
            className="flex items-center justify-center rounded-r-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
