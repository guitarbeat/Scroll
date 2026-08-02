import React, { useState, useEffect, useRef } from "react";
import { DefaultColorStyle, Editor } from "tldraw";
import { Feather, Eraser, Undo2, Redo2, Type, Hand, CalendarDays, Plus, X, SlidersHorizontal, Maximize2, Minimize2 } from "lucide-react";
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
  hand:   "Grab mode",
  draw:   "Paint mode",
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

interface InkBottleProps {
  colorId: string;
  colorName: string;
  hex: string;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

function InkBottle({ colorId, colorName, hex, isSelected, onClick, compact = false }: InkBottleProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${colorName} ink bottle`}
      title={`${colorName} Ink`}
      className={`relative group flex flex-col items-center justify-center p-1 transition-all duration-200 cursor-pointer select-none rounded-xl focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cca162]/80 ${
        isSelected
          ? "scale-110 -translate-y-0.5"
          : "hover:scale-105 opacity-80 hover:opacity-100"
      }`}
    >
      {/* Active Selection Glow Ring behind bottle */}
      {isSelected && (
        <div className="absolute inset-0 bg-[#cca162]/20 rounded-xl blur-[3px] border border-[#cca162]/70 animate-pulse pointer-events-none" />
      )}

      {/* SVG Apothecary Ink Bottle */}
      <svg
        width={compact ? "28" : "32"}
        height={compact ? "34" : "38"}
        viewBox="0 0 32 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-200"
      >
        <defs>
          {/* Cork Gradient */}
          <linearGradient id={`corkGrad-${colorId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8c5d35" />
            <stop offset="50%" stopColor="#b38254" />
            <stop offset="100%" stopColor="#633e20" />
          </linearGradient>

          {/* Liquid Gradient */}
          <linearGradient id={`inkLiquid-${colorId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hex} stopOpacity="0.85" />
            <stop offset="100%" stopColor={hex} stopOpacity="1" />
          </linearGradient>

          {/* Glass Highlight */}
          <linearGradient id={`glassGleam-${colorId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft Shadow beneath bottle */}
        <ellipse cx="16" cy="36" rx="11" ry="1.8" fill="#000000" fillOpacity="0.55" />

        {/* Cork Stopper - lifts up when selected */}
        <g className={`transition-transform duration-300 origin-bottom ${isSelected ? "-translate-y-1.5" : ""}`}>
          <rect x="11.5" y="2" width="9" height="6" rx="1" fill={`url(#corkGrad-${colorId})`} stroke="#3d2411" strokeWidth="0.7" />
          <line x1="13" y1="3.5" x2="13" y2="5.5" stroke="#3d2411" strokeWidth="0.5" opacity="0.5" />
          <line x1="17" y1="3" x2="17" y2="6" stroke="#3d2411" strokeWidth="0.5" opacity="0.5" />
        </g>

        {/* Bottle Glass Collar / Rim */}
        <ellipse cx="16" cy="8" rx="5.5" ry="1.5" fill="#2d1c10" stroke={isSelected ? "#cca162" : "#7d5d36"} strokeWidth="1" />

        {/* Main Bottle Body Contour */}
        <path
          d="M11 8.5 H21 V11 C21 12.5 26.5 15 26.5 19 V32 C26.5 34.5 24 35.5 21.5 35.5 H10.5 C8 35.5 5.5 34.5 5.5 32 V19 C5.5 15 11 12.5 11 11 Z"
          fill="#1c120a"
          fillOpacity="0.5"
          stroke={isSelected ? "#cca162" : "#7d5d36"}
          strokeWidth="1.2"
        />

        {/* Ink Liquid Filling */}
        <path
          d="M7.5 20.5 C10 19 22 19 24.5 20.5 V31.5 C24.5 33.5 23 34 21 34 H11 C9 34 7.5 33.5 7.5 31.5 Z"
          fill={`url(#inkLiquid-${colorId})`}
        />

        {/* Liquid Surface Meniscus */}
        <ellipse cx="16" cy="20.5" rx="8.5" ry="1.8" fill={hex} opacity="0.95" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.3" />

        {/* Curved Glass Highlight */}
        <path
          d="M8.5 19 C8.5 16 11 13.5 12 12.5 M7.5 21 V30"
          stroke={`url(#glassGleam-${colorId})`}
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Label Stripe / Seal on bottle */}
        <line
          x1="5.5"
          y1="25.5"
          x2="26.5"
          y2="25.5"
          stroke={isSelected ? "#e3bf8c" : "#7d5d36"}
          strokeWidth="0.8"
          strokeDasharray="2 1"
          opacity="0.6"
        />
      </svg>
    </button>
  );
}

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
  const [mode, setMode] = useState<"fab" | "bar">("bar"); // default to full accessible bar mode
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

  // Keyboard shortcuts for instant tool & color access
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "h" || key === "g") {
        selectTool("hand");
      } else if (key === "d" || key === "p" || key === "q") {
        selectTool("draw");
      } else if (key === "t") {
        selectTool("text");
      } else if (key === "e") {
        selectTool("eraser");
      } else if (key === "1") {
        handleColorSelect("black");
      } else if (key === "2") {
        handleColorSelect("red");
      } else if (key === "3") {
        handleColorSelect("blue");
      } else if (key === "4") {
        handleColorSelect("green");
      } else if (key === "5") {
        handleColorSelect("yellow");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, currentTool, currentColor]);

  // Close FAB menu & color picker popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFabOpen(false);
        setIsColorPickerOpen(false);
      }
    };
    if (isFabOpen || isColorPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFabOpen, isColorPickerOpen]);

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
      style={{ minWidth: 40, minHeight: 40 }}
      className={`relative flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3bf8c]
        ${isActive(toolId)
          ? "bg-gradient-to-b from-[#9e2419] via-[#75160c] to-[#420904] text-[#fffbee] shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),_0_3px_10px_rgba(0,0,0,0.7)] border border-[#e3bf8c] scale-105"
          : "text-[#ebdcb9]/85 hover:bg-[#cca162]/20 hover:text-[#fffbee]"
        }`}
    >
      {icon}
    </button>
  );

  const divider = (
    <div className="w-[1px] h-5 bg-gradient-to-b from-transparent via-[#cca162]/40 to-transparent shrink-0 mx-0.5" />
  );

  // ── 1. FLOATING ACTION BUTTON (FAB) MODE ─────────────────────────────────
  if (mode === "fab") {
    return (
      <div 
        ref={menuRef}
        className="fixed flex flex-col items-end pointer-events-auto"
        style={{
          bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
          right: "max(1.25rem, env(safe-area-inset-right, 0px) + 0.5rem)",
          zIndex: 9999,
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
                {btn("hand",   <Hand className="w-4 h-4" />, "Grab")}
                {btn("draw",   <Feather className="w-4 h-4" />, "Paint")}
                {btn("text",   <Type className="w-4 h-4" />, "Text")}
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
                <div className="relative flex items-center justify-center">
                  <InkBottle
                    colorId={currentColor}
                    colorName={INK_COLORS.find(c => c.id === currentColor)?.name || "Iron Gall"}
                    hex={activeColorHex}
                    isSelected={isColorPickerOpen}
                    onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                    compact={true}
                  />

                  {/* Inline Ink Bottle Palette */}
                  {isColorPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center gap-1 bg-[#2e1d11] border border-[#cca162]/40 px-2 py-1 rounded-2xl shadow-xl"
                    >
                      {INK_COLORS.map((c) => (
                        <InkBottle
                          key={c.id}
                          colorId={c.id}
                          colorName={c.name}
                          hex={c.hex}
                          isSelected={currentColor === c.id}
                          onClick={() => handleColorSelect(c.id)}
                          compact={true}
                        />
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
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isFabOpen ? "bg-black/30 backdrop-blur-[1px] rounded-full" : ""
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

  // ── 2. FULL BAR MODE (Default accessible mode) ───────────────────────────
  return (
    <div
      ref={menuRef}
      className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto select-none max-w-[98vw]"
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
        zIndex: 9999,
        touchAction: 'none'
      }}
    >
      {/* Floating Mode Ribbon Badge */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 px-3.5 py-0.5 rounded-full bg-[#1c1108]/95 border border-[#cca162]/60 text-[#fdfcf7] text-[11px] font-serif tracking-widest uppercase shadow-[0_4px_16px_rgba(0,0,0,0.8)] backdrop-blur-md flex items-center gap-2 pointer-events-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#e3bf8c] shadow-[0_0_6px_#cca162]" />
        <span className="text-[#fdfcf7] font-medium">{TOOL_LABELS[currentTool] || "Paint Mode"}</span>
        <span className="text-[#cca162]/50">•</span>
        <span className="text-[#e3bf8c]">{INK_COLORS.find(c => c.id === currentColor)?.name || "Iron Gall"} Ink</span>
      </motion.div>

      <div
        id="medieval-toolbar"
        className="relative flex items-center gap-1 sm:gap-1.5 bg-gradient-to-b from-[#2e1d11] via-[#3a2517] to-[#1a0f08] border-2 border-[#cca162] px-2.5 sm:px-3 py-1.5 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.95),_inset_0_1px_1px_rgba(255,255,255,0.25)] pointer-events-auto"
      >
        {/* Left Filigree End Bracket */}
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#e3bf8c] via-[#cca162] to-[#8c5d35] opacity-70 shrink-0" />

        {/* Drawing & Editing Tools */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {btn("hand",   <Hand className="w-4 h-4" />, "Grab (H)")}
          {btn("draw",   <Feather className="w-4 h-4" />, "Paint (D)")}
          {btn("text",   <Type className="w-4 h-4" />, "Text (T)")}
          {btn("eraser", <Eraser className="w-4 h-4" />, "Erase (E)")}
        </div>

        {divider}

        {/* Ink Bottle Selector with Floating Popover */}
        <div className="relative flex items-center justify-center">
          <InkBottle
            colorId={currentColor}
            colorName={INK_COLORS.find(c => c.id === currentColor)?.name || "Iron Gall"}
            hex={activeColorHex}
            isSelected={isColorPickerOpen}
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
          />

          <AnimatePresence>
            {isColorPickerOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#25170d] border-2 border-[#cca162] p-2 rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.9)] z-50 pointer-events-auto"
              >
                {INK_COLORS.map((c) => (
                  <InkBottle
                    key={c.id}
                    colorId={c.id}
                    colorName={c.name}
                    hex={c.hex}
                    isSelected={currentColor === c.id}
                    onClick={() => handleColorSelect(c.id)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {divider}

        {/* Undo & Redo */}
        <div className="flex items-center bg-[#cca162]/10 border border-[#cca162]/35 rounded-full p-[2px] h-9 shrink-0">
          <button
            onClick={() => editor.undo()}
            disabled={!canUndo}
            aria-label="Undo last stroke (Ctrl+Z)"
            title="Undo last stroke (Ctrl+Z)"
            style={{ width: 34, height: 34 }}
            className="flex items-center justify-center rounded-l-full text-[#ebdcb9]/80 hover:bg-[#cca162]/20 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cca162]"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-[#cca162]/25 self-center" />
          <button
            onClick={() => editor.redo()}
            disabled={!canRedo}
            aria-label="Redo stroke (Ctrl+Y)"
            title="Redo stroke (Ctrl+Y)"
            style={{ width: 34, height: 34 }}
            className="flex items-center justify-center rounded-r-full text-[#ebdcb9]/80 hover:bg-[#cca162]/20 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#cca162]"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {divider}

        {/* Extra Utilities (Date, Full Canvas, Seal Mode) */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={onToggleDate}
            aria-label="Toggle Creation Date"
            title="Toggle Creation Date"
            style={{ minWidth: 36, minHeight: 36 }}
            className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3bf8c] ${
              showDate
                ? "bg-gradient-to-b from-[#9e2419] to-[#420904] text-[#fffbee] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),_0_2px_4px_rgba(0,0,0,0.5)] border border-[#e3bf8c] scale-105"
                : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
          </button>

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Exit Full Canvas" : "Expand Canvas"}
              title={isExpanded ? "Exit Full Canvas" : "Expand canvas to full view"}
              style={{ minWidth: 36, minHeight: 36 }}
              className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3bf8c] ${
                isExpanded
                  ? "bg-[#9e2419] text-[#fffbee] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] border border-[#e3bf8c] scale-105"
                  : "text-[#ebdcb9]/80 hover:bg-[#cca162]/15 hover:text-[#fffbee]"
              }`}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Switch to FAB mode */}
          <button
            onClick={() => setMode("fab")}
            title="Compact Seal Mode"
            aria-label="Switch to Compact Seal Mode"
            style={{ minWidth: 36, minHeight: 36 }}
            className="flex items-center justify-center rounded-full text-[#ebdcb9]/70 hover:bg-[#cca162]/15 hover:text-[#fffbee] transition-all cursor-pointer shrink-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3bf8c]"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Right Filigree End Bracket */}
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#e3bf8c] via-[#cca162] to-[#8c5d35] opacity-70 shrink-0" />
      </div>
    </div>
  );
}

