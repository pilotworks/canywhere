import {
  RpcRequestEnvelope,
  RpcResponseEnvelope,
  RpcNotificationEnvelope,
  ApprovalDecision
} from "../types/index.js";
import { TokenStreamBuffer } from "./buffer.js";
import {
  useConnectionStore,
  useWorkspaceStore,
  useChatStore,
  useApprovalStore,
  useDeviceStore,
  useModelStore,
} from "../store/index.js";

export class CanywhereClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number | string, { resolve: (res: any) => void; reject: (err: any) => void }>();
  private reconnectTimer: any = null;
  private tokenBuffer: TokenStreamBuffer;
  private url: string;

  constructor(url: string = "ws://127.0.0.1:7890/rpc") {
    this.url = url;

    this.tokenBuffer = new TokenStreamBuffer((flushed) => {
      const append = useChatStore.getState().appendTokenDelta;
      for (const item of flushed) {
        append(item.chatId, item.messageId, item.blockId, item.text);
      }
    }, 24);

    useModelStore.getState().setOnModelChanged((model, effort) => {
      this.call("model.set", { model, reasoningEffort: effort }).catch((err) => {
        console.error("[CanywhereClient] Failed to set model", err);
      });
    });
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    useConnectionStore.getState().setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        useConnectionStore.getState().setStatus("connected");
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.bootstrap();
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          this.handleIncoming(raw);
        } catch (err) {
          console.error("[CanywhereClient] JSON parse error", err);
        }
      };

      this.ws.onclose = () => {
        useConnectionStore.getState().setStatus("disconnected");
        this.scheduleReconnect();
      };

      this.ws.onerror = (_err) => {
        useConnectionStore.getState().setStatus("error", "Connection failed");
      };
    } catch (err: any) {
      useConnectionStore.getState().setStatus("error", err.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private async bootstrap(): Promise<void> {
    try {
      const wsRes = await this.call("workspace.list", {});
      useWorkspaceStore.getState().setWorkspaces(wsRes.workspaces);

      const chatsRes = await this.call("chat.list", {});
      useChatStore.getState().setChats(chatsRes.chats);

      if (chatsRes.chats.length > 0 && !useChatStore.getState().activeChatId) {
        this.selectChat(chatsRes.chats[0].id);
      }

      const devRes = await this.call("device.list", {});
      useDeviceStore.getState().setDevices(devRes.devices);

      const modelRes = await this.call("model.list", {});
      if (modelRes.models) {
        useModelStore
          .getState()
          .setModels(
            modelRes.models,
            modelRes.currentModel,
            modelRes.currentReasoningEffort
          );
      }
    } catch (err) {
      console.error("[CanywhereClient] Bootstrap failed", err);
    }
  }

  async selectChat(chatId: string): Promise<void> {
    useChatStore.getState().setActiveChatId(chatId);
    try {
      const res = await this.call("chat.get", { chatId });
      if (res.chat) {
        useChatStore.getState().updateChat(chatId, { status: res.chat.status });
        if (res.chat.status === "idle" || res.chat.status === "error") {
          useChatStore.getState().setActiveTurn(chatId, null);
        }
      }
      const safeMessages = (res.messages || []).map((m: any) =>
        res.chat?.status === "idle" || res.chat?.status === "error"
          ? { ...m, streaming: false }
          : m
      );
      useChatStore.getState().setMessages(chatId, safeMessages);
      useApprovalStore.getState().setPendingApprovals(res.pendingApprovals);
    } catch (err) {
      console.error("[CanywhereClient] Failed to load chat history", err);
    }
  }

  async createWorkspace(name: string, rootPath: string, subPaths?: string[]): Promise<any> {
    const res = await this.call("workspace.create", {
      name,
      rootPath,
      subPaths,
      providerId: "codex"
    });
    useWorkspaceStore.getState().addWorkspace(res.workspace);
    return res.workspace;
  }

  async updateWorkspace(workspaceId: string, name?: string, rootPath?: string, subPaths?: string[]): Promise<any> {
    const res = await this.call("workspace.update", {
      workspaceId,
      name,
      rootPath,
      subPaths,
    });
    useWorkspaceStore.getState().updateWorkspace(workspaceId, res.workspace);
    return res.workspace;
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const res = await this.call("workspace.delete", { workspaceId });
    if (res.success) {
      useWorkspaceStore.getState().removeWorkspace(workspaceId);
      // Remove chats belonging to this workspace
      const chats = useChatStore.getState().chats.filter((c) => c.workspaceId !== workspaceId);
      useChatStore.getState().setChats(chats);
      if (useChatStore.getState().activeChatId) {
        const activeExists = chats.some((c) => c.id === useChatStore.getState().activeChatId);
        if (!activeExists) {
          useChatStore.getState().setActiveChatId(chats[0]?.id || null);
        }
      }
    }
    return res.success;
  }

  async getWorkspaceTree(workspaceId: string, subPath?: string, maxDepth: number = 3): Promise<any> {
    const res = await this.call("workspace.tree", {
      workspaceId,
      subPath,
      maxDepth,
    });
    return res.root;
  }

  async readWorkspaceFile(workspaceId: string, relativePath: string): Promise<{ path: string; content: string; size: number }> {
    return await this.call("workspace.readFile", {
      workspaceId,
      relativePath,
    });
  }

  async pickWorkspaceFolder(): Promise<string | null> {
    const res = await this.call("workspace.pickFolder", {});
    return res?.path || null;
  }

  async createChat(workspaceId?: string, title?: string, prompt?: string): Promise<any> {
    const res = await this.call("chat.create", {
      kind: workspaceId ? "workspace" : "standalone",
      workspaceId,
      providerId: "codex",
      title: title || "New Chat",
      initialPrompt: prompt
    });
    useChatStore.getState().addChat(res.chat);
    await this.selectChat(res.chat.id);
    return res.chat;
  }

  async sendTurn(chatId: string, content: string, model?: string): Promise<void> {
    try {
      const activeModel = model || useModelStore.getState().selectedModel || null;
      const activeEffort = useModelStore.getState().selectedEffort || null;
      const res = await this.call("turn.send", {
        chatId,
        content,
        model: activeModel,
        reasoningEffort: activeEffort,
      });

      useChatStore.getState().setActiveTurn(chatId, res.turnId);
    } catch (err: any) {
      console.error("[CanywhereClient] turn.send failed", err);
      useChatStore.getState().setChatStatus(chatId, "idle");
    }
  }

  async steerTurn(chatId: string, turnId: string, content: string): Promise<void> {
    await this.call("turn.steer", {
      chatId,
      turnId,
      content
    });
  }

  async interruptTurn(chatId: string, turnId?: string): Promise<void> {
    const activeTurnId = turnId || useChatStore.getState().activeTurnId[chatId] || "";
    try {
      await this.call("turn.interrupt", { chatId, turnId: activeTurnId });
    } catch (e) {
      console.warn("[CanywhereClient] turn.interrupt failed", e);
    }
    useChatStore.getState().setChatStatus(chatId, "idle");
    useChatStore.getState().setActiveTurn(chatId, null);
  }

  async deleteChat(chatId: string): Promise<void> {
    useChatStore.getState().removeChat(chatId);
    try {
      await this.call("chat.delete", { chatId });
    } catch (err) {
      console.error("[CanywhereClient] Failed to delete chat", err);
    }
  }

  async respondApproval(approvalId: string, decision: ApprovalDecision): Promise<void> {
    await this.call("approval.respond", { approvalId, decision });
    useApprovalStore.getState().removeApproval(approvalId);
  }

  async createPairingSession(): Promise<any> {
    const res = await this.call("pairing.createSession", {});
    useDeviceStore.getState().setQrPayload(res.qrPayload);
    await this.refreshDevices();
    return res.qrPayload;
  }

  async refreshDevices(): Promise<void> {
    try {
      const devRes = await this.call("device.list", {});
      useDeviceStore.getState().setDevices(devRes.devices || []);
    } catch (e) {
      console.error("Failed to refresh devices:", e);
    }
  }

  async revokeDevice(deviceId: string): Promise<void> {
    useDeviceStore.getState().removeDevice(deviceId);
    await this.call("device.revoke", { deviceId });
    await this.refreshDevices();
  }

  call(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not connected"));
      }

      const id = String(this.nextId++);
      this.pendingRequests.set(id, { resolve, reject });

      const envelope: RpcRequestEnvelope = {
        id,
        method,
        params
      };

      this.ws.send(JSON.stringify(envelope));
    });
  }

  private handleIncoming(raw: any): void {
    if (raw.id !== undefined && (raw.result !== undefined || raw.error !== undefined)) {
      const pending = this.pendingRequests.get(String(raw.id));
      if (pending) {
        this.pendingRequests.delete(String(raw.id));
        if (raw.error) {
          pending.reject(new Error(raw.error.message || "RPC Error"));
        } else {
          pending.resolve(raw.result);
        }
      }
      return;
    }

    if (raw.method && raw.params) {
      this.handleNotification(raw.method, raw.params);
    }
  }

  private handleNotification(method: string, params: any): void {
    switch (method) {
      case "message.created": {
        const { chatId, message } = params;
        const list = useChatStore.getState().messages[chatId] || [];
        if (!list.some((m) => m.id === message.id)) {
          useChatStore.getState().addMessage(chatId, message);
        }
        if (message.role === "agent" && message.streaming) {
          useChatStore.getState().setChatStatus(chatId, "running");
        }
        break;
      }

      case "message.delta": {
        this.tokenBuffer.append({
          chatId: params.chatId,
          messageId: params.messageId,
          blockId: "active",
          delta: params.delta.text
        });
        break;
      }

      case "tool.started": {
        this.tokenBuffer.flush();
        const messages = useChatStore.getState().messages[params.chatId] || [];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          useChatStore.getState().addBlock(params.chatId, lastMsg.id, params.block);
        }
        break;
      }

      case "tool.completed": {
        this.tokenBuffer.flush();
        const messages = useChatStore.getState().messages[params.chatId] || [];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          useChatStore.getState().updateBlock(params.chatId, lastMsg.id, params.block.id, params.block);
        }
        break;
      }

      case "approval.requested": {
        useApprovalStore.getState().addApproval(params.approval);
        useChatStore.getState().setChatStatus(params.chatId, "awaitingApproval");
        break;
      }

      case "turn.completed": {
        this.tokenBuffer.flush();
        useChatStore.getState().setChatStatus(params.chatId, params.status);
        useChatStore.getState().setActiveTurn(params.chatId, null);
        break;
      }

      case "chat.created": {
        const { chat } = params;
        const list = useChatStore.getState().chats;
        if (!list.some((c) => c.id === chat.id)) {
          useChatStore.getState().addChat(chat);
        }
        break;
      }

      case "chat.updated": {
        useChatStore.getState().updateChat(params.chatId, { title: params.title });
        break;
      }

      case "chat.deleted": {
        useChatStore.getState().removeChat(params.chatId);
        break;
      }

      case "model.updated": {
        useModelStore.getState().syncRemoteModel(params.model, params.reasoningEffort);
        break;
      }

      case "workspace.updated": {
        useWorkspaceStore.getState().updateWorkspace(params.workspace.id, params.workspace);
        break;
      }

      case "workspace.deleted": {
        const wsId = params.workspaceId;
        useWorkspaceStore.getState().removeWorkspace(wsId);
        const chats = useChatStore.getState().chats.filter((c) => c.workspaceId !== wsId);
        useChatStore.getState().setChats(chats);
        if (useChatStore.getState().activeChatId) {
          const activeExists = chats.some((c) => c.id === useChatStore.getState().activeChatId);
          if (!activeExists) {
            useChatStore.getState().setActiveChatId(chats[0]?.id || null);
          }
        }
        break;
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.tokenBuffer.destroy();
    if (this.ws) {
      // Avoid browser warning if closed during CONNECTING
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        // Delay close until open to prevent abrupt abortion warning
        const socketToClose = this.ws;
        socketToClose.onopen = () => socketToClose.close();
      }
      this.ws = null;
    }
  }
}

export const client = new CanywhereClient();
