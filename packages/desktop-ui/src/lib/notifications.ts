import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../store/settings.js";

/**
 * Checks if the Desktop window is currently active and focused by the user.
 */
export function isAppFocused(): boolean {
  return typeof document !== "undefined" && document.hasFocus() && document.visibilityState === "visible";
}

/**
 * Checks whether Tauri runtime is available.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Ensure notification permissions are requested.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (isTauriEnvironment()) {
      let granted = await isPermissionGranted();
      if (!granted) {
        const status = await requestPermission();
        granted = status === "granted";
      }
      return granted;
    } else if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") return true;
      const status = await Notification.requestPermission();
      return status === "granted";
    }
  } catch (err) {
    console.warn("[Notifications] Failed to check/request notification permission:", err);
  }
  return false;
}

/**
 * Play a synthesizer chime using Web Audio API (no external audio assets needed).
 */
export function playChime(type: "approval" | "completion" | "error" = "completion") {
  const localSettings = useSettingsStore.getState().localSettings;
  if (!localSettings.soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === "approval") {
      // Urgent high-pitched double tone: D5 (587Hz) -> A5 (880Hz)
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(587.33, 0, 0.12);
      playTone(880.0, 0.14, 0.22);
    } else if (type === "completion") {
      // Pleasant upward major arpeggio: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.26);
      });
    } else {
      // Muted descending tone: F4 (349Hz) -> C4 (261Hz)
      const freqs = [349.23, 261.63];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.21);
      });
    }
  } catch (err) {
    console.debug("[Notifications] Audio playback error:", err);
  }
}

/**
 * Focus the Tauri application window.
 */
export async function focusAppWindow() {
  if (isTauriEnvironment()) {
    try {
      const win = getCurrentWindow();
      await win.unminimize();
      await win.show();
      await win.setFocus();
    } catch (err) {
      console.warn("[Notifications] Failed to focus Tauri window:", err);
    }
  } else if (typeof window !== "undefined") {
    window.focus();
  }
}

export interface NotificationPayload {
  title: string;
  body: string;
  soundType?: "approval" | "completion" | "error";
  force?: boolean;
}

/**
 * Dispatch desktop OS notification taking into account user preferences and window focus.
 */
export async function dispatchDesktopNotification(payload: NotificationPayload): Promise<void> {
  const { localSettings } = useSettingsStore.getState();

  if (!localSettings.notificationsEnabled && !payload.force) {
    return;
  }

  const focused = isAppFocused();

  // If user prefers only background notifications and app is focused, don't display OS banner
  if (localSettings.notifyOnlyBackground && focused && !payload.force) {
    if (payload.soundType && localSettings.soundEnabled) {
      playChime(payload.soundType);
    }
    return;
  }

  // Play audio alert
  if (payload.soundType && localSettings.soundEnabled) {
    playChime(payload.soundType);
  }

  try {
    if (isTauriEnvironment()) {
      const hasPerm = await ensureNotificationPermission();
      if (hasPerm) {
        sendNotification({
          title: payload.title,
          body: payload.body,
        });
      }
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const notif = new Notification(payload.title, {
        body: payload.body,
        icon: "/logo.svg",
      });
      notif.onclick = () => {
        focusAppWindow();
        notif.close();
      };
    }
  } catch (err) {
    console.warn("[Notifications] Dispatch error:", err);
  }
}

/**
 * Notify user that an approval is pending.
 */
export function notifyApprovalRequired(detail: {
  chatId: string;
  command?: string;
  reason?: string;
  filesCount?: number;
  workspaceName?: string;
}) {
  const { localSettings } = useSettingsStore.getState();
  if (!localSettings.notifyOnApproval) return;

  const prefix = detail.workspaceName ? `${detail.workspaceName} - ` : "";
  let body = "An action requires your confirmation.";
  if (detail.command) {
    body = `Command: ${detail.command.length > 80 ? detail.command.slice(0, 77) + "..." : detail.command}`;
  } else if (detail.filesCount) {
    body = `File changes: ${detail.filesCount} file(s) awaiting review.`;
  } else if (detail.reason) {
    body = detail.reason;
  }

  dispatchDesktopNotification({
    title: `${prefix}Action Review Required`,
    body,
    soundType: "approval",
  });
}

/**
 * Notify user that a turn has completed.
 */
export function notifyTurnCompleted(detail: {
  chatId: string;
  status: string;
  title?: string;
  workspaceName?: string;
  error?: string;
}) {
  const { localSettings } = useSettingsStore.getState();
  if (!localSettings.notifyOnCompletion) return;

  const prefix = detail.workspaceName ? `${detail.workspaceName} - ` : "";
  const isSuccess = detail.status === "completed" || detail.status === "idle";

  const title = isSuccess
    ? `${prefix}Task Completed`
    : `${prefix}Task ${detail.status === "interrupted" ? "Interrupted" : "Failed"}`;

  let body = detail.title || "The agent has finished the turn.";
  if (detail.error) {
    body = `Error: ${detail.error.slice(0, 100)}`;
  }

  dispatchDesktopNotification({
    title,
    body,
    soundType: isSuccess ? "completion" : "error",
  });
}
