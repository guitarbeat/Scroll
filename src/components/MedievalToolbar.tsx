import React, { useState, useEffect } from "react";
import { DefaultColorStyle, Editor } from "tldraw";
import { Feather, Eraser, Undo2, Redo2, Type, MousePointer2, Hand, CalendarDays } from "lucide-react";
import { motion, useDragControls, PanInfo } from "motion/react";

interface MedievalToolbarProps {
  editor: Editor;
  showDate: boolean;
  onToggleDate: () => void;
}

// Tool labels shown beneath the toolbar when a non-default tool is active
const TOOL_LABELS: Record<string, string> = {
  select: "Tap or drag to select",
  hand:   "Drag to pan the scroll",
  draw:   "Draw on the scroll",
  text:   "Tap anywhere to place text",
  eraser: "Tap or drag to erase",
};

const INK_COLORS = [
  { id: "black", name: "Iron Gall", hex: "#151515" },
  { id: "red", name: "Cinnabar", hex: "#8a241b" },
  { id: "blue", name: "Lapis", hex: "#29467d" },
  { id: "green", name: "Malachite", hex: "#3b5c46" },
  { id: "yellow", name: "Orpiment", hex: "#c99a2c" },
] as const;

export default function MedievalToolbar({
  editor,
  showDate,
  onToggleDate,
}: MedievalToolbarProps) {
  const [currentTool, setCurrentTool] = useState("draw");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [currentColor, setCurrentColor] = useState<string>("black");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const tool = editor.getCurrentToolId?.() ?? "draw";
      setCurrentTool(tool);
      setCanUndo(editor.getCanUndo?.() ?? false);
      setCanRedo(editor.getCanRedo?.() ?? false);
      
      const styleColor = editor.getSharedStyles().getAsKnownValue(DefaultColorStyle);
      if (styleColor) {
        setCurrentColor(styleColor as string);
      }
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
    setIsColorPickerOpen(false);
    
    if (next === "draw" || next === "text") {
      editor.setStyleForNextShapes(DefaultColorStyle, currentColor as any);
    }
  };

  const isActive = (toolId: string) => currentTool === toolId;

  const handleColorSelect = (colorId: string) => {
    setCurrentColor(colorId);
    editor.setStyleForNextShapes(DefaultColorStyle, colorId as any);
    editor.setStyleForSelectedShapes(DefaultColorStyle, colorId as any);
    setIsColorPickerOpen(false);
    
    if (currentTool !== "draw" && currentTool !== "text") {
      editor.setCurrentTool("draw");
      setCurrentTool("draw");
    }
  };

  const activeColorHex = INK_COLORS.find(c => c.id === currentColor)?.hex || "#151515";

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
  const isTop = position === "top";

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.point.y < window.innerHeight / 2) {
      setPosition("top");
    } else {
      setPosition("bottom");
    }
  };

  return (
    <motion.div
      layout
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      className={`fixed left-1/2 z-50 flex flex-col items-center`}
      style={{ 
        x: "-50%",
        bottom: position === "bottom" ? "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)" : "auto",
        top: position === "top" ? "max(1.25rem, env(safe-area-inset-top, 0px) + 0.5rem)" : "auto",
        touchAction: 'none'
      }}
    >
      {/* Contextual hint — only shown for non-draw tools */}
      {hint && (
        <div className={`text-[#ebdcb9]/70 text-[10px] font-serif tracking-wide animate-fade-in select-none pointer-events-none ${isTop ? 'order-last mt-1' : 'mb-1'}`}>
          {hint}
        </div>
      )}

      {/* Color Palette Popover (Rendered outside overflow container) */}
      {isColorPickerOpen && (
        <div className={`flex items-center gap-2 bg-[#2e1d11]/90 backdrop-blur-md border border-[#cca162]/30 p-2 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85)] animate-fade-in pointer-events-auto ${isTop ? 'order-last mt-2' : 'mb-2'}`}>
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => handleColorSelect(c.id)}
              title={c.name}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${currentColor === c.id ? "border-[#cca162]" : "border-transparent"}`}
            >
              <div 
                className="w-5 h-5 rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative"
                style={{ backgroundColor: c.hex }}
              >
                <div className="absolute top-0.5 left-0.5 w-1.5 h-[3px] bg-white/20 rounded-full" />
              </div>
            </button>
          ))}
        </div>
      )}

      <div
        id="medieval-toolbar"
        className="flex items-center gap-2 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] pl-3 pr-2 py-1.5 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.15)] select-none pointer-events-auto overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing"
        style={{ maxWidth: "min(95vw, 440px)", scrollbarWidth: "none" }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          dragControls.start(e);
        }}
      >
        {/* Pointer (Select) */}
        {btn("select", <MousePointer2 className="w-3.5 h-3.5" />, "Select")}

        {/* Hand (Pan) */}
        {btn("hand",   <Hand className="w-3.5 h-3.5" />, "Pan")}

        {/* Draw (Quill) — primary tool */}
        {btn("draw",   <Feather className="w-3.5 h-3.5" />, "Quill")}

        {/* Text — tap scroll to place text inline */}
        {btn("text",   <Type    className="w-3.5 h-3.5" />, "Write text")}

        {/* Eraser */}
        {btn("eraser", <Eraser  className="w-3.5 h-3.5" />, "Erase")}

        {divider}

        {/* Date Toggle */}
        <button
          onClick={onToggleDate}
          aria-label="Toggle Date"
          title="Toggle creation date"
          style={{ minWidth: 44, minHeight: 44 }}
          className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
            showDate
              ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
              : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
        </button>

        {divider}

        {/* Inkwell Color Picker */}
        <div className="relative flex items-center justify-center">
          <button
            aria-label="Select Ink Color"
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="relative flex items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer shrink-0"
            style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }}
          >
            <div className="absolute inset-[9px] rounded-full border-2 border-[#cca162]/90 bg-gradient-to-br from-[#d4b382] via-[#916b3d] to-[#5c401f] shadow-md flex items-center justify-center">
              <div 
                className="w-3.5 h-3.5 rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative transition-colors duration-300"
                style={{ backgroundColor: activeColorHex }}
              >
                <div className="absolute top-0.5 left-0.5 w-1 h-0.5 bg-white/20 rounded-full" />
              </div>
            </div>
          </button>
        </div>

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
    </motion.div>
  );
}
