"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Thought } from "@/lib/types";
import {
  formatRelativeTime,
  getArchiveNumber,
  getCardWidth,
  getThoughtTypography,
  hexToRgba,
} from "@/lib/utils";

const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Courier New", monospace';

interface ThoughtCardProps {
  thought: Thought;
  isOwn: boolean;
  index: number;
  isMatched: boolean;
  onFelt: (id: string) => void;
}

const FELT_KEY_PREFIX = "echoes:felt:";
const FAST_OUT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const FLASH_COLOR = "rgba(212, 200, 180, 0.9)";
const ACCENT_GLOW = "rgba(168, 156, 138, 0.10)";
const ACCENT_BRIGHT = "#c4bdb0";

function ThoughtCardComponent({ thought, isOwn, index, isMatched, onFelt }: ThoughtCardProps) {
  const [felt, setFelt] = useState(false);
  const [emberPulsing, setEmberPulsing] = useState(false);
  const [rippleKey, setRippleKey] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const moodColor = thought.mood_color || "#888888";
  const restingBorder = useMemo(
    () => hexToRgba(moodColor, isOwn ? 0.9 : 0.55),
    [moodColor, isOwn]
  );
  const hoverBorder = useMemo(() => hexToRgba(moodColor, 0.7), [moodColor]);
  const moodTagColor = useMemo(() => hexToRgba(moodColor, 0.6), [moodColor]);
  const ambientGlow = useMemo(
    () => (thought.opacity_level > 0.8 ? `, 0 0 40px ${hexToRgba(moodColor, 0.06)}` : ""),
    [moodColor, thought.opacity_level]
  );

  const controls = useAnimationControls();

  const startResting = useCallback(() => {
    if (isOwn) {
      controls.start({
        borderLeftColor: [
          hexToRgba(moodColor, 0.7),
          hexToRgba(moodColor, 1.0),
          hexToRgba(moodColor, 0.7),
        ],
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      });
    } else {
      controls.start({
        borderLeftColor: restingBorder,
        transition: { duration: 0.2 },
      });
    }
  }, [controls, isOwn, moodColor, restingBorder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(FELT_KEY_PREFIX + thought.id);
    if (stored === "1") setFelt(true);
  }, [thought.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await controls.start({
        y: 0,
        filter: "blur(0px)",
        borderLeftColor: restingBorder,
        transition: { duration: 0.55, delay: index * 0.08, ease: FAST_OUT_EASE },
      });
      if (cancelled) return;
      startResting();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startResting();
  }, [isOwn, moodColor, startResting]);

  const handleFelt = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (felt) return;

    setFelt(true);
    setEmberPulsing(true);
    setRippleKey(Date.now());
    try {
      window.sessionStorage.setItem(FELT_KEY_PREFIX + thought.id, "1");
    } catch {}
    onFelt(thought.id);

    await controls.start({
      borderLeftColor: [restingBorder, FLASH_COLOR, restingBorder],
      transition: { duration: 0.4, ease: "easeOut", times: [0, 0.5, 1] },
    });

    setEmberPulsing(false);
    startResting();
  };

  const baseShadow = `inset 0 0 0 0.5px rgba(255,255,255,0.1)${
    isOwn ? `, 0 0 20px ${ACCENT_GLOW}` : ""
  }${ambientGlow}`;
  const hoverShadow = `inset 0 0 0 0.5px rgba(255,255,255,0.16), inset 0 0 12px rgba(255,255,255,0.025), 0 8px 32px rgba(0,0,0,0.4)${
    isOwn ? `, 0 0 20px ${ACCENT_GLOW}` : ""
  }${ambientGlow}`;
  const cardBg = isOwn ? "rgba(168, 156, 138, 0.10)" : "rgba(255,255,255,0.06)";
  const archiveNumber = useMemo(() => getArchiveNumber(thought.id), [thought.id]);
  const cardWidth = useMemo(() => getCardWidth(thought.content), [thought.content]);
  const typography = useMemo(() => getThoughtTypography(thought.content), [thought.content]);
  const relTime = useMemo(() => formatRelativeTime(thought.created_at), [thought.created_at]);
  const renderRotation = thought.rotation * 1.5;

  const matchedOpacity = thought.opacity_level;
  const dimOpacity = 0.15;

  return (
    <>
      <motion.div
        className="wall-card"
        onClick={() => setExpanded(true)}
        style={{
          left: `${thought.position_x}%`,
          top: `${thought.position_y}%`,
          zIndex: 3,
          width: cardWidth,
          willChange: "transform, opacity",
        }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{
          opacity: isMatched ? matchedOpacity : dimOpacity,
          scale: isMatched ? 1 : 0.97,
        }}
        exit={{
          opacity: 0,
          scale: 0.92,
          transition: { duration: 0.22, ease: "easeIn" },
        }}
        transition={{ duration: 0.5, ease: FAST_OUT_EASE, delay: index * 0.06 }}
        whileHover={{ zIndex: 20 }}
      >
        <motion.div
          className="thought-card-inner"
          style={{
            position: "relative",
            padding: typography.padding,
            minHeight: typography.minHeight || undefined,
            borderLeftStyle: "solid",
            borderLeftWidth: 3,
            background: cardBg,
            borderRadius: 4,
            cursor: "pointer",
            boxShadow: baseShadow,
            rotate: renderRotation,
            display: typography.centerVertically ? "flex" : "block",
            flexDirection: typography.centerVertically ? "column" : undefined,
            justifyContent: typography.centerVertically ? "center" : undefined,
          }}
          initial={{
            y: 18,
            filter: "blur(2px)",
            borderLeftColor: restingBorder,
          }}
          animate={controls}
          whileHover={{
            scale: 1.03,
            boxShadow: hoverShadow,
            borderLeftColor: hoverBorder,
            transition: { duration: 0.2, ease: FAST_OUT_EASE },
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 8,
              left: 12,
              fontFamily: MONO_STACK,
              fontSize: 9,
              letterSpacing: "0.22em",
              color: isOwn ? "#a89c8a" : "#5a564e",
              lineHeight: 1,
            }}
          >
            [{archiveNumber}]
          </span>

          {isOwn && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 7,
                right: 10,
                fontSize: 9,
                lineHeight: 1,
                color: ACCENT_BRIGHT,
                opacity: 0.7,
              }}
            >
              ✦
            </span>
          )}

          <p
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontWeight: typography.fontWeight,
              fontSize: typography.fontSize,
              color: "#ccc8c0",
              lineHeight: 1.65,
              letterSpacing: "-0.01em",
              textRendering: "optimizeLegibility",
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: typography.lineClamp,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 70%, transparent 100%)",
            }}
          >
            {thought.content}
          </p>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              paddingRight: 28,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-syne), sans-serif",
                fontWeight: 300,
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: moodTagColor,
              }}
            >
              {thought.mood}
            </span>
            {relTime && (
              <span
                style={{
                  fontFamily: MONO_STACK,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "#5a5048",
                  marginLeft: "auto",
                }}
              >
                {relTime}
              </span>
            )}
          </div>

          {thought.is_crisis && (
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--font-syne), sans-serif",
                fontWeight: 300,
                fontSize: 10,
                color: "#555",
                lineHeight: 1.5,
              }}
            >
              if you&apos;re struggling, you&apos;re not alone — Kaan Pete Roi: 01779-554391
            </div>
          )}

          <motion.button
            type="button"
            onClick={handleFelt}
            aria-label={felt ? "felt" : "mark as felt"}
            animate={emberPulsing ? { scale: [1, 1.6, 0.9, 1.1, 1] } : { scale: 1 }}
            transition={
              emberPulsing
                ? { duration: 0.5, ease: "easeOut" }
                : { duration: 0.2, ease: "easeOut" }
            }
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              cursor: felt ? "default" : "pointer",
              color: felt ? ACCENT_BRIGHT : "#3a3a3a",
              fontSize: 12,
              lineHeight: 1,
              padding: 0,
              overflow: "visible",
            }}
          >
            <AnimatePresence>
              {rippleKey !== null && (
                <motion.span
                  key={rippleKey}
                  initial={{ scale: 0, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  onAnimationComplete={() => setRippleKey(null)}
                  style={{
                    position: "absolute",
                    width: 24,
                    height: 24,
                    left: "50%",
                    top: "50%",
                    marginLeft: -12,
                    marginTop: -12,
                    borderRadius: "50%",
                    background: "rgba(212, 200, 180, 0.35)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>
            <span style={{ position: "relative", zIndex: 1 }}>{felt ? "●" : "○"}</span>
          </motion.button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(13,11,9,0.92)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 560,
                width: "100%",
                background: "#111009",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderLeft: `2px solid ${hexToRgba(moodColor, 0.7)}`,
                borderRadius: 16,
                padding: 32,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 18,
                  color: "#d4cfc7",
                  lineHeight: 1.7,
                  letterSpacing: "-0.01em",
                  textRendering: "optimizeLegibility",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {thought.content}
              </p>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: moodTagColor,
                }}
              >
                {thought.mood}
              </div>
              {thought.is_crisis && (
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 11,
                    color: "#666",
                    lineHeight: 1.6,
                  }}
                >
                  if you&apos;re struggling, you&apos;re not alone — Kaan Pete Roi: 01779-554391
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const ThoughtCard = memo(ThoughtCardComponent);
export default ThoughtCard;
