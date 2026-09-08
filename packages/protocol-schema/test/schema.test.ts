import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ProviderSchema,
  WorkspaceSchema,
  ChatSchema,
  MessageSchema,
  ApprovalRequestSchema,
  DeviceSchema,
  PairingQrPayloadSchema,
  RpcRequestEnvelopeSchema,
  RpcNotificationEnvelopeSchema,
  TurnStartedNotificationSchema,
  MessageDeltaNotificationSchema,
} from "../src/index.js";

describe("Protocol Schema Validations", () => {
  it("validates a Provider schema", () => {
    const provider = {
      id: "codex",
      name: "OpenAI Codex",
      version: "0.1.0",
      capabilities: {
        workspace: true,
        multiRoot: true,
        approvals: true,
        resumeThread: true,
        standaloneChat: true,
        steering: true,
      },
      status: "ready" as const,
    };
    expect(Value.Check(ProviderSchema, provider)).toBe(true);
  });

  it("validates a Workspace schema", () => {
    const workspace = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "canywhere",
      rootPath: "/Users/dev/canywhere",
      subPaths: ["/Users/dev/canywhere/packages/host-server"],
      providerId: "codex",
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    expect(Value.Check(WorkspaceSchema, workspace)).toBe(true);
  });

  it("validates a Chat schema", () => {
    const chat = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      kind: "workspace" as const,
      workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      providerId: "codex",
      title: "Fix authentication",
      status: "idle" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(Value.Check(ChatSchema, chat)).toBe(true);
  });

  it("validates a Message with polymorphic MessageBlocks", () => {
    const message = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      chatId: "550e8400-e29b-41d4-a716-446655440001",
      role: "agent" as const,
      blocks: [
        {
          type: "reasoning" as const,
          content: "Inspecting test cases...",
          completed: true,
        },
        {
          type: "text" as const,
          content: "I have identified the failing assertion.",
        },
        {
          type: "command_exec" as const,
          command: "cargo test",
          cwd: "/Users/dev/canywhere",
          output: "test result: ok",
          exitCode: 0,
          status: "completed" as const,
        },
        {
          type: "file_diff" as const,
          path: "src/auth.rs",
          patch: "@@ -1,3 +1,3 @@",
          status: "applied" as const,
        },
      ],
      createdAt: Date.now(),
      streaming: false,
    };
    expect(Value.Check(MessageSchema, message)).toBe(true);
  });

  it("validates an ApprovalRequest", () => {
    const approval = {
      id: "550e8400-e29b-41d4-a716-446655440003",
      chatId: "550e8400-e29b-41d4-a716-446655440001",
      turnId: "turn-101",
      externalRequestId: "req-42",
      kind: "command" as const,
      payload: {
        command: "rm -rf build/",
        cwd: "/Users/dev/canywhere",
        reason: "Clean output folder",
        isHighRisk: true,
      },
      status: "pending" as const,
      requestedAt: Date.now(),
    };
    expect(Value.Check(ApprovalRequestSchema, approval)).toBe(true);
  });

  it("validates Device and PairingQrPayload", () => {
    const device = {
      id: "dev-iphone",
      name: "Tien's iPhone",
      platform: "ios" as const,
      publicKey: "base64EncodedKey==",
      pairedAt: Date.now(),
      lastSeenAt: Date.now(),
      lastTransport: "lan" as const,
      revoked: false,
    };
    expect(Value.Check(DeviceSchema, device)).toBe(true);

    const qr = {
      hostId: "host-mac-mini",
      hostName: "Mac Mini Workstation",
      token: "secret-single-use-token",
      endpoints: ["192.168.1.100:7890", "mac-mini.ts.net:7890"],
      hostPublicKey: "hostBase64Key==",
      expiresAt: Date.now() + 300000,
    };
    expect(Value.Check(PairingQrPayloadSchema, qr)).toBe(true);
  });

  it("validates JSON-RPC wire envelopes and streaming notifications", () => {
    const req = {
      id: "req-1",
      method: "chat.turn.send",
      params: {
        chatId: "c-1",
        content: "Fix bug",
      },
    };
    expect(Value.Check(RpcRequestEnvelopeSchema, req)).toBe(true);

    const notif = {
      method: "chat.message.delta",
      params: {
        chatId: "c-1",
        turnId: "t-1",
        messageId: "m-1",
        delta: {
          type: "text",
          text: "Found the error.",
        },
      },
    };
    expect(Value.Check(RpcNotificationEnvelopeSchema, notif)).toBe(true);
    expect(Value.Check(MessageDeltaNotificationSchema, notif.params)).toBe(true);
  });
});
