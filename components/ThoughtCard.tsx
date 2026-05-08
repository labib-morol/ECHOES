"use client";

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useInView,
  type PanInfo,
  type Variants,
} from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Thought } from "@/lib/types";
import {
  formatRelativeTime,
  getCardWidth,
  getThoughtPreview,
  getThoughtTypography,
  hexToRgba,
} from "@/lib/utils";
import { renderThoughtImage, shareOrDownload } from "@/lib/share";

const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Courier New", monospace';

interface ThoughtCardProps {
  thought: Thought;
  isOwn: boolean;
  isNew: boolean;
  isMatched: boolean;
  expandedId: string | null;
  onExpandChange: (id: string | null) => void;
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

function ThoughtCardComponent({
  thought,
  isOwn,
  isNew,
  isMatched,
  expandedId,
  onExpandChange,
  onFelt,
}: ThoughtCardProps) {
  const expanded = expandedId === thought.id;

  const [felt, setFelt] = useState(false);
  const [emberPulsing, setEmberPulsing] = useState(false);
  const [rippleKey, setRippleKey] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareLabel, setShareLabel] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-40px" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const moodColor = thought.mood_color || "#888888";
  const restingBorder = useMemo(
    () => hexToRgba(moodColor, isOwn ? 0.9 : 0.55),
    [moodColor, isOwn]
  );
  const hoverBorder = useMemo(() => hexToRgba(moodColor, 0.7), [moodColor]);
  const moodTagColor = useMemo(() => hexToRgba(moodColor, 0.35), [moodColor]);
  const moodTint = useMemo(() => hexToRgba(moodColor, 0.04), [moodColor]);
  const feltGlow = useMemo(() => hexToRgba(moodColor, 0.32), [moodColor]);
  const ambientGlow = useMemo(
    () => (thought.opacity_level > 0.8 ? `, 0 0 40px ${hexToRgba(moodColor, 0.06)}` : ""),
    [moodColor, thought.opacity_level]
  );

  const controls = useAnimationControls();
  const cardId = `thought-${thought.id}`;
  const depthTier = getDepthTier(thought.opacity_level);
  const depthScale = isMobile ? 1 : getDepthScale(depthTier);
  const renderRotation = isMobile ? 0 : clampRotation(thought.rotation);

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

  const baseGradient =
    "linear-gradient(160deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.04) 100%)";
  const baseShadow = `inset 0 0 0 0.5px rgba(255,255,255,0.1)${
    isOwn ? `, 0 0 20px ${ACCENT_GLOW}` : ""
  }${ambientGlow}`;
  const hoverShadow = `inset 0 0 0 0.5px rgba(255,255,255,0.16), inset 0 0 12px rgba(255,255,255,0.025), 0 8px 32px rgba(0,0,0,0.4)${
    isOwn ? `, 0 0 20px ${ACCENT_GLOW}` : ""
  }${ambientGlow}`;
  const warmGlow = `inset 0 0 0 0.5px rgba(255,255,255,0.18), 0 0 56px 8px ${feltGlow}, 0 0 24px ${feltGlow}`;
  const cardBg = isOwn
    ? `linear-gradient(${moodTint}, ${moodTint}), ${baseGradient}, rgba(168, 156, 138, 0.10)`
    : `linear-gradient(${moodTint}, ${moodTint}), ${baseGradient}, rgba(255,255,255,0.06)`;

  const preview = useMemo(() => getThoughtPreview(thought.content), [thought.content]);
  const cardWidth = useMemo(() => getCardWidth(preview), [preview]);
  const typography = useMemo(() => getThoughtTypography(preview), [preview]);
  const relTime = useMemo(() => formatRelativeTime(thought.created_at), [thought.created_at]);

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

  const handleFelt = useCallback(
    async (event: React.MouseEvent | React.KeyboardEvent) => {
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
    },
    [felt, thought.id, onFelt, controls, restingBorder, baseShadow, warmGlow, startResting]
  );

  const handleShare = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (sharing) return;
    setSharing(true);
    setShareLabel(null);
    try {
      const blob = await renderThoughtImage({
        id: thought.id,
        content: thought.content,
        mood: thought.mood,
        mood_color: moodColor,
      });
      if (!blob) {
        setShareLabel("couldn't render");
        return;
      }
      const result = await shareOrDownload(blob, `echo-${thought.id.slice(0, 8)}.png`);
      if (result === "shared") setShareLabel("shared ✦");
      else if (result === "downloaded") setShareLabel("saved");
      else if (result === "cancelled") setShareLabel(null);
      else setShareLabel("couldn't share");
    } catch (err) {
      console.error("[echoes:share] failed:", err);
      setShareLabel("couldn't share");
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareLabel(null), 2400);
    }
  };

  const openExpand = useCallback(() => onExpandChange(thought.id), [onExpandChange, thought.id]);
  const closeExpand = useCallback(() => onExpandChange(null), [onExpandChange]);

  const handleBottomSheetDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 500) {
      closeExpand();
    }
  };

  const cardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openExpand();
    }
  };

  const moodTagBlock = (
    <span
      style={{
        fontFamily: "var(--font-syne), sans-serif",
        fontWeight: 300,
        fontSize: 8,
        textTransform: "uppercase",
        letterSpacing: "0.28em",
        color: moodTagColor,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 4 }}>·</span>
      {thought.mood}
    </span>
  );

  const motionWrapperProps = isMobile
    ? {
        initial: { opacity: 0, y: 24 },
        animate: inView ? { opacity: targetOpacity, y: 0 } : { opacity: 0, y: 24 },
        transition: { duration: 0.5, ease: FAST_OUT_EASE },
        exit: {
          opacity: 0,
          y: 12,
          transition: { duration: 0.22, ease: "easeIn" as const },
        },
      }
    : {
        variants: wrapperVariants,
        custom: targetOpacity,
        exit: {
          opacity: 0,
          scale: depthScale * 0.94,
          transition: { duration: 0.22, ease: "easeIn" as const },
        },
      };

  return (
    <>
      <motion.div
        ref={cardRef}
        className="wall-card"
        data-depth={isMobile ? undefined : depthTier}
        tabIndex={0}
        role="button"
        aria-label={`thought tagged ${thought.mood}`}
        onKeyDown={cardKeyDown}
        style={
          isMobile
            ? {
                zIndex: isNew ? 6 : 3,
                width: "100%",
                willChange: "transform, opacity",
              }
            : {
                left: `${thought.position_x}%`,
                top: `${thought.position_y}%`,
                zIndex: isNew ? 6 : 3,
                width: cardWidth,
                willChange: "transform, opacity",
                scale: depthScale,
              }
        }
        whileHover={isMobile ? undefined : { zIndex: 20 }}
        {...motionWrapperProps}
      >
        {!expanded && (
          <motion.div
            layoutId={isMobile ? undefined : cardId}
            className="thought-card-inner"
            onClick={openExpand}
            style={{
              position: "relative",
              padding: typography.padding,
              minHeight: typography.minHeight || undefined,
              borderTop: "0.5px solid rgba(255,255,255,0.06)",
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
            whileHover={
              isMobile
                ? undefined
                : {
                    scale: 1.03,
                    boxShadow: hoverShadow,
                    borderLeftColor: hoverBorder,
                    transition: { duration: 0.2, ease: FAST_OUT_EASE },
                  }
            }
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
                color: "#ede8de",
                textShadow: "0 1px 3px rgba(0,0,0,0.65)",
                lineHeight: typography.lineHeight,
                letterSpacing: "-0.01em",
                textAlign: typography.textAlign,
                textRendering: "optimizeLegibility",
                fontFeatureSettings: '"liga" 1, "kern" 1',
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
              {moodTagBlock}
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
              onClick={(e) => handleFelt(e)}
              aria-label={felt ? "felt" : "mark as felt"}
              className={felt ? "felt-btn" : "felt-btn"}
              data-felt={felt ? "true" : "false"}
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
        {expanded && !isMobile && (
          <motion.div
            key="expand-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={closeExpand}
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
                onClick={closeExpand}
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
                  color: "#ede8de",
                  lineHeight: 1.7,
                  letterSpacing: "-0.01em",
                  textRendering: "optimizeLegibility",
                  fontFeatureSettings: '"liga" 1, "kern" 1',
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
                  letterSpacing: "0.28em",
                  color: hexToRgba(moodColor, 0.5),
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 4 }}>·</span>
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

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  aria-label="share as image"
                  className="share-btn"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "4px 6px",
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: sharing ? "#3a3a36" : "#444",
                    cursor: sharing ? "default" : "pointer",
                    transition: "color 200ms ease",
                  }}
                >
                  {sharing
                    ? "rendering…"
                    : shareLabel
                    ? shareLabel
                    : "share this thought ↗"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {expanded && isMobile && (
          <motion.div
            key="bottom-sheet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeExpand}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(13,11,9,0.85)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <motion.div
              key="bottom-sheet"
              role="dialog"
              aria-label="thought detail"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 280 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={handleBottomSheetDragEnd}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                height: "75vh",
                background: "#141210",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: "10px 20px 24px",
                display: "flex",
                flexDirection: "column",
                borderTop: `0.5px solid rgba(255,255,255,0.08)`,
                boxShadow: `0 -10px 40px rgba(0,0,0,0.4), inset 4px 0 0 -1px ${hexToRgba(
                  moodColor,
                  0.55
                )}`,
                touchAction: "none",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 4,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 2,
                  alignSelf: "center",
                  margin: "4px 0 18px",
                }}
              />

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingBottom: 14,
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontStyle: "italic",
                    fontSize: 18,
                    color: "#ede8de",
                    lineHeight: 1.7,
                    letterSpacing: "-0.01em",
                    fontFeatureSettings: '"liga" 1, "kern" 1',
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
                    letterSpacing: "0.28em",
                    color: hexToRgba(moodColor, 0.5),
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.15)", marginRight: 4 }}>·</span>
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
              </div>

              <div
                style={{
                  paddingTop: 14,
                  borderTop: "0.5px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  aria-label="share as image"
                  className="share-btn"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "8px 4px",
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 11,
                    color: sharing ? "#3a3a36" : "#444",
                    cursor: sharing ? "default" : "pointer",
                    transition: "color 200ms ease",
                  }}
                >
                  {sharing
                    ? "rendering…"
                    : shareLabel
                    ? shareLabel
                    : "share this thought ↗"}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleFelt(e)}
                  aria-label={felt ? "felt" : "mark as felt"}
                  disabled={felt}
                  className={felt ? undefined : "felt-btn"}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: felt
                      ? `radial-gradient(circle, ${hexToRgba(moodColor, 0.22)} 0%, transparent 75%)`
                      : "rgba(255,255,255,0.04)",
                    border: "none",
                    cursor: felt ? "default" : "pointer",
                    color: felt ? ACCENT_BRIGHT : "#4a4540",
                    fontSize: 20,
                    lineHeight: 1,
                    transition: "color 200ms ease, background 200ms ease",
                  }}
                >
                  {felt ? "●" : "○"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const ThoughtCard = memo(ThoughtCardComponent);
export default ThoughtCard;
