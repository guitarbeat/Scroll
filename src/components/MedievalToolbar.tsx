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
  {
    id: "black",
    name: "Iron Gall",
    hex: "#1a1a20",
    liquidTop: "#3e3e4d",
    liquidBottom: "#101015",
    sealHex: "#f1f5f9",
    strokeHex: "#cbd5e1",
    glowHex: "rgba(226, 232, 240, 0.45)",
  },
  {
    id: "red",
    name: "Cinnabar",
    hex: "#b91c1c",
    liquidTop: "#ef4444",
    liquidBottom: "#7f1d1d",
    sealHex: "#fca5a5",
    strokeHex: "#f87171",
    glowHex: "rgba(239, 68, 68, 0.5)",
  },
  {
    id: "blue",
    name: "Lapis",
    hex: "#1d4ed8",
    liquidTop: "#3b82f6",
    liquidBottom: "#1e3a8a",
    sealHex: "#93c5fd",
    strokeHex: "#60a5fa",
    glowHex: "rgba(59, 130, 246, 0.5)",
  },
  {
    id: "green",
    name: "Malachite",
    hex: "#15803d",
    liquidTop: "#22c55e",
    liquidBottom: "#14532d",
    sealHex: "#86efac",
    strokeHex: "#4ade80",
    glowHex: "rgba(34, 197, 94, 0.5)",
  },
  {
    id: "yellow",
    name: "Orpiment",
    hex: "#d97706",
    liquidTop: "#fbbf24",
    liquidBottom: "#78350f",
    sealHex: "#fde047",
    strokeHex: "#facc15",
    glowHex: "rgba(245, 158, 11, 0.5)",
  },
] as const;

interface InkBottleProps {
  colorId: string;
  colorName: string;
  hex: string;
  liquidTop?: string;
  liquidBottom?: string;
  sealHex?: string;
  strokeHex?: string;
  glowHex?: string;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
  showLabel?: boolean;
}

function InkBottle({
  colorId,
  colorName,
  hex,
  liquidTop = hex,
  liquidBottom = hex,
  sealHex = "#f3e5ab",
  strokeHex = "#e3bf8c",
  glowHex = "rgba(227, 191, 140, 0.4)",
  isSelected,
  onClick,
  compact = false,
  showLabel = false,
}: InkBottleProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${colorName} ink bottle`}
      title={`${colorName} Ink`}
      className={`relative group flex flex-col items-center justify-center px-1 py-0.5 transition-all duration-200 cursor-pointer select-none rounded-xl focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3bf8c] ${
        isSelected
          ? "scale-108 -translate-y-0.5 z-20 opacity-100"
          : "hover:scale-105 opacity-90 hover:opacity-100 z-10"
      }`}
    >
      {/* Active Selection Glow Ring & Aura behind bottle */}
      {isSelected && (
        <div 
          className="absolute inset-0 rounded-xl blur-[3px] border-2 border-[#ffe39f] animate-pulse pointer-events-none transition-all duration-300"
          style={{
            backgroundColor: glowHex,
            boxShadow: `0 0 12px ${glowHex}, inset 0 0 6px rgba(255,255,255,0.4)`
          }}
        />
      )}

      {/* SVG Apothecary Ink Bottle with High Visibility Detail */}
      <svg
        width={compact ? "28" : "32"}
        height={compact ? "34" : "38"}
        viewBox="0 0 38 46"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-200 drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]"
      >
        <defs>
          {/* Cork Gradient */}
          <linearGradient id={`corkGrad-${colorId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8c5d35" />
            <stop offset="40%" stopColor="#d4a373" />
            <stop offset="100%" stopColor="#543310" />
          </linearGradient>

          {/* Liquid Gradient */}
          <linearGradient id={`inkLiquid-${colorId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={liquidTop} stopOpacity="0.95" />
            <stop offset="100%" stopColor={liquidBottom} stopOpacity="1" />
          </linearGradient>

          {/* Glass Glint Gradient */}
          <linearGradient id={`glassGleam-${colorId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Wax Seal Gradient */}
          <radialGradient id={`sealGrad-${colorId}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor={strokeHex} />
            <stop offset="70%" stopColor={hex} />
            <stop offset="100%" stopColor="#1a0f08" />
          </radialGradient>
        </defs>

        {/* Shadow beneath bottle */}
        <ellipse cx="19" cy="43.5" rx="14" ry="2.2" fill="#000000" fillOpacity="0.75" />

        {/* Cork Stopper - Lifts up when selected */}
        <g className={`transition-transform duration-300 origin-bottom ${isSelected ? "-translate-y-1.5" : ""}`}>
          <rect x="14" y="2" width="10" height="7" rx="1.5" fill={`url(#corkGrad-${colorId})`} stroke="#3a1e05" strokeWidth="1" />
          <line x1="16" y1="4" x2="16" y2="7" stroke="#3a1e05" strokeWidth="0.7" opacity="0.6" />
          <line x1="21" y1="3.5" x2="21" y2="7.5" stroke="#3a1e05" strokeWidth="0.7" opacity="0.6" />
          {/* Wooden Cork Tie String */}
          <line x1="13.5" y1="7" x2="24.5" y2="7" stroke="#e3bf8c" strokeWidth="0.8" opacity="0.8" />
        </g>

        {/* Bottle Glass Neck/Collar */}
        <ellipse cx="19" cy="9.5" rx="6.5" ry="2" fill="#2d1c10" stroke={isSelected ? "#ffe39f" : "#e3bf8c"} strokeWidth="1.2" />

        {/* Main Glass Bottle Contour */}
        <path
          d="M13 10.5 H25 V13.5 C25 15.5 32 18.5 32 23.5 V38 C32 41.5 29 43.5 25.5 43.5 H12.5 C9 43.5 6 41.5 6 38 V23.5 C6 18.5 13 15.5 13 13.5 Z"
          fill="#1c120a"
          fillOpacity="0.7"
          stroke={isSelected ? "#ffe39f" : "#cca162"}
          strokeWidth={isSelected ? "1.8" : "1.4"}
        />

        {/* Ink Liquid Filling */}
        <path
          d="M8.5 24 C11 22.5 27 22.5 29.5 24 V38 C29.5 40 27.5 41.5 25 41.5 H13 C10.5 41.5 8.5 40 8.5 38 Z"
          fill={`url(#inkLiquid-${colorId})`}
        />

        {/* Surface Liquid Meniscus */}
        <ellipse cx="19" cy="24" rx="10.5" ry="2" fill={liquidTop} opacity="0.95" stroke={strokeHex} strokeWidth="0.8" strokeOpacity="0.8" />

        {/* Curved Glass Highlight Gleam */}
        <path
          d="M9.5 22.5 C9.5 18.5 13 15.5 14.5 14 M8.5 25 V36"
          stroke={`url(#glassGleam-${colorId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Golden Glass Base Trim */}
        <path
          d="M10 41.5 C13 42.8 25 42.8 28 41.5"
          stroke={isSelected ? "#ffe39f" : "#cca162"}
          strokeWidth="1"
          opacity="0.8"
        />
      </svg>

      {/* Optional Under-Bottle Name Tag */}
      {showLabel && (
        <span className={`text-[9px] font-serif tracking-wider transition-colors duration-200 -mt-0.5 whitespace-nowrap ${
          isSelected ? "text-[#ffe39f] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#ebdcb9]/80 group-hover:text-[#fdfcf7]"
        }`}>
          {colorName}
        </span>
      )}
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

                {/* Ink Color Selector & Popover */}
                <div className="relative flex items-center justify-center">
                  {(() => {
                    const activeObj = INK_COLORS.find(c => c.id === currentColor) || INK_COLORS[0];
                    return (
                      <InkBottle
                        colorId={currentColor}
                        colorName={activeObj.name}
                        hex={activeObj.hex}
                        liquidTop={activeObj.liquidTop}
                        liquidBottom={activeObj.liquidBottom}
                        sealHex={activeObj.sealHex}
                        strokeHex={activeObj.strokeHex}
                        glowHex={activeObj.glowHex}
                        isSelected={isColorPickerOpen}
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        compact={true}
                      />
                    );
                  })()}

                  {/* Inline Ink Bottle Palette Popover */}
                  {isColorPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center gap-2 bg-[#2a1a10] border-2 border-[#cca162] px-3 py-2 rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.95)] z-50 pointer-events-auto"
                    >
                      {INK_COLORS.map((c) => (
                        <InkBottle
                          key={c.id}
                          colorId={c.id}
                          colorName={c.name}
                          hex={c.hex}
                          liquidTop={c.liquidTop}
                          liquidBottom={c.liquidBottom}
                          sealHex={c.sealHex}
                          strokeHex={c.strokeHex}
                          glowHex={c.glowHex}
                          isSelected={currentColor === c.id}
                          onClick={() => handleColorSelect(c.id)}
                          compact={true}
                          showLabel={true}
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
      className="fixed left-1/2 -translate-x-1/2 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-3 pointer-events-auto select-none max-w-[98vw]"
      style={{
        bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem)",
        zIndex: 9999,
        touchAction: 'none'
      }}
    >
      {/* Standalone Scribe's Inkstand Tray (Side-by-Side with Main Toolbar) */}
      <motion.div
        initial={{ opacity: 0, x: -12, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="h-[56px] flex items-center gap-1.5 sm:gap-2 px-3 bg-gradient-to-b from-[#2e1d11] via-[#3a2517] to-[#1a0f08] border-2 border-[#cca162] rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.95),_inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md relative z-10 shrink-0"
      >
        {/* Left Decorative Brass Finial */}
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#e3bf8c] via-[#cca162] to-[#784e22] opacity-80 shrink-0" />

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* All 5 Ink Bottles */}
          {INK_COLORS.map((c) => (
            <InkBottle
              key={c.id}
              colorId={c.id}
              colorName={c.name}
              hex={c.hex}
              liquidTop={c.liquidTop}
              liquidBottom={c.liquidBottom}
              sealHex={c.sealHex}
              strokeHex={c.strokeHex}
              glowHex={c.glowHex}
              isSelected={currentColor === c.id}
              onClick={() => handleColorSelect(c.id)}
              showLabel={false}
            />
          ))}
        </div>

        {/* Right Decorative Brass Finial */}
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#e3bf8c] via-[#cca162] to-[#784e22] opacity-80 shrink-0" />
      </motion.div>

      {/* Main Bottom Control Toolbar */}
      <div
        id="medieval-toolbar"
        className="h-[56px] relative flex items-center gap-1 sm:gap-2 bg-gradient-to-b from-[#2e1d11] via-[#3a2517] to-[#1a0f08] border-2 border-[#cca162] px-3 sm:px-3.5 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.95),_inset_0_1px_1px_rgba(255,255,255,0.25)] pointer-events-auto shrink-0"
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

