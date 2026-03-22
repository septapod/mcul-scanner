"use client";

interface MichiganMapProps {
  className?: string;
  fillColor?: string;
  strokeColor?: string;
  opacity?: number;
  showDots?: boolean;
  glowColor?: string;
  size?: "sm" | "md" | "lg" | "hero";
}

const SIZE_MAP = {
  sm: { width: 20, height: 24 },
  md: { width: 60, height: 72 },
  lg: { width: 160, height: 192 },
  hero: { width: 400, height: 480 },
};

// Major CU metro areas: [x, y, name]
const METRO_DOTS: [number, number, string][] = [
  [74, 95, "Detroit"],
  [44, 85, "Grand Rapids"],
  [60, 90, "Lansing"],
  [68, 93, "Ann Arbor"],
  [70, 85, "Flint"],
  [38, 90, "Kalamazoo"],
  [42, 62, "Traverse City"],
  [32, 28, "Marquette"],
];

// Upper Peninsula path (simplified but recognizable)
const UP_PATH =
  "M10,38 L14,36 L18,33 L22,30 L26,28 L30,26 L34,25 L38,26 L42,28 " +
  "L46,27 L50,26 L54,28 L56,30 L55,32 L52,34 L48,35 L44,36 L40,37 " +
  "L36,38 L32,39 L28,40 L24,41 L20,41 L16,40 L12,39 Z";

// Lower Peninsula path (the mitten)
const LP_PATH =
  "M30,48 L34,46 L38,45 L42,44 L46,46 L50,48 L54,50 L58,52 L62,55 " +
  "L66,58 L70,62 L73,66 L75,70 L76,74 L77,78 L78,82 L78,86 L77,90 " +
  "L75,93 L72,96 L68,98 L64,99 L60,98 L56,96 L52,95 L48,94 L44,93 " +
  "L40,93 L36,94 L32,96 L30,93 L29,89 L28,85 L28,81 L28,77 L27,73 " +
  "L27,69 L27,65 L28,61 L28,57 L29,53 Z";

export function MichiganMap({
  className = "",
  fillColor = "transparent",
  strokeColor = "var(--color-accent)",
  opacity = 1,
  showDots = false,
  glowColor,
  size = "md",
}: MichiganMapProps) {
  const { width, height } = SIZE_MAP[size];

  return (
    <svg
      viewBox="0 0 100 120"
      width={width}
      height={height}
      className={className}
      style={{ opacity }}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Michigan state outline"
      role="img"
    >
      {glowColor && (
        <defs>
          <filter id="mi-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor={glowColor} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      <g filter={glowColor ? "url(#mi-glow)" : undefined}>
        {/* Upper Peninsula */}
        <path
          d={UP_PATH}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Lower Peninsula */}
        <path
          d={LP_PATH}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>

      {/* Metro area dots with staggered pulse */}
      {showDots &&
        METRO_DOTS.map(([cx, cy, name], i) => (
          <g key={name}>
            {/* Pulse ring */}
            <circle
              cx={cx}
              cy={cy}
              r="2.5"
              fill="none"
              stroke={strokeColor}
              strokeWidth="0.5"
              opacity="0"
            >
              <animate
                attributeName="r"
                from="1.5"
                to="4"
                dur="3s"
                begin={`${i * 0.375}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.6"
                to="0"
                dur="3s"
                begin={`${i * 0.375}s`}
                repeatCount="indefinite"
              />
            </circle>
            {/* Dot */}
            <circle
              cx={cx}
              cy={cy}
              r="1.2"
              fill={strokeColor}
              opacity="0.7"
            >
              <animate
                attributeName="opacity"
                values="0.7;1;0.7"
                dur="3s"
                begin={`${i * 0.375}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

      <style>{`
        @keyframes miScanPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
