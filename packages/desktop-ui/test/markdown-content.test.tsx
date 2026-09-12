import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { MarkdownContent } from "../src/components/chat/markdown-content";

describe("MarkdownContent", () => {
  it("renders inline code as inline badge without code block card", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <MarkdownContent content="Here is `inline_func()` in text." />
    );
    expect(html).toContain("<code");
    expect(html).toContain("inline_func()");
    expect(html).not.toContain("Copy snippet");
    expect(html).not.toContain("shadow-xs");
  });

  it("renders single-line code block without language as a full code block card", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <MarkdownContent content={"```\ncargo build\n```"} />
    );
    expect(html).toContain("Copy snippet");
    expect(html).toContain("cargo build");
    expect(html).toContain("shadow-xs");
    expect(html).not.toContain("<pre><div"); // No invalid nested pre > div
  });

  it("renders code block with language and header", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <MarkdownContent content={"```typescript\nconst x = 42;\n```"} />
    );
    expect(html).toContain("typescript");
    expect(html).toContain("const x = 42;");
    expect(html).toContain("Copy snippet");
    expect(html).not.toContain("Expand code");
    expect(html).not.toContain("max-h-[420px]");
    expect(html).toContain("overflow-x-auto");
  });

  it("renders long code block (>24 lines) with expand button and collapsed by default without vertical scroll", () => {
    const codeLines = Array.from({ length: 40 }, (_, i) => `console.log("line ${i + 1}");`).join("\n");
    const html = ReactDOMServer.renderToStaticMarkup(
      <MarkdownContent content={`\`\`\`typescript\n${codeLines}\n\`\`\``} />
    );
    expect(html).toContain("Expand code (+16 more lines)");
    expect(html).toContain("(40 lines)");
    expect(html).not.toContain("max-h-[420px]");
    expect(html).not.toContain("overflow-auto");
    expect(html).toContain("overflow-x-auto");
    // Verify collapsed preview renders only first 24 lines
    expect(html).toContain("line 1");
    expect(html).toContain("line 24");
    expect(html).not.toContain("line 25");
  });
});

import { RenderBlock } from "../src/components/chat/render-block";
import { useChatStore } from "../src/store/index";

describe("RenderBlock & Store fallback", () => {
  it("renders command_exec with collapsed output by default and proper status badge", () => {
    const htmlRunning = ReactDOMServer.renderToStaticMarkup(
      <RenderBlock
        block={{
          type: "command_exec",
          command: "cargo test",
          cwd: "/path/to/repo",
          output: "all tests passed",
          exitCode: null,
          status: "running",
        }}
      />
    );
    expect(htmlRunning).toContain("RUNNING");
    expect(htmlRunning).toContain("cargo test");
    // Collapsed by default, so output should not be rendered in static markup
    expect(htmlRunning).not.toContain("all tests passed");

    const htmlSuccess = ReactDOMServer.renderToStaticMarkup(
      <RenderBlock
        block={{
          type: "command_exec",
          command: "echo hello",
          cwd: "/path/to/repo",
          output: "hello\n",
          exitCode: 0,
          status: "completed",
        }}
      />
    );
    expect(htmlSuccess).toContain("EXIT 0");
    expect(htmlSuccess).not.toContain("hello\n");

    const htmlFailed = ReactDOMServer.renderToStaticMarkup(
      <RenderBlock
        block={{
          type: "command_exec",
          command: "false",
          cwd: "/path/to/repo",
          output: "error occurred",
          exitCode: 1,
          status: "failed",
        }}
      />
    );
    expect(htmlFailed).toContain("EXIT 1");
  });

  it("renders tool_call collapsed by default", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <RenderBlock
        block={{
          type: "tool_call",
          callId: "call-1",
          name: "fetch_data",
          args: { query: "test query" },
          output: "secret payload",
          status: "completed",
        }}
      />
    );
    expect(html).toContain("fetch_data");
    expect(html).toContain("test query");
    // Output should be collapsed by default
    expect(html).not.toContain("secret payload");
  });

  it("updates running block in chat store via fallback when blockId is not provided", () => {
    const store = useChatStore.getState();
    const chatId = "chat-test-fallback";
    const msgId = "msg-1";

    store.setMessages(chatId, [
      {
        id: msgId,
        chatId,
        role: "agent",
        streaming: true,
        createdAt: BigInt(Date.now()),
        blocks: [
          {
            type: "command_exec",
            command: "npm run build",
            cwd: "/tmp",
            output: null,
            exitCode: null,
            status: "running",
          },
        ],
      },
    ]);

    // Update with no blockId (undefined)
    store.updateBlock(chatId, msgId, undefined, {
      type: "command_exec",
      output: "build complete",
      exitCode: 0,
      status: "completed" as const,
    } as any);

    const updatedBlocks = useChatStore.getState().messages[chatId][0].blocks;
    expect(updatedBlocks[0]).toMatchObject({
      status: "completed",
      output: "build complete",
      exitCode: 0,
    });
  });
});
