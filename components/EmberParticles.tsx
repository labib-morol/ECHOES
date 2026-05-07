"use client";

import { motion } from "framer-motion";
import { memo, useEffect, useState } from "react";

interface Particle {
  xPercent: number;
  yPercent: number;
  rise: number;
  duration: number;
  delay: number;
  startOpacity: number;
  drift: number[];
}

const MAX_PARTICLES = 10;
const MOBILE_PARTICLES = 5;

function buildParticles(count: number, isMobile: boolean): Particle[] {
  const minDuration = isMobile ? 14 : 8;
  const durationRange = isMobile ? 4 : 6;
  return Array.from({ length: count }, () => {
    const driftAmt = 6 + Math.random() * 9;
    const driftDir = Math.random() > 0.5 ? 1 : -1;
    return {
      xPercent: 10 + Math.random() * 80,
      yPercent: 60 + Math.random() * 35,
      rise: 120 + Math.random() * 80,
      duration: minDuration + Math.random() * durationRange,
      delay: Math.random() * 8,
      startOpacity: 0.25 + Math.random() * 0.15,
      drift: [
        0,
        driftAmt * driftDir,
        -driftAmt * 0.7 * driftDir,
        driftAmt * 0.9 * driftDir,
        -driftAmt * 0.4 * driftDir,
        0,
      ],
    };
  });
}

function EmberParticlesComponent() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const decide = () => {
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;
      setParticles(
        buildParticles(isMobile ? MOBILE_PARTICLES : MAX_PARTICLES, isMobile)
      );
    };
    decide();

    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => decide();
    mql.addEventListener?.("change", onChange);
    return () => {
      mql.removeEventListener?.("change", onChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        overflow: "hidden",
      }}
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          style={{
            position: "absolute",
            left: `${p.xPercent}%`,
            top: `${p.yPercent}%`,
            width: 1.5,
            height: 1.5,
            borderRadius: "50%",
            background: "#b4ada0",
            display: "block",
            willChange: "transform, opacity",
          }}
          initial={{ y: 0, x: 0, opacity: p.startOpacity }}
          animate={{
            y: [0, -p.rise],
            x: p.drift,
            opacity: [p.startOpacity, p.startOpacity * 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

const EmberParticles = memo(EmberParticlesComponent);
export default EmberParticles;
