"use client";

import { useEffect, useState } from "react";

interface DotAnimationProps {
  total: number;
  lost: number;
  animate: boolean;
}

export function DotAnimation({ total, lost, animate }: DotAnimationProps) {
  const [fadingIndices, setFadingIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!animate) {
      setFadingIndices(new Set());
      return;
    }

    // Stagger the fade-out of the "lost" dots
    const timers: ReturnType<typeof setTimeout>[] = [];
    const surviving = total - lost;

    for (let i = 0; i < lost; i++) {
      const timer = setTimeout(() => {
        setFadingIndices((prev) => {
          const next = new Set(prev);
          next.add(surviving + i);
          return next;
        });
      }, 600 + i * 150);
      timers.push(timer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [animate, total, lost]);

  const totalDots = total + lost; // Show starting count (pre-merger)

  return (
    <div className="flex gap-1 flex-wrap justify-center max-w-[700px] mt-9">
      {Array.from({ length: totalDots }, (_, i) => {
        const isFading = fadingIndices.has(i);
        const isLostDot = i >= total;

        return (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-600 ease-out"
            style={{
              backgroundColor: isFading
                ? "var(--color-coral)"
                : "var(--color-accent)",
              opacity: isFading ? 0 : isLostDot ? 0.5 : 0.5,
              transform: isFading ? "scale(0)" : "scale(1)",
            }}
          />
        );
      })}
    </div>
  );
}
