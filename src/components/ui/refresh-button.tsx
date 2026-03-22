"use client";

import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onRefresh: () => void;
  loading?: boolean;
  progress?: string;
}

export function RefreshButton({
  onRefresh,
  loading = false,
  progress,
}: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      className="refresh-btn min-h-[44px]"
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
      <span>
        {loading ? (progress ? progress : "Refreshing...") : "Refresh Data"}
      </span>
    </button>
  );
}
