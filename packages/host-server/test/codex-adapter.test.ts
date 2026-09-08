import { describe, it, expect } from "vitest";
import { CodexAdapter } from "../src/adapters/codex.js";

class TestCodexAdapter extends CodexAdapter {
  constructor() {
    super("mock");
  }

  feedMessage(msg: any) {
    (this as any).handleIncomingMessage(msg);
  }

  setThreadMapping(threadId: string, chatId: string) {
    (this as any).threadToChatMap.set(threadId, chatId);
  }

  setActiveTurn(chatId: string, turnId: string, messageId: string) {
    (this as any).chatActiveTurnMap.set(chatId, { turnId, messageId });
  }
}

describe("CodexAdapter", () => {
  it("should parse streaming token deltas and emit tokenDelta events", () => {
    const adapter = new TestCodexAdapter();
    adapter.setThreadMapping("th-123", "chat-456");
    adapter.setActiveTurn("chat-456", "turn-1", "msg-789");

    const deltas: string[] = [];
    adapter.on("tokenDelta", (ev) => {
      deltas.push(ev.delta);
      expect(ev.chatId).toBe("chat-456");
      expect(ev.messageId).toBe("msg-789");
    });

    adapter.feedMessage({
      method: "item/agentMessage/delta",
      params: {
        threadId: "th-123",
        delta: "Hello "
      }
    });

    adapter.feedMessage({
      method: "item/agentMessage/delta",
      params: {
        threadId: "th-123",
        delta: "world!"
      }
    });

    expect(deltas).toEqual(["Hello ", "world!"]);
  });

  it("should map command execution approval request with risk assessment", () => {
    const adapter = new TestCodexAdapter();
    adapter.setThreadMapping("th-100", "chat-200");

    let receivedRequest: any = null;
    adapter.on("approvalRequested", (ev) => {
      receivedRequest = ev.request;
    });

    adapter.feedMessage({
      id: "req-42",
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "th-100",
        turnId: "turn-5",
        command: "rm -rf /tmp/data",
        cwd: "/tmp",
        reason: "Clean temporary files"
      }
    });

    expect(receivedRequest).toBeDefined();
    expect(receivedRequest.kind).toBe("command");
    expect(receivedRequest.externalRequestId).toBe("req-42");
    expect(receivedRequest.payload.command).toBe("rm -rf /tmp/data");
    expect(receivedRequest.payload.isHighRisk).toBe(true);
  });

  it("should map file change approval request", () => {
    const adapter = new TestCodexAdapter();
    adapter.setThreadMapping("th-100", "chat-200");

    let receivedRequest: any = null;
    adapter.on("approvalRequested", (ev) => {
      receivedRequest = ev.request;
    });

    adapter.feedMessage({
      id: "req-99",
      method: "item/fileChange/requestApproval",
      params: {
        threadId: "th-100",
        turnId: "turn-5",
        path: "src/main.rs",
        patch: "@@ -1 +1 @@\n-old\n+new"
      }
    });

    expect(receivedRequest).toBeDefined();
    expect(receivedRequest.kind).toBe("file_change");
    expect(receivedRequest.payload.path).toBe("src/main.rs");
  });
});
