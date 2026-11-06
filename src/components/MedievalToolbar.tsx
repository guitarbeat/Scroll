import React, { useState, useEffect } from "react";
import {
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
  Editor,
} from "tldraw";
import {
  Feather,
  Eraser,
  Undo2,
  Redo2,
  Type,
  Hand,
  MousePointer,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
} from "lucide-react";

interface MedievalToolbarProps {
  editor: Editor;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const INK_COLORS = [
  {
    id: "black",
    name: "Iron Gall",
    hex: "#1a1a20",
    liquidTop: "#3e3e4d",
    liquidBottom: "#101015",
    strokeHex: "#cbd5e1",
    glowHex: "rgba(226, 232, 240, 0.28)",
  },
  {
    id: "red",
    name: "Cinnabar",
    hex: "#b91c1c",
    liquidTop: "#ef4444",
    liquidBottom: "#7f1d1d",
    strokeHex: "#f87171",
    glowHex: "rgba(239, 68, 68, 0.35)",
  },
  {
    id: "blue",
    name: "Lapis",
    hex: "#1d4ed8",
    liquidTop: "#3b82f6",
    liquidBottom: "#1e3a8a",
    strokeHex: "#60a5fa",
    glowHex: "rgba(59, 130, 246, 0.35)",
  },
  {
    id: "green",
    name: "Malachite",
    hex: "#15803d",
    liquidTop: "#22c55e",
    liquidBottom: "#14532d",
    strokeHex: "#4ade80",
    glowHex: "rgba(34, 197, 94, 0.35)",
  },
  {
    id: "yellow",
    name: "Orpiment",
    hex: "#b45309",
    liquidTop: "#fbbf24",
    liquidBottom: "#78350f",
    strokeHex: "#facc15",
    glowHex: "rgba(245, 158, 11, 0.35)",
  },
] as const;

const NIB_SIZES = [
  { id: "s", label: "Fine", title: "Fine Nib ( [ )", barH: 2 },
  { id: "m", label: "Med", title: "Medium Nib", barH: 3.5 },
  { id: "l", label: "Bold", title: "Bold Nib ( ] )", barH: 5.5 },
] as const;

interface InkBottleProps {
  colorId: string;
  colorName: string;
  hex: string;
  liquidTop?: string;
  liquidBottom?: string;
  strokeHex?: string;
  glowHex?: string;
  isSelected: boolean;
  onClick: () => void;
}

function InkBottle({
  colorId,
  colorName,
  hex,
  liquidTop = hex,
  liquidBottom = hex,
  strokeHex = "#e3bf8c",
  glowHex = "rgba(227, 191, 140, 0.3)",
  isSelected,
  onClick,
}: InkBottleProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Select ${colorName} ink`}
      title={`${colorName} Ink`}
      className={`relative group flex items-center justify-center w-8 h-9 transition-all duration-150 cursor-pointer select-none rounded-[2px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#e3bf8c] active:scale-95 ${
        isSelected
          ? "bg-gradient-to-b from-[#331e0f] to-[#1a0e06] border border-[#e2be82] shadow-[inset_0_1px_0_rgba(255,235,190,0.3),0_2px_6px_rgba(0,0,0,0.8)] z-20"
          : "border border-transparent hover:bg-[#cca162]/12 hover:border-[#cca162]/30 opacity-85 hover:opacity-100 z-10"
      }`}
    >
      {isSelected && (
        <div
          className="absolute inset-0 rounded-[1px] pointer-events-none"
          style={{
            backgroundColor: glowHex,
          }}
        />
      )}

      <svg
        width="23"
        height="29"
        viewBox="0 0 38 46"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-150 drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]"
      >
        <defs>
          <linearGradient id={`corkGrad-${colorId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8c5d35" />
            <stop offset="40%" stopColor="#d4a373" />
            <stop offset="100%" stopColor="#543310" />
          </linearGradient>
          <linearGradient id={`inkLiquid-${colorId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={liquidTop} stopOpacity="0.95" />
            <stop offset="100%" stopColor={liquidBottom} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`glassGleam-${colorId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <ellipse cx="19" cy="43.5" rx="14" ry="2.2" fill="#000000" fillOpacity="0.7" />

        <g
          className={`transition-transform duration-200 origin-bottom ${
            isSelected ? "-translate-y-1.5" : ""
          }`}
        >
          <rect
            x="14"
            y="2"
            width="10"
            height="7"
            rx="1"
            fill={`url(#corkGrad-${colorId})`}
            stroke="#3a1e05"
            strokeWidth="1"
          />
          <line x1="16" y1="4" x2="16" y2="7" stroke="#3a1e05" strokeWidth="0.7" opacity="0.6" />
          <line x1="21" y1="3.5" x2="21" y2="7.5" stroke="#3a1e05" strokeWidth="0.7" opacity="0.6" />
          <line x1="13.5" y1="7" x2="24.5" y2="7" stroke="#e3bf8c" strokeWidth="0.8" opacity="0.8" />
        </g>

        <ellipse
          cx="19"
          cy="9.5"
          rx="6.5"
          ry="2"
          fill="#2d1c10"
          stroke={isSelected ? "#ffe39f" : "#e3bf8c"}
          strokeWidth="1.2"
        />

        <path
          d="M13 10.5 H25 V13.5 C25 15.5 32 18.5 32 23.5 V38 C32 41.5 29 43.5 25.5 43.5 H12.5 C9 43.5 6 41.5 6 38 V23.5 C6 18.5 13 15.5 13 13.5 Z"
          fill="#1c120a"
          fillOpacity="0.75"
          stroke={isSelected ? "#ffe39f" : "#cca162"}
          strokeWidth={isSelected ? "1.8" : "1.4"}
        />

        <path
          d="M8.5 24 C11 22.5 27 22.5 29.5 24 V38 C29.5 40 27.5 41.5 25 41.5 H13 C10.5 41.5 8.5 40 8.5 38 Z"
          fill={`url(#inkLiquid-${colorId})`}
        />

        <ellipse
          cx="19"
          cy="24"
          rx="10.5"
          ry="2"
          fill={liquidTop}
          opacity="0.95"
          stroke={strokeHex}
          strokeWidth="0.8"
          strokeOpacity="0.8"
        />

        <path
          d="M9.5 22.5 C9.5 18.5 13 15.5 14.5 14 M8.5 25 V36"
          stroke={`url(#glassGleam-${colorId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export default function MedievalToolbar({
  editor,
  isExpanded = false,
  onToggleExpand,
}: MedievalToolbarProps) {
  const [currentTool, setCurrentTool] = useState("draw");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [currentColor, setCurrentColor] = useState<string>("black");
  const [currentSize, setCurrentSize] = useState<string>("m");

  useEffect(() => {
    if (!editor) return;

    // Ensure default active tool is draw (Quill) rather than Tldraw's default "select"
    if (editor.getCurrentToolId?.() === "select") {
      try {
        editor.setCurrentTool("draw");
        editor.setStyleForNextShapes(DefaultColorStyle, currentColor as any);
        editor.setStyleForNextShapes(DefaultSizeStyle, currentSize as any);
        editor.setStyleForNextShapes(DefaultFontStyle, "serif");
      } catch (_) {}
    }

    const update = () => {
      const tool = editor.getCurrentToolId?.() ?? "draw";
      setCurrentTool(tool);
      setCanUndo(editor.getCanUndo?.() ?? false);
      setCanRedo(editor.getCanRedo?.() ?? false);
      try {
        setSelectedCount(editor.getSelectedShapeIds().length);
      } catch {
        setSelectedCount(0);
      }

      const styleColor = editor
        .getSharedStyles()
        .getAsKnownValue(DefaultColorStyle);
      if (styleColor) {
        setCurrentColor(styleColor as string);
      }

      const styleSize = editor
        .getSharedStyles()
        .getAsKnownValue(DefaultSizeStyle);
      if (styleSize) {
        setCurrentSize(styleSize as string);
      }
    };
    const cleanup = editor.store.listen(update);
    update();
    return cleanup;
  }, [editor]);

  // Keyboard shortcuts for instant tool, nib weight & ink color access
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
      } else if (key === "v" || key === "s") {
        selectTool("select");
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
      } else if (key === "[") {
        const order = ["s", "m", "l"];
        const idx = Math.max(0, order.indexOf(currentSize) - 1);
        handleSizeSelect(order[idx]);
      } else if (key === "]") {
        const order = ["s", "m", "l"];
        const idx = Math.min(order.length - 1, order.indexOf(currentSize) + 1);
        handleSizeSelect(order[idx]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, currentTool, currentColor, currentSize]);

  if (!editor) return null;

  const selectTool = (toolId: string) => {
    editor.setCurrentTool(toolId);
    setCurrentTool(toolId);

    if (toolId === "draw" || toolId === "text") {
      editor.setStyleForNextShapes(DefaultColorStyle, currentColor as any);
      editor.setStyleForNextShapes(DefaultSizeStyle, currentSize as any);
      editor.setStyleForNextShapes(DefaultFontStyle, "serif");
    }
  };

  const isActive = (toolId: string) => currentTool === toolId;

  const handleColorSelect = (colorId: string) => {
    setCurrentColor(colorId);
    editor.setStyleForNextShapes(DefaultColorStyle, colorId as any);
    editor.setStyleForSelectedShapes(DefaultColorStyle, colorId as any);

    // Dipping into an ink bottle primes the quill to write
    if (currentTool !== "draw" && currentTool !== "text") {
      editor.setCurrentTool("draw");
      setCurrentTool("draw");
    }
  };

  const handleSizeSelect = (sizeId: string) => {
    setCurrentSize(sizeId);
    editor.setStyleForNextShapes(DefaultSizeStyle, sizeId as any);
    editor.setStyleForSelectedShapes(DefaultSizeStyle, sizeId as any);

    // Picking a nib weight primes the quill to write
    if (currentTool !== "draw" && currentTool !== "text") {
      editor.setCurrentTool("draw");
      setCurrentTool("draw");
    }
  };

  const handleDuplicateSelected = () => {
    try {
      const ids = editor.getSelectedShapeIds();
      if (ids.length > 0) {
        editor.duplicateShapes(ids, { x: 24, y: 24 });
      }
    } catch (_) {}
  };

  const handleDeleteSelected = () => {
    try {
      const ids = editor.getSelectedShapeIds();
      if (ids.length > 0) editor.deleteShapes(ids);
    } catch (_) {}
  };

  const toolButton = (
    toolId: string,
    icon: React.ReactNode,
    label: string,
    shortcutTitle: string
  ) => {
    const active = isActive(toolId);
    return (
      <button
        key={toolId}
        onClick={() => selectTool(toolId)}
        aria-label={shortcutTitle}
        title={shortcutTitle}
        className={`h-8 px-2.5 sm:px-3 rounded-[2px] flex items-center gap-1.5 text-xs font-serif tracking-wide transition-all duration-150 shrink-0 cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#e3bf8c] ${
          active
            ? "bg-gradient-to-b from-[#942217] via-[#70160d] to-[#450b05] text-[#fffbee] border border-[#e6c487] shadow-[inset_0_1px_0_rgba(255,240,200,0.4),0_2px_5px_rgba(0,0,0,0.75)]"
            : "bg-gradient-to-b from-[#29180d] to-[#170d06] text-[#ebdcb9]/90 border border-[#b88946]/30 hover:from-[#362011] hover:to-[#1f1209] hover:text-[#fffbee] hover:border-[#d4a862]/60 shadow-[inset_0_1px_0_rgba(255,230,180,0.08)]"
        }`}
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
      </button>
    );
  };

  const brassDivider = (
    <div className="w-[1px] h-7 bg-gradient-to-b from-transparent via-[#c59952]/55 to-transparent shrink-0 mx-0.5 sm:mx-1" />
  );

  return (
    <footer
      id="medieval-toolbar"
      className="fixed left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto select-none w-fit max-w-[98vw]"
      style={{
        bottom: "max(0.65rem, env(safe-area-inset-bottom, 0px) + 0.35rem)",
        touchAction: "none",
      }}
    >
      {/* Compact Carved Walnut & Burnished Brass Inkstand Dock */}
      <div className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-[3px] bg-gradient-to-b from-[#331d0f] via-[#211209] to-[#120904] border border-[#c59952]/80 shadow-[0_14px_32px_rgba(0,0,0,0.92),0_0_0_1px_rgba(20,10,3,0.95),inset_0_1px_0_rgba(255,232,185,0.28),inset_0_-2px_4px_rgba(0,0,0,0.85)]">
        {/* Corner Antique Brass Inlay Rivets */}
        <span className="w-1 h-1 rounded-none bg-[#d8b16c]/70 absolute top-1 left-1 pointer-events-none" />
        <span className="w-1 h-1 rounded-none bg-[#d8b16c]/70 absolute top-1 right-1 pointer-events-none" />
        <span className="w-1 h-1 rounded-none bg-[#8c6428]/70 absolute bottom-1 left-1 pointer-events-none" />
        <span className="w-1 h-1 rounded-none bg-[#8c6428]/70 absolute bottom-1 right-1 pointer-events-none" />

        {/* Compartment 1: Recessed Inkwell Trough */}
        <div className="flex items-center gap-0.5 bg-[#0e0703]/95 border border-[#b88946]/35 rounded-[2px] px-1 py-0.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)] shrink-0">
          {INK_COLORS.map((c) => (
            <InkBottle
              key={c.id}
              colorId={c.id}
              colorName={c.name}
              hex={c.hex}
              liquidTop={c.liquidTop}
              liquidBottom={c.liquidBottom}
              strokeHex={c.strokeHex}
              glowHex={c.glowHex}
              isSelected={currentColor === c.id}
              onClick={() => handleColorSelect(c.id)}
            />
          ))}
        </div>

        {/* Compartment 2: Squared Nib Weight Switcher */}
        <div
          className="hidden sm:flex items-center gap-0.5 bg-[#0e0703]/95 border border-[#b88946]/35 rounded-[2px] p-0.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)] shrink-0"
          title="Quill Nib Size ( [ or ] )"
        >
          {NIB_SIZES.map((nib) => {
            const active = currentSize === nib.id;
            return (
              <button
                key={nib.id}
                onClick={() => handleSizeSelect(nib.id)}
                aria-label={nib.title}
                title={nib.title}
                className={`h-8 px-2 rounded-[2px] flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:scale-95 ${
                  active
                    ? "bg-gradient-to-b from-[#942217] to-[#4a0c06] text-[#fffbee] border border-[#e6c487] shadow-sm"
                    : "text-[#ebdcb9]/75 border border-transparent hover:bg-[#cca162]/15 hover:text-[#fffbee]"
                }`}
              >
                <span className="text-[10px] font-serif leading-none tracking-wider">
                  {nib.label}
                </span>
                <span
                  className="w-3.5 bg-current rounded-none"
                  style={{ height: nib.barH }}
                />
              </button>
            );
          })}
        </div>

        {brassDivider}

        {/* Compartment 3: Tactile Scribe Tool Keys */}
        <div className="flex items-center gap-1 bg-[#0e0703]/90 border border-[#b88946]/35 rounded-[2px] p-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)]">
          {toolButton(
            "draw",
            <Feather className="w-3.5 h-3.5" />,
            "Quill",
            "Quill Draw (D)"
          )}
          {toolButton(
            "text",
            <Type className="w-3.5 h-3.5" />,
            "Note",
            "Write Note (T or Double-Click)"
          )}
          {toolButton(
            "select",
            <MousePointer className="w-3.5 h-3.5" />,
            "Move",
            "Select & Move (V)"
          )}
          {toolButton(
            "hand",
            <Hand className="w-3.5 h-3.5" />,
            "Scroll",
            "Scroll Parchment (H or Hold Space)"
          )}
          {toolButton(
            "eraser",
            <Eraser className="w-3.5 h-3.5" />,
            "Erase",
            "Erase Ink (E)"
          )}
        </div>

        {brassDivider}

        {/* Compartment 4: Selection Actions + Undo/Redo + Full View */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedCount > 0 && (
            <div className="flex items-center gap-0.5 bg-[#0e0703]/95 border border-[#e6c487]/55 rounded-[2px] p-0.5 mr-0.5">
              <button
                onClick={handleDuplicateSelected}
                title="Duplicate selected"
                className="h-8 px-2 rounded-[2px] text-xs font-serif text-[#ebdcb9] hover:bg-[#cca162]/20 hover:text-white flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Copy</span>
              </button>
              <div className="w-[1px] h-4 bg-[#cca162]/30" />
              <button
                onClick={handleDeleteSelected}
                title="Delete selected (Del / Backspace)"
                className="h-8 px-2 rounded-[2px] text-xs font-serif text-[#fca5a5] hover:bg-[#8f2016] hover:text-white flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Delete</span>
              </button>
            </div>
          )}

          {/* Squared Undo / Redo Pair */}
          <div className="flex items-center bg-[#0e0703]/95 border border-[#b88946]/35 rounded-[2px] p-0.5 h-10 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)]">
            <button
              onClick={() => editor.undo()}
              disabled={!canUndo}
              aria-label="Undo last stroke (Ctrl+Z)"
              title="Undo last stroke (Ctrl+Z)"
              className="w-8 h-8 flex items-center justify-center rounded-[2px] text-[#ebdcb9]/85 hover:bg-[#cca162]/20 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-[#cca162]/25 mx-0.5" />
            <button
              onClick={() => editor.redo()}
              disabled={!canRedo}
              aria-label="Redo stroke (Ctrl+Y)"
              title="Redo stroke (Ctrl+Y)"
              className="w-8 h-8 flex items-center justify-center rounded-[2px] text-[#ebdcb9]/85 hover:bg-[#cca162]/20 hover:text-[#fffbee] active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Full View Toggle */}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Exit Full View" : "Full View"}
              title={
                isExpanded
                  ? "Restore scroll rollers"
                  : "Expand parchment to full screen"
              }
              className={`h-10 px-2.5 rounded-[2px] flex items-center gap-1.5 text-xs font-serif transition-all duration-150 shrink-0 cursor-pointer active:scale-95 ${
                isExpanded
                  ? "bg-gradient-to-b from-[#942217] to-[#450b05] text-[#fffbee] border border-[#e6c487]"
                  : "bg-gradient-to-b from-[#29180d] to-[#170d06] text-[#ebdcb9]/90 border border-[#b88946]/40 hover:from-[#362011] hover:to-[#1f1209] hover:text-[#fffbee]"
              }`}
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden xl:inline">
                {isExpanded ? "Scroll" : "Full View"}
              </span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
