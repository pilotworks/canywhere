import { create } from "zustand";
import {
  Workspace,
  Chat,
  Message,
  MessageBlock,
  ApprovalRequest,
  Device,
  PairingQrPayload
} from "@canywhere/protocol-schema";

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
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  setActiveWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set((s) => ({ workspaces: [workspace, ...s.workspaces] })),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId })
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
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  activeTurnId: {},

  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats] })),
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  setChatStatus: (chatId, status) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, status } : c))
    })),

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
      const updated = list.map((m) => {
        if (m.id !== messageId) return m;
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
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  qrPayload: null,
  setDevices: (devices) => set({ devices }),
  setQrPayload: (qrPayload) => set({ qrPayload })
}));
