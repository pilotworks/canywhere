import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Handles window dragging for frameless/overlay desktop windows (Tauri & Electron).
 * Dispatches dragging when clicking on non-interactive regions of the header.
 */
export const startWindowDrag = async (e: React.MouseEvent) => {
  // Only primary mouse button (left click)
  if (e.button !== 0 || e.detail > 1) return;

  const target = e.target as HTMLElement | null;
  // Do not drag if clicking interactive controls
  if (
    target?.closest(
      "button, input, textarea, select, [role='button'], [role='menuitem'], a, [data-no-drag], .window-no-drag"
    )
  ) {
    return;
  }

  try {
    // 1. Primary: Use Tauri v2 API
    await getCurrentWindow().startDragging();
    return;
  } catch {
    // Not running inside standard Tauri environment or failed
  }

  try {
    const w = window as any;
    // 2. Global Tauri fallback if available
    if (w.__TAURI__?.window?.getCurrentWindow) {
      await w.__TAURI__.window.getCurrentWindow().startDragging();
      return;
    }
    if (w.__TAURI_INTERNALS__?.invoke) {
      await w.__TAURI_INTERNALS__.invoke("plugin:window|start_dragging", { label: "main" });
      return;
    }
  } catch {
    // Fallback for browser preview
  }
};

/**
 * Handles title bar double-click to toggle maximize / zoom window on macOS
 */
export const handleTitleBarDoubleClick = async (e: React.MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (
    target?.closest(
      "button, input, textarea, select, [role='button'], [role='menuitem'], a, [data-no-drag], .window-no-drag"
    )
  ) {
    return;
  }

  try {
    // 1. Primary: Use Tauri v2 API
    await getCurrentWindow().toggleMaximize();
    return;
  } catch {
    // Not running inside standard Tauri environment or failed
  }

  try {
    const w = window as any;
    if (w.__TAURI__?.window?.getCurrentWindow) {
      await w.__TAURI__.window.getCurrentWindow().toggleMaximize();
    } else if (w.__TAURI_INTERNALS__?.invoke) {
      await w.__TAURI_INTERNALS__.invoke("plugin:window|toggle_maximize", { label: "main" });
    }
  } catch {}
};
