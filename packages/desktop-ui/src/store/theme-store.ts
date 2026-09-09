import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = "canywhere-theme";

function getInitialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {}
  return "system";
}

function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }
  return theme;
}

let nativeBackgroundRequest = 0;

async function syncTauriNativeBackground(isDark: boolean) {
  const request = ++nativeBackgroundRequest;
  const color: [number, number, number, number] = isDark
    ? [9, 9, 11, 255]
    : [255, 255, 255, 255];

  try {
    if (request === nativeBackgroundRequest) {
      await getCurrentWindow().setBackgroundColor(color);
    }
  } catch {}
  try {
    if (request === nativeBackgroundRequest) {
      await getCurrentWebview().setBackgroundColor(color);
    }
  } catch {}
}

function applyThemeToDocument(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = resolved === "dark";
  if (isDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    root.style.backgroundColor = "#09090b";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    root.style.backgroundColor = "#ffffff";
  }

  syncTauriNativeBackground(isDark);
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  const resolved = resolveTheme(initial);
  applyThemeToDocument(resolved);

  // Listen to system changes
  if (typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (get().theme === "system") {
        const nextResolved = e.matches ? "dark" : "light";
        applyThemeToDocument(nextResolved);
        set({ resolvedTheme: nextResolved });
      }
    });
  }

  return {
    theme: initial,
    resolvedTheme: resolved,
    setTheme: (theme: ThemeMode) => {
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch {}
      }
      const nextResolved = resolveTheme(theme);
      applyThemeToDocument(nextResolved);
      set({ theme, resolvedTheme: nextResolved });
    },
  };
});
