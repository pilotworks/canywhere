import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { useChatStore } from "../src/store/index";
import { QueueTray } from "../src/components/chat/queue-tray";
import { QueuedMessage } from "../src/types/index";

describe("Chat Message Queue Store & Tray", () => {
  beforeEach(() => {
    useChatStore.setState({
      chats: [{ id: "chat-1", title: "Test Chat", status: "running", createdAt: 1, updatedAt: 1 }],
      activeChatId: "chat-1",
      activeTurnId: { "chat-1": "turn-123" },
      queuedMessages: {},
    });
  });

  it("enqueues prompts sequentially in FIFO order", () => {
    const item1 = useChatStore.getState().enqueueMessage("chat-1", "Prompt 1", "gpt-5-codex", "medium", "onRequest");
    const item2 = useChatStore.getState().enqueueMessage("chat-1", "Prompt 2", "gpt-5-codex", "medium", "auto");

    const queue = useChatStore.getState().queuedMessages["chat-1"];
    expect(queue).toHaveLength(2);
    expect(queue[0].content).toBe("Prompt 1");
    expect(queue[1].content).toBe("Prompt 2");
    expect(queue[0].id).toBe(item1.id);
    expect(queue[1].id).toBe(item2.id);
  });

  it("removes a queued item by ID", () => {
    const item1 = useChatStore.getState().enqueueMessage("chat-1", "Prompt 1");
    const item2 = useChatStore.getState().enqueueMessage("chat-1", "Prompt 2");

    useChatStore.getState().removeQueuedMessage("chat-1", item1.id);

    const queue = useChatStore.getState().queuedMessages["chat-1"];
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(item2.id);
  });

  it("updates queued item content in place", () => {
    const item1 = useChatStore.getState().enqueueMessage("chat-1", "Original Prompt");
    useChatStore.getState().updateQueuedMessage("chat-1", item1.id, "Updated Prompt Content");

    const queue = useChatStore.getState().queuedMessages["chat-1"];
    expect(queue[0].content).toBe("Updated Prompt Content");
  });

  it("shifts next queued message in FIFO order and returns null when exhausted", () => {
    useChatStore.getState().enqueueMessage("chat-1", "First");
    useChatStore.getState().enqueueMessage("chat-1", "Second");

    const popped1 = useChatStore.getState().shiftNextQueuedMessage("chat-1");
    expect(popped1?.content).toBe("First");
    expect(useChatStore.getState().queuedMessages["chat-1"]).toHaveLength(1);

    const popped2 = useChatStore.getState().shiftNextQueuedMessage("chat-1");
    expect(popped2?.content).toBe("Second");
    expect(useChatStore.getState().queuedMessages["chat-1"]).toHaveLength(0);

    const popped3 = useChatStore.getState().shiftNextQueuedMessage("chat-1");
    expect(popped3).toBeNull();
  });

  it("clears queue when chat is removed", () => {
    useChatStore.getState().enqueueMessage("chat-1", "Task to clean up");
    expect(useChatStore.getState().queuedMessages["chat-1"]).toHaveLength(1);

    useChatStore.getState().removeChat("chat-1");
    expect(useChatStore.getState().queuedMessages["chat-1"]).toBeUndefined();
  });

  it("renders QueueTray with item count, Steer button, and prompt texts", () => {
    const mockItems: QueuedMessage[] = [
      {
        id: "q-1",
        chatId: "chat-1",
        content: "Write authentication unit tests",
        createdAt: Date.now(),
      },
      {
        id: "q-2",
        chatId: "chat-1",
        content: "Refactor database migrations",
        createdAt: Date.now() + 1000,
      },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QueueTray, {
        chatId: "chat-1",
        items: mockItems,
        isRunning: true,
        activeTurnId: "turn-active",
        onSteer: () => {},
        onEdit: () => {},
        onDelete: () => {},
      })
    );

    expect(html).toContain("In Queue (2)");
    expect(html).toContain("Write authentication unit tests");
    expect(html).toContain("Refactor database migrations");
    expect(html).toContain("Steer");
  });

  it("returns null from QueueTray when items list is empty", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QueueTray, {
        chatId: "chat-1",
        items: [],
        isRunning: false,
        onSteer: () => {},
        onEdit: () => {},
        onDelete: () => {},
      })
    );

    expect(html).toBe("");
  });
});
