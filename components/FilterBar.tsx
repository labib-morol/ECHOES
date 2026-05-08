"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMoodColor, hexToRgb, hexToRgba } from "@/lib/utils";

interface FilterBarProps {
  moods: string[];
  activeFilter: string;
  onFilter: (mood: string) => void;
  onRandom?: () => void;
  randomEnabled?: boolean;
}

const ALL = "all";
const RANDOM = "__random__";
const ALL_ACTIVE_COLOR = "#c47a3a";
const RANDOM_COLOR = "#c47a3a";

export default function FilterBar({
  moods,
  activeFilter,
  onFilter,
  onRandom,
  randomEnabled,
}: FilterBarProps) {
  const unique = useMemo(() => Array.from(new Set(moods.filter(Boolean))), [moods]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [viewportW, setViewportW] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mq.matches);
      setViewportW(window.innerWidth);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  const q = query.trim().toLowerCase();
  const filteredMoods = useMemo(
    () => (q ? unique.filter((m) => m.toLowerCase().includes(q)) : unique),
    [unique, q]
  );

  const renderPill = (label: string, value: string, isFilterable: boolean) => {
    const isActive = activeFilter === value;
    const color = value === ALL ? (isActive ? ALL_ACTIVE_COLOR : "#c4bdb0") : getMoodColor(value);
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
      overflow: "hidden",
    };

    return (
      <motion.button
        key={value}
        type="button"
        className="filter-pill"
        style={baseStyle}
        onClick={() => onFilter(value)}
        layout={isFilterable}
        initial={isFilterable ? { opacity: 0, scale: 0.85 } : false}
        exit={
          isFilterable
            ? {
                opacity: 0,
                scale: 0.85,
                marginLeft: -4,
                marginRight: -4,
                transition: { duration: 0.22, ease: "easeIn" },
              }
            : undefined
        }
        animate={{
          opacity: 1,
          scale: 1,
          boxShadow: isActive
            ? `0 0 12px 2px rgba(${rgb}, 0.25), 0 0 0 0.5px rgba(${rgb}, 0.5)`
            : "0 0 0 0 rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {isActive ? `[ ${label} ]` : label}
      </motion.button>
    );
  };

  const renderRandomPill = () => {
    if (!onRandom) return null;
    const disabled = randomEnabled === false;
    const rgb = hexToRgb(RANDOM_COLOR);
    return (
      <motion.button
        key={RANDOM}
        type="button"
        className="filter-pill"
        layout
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: disabled ? 0.4 : 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        whileHover={
          disabled
            ? undefined
            : {
                background: `rgba(${rgb}, 0.12)`,
                borderColor: `rgba(${rgb}, 0.5)`,
                color: RANDOM_COLOR,
              }
        }
        onClick={() => {
          if (disabled) return;
          onRandom();
        }}
        aria-label="show a random thought"
        style={{
          flexShrink: 0,
          fontFamily: "var(--font-syne), sans-serif",
          fontWeight: 300,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          padding: "6px 14px",
          borderRadius: 20,
          cursor: disabled ? "default" : "pointer",
          whiteSpace: "nowrap",
          background: `rgba(${rgb}, 0.06)`,
          border: `0.5px solid rgba(${rgb}, 0.3)`,
          color: `rgba(${rgb}, 0.85)`,
          transition: "color 0.25s ease, background 0.25s ease, border-color 0.25s ease",
        }}
      >
        ✦ random
      </motion.button>
    );
  };

  const showPills = !(isMobile && searchOpen);
  const showNoMatches =
    searchOpen && !isMobile && q.length > 0 && filteredMoods.length === 0;

  const mobileInputWidth = Math.max(80, viewportW - 110);
  const desktopInputBoxWidth = 200;

  const searchInputBoxStyle: React.CSSProperties = {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px 4px 12px",
    borderRadius: 20,
    border: "0.5px solid #2a2a2a",
    background: "rgba(255,255,255,0.02)",
  };

  const desktopSearchPillStyle: React.CSSProperties = {
    flexShrink: 0,
    fontFamily: "var(--font-syne), sans-serif",
    fontWeight: 300,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "6px 14px",
    borderRadius: 20,
    cursor: "pointer",
    background: "transparent",
    border: "0.5px solid #2a2a2a",
    color: "#666",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const mobileSearchIconStyle: React.CSSProperties = {
    flexShrink: 0,
    height: 34,
    width: 34,
    minWidth: 34,
    borderRadius: "50%",
    border: "0.5px solid #2a2a2a",
    background: "rgba(255,255,255,0.02)",
    color: "#666",
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  };

  if (isMobile && searchOpen) {
    return (
      <div
        className="filter-bar-mobile-search"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 0",
        }}
      >
        <motion.div
          key="search-input-mobile"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            ...searchInputBoxStyle,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 11, lineHeight: 1, color: "#666" }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search moods..."
            className="filter-search"
            style={{
              flex: 1,
              minWidth: 0,
              width: mobileInputWidth,
              background: "transparent",
              border: "none",
              color: "#c8c4bc",
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 11,
              caretColor: "#c47a3a",
              outline: "none",
              borderRadius: 0,
              padding: "2px 0",
            }}
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="close search"
            style={{
              flexShrink: 0,
              background: "transparent",
              border: "none",
              color: "#444",
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            ×
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={isMobile ? "filter-bar-mobile" : undefined}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        overflow: "hidden",
        padding: "8px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          overflowX: "auto",
          scrollbarWidth: "none",
          flex: 1,
          minWidth: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <AnimatePresence initial={false}>
          {!isMobile && !searchOpen && (
            <motion.button
              key="search-pill"
              type="button"
              className="filter-pill"
              onClick={() => setSearchOpen(true)}
              aria-label="search moods"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={desktopSearchPillStyle}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>🔍</span>
              <span>search moods</span>
            </motion.button>
          )}
          {!isMobile && searchOpen && (
            <motion.div
              key="search-input-desktop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                ...searchInputBoxStyle,
                width: desktopInputBoxWidth,
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1, color: "#666" }}>🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search moods..."
                className="filter-search"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: 140,
                  background: "transparent",
                  border: "none",
                  color: "#c8c4bc",
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  caretColor: "#c47a3a",
                  outline: "none",
                  borderRadius: 0,
                  padding: "2px 0",
                }}
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="close search"
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  color: "#444",
                  fontSize: 13,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {showPills && renderPill("✦ all", ALL, false)}
        {showPills && (
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredMoods.map((mood) => renderPill(mood, mood, true))}
          </AnimatePresence>
        )}
        {showPills && renderRandomPill()}
        {showNoMatches && (
          <span
            style={{
              flexShrink: 0,
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 10,
              color: "#2a2a2a",
              paddingLeft: 4,
            }}
          >
            no moods yet
          </span>
        )}
      </div>

      {isMobile && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="search moods"
          style={mobileSearchIconStyle}
        >
          🔍
        </button>
      )}
    </div>
  );
}
