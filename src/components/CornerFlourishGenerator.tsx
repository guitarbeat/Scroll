import React, { useMemo, useState } from "react";

interface CornerFlourishGeneratorProps {
  /** Only render when the scroll has finished unrolling */
  isFullyUnrolled: boolean;
  year: number;
}

interface IlluminatedMotif {
  variantIndex: number;
  outerFrameH: string;
  outerFrameV: string;
  innerRubricH: string;
  innerRubricV: string;
  medallionOuterD: string;
  medallionInnerD: string;
  medallionCoreD: string;
  acanthusPlumes: {
    spineD: string;
    foliageD: string;
    fill: string;
    stroke: string;
    delay: number;
  }[];
  filigreeCurls: {
    d: string;
    stroke: string;
    strokeWidth: number;
    delay: number;
    duration: number;
  }[];
  pearls: {
    cx: number;
    cy: number;
    r: number;
    fill: string;
    delay: number;
  }[];
  headerWingD: string;
  headerLeafD: string;
}

function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesizes an authentic illuminated manuscript corner ornament:
 * - Interlaced corner medallion boss with gold-leaf & crimson inlay
 * - Double-ruled manuscript border frame (Iron-Gall outer rule + Cinnabar inner rule + corner stations)
 * - Layered Acanthus leaf plumes with gold/crimson illumination fills
 * - Calligraphic counter-volutes and three-berry manuscript clusters (∴)
 */
function buildIlluminatedCorner(seed: number): IlluminatedMotif {
  const rng = createRng(seed);
  const variantIndex = Math.floor(rng() * 3);

  const ox = 22;
  const oy = 22;
  const hReach = 176 + rng() * 18;
  const vReach = 108 + rng() * 14;

  // 1. Crisp double-ruled manuscript border bars with tapered calligraphic finials
  const outerFrameH = `M ${ox + 14} ${oy - 2} L ${ox + hReach - 18} ${oy - 2} Q ${ox + hReach - 4} ${oy - 2} ${ox + hReach} ${oy + 3}`;
  const outerFrameV = `M ${ox - 2} ${oy + 14} L ${ox - 2} ${oy + vReach - 16} Q ${ox - 2} ${oy + vReach - 3} ${ox + 3} ${oy + vReach}`;

  const innerRubricH = `M ${ox + 16} ${oy + 3.5} L ${ox + hReach * 0.78} ${oy + 3.5} Q ${ox + hReach * 0.85} ${oy + 3.5} ${ox + hReach * 0.88} ${oy + 8}`;
  const innerRubricV = `M ${ox + 3.5} ${oy + 16} L ${ox + 3.5} ${oy + vReach * 0.76} Q ${ox + 3.5} ${oy + vReach * 0.84} ${ox + 8} ${oy + vReach * 0.88}`;

  // 2. Corner Illuminated Medallion (3 historical manuscript styles)
  let medallionOuterD = "";
  let medallionInnerD = "";
  if (variantIndex === 0) {
    // Gothic Quatrefoil & Lozenge Knot
    medallionOuterD = [
      `M ${ox} ${oy - 14}`,
      `L ${ox + 14} ${oy}`,
      `L ${ox} ${oy + 14}`,
      `L ${ox - 14} ${oy} Z`,
      `M ${ox - 9} ${oy - 9}`,
      `L ${ox + 9} ${oy - 9}`,
      `L ${ox + 9} ${oy + 9}`,
      `L ${ox - 9} ${oy + 9} Z`,
    ].join(" ");
    medallionInnerD = [
      `M ${ox} ${oy - 8}`,
      `C ${ox + 6} ${oy - 8}, ${ox + 8} ${oy - 6}, ${ox + 8} ${oy}`,
      `C ${ox + 8} ${oy + 6}, ${ox + 6} ${oy + 8}, ${ox} ${oy + 8}`,
      `C ${ox - 6} ${oy + 8}, ${ox - 8} ${oy + 6}, ${ox - 8} ${oy}`,
      `C ${ox - 8} ${oy - 6}, ${ox - 6} ${oy - 8}, ${ox} ${oy - 8} Z`,
    ].join(" ");
  } else if (variantIndex === 1) {
    // Illuminated Octagonal Rosette
    medallionOuterD = [
      `M ${ox - 5} ${oy - 13}`,
      `L ${ox + 5} ${oy - 13}`,
      `L ${ox + 13} ${oy - 5}`,
      `L ${ox + 13} ${oy + 5}`,
      `L ${ox + 5} ${oy + 13}`,
      `L ${ox - 5} ${oy + 13}`,
      `L ${ox - 13} ${oy + 5}`,
      `L ${ox - 13} ${oy - 5} Z`,
    ].join(" ");
    medallionInnerD = `M ${ox} ${oy - 9} L ${ox + 9} ${oy} L ${ox} ${oy + 9} L ${ox - 9} ${oy} Z`;
  } else {
    // Celtic Interlaced Escutcheon
    medallionOuterD = [
      `M ${ox - 12} ${oy - 12}`,
      `Q ${ox} ${oy - 15} ${ox + 12} ${oy - 12}`,
      `Q ${ox + 15} ${oy} ${ox + 12} ${oy + 12}`,
      `Q ${ox} ${oy + 15} ${ox - 12} ${oy + 12}`,
      `Q ${ox - 15} ${oy} ${ox - 12} ${oy - 12} Z`,
    ].join(" ");
    medallionInnerD = `M ${ox - 7} ${oy - 7} L ${ox + 7} ${oy - 7} L ${ox + 7} ${oy + 7} L ${ox - 7} ${oy + 7} Z`;
  }

  const medallionCoreD = `M ${ox} ${oy - 4.2} L ${ox + 4.2} ${oy} L ${ox} ${oy + 4.2} L ${ox - 4.2} ${oy} Z`;

  // 3. Rich Acanthus Leaf Plumes with Gold-Leaf & Cinnabar Illumination
  const diagonalSweep = 42 + rng() * 8;
  const acanthusPlumes = [
    // Primary diagonal corner acanthus leaf sweeping into the vellum corner
    {
      spineD: `M ${ox + 7} ${oy + 7} C ${ox + 20} ${oy + 12}, ${ox + 28} ${oy + 22}, ${ox + diagonalSweep} ${oy + diagonalSweep * 0.82}`,
      foliageD: `M ${ox + 8} ${oy + 8} C ${ox + 24} ${oy + 7}, ${ox + 34} ${oy + 16}, ${ox + diagonalSweep} ${oy + diagonalSweep * 0.82} C ${ox + 26} ${oy + 30}, ${ox + 12} ${oy + 22}, ${ox + 8} ${oy + 8} Z`,
      fill: "rgba(197, 155, 82, 0.28)",
      stroke: "#4a3424",
      delay: 0.45,
    },
    // Upper horizontal acanthus leaf plume
    {
      spineD: `M ${ox + 26} ${oy + 3.5} C ${ox + 48} ${oy + 14}, ${ox + 74} ${oy + 16}, ${ox + 96} ${oy + 7}`,
      foliageD: `M ${ox + 32} ${oy + 4} C ${ox + 52} ${oy + 18}, ${ox + 72} ${oy + 18}, ${ox + 92} ${oy + 8} C ${ox + 74} ${oy + 11}, ${ox + 52} ${oy + 9}, ${ox + 32} ${oy + 4} Z`,
      fill: "rgba(143, 32, 22, 0.18)",
      stroke: "#8f2016",
      delay: 0.62,
    },
    // Side vertical acanthus leaf plume
    {
      spineD: `M ${ox + 3.5} ${oy + 24} C ${ox + 14} ${oy + 42}, ${ox + 15} ${oy + 62}, ${ox + 7} ${oy + 80}`,
      foliageD: `M ${ox + 4} ${oy + 28} C ${ox + 17} ${oy + 44}, ${ox + 16} ${oy + 60}, ${ox + 8} ${oy + 76} C ${ox + 10} ${oy + 58}, ${ox + 9} ${oy + 42}, ${ox + 4} ${oy + 28} Z`,
      fill: "rgba(197, 155, 82, 0.24)",
      stroke: "#4a3424",
      delay: 0.68,
    },
  ];

  // 4. Cohesive Calligraphic Scrollwork & Counter-Volutes along the border rules
  const curlStretch = 1 + (rng() - 0.5) * 0.16;
  const filigreeCurls = [
    // First top scroll volute
    {
      d: `M ${ox + 54} ${oy + 3.5} C ${ox + 64} ${oy + 22 * curlStretch}, ${ox + 86} ${oy + 22 * curlStretch}, ${ox + 84} ${oy + 10} C ${ox + 83} ${oy + 5}, ${ox + 75} ${oy + 7}, ${ox + 77} ${oy + 12}`,
      stroke: "#3a2a18",
      strokeWidth: 1.35,
      delay: 0.72,
      duration: 0.58,
    },
    // Second top scroll volute (rubricated cinnabar)
    {
      d: `M ${ox + 98} ${oy + 3.5} C ${ox + 110} ${oy + 18 * curlStretch}, ${ox + 130} ${oy + 17 * curlStretch}, ${ox + 128} ${oy + 8} C ${ox + 127} ${oy + 5}, ${ox + 121} ${oy + 6}, ${ox + 122} ${oy + 10}`,
      stroke: "#8f2016",
      strokeWidth: 1.15,
      delay: 0.88,
      duration: 0.54,
    },
    // Outer horizontal finial flourish
    {
      d: `M ${ox + 138} ${oy - 2} C ${ox + 152} ${oy - 9}, ${ox + 168} ${oy + 9}, ${ox + hReach + 6} ${oy + 1}`,
      stroke: "#3a2a18",
      strokeWidth: 1.2,
      delay: 1.02,
      duration: 0.48,
    },
    // First vertical margin volute
    {
      d: `M ${ox + 3.5} ${oy + 44} C ${ox + 21 * curlStretch} ${oy + 54}, ${ox + 20 * curlStretch} ${oy + 72}, ${ox + 10} ${oy + 70} C ${ox + 6} ${oy + 69}, ${ox + 7} ${oy + 63}, ${ox + 11} ${oy + 64}`,
      stroke: "#3a2a18",
      strokeWidth: 1.3,
      delay: 0.78,
      duration: 0.56,
    },
    // Lower vertical finial flourish (rubricated)
    {
      d: `M ${ox - 2} ${oy + 76} C ${ox - 8} ${oy + 90}, ${ox + 10} ${oy + 100}, ${ox + 2} ${oy + vReach + 5}`,
      stroke: "#8f2016",
      strokeWidth: 1.1,
      delay: 0.96,
      duration: 0.48,
    },
  ];

  // 5. Illuminated Pearl Clusters & Rubricated Berry Triads (∴)
  const pearls = [
    // Corner boss cardinal gold pearls
    { cx: ox + 17, cy: oy - 6, r: 1.5, fill: "#b88946", delay: 0.48 },
    { cx: ox - 6, cy: oy + 17, r: 1.5, fill: "#b88946", delay: 0.52 },
    // Diagonal tip triad (∴)
    {
      cx: ox + diagonalSweep + 4,
      cy: oy + diagonalSweep * 0.82 + 2,
      r: 1.4,
      fill: "#8f2016",
      delay: 1.05,
    },
    {
      cx: ox + diagonalSweep + 7.5,
      cy: oy + diagonalSweep * 0.82 + 0.5,
      r: 1.15,
      fill: "#8f2016",
      delay: 1.12,
    },
    {
      cx: ox + diagonalSweep + 5,
      cy: oy + diagonalSweep * 0.82 + 5.2,
      r: 1.15,
      fill: "#b88946",
      delay: 1.18,
    },
    // Horizontal border berry triad
    { cx: ox + 94, cy: oy + 14, r: 1.35, fill: "#8f2016", delay: 1.22 },
    { cx: ox + 97.5, cy: oy + 15.5, r: 1.1, fill: "#8f2016", delay: 1.28 },
    { cx: ox + 96, cy: oy + 11.5, r: 1.1, fill: "#b88946", delay: 1.34 },
    // Horizontal & vertical terminal pearls
    { cx: ox + hReach + 10, cy: oy + 1, r: 1.6, fill: "#b88946", delay: 1.42 },
    { cx: ox + 2, cy: oy + vReach + 9, r: 1.6, fill: "#b88946", delay: 1.44 },
  ];

  // 6. Central Header Wing Ornament flanking "Anno Domini"
  const headerWingD =
    "M 68 11 L 22 11 C 13 11, 8 5, 14 4 C 19 3, 21 9, 16 9 M 54 11 C 44 17, 30 17, 22 11";
  const headerLeafD = "M 68 11 L 61 7.5 L 64 11 L 61 14.5 Z";

  return {
    variantIndex,
    outerFrameH,
    outerFrameV,
    innerRubricH,
    innerRubricV,
    medallionOuterD,
    medallionInnerD,
    medallionCoreD,
    acanthusPlumes,
    filigreeCurls,
    pearls,
    headerWingD,
    headerLeafD,
  };
}

export default function CornerFlourishGenerator({
  isFullyUnrolled,
  year,
}: CornerFlourishGeneratorProps) {
  const [seed, setSeed] = useState<number>(() => {
    const now = new Date();
    return (
      now.getFullYear() * 10000 +
      (now.getMonth() + 1) * 100 +
      now.getDate() * 7 +
      137
    );
  });

  const motif = useMemo(() => buildIlluminatedCorner(seed), [seed]);

  // Render ONLY when the scroll is fully unrolled
  if (!isFullyUnrolled) {
    return null;
  }

  const renderIlluminatedCorner = (mirrorX: boolean) => (
    <svg
      key={`${seed}-${mirrorX ? "R" : "L"}`}
      width="220"
      height="145"
      viewBox="0 0 220 145"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${
        mirrorX ? "scale-x-[-1]" : ""
      }`}
      aria-hidden="true"
    >
      {/* 1. Illuminated Corner Medallion Boss (inked first: 0.04s - 0.52s) */}
      <path
        d={motif.medallionOuterD}
        pathLength={1}
        fill="rgba(197, 155, 82, 0.22)"
        stroke="#3a2a18"
        strokeWidth="1.45"
        strokeLinejoin="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.04s", animationDuration: "0.48s" }}
      />
      <path
        d={motif.medallionInnerD}
        pathLength={1}
        fill="rgba(143, 32, 22, 0.16)"
        stroke="#8f2016"
        strokeWidth="1.1"
        strokeLinejoin="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.18s", animationDuration: "0.42s" }}
      />
      <path
        d={motif.medallionCoreD}
        fill="#8f2016"
        className="quill-leaf-bloom"
        style={{ animationDelay: "0.36s", animationDuration: "0.32s" }}
      />

      {/* 2. Primary Iron-Gall Manuscript Border Rules radiating from the corner medallion */}
      <path
        d={motif.outerFrameH}
        pathLength={1}
        stroke="#3a2a18"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.22s", animationDuration: "0.75s" }}
      />
      <path
        d={motif.outerFrameV}
        pathLength={1}
        stroke="#3a2a18"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.26s", animationDuration: "0.68s" }}
      />

      {/* 3. Parallel Rubricated Cinnabar Inner Rules */}
      <path
        d={motif.innerRubricH}
        pathLength={1}
        stroke="#8f2016"
        strokeWidth="1.05"
        strokeLinecap="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.40s", animationDuration: "0.70s" }}
      />
      <path
        d={motif.innerRubricV}
        pathLength={1}
        stroke="#8f2016"
        strokeWidth="1.05"
        strokeLinecap="round"
        className="quill-path-draw"
        style={{ animationDelay: "0.44s", animationDuration: "0.64s" }}
      />

      {/* 4. Illuminated Acanthus Leaf Plumes (gold-leaf & crimson fills + quill spines) */}
      {motif.acanthusPlumes.map((plume, idx) => (
        <g key={`plume-${idx}`}>
          <path
            d={plume.foliageD}
            fill={plume.fill}
            className="quill-leaf-bloom"
            style={{
              animationDelay: `${(plume.delay + 0.18).toFixed(2)}s`,
              animationDuration: "0.42s",
            }}
          />
          <path
            d={plume.spineD}
            pathLength={1}
            stroke={plume.stroke}
            strokeWidth="1.35"
            strokeLinecap="round"
            className="quill-path-draw"
            style={{
              animationDelay: `${plume.delay.toFixed(2)}s`,
              animationDuration: "0.55s",
            }}
          />
        </g>
      ))}

      {/* 5. Calligraphic Counter-Volutes & Filigree Curls */}
      {motif.filigreeCurls.map((curl, idx) => (
        <path
          key={`curl-${idx}`}
          d={curl.d}
          pathLength={1}
          stroke={curl.stroke}
          strokeWidth={curl.strokeWidth}
          strokeLinecap="round"
          className="quill-path-draw"
          style={{
            animationDelay: `${curl.delay.toFixed(2)}s`,
            animationDuration: `${curl.duration.toFixed(2)}s`,
          }}
        />
      ))}

      {/* 6. Gold-Leaf Pearls & Rubricated Berry Clusters (∴) */}
      {motif.pearls.map((p, idx) => (
        <circle
          key={`pearl-${idx}`}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.fill}
          className="quill-pearl-dot"
          style={{
            animationDelay: `${p.delay.toFixed(2)}s`,
            animationDuration: "0.28s",
          }}
        />
      ))}
    </svg>
  );

  return (
    <header className="relative w-full pt-3 pb-2 select-none pointer-events-none z-0">
      {/* Top-Left & Top-Right Illuminated Manuscript Corner Ornaments */}
      <div className="absolute -top-8 -left-7 sm:-left-10 pointer-events-none">
        {renderIlluminatedCorner(false)}
      </div>
      <div className="absolute -top-8 -right-7 sm:-right-10 pointer-events-none">
        {renderIlluminatedCorner(true)}
      </div>

      {/* Illuminated Header Cartouche */}
      <div className="flex flex-col items-center justify-center text-center">
        <div
          key={`header-${seed}`}
          className="flex items-center gap-3 animate-fade-in"
        >
          <svg
            width="72"
            height="22"
            viewBox="0 0 72 22"
            fill="none"
            className="opacity-85"
            aria-hidden="true"
          >
            <path
              d={motif.headerWingD}
              pathLength={1}
              stroke="#8f2016"
              strokeWidth="1.25"
              strokeLinecap="round"
              className="quill-path-draw"
              style={{ animationDelay: "0.32s", animationDuration: "0.68s" }}
            />
            <path
              d={motif.headerLeafD}
              fill="#b88946"
              className="quill-leaf-bloom"
              style={{ animationDelay: "0.55s", animationDuration: "0.3s" }}
            />
            <circle
              cx="6"
              cy="8"
              r="1.6"
              fill="#b88946"
              className="quill-pearl-dot"
              style={{ animationDelay: "0.95s", animationDuration: "0.28s" }}
            />
          </svg>

          <span className="cinzel text-[#3e2918] font-medium text-base sm:text-[19px] tracking-[0.18em] drop-shadow-[0_1px_0_rgba(255,250,235,0.6)]">
            Anno Domini {year}
          </span>

          <svg
            width="72"
            height="22"
            viewBox="0 0 72 22"
            fill="none"
            className="opacity-85 scale-x-[-1]"
            aria-hidden="true"
          >
            <path
              d={motif.headerWingD}
              pathLength={1}
              stroke="#8f2016"
              strokeWidth="1.25"
              strokeLinecap="round"
              className="quill-path-draw"
              style={{ animationDelay: "0.32s", animationDuration: "0.68s" }}
            />
            <path
              d={motif.headerLeafD}
              fill="#b88946"
              className="quill-leaf-bloom"
              style={{ animationDelay: "0.55s", animationDuration: "0.3s" }}
            />
            <circle
              cx="6"
              cy="8"
              r="1.6"
              fill="#b88946"
              className="quill-pearl-dot"
              style={{ animationDelay: "0.95s", animationDuration: "0.28s" }}
            />
          </svg>
        </div>

        {/* Subtle Interactive Illuminated Finial — click to ink a new ornament variation */}
        <button
          type="button"
          onClick={() => setSeed((s) => (s * 1664525 + 1013904223) >>> 0)}
          title="Re-ink manuscript corner ornaments"
          aria-label="Illuminated manuscript ornament"
          className="pointer-events-none mt-1 px-2 py-0.5 flex items-center gap-2 opacity-75 transition-opacity focus:outline-none"
        >
          <span className="w-12 h-[1px] bg-gradient-to-r from-transparent via-[#4a3424]/50 to-[#8f2016]/60" />
          <span className="text-[11px] leading-none text-[#8f2016]">❖</span>
          <span className="w-12 h-[1px] bg-gradient-to-l from-transparent via-[#4a3424]/50 to-[#8f2016]/60" />
        </button>
      </div>
    </header>
  );
}
