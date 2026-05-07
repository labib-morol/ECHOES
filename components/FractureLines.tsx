const CRACK_PATHS: { d: string; opacity?: number; width?: number }[] = [
  { d: "M 6 5 L 11 14 L 8 22 L 13 30 L 10 38 L 14 47 L 11 56 L 15 64 L 12 72", opacity: 0.14, width: 0.7 },
  { d: "M 13 30 L 18 33 L 22 31", opacity: 0.1 },
  { d: "M 88 8 L 84 18 L 87 26 L 82 35 L 85 43 L 81 52 L 84 60", opacity: 0.13, width: 0.7 },
  { d: "M 50 2 L 47 12 L 52 21 L 48 30 L 53 40 L 50 50 L 54 60 L 51 70 L 55 80", opacity: 0.16, width: 0.8 },
  { d: "M 48 30 L 42 33 L 38 31", opacity: 0.1 },
  { d: "M 0 60 L 8 57 L 14 62 L 22 58 L 30 63 L 40 59 L 48 64 L 58 60 L 68 65", opacity: 0.13, width: 0.7 },
  { d: "M 70 38 L 75 47 L 71 55 L 76 64 L 72 73 L 77 82", opacity: 0.12 },
  { d: "M 28 75 L 32 82 L 36 88 L 41 94", opacity: 0.1 },
  { d: "M 60 78 L 65 84 L 62 91 L 67 97", opacity: 0.1 },
  { d: "M 90 32 L 94 42 L 91 50 L 96 60 L 92 70 L 95 80", opacity: 0.12 },
  { d: "M 16 40 L 22 48 L 18 55", opacity: 0.09 },
  { d: "M 55 60 L 60 67 L 56 74", opacity: 0.09 },
  { d: "M 33 8 L 36 16 L 33 24", opacity: 0.09 },
  { d: "M 73 5 L 76 13 L 72 21 L 75 28", opacity: 0.1 },
  { d: "M 8 90 L 14 92 L 11 97", opacity: 0.09 },
  { d: "M 45 88 L 50 92 L 47 96", opacity: 0.09 },
  { d: "M 25 50 L 30 53 L 27 58", opacity: 0.09 },
  { d: "M 80 62 L 86 66 L 83 70 L 88 74", opacity: 0.1 },
];

import { memo } from "react";

function FractureLinesComponent() {
  return (
    <svg
      aria-hidden="true"
      className="fracture-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <g fill="none" strokeLinecap="round">
        {CRACK_PATHS.map((c, i) => (
          <path
            key={i}
            d={c.d}
            stroke={`rgba(180, 172, 160, ${c.opacity ?? 0.1})`}
            strokeWidth={c.width ?? 0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}

const FractureLines = memo(FractureLinesComponent);
export default FractureLines;
