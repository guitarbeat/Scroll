import React, { useState, useEffect, useRef } from "react";
import { DefaultColorStyle, Editor } from "tldraw";
import { Feather, Eraser, Undo2, Redo2, Type, MousePointer2, Hand, CalendarDays, Plus, X, SlidersHorizontal, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MedievalToolbarProps {
  editor: Editor;
  showDate: boolean;
  onToggleDate: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// Tool labels shown when a non-default tool is active
const TOOL_LABELS: Record<string, string> = {
  select: "Select mode",
  hand:   "Pan mode",
  draw:   "Quill drawing",
  text:   "Text mode",
  eraser: "Eraser mode",
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
  isExpanded = false,
  onToggleExpand,
}: MedievalToolbarProps) {
  const [currentTool, setCurrentTool] = useState("draw");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [currentColor, setCurrentColor] = useState<string>("black");
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [mode, setMode] = useState<"fab" | "bar">("fab"); // default to sleek FAB mode
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close FAB menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFabOpen(false);
        setIsColorPickerOpen(false);
      }
    };
    if (isFabOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFabOpen]);

  if (!editor) return null;

  const selectTool = (toolId: string) => {
    const next = toolId === currentTool ? "draw" : toolId;
    editor.setCurrentTool(next);
    setCurrentTool(next);
    setIsColorPickerOpen(false);
    setIsFabOpen(false); // auto collapse on tool selection
    
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

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "select": return <MousePointer2 className="w-4 h-4" />;
      case "hand": return <Hand className="w-4 h-4" />;
      case "text": return <Type className="w-4 h-4" />;
      case "eraser": return <Eraser className="w-4 h-4" />;
      default: return <Feather className="w-4 h-4" />;
    }
  };

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

  // ── 1. FLOATING ACTION BUTTON (FAB) MODE ─────────────────────────────────
  if (mode === "fab") {
    return (
      <div 
        ref={menuRef}
        className="fixed z-50 flex flex-col items-end pointer-events-auto"
        style={{
          bottom: "max(1.5rem, env(safe-area-inset-bottom, 0px) + 0.75rem)",
          right: "max(1.5rem, env(safe-area-inset-right, 0px) + 0.75rem)",
        }}
      >
        {/* Speed Dial Menu Popover */}
        <AnimatePresence>
          {isFabOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-3 flex flex-col items-end gap-2 p-3 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.9),_inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-md text-[#ebdcb9]"
            >
              {/* Contextual hint header */}
              <div className="w-full text-right text-[11px] font-serif tracking-wider text-[#cca162]/80 pb-1 border-b border-[#cca162]/20">
                {TOOL_LABELS[currentTool] || "Quill drawing"}
              </div>

              {/* Main Tools Row */}
              <div className="flex items-center gap-1.5 pt-1">
                {btn("select", <MousePointer2 className="w-4 h-4" />, "Select")}
                {btn("hand",   <Hand className="w-4 h-4" />, "Pan")}
                {btn("draw",   <Feather className="w-4 h-4" />, "Quill")}
                {btn("text",   <Type className="w-4 h-4" />, "Write text")}
                {btn("eraser", <Eraser className="w-4 h-4" />, "Erase")}
              </div>

              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#cca162]/30 to-transparent my-0.5" />

              {/* Secondary Controls Row (Ink, Date, Mode, Undo/Redo) */}
              <div className="flex items-center gap-2">
                {/* Expand / Minimize Canvas */}
                {onToggleExpand && (
                  <button
                    onClick={() => {
                      onToggleExpand();
                      setIsFabOpen(false);
                    }}
                    aria-label={isExpanded ? "Exit Full Canvas" : "Expand Canvas"}
                    title={isExpanded ? "Exit Full Canvas" : "Expand canvas to full view"}
                    style={{ minWidth: 40, minHeight: 40 }}
                    className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
                      isExpanded
                        ? "bg-[#8a241b] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border border-[#e3bf8c]/40 scale-105"
                        : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
                    }`}
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}

                {/* Date Toggle */}
                <button
                  onClick={onToggleDate}
                  aria-label="Toggle Date"
                  title="Toggle creation date"
                  style={{ minWidth: 40, minHeight: 40 }}
                  className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
                    showDate
                      ? "bg-gradient-to-b from-[#a8251a] to-[#590e06] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c]/30 scale-105"
                      : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                </button>

                {/* Ink Color Button & Popover */}
                <div className="relative">
                  <button
                    aria-label="Select Ink Color"
                    onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    style={{ minWidth: 40, minHeight: 40 }}
                    className="flex items-center justify-center rounded-full bg-[#cca162]/10 border border-[#cca162]/30 hover:bg-[#cca162]/20 transition-all cursor-pointer"
                  >
                    <div 
                      className="w-4 h-4 rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)] relative"
                      style={{ backgroundColor: activeColorHex }}
                    >
                      <div className="absolute top-0.5 left-0.5 w-1 h-0.5 bg-white/30 rounded-full" />
                    </div>
                  </button>

                  {/* Inline Color Palette */}
                  {isColorPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center gap-1.5 bg-[#2e1d11] border border-[#cca162]/40 p-1.5 rounded-full shadow-lg"
                    >
                      {INK_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleColorSelect(c.id)}
                          title={c.name}
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${currentColor === c.id ? "border-[#cca162]" : "border-transparent"}`}
                        >
                          <div 
                            className="w-4 h-4 rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.9)]"
                            style={{ backgroundColor: c.hex }}
                          />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Switch to Full Bar view */}
                <button
                  onClick={() => {
                    setMode("bar");
                    setIsFabOpen(false);
                  }}
                  title="Switch to Full Bar view"
                  aria-label="Switch to Full Bar view"
                  style={{ minWidth: 40, minHeight: 40 }}
                  className="flex items-center justify-center rounded-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {/* Undo / Redo */}
                <div className="flex items-center bg-[#cca162]/10 border border-[#cca162]/30 rounded-full p-[2px] h-9">
                  <button
                    onClick={() => editor.undo()}
                    disabled={!canUndo}
                    aria-label="Undo"
                    title="Undo last stroke"
                    style={{ width: 34, height: 34 }}
                    className="flex items-center justify-center rounded-l-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-[1px] h-4 bg-[#cca162]/20" />
                  <button
                    onClick={() => editor.redo()}
                    disabled={!canRedo}
                    aria-label="Redo"
                    title="Redo next stroke"
                    style={{ width: 34, height: 34 }}
                    className="flex items-center justify-center rounded-r-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Trigger Buttons */}
        <div className="flex items-center gap-3">
          {/* External Quick Undo Button when collapsed */}
          {!isFabOpen && (
            <button
              onClick={() => editor.undo()}
              disabled={!canUndo}
              aria-label="Undo stroke"
              title="Undo stroke"
              style={{ width: 48, height: 48 }}
              className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#2e1d11] via-[#3a2517] to-[#180e07] border-2 border-[#cca162] text-[#ebdcb9] shadow-[0_10px_24px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-95 hover:scale-105 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 className="w-4 h-4 text-[#ebdcb9]" />
            </button>
          )}

          {/* Main Floating Action Wax Seal Bubble */}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            aria-label={isFabOpen ? "Close menu" : "Open Scriptorium Tools"}
            title={isFabOpen ? "Close menu" : "Open Scriptorium Tools"}
            style={{ width: 68, height: 68 }}
            className={`relative flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer group select-none active:scale-95 ${
              isFabOpen ? "scale-105 rotate-12" : "hover:scale-108 hover:rotate-3"
            }`}
          >
            {/* Wax Seal Image Graphic */}
            <img
              src="/stamp.png"
              alt="Wax Seal Action Bubble"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] transition-all group-hover:brightness-110"
            />

            {/* Subtle Tool / Action Badge overlay on the Seal */}
            <div className={`absolute inset-0 flex items-center justify-center rounded-full transition-all duration-200 ${
              isFabOpen ? "bg-black/40 backdrop-blur-[1px]" : "bg-black/10 group-hover:bg-black/30"
            }`}>
              {isFabOpen ? (
                <X className="w-6 h-6 text-[#fdfcf7] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
              ) : (
                <div className="relative flex items-center justify-center text-[#fffbee] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                  {getToolIcon(currentTool)}
                  <Plus className="w-3.5 h-3.5 absolute -bottom-1 -right-1 text-[#cca162] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                </div>
              )}
            </div>

            {/* Ink Color Indicator Dot */}
            <div 
              className="absolute top-1 right-1 w-4 h-4 rounded-full border-2 border-[#cca162] shadow-[0_2px_6px_rgba(0,0,0,0.9)] transition-colors duration-300"
              style={{ backgroundColor: activeColorHex }}
              title={`Active Ink: ${INK_COLORS.find(c => c.id === currentColor)?.name || "Iron Gall"}`}
            />
          </button>
        </div>
      </div>
    );
  }

  // ── 2. FULL BAR MODE (Optional expanded mode) ────────────────────────────
  return (
    <div
      className="fixed left-1/2 z-50 flex flex-col items-end pointer-events-auto"
      style={{
        x: "-50%",
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
        touchAction: 'none'
      }}
    >
      {/* Color Palette Popover */}
      {isColorPickerOpen && (
        <div className="flex items-center gap-2 bg-[#2e1d11]/90 backdrop-blur-md border border-[#cca162]/30 p-2 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85)] animate-fade-in pointer-events-auto mb-2">
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
        className="flex items-center gap-2 bg-gradient-to-b from-[#2e1d11] via-[#422e1b] to-[#1e130a] border-2 border-[#cca162] pl-3 pr-2 py-1.5 rounded-full shadow-[0_12px_28px_rgba(0,0,0,0.85),_inset_0_1px_1px_rgba(255,255,255,0.15)] select-none pointer-events-auto overflow-x-auto overflow-y-hidden"
        style={{ maxWidth: "min(95vw, 480px)", scrollbarWidth: "none" }}
      >
        {btn("select", <MousePointer2 className="w-3.5 h-3.5" />, "Select")}
        {btn("hand",   <Hand className="w-3.5 h-3.5" />, "Pan")}
        {btn("draw",   <Feather className="w-3.5 h-3.5" />, "Quill")}
        {btn("text",   <Type className="w-3.5 h-3.5" />, "Write text")}
        {btn("eraser", <Eraser className="w-3.5 h-3.5" />, "Erase")}

        {divider}

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

        {/* Undo & Redo */}
        <div className="flex items-center bg-[#cca162]/5 border border-[#cca162]/20 rounded-full p-[2px] h-11 shrink-0">
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

        {divider}

        {/* Expand / Minimize Canvas */}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            aria-label={isExpanded ? "Exit Full Canvas" : "Expand Canvas"}
            title={isExpanded ? "Exit Full Canvas" : "Expand canvas to full view"}
            style={{ minWidth: 44, minHeight: 44 }}
            className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
              isExpanded
                ? "bg-[#8a241b] text-[#fdfcf7] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] border border-[#e3bf8c]/40"
                : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
            }`}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Switch back to FAB mode */}
        <button
          onClick={() => setMode("fab")}
          title="Switch to Floating Action Button mode"
          aria-label="Switch to Floating Action Button mode"
          style={{ minWidth: 44, minHeight: 44 }}
          className="flex items-center justify-center rounded-full text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee] transition-all cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

