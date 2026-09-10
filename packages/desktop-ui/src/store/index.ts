import { create } from "zustand";
import {
  Workspace,
  Chat,
  Message,
  MessageBlock,
  ApprovalRequest,
  Device,
  PairingQrPayload,
  ModelInfo,
  Provider,
  FileTreeNode,
  PermissionMode,
  QueuedMessage,
} from "../types/index.js";
import { useSettingsStore } from "./settings.js";

export interface ProviderState {
  providers: Provider[];
  selectedProviderId: string;
  setProviders: (providers: Provider[]) => void;
  setSelectedProviderId: (providerId: string) => void;
}

const STORAGE_KEY_PROVIDER = "canywhere:selected_provider_id";

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  selectedProviderId: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PROVIDER) || "";
    } catch {
      return "";
    }
  })(),
  setProviders: (providers) =>
    set((s) => {
      const exists = !!s.selectedProviderId && providers.some((p) => p.id === s.selectedProviderId);
      const configured = providers.find((p) => p.isConfigured);
      const fallback = configured?.id || providers[0]?.id || "";
      return {
        providers,
        selectedProviderId: exists ? s.selectedProviderId : fallback,
      };
    }),
  setSelectedProviderId: (selectedProviderId) => {
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, selectedProviderId);
    } catch {}
    set({ selectedProviderId });
    const p = get().providers.find((prov) => prov.id === selectedProviderId);
    if (p && p.capabilities && !p.capabilities.supportsApprovals) {
      useChatStore.getState().setDraftPermissionMode("auto");
    }
  },
}));

export interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  hostPublicKey: string | null;
  error: string | null;
  setStatus: (status: ConnectionState["status"], error?: string | null) => void;
  setHostPublicKey: (key: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "disconnected",
  hostPublicKey: null,
  error: null,
  setStatus: (status, error = null) => set({ status, error }),
  setHostPublicKey: (hostPublicKey) => set({ hostPublicKey })
}));

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  fileTrees: Record<string, FileTreeNode | null>; // workspaceId -> FileTreeNode
  activeFile: { workspaceId: string; path: string; content: string } | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setFileTree: (workspaceId: string, tree: FileTreeNode | null) => void;
  setActiveFile: (file: { workspaceId: string; path: string; content: string } | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  fileTrees: {},
  activeFile: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set((s) => ({ workspaces: [workspace, ...s.workspaces] })),
  updateWorkspace: (id, patch) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),
  removeWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    })),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setFileTree: (workspaceId, tree) =>
    set((s) => ({ fileTrees: { ...s.fileTrees, [workspaceId]: tree } })),
  setActiveFile: (activeFile) => set({ activeFile }),
}));

export interface DraftChat {
  workspaceId: string | null;
}

export interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  draftChat: DraftChat | null;
  draftPermissionMode: PermissionMode;
  messages: Record<string, Message[]>; // chatId -> Message[]
  activeTurnId: Record<string, string | null>; // chatId -> turnId
  queuedMessages: Record<string, QueuedMessage[]>; // chatId -> QueuedMessage[]
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  setActiveChatId: (id: string | null) => void;
  setDraftChat: (draft: DraftChat | null) => void;
  setDraftPermissionMode: (mode: PermissionMode) => void;
  openDraftChat: (workspaceId?: string | null) => void;
  setChatStatus: (chatId: string, status: Chat["status"]) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  appendTokenDelta: (chatId: string, messageId: string, blockId: string, text: string, type?: "text" | "reasoning") => void;
  addBlock: (chatId: string, messageId: string, block: MessageBlock) => void;
  updateBlock: (chatId: string, messageId: string, blockId: string, update: Partial<MessageBlock>) => void;
  setActiveTurn: (chatId: string, turnId: string | null) => void;
  updateChat: (chatId: string, update: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  setQueuedMessages: (chatId: string, items: QueuedMessage[]) => void;
  enqueueMessage: (chatId: string, content: string, model?: string | null, effort?: string | null, permissionMode?: PermissionMode) => QueuedMessage;
  removeQueuedMessage: (chatId: string, queueId: string) => void;
  updateQueuedMessage: (chatId: string, queueId: string, content: string) => void;
  shiftNextQueuedMessage: (chatId: string) => QueuedMessage | null;
  clearQueue: (chatId: string) => void;
}

export const EMPTY_MESSAGES: Message[] = [];

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  draftChat: null,
  draftPermissionMode: useSettingsStore.getState().hostSettings?.defaultPermissionMode ?? "onRequest",
  messages: {},
  activeTurnId: {},
  queuedMessages: {},

  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats] })),
  setDraftChat: (draftChat) => {
    if (draftChat && draftChat.workspaceId !== undefined) {
      useWorkspaceStore.getState().setActiveWorkspaceId(draftChat.workspaceId ?? null);
    }
    set({ draftChat });
  },
  setDraftPermissionMode: (draftPermissionMode) => set({ draftPermissionMode }),
  openDraftChat: (workspaceId) => {
    const wsId = workspaceId ?? null;
    const defaultPerm = useSettingsStore.getState().hostSettings?.defaultPermissionMode ?? "onRequest";
    useWorkspaceStore.getState().setActiveWorkspaceId(wsId);
    set({
      activeChatId: null,
      draftChat: { workspaceId: wsId },
      draftPermissionMode: defaultPerm,
    });
  },
  updateChat: (chatId, update) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, ...update } : c))
    })),
  removeChat: (chatId) =>
    set((s) => {
      const remainingChats = s.chats.filter((c) => c.id !== chatId);
      const newMessages = { ...s.messages };
      delete newMessages[chatId];
      const newActiveTurn = { ...s.activeTurnId };
      delete newActiveTurn[chatId];
      const newQueued = { ...s.queuedMessages };
      delete newQueued[chatId];
      const nextChatId = s.activeChatId === chatId ? (remainingChats[0]?.id || null) : s.activeChatId;
      return {
        chats: remainingChats,
        activeChatId: nextChatId,
        draftChat: nextChatId ? null : { workspaceId: s.draftChat?.workspaceId ?? null },
        messages: newMessages,
        activeTurnId: newActiveTurn,
        queuedMessages: newQueued,
      };
    }),
  setQueuedMessages: (chatId, items) =>
    set((s) => ({
      queuedMessages: {
        ...s.queuedMessages,
        [chatId]: items,
      },
    })),
  enqueueMessage: (chatId, content, model, effort, permissionMode) => {
    const newItem: QueuedMessage = {
      id: "queue-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      chatId,
      content,
      model: model || null,
      effort: effort || null,
      permissionMode,
      createdAt: Date.now(),
    };
    set((s) => ({
      queuedMessages: {
        ...s.queuedMessages,
        [chatId]: [...(s.queuedMessages[chatId] || []), newItem],
      },
    }));
    return newItem;
  },
  removeQueuedMessage: (chatId, queueId) =>
    set((s) => ({
      queuedMessages: {
        ...s.queuedMessages,
        [chatId]: (s.queuedMessages[chatId] || []).filter((q) => q.id !== queueId),
      },
    })),
  updateQueuedMessage: (chatId, queueId, content) =>
    set((s) => ({
      queuedMessages: {
        ...s.queuedMessages,
        [chatId]: (s.queuedMessages[chatId] || []).map((q) => (q.id === queueId ? { ...q, content } : q)),
      },
    })),
  shiftNextQueuedMessage: (chatId) => {
    let nextItem: QueuedMessage | null = null;
    set((s) => {
      const list = s.queuedMessages[chatId] || [];
      if (list.length === 0) return s;
      nextItem = list[0];
      return {
        queuedMessages: {
          ...s.queuedMessages,
          [chatId]: list.slice(1),
        },
      };
    });
    return nextItem;
  },
  clearQueue: (chatId) =>
    set((s) => {
      const next = { ...s.queuedMessages };
      delete next[chatId];
      return { queuedMessages: next };
    }),
  setActiveChatId: (activeChatId) =>
    set((s) => {
      const activeChat = activeChatId ? s.chats.find((c) => c.id === activeChatId) : null;
      useWorkspaceStore.getState().setActiveWorkspaceId(activeChat?.workspaceId || null);
      return { activeChatId, draftChat: null };
    }),
  setChatStatus: (chatId, status) =>
    set((s) => {
      const isCompleted = status === "idle" || status === "error";
      const list = s.messages[chatId];
      const updatedMessages = isCompleted && list
        ? {
            ...s.messages,
            [chatId]: list.map((m, idx) =>
              m.streaming || idx === list.length - 1
                ? {
                    ...m,
                    streaming: false,
                    blocks: m.blocks.map((b) => {
                      if (b.type === "reasoning" && !("completed" in b && b.completed)) {
                        return { ...b, completed: true };
                      }
                      if (b.type === "tool_call" && (b as any).status === "running") {
                        return { ...b, status: "completed" as const };
                      }
                      if (b.type === "command_exec" && (b as any).status === "running") {
                        return { ...b, status: "completed" as const };
                      }
                      return b;
                    })
                  }
                : m
            )
          }
        : s.messages;
      return {
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, status } : c)),
        messages: updatedMessages
      };
    }),

  setMessages: (chatId, messages) =>
    set((s) => ({
      messages: { ...s.messages, [chatId]: messages }
    })),

  addMessage: (chatId, message) =>
    set((s) => {
      const list = s.messages[chatId] || [];
      return {
        messages: { ...s.messages, [chatId]: [...list, message] }
      };
    }),

  appendTokenDelta: (chatId, messageId, _blockId, text, type = "text") =>
    set((s) => {
      const list = s.messages[chatId] || [];
      const hasExactMatch = list.some((m) => m.id === messageId);
      const updated = list.map((m) => {
        const matches = hasExactMatch ? m.id === messageId : (m.streaming && m.role === "agent");
        if (!matches) return m;

        const blocks = [...m.blocks];
        if (type === "reasoning") {
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === "reasoning" && !(lastBlock as any).completed) {
            blocks[blocks.length - 1] = {
              ...lastBlock,
              content: (lastBlock.content || "") + text,
              completed: false,
            };
          } else {
            // Finalize any earlier uncompleted reasoning blocks
            for (let i = 0; i < blocks.length; i++) {
              const b = blocks[i];
              if (b.type === "reasoning" && !(b as any).completed) {
                blocks[i] = { ...b, completed: true };
              }
            }
            blocks.push({
              type: "reasoning",
              content: text,
              completed: false,
            });
          }
        } else {
          // type === "text"
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === "reasoning" && !(lastBlock as any).completed) {
            blocks[blocks.length - 1] = {
              ...lastBlock,
              completed: true,
            };
          }
          const currentLast = blocks[blocks.length - 1];
          if (currentLast && currentLast.type === "text") {
            blocks[blocks.length - 1] = {
              ...currentLast,
              content: currentLast.content + text,
            };
          } else {
            blocks.push({
              type: "text",
              content: text,
            });
          }
        }
        return { ...m, blocks };
      });

      return {
        messages: { ...s.messages, [chatId]: updated }
      };
    }),

  addBlock: (chatId, messageId, block) =>
    set((s) => {
      const list = s.messages[chatId] || [];
      const updated = list.map((m) => {
        if (m.id !== messageId) return m;
        // Finalize any in-progress reasoning blocks before adding the new block
        const blocks = m.blocks.map((b) =>
          b.type === "reasoning" && !(b as any).completed
            ? { ...b, completed: true }
            : b
        );
        return { ...m, blocks: [...blocks, block] };
      });
      return {
        messages: { ...s.messages, [chatId]: updated }
      };
    }),

  updateBlock: (chatId, messageId, blockId, update) =>
    set((s) => {
      const list = s.messages[chatId] || [];
      const targetMessageId = messageId || list[list.length - 1]?.id;
      const updated = list.map((m) => {
        if (m.id !== targetMessageId) return m;
        let matched = false;
        let blocks = m.blocks.map((b) => {
          if (blockId && ((b as any).id === blockId || (b as any).callId === blockId)) {
            matched = true;
            return { ...b, ...update } as MessageBlock;
          }
          return b;
        });
        if (!matched && update) {
          const targetType = (update as any).type;
          for (let i = blocks.length - 1; i >= 0; i--) {
            const b = blocks[i] as any;
            if (b.status === "running") {
              if (!targetType || b.type === targetType) {
                blocks = [...blocks];
                blocks[i] = { ...b, ...update } as MessageBlock;
                matched = true;
                break;
              }
            }
          }
        }
        return { ...m, blocks };
      });
      return {
        messages: { ...s.messages, [chatId]: updated }
      };
    }),

  setActiveTurn: (chatId, turnId) =>
    set((s) => ({
      activeTurnId: { ...s.activeTurnId, [chatId]: turnId }
    }))
}));

export interface ApprovalState {
  pendingApprovals: ApprovalRequest[];
  addApproval: (approval: ApprovalRequest) => void;
  removeApproval: (approvalId: string) => void;
  setPendingApprovals: (approvals: ApprovalRequest[]) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pendingApprovals: [],
  addApproval: (approval) =>
    set((s) => ({
      pendingApprovals: [...s.pendingApprovals.filter((a) => a.id !== approval.id), approval]
    })),
  removeApproval: (approvalId) =>
    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((a) => a.id !== approvalId)
    })),
  setPendingApprovals: (pendingApprovals) => set({ pendingApprovals })
}));

export interface DeviceState {
  devices: Device[];
  qrPayload: PairingQrPayload | null;
  setDevices: (devices: Device[]) => void;
  setQrPayload: (qrPayload: PairingQrPayload | null) => void;
  removeDevice: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  qrPayload: null,
  setDevices: (devices) => set({ devices }),
  setQrPayload: (qrPayload) => set({ qrPayload }),
  removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }))
}));

export interface ModelState {
  models: ModelInfo[];
  selectedModel: string;
  selectedEffort: string;
  modelsByProvider: Record<string, { models: ModelInfo[]; currentModel: string; currentEffort: string }>;
  setModels: (models: ModelInfo[], currentModel?: string, currentEffort?: string, providerId?: string) => void;
  switchProviderCache: (providerId: string) => boolean;
  setSelectedModel: (model: string, providerId?: string) => void;
  setSelectedEffort: (effort: string, providerId?: string) => void;
  syncRemoteModel: (model: string, effort?: string) => void;
  setOnModelChanged: (cb: (model: string, effort?: string) => void) => void;
}

const STORAGE_KEY_MODEL = "canywhere:last_selected_model";
const STORAGE_KEY_EFFORT = "canywhere:last_selected_effort";

const getSavedModel = () => {
  try {
    return localStorage.getItem(STORAGE_KEY_MODEL) || "";
  } catch {
    return "";
  }
};

const getSavedEffort = () => {
  try {
    return localStorage.getItem(STORAGE_KEY_EFFORT) || "";
  } catch {
    return "";
  }
};

let onModelChangedCallback: ((model: string, effort?: string) => void) | null = null;

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  selectedModel: getSavedModel(),
  selectedEffort: getSavedEffort(),
  modelsByProvider: {},
  setOnModelChanged: (cb) => {
    onModelChangedCallback = cb;
  },
  switchProviderCache: (providerId: string) => {
    const cached = get().modelsByProvider[providerId];
    if (cached && cached.models.length > 0) {
      set({
        models: cached.models,
        selectedModel: cached.currentModel,
        selectedEffort: cached.currentEffort,
      });
      return true;
    }
    return false;
  },
  setModels: (models, currentModel, currentEffort, providerId) => {
    if (!models || models.length === 0) return;
    const defaultModelInfo = models.find((m) => m.isDefault) || models[0];
    const defaultModel = defaultModelInfo?.model || "";
    set((s) => {
      const preferredModel = currentModel || s.selectedModel || getSavedModel();
      const matchedModel = models.find((m) => m.model === preferredModel);
      const activeModel = matchedModel ? matchedModel.model : defaultModel;
      const activeModelInfo = matchedModel || defaultModelInfo;

      const supportedEfforts = activeModelInfo?.supportedReasoningEfforts || [];
      const defaultEffort = activeModelInfo?.defaultReasoningEffort || (supportedEfforts.length > 0 ? supportedEfforts[0] : "");

      const preferredEffort = currentEffort || s.selectedEffort || getSavedEffort();
      const activeEffort = supportedEfforts.includes(preferredEffort) ? preferredEffort : defaultEffort;

      try {
        localStorage.setItem(STORAGE_KEY_MODEL, activeModel);
        if (activeEffort) {
          localStorage.setItem(STORAGE_KEY_EFFORT, activeEffort);
        }
      } catch {}

      const nextModelsByProvider = { ...s.modelsByProvider };
      if (providerId) {
        nextModelsByProvider[providerId] = {
          models,
          currentModel: activeModel,
          currentEffort: activeEffort,
        };
      }

      return {
        models,
        selectedModel: activeModel,
        selectedEffort: activeEffort,
        modelsByProvider: nextModelsByProvider,
      };
    });
  },
  syncRemoteModel: (model, effort) => {
    set((s) => {
      const matchedModel = s.models.find((m) => m.model === model);
      const supportedEfforts = matchedModel?.supportedReasoningEfforts || [];
      const defaultEffort = matchedModel?.defaultReasoningEffort || (supportedEfforts.length > 0 ? supportedEfforts[0] : "");
      const activeEffort = effort && supportedEfforts.includes(effort) ? effort : (effort || defaultEffort || s.selectedEffort);

      try {
        localStorage.setItem(STORAGE_KEY_MODEL, model);
        if (activeEffort) {
          localStorage.setItem(STORAGE_KEY_EFFORT, activeEffort);
        }
      } catch {}

      return {
        selectedModel: model,
        selectedEffort: activeEffort,
      };
    });
  },
  setSelectedModel: (selectedModel, providerId) => {
    try {
      localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
    } catch {}
    let finalEffort = "";
    set((s) => {
      const modelInfo = s.models.find((m) => m.model === selectedModel);
      const supportedEfforts = modelInfo?.supportedReasoningEfforts || [];
      const defaultEffort = modelInfo?.defaultReasoningEffort || (supportedEfforts.length > 0 ? supportedEfforts[0] : "");
      const activeEffort = supportedEfforts.includes(s.selectedEffort) ? s.selectedEffort : defaultEffort;
      finalEffort = activeEffort;
      if (activeEffort) {
        try {
          localStorage.setItem(STORAGE_KEY_EFFORT, activeEffort);
        } catch {}
      }
      const pId = providerId || useProviderStore.getState().selectedProviderId;
      const nextModelsByProvider = { ...s.modelsByProvider };
      if (pId && nextModelsByProvider[pId]) {
        nextModelsByProvider[pId] = {
          ...nextModelsByProvider[pId],
          currentModel: selectedModel,
          currentEffort: activeEffort,
        };
      }
      return { selectedModel, selectedEffort: activeEffort, modelsByProvider: nextModelsByProvider };
    });
    if (onModelChangedCallback) {
      onModelChangedCallback(selectedModel, finalEffort || undefined);
    }
  },
  setSelectedEffort: (selectedEffort, providerId) => {
    try {
      localStorage.setItem(STORAGE_KEY_EFFORT, selectedEffort);
    } catch {}
    set((s) => {
      const pId = providerId || useProviderStore.getState().selectedProviderId;
      const nextModelsByProvider = { ...s.modelsByProvider };
      if (pId && nextModelsByProvider[pId]) {
        nextModelsByProvider[pId] = {
          ...nextModelsByProvider[pId],
          currentEffort: selectedEffort,
        };
      }
      return { selectedEffort, modelsByProvider: nextModelsByProvider };
    });
    if (onModelChangedCallback) {
      onModelChangedCallback(get().selectedModel, selectedEffort);
    }
  },
}));

export type RightTabType = "fileTree" | "git" | "terminal" | "filePreview" | "diff";

export interface RightTabItem {
  id: string;
  type: RightTabType;
  title: string;
  isPermanent: boolean; // default permanent tabs cannot be closed or reordered
  data?: any; // e.g. active file info or diff patch
}

export interface UiState {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  rightSidebarWidth: number;
  setRightSidebarWidth: (width: number) => void;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;
  rightSidebarTabs: RightTabItem[];
  activeRightTabId: string;
  setActiveRightTabId: (id: string) => void;
  openOrFocusTab: (tab: Omit<RightTabItem, "isPermanent"> & { isPermanent?: boolean }) => void;
  closeTab: (id: string) => void;
}

const getInitialSidebarWidth = (): number => {
  try {
    const saved = localStorage.getItem("canywhere_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 180 && parsed <= 500) {
        return parsed;
      }
    }
  } catch {}
  return 256;
};

const getInitialRightSidebarWidth = (): number => {
  try {
    const saved = localStorage.getItem("canywhere_right_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 220 && parsed <= 700) {
        return parsed;
      }
    }
  } catch {}
  return 320;
};

const DEFAULT_RIGHT_TABS: RightTabItem[] = [
  { id: "fileTree", type: "fileTree", title: "Files", isPermanent: true },
  { id: "git", type: "git", title: "Git", isPermanent: true },
  { id: "terminal", type: "terminal", title: "Terminal", isPermanent: true },
];

export const useUiStore = create<UiState>((set) => ({
  sidebarWidth: getInitialSidebarWidth(),
  setSidebarWidth: (width) => {
    const clamped = Math.max(180, Math.min(500, width));
    try {
      localStorage.setItem("canywhere_sidebar_width", String(clamped));
    } catch {}
    set({ sidebarWidth: clamped });
  },
  rightSidebarWidth: getInitialRightSidebarWidth(),
  setRightSidebarWidth: (width) => {
    const clamped = Math.max(220, Math.min(700, width));
    try {
      localStorage.setItem("canywhere_right_sidebar_width", String(clamped));
    } catch {}
    set({ rightSidebarWidth: clamped });
  },
  rightSidebarOpen: true,
  setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  rightSidebarTabs: DEFAULT_RIGHT_TABS,
  activeRightTabId: "fileTree",
  setActiveRightTabId: (activeRightTabId) => set({ activeRightTabId, rightSidebarOpen: true }),
  openOrFocusTab: (tab) =>
    set((s) => {
      const existing = s.rightSidebarTabs.find((t) => t.id === tab.id);
      if (existing) {
        return {
          activeRightTabId: tab.id,
          rightSidebarOpen: true,
          rightSidebarTabs: s.rightSidebarTabs.map((t) =>
            t.id === tab.id ? { ...t, data: tab.data || t.data } : t
          ),
        };
      }
      return {
        rightSidebarTabs: [...s.rightSidebarTabs, { ...tab, isPermanent: false }],
        activeRightTabId: tab.id,
        rightSidebarOpen: true,
      };
    }),
  closeTab: (id) =>
    set((s) => {
      const tab = s.rightSidebarTabs.find((t) => t.id === id);
      if (tab?.isPermanent) return s; // Cannot close permanent tabs
      const filtered = s.rightSidebarTabs.filter((t) => t.id !== id);
      let nextActive = s.activeRightTabId;
      if (s.activeRightTabId === id) {
        nextActive = filtered[0]?.id || "fileTree";
      }
      return {
        rightSidebarTabs: filtered,
        activeRightTabId: nextActive,
      };
    }),
}));

export * from "./settings.js";


