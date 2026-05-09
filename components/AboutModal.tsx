"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="about-overlay"
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
          key="about-box"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="about-box"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 420,
            background: "#111009",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "32px 32px 28px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              background: "transparent",
              border: "none",
              color: "#555",
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              padding: 6,
            }}
          >
            ×
          </button>

          <h2
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontStyle: "italic",
              fontSize: 18,
              color: "#d4cfc7",
              margin: 0,
              fontWeight: 400,
            }}
          >
            what is this
          </h2>

          <p
            style={{
              marginTop: 14,
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 12,
              color: "#555",
              lineHeight: 1.8,
              whiteSpace: "pre-line",
            }}
          >
            {"echoes is a place to throw your thoughts into the dark.\nno accounts. no names. nothing saved about you.\nyour words float here for 30 days, then disappear.\nwrite what you can’t say out loud."}
          </p>

          <p
            style={{
              marginTop: 18,
              fontFamily: "var(--font-syne), sans-serif",
              fontWeight: 300,
              fontSize: 10,
              color: "#333",
              lineHeight: 1.6,
            }}
          >
            built by one person, for anyone who needed it.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
