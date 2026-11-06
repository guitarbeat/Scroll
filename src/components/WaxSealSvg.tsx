import React from "react";

interface WaxSealSvgProps {
  className?: string;
  size?: number | string;
  showCrest?: boolean;
}

/**
 * High-definition vector Crimson & Gold Medieval Signet Wax Seal.
 * Eliminates any reliance on external or corrupted binary PNG files while
 * rendering razor-sharp at any DPI and inside 3D shatter fragments.
 */
export default function WaxSealSvg({
  className = "",
  size = "100%",
  showCrest = true,
}: WaxSealSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
    >
      <defs>
        {/* Outer organic wax rim radial gradient */}
        <radialGradient id="waxRimGrad" cx="36%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#df3b2e" />
          <stop offset="32%" stopColor="#b31f16" />
          <stop offset="72%" stopColor="#7c110b" />
          <stop offset="100%" stopColor="#3e0603" />
        </radialGradient>

        {/* Raised inner pillow bevel */}
        <linearGradient id="waxBevelGrad" x1="15%" y1="12%" x2="85%" y2="88%">
          <stop offset="0%" stopColor="#ef5344" />
          <stop offset="45%" stopColor="#9c1911" />
          <stop offset="100%" stopColor="#380503" />
        </linearGradient>

        {/* Recessed signet stamp well */}
        <radialGradient id="waxWellGrad" cx="55%" cy="58%" r="58%">
          <stop offset="0%" stopColor="#8f160f" />
          <stop offset="65%" stopColor="#690e09" />
          <stop offset="100%" stopColor="#420604" />
        </radialGradient>

        {/* Embossed center relief gradient */}
        <linearGradient id="waxReliefGrad" x1="25%" y1="20%" x2="78%" y2="82%">
          <stop offset="0%" stopColor="#f79c8e" />
          <stop offset="35%" stopColor="#d9382a" />
          <stop offset="80%" stopColor="#8a140d" />
          <stop offset="100%" stopColor="#4e0804" />
        </linearGradient>

        {/* Gold leaf dust glint */}
        <linearGradient id="goldGlint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe7b3" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#cca162" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7a4f1d" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Outer irregular melted wax blob */}
      <path
        d="M120 10
           C143 9, 162 18, 179 26
           C197 35, 214 48, 222 68
           C230 88, 229 110, 228 131
           C227 153, 223 176, 208 193
           C193 210, 171 221, 149 226
           C127 231, 105 229, 83 224
           C61 219, 39 209, 26 190
           C13 171, 11 146, 11 123
           C11 100, 14 76, 26 57
           C38 38, 59 25, 79 17
           C94 11, 106 11, 120 10 Z"
        fill="url(#waxRimGrad)"
        stroke="#2b0301"
        strokeWidth="2.5"
      />

      {/* Organic secondary wax swell ridge */}
      <path
        d="M120 20
           C148 19, 176 31, 194 52
           C212 73, 218 102, 215 130
           C212 158, 199 186, 176 202
           C153 218, 122 221, 94 215
           C66 209, 40 193, 28 167
           C16 141, 19 109, 30 82
           C41 55, 65 33, 93 24
           C102 21, 111 20, 120 20 Z"
        fill="url(#waxBevelGrad)"
        opacity="0.88"
      />

      {/* Specular glossy highlight along top-left wax lip */}
      <path
        d="M52 54 C72 34, 102 25, 134 27 C154 28, 172 36, 185 48"
        stroke="#ffbab0"
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.42"
      />
      <path
        d="M34 94 C30 118, 33 142, 45 162"
        stroke="#ff9e91"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />

      {/* Deep pressed signet well */}
      <circle
        cx="120"
        cy="120"
        r="76"
        fill="url(#waxWellGrad)"
        stroke="#3b0503"
        strokeWidth="4"
      />

      {/* Inner beveled gold-tinted signet ring */}
      <circle
        cx="120"
        cy="120"
        r="70"
        fill="none"
        stroke="url(#goldGlint)"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <circle
        cx="120"
        cy="120"
        r="64"
        fill="none"
        stroke="#e04839"
        strokeWidth="1.5"
        opacity="0.65"
      />

      {/* Subtle 8-point medieval compass rosette in the well */}
      <g opacity="0.35" stroke="url(#goldGlint)" strokeWidth="1.2">
        <line x1="120" y1="58" x2="120" y2="182" />
        <line x1="58" y1="120" x2="182" y2="120" />
        <line x1="76" y1="76" x2="164" y2="164" />
        <line x1="164" y1="76" x2="76" y2="164" />
      </g>

      {/* Four cardinal fleur studs */}
      <circle cx="120" cy="60" r="2.5" fill="#f5b895" opacity="0.7" />
      <circle cx="120" cy="180" r="2.5" fill="#f5b895" opacity="0.7" />
      <circle cx="60" cy="120" r="2.5" fill="#f5b895" opacity="0.7" />
      <circle cx="180" cy="120" r="2.5" fill="#f5b895" opacity="0.7" />

      {/* Embossed Blackletter / Medieval Crest */}
      {showCrest && (
        <g>
          {/* Drop shadow of embossed crest */}
          <text
            x="122"
            y="145"
            textAnchor="middle"
            className="blackletter"
            fill="#2b0301"
            fontSize="82"
            opacity="0.85"
          >
            E
          </text>
          {/* Main raised wax crest */}
          <text
            x="120"
            y="143"
            textAnchor="middle"
            className="blackletter"
            fill="url(#waxReliefGrad)"
            stroke="url(#goldGlint)"
            strokeWidth="1"
            fontSize="82"
          >
            E
          </text>
        </g>
      )}
    </svg>
  );
}
