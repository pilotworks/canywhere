import { describe, it, expect, beforeEach } from "vitest";
import { initDatabase } from "../src/db/database.js";
import { RepositoryManager } from "../src/db/repositories.js";

describe("Database & Repositories", () => {
  let repo: RepositoryManager;

  beforeEach(() => {
    const db = initDatabase(":memory:");
    repo = new RepositoryManager(db);
  });

  it("should create and list workspaces", () => {
    const ws = repo.createWorkspace({
      name: "Test Project",
      rootPath: "/path/to/project",
      subPaths: ["packages/core"],
      providerId: "codex"
    });

    expect(ws.id).toBeDefined();
    expect(ws.name).toBe("Test Project");
    expect(ws.subPaths).toEqual(["packages/core"]);

    const list = repo.listWorkspaces();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(ws.id);
  });

  it("should create chats, messages and message blocks", () => {
    const ws = repo.createWorkspace({
      name: "Workspace A",
      rootPath: "/tmp/a",
      providerId: "codex"
    });

    const chat = repo.createChat({
      workspaceId: ws.id,
      title: "Fix bug",
      providerId: "codex",
      kind: "workspace"
    });

    expect(chat.status).toBe("idle");

    const userMsg = repo.createMessage(chat.id, "user");
    repo.createMessageBlock(userMsg.id, {
      type: "text",
      content: "Hello Codex"
    });

    const agentMsg = repo.createMessage(chat.id, "agent");
    const { blockId } = repo.createMessageBlock(agentMsg.id, {
      type: "reasoning",
      content: "Thinking...",
      completed: false
    });

    repo.updateMessageBlock(blockId, {
      content: "Thinking completed",
      completed: true
    });

    const messages = repo.getMessages(chat.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].blocks[0]).toMatchObject({
      type: "text",
      content: "Hello Codex"
    });
    expect(messages[1].blocks[0]).toMatchObject({
      type: "reasoning",
      content: "Thinking completed",
      completed: true
    });
  });

  it("should manage pairing sessions and device registrations", () => {
    const session = repo.createPairingSession("token123", "secret456", 5000);
    expect(session.token).toBe("token123");

    const found = repo.getPairingSession("token123");
    expect(found?.secret).toBe("secret456");

    // Single use check
    const consumed1 = repo.consumePairingSession("token123");
    expect(consumed1).toBe(true);

    const consumed2 = repo.consumePairingSession("token123");
    expect(consumed2).toBe(false);

    // Register device
    const device = repo.registerDevice({
      id: "dev-1",
      publicKey: "pubkey-abc",
      name: "iPhone 16 Pro",
      platform: "ios",
      lastTransport: "lan",
      revoked: false
    });
    expect(device.publicKey).toBe("pubkey-abc");

    const fetched = repo.getDeviceByPublicKey("pubkey-abc");
    expect(fetched?.name).toBe("iPhone 16 Pro");
    expect(fetched?.revoked).toBe(false);

    // Revocation
    repo.revokeDevice("dev-1");
    const revoked = repo.getDeviceByPublicKey("pubkey-abc");
    expect(revoked?.revoked).toBe(true);
  });
});
