import React, { useState, useEffect } from "react";
import { DefaultColorStyle } from "tldraw";
import { Feather, Eraser, Hand, MousePointer, Undo2, Type } from "lucide-react";

interface MedievalToolbarProps {
  editor: any;
}

export default function MedievalToolbar({ editor }: MedievalToolbarProps) {
  const [currentTool, setCurrentTool] = useState("draw");
  const [currentColor, setCurrentColor] = useState<string>("black");

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      setCurrentTool(editor.getCurrentToolId());
      try {
        const styles = editor.getSharedStyles();
        const colorStyle = styles.get(DefaultColorStyle);
        if (colorStyle && colorStyle.type === "shared") {
          setCurrentColor(colorStyle.value as string);
        }
      } catch (_) {}
    };
    const cleanup = editor.store.listen(update);
    update();
    return cleanup;
  }, [editor]);

  if (!editor) return null;

  const selectTool = (toolId: string) => {
    editor.setCurrentTool(toolId);
    setCurrentTool(toolId);
  };

  const selectColor = (colorId: string) => {
    try {
      editor.setStyleForSelectedShapes(DefaultColorStyle, colorId as any);
      editor.setStyleForNextShapes(DefaultColorStyle, colorId as any);
      setCurrentColor(colorId);
      const hasSelection = editor.getSelectedShapeIds().length > 0;
      if (!hasSelection && currentTool !== "draw" && currentTool !== "select") {
        selectTool("draw");
      }
    } catch (_) {}
  };

  const btn = (toolId: string, icon: React.ReactNode, label: string) => (
    <button
      key={toolId}
      onClick={() => selectTool(toolId)}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group
        w-8 h-8 sm:w-8 sm:h-8
        ${currentTool === toolId
          ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
          : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"}`}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      {icon}
      <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 hidden sm:block">
        {label}
      </span>
    </button>
  );

  const divider = <div className="w-[1.5px] h-5 bg-gradient-to-b from-[#cca162]/15 via-[#cca162]/55 to-[#cca162]/15 shrink-0" />;

  return (
    <div
      id="medieval-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] px-3 py-1.5 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.15)] select-none pointer-events-auto animate-fade-in"
      style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))", maxWidth: "min(95vw, 500px)" }}
    >
      {btn("select",  <MousePointer className="w-3.5 h-3.5" />, "Selection Pointer")}
      {btn("draw",    <Feather       className="w-3.5 h-3.5" />, "Scribe's Quill")}
      {btn("text",    <Type          className="w-3.5 h-3.5" />, "Scribe's Type")}
      {btn("eraser",  <Eraser        className="w-3.5 h-3.5" />, "Parchment Scraper")}
      {btn("hand",    <Hand          className="w-3.5 h-3.5" />, "Scroll Hand")}

      {divider}

      {/* Inkwell */}
      <button
        onClick={() => selectColor("black")}
        aria-label="Iron Gall Ink"
        className="relative flex items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer group shrink-0"
        style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
      >
        <div className="absolute inset-[9px] rounded-full border-2 border-[#cca162]/90 bg-gradient-to-br from-[#d4b382] via-[#916b3d] to-[#5c401f] shadow-md flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-[#151515] shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative">
            <div className="absolute top-0.5 left-0.5 w-1 h-0.5 bg-white/20 rounded-full" />
          </div>
        </div>
        {currentColor === "black" && (
          <span className="absolute inset-[8px] rounded-full border border-[#cca162] ring-1 ring-[#e3bf8c]/40 animate-pulse" />
        )}
      </button>

      {divider}

      {/* Undo */}
      <button
        onClick={() => editor.undo()}
        aria-label="Undo"
        className="flex items-center justify-center rounded-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-90 transition-all shrink-0 cursor-pointer"
        style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
