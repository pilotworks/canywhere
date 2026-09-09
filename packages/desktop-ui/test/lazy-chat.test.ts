import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, useWorkspaceStore } from "../src/store/index.js";

describe("Lazy Chat Creation & Draft State", () => {
  beforeEach(() => {
    useChatStore.setState({
      chats: [],
      activeChatId: null,
      draftChat: null,
      draftPermissionMode: "onRequest",
      messages: {},
      activeTurnId: {},
    });
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Test Workspace",
          rootPath: "/path/to/test",
          subPaths: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeWorkspaceId: null,
    });
  });

  it("opens draft chat without modifying existing chats or creating a chat ID", () => {
    const { openDraftChat } = useChatStore.getState();

    openDraftChat("ws-1");

    const state = useChatStore.getState();
    expect(state.activeChatId).toBeNull();
    expect(state.draftChat).toEqual({ workspaceId: "ws-1" });
    expect(state.draftPermissionMode).toBe("onRequest");
    expect(state.chats).toHaveLength(0);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe("ws-1");
  });

  it("opens standalone draft chat when workspaceId is null", () => {
    const { openDraftChat } = useChatStore.getState();

    openDraftChat(null);

    const state = useChatStore.getState();
    expect(state.activeChatId).toBeNull();
    expect(state.draftChat).toEqual({ workspaceId: null });
    expect(state.chats).toHaveLength(0);
  });

  it("automatically clears draftChat when selecting an existing active chat", () => {
    const { openDraftChat, addChat, setActiveChatId } = useChatStore.getState();

    openDraftChat("ws-1");
    expect(useChatStore.getState().draftChat).not.toBeNull();

    const mockChat = {
      id: "chat-existing",
      workspaceId: "ws-1",
      providerId: "codex",
      kind: "workspace" as const,
      title: "Existing Chat",
      status: "idle" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addChat(mockChat);
    setActiveChatId("chat-existing");

    const state = useChatStore.getState();
    expect(state.activeChatId).toBe("chat-existing");
    expect(state.draftChat).toBeNull();
  });

  it("supports updating draftPermissionMode while in draft mode", () => {
    const { openDraftChat, setDraftPermissionMode } = useChatStore.getState();

    openDraftChat("ws-1");
    expect(useChatStore.getState().draftPermissionMode).toBe("onRequest");

    setDraftPermissionMode("auto");
    expect(useChatStore.getState().draftPermissionMode).toBe("auto");

    setDraftPermissionMode("readOnly");
    expect(useChatStore.getState().draftPermissionMode).toBe("readOnly");
  });

  it("falls back to draftChat when deleting the last remaining chat", () => {
    const { addChat, setActiveChatId, removeChat } = useChatStore.getState();

    const mockChat = {
      id: "chat-to-delete",
      workspaceId: "ws-1",
      providerId: "codex",
      kind: "workspace" as const,
      title: "Single Chat",
      status: "idle" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addChat(mockChat);
    setActiveChatId("chat-to-delete");

    removeChat("chat-to-delete");

    const state = useChatStore.getState();
    expect(state.chats).toHaveLength(0);
    expect(state.activeChatId).toBeNull();
    expect(state.draftChat).toEqual({ workspaceId: null });
  });

  it("correctly extracts concise chat title from the first prompt line", () => {
    const formatTitle = (text: string) => {
      const firstLine = text.split("\n")[0].trim();
      return firstLine.length > 40 ? firstLine.slice(0, 40).trim() + "..." : (firstLine || "New Chat");
    };

    expect(formatTitle("Hello world")).toBe("Hello world");
    expect(formatTitle("Refactor authentication service\nSecond line with details")).toBe("Refactor authentication service");
    expect(
      formatTitle("Please analyze this codebase and explain all the entrypoints and architectural boundaries")
    ).toBe("Please analyze this codebase and explain...");
    expect(formatTitle("   ")).toBe("New Chat");
  });
});
