"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Presentation } from "lucide-react";

export function ModeToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();
  const mode = searchParams.get("mode") || "dashboard";

  function toggleMode() {
    if (mode === "present") {
      router.push("/");
    } else {
      setTheme("dark");
      router.push("/?mode=present");
    }
  }

  return (
    <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50">
      <button
        onClick={toggleMode}
        className="present-btn min-h-[44px]"
        aria-label={
          mode === "present"
            ? "Exit presentation mode"
            : "Enter presentation mode"
        }
      >
        <Presentation size={14} />
        <span>{mode === "present" ? "Dashboard" : "Present"}</span>
      </button>
    </div>
  );
}
