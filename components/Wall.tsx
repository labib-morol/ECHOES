"use client";

import { AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { Thought } from "@/lib/types";
import ThoughtCard from "@/components/ThoughtCard";
import FractureLines from "@/components/FractureLines";
import EmberParticles from "@/components/EmberParticles";

interface WallProps {
  thoughts: Thought[];
  ownThoughtIds: string[];
  activeFilter: string;
  onFelt: (id: string) => void;
}

export default function Wall({ thoughts, ownThoughtIds, activeFilter, onFelt }: WallProps) {
  const ownSet = useMemo(() => new Set(ownThoughtIds), [ownThoughtIds]);
  const isAll = activeFilter === "all";

  return (
    <div className="wall">
      <FractureLines />
      <EmberParticles />
      <AnimatePresence mode="popLayout">
        {thoughts.map((thought, index) => (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            isOwn={ownSet.has(thought.id)}
            index={index}
            isMatched={isAll || thought.mood === activeFilter}
            onFelt={onFelt}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
