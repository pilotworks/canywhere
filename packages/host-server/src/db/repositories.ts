import { Database } from "better-sqlite3";
import {
  Workspace,
  WorkspaceCreateInput,
  Chat,
  ChatCreateInput,
  Message,
  MessageBlock,
  ApprovalRequest,
  ApprovalDecision,
  Device
} from "@canywhere/protocol-schema";
import { nanoid } from "nanoid";

export interface PairingSessionRecord {
  id: string;
  token: string;
  secret: string;
  expiresAt: number;
  usedAt?: number;
  createdAt: number;
}

export class RepositoryManager {
  constructor(private db: Database) {}

  // Workspaces
  listWorkspaces(): Workspace[] {
    const rows = this.db.prepare("SELECT * FROM workspaces ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      rootPath: r.root_path,
      subPaths: JSON.parse(r.sub_paths_json),
      providerId: r.provider_id || "codex",
      createdAt: r.created_at,
      lastOpenedAt: r.updated_at
    }));
  }

  getWorkspace(id: string): Workspace | null {
    const r = this.db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      rootPath: r.root_path,
      subPaths: JSON.parse(r.sub_paths_json),
      providerId: r.provider_id || "codex",
      createdAt: r.created_at,
      lastOpenedAt: r.updated_at
    };
  }

  createWorkspace(input: WorkspaceCreateInput): Workspace {
    const id = nanoid();
    const now = Date.now();
    const subPaths = input.subPaths ?? [];
    this.db.prepare(`
      INSERT INTO workspaces (id, name, root_path, sub_paths_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.rootPath, JSON.stringify(subPaths), now, now);
    return {
      id,
      name: input.name,
      rootPath: input.rootPath,
      subPaths,
      providerId: input.providerId,
      createdAt: now,
      lastOpenedAt: now
    };
  }

  // Chats
  listChats(workspaceId?: string): Chat[] {
    let stmt;
    if (workspaceId) {
      stmt = this.db.prepare("SELECT * FROM chats WHERE workspace_id = ? ORDER BY updated_at DESC");
      return (stmt.all(workspaceId) as any[]).map(this.mapChatRow);
    }
    stmt = this.db.prepare("SELECT * FROM chats ORDER BY updated_at DESC");
    return (stmt.all() as any[]).map(this.mapChatRow);
  }

  getChat(id: string): Chat | null {
    const r = this.db.prepare("SELECT * FROM chats WHERE id = ?").get(id) as any;
    if (!r) return null;
    return this.mapChatRow(r);
  }

  createChat(input: ChatCreateInput & { scratchDir?: string }): Chat {
    const id = nanoid();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO chats (id, workspace_id, title, provider, kind, status, thread_id, model, scratch_dir, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.workspaceId ?? null,
      input.title ?? "New Chat",
      input.providerId,
      input.kind,
      "idle",
      null,
      null,
      input.scratchDir ?? null,
      now,
      now
    );
    return {
      id,
      workspaceId: input.workspaceId,
      title: input.title ?? "New Chat",
      providerId: input.providerId,
      kind: input.kind,
      status: "idle",
      createdAt: now,
      updatedAt: now
    };
  }

  updateChatStatus(id: string, status: Chat["status"], threadId?: string): void {
    const now = Date.now();
    if (threadId) {
      this.db.prepare(`
        UPDATE chats SET status = ?, thread_id = ?, updated_at = ? WHERE id = ?
      `).run(status, threadId, now, id);
    } else {
      this.db.prepare(`
        UPDATE chats SET status = ?, updated_at = ? WHERE id = ?
      `).run(status, now, id);
    }
  }

  deleteChat(id: string): void {
    this.db.prepare("DELETE FROM chats WHERE id = ?").run(id);
  }

  private mapChatRow(r: any): Chat {
    return {
      id: r.id,
      workspaceId: r.workspace_id ?? undefined,
      title: r.title,
      providerId: r.provider,
      kind: r.kind,
      status: r.status,
      externalThreadId: r.thread_id ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // Messages & MessageBlocks
  createMessage(chatId: string, role: Message["role"], turnId?: string, streaming: boolean = false): Message {
    const id = nanoid();
    const now = Date.now();
    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE chat_id = ?").get(chatId) as any;
    const sequence = (countRow?.count ?? 0) + 1;

    this.db.prepare(`
      INSERT INTO messages (id, chat_id, role, turn_id, sequence, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, chatId, role, turnId ?? null, sequence, now);

    return {
      id,
      chatId,
      role,
      turnId,
      blocks: [],
      createdAt: now,
      streaming
    };
  }

  createMessageBlock(messageId: string, block: MessageBlock, customBlockId?: string): { block: MessageBlock; blockId: string } {
    const id = customBlockId ?? nanoid();
    const now = Date.now();
    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM message_blocks WHERE message_id = ?").get(messageId) as any;
    const sequence = (countRow?.count ?? 0) + 1;

    const { type, ...payload } = block as any;
    this.db.prepare(`
      INSERT INTO message_blocks (id, message_id, sequence, block_type, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, messageId, sequence, type, JSON.stringify(payload), (block as any).status ?? "done", now, now);

    return { block, blockId: id };
  }

  updateMessageBlock(blockId: string, update: Partial<MessageBlock>): void {
    const now = Date.now();
    const existing = this.db.prepare("SELECT * FROM message_blocks WHERE id = ?").get(blockId) as any;
    if (!existing) return;

    const payload = JSON.parse(existing.payload_json);
    const { type, ...patchPayload } = update as any;
    const newPayload = { ...payload, ...patchPayload };

    this.db.prepare(`
      UPDATE message_blocks
      SET payload_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(newPayload), now, blockId);
  }

  getMessages(chatId: string): Message[] {
    const msgRows = this.db.prepare(`
      SELECT * FROM messages WHERE chat_id = ? ORDER BY sequence ASC
    `).all(chatId) as any[];

    if (msgRows.length === 0) return [];

    const blockRows = this.db.prepare(`
      SELECT mb.* FROM message_blocks mb
      JOIN messages m ON mb.message_id = m.id
      WHERE m.chat_id = ?
      ORDER BY mb.sequence ASC
    `).all(chatId) as any[];

    const blocksByMessageId = new Map<string, MessageBlock[]>();
    for (const b of blockRows) {
      const payload = JSON.parse(b.payload_json);
      const fullBlock = {
        type: b.block_type,
        ...payload
      } as unknown as MessageBlock;
      const list = blocksByMessageId.get(b.message_id) ?? [];
      list.push(fullBlock);
      blocksByMessageId.set(b.message_id, list);
    }

    return msgRows.map((m) => ({
      id: m.id,
      chatId: m.chat_id,
      role: m.role,
      turnId: m.turn_id ?? undefined,
      blocks: blocksByMessageId.get(m.id) ?? [],
      createdAt: m.created_at,
      streaming: false
    }));
  }

  // Approvals
  createApprovalRequest(req: Omit<ApprovalRequest, "status">): ApprovalRequest {
    this.db.prepare(`
      INSERT INTO approval_requests (id, chat_id, message_id, turn_id, call_id, approval_type, payload_json, risk_level, status, decision, created_at, decided_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.id,
      req.chatId,
      null,
      req.turnId,
      req.externalRequestId,
      req.kind,
      JSON.stringify(req.payload),
      req.payload.isHighRisk ? "critical" : "medium",
      "pending",
      null,
      req.requestedAt,
      null
    );
    return {
      ...req,
      status: "pending"
    };
  }

  getApprovalRequest(id: string): ApprovalRequest | null {
    const r = this.db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      chatId: r.chat_id,
      turnId: r.turn_id ?? "",
      externalRequestId: r.call_id,
      kind: r.approval_type,
      payload: JSON.parse(r.payload_json),
      status: r.status,
      requestedAt: r.created_at,
      resolvedAt: r.decided_at ?? undefined
    };
  }

  listPendingApprovals(chatId: string): ApprovalRequest[] {
    const rows = this.db.prepare("SELECT * FROM approval_requests WHERE chat_id = ? AND status = 'pending'").all(chatId) as any[];
    return rows.map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      turnId: r.turn_id ?? "",
      externalRequestId: r.call_id,
      kind: r.approval_type,
      payload: JSON.parse(r.payload_json),
      status: r.status,
      requestedAt: r.created_at
    }));
  }

  resolveApprovalRequest(id: string, decision: ApprovalDecision, _deviceId?: string, _deviceName?: string): void {
    const now = Date.now();
    const status = decision === "accept" || decision === "accept_for_session" ? "approved" : "denied";
    this.db.prepare(`
      UPDATE approval_requests
      SET status = ?, decision = ?, decided_at = ?
      WHERE id = ?
    `).run(status, decision, now, id);
  }

  // Devices & Pairing
  createPairingSession(token: string, secret: string, ttlMs: number = 300_000): PairingSessionRecord {
    const id = nanoid();
    const now = Date.now();
    const expiresAt = now + ttlMs;
    this.db.prepare(`
      INSERT INTO pairing_sessions (id, token, secret, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, token, secret, expiresAt, null, now);
    return { id, token, secret, expiresAt, createdAt: now };
  }

  getPairingSession(token: string): PairingSessionRecord | null {
    const r = this.db.prepare("SELECT * FROM pairing_sessions WHERE token = ?").get(token) as any;
    if (!r) return null;
    return {
      id: r.id,
      token: r.token,
      secret: r.secret,
      expiresAt: r.expires_at,
      usedAt: r.used_at ?? undefined,
      createdAt: r.created_at
    };
  }

  consumePairingSession(token: string): boolean {
    const now = Date.now();
    const res = this.db.prepare(`
      UPDATE pairing_sessions
      SET used_at = ?
      WHERE token = ? AND used_at IS NULL AND expires_at > ?
    `).run(now, token, now);
    return res.changes > 0;
  }

  registerDevice(device: Omit<Device, "pairedAt" | "lastSeenAt">): Device {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO devices (id, public_key, name, platform, paired_at, last_seen_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(public_key) DO UPDATE SET
        name = excluded.name,
        platform = excluded.platform,
        last_seen_at = excluded.last_seen_at,
        revoked_at = NULL
    `).run(device.id, device.publicKey, device.name, device.platform, now, now);
    return {
      ...device,
      pairedAt: now,
      lastSeenAt: now
    };
  }

  getDeviceByPublicKey(publicKey: string): Device | null {
    const r = this.db.prepare("SELECT * FROM devices WHERE public_key = ?").get(publicKey) as any;
    if (!r) return null;
    return {
      id: r.id,
      publicKey: r.public_key,
      name: r.name,
      platform: r.platform,
      pairedAt: r.paired_at,
      lastSeenAt: r.last_seen_at,
      lastTransport: "lan",
      revoked: r.revoked_at !== null
    };
  }

  listDevices(): Device[] {
    const rows = this.db.prepare("SELECT * FROM devices ORDER BY paired_at DESC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      publicKey: r.public_key,
      name: r.name,
      platform: r.platform,
      pairedAt: r.paired_at,
      lastSeenAt: r.last_seen_at,
      lastTransport: "lan",
      revoked: r.revoked_at !== null
    }));
  }

  revokeDevice(id: string): void {
    const now = Date.now();
    this.db.prepare("UPDATE devices SET revoked_at = ? WHERE id = ?").run(now, id);
  }
}
