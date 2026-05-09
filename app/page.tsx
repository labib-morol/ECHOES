"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Wall from "@/components/Wall";
import FilterBar from "@/components/FilterBar";
import ComposeModal from "@/components/ComposeModal";
import AboutModal from "@/components/AboutModal";
import type { Thought } from "@/lib/types";
import { supabase } from "@/lib/supabase";

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
const ONBOARDING_KEY = "echoes:onboarded:v1";

function buildNightLabel(): string | null {
  const d = new Date();
  const h = d.getHours();
  if (h < 22 && h >= 5) return null;
  const m = d.getMinutes().toString().padStart(2, "0");
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `wall active · ${hour12}:${m}${ampm}`;
}

const ALL = "all";
const REFETCH_INTERVAL_MS = 60_000;
const MONO_STACK =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Courier New", monospace';
const FAB_LABEL_KEY = "echoes:fab-label:v1";

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

const MOBILE_SKELETON_COUNT = 3;

function loadThoughts(signal?: AbortSignal): Promise<Thought[]> {
  return fetch("/api/thoughts", { signal })
    .then((r) => r.json())
    .then((data) => (Array.isArray(data) ? (data as Thought[]) : []))
    .catch(() => []);
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
  const [animateWordmark, setAnimateWordmark] = useState<boolean | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [thoughtCount, setThoughtCount] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [nightLabel, setNightLabel] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileKeyOpen, setMobileKeyOpen] = useState(false);
  const [showFabLabel, setShowFabLabel] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const composeOpenRef = useRef(composeOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowFabLabel(false);
      return;
    }
    let timer: number | null = null;
    try {
      if (window.localStorage.getItem(FAB_LABEL_KEY) !== "1") {
        setShowFabLabel(true);
        timer = window.setTimeout(() => {
          setShowFabLabel(false);
          try {
            window.localStorage.setItem(FAB_LABEL_KEY, "1");
          } catch {}
        }, 3200);
      }
    } catch {}
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isMobile]);

  useEffect(() => {
    composeOpenRef.current = composeOpen;
  }, [composeOpen]);

  useEffect(() => {
    let dismissTimer: number | null = null;
    try {
      if (window.localStorage.getItem(ONBOARDING_KEY) !== "1") {
        setShowOnboarding(true);
        dismissTimer = window.setTimeout(() => setShowOnboarding(false), 4200);
      }
    } catch {}
    return () => {
      if (dismissTimer !== null) window.clearTimeout(dismissTimer);
    };
  }, []);

  useEffect(() => {
    if (!showOnboarding) {
      try {
        window.localStorage.setItem(ONBOARDING_KEY, "1");
      } catch {}
    }
  }, [showOnboarding]);

  useEffect(() => {
    setNightLabel(buildNightLabel());
    const id = window.setInterval(() => setNightLabel(buildNightLabel()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dismissOnboarding = useCallback(() => setShowOnboarding(false), []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("echoes-thoughts-arrivals")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "thoughts" },
          (payload) => {
            if (!active) return;
            if (composeOpenRef.current) return;
            const row = payload.new as Record<string, unknown>;
            const incoming: Thought = {
              id: String(row.id),
              content: String(row.content ?? ""),
              mood: String(row.mood ?? "untagged"),
              mood_color: String(row.mood_color ?? "#888888"),
              is_crisis: Boolean(row.is_crisis),
              created_at: String(row.created_at ?? new Date().toISOString()),
              expires_at: String(row.expires_at ?? new Date().toISOString()),
              position_x: Number(row.position_x) || 50,
              position_y: Number(row.position_y) || 50,
              rotation: Number(row.rotation) || 0,
              opacity_level: Number(row.opacity_level) || 0.8,
            };
            setThoughts((prev) =>
              prev.some((p) => p.id === incoming.id) ? prev : [incoming, ...prev]
            );
            setNewIds((prev) => {
              const next = new Set(prev);
              next.add(incoming.id);
              return next;
            });
            window.setTimeout(() => {
              setNewIds((prev) => {
                if (!prev.has(incoming.id)) return prev;
                const next = new Set(prev);
                next.delete(incoming.id);
                return next;
              });
            }, 1800);
          }
        )
        .subscribe();
    } catch (err) {
      console.error("[echoes:realtime] subscribe failed:", err);
    }
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from("thoughts")
          .select("id", { count: "exact", head: true })
          .gt("expires_at", new Date().toISOString());
        if (!cancelled && !error && typeof count === "number") {
          setThoughtCount(count);
        }
      } catch {}
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const isUnlocked = ownThoughtIds.length > 0;

  const visibleThoughts = thoughts;

  const moods = useMemo(() => visibleThoughts.map((t) => t.mood), [visibleThoughts]);

  const matchedCount = useMemo(() => {
    if (activeFilter === ALL) return visibleThoughts.length;
    return visibleThoughts.filter((t) => t.mood === activeFilter).length;
  }, [visibleThoughts, activeFilter]);

  const showFilterEmpty =
    activeFilter !== ALL && matchedCount === 0 && visibleThoughts.length > 0;

  const handleRandomThought = useCallback(() => {
    if (visibleThoughts.length === 0) return;
    const filtered =
      activeFilter === ALL
        ? visibleThoughts
        : visibleThoughts.filter((t) => t.mood === activeFilter);
    const pool = filtered.length > 0 ? filtered : visibleThoughts;
    const random = pool[Math.floor(Math.random() * pool.length)];
    setExpandedId(random.id);
  }, [visibleThoughts, activeFilter]);

  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedId]);

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

  const handleSoundToggle = useCallback(() => {
    showToast("ambient sound — coming soon", "info");
  }, [showToast]);

  useEffect(() => {
    document.title = composeOpen ? TITLE_COMPOSE : TITLE_DEFAULT;
  }, [composeOpen]);

  useEffect(() => {
    return () => {
      document.title = TITLE_DEFAULT;
    };
  }, []);

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

      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onClick={dismissOnboarding}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              background: "#0d0b09",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              cursor: "pointer",
            }}
          >
            <motion.p
              className="onboarding-line"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic",
                fontSize: 18,
                color: "#d4cfc7",
                textAlign: "center",
                maxWidth: 360,
                lineHeight: 1.55,
                margin: 0,
                letterSpacing: "0.005em",
              }}
            >
              this is a place for thoughts that have nowhere else to go.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: isMobile ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isMobile ? -8 : 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              position: "fixed",
              ...(isMobile
                ? { top: "calc(84px + env(safe-area-inset-top, 0px))" }
                : { bottom: 96 }),
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: TOAST_COLOR[toast.type],
              background: "rgba(13,11,9,0.88)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderLeft: `2px solid ${TOAST_COLOR[toast.type]}`,
              borderRadius: 4,
              padding: "8px 16px 8px 14px",
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
          padding: "12px 40px 8px",
          background: isMobile || isScrolled ? "rgba(13,11,9,0.88)" : "transparent",
          backdropFilter: isMobile || isScrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: isMobile || isScrolled ? "blur(12px)" : "none",
          borderBottom:
            isScrolled || isMobile
              ? "0.5px solid rgba(255,255,255,0.04)"
              : "0.5px solid transparent",
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
            alignItems: "center",
            gap: isMobile ? 8 : 16,
            marginBottom: isMobile ? 6 : 10,
            maxHeight: isMobile ? "none" : 60,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic",
                fontSize: isMobile ? 22 : 24,
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

            <div
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontStyle: "italic",
                fontSize: isMobile ? 10 : 11,
                color: "#5a544a",
                letterSpacing: "0.01em",
                lineHeight: 1.2,
              }}
            >
              throw it into the dark · it fades in 30 days
            </div>
          </div>

          <div
            className="top-bar-actions"
            style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
          >
            {isMobile && !mobileKeyOpen && (
              <button
                type="button"
                onClick={() => setMobileKeyOpen(true)}
                aria-label="enter your key"
                title="enter your key"
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 16,
                  color: "#666",
                  background: "transparent",
                  border: "0.5px solid #2a2a2a",
                  borderRadius: 4,
                  padding: "8px 12px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                🗝
              </button>
            )}
            {(!isMobile || mobileKeyOpen) && (
            <form
              onSubmit={handleUnlock}
              className="unlock-form"
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                flexWrap: "nowrap",
                flexShrink: 1,
                minWidth: 0,
              }}
            >
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
                className="key-input"
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
                  minWidth: 0,
                  textTransform: "uppercase",
                }}
              />
              <button
                type="submit"
                className="unlock-btn"
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
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                [ unlock ]
              </button>
              {isUnlocked && (
                <button
                  type="button"
                  onClick={clearKey}
                  aria-label="forget this key"
                  title="forget this key"
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
              {isMobile && mobileKeyOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileKeyOpen(false);
                    if (!isUnlocked) setKeyInput("");
                  }}
                  aria-label="collapse key input"
                  title="collapse"
                  style={{
                    fontFamily: MONO_STACK,
                    fontSize: 10,
                    color: "#555",
                    background: "transparent",
                    border: "0.5px solid #2a2a2a",
                    borderRadius: 4,
                    padding: "8px 10px",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  −
                </button>
              )}
            </form>
            )}
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="release-btn"
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
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              [ + release ]
            </button>
            <button
              type="button"
              onClick={handleSoundToggle}
              aria-label="ambient sound (coming soon)"
              title="ambient sound — coming soon"
              style={{
                fontFamily: "var(--font-syne), sans-serif",
                fontWeight: 300,
                fontSize: 14,
                color: "#333",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 6,
                lineHeight: 1,
              }}
            >
              🔇
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

        <FilterBar
          moods={moods}
          activeFilter={activeFilter}
          onFilter={setActiveFilter}
          onRandom={handleRandomThought}
          randomEnabled={visibleThoughts.length > 0}
        />
      </div>

      <main
        style={{
          minHeight: "100vh",
          padding: isMobile ? "20px 14px 56px" : "40px 40px 80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ position: "relative" }}>
          {loading ? (
            isMobile ? (
              <div className="wall" aria-hidden="true">
                {Array.from({ length: MOBILE_SKELETON_COUNT }).map((_, i) => (
                  <div
                    key={i}
                    className="wall-card skeleton-shimmer"
                    style={{
                      width: "100%",
                      height: 120,
                      borderLeft: "2px solid rgba(255,255,255,0.05)",
                      borderRadius: 12,
                      boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.04)",
                    }}
                  />
                ))}
              </div>
            ) : (
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
            )
          ) : visibleThoughts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 1.0, ease: "easeOut" }}
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
                  color: "#1e1e1c",
                  letterSpacing: "-0.005em",
                }}
              >
                the wall is quiet.
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  color: "#161614",
                  letterSpacing: "0.08em",
                }}
              >
                be the first to break the silence.
              </div>
            </motion.div>
          ) : (
            <Wall
              thoughts={visibleThoughts}
              ownThoughtIds={ownThoughtIds}
              newIds={newIds}
              activeFilter={activeFilter}
              expandedId={expandedId}
              onExpandChange={setExpandedId}
              onFelt={handleFelt}
            />
          )}
          {showFilterEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                pointerEvents: "none",
                padding: 24,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontSize: 20,
                  color: "#1e1e1c",
                  lineHeight: 1,
                }}
              >
                ○
              </div>
              <div
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "#2a2826",
                  letterSpacing: "-0.005em",
                  textAlign: "center",
                }}
              >
                no thoughts here yet
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne), sans-serif",
                  fontWeight: 300,
                  fontSize: 10,
                  color: "#1e1e1c",
                  letterSpacing: "0.08em",
                  textAlign: "center",
                }}
              >
                be the first to release one into this space.
              </div>
            </motion.div>
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
          className="echoes-footer"
          style={{
            marginTop: 80,
            textAlign: "center",
            fontFamily: "var(--font-syne), sans-serif",
            fontWeight: 300,
            fontSize: 9,
            color: "#1e1e1c",
            letterSpacing: "0.08em",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div>thoughts disappear after 30 days  ·  no accounts  ·  no data collected</div>
          {thoughtCount !== null && (
            <div>[{thoughtCount.toLocaleString()} thoughts released]</div>
          )}
          {nightLabel && <div style={{ color: "#2a2826" }}>{nightLabel}</div>}
        </footer>
      </main>

      <AnimatePresence>
        {!composeOpen && !aboutOpen && !showOnboarding && expandedId === null && (
          <motion.div
            key="fab-wrapper"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              position: "fixed",
              right: isMobile ? 20 : 24,
              bottom: isMobile
                ? "calc(28px + env(safe-area-inset-bottom, 0px))"
                : 24,
              zIndex: 35,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <AnimatePresence>
              {showFabLabel && (
                <motion.span
                  key="fab-label"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "#c4bdb0",
                    letterSpacing: "0.01em",
                    background: "rgba(13,11,9,0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  release a thought
                </motion.span>
              )}
            </AnimatePresence>
            <motion.button
              key="fab-release"
              type="button"
              onClick={() => setComposeOpen(true)}
              aria-label="release a thought"
              title="release a thought"
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(196, 122, 58, 0)",
                  "0 0 22px 4px rgba(196, 122, 58, 0.22)",
                  "0 0 0 0 rgba(196, 122, 58, 0)",
                ],
              }}
              transition={{
                boxShadow: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              style={{
                width: isMobile ? 60 : 52,
                height: isMobile ? 60 : 52,
                borderRadius: "50%",
                background: "rgba(196, 122, 58, 0.12)",
                border: "0.5px solid rgba(196, 122, 58, 0.55)",
                color: "#c47a3a",
                fontFamily: "var(--font-syne), sans-serif",
                fontWeight: 300,
                fontSize: isMobile ? 28 : 24,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              +
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
