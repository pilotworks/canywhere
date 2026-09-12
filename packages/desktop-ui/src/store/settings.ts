import { create } from "zustand";
import type { HostSettings } from "../types/index.js";

export type SettingsTab = "general" | "ai" | "notifications" | "security" | "devices" | "network" | "about";

export interface LocalClientSettings {
  codeFontSize: number;
  fontFamily: string;
  soundEnabled: boolean;
  wordWrap: boolean;
  notificationsEnabled: boolean;
  notifyOnApproval: boolean;
  notifyOnCompletion: boolean;
  notifyOnlyBackground: boolean;
}

const DEFAULT_LOCAL_SETTINGS: LocalClientSettings = {
  codeFontSize: 13,
  fontFamily: "JetBrains Mono, monospace",
  soundEnabled: true,
  wordWrap: false,
  notificationsEnabled: true,
  notifyOnApproval: true,
  notifyOnCompletion: true,
  notifyOnlyBackground: true,
};

const STORAGE_KEY_LOCAL_SETTINGS = "canywhere:client_settings";

const getInitialLocalSettings = (): LocalClientSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_SETTINGS);
    if (raw) {
      return { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_LOCAL_SETTINGS;
};

export interface SettingsState {
  isOpen: boolean;
  activeTab: SettingsTab;
  hostSettings: HostSettings | null;
  localSettings: LocalClientSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  setOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: SettingsTab) => void;
  setHostSettings: (settings: HostSettings | null) => void;
  updateLocalSettings: (patch: Partial<LocalClientSettings>) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  activeTab: "general",
  hostSettings: null,
  localSettings: getInitialLocalSettings(),
  isLoading: false,
  isSaving: false,
  error: null,

  setOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setHostSettings: (hostSettings) => set({ hostSettings }),
  updateLocalSettings: (patch) =>
    set((s) => {
      const next = { ...s.localSettings, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY_LOCAL_SETTINGS, JSON.stringify(next));
      } catch {}
      return { localSettings: next };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
  setError: (error) => set({ error }),
}));
