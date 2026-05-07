"use client";

import { motion } from "framer-motion";
import { getMoodColor, hexToRgb, hexToRgba } from "@/lib/utils";

interface FilterBarProps {
  moods: string[];
  activeFilter: string;
  onFilter: (mood: string) => void;
}

const ALL = "all";

export default function FilterBar({ moods, activeFilter, onFilter }: FilterBarProps) {
  const unique = Array.from(new Set(moods.filter(Boolean)));

  const renderPill = (label: string, value: string) => {
    const isActive = activeFilter === value;
    const color = value === ALL ? "#c4bdb0" : getMoodColor(value);
    const rgb = hexToRgb(color);
    const baseStyle: React.CSSProperties = {
      flexShrink: 0,
      fontFamily: "var(--font-syne), sans-serif",
      fontWeight: 300,
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      padding: "6px 14px",
      borderRadius: 20,
      cursor: "pointer",
      transition: "color 0.25s ease, background 0.25s ease, border-color 0.25s ease",
      whiteSpace: "nowrap",
      background: isActive ? hexToRgba(color, 0.15) : "transparent",
      border: isActive
        ? `0.5px solid ${hexToRgba(color, 0.7)}`
        : "0.5px solid #2a2a2a",
      color: isActive ? color : "#444",
    };

    return (
      <motion.button
        key={value}
        type="button"
        className="filter-pill"
        style={baseStyle}
        onClick={() => onFilter(value)}
        animate={
          isActive
            ? {
                boxShadow: [
                  `0 0 0 0 rgba(${rgb}, 0)`,
                  `0 0 8px 1px rgba(${rgb}, 0.2)`,
                  `0 0 0 0 rgba(${rgb}, 0)`,
                ],
              }
            : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
        }
        transition={
          isActive
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        {isActive ? `[ ${label} ]` : label}
      </motion.button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        scrollbarWidth: "none",
        padding: "8px 0",
      }}
    >
      {renderPill("✦ all", ALL)}
      {unique.map((mood) => renderPill(mood, mood))}
    </div>
  );
}
