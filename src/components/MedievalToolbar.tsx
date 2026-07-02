import React, { useState, useEffect } from "react";
import { DefaultColorStyle } from "tldraw";
import { 
  Feather, 
  Eraser, 
  Hand, 
  MousePointer, 
  Undo2,
  Type
} from "lucide-react";

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
      } catch (e) {
        // Fallback gracefully
      }
    };

    const cleanup = editor.store.listen(update);
    update(); // Initial sync
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
    } catch (e) {
      console.error("Error setting color style:", e);
    }
  };

  const inks = [
    { id: "black", hex: "#1e1e1d", name: "Iron Gall Black" },
  ];

  return (
    <div 
      id="medieval-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      className="mt-5 self-center z-40 flex items-center gap-2.5 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] px-4 py-1.5 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.15)] select-none pointer-events-auto shrink-0 scale-90 sm:scale-100 animate-fade-in"
    >
      {/* Tools Section */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Selection Pointer */}
        <button
          onClick={() => selectTool("select")}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group ${
            currentTool === "select"
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Selection Pointer
          </span>
        </button>

        {/* Scribe's Quill */}
        <button
          onClick={() => selectTool("draw")}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group ${
            currentTool === "draw"
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <Feather className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Scribe's Quill (Draw)
          </span>
        </button>

        {/* Scribe's Type */}
        <button
          onClick={() => selectTool("text")}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group ${
            currentTool === "text"
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Scribe's Type (Write)
          </span>
        </button>

        {/* Parchment Scraper */}
        <button
          onClick={() => selectTool("eraser")}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group ${
            currentTool === "eraser"
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Parchment Scraper (Eraser)
          </span>
        </button>

        {/* Pan & Scroll Hand */}
        <button
          onClick={() => selectTool("hand")}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer relative group ${
            currentTool === "hand"
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Scroll Hand (Pan)
          </span>
        </button>
      </div>

      {/* Metallic Divider */}
      <div className="w-[1.5px] h-5 bg-gradient-to-b from-[#cca162]/15 via-[#cca162]/55 to-[#cca162]/15 shrink-0" />

      {/* Scribe's Physical Inkwell */}
      <div className="flex items-center shrink-0 px-0.5">
        <button
          onClick={() => selectColor("black")}
          className="relative w-7.5 h-7.5 flex items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer group"
          title="Iron Gall Ink"
        >
          {/* Ornate Brass Collar */}
          <div className="absolute inset-0 rounded-full border-2 border-[#cca162]/90 bg-gradient-to-br from-[#d4b382] via-[#916b3d] to-[#5c401f] shadow-md flex items-center justify-center">
            {/* Ink Reservoir */}
            <div className="w-4.5 h-4.5 rounded-full bg-[#151515] shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative">
              {/* Highlight glaze */}
              <div className="absolute top-0.5 left-0.5 w-1.5 h-1 bg-white/20 rounded-full filter blur-[0.2px]" />
            </div>
          </div>
          {currentColor === "black" && (
            <span className="absolute -inset-1 rounded-full border border-[#cca162] ring-1 ring-[#e3bf8c]/40 animate-pulse" />
          )}
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Iron Gall Black Ink
          </span>
        </button>
      </div>

      {/* Metallic Divider */}
      <div className="w-[1.5px] h-5 bg-gradient-to-b from-[#cca162]/15 via-[#cca162]/55 to-[#cca162]/15 shrink-0" />

      {/* History and Utility Section */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Undo Stroke */}
        <button
          onClick={() => editor.undo()}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-90 transition-all shrink-0 cursor-pointer relative group"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#1e130a] text-[#ebdcb9] text-[10px] font-serif rounded border border-[#cca162]/50 shadow-[0_4px_8px_rgba(0,0,0,0.5)] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50">
            Undo Stroke
          </span>
        </button>
      </div>
    </div>
  );
}
