"use client";

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  type Variants,
} from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Thought } from "@/lib/types";
import {
  formatRelativeTime,
  getCardWidth,
  getThoughtPreview,
  getThoughtTypography,
  hexToRgba,
} from "@/lib/utils";

const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Courier New", monospace';

interface ThoughtCardProps {
  thought: Thought;
  isOwn: boolean;
  isNew: boolean;
  isMatched: boolean;
  onFelt: (id: string) => void;
}

const FELT_KEY_PREFIX = "echoes:felt:";
const FAST_OUT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const FLASH_COLOR = "rgba(212, 200, 180, 0.9)";
const ACCENT_GLOW = "rgba(168, 156, 138, 0.10)";
const ACCENT_BRIGHT = "#c4bdb0";
const DIM_OPACITY = 0.15;

type DepthTier = "far" | "mid" | "near";

function getDepthTier(opacity: number): DepthTier {
  if (opacity < 0.75) return "far";
  if (opacity < 0.88) return "mid";
  return "near";
}

function getDepthScale(tier: DepthTier): number {
  if (tier === "far") return 0.88;
  if (tier === "mid") return 0.94;
  return 1.0;
}

function clampRotation(rot: number): number {
  if (Number.isNaN(rot)) return 0;
  return Math.max(-3, Math.min(3, rot));
}

function ThoughtCardComponent({ thought, isOwn, isNew, isMatched, onFelt }: ThoughtCardProps) {
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
  const moodTagColor = useMemo(() => hexToRgba(moodColor, 0.45), [moodColor]);
  const moodTint = useMemo(() => hexToRgba(moodColor, 0.04), [moodColor]);
  const feltGlow = useMemo(() => hexToRgba(moodColor, 0.32), [moodColor]);
  const ambientGlow = useMemo(
    () => (thought.opacity_level > 0.8 ? `, 0 0 40px ${hexToRgba(moodColor, 0.06)}` : ""),
    [moodColor, thought.opacity_level]
  );

  const controls = useAnimationControls();
  const cardId = `thought-${thought.id}`;
  const depthTier = getDepthTier(thought.opacity_level);
  const depthScale = getDepthScale(depthTier);

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
      boxShadow: [baseShadow, warmGlow, baseShadow],
      transition: { duration: 0.9, ease: "easeOut", times: [0, 0.35, 1] },
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
  const warmGlow = `inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 0 56px 8px ${feltGlow}, 0 0 24px ${feltGlow}`;
  const cardBg = isOwn
    ? `linear-gradient(${moodTint}, ${moodTint}), rgba(168, 156, 138, 0.10)`
    : `linear-gradient(${moodTint}, ${moodTint}), rgba(255,255,255,0.06)`;
  const preview = useMemo(() => getThoughtPreview(thought.content), [thought.content]);
  const cardWidth = useMemo(() => getCardWidth(preview), [preview]);
  const typography = useMemo(() => getThoughtTypography(preview), [preview]);
  const relTime = useMemo(() => formatRelativeTime(thought.created_at), [thought.created_at]);
  const renderRotation = clampRotation(thought.rotation);

  const targetOpacity = isMatched
    ? Math.max(0.82, thought.opacity_level)
    : DIM_OPACITY;

  const wrapperVariants: Variants = useMemo(
    () => ({
      hidden: {
        opacity: 0,
        y: isNew ? 360 : 20,
      },
      visible: (custom: number) => ({
        opacity: custom,
        y: 0,
        transition: isNew
          ? { type: "spring", stiffness: 80, damping: 14, mass: 0.9 }
          : { duration: 0.6, ease: FAST_OUT_EASE },
      }),
    }),
    [isNew]
  );

  return (
    <>
      <motion.div
        className="wall-card"
        data-depth={depthTier}
        style={{
          left: `${thought.position_x}%`,
          top: `${thought.position_y}%`,
          zIndex: isNew ? 6 : 3,
          width: cardWidth,
          willChange: "transform, opacity",
          scale: depthScale,
        }}
        variants={wrapperVariants}
        custom={targetOpacity}
        exit={{
          opacity: 0,
          scale: depthScale * 0.94,
          transition: { duration: 0.22, ease: "easeIn" },
        }}
        whileHover={{ zIndex: 20 }}
      >
        {!expanded && (
          <motion.div
            layoutId={cardId}
            className="thought-card-inner"
            onClick={() => setExpanded(true)}
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
            initial={{ borderLeftColor: restingBorder }}
            animate={controls}
            whileHover={{
              scale: 1.03,
              boxShadow: hoverShadow,
              borderLeftColor: hoverBorder,
              transition: { duration: 0.2, ease: FAST_OUT_EASE },
            }}
          >
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
                color: "#ece5d6",
                textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                lineHeight: 1.65,
                letterSpacing: "-0.01em",
                textRendering: "optimizeLegibility",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: typography.lineClamp,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                maskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 82%, transparent 100%)",
              }}
            >
              {preview}
            </p>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                paddingRight: 36,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
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
              className={felt ? undefined : "felt-btn"}
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
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: felt
                  ? `radial-gradient(circle, ${hexToRgba(moodColor, 0.18)} 0%, transparent 75%)`
                  : "rgba(255,255,255,0.025)",
                border: "none",
                cursor: felt ? "default" : "pointer",
                color: felt ? ACCENT_BRIGHT : "#4a4540",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                overflow: "visible",
                transition: "color 200ms ease, background 200ms ease",
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
        )}
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expand-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
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
              layoutId={cardId}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                maxWidth: 340,
                width: "100%",
                maxHeight: "78vh",
                overflowY: "auto",
                background: "#111009",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderLeftStyle: "solid",
                borderLeftWidth: 3,
                borderLeftColor: hexToRgba(moodColor, 0.7),
                borderRadius: 12,
                padding: "32px 28px 28px",
                rotate: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="close"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  background: "transparent",
                  border: "none",
                  color: "#444",
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 6,
                }}
              >
                ×
              </button>

              <p
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 17,
                  color: "#ece5d6",
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
                  marginTop: 16,
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
