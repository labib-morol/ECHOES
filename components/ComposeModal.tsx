"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Thought } from "@/lib/types";

interface ComposeModalProps {
  onClose: () => void;
  onPosted: (thought: Thought, key: string) => void;
  onRateLimited?: (message: string) => void;
}

const MAX_LEN = 2000;
const WARM_THRESHOLD = 1700;
const EMBER_THRESHOLD = 1900;
const ACCENT = "#c4bdb0";
const ACCENT_RGB = "168, 156, 138";

type CounterBand = "calm" | "warm" | "ember";

function bandFor(used: number): CounterBand {
  if (used <= WARM_THRESHOLD) return "calm";
  if (used <= EMBER_THRESHOLD) return "warm";
  return "ember";
}

const BAND_COLOR: Record<CounterBand, string> = {
  calm: "#2e2e2e",
  warm: "#6b6052",
  ember: ACCENT,
};

export default function ComposeModal({ onClose, onPosted, onRateLimited }: ComposeModalProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ key: string } | null>(null);

  const used = content.length;
  const remaining = MAX_LEN - used;
  const isTyping = used > 0;
  const band = bandFor(used);
  const canSubmit = !submitting && content.trim().length >= 3 && content.length <= MAX_LEN;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/thoughts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const message = data?.error || "this thought couldn't be released";
        if (res.status === 429 && onRateLimited) {
          onRateLimited(message);
        }
        setError(message);
        setSubmitting(false);
        return;
      }
      const thought: Thought | undefined = data.thought;
      if (thought && data.key) {
        onPosted(thought, data.key);
        setRevealed({ key: data.key });
      } else {
        setError("something went wrong");
      }
    } catch {
      setError("could not reach the wall");
    } finally {
      setSubmitting(false);
    }
  };

  const keyChars = useMemo(() => (revealed?.key ?? "").split(""), [revealed?.key]);
  const revealEndSec = keyChars.length * 0.04 + 0.3;

  return (
    <AnimatePresence>
      <motion.div
        key="compose-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
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
          key="compose-box"
          initial={{ opacity: 0, y: 24, background: "#111009" }}
          animate={{
            opacity: 1,
            y: 0,
            background: isTyping ? "#131108" : "#111009",
          }}
          exit={{ opacity: 0, y: 16 }}
          transition={{
            opacity: { duration: 0.28, ease: "easeOut" },
            y: { duration: 0.28, ease: "easeOut" },
            background: { duration: 0.6, ease: "easeOut" },
          }}
          onClick={(e) => e.stopPropagation()}
          className="compose-box"
          style={{
            width: "100%",
            maxWidth: 420,
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 32,
          }}
        >
          {!revealed ? (
            <form onSubmit={handleSubmit}>
              <h2
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 20,
                  color: "#d4cfc7",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                what&apos;s on your mind
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: "#3a3a3a",
                  lineHeight: 1.6,
                  margin: "8px 0 18px",
                }}
              >
                it disappears in 30 days. no one will ever know it was you.
              </p>

              <textarea
                value={content}
                onChange={(e) => {
                  if (error) setError(null);
                  setContent(e.target.value.slice(0, MAX_LEN));
                }}
                maxLength={MAX_LEN}
                placeholder="say it..."
                disabled={submitting}
                className="compose-textarea"
                style={{
                  width: "100%",
                  minHeight: 140,
                  maxHeight: "40vh",
                  resize: "none",
                  background: "transparent",
                  border: "none",
                  borderBottom:
                    remaining <= 10
                      ? "0.5px solid rgba(196, 104, 122, 0.4)"
                      : "0.5px solid transparent",
                  outline: "none",
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "#c2bdb4",
                  caretColor: ACCENT,
                  lineHeight: 1.7,
                  padding: "4px 0 8px",
                  overflowY: "auto",
                  transition: "border-color 0.2s ease",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <motion.div
                  key={band}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.18, 1] }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  style={{
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: BAND_COLOR[band],
                    letterSpacing: "0.04em",
                    transition: "color 0.4s ease",
                  }}
                >
                  {remaining}
                </motion.div>
              </div>

              {error && (
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 11,
                    color: "#c4687a",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#555",
                    background: "transparent",
                    border: "none",
                    cursor: submitting ? "default" : "pointer",
                    padding: "8px 12px",
                  }}
                >
                  cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  animate={
                    submitting
                      ? {
                          background: [
                            `rgba(${ACCENT_RGB}, 0.10)`,
                            `rgba(${ACCENT_RGB}, 0.32)`,
                            `rgba(${ACCENT_RGB}, 0.10)`,
                          ],
                          borderColor: [
                            `rgba(${ACCENT_RGB}, 0.45)`,
                            `rgba(${ACCENT_RGB}, 0.85)`,
                            `rgba(${ACCENT_RGB}, 0.45)`,
                          ],
                          opacity: 1,
                        }
                      : {
                          background: `rgba(${ACCENT_RGB}, 0.10)`,
                          borderColor: `rgba(${ACCENT_RGB}, 0.45)`,
                          opacity: canSubmit ? 1 : 0.5,
                        }
                  }
                  transition={
                    submitting
                      ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                  style={{
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 400,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: ACCENT,
                    borderRadius: 4,
                    borderWidth: "0.5px",
                    borderStyle: "solid",
                    padding: "8px 16px",
                    cursor: canSubmit ? "pointer" : "default",
                  }}
                >
                  {submitting ? "releasing..." : "release"}
                </motion.button>
              </div>
            </form>
          ) : (
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 22,
                  color: "#d4cfc7",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                released.
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: "#3a3a3a",
                  lineHeight: 1.6,
                  margin: "8px 0 22px",
                }}
              >
                your thought is out there now. it&apos;ll fade in 30 days.
              </p>

              <motion.div
                initial={{
                  boxShadow: `0 0 0 rgba(${ACCENT_RGB}, 0)`,
                }}
                animate={{
                  boxShadow: [
                    `0 0 0 rgba(${ACCENT_RGB}, 0)`,
                    `0 0 24px rgba(${ACCENT_RGB}, 0.30)`,
                    `0 0 12px rgba(${ACCENT_RGB}, 0.10)`,
                  ],
                }}
                transition={{
                  delay: revealEndSec,
                  duration: 2,
                  ease: "easeInOut",
                  times: [0, 0.5, 1],
                }}
                style={{
                  background: `rgba(${ACCENT_RGB}, 0.07)`,
                  border: `0.5px solid rgba(${ACCENT_RGB}, 0.35)`,
                  borderRadius: 8,
                  padding: "16px 20px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 300,
                    fontSize: 9,
                    color: "#555",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  your key
                </div>
                <div
                  aria-label={revealed.key}
                  style={{
                    marginTop: 6,
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 500,
                    fontSize: 18,
                    color: ACCENT,
                    letterSpacing: "0.2em",
                    display: "flex",
                  }}
                >
                  {keyChars.map((ch, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ delay: i * 0.04, duration: 0.32, ease: "easeOut" }}
                      style={{ display: "inline-block", whiteSpace: "pre" }}
                    >
                      {ch}
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              <p
                style={{
                  marginTop: 12,
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  color: "#2a2a2a",
                  lineHeight: 1.6,
                }}
              >
                this key only exists once. it was never stored.
              </p>

              <p
                style={{
                  marginTop: 4,
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  color: "#3a3a3a",
                  lineHeight: 1.6,
                }}
              >
                save this somewhere. enter it on the wall to see your thought highlighted.
              </p>

              <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    fontFamily: "var(--font-syne), sans-serif",
                    fontWeight: 400,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: ACCENT,
                    background: `rgba(${ACCENT_RGB}, 0.10)`,
                    border: `0.5px solid rgba(${ACCENT_RGB}, 0.45)`,
                    borderRadius: 4,
                    padding: "8px 16px",
                    cursor: "pointer",
                  }}
                >
                  go to wall →
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
