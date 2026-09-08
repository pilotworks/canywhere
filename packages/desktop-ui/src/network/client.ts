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
        useModelStore.getState().setModels(modelRes.models);
      }
    } catch (err) {
      console.error("[CanywhereClient] Bootstrap failed", err);
    }
  }

  async selectChat(chatId: string): Promise<void> {
    useChatStore.getState().setActiveChatId(chatId);
    try {
      const res = await this.call("chat.get", { chatId });
      useChatStore.getState().setMessages(chatId, res.messages);
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
    const now = BigInt(Date.now());
    useChatStore.getState().addMessage(chatId, {
      id: "optimistic-" + Date.now(),
      chatId,
      turnId: null,
      role: "user",
      blocks: [{ type: "text", content }],
      createdAt: now,
      streaming: false
    });

    const agentMsgId = "stream-" + Date.now();
    useChatStore.getState().addMessage(chatId, {
      id: agentMsgId,
      chatId,
      turnId: null,
      role: "agent",
      blocks: [],
      createdAt: now,
      streaming: true
    });

    useChatStore.getState().setChatStatus(chatId, "running");

    const res = await this.call("turn.send", {
      chatId,
      content,
      model: model || useModelStore.getState().selectedModel,
    });

    useChatStore.getState().setActiveTurn(chatId, res.turnId);
  }

  async steerTurn(chatId: string, turnId: string, content: string): Promise<void> {
    const now = BigInt(Date.now());
    useChatStore.getState().addMessage(chatId, {
      id: "steer-" + Date.now(),
      chatId,
      turnId,
      role: "user",
      blocks: [{ type: "text", content: `[Steer] ${content}` }],
      createdAt: now,
      streaming: false
    });

    await this.call("turn.steer", {
      chatId,
      turnId,
      content
    });
  }

  async interruptTurn(chatId: string, turnId: string): Promise<void> {
    await this.call("turn.interrupt", { chatId, turnId });
    useChatStore.getState().setChatStatus(chatId, "idle");
  }

  async respondApproval(approvalId: string, decision: ApprovalDecision): Promise<void> {
    await this.call("approval.respond", { approvalId, decision });
    useApprovalStore.getState().removeApproval(approvalId);
  }

  async createPairingSession(): Promise<any> {
    const res = await this.call("pairing.createSession", {});
    useDeviceStore.getState().setQrPayload(res.qrPayload);
    return res.qrPayload;
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
