"use client";

import { type ReactNode } from "react";

interface BeatProps {
  active: boolean;
  children: ReactNode;
  className?: string;
}

export function Beat({ active, children, className = "" }: BeatProps) {
  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center px-20 py-15 z-10 transition-all duration-400 ease-out ${
        active
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-[0.98] pointer-events-none"
      } ${className}`}
    >
      {children}
    </div>
  );
}
