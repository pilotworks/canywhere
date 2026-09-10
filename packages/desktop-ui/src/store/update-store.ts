import { create } from "zustand";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  downloadProgress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  error: string | null;
  lastCheckedAt: number | null;
  isModalOpen: boolean;
  dismissedVersion: string | null;
  isManualCheck: boolean;

  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
  dismissUpdate: () => void;
  openModal: () => void;
  closeModal: () => void;
  resetStatus: () => void;
}

const STORAGE_KEY_DISMISSED = "canywhere_dismissed_update_version";
export const CURRENT_APP_VERSION = "0.1.0";

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

export function compareSemVer(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^v/, "").trim();
  const parts1 = clean(v1).split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean(v2).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Module-level reference to the active Tauri Update instance
let currentTauriUpdate: any = null;

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  currentVersion: CURRENT_APP_VERSION,
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  error: null,
  lastCheckedAt: null,
  isModalOpen: false,
  dismissedVersion: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DISMISSED) || null;
    } catch {
      return null;
    }
  })(),
  isManualCheck: false,

  checkForUpdates: async (manual = false) => {
    set({
      status: "checking",
      error: null,
      isManualCheck: manual,
    });

    try {
      if (isTauri()) {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();

        if (update?.available) {
          currentTauriUpdate = update;
          const nextVersion = update.version;
          set({
            status: "available",
            availableVersion: nextVersion,
            releaseNotes: update.body || null,
            releaseDate: update.date || null,
            lastCheckedAt: Date.now(),
            isModalOpen: manual,
          });
        } else {
          currentTauriUpdate = null;
          set({
            status: "up-to-date",
            availableVersion: null,
            releaseNotes: null,
            releaseDate: null,
            lastCheckedAt: Date.now(),
          });
        }
      } else {
        // Fallback for browser/development: query GitHub releases API
        const res = await fetch("https://api.github.com/repos/pilotworks/canywhere/releases/latest", {
          headers: { Accept: "application/vnd.github.v3+json" },
        });

        if (!res.ok) {
          if (res.status === 404) {
            // No release published yet
            set({
              status: "up-to-date",
              lastCheckedAt: Date.now(),
            });
            return;
          }
          throw new Error(`GitHub API returned status ${res.status}`);
        }

        const data = await res.json();
        const latestTag = data.tag_name || "";
        const isNewer = compareSemVer(latestTag, get().currentVersion) > 0;

        if (isNewer) {
          set({
            status: "available",
            availableVersion: latestTag.replace(/^v/, ""),
            releaseNotes: data.body || null,
            releaseDate: data.published_at || null,
            lastCheckedAt: Date.now(),
            isModalOpen: manual,
          });
        } else {
          set({
            status: "up-to-date",
            availableVersion: null,
            releaseNotes: null,
            releaseDate: null,
            lastCheckedAt: Date.now(),
          });
        }
      }
    } catch (err: any) {
      console.error("[useUpdateStore] Update check failed:", err);
      set({
        status: "error",
        error: err?.message || "Failed to check for updates",
        lastCheckedAt: Date.now(),
      });
    }
  },

  downloadAndInstall: async () => {
    const { status } = get();
    if (status === "downloading" || status === "ready") return;

    set({
      status: "downloading",
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: null,
    });

    try {
      if (isTauri() && currentTauriUpdate) {
        let total = 0;
        let downloaded = 0;

        await currentTauriUpdate.downloadAndInstall((event: any) => {
          switch (event.event) {
            case "Started":
              total = event.data.contentLength || 0;
              set({ totalBytes: total, downloadedBytes: 0, downloadProgress: 0 });
              break;
            case "Progress":
              downloaded += event.data.chunkLength || 0;
              const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 50;
              set({
                downloadedBytes: downloaded,
                downloadProgress: progress,
              });
              break;
            case "Finished":
              set({
                downloadProgress: 100,
                status: "ready",
              });
              break;
          }
        });

        set({ status: "ready", downloadProgress: 100 });
      } else {
        // In browser fallback, direct to release page
        window.open("https://github.com/pilotworks/canywhere/releases/latest", "_blank");
        set({ status: "idle" });
      }
    } catch (err: any) {
      console.error("[useUpdateStore] Download and install failed:", err);
      set({
        status: "error",
        error: err?.message || "Failed to download update",
      });
    }
  },

  restartApp: async () => {
    if (isTauri()) {
      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (err) {
        console.error("[useUpdateStore] Failed to relaunch application:", err);
      }
    } else {
      window.location.reload();
    }
  },

  dismissUpdate: () => {
    const { availableVersion } = get();
    if (availableVersion) {
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED, availableVersion);
      } catch {}
    }
    set({
      dismissedVersion: availableVersion,
      isModalOpen: false,
    });
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  resetStatus: () => set({ status: "idle", error: null }),
}));
