import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { WebSocket } from "ws";
import { RpcRequestEnvelope, RpcNotificationEnvelope } from "@canywhere/protocol-schema";
import { RepositoryManager } from "./db/repositories.js";
import { CliAdapter } from "./adapters/types.js";
import { PairingSecurityManager } from "./security/pairing.js";
import { RpcDispatcher } from "./rpc/dispatcher.js";
import { BonjourAdvertiser } from "./discovery/bonjour.js";

export interface HostServerOptions {
  port?: number;
  host?: string;
  repo: RepositoryManager;
  adapter: CliAdapter;
  pairing: PairingSecurityManager;
  enableBonjour?: boolean;
}

export class HostServer {
  public app: FastifyInstance;
  private port: number;
  private host: string;
  private repo: RepositoryManager;
  private adapter: CliAdapter;
  private pairing: PairingSecurityManager;
  private dispatcher: RpcDispatcher;
  private bonjour: BonjourAdvertiser | null = null;
  private clients = new Set<WebSocket>();

  constructor(options: HostServerOptions) {
    this.port = options.port ?? 7890;
    this.host = options.host ?? "127.0.0.1";
    this.repo = options.repo;
    this.adapter = options.adapter;
    this.pairing = options.pairing;
    this.dispatcher = new RpcDispatcher(this.repo, this.adapter, this.pairing);

    if (options.enableBonjour) {
      this.bonjour = new BonjourAdvertiser({
        port: this.port,
        hostPublicKey: this.pairing.getHostPublicKey()
      });
    }

    this.app = Fastify({ logger: false });
    this.setupRoutes();
    this.subscribeAdapterEvents();
  }

  private setupRoutes(): void {
    this.app.register(cors, { origin: true });
    this.app.register(websocket);

    // Healthcheck endpoint
    this.app.get("/health", async () => {
      return {
        status: "ok",
        version: "0.1.0",
        hostPublicKey: this.pairing.getHostPublicKey()
      };
    });

    // Pairing QR info endpoint (useful for Desktop UI modal)
    this.app.post("/api/pairing/session", async () => {
      const { qrPayload } = this.pairing.createPairingSession();
      return qrPayload;
    });

    // WebSocket JSON-RPC endpoint
    this.app.register(async (fastify) => {
      fastify.get("/rpc", { websocket: true }, (socket) => {
        this.clients.add(socket);

        socket.on("message", async (data) => {
          try {
            const raw = data.toString();
            const json = JSON.parse(raw);

            // Check if it's a request
            if (json.method && json.id !== undefined) {
              const res = await this.dispatcher.dispatch(json as RpcRequestEnvelope);
              socket.send(JSON.stringify(res));
            }
          } catch {
            socket.send(
              JSON.stringify({
                id: null,
                error: { code: -32700, message: "Parse error" }
              })
            );
          }
        });

        socket.on("close", () => {
          this.clients.delete(socket);
        });
      });
    });
  }

  private subscribeAdapterEvents(): void {
    // 1. Token Deltas -> message.delta
    this.adapter.on("tokenDelta", (ev) => {
      this.broadcastNotification("message.delta", {
        chatId: ev.chatId,
        turnId: "turn-stream",
        messageId: ev.messageId,
        delta: {
          type: "text",
          text: ev.delta
        }
      });
    });

    // 2. Block Started -> tool.started
    this.adapter.on("blockStarted", (ev) => {
      const block = this.repo.createMessageBlock(ev.messageId, ev.block);
      this.broadcastNotification("tool.started", {
        chatId: ev.chatId,
        turnId: "turn-stream",
        block
      });
    });

    // 3. Block Completed -> tool.completed
    this.adapter.on("blockCompleted", (ev) => {
      this.broadcastNotification("tool.completed", {
        chatId: ev.chatId,
        turnId: "turn-stream",
        block: {
          id: ev.blockId,
          status: "done"
        }
      });
    });

    // 4. Approval Requested -> approval.requested
    this.adapter.on("approvalRequested", (ev) => {
      const req = this.repo.createApprovalRequest(ev.request);
      this.broadcastNotification("approval.requested", {
        chatId: ev.chatId,
        turnId: req.turnId,
        approval: req
      });
    });

    // 5. Turn Completed -> turn.completed
    this.adapter.on("turnCompleted", (ev) => {
      this.repo.updateChatStatus(ev.chatId, "idle");
      this.broadcastNotification("turn.completed", {
        chatId: ev.chatId,
        turnId: ev.turnId,
        status: ev.status === "completed" ? "idle" : "error"
      });
    });
  }

  private broadcastNotification(method: string, params: any): void {
    const payload: RpcNotificationEnvelope = {
      method,
      params
    };
    const str = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }

  async start(): Promise<string> {
    const addr = await this.app.listen({ port: this.port, host: this.host });
    this.bonjour?.start();
    return addr;
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    await this.bonjour?.stop();
    await this.app.close();
    await this.adapter.dispose();
  }
}
