"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useMemo } from "react";
import type { Thought } from "@/lib/types";
import ThoughtCard from "@/components/ThoughtCard";
import FractureLines from "@/components/FractureLines";
import EmberParticles from "@/components/EmberParticles";

interface WallProps {
  thoughts: Thought[];
  ownThoughtIds: string[];
  newIds: Set<string>;
  activeFilter: string;
  expandedId: string | null;
  onExpandChange: (id: string | null) => void;
  onFelt: (id: string) => void;
}

const MIN_X = 2;
const MAX_X = 78;

function clampX(x: number): number {
  if (Number.isNaN(x)) return MIN_X;
  return Math.min(MAX_X, Math.max(MIN_X, x));
}

const wallVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      opacity: { duration: 0.8, ease: "easeOut" },
      delayChildren: 0.4,
      staggerChildren: 0.12,
    },
  },
};

export default function Wall({
  thoughts,
  ownThoughtIds,
  newIds,
  activeFilter,
  expandedId,
  onExpandChange,
  onFelt,
}: WallProps) {
  const ownSet = useMemo(() => new Set(ownThoughtIds), [ownThoughtIds]);
  const isAll = activeFilter === "all";

  const placedThoughts = useMemo(
    () =>
      thoughts.map((t) =>
        t.position_x === clampX(t.position_x) ? t : { ...t, position_x: clampX(t.position_x) }
      ),
    [thoughts]
  );

  return (
    <motion.div
      className="wall"
      variants={wallVariants}
      initial="hidden"
      animate="visible"
    >
      <FractureLines />
      <EmberParticles />
      <AnimatePresence mode="popLayout">
        {placedThoughts.map((thought) => (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            isOwn={ownSet.has(thought.id)}
            isNew={newIds.has(thought.id)}
            isMatched={isAll || thought.mood === activeFilter}
            expandedId={expandedId}
            onExpandChange={onExpandChange}
            onFelt={onFelt}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
