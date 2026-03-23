"use client";

import { type ReactNode } from "react";

interface BeatProps {
  active: boolean;
  children: ReactNode;
  className?: string;
  citation?: string;
}

export function Beat({ active, children, className = "", citation }: BeatProps) {
  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center px-20 py-24 z-10 overflow-y-auto transition-all duration-400 ease-out ${
        active
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-[0.98] pointer-events-none"
      } ${className}`}
    >
      {children}
      {citation && (
        <div
          className="absolute bottom-5 left-8 font-mono text-[11px] tracking-wide select-none"
          style={{ color: "rgba(138,138,150,0.3)" }}
        >
          {citation}
        </div>
      )}
    </div>
  );
}
