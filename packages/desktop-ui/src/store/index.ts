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
  FileTreeNode,
} from "../types/index.js";

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

export interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>; // chatId -> Message[]
  activeTurnId: Record<string, string | null>; // chatId -> turnId
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  setActiveChatId: (id: string | null) => void;
  setChatStatus: (chatId: string, status: Chat["status"]) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  appendTokenDelta: (chatId: string, messageId: string, blockId: string, text: string) => void;
  addBlock: (chatId: string, messageId: string, block: MessageBlock) => void;
  updateBlock: (chatId: string, messageId: string, blockId: string, update: Partial<MessageBlock>) => void;
  setActiveTurn: (chatId: string, turnId: string | null) => void;
  updateChat: (chatId: string, update: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
}

export const EMPTY_MESSAGES: Message[] = [];

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  activeTurnId: {},

  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats] })),
  updateChat: (chatId, update) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, ...update } : c)),
    })),
  removeChat: (chatId) =>
    set((s) => {
      const remainingChats = s.chats.filter((c) => c.id !== chatId);
      const newMessages = { ...s.messages };
      delete newMessages[chatId];
      const newActiveTurn = { ...s.activeTurnId };
      delete newActiveTurn[chatId];
      return {
        chats: remainingChats,
        activeChatId: s.activeChatId === chatId ? (remainingChats[0]?.id || null) : s.activeChatId,
        messages: newMessages,
        activeTurnId: newActiveTurn,
      };
    }),
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  setChatStatus: (chatId, status) =>
    set((s) => {
      const isCompleted = status === "idle" || status === "error";
      const list = s.messages[chatId];
      const updatedMessages = isCompleted && list
        ? { ...s.messages, [chatId]: list.map((m) => m.streaming ? { ...m, streaming: false } : m) }
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

  appendTokenDelta: (chatId, messageId, _blockId, text) =>
    set((s) => {
      const list = s.messages[chatId] || [];
      const hasExactMatch = list.some((m) => m.id === messageId);
      const updated = list.map((m) => {
        const matches = hasExactMatch ? m.id === messageId : (m.streaming && m.role === "agent");
        if (!matches) return m;
        // Find existing text block or append to last
        const blocks = [...m.blocks];
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.type === "text") {
          blocks[blocks.length - 1] = {
            ...lastBlock,
            content: lastBlock.content + text
          };
        } else {
          blocks.push({
            type: "text",
            content: text
          });
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
        return { ...m, blocks: [...m.blocks, block] };
      });
      return {
        messages: { ...s.messages, [chatId]: updated }
      };
    }),

  updateBlock: (chatId, messageId, blockId, update) =>
    set((s) => {
      const list = s.messages[chatId] || [];
      const updated = list.map((m) => {
        if (m.id !== messageId) return m;
        const blocks = m.blocks.map((b) => {
          if ((b as any).id === blockId || (b as any).callId === blockId) {
            return { ...b, ...update } as MessageBlock;
          }
          return b;
        });
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
  setModels: (models: ModelInfo[], currentModel?: string, currentEffort?: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedEffort: (effort: string) => void;
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
  setOnModelChanged: (cb) => {
    onModelChangedCallback = cb;
  },
  setModels: (models, currentModel, currentEffort) => {
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

      return {
        models,
        selectedModel: activeModel,
        selectedEffort: activeEffort,
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
  setSelectedModel: (selectedModel) => {
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
      return { selectedModel, selectedEffort: activeEffort };
    });
    if (onModelChangedCallback) {
      onModelChangedCallback(selectedModel, finalEffort || undefined);
    }
  },
  setSelectedEffort: (selectedEffort) => {
    try {
      localStorage.setItem(STORAGE_KEY_EFFORT, selectedEffort);
    } catch {}
    set({ selectedEffort });
    if (onModelChangedCallback) {
      onModelChangedCallback(get().selectedModel, selectedEffort);
    }
  },
}));

export type RightTabType = "fileTree" | "terminal" | "filePreview" | "diff";

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


