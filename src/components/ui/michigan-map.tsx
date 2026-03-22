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

// Major CU metro areas: [x, y, name] (coordinates within viewBox 567 78 135 140)
const METRO_DOTS: [number, number, string][] = [
  [690, 200, "Detroit"],
  [630, 182, "Grand Rapids"],
  [655, 188, "Lansing"],
  [678, 198, "Ann Arbor"],
  [670, 178, "Flint"],
  [625, 195, "Kalamazoo"],
  [635, 145, "Traverse City"],
  [595, 108, "Marquette"],
];

// Accurate Michigan SVG path from react-usa-map (MIT license)
// Lower Peninsula + Upper Peninsula + islands combined
const MI_PATH =
  "M644.5,211 l19.1,-1.9 0.2,1.1 9.9,-1.5 12,-1.7 0.1,-0.6 0.2,-1.5 2.1,-3.7 2,-1.7 -0.2,-5.1 1.6,-1.6 1.1,-0.3 0.2,-3.6 1.5,-3 1.1,0.6 0.2,0.6 0.8,0.2 1.9,-1 -0.4,-9.1 -3.2,-8.2 -2.3,-9.1 -2.4,-3.2 -2.6,-1.8 -1.6,1.1 -3.9,1.8 -1.9,5 -2.7,3.7 -1.1,0.6 -1.5,-0.6 c0,0 -2.6,-1.5 -2.4,-2.1 0.2,-0.6 0.5,-5 0.5,-5 l3.4,-1.3 0.8,-3.4 0.6,-2.6 2.4,-1.6 -0.3,-10 -1.6,-2.3 -1.3,-0.8 -0.8,-2.1 0.8,-0.8 1.6,0.3 0.2,-1.6 -2.6,-2.2 -1.3,-2.6 h-2.6 l-4.5,-1.5 -5.5,-3.4 h-2.7 l-0.6,0.6 -1,-0.5 -3.1,-2.3 -2.9,1.8 -2.9,2.3 0.3,3.6 1,0.3 2.1,0.5 0.5,0.8 -2.6,0.8 -2.6,0.3 -1.5,1.8 -0.3,2.1 0.3,1.6 0.3,5.5 -3.6,2.1 -0.6,-0.2 v-4.2 l1.3,-2.4 0.6,-2.4 -0.8,-0.8 -1.9,0.8 -1,4.2 -2.7,1.1 -1.8,1.9 -0.2,1 0.6,0.8 -0.6,2.6 -2.3,0.5 v1.1 l0.8,2.4 -1.1,6.1 -1.6,4 0.6,4.7 0.5,1.1 -0.8,2.4 -0.3,0.8 -0.3,2.7 3.6,6 2.9,6.5 1.5,4.8 -0.8,4.7 -1,6 -2.4,5.2 -0.3,2.7 -3.2,3.1z m-33.3,-72.4 -1.3,-1.1 -1.8,-10.4 -3.7,-1.3 -1.7,-2.3 -12.6,-2.8 -2.8,-1.1 -8.1,-2.2 -7.8,-1 -3.9,-5.3 0.7,-0.5 2.7,-0.8 3.6,-2.3 v-1 l0.6,-0.6 6,-1 2.4,-1.9 4.4,-2.1 0.2,-1.3 1.9,-2.9 1.8,-0.8 1.3,-1.8 2.3,-2.3 4.4,-2.4 4.7,-0.5 1.1,1.1 -0.3,1 -3.7,1 -1.5,3.1 -2.3,0.8 -0.5,2.4 -2.4,3.2 -0.3,2.6 0.8,0.5 1,-1.1 3.6,-2.9 1.3,1.3 h2.3 l3.2,1 1.5,1.1 1.5,3.1 2.7,2.7 3.9,-0.2 1.5,-1 1.6,1.3 1.6,0.5 1.3,-0.8 h1.1 l1.6,-1 4,-3.6 3.4,-1.1 6.6,-0.3 4.5,-1.9 2.6,-1.3 1.5,0.2 v5.7 l0.5,0.3 2.9,0.8 1.9,-0.5 6.1,-1.6 1.1,-1.1 1.5,0.5 v7 l3.2,3.1 1.3,0.6 1.3,1 -1.3,0.3 -0.8,-0.3 -3.7,-0.5 -2.1,0.6 -2.3,-0.2 -3.2,1.5 h-1.8 l-5.8,-1.3 -5.2,0.2 -1.9,2.6 -7,0.6 -2.4,0.8 -1.1,3.1 -1.3,1.1 -0.5,-0.2 -1.5,-1.6 -4.5,2.4 h-0.6 l-1.1,-1.6 -0.8,0.2 -1.9,4.4 -1,4 -3.2,6.9z";

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
      viewBox="567 78 135 140"
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
        <path
          d={MI_PATH}
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
