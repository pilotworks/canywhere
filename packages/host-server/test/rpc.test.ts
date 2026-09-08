import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { EventEmitter } from "node:events";
import { initDatabase } from "../src/db/database.js";
import { RepositoryManager } from "../src/db/repositories.js";
import { PairingSecurityManager } from "../src/security/pairing.js";
import { HostServer } from "../src/server.js";
import { CliAdapter } from "../src/adapters/types.js";

class MockAdapter extends EventEmitter implements CliAdapter {
  async initialize(): Promise<void> {}
  async startThread(_options: any): Promise<{ threadId: string }> {
    return { threadId: "mock-thread-1" };
  }
  async submitTurn(_options: any): Promise<{ turnId: string }> {
    return { turnId: "mock-turn-1" };
  }
  async steerTurn(_options: any): Promise<void> {}
  async interruptTurn(_options: any): Promise<void> {}
  async respondApproval(_options: any): Promise<void> {}
  async dispose(): Promise<void> {}
}

describe("HostServer JSON-RPC & WebSocket", () => {
  let server: HostServer;
  let repo: RepositoryManager;
  let pairing: PairingSecurityManager;
  let adapter: MockAdapter;
  const testPort = 8999;

  beforeEach(async () => {
    const db = initDatabase(":memory:");
    repo = new RepositoryManager(db);
    pairing = new PairingSecurityManager(repo, testPort);
    adapter = new MockAdapter();

    server = new HostServer({
      port: testPort,
      repo,
      adapter,
      pairing,
      enableBonjour: false
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("should handle workspace.create and workspace.list over WebSocket RPC", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}/rpc`);
    await new Promise((res) => ws.on("open", res));

    const sendRpc = (method: string, params: any, id: number): Promise<any> => {
      return new Promise((resolve) => {
        const handler = (data: any) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            ws.off("message", handler);
            resolve(res);
          }
        };
        ws.on("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    // 1. Create Workspace
    const createRes = await sendRpc(
      "workspace.create",
      { name: "My Monorepo", rootPath: "/workspace/path", providerId: "codex" },
      1
    );
    expect(createRes.result.workspace.name).toBe("My Monorepo");

    // 2. List Workspaces
    const listRes = await sendRpc("workspace.list", {}, 2);
    expect(listRes.result.workspaces).toHaveLength(1);
    expect(listRes.result.workspaces[0].name).toBe("My Monorepo");

    ws.close();
  });

  it("should receive broadcast streaming events over WebSocket", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}/rpc`);
    await new Promise((res) => ws.on("open", res));

    const receivedNotifications: any[] = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (!msg.id && msg.method) {
        receivedNotifications.push(msg);
      }
    });

    // Emit token delta on adapter
    adapter.emit("tokenDelta", {
      chatId: "chat-1",
      messageId: "msg-1",
      blockId: "blk-1",
      delta: "Streaming token..."
    });

    // Wait short time for socket flush
    await new Promise((res) => setTimeout(res, 50));

    expect(receivedNotifications).toHaveLength(1);
    expect(receivedNotifications[0].method).toBe("message.delta");
    expect(receivedNotifications[0].params.delta.text).toBe("Streaming token...");

    ws.close();
  });
});
