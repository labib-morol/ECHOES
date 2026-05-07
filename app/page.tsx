"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Wall from "@/components/Wall";
import FilterBar from "@/components/FilterBar";
import ComposeModal from "@/components/ComposeModal";
import AboutModal from "@/components/AboutModal";
import type { Thought } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type ToastType = "success" | "error" | "info";
const TOAST_COLOR: Record<ToastType, string> = {
  success: "#7aad8c",
  error: "#c4687a",
  info: "#888888",
};
const TITLE_DEFAULT = "echoes — throw it into the dark";
const TITLE_COMPOSE = "echoes — say something";

const WORDMARK = "echoes.";
const TITLE_PLAYED_KEY = "echoes:title-animated";

const ALL = "all";
const REFETCH_INTERVAL_MS = 60_000;
const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Courier New", monospace';

const SKELETON_POSITIONS: { x: number; y: number; rot: number; w: number; h: number }[] = [
  { x: 6, y: 4, rot: -3, w: 220, h: 108 },
  { x: 36, y: 8, rot: 2, w: 240, h: 92 },
  { x: 66, y: 6, rot: -1.5, w: 220, h: 132 },
  { x: 12, y: 36, rot: 3, w: 200, h: 88 },
  { x: 44, y: 40, rot: -2.5, w: 260, h: 120 },
  { x: 74, y: 38, rot: 1.5, w: 220, h: 100 },
  { x: 18, y: 68, rot: -1, w: 240, h: 110 },
  { x: 56, y: 70, rot: 2.5, w: 220, h: 96 },
];

function loadThoughts(signal?: AbortSignal): Promise<Thought[]> {
  return fetch("/api/thoughts", { signal })
    .then((r) => r.json())
    .then((data) => (Array.isArray(data) ? (data as Thought[]) : []))
    .catch(() => []);
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function Home() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [ownThoughtIds, setOwnThoughtIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>(ALL);
  const [composeOpen, setComposeOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [toast, setToast] = useState<{ id: number; message: string; type: ToastType } | null>(null);
  const [loading, setLoading] = useState(true);
  const toastTimerRef = useRef<number | null>(null);
  const [clock, setClock] = useState<string>("");
  const [animateWordmark, setAnimateWordmark] = useState<boolean | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const played = window.sessionStorage.getItem(TITLE_PLAYED_KEY) === "1";
    setAnimateWordmark(!played);
    if (!played) window.sessionStorage.setItem(TITLE_PLAYED_KEY, "1");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    loadThoughts(controller.signal).then((data) => {
      if (cancelled) return;
      setThoughts(data);
      setLoading(false);
    });

    const interval = window.setInterval(async () => {
      const data = await loadThoughts();
      if (cancelled) return;
      setThoughts(data);
    }, REFETCH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const isUnlocked = ownThoughtIds.length > 0;

  const visibleThoughts = useMemo(() => {
    if (!isUnlocked) return thoughts;
    const own = new Set(ownThoughtIds);
    return thoughts.filter((t) => own.has(t.id));
  }, [thoughts, ownThoughtIds, isUnlocked]);

  const moods = useMemo(() => visibleThoughts.map((t) => t.mood), [visibleThoughts]);

  const lastEchoLabel = useMemo(() => {
    const latest = thoughts[0];
    if (!latest) return "—";
    const rel = formatRelativeTime(latest.created_at);
    return rel || "—";
  }, [thoughts]);

  const showToast = useCallback((message: string, type: ToastType) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  const handleFelt = useCallback(
    async (id: string) => {
      try {
        const res = await fetch("/api/felt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ thought_id: id }),
        });
        if (res.ok) {
          showToast("felt ✦", "success");
        }
      } catch {}
    },
    [showToast]
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const performUnlock = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setOwnThoughtIds(data.map((d: { id: string }) => d.id));
        showToast("✦ your thoughts are glowing", "success");
      } else {
        setOwnThoughtIds([]);
        showToast("key not found", "error");
      }
    } catch {
      showToast("could not reach the wall", "error");
    }
  }, [keyInput, showToast]);

  const handleUnlock = (event: React.FormEvent) => {
    event.preventDefault();
    performUnlock();
  };

  const clearKey = useCallback(() => {
    setOwnThoughtIds([]);
    setKeyInput("");
  }, []);

  useEffect(() => {
    if (ownThoughtIds.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearKey();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ownThoughtIds.length, clearKey]);

  const handlePosted = (thought: Thought, key: string) => {
    setThoughts((prev) => [thought, ...prev]);
    setOwnThoughtIds((prev) => (prev.includes(thought.id) ? prev : [...prev, thought.id]));
    setKeyInput(key);
    showToast("your thought is out there", "success");
  };

  const handleComposeRateLimited = useCallback(
    (message: string) => {
      showToast(message || "the wall is resting. try again soon.", "info");
    },
    [showToast]
  );

  useEffect(() => {
    document.title = composeOpen ? TITLE_COMPOSE : TITLE_DEFAULT;
  }, [composeOpen]);

  useEffect(() => {
    return () => {
      document.title = TITLE_DEFAULT;
    };
  }, []);

  const cornerStyle: React.CSSProperties = {
    position: "fixed",
    fontFamily: MONO_STACK,
    fontSize: 9,
    letterSpacing: "0.18em",
    color: "#3a3733",
    pointerEvents: "none",
    zIndex: 35,
    textTransform: "uppercase",
  };

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontStyle: "italic",
            fontSize: "min(38vw, 520px)",
            color: "#1a1612",
            opacity: 0.55,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            userSelect: "none",
          }}
        >
          echoes
        </span>
      </div>

      <span aria-hidden="true" style={{ ...cornerStyle, top: 14, left: 18 }}>
        // sec.A — fragments
      </span>
      <span aria-hidden="true" style={{ ...cornerStyle, top: 14, right: 18 }}>
        {clock || "00:00:00"} · local
      </span>
      <span aria-hidden="true" style={{ ...cornerStyle, bottom: 14, left: 18 }}>
        ECHO_v0.1 · 30d.expiry
      </span>
      <span aria-hidden="true" style={{ ...cornerStyle, bottom: 14, right: 18 }}>
        last release · {lastEchoLabel}
      </span>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              position: "fixed",
              bottom: 48,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 40,
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: TOAST_COLOR[toast.type],
              background: "rgba(13,11,9,0.85)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              padding: "8px 16px",
              letterSpacing: "0.04em",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="sticky-bar"
        style={{
          padding: "32px 40px 12px",
          background: isScrolled ? "rgba(13,11,9,0.85)" : "transparent",
          backdropFilter: isScrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: isScrolled ? "blur(12px)" : "none",
          borderBottom: isScrolled ? "0.5px solid rgba(255,255,255,0.04)" : "0.5px solid transparent",
          transition:
            "background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease",
        }}
      >
        <header
          className="top-bar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                color: "#d4cfc7",
              }}
            >
              <span
                style={{
                  fontFamily: MONO_STACK,
                  fontSize: 10,
                  color: "#5a554c",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                //
              </span>
              <h1
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 44,
                  color: "#e6dfd2",
                  lineHeight: 1,
                  margin: 0,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  display: "inline-flex",
                }}
              >
                {animateWordmark === null
                  ? WORDMARK
                  : WORDMARK.split("").map((ch, i) => (
                      <motion.span
                        key={i}
                        initial={
                          animateWordmark ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          animateWordmark
                            ? { delay: i * 0.06, duration: 0.34, ease: [0.22, 1, 0.36, 1] }
                            : { duration: 0 }
                        }
                        style={{ display: "inline-block" }}
                      >
                        {ch}
                      </motion.span>
                    ))}
              </h1>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: MONO_STACK,
                fontSize: 9,
                color: "#4d4842",
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              <span>anonymous</span>
              <span style={{ color: "#2a2520" }}>—</span>
              <span>ephemeral</span>
              <span style={{ color: "#2a2520" }}>—</span>
              <span>uncensored</span>
            </div>

            <div
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic",
                fontSize: 12,
                color: "#5a544a",
                letterSpacing: "0.01em",
              }}
            >
              throw it into the dark · it fades in 30 days
            </div>
          </div>

          <div
            className="top-bar-actions"
            style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
          >
            <form onSubmit={handleUnlock} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    performUnlock();
                  }
                }}
                placeholder="ECHO-XXXX-XXXX"
                style={{
                  fontFamily: MONO_STACK,
                  fontSize: 11,
                  color: "#bdb8af",
                  background: "transparent",
                  border: "0.5px solid #2a2a2a",
                  borderRadius: 4,
                  padding: "8px 12px",
                  outline: "none",
                  letterSpacing: "0.12em",
                  width: 170,
                  textTransform: "uppercase",
                }}
              />
              <button
                type="submit"
                style={{
                  fontFamily: MONO_STACK,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "#888",
                  background: "transparent",
                  border: "0.5px solid #2a2a2a",
                  borderRadius: 4,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                [ unlock ]
              </button>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={clearKey}
                  aria-label="show all thoughts"
                  title="show all"
                  style={{
                    fontFamily: MONO_STACK,
                    fontSize: 10,
                    color: "#666",
                    background: "transparent",
                    border: "0.5px solid #2a2a2a",
                    borderRadius: 4,
                    padding: "8px 10px",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </form>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              style={{
                fontFamily: MONO_STACK,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "#c4bdb0",
                background: "rgba(168, 156, 138, 0.12)",
                border: "0.5px solid rgba(168, 156, 138, 0.55)",
                borderRadius: 4,
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              [ + release ]
            </button>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              aria-label="about"
              title="what is this"
              style={{
                fontFamily: "var(--font-syne), sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "#333",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 6,
                lineHeight: 1,
              }}
            >
              ?
            </button>
          </div>
        </header>

        <FilterBar moods={moods} activeFilter={activeFilter} onFilter={setActiveFilter} />
      </div>

      <main
        style={{
          minHeight: "100vh",
          padding: "16px 40px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          {loading ? (
            <div className="wall" aria-hidden="true">
              {SKELETON_POSITIONS.map((p, i) => (
                <div
                  key={i}
                  className="wall-card skeleton-shimmer"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: p.w,
                    height: p.h,
                    borderLeft: "2px solid rgba(255,255,255,0.05)",
                    borderRadius: 4,
                    boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.04)",
                    transform: `rotate(${p.rot}deg)`,
                  }}
                />
              ))}
            </div>
          ) : visibleThoughts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: isUnlocked ? 0.2 : 1.5, duration: 1.0, ease: "easeOut" }}
              style={{
                minHeight: "50vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                textAlign: "center",
                padding: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 16,
                  color: isUnlocked ? "#3a3a36" : "#1e1e1c",
                  letterSpacing: "-0.005em",
                }}
              >
                {isUnlocked ? "your thoughts have already faded." : "the wall is quiet."}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  color: isUnlocked ? "#2a2a28" : "#161614",
                  letterSpacing: "0.08em",
                }}
              >
                {isUnlocked
                  ? "release a new one to see it here."
                  : "be the first to break the silence."}
              </div>
            </motion.div>
          ) : (
            <Wall
              thoughts={visibleThoughts}
              ownThoughtIds={ownThoughtIds}
              activeFilter={activeFilter}
              onFelt={handleFelt}
            />
          )}
        </div>

        {composeOpen && (
          <ComposeModal
            onClose={() => setComposeOpen(false)}
            onPosted={handlePosted}
            onRateLimited={handleComposeRateLimited}
          />
        )}

        {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

        <footer
          style={{
            marginTop: 80,
            textAlign: "center",
            fontFamily: "var(--font-syne), sans-serif",
            fontWeight: 300,
            fontSize: 9,
            color: "#1e1e1c",
            letterSpacing: "0.08em",
          }}
        >
          thoughts disappear after 30 days  ·  no accounts  ·  no data collected
        </footer>
      </main>
    </>
  );
}
