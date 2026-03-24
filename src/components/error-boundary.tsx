"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  handleClearAndReload = () => {
    try {
      localStorage.removeItem("mcul-quarterly");
      localStorage.removeItem("mcul-daily");
    } catch {
      // localStorage might not be available
    }
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#09090B",
            color: "#E4E4E7",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: "1.5rem", fontSize: "2rem" }}>
            Michigan Credit Union Scanner
          </div>
          <div style={{ marginBottom: "1rem", color: "#8A8A96", maxWidth: "500px" }}>
            Something went wrong loading the dashboard. This usually happens when cached data is outdated.
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              onClick={this.handleClearAndReload}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid #437481",
                background: "rgba(67,116,129,0.15)",
                color: "#E4E4E7",
                cursor: "pointer",
                fontSize: "1rem",
                fontFamily: "monospace",
              }}
            >
              Clear Data & Reload
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid #2A2A32",
                background: "transparent",
                color: "#8A8A96",
                cursor: "pointer",
                fontSize: "1rem",
                fontFamily: "monospace",
              }}
            >
              Reload
            </button>
          </div>
          <div
            style={{
              marginTop: "2rem",
              fontSize: "0.75rem",
              color: "#52525b",
              fontFamily: "monospace",
              maxWidth: "600px",
              wordBreak: "break-word",
            }}
          >
            {this.state.error?.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
