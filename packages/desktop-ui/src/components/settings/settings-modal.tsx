import React, { useEffect, useState } from "react";
import {
  Settings,
  Sliders,
  Cpu,
  ShieldAlert,
  Smartphone,
  Network,
  Info,
  Check,
  Moon,
  Sun,
  Laptop,
  Volume2,
  VolumeX,
  WrapText,
  AlertTriangle,
  RotateCw,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
} from "lucide-react";
import type { ModelInfo, PermissionMode } from "../../types/index.js";
import {
  useSettingsStore,
  SettingsTab,
  useProviderStore,
  useModelStore,
  useDeviceStore,
  useConnectionStore,
} from "../../store/index.js";
import { useThemeStore } from "../../store/theme-store.js";
import { client } from "../../network/client.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { Badge } from "../ui/badge.js";
import { Input } from "../ui/input.js";
import { ProviderLogo } from "../ui/provider-logo.js";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPairing?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  onOpenPairing,
}) => {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const hostSettings = useSettingsStore((s) => s.hostSettings);
  const localSettings = useSettingsStore((s) => s.localSettings);
  const updateLocalSettings = useSettingsStore((s) => s.updateLocalSettings);
  const isSaving = useSettingsStore((s) => s.isSaving);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const providers = useProviderStore((s) => s.providers);
  const models = useModelStore((s) => s.models);
  const devices = useDeviceStore((s) => s.devices);
  const connectionStatus = useConnectionStore((s) => s.status);

  // Form states for host settings
  const [defaultProviderId, setDefaultProviderId] = useState<string>("codex");
  const [defaultModel, setDefaultModel] = useState<string>("gpt-5-codex");
  const [defaultEffort, setDefaultEffort] = useState<string>("medium");
  const [autoApproveReadOnly, setAutoApproveReadOnly] = useState<boolean>(false);
  const [defaultPermissionMode, setDefaultPermissionMode] = useState<PermissionMode>("onRequest");
  const [serverPort, setServerPort] = useState<number>(7890);
  const [enableMdns, setEnableMdns] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Dynamic models for currently selected provider in Settings
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(models);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Sync state from store when modal opens or hostSettings updates
  useEffect(() => {
    if (hostSettings) {
      setDefaultProviderId(hostSettings.defaultProviderId);
      setDefaultModel(hostSettings.defaultModel);
      setDefaultEffort(hostSettings.defaultReasoningEffort || "medium");
      setAutoApproveReadOnly(hostSettings.autoApproveReadOnly);
      setDefaultPermissionMode(hostSettings.defaultPermissionMode);
      setServerPort(hostSettings.serverPort);
      setEnableMdns(hostSettings.enableMdns);
    }
  }, [hostSettings, open]);

  // Fetch models whenever defaultProviderId changes or modal opens
  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    // Check cached models in store first for instant UI response
    const cached = useModelStore.getState().modelsByProvider[defaultProviderId];
    if (cached && cached.models.length > 0) {
      setAvailableModels(cached.models);
    }

    setIsLoadingModels(true);
    client
      .call("model.list", { providerId: defaultProviderId })
      .then((res: any) => {
        if (isCancelled || !res?.models) return;
        const fetchedModels: ModelInfo[] = res.models;
        setAvailableModels(fetchedModels);

        // Auto-select valid model if current selection does not exist in new provider's models
        setDefaultModel((prevModel) => {
          const exists = fetchedModels.some(
            (m) => m.model === prevModel || m.id === prevModel
          );
          if (exists) return prevModel;
          const defaultInfo =
            fetchedModels.find((m) => m.isDefault) || fetchedModels[0];
          if (defaultInfo) {
            if (defaultInfo.defaultReasoningEffort) {
              setDefaultEffort(defaultInfo.defaultReasoningEffort);
            }
            return defaultInfo.model;
          }
          return prevModel;
        });
      })
      .catch((err) => {
        console.error("[SettingsModal] Failed to fetch models for", defaultProviderId, err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingModels(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [defaultProviderId, open]);

  // Handle save host settings
  const handleSaveHostSettings = async () => {
    try {
      await client.updateSettings({
        defaultProviderId,
        defaultModel,
        defaultReasoningEffort: defaultEffort || undefined,
        autoApproveReadOnly,
        defaultPermissionMode,
        serverPort: Number(serverPort) || 7890,
        enableMdns,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error("[SettingsModal] Failed to update host settings", e);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await client.revokeDevice(deviceId);
    } catch (e) {
      console.error("[SettingsModal] Failed to revoke device", e);
    } finally {
      setRevokingId(null);
    }
  };

  const navItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General & Display", icon: <Sliders className="w-4 h-4" /> },
    { id: "ai", label: "AI & Providers", icon: <Cpu className="w-4 h-4" /> },
    { id: "security", label: "Security & Guardrails", icon: <ShieldAlert className="w-4 h-4" /> },
    { id: "devices", label: "Connected Devices", icon: <Smartphone className="w-4 h-4" /> },
    { id: "network", label: "Network & Host", icon: <Network className="w-4 h-4" /> },
    { id: "about", label: "About", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! p-0 overflow-hidden bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl shadow-2xl">
        <div className="flex h-[560px]">
          {/* LEFT SIDEBAR TABS */}
          <div className="w-56 bg-[var(--sidebar-bg)] border-r border-[var(--border)] p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <Settings className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-sm font-semibold tracking-tight">Settings</span>
              </div>

              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                      isActive
                        ? "bg-[var(--secondary)] text-[var(--foreground)] font-semibold shadow-xs"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className={isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Host Status pill at bottom */}
            <div className="p-2 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)] text-[11px] text-[var(--muted-foreground)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Daemon Status</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus === "connected"
                        ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                        : "bg-rose-500"
                    }`}
                  />
                  {connectionStatus === "connected" ? "Online" : "Offline"}
                </span>
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)]/80">Port: {serverPort}</div>
            </div>
          </div>

          {/* RIGHT CONTENT AREA */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[var(--background)]">
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* TAB: GENERAL */}
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">General & Display</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Customize your desktop app appearance and editor preferences.
                    </p>
                  </div>

                  {/* Theme Mode */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium block">Color Theme</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "system", label: "System", icon: <Laptop className="w-4 h-4" /> },
                        { id: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
                        { id: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as any)}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            theme === t.id
                              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
                          }`}
                        >
                          {t.icon}
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Code Editor Font Size */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-medium block">Code Font Size</label>
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Applies to diffs, tool calls, and markdown blocks.
                        </span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {localSettings.codeFontSize}px
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="11"
                        max="18"
                        step="1"
                        value={localSettings.codeFontSize}
                        onChange={(e) => updateLocalSettings({ codeFontSize: Number(e.target.value) })}
                        className="w-full accent-[var(--primary)] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Code Word Wrap */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <WrapText className="w-4 h-4 text-[var(--muted-foreground)]" />
                        <span>Code Word Wrap</span>
                      </div>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        Wrap long lines in diff views and code blocks instead of horizontal scrolling.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.wordWrap}
                      onChange={(e) => updateLocalSettings({ wordWrap: e.target.checked })}
                      className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                    />
                  </div>

                  {/* Sound Notifications */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        {localSettings.soundEnabled ? (
                          <Volume2 className="w-4 h-4 text-[var(--muted-foreground)]" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-[var(--muted-foreground)]" />
                        )}
                        <span>Completion Sounds</span>
                      </div>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        Play subtle audio cue when agent turns complete or require approvals.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.soundEnabled}
                      onChange={(e) => updateLocalSettings({ soundEnabled: e.target.checked })}
                      className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB: AI & PROVIDERS */}
              {activeTab === "ai" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">AI & Providers</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Configure default assistant providers, models, and reasoning parameters.
                    </p>
                  </div>

                  {/* Default Provider */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium block">Default Assistant Provider</label>
                    <div className="grid grid-cols-2 gap-3">
                      {providers.map((p) => {
                        const isSelected = defaultProviderId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setDefaultProviderId(p.id)}
                            className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                              isSelected
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]"
                                : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
                            }`}
                          >
                            <ProviderLogo providerId={p.id} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate text-[var(--foreground)]">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {p.isConfigured ? "CLI Ready" : "Unconfigured"}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Default Model */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium block">Default Model</label>
                      {isLoadingModels && (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Updating models...</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)]"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id || m.model} value={m.model}>
                            {m.displayName || m.model} {m.isDefault ? "(Recommended)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Default Reasoning Effort */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <label className="text-xs font-medium block">Default Reasoning Effort</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["low", "medium", "high"].map((effort) => (
                        <button
                          key={effort}
                          type="button"
                          onClick={() => setDefaultEffort(effort)}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                            defaultEffort === effort
                              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
                          }`}
                        >
                          {effort}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: SECURITY */}
              {activeTab === "security" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">Security & Guardrails</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Control auto-approvals and execution boundaries for remote clients.
                    </p>
                  </div>

                  {/* Auto-Approve Read-Only */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold">Auto-Approve Read-Only Commands</div>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-1 leading-relaxed">
                          Automatically approves inspection commands (<code className="text-[10px] bg-[var(--secondary)] px-1 rounded">git status</code>, <code className="text-[10px] bg-[var(--secondary)] px-1 rounded">git diff</code>, <code className="text-[10px] bg-[var(--secondary)] px-1 rounded">ls</code>, <code className="text-[10px] bg-[var(--secondary)] px-1 rounded">grep</code>, <code className="text-[10px] bg-[var(--secondary)] px-1 rounded">cat</code>) without halting turns for confirmation.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoApproveReadOnly}
                        onChange={(e) => setAutoApproveReadOnly(e.target.checked)}
                        className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer mt-0.5"
                      />
                    </div>
                  </div>

                  {/* Default Permission Mode */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <label className="text-xs font-medium block">Default Chat Permission Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "onRequest", label: "On Request", desc: "Confirm each action" },
                        { id: "auto", label: "Full Auto", desc: "Always auto-approve" },
                        { id: "readOnly", label: "Read Only", desc: "No file mutations" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDefaultPermissionMode(item.id as PermissionMode)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            defaultPermissionMode === item.id
                              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
                          }`}
                        >
                          <div className="text-xs font-semibold text-[var(--foreground)]">{item.label}</div>
                          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-amber-500">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <strong className="font-semibold block mb-0.5">High-Risk Command Safety:</strong>
                      Destructive system commands (e.g. <code className="bg-amber-500/20 px-1 rounded">sudo</code>, <code className="bg-amber-500/20 px-1 rounded">rm -rf</code>, hard git resets) will always prompt for user confirmation regardless of mode.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: DEVICES */}
              {activeTab === "devices" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">Connected Devices</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Manage paired iOS and remote desktop companion clients.
                    </p>
                  </div>

                  {/* Pair Device Action Card */}
                  {onOpenPairing && (
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--foreground)]">
                            Pair iOS or Companion Device
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            Generate a single-use QR code for instant cryptographic handshake.
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          onOpenChange(false);
                          onOpenPairing();
                        }}
                        className="text-xs flex items-center gap-1.5 shrink-0"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Pair New Device</span>
                      </Button>
                    </div>
                  )}

                  {devices.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-2xl space-y-2">
                      <Smartphone className="w-8 h-8 text-[var(--muted-foreground)] mx-auto opacity-60" />
                      <div className="text-xs font-medium text-[var(--foreground)]">No Devices Paired</div>
                      <p className="text-[11px] text-[var(--muted-foreground)] max-w-sm mx-auto">
                        Scan a QR code from the Canywhere iOS app to securely pair your phone.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center shrink-0">
                              <Smartphone className="w-4 h-4 text-[var(--foreground)]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate text-[var(--foreground)]">
                                {device.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase">
                                  {device.platform}
                                </Badge>
                                <span>Key: {device.publicKey.slice(0, 10)}...</span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={revokingId === device.id}
                            onClick={() => handleRevokeDevice(device.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                            title="Revoke device access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: NETWORK */}
              {activeTab === "network" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">Network & Discovery</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Host daemon listener and remote discovery addresses.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
                      <div className="text-xs text-[var(--muted-foreground)]">Daemon Listen Port</div>
                      <div className="font-mono text-sm font-semibold">{serverPort}</div>
                    </div>

                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
                      <div className="text-xs text-[var(--muted-foreground)]">Local Loopback</div>
                      <div className="font-mono text-xs font-medium">ws://127.0.0.1:{serverPort}/rpc</div>
                    </div>

                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
                      <div className="text-xs text-[var(--muted-foreground)]">mDNS / Bonjour Broadcast</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-mono text-xs">_canywhere._tcp (Active)</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-1">
                      <div className="text-xs text-[var(--muted-foreground)]">Tailscale IP Resolution</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        Automatically detected when Tailscale is running on this workstation.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: ABOUT */}
              {activeTab === "about" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold">About Canywhere</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Remote control client & daemon for autonomous coding agents.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3 text-xs leading-relaxed">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <span className="font-semibold text-[var(--foreground)]">Version</span>
                      <span className="font-mono">0.1.0</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <span className="font-semibold text-[var(--foreground)]">Architecture</span>
                      <span>Host SSOT (Rust + SQLite)</span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <span className="font-semibold text-[var(--foreground)]">Wire Protocol</span>
                      <span>JSON-RPC 2.0 over WebSocket</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--foreground)]">License</span>
                      <span>MIT</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Canywhere securely decouples autonomous AI coding assistants from your workstation, giving you seamless live control from iOS and Desktop.
                  </p>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-3.5 border-t border-[var(--border)] bg-[var(--sidebar-bg)] flex items-center justify-between shrink-0">
              <div className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                {saveSuccess && (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Settings synced to host</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {(activeTab === "ai" || activeTab === "security" || activeTab === "network") && (
                  <Button
                    size="sm"
                    disabled={isSaving}
                    onClick={handleSaveHostSettings}
                    className="flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Saving..." : "Apply & Sync"}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
