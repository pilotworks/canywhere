import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  RpcRequestEnvelope,
  RpcResponseEnvelope,
  WorkspaceListResult,
  WorkspaceTreeResult,
  ChatListResult,
  ChatGetResult,
  TurnSendResult,
  DeviceListResult,
  FileTreeNode
} from "@canywhere/protocol-schema";
import { RepositoryManager } from "../db/repositories.js";
import { CliAdapter } from "../adapters/types.js";
import { PairingSecurityManager } from "../security/pairing.js";

export class RpcDispatcher {
  constructor(
    private repo: RepositoryManager,
    private adapter: CliAdapter,
    private pairing: PairingSecurityManager
  ) {}

  async dispatch(request: RpcRequestEnvelope): Promise<RpcResponseEnvelope> {
    try {
      const result = await this.handleMethod(request.method, request.params as any);
      return {
        id: request.id,
        result
      };
    } catch (err: any) {
      return {
        id: request.id,
        error: {
          code: err.code || -32603,
          message: err.message || "Internal error",
          data: err.data
        }
      };
    }
  }

  private async handleMethod(method: string, params: any): Promise<any> {
    switch (method) {
      // Workspaces
      case "workspace.list": {
        const workspaces = this.repo.listWorkspaces();
        return { workspaces } satisfies WorkspaceListResult;
      }

      case "workspace.create": {
        const workspace = this.repo.createWorkspace(params);
        return { workspace };
      }

      case "workspace.tree": {
        const workspace = this.repo.getWorkspace(params.workspaceId);
        if (!workspace) throw new Error(`Workspace ${params.workspaceId} not found`);
        const rootPath = params.subPath ? path.join(workspace.rootPath, params.subPath) : workspace.rootPath;
        const root = this.scanDirectory(rootPath, params.maxDepth ?? 3);
        return { root } satisfies WorkspaceTreeResult;
      }

      // Chats
      case "chat.list": {
        const chats = this.repo.listChats(params?.workspaceId);
        return { chats } satisfies ChatListResult;
      }

      case "chat.create": {
        let scratchDir: string | undefined;
        let cwd: string;
        let subPaths: string[] | undefined;

        if (params.kind === "standalone") {
          scratchDir = path.join(os.homedir(), ".canywhere", "scratch", "codex", Date.now().toString());
          fs.mkdirSync(scratchDir, { recursive: true });
          cwd = scratchDir;
        } else {
          if (!params.workspaceId) throw new Error("workspaceId is required for workspace chat");
          const ws = this.repo.getWorkspace(params.workspaceId);
          if (!ws) throw new Error(`Workspace ${params.workspaceId} not found`);
          cwd = ws.rootPath;
          subPaths = ws.subPaths;
        }

        const chat = this.repo.createChat({
          ...params,
          scratchDir
        });

        // Initialize underlying thread in adapter
        const { threadId } = await this.adapter.startThread({
          chatId: chat.id,
          cwd,
          model: params.model,
          subPaths
        });

        this.repo.updateChatStatus(chat.id, "idle", threadId);
        chat.externalThreadId = threadId;

        // If initialPrompt is provided, auto-trigger first turn
        if (params.initialPrompt) {
          const userMsg = this.repo.createMessage(chat.id, "user");
          this.repo.createMessageBlock(userMsg.id, {
            type: "text",
            content: params.initialPrompt
          });

          const agentMsg = this.repo.createMessage(chat.id, "agent", undefined, true);
          this.repo.updateChatStatus(chat.id, "running");
          await this.adapter.submitTurn({
            chatId: chat.id,
            threadId,
            messageId: agentMsg.id,
            prompt: params.initialPrompt
          });
        }

        return { chat };
      }

      case "chat.get": {
        const chat = this.repo.getChat(params.chatId);
        if (!chat) throw new Error(`Chat ${params.chatId} not found`);
        const messages = this.repo.getMessages(params.chatId);
        const pendingApprovals = this.repo.listPendingApprovals(params.chatId);
        return { chat, messages, pendingApprovals } satisfies ChatGetResult;
      }

      case "chat.delete": {
        this.repo.deleteChat(params.chatId);
        return { success: true };
      }

      // Turn Execution
      case "turn.send": {
        const chat = this.repo.getChat(params.chatId);
        if (!chat) throw new Error(`Chat ${params.chatId} not found`);
        if (!chat.externalThreadId) throw new Error(`Chat ${params.chatId} has no active thread`);

        // Create user message
        const userMsg = this.repo.createMessage(chat.id, "user");
        this.repo.createMessageBlock(userMsg.id, {
          type: "text",
          content: params.content
        });

        // Create agent message to receive incoming token stream
        const agentMsg = this.repo.createMessage(chat.id, "agent", undefined, true);

        // Submit turn to adapter
        this.repo.updateChatStatus(chat.id, "running");
        const { turnId } = await this.adapter.submitTurn({
          chatId: chat.id,
          threadId: chat.externalThreadId,
          messageId: agentMsg.id,
          prompt: params.content
        });

        return {
          turnId,
          status: "running"
        } satisfies TurnSendResult;
      }

      case "turn.steer": {
        const chat = this.repo.getChat(params.chatId);
        if (!chat || !chat.externalThreadId) throw new Error(`Chat ${params.chatId} not found or has no active thread`);
        await this.adapter.steerTurn({
          chatId: chat.id,
          threadId: chat.externalThreadId,
          expectedTurnId: params.turnId,
          feedback: params.content
        });
        return { success: true };
      }

      case "turn.interrupt": {
        const chat = this.repo.getChat(params.chatId);
        if (!chat || !chat.externalThreadId) throw new Error(`Chat ${params.chatId} not found or has no active thread`);
        await this.adapter.interruptTurn({
          chatId: chat.id,
          threadId: chat.externalThreadId,
          expectedTurnId: params.turnId
        });
        this.repo.updateChatStatus(chat.id, "idle");
        return { success: true };
      }

      // Approvals
      case "approval.respond": {
        const req = this.repo.getApprovalRequest(params.approvalId);
        if (!req) throw new Error(`Approval request ${params.approvalId} not found`);
        if (req.status !== "pending") throw new Error(`Approval request ${params.approvalId} is already resolved`);

        await this.adapter.respondApproval({
          chatId: req.chatId,
          approvalId: req.id,
          callId: req.externalRequestId,
          decision: params.decision
        });

        this.repo.resolveApprovalRequest(req.id, params.decision);
        return { success: true };
      }

      // Devices
      case "device.list": {
        const devices = this.repo.listDevices();
        return { devices } satisfies DeviceListResult;
      }

      case "device.revoke": {
        this.repo.revokeDevice(params.deviceId);
        return { success: true };
      }

      // Pairing
      case "pairing.createSession": {
        const { qrPayload } = this.pairing.createPairingSession();
        return { qrPayload };
      }

      case "pairing.verify": {
        const validToken = this.pairing.verifyPairingToken(params.token);
        if (!validToken) throw new Error("Invalid or expired pairing token");

        const validSig = await this.pairing.verifyDeviceSignature(
          params.devicePublicKey,
          params.token,
          params.signature
        );
        if (!validSig) throw new Error("Invalid device signature challenge");

        await this.pairing.registerPairedDevice({
          id: params.deviceId,
          publicKey: params.devicePublicKey,
          name: params.deviceName,
          platform: params.platform,
          lastTransport: "lan",
          revoked: false
        });

        return {
          status: "paired",
          hostId: this.pairing.getHostId(),
          authToken: "mock-auth-token"
        };
      }

      default:
        throw { code: -32601, message: `Method '${method}' not found` };
    }
  }

  private scanDirectory(dir: string, depthRemaining: number): FileTreeNode {
    const stat = fs.statSync(dir);
    const isDir = stat.isDirectory();
    const node: FileTreeNode = {
      name: path.basename(dir),
      path: dir,
      isDirectory: isDir,
      size: isDir ? undefined : stat.size
    };

    if (isDir && depthRemaining > 0) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const children: FileTreeNode[] = [];
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "target") continue;
          const fullPath = path.join(dir, entry.name);
          children.push(this.scanDirectory(fullPath, depthRemaining - 1));
        }
        node.children = children;
      } catch {
        node.children = [];
      }
    }

    return node;
  }
}
