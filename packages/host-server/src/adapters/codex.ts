import { EventEmitter } from "node:events";
import { spawn, ChildProcess } from "node:child_process";
import readline from "node:readline";
import { nanoid } from "nanoid";
import {
  CliAdapter,
  StartThreadOptions,
  SubmitTurnOptions,
  SteerTurnOptions,
  InterruptTurnOptions,
  RespondApprovalOptions
} from "./types.js";
import { ApprovalRequest } from "@canywhere/protocol-schema";

interface PendingRpc {
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class CodexAdapter extends EventEmitter implements CliAdapter {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextRpcId = 1;
  private pendingRpcs = new Map<number | string, PendingRpc>();
  private threadToChatMap = new Map<string, string>();
  private chatActiveTurnMap = new Map<string, { turnId: string; messageId: string }>();

  constructor(private codexBinary: string = "codex") {
    super();
  }

  async initialize(): Promise<void> {
    if (this.child) return;

    this.child = spawn(this.codexBinary, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env }
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to initialize codex app-server: stdio pipes not available");
    }

    this.rl = readline.createInterface({
      input: this.child.stdout,
      terminal: false
    });

    this.rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        this.handleIncomingMessage(msg);
      } catch (err) {
        console.error("Failed to parse NDJSON line from codex app-server:", line, err);
      }
    });

    this.child.stderr?.on("data", (data) => {
      console.warn(`[codex app-server stderr] ${data.toString()}`);
    });

    this.child.on("exit", (code, signal) => {
      this.child = null;
      this.emit("exit", { code, signal });
    });

    // Protocol Handshake
    await this.sendRpcRequest("initialize", {
      clientInfo: { name: "canywhere-host", version: "0.1.0" },
      capabilities: { experimentalApi: true }
    });

    this.sendNotification("initialized", {});
  }

  async startThread(options: StartThreadOptions): Promise<{ threadId: string }> {
    this.ensureInitialized();

    let threadId: string;
    if (options.existingThreadId) {
      const res = await this.sendRpcRequest("thread/resume", {
        threadId: options.existingThreadId,
        cwd: options.cwd
      });
      threadId = res.threadId || options.existingThreadId;
    } else {
      const res = await this.sendRpcRequest("thread/start", {
        cwd: options.cwd,
        model: options.model,
        runtimeWorkspaceRoots: options.subPaths
      });
      threadId = res.threadId;
    }

    this.threadToChatMap.set(threadId, options.chatId);
    this.emit("threadStarted", { chatId: options.chatId, threadId });
    return { threadId };
  }

  async submitTurn(options: SubmitTurnOptions): Promise<{ turnId: string }> {
    this.ensureInitialized();

    const res = await this.sendRpcRequest("turn/start", {
      threadId: options.threadId,
      input: [
        {
          type: "text",
          text: options.prompt
        }
      ]
    });

    const turnId = res.turnId;
    this.chatActiveTurnMap.set(options.chatId, { turnId, messageId: options.messageId });
    return { turnId };
  }

  async steerTurn(options: SteerTurnOptions): Promise<void> {
    this.ensureInitialized();
    await this.sendRpcRequest("turn/steer", {
      threadId: options.threadId,
      expectedTurnId: options.expectedTurnId,
      input: [
        {
          type: "text",
          text: options.feedback
        }
      ]
    });
  }

  async interruptTurn(options: InterruptTurnOptions): Promise<void> {
    this.ensureInitialized();
    await this.sendRpcRequest("turn/interrupt", {
      threadId: options.threadId,
      expectedTurnId: options.expectedTurnId
    });
  }

  async respondApproval(options: RespondApprovalOptions): Promise<void> {
    this.ensureInitialized();
    let decisionStr = "decline";
    if (options.decision === "accept" || options.decision === "accept_for_session") {
      decisionStr = "accept";
    }

    this.sendRpcResponse(options.callId, {
      decision: decisionStr
    });
  }

  async dispose(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  private handleIncomingMessage(msg: any): void {
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRpcs.get(msg.id);
      if (pending) {
        this.pendingRpcs.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    if (msg.id !== undefined && msg.method) {
      this.handleServerRequest(msg.id, msg.method, msg.params);
      return;
    }

    if (msg.method) {
      this.handleServerNotification(msg.method, msg.params);
    }
  }

  private handleServerRequest(id: string | number, method: string, params: any): void {
    const threadId = params?.threadId;
    const chatId = threadId ? this.threadToChatMap.get(threadId) : undefined;
    if (!chatId) return;

    if (method === "item/commandExecution/requestApproval") {
      const isHighRisk = this.assessHighRisk(params.command || "");
      const req: ApprovalRequest = {
        id: nanoid(),
        chatId,
        turnId: params.turnId || "",
        externalRequestId: String(id),
        kind: "command",
        payload: {
          command: params.command || "",
          cwd: params.cwd || "",
          reason: params.reason,
          isHighRisk
        },
        status: "pending",
        requestedAt: Date.now()
      };
      this.emit("approvalRequested", { chatId, request: req });
      return;
    }

    if (method === "item/fileChange/requestApproval") {
      const req: ApprovalRequest = {
        id: nanoid(),
        chatId,
        turnId: params.turnId || "",
        externalRequestId: String(id),
        kind: "file_change",
        payload: {
          path: params.path || params.filePath || "",
          diff: params.patch || params.diff || "",
          isHighRisk: false
        },
        status: "pending",
        requestedAt: Date.now()
      };
      this.emit("approvalRequested", { chatId, request: req });
      return;
    }
  }

  private handleServerNotification(method: string, params: any): void {
    const threadId = params?.threadId;
    const chatId = threadId ? this.threadToChatMap.get(threadId) : undefined;
    if (!chatId) return;

    const activeTurn = this.chatActiveTurnMap.get(chatId);

    // Streaming Deltas
    if (method === "item/agentMessage/delta") {
      const itemId = params.itemId || "active-text";
      const messageId = activeTurn?.messageId || "unknown-msg";
      this.emit("tokenDelta", {
        chatId,
        messageId,
        blockId: itemId,
        delta: params.delta || ""
      });
      return;
    }

    if (method === "item/reasoning/delta") {
      const itemId = params.itemId || "active-reasoning";
      const messageId = activeTurn?.messageId || "unknown-msg";
      this.emit("tokenDelta", {
        chatId,
        messageId,
        blockId: itemId,
        delta: params.delta || ""
      });
      return;
    }

    // Item Completed / Started
    if (method === "item/started") {
      const item = params.item;
      if (!item) return;
      const messageId = activeTurn?.messageId || "unknown-msg";

      if (item.type === "agentMessage") {
        this.emit("blockStarted", {
          chatId,
          messageId,
          block: {
            type: "text",
            content: item.text || ""
          }
        });
      } else if (item.type === "reasoning") {
        this.emit("blockStarted", {
          chatId,
          messageId,
          block: {
            type: "reasoning",
            content: item.text || "",
            completed: false
          }
        });
      } else if (item.type === "commandExecution") {
        this.emit("blockStarted", {
          chatId,
          messageId,
          block: {
            type: "command_exec",
            command: item.command || "",
            cwd: item.cwd || "",
            status: "running"
          }
        });
      }
      return;
    }

    if (method === "item/completed") {
      const item = params.item;
      if (!item) return;
      const messageId = activeTurn?.messageId || "unknown-msg";
      this.emit("blockCompleted", {
        chatId,
        messageId,
        blockId: item.id
      });
      return;
    }

    if (method === "turn/completed") {
      this.chatActiveTurnMap.delete(chatId);
      this.emit("turnCompleted", {
        chatId,
        turnId: params.turnId,
        status: params.status || "completed",
        error: params.error
      });
      return;
    }
  }

  private assessHighRisk(command: string): boolean {
    const cmd = command.toLowerCase();
    return (
      cmd.includes("rm -rf") ||
      cmd.includes("sudo") ||
      cmd.includes("mkfs") ||
      cmd.includes("dd if=") ||
      cmd.includes("git push -f") ||
      cmd.includes("git reset --hard")
    );
  }

  private sendRpcRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextRpcId++;
      this.pendingRpcs.set(id, { resolve, reject });
      this.writeJsonLine({
        jsonrpc: "2.0",
        id,
        method,
        params
      });
    });
  }

  private sendNotification(method: string, params: any): void {
    this.writeJsonLine({
      jsonrpc: "2.0",
      method,
      params
    });
  }

  private sendRpcResponse(id: string | number, result: any): void {
    this.writeJsonLine({
      jsonrpc: "2.0",
      id,
      result
    });
  }

  private writeJsonLine(obj: any): void {
    if (!this.child || !this.child.stdin || !this.child.stdin.writable) {
      throw new Error("Cannot write to codex app-server: process is not running or stdin closed");
    }
    this.child.stdin.write(JSON.stringify(obj) + "\n");
  }

  private ensureInitialized(): void {
    if (!this.child) {
      throw new Error("CodexAdapter is not initialized. Call initialize() first.");
    }
  }
}
