import React, { Component, type ReactNode, type ErrorInfo } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./index.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 p-6 text-neutral-100 select-text">
          <div className="max-w-lg rounded-lg border border-red-500/30 bg-red-950/20 p-6 shadow-xl">
            <h1 className="text-lg font-semibold text-red-400">Desktop UI Encountered an Error</h1>
            <p className="mt-2 text-xs text-neutral-400 font-mono break-all whitespace-pre-wrap">
              {this.state.error?.message || "Unknown error"}
            </p>
            {this.state.error?.stack && (
              <pre className="mt-4 max-h-60 overflow-auto rounded bg-neutral-900 p-3 text-[11px] text-neutral-300 font-mono">
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

