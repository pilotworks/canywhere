import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { groupMessageBlocks, MessageBlocksRenderer, partitionMessageBlocks } from "../src/components/chat/render-block.js";
import { extractReasoningHeader, ReasoningBlock } from "../src/components/chat/reasoning-block.js";
import { formatToolAction, summarizeToolGroup, formatWorkedDuration } from "../src/components/chat/tool-formatting.js";
import { ToolCallGroup } from "../src/components/chat/tool-call-group.js";
import { MessageBlock } from "../src/types/index.js";

describe("Tool Call Formatting & Grouping", () => {
  it("formats file reading action correctly with filePath and lineRange", () => {
    const action = formatToolAction({
      type: "tool_call",
      callId: "1",
      name: "view_file",
      args: {
        AbsolutePath: "/Users/dev/project/src/components/button.tsx",
        StartLine: 10,
        EndLine: 25,
      },
      output: null,
      status: "completed",
    });
    expect(action.verb).toBe("Read");
    expect(action.target).toBe("components/button.tsx");
    expect(action.filePath).toBe("/Users/dev/project/src/components/button.tsx");
    expect(action.lineRange).toEqual({ start: 10, end: 25 });
  });

  it("formats file editing action correctly with filePath", () => {
    const action = formatToolAction({
      type: "tool_call",
      callId: "2",
      name: "replace_file_content",
      args: { TargetFile: "/Users/dev/project/src/index.ts" },
      output: null,
      status: "completed",
    });
    expect(action.verb).toBe("Edited");
    expect(action.target).toBe("src/index.ts");
    expect(action.filePath).toBe("/Users/dev/project/src/index.ts");
  });

  it("formats command execution action correctly", () => {
    const action = formatToolAction({
      type: "command_exec",
      command: "git status --short",
      cwd: "/repo",
      output: "M file.ts",
      exitCode: 0,
      status: "completed",
    });
    expect(action.verb).toBe("Ran");
    expect(action.target).toBe("$ git status --short");
  });

  it("formats grep search action correctly", () => {
    const action = formatToolAction({
      type: "tool_call",
      callId: "3",
      name: "grep_search",
      args: { Query: "handleSubmit" },
      output: null,
      status: "completed",
    });
    expect(action.verb).toBe("Searched");
    expect(action.target).toBe('"handleSubmit"');
  });

  it("formats codegraph exploration action correctly", () => {
    const action = formatToolAction({
      type: "tool_call",
      callId: "4",
      name: "codegraph_explore",
      args: { query: "ToolCallBlock" },
      output: null,
      status: "completed",
    });
    expect(action.verb).toBe("Explored");
    expect(action.target).toBe('"ToolCallBlock"');
  });

  it("formats list_dir action with DirectoryPath or toolSummary correctly", () => {
    const action1 = formatToolAction({
      type: "tool_call",
      callId: "5",
      name: "list_dir",
      args: { DirectoryPath: "/Users/dev/project/crates/canywhere-server" },
      output: null,
      status: "completed",
    });
    expect(action1.verb).toBe("Listed");
    expect(action1.target).toBe("crates/canywhere-server");

    const action2 = formatToolAction({
      type: "tool_call",
      callId: "6",
      name: "list_dir",
      args: { toolSummary: "Check workspace directory" },
      output: null,
      status: "running",
    });
    expect(action2.verb).toBe("Listing");
    expect(action2.target).toBe("Check workspace directory");
  });

  it("summarizes tool group containing list_dir and unknown tools without returning empty string", () => {
    const blocks: Array<Extract<MessageBlock, { type: "tool_call" | "command_exec" }>> = [
      { type: "tool_call", callId: "1", name: "list_dir", args: { DirectoryPath: "/repo" }, output: null, status: "completed" },
      { type: "tool_call", callId: "2", name: "list_dir", args: { DirectoryPath: "/repo/src" }, output: null, status: "completed" },
    ];
    expect(summarizeToolGroup(blocks)).toBe("Checked 2 directories");

    const unknownBlocks: Array<Extract<MessageBlock, { type: "tool_call" | "command_exec" }>> = [
      { type: "tool_call", callId: "3", name: "custom_special_tool", args: {}, output: null, status: "completed" },
    ];
    expect(summarizeToolGroup(unknownBlocks)).toBe("Called 1 tool");
  });

  it("correctly groups adjacent tool calls into tool_group", () => {
    const blocks: MessageBlock[] = [
      { type: "text", content: "Let me check the files." },
      {
        type: "tool_call",
        callId: "1",
        name: "view_file",
        args: { path: "a.ts" },
        output: null,
        status: "completed",
      },
      {
        type: "command_exec",
        command: "ls -la",
        cwd: "/",
        output: null,
        exitCode: 0,
        status: "completed",
      },
      {
        type: "tool_call",
        callId: "2",
        name: "view_file",
        args: { path: "b.ts" },
        output: null,
        status: "completed",
      },
      { type: "text", content: "Everything looks good." },
    ];

    const grouped = groupMessageBlocks(blocks);
    expect(grouped.length).toBe(3);
    expect(grouped[0].type).toBe("single");
    expect(grouped[1].type).toBe("tool_group");
    if (grouped[1].type === "tool_group") {
      expect(grouped[1].blocks.length).toBe(3);
    }
    expect(grouped[2].type).toBe("single");
  });

  it("summarizes tool group with action breakdown (explored X files, Y searches, ran Z commands)", () => {
    const blocks: Array<Extract<MessageBlock, { type: "tool_call" | "command_exec" }>> = [
      { type: "tool_call", callId: "1", name: "view_file", args: { path: "a.ts" }, output: null, status: "completed" },
      { type: "tool_call", callId: "2", name: "view_file", args: { path: "b.ts" }, output: null, status: "completed" },
      { type: "tool_call", callId: "3", name: "view_file", args: { path: "c.ts" }, output: null, status: "completed" },
      { type: "tool_call", callId: "4", name: "grep_search", args: { query: "foo" }, output: null, status: "completed" },
      { type: "tool_call", callId: "5", name: "grep_search", args: { query: "bar" }, output: null, status: "completed" },
      { type: "command_exec", command: "cargo build", cwd: "/", output: null, exitCode: 0, status: "completed" },
      { type: "command_exec", command: "cargo test", cwd: "/", output: null, exitCode: 0, status: "completed" },
    ];

    const summary = summarizeToolGroup(blocks);
    expect(summary).toBe("Read 3 files, 2 searches, ran 2 commands");
  });

  it("renders ToolCallGroup showing action breakdown summary directly when collapsed", () => {
    const blocks: Array<Extract<MessageBlock, { type: "tool_call" | "command_exec" }>> = [
      {
        type: "tool_call",
        callId: "1",
        name: "view_file",
        args: { path: "first.ts" },
        output: null,
        status: "completed",
      },
      {
        type: "tool_call",
        callId: "2",
        name: "view_file",
        args: { path: "last.ts" },
        output: null,
        status: "completed",
      },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(<ToolCallGroup blocks={blocks} />);
    // Should render the group summary directly
    expect(html).toContain("Read 2 files");
    // Should NOT render the last tool path in collapsed mode
    expect(html).not.toContain("last.ts");
  });

  it("formats worked duration correctly into Worked for XhXm, XmXs, or Xs", () => {
    expect(formatWorkedDuration(0)).toBe("Worked for 1s");
    expect(formatWorkedDuration(15)).toBe("Worked for 15s");
    expect(formatWorkedDuration(60)).toBe("Worked for 1m");
    expect(formatWorkedDuration(125)).toBe("Worked for 2m 05s");
    expect(formatWorkedDuration(3600)).toBe("Worked for 1h");
    expect(formatWorkedDuration(3665)).toBe("Worked for 1h 01m");
    expect(formatWorkedDuration(7320)).toBe("Worked for 2h 02m");
  });

  it("partitions message blocks into introBlocks, workBlocks and final response textBlocks", () => {
    const blocks: MessageBlock[] = [
      { type: "text", content: "Let me inspect the files and run tests first." },
      { type: "reasoning", content: "Thinking through the plan...", completed: true },
      { type: "tool_call", callId: "1", name: "view_file", args: { path: "main.ts" }, output: "ok", status: "completed" },
      { type: "command_exec", command: "npm test", cwd: "/", output: "pass", exitCode: 0, status: "completed" },
      { type: "text", content: "I have successfully verified the fix." },
    ];

    const partitioned = partitionMessageBlocks(blocks);
    expect(partitioned.introBlocks.length).toBe(1);
    expect(partitioned.introBlocks[0].type).toBe("text");
    if (partitioned.introBlocks[0].type === "text") {
      expect(partitioned.introBlocks[0].content).toBe("Let me inspect the files and run tests first.");
    }
    expect(partitioned.workBlocks.length).toBe(3);
    expect(partitioned.finalBlocks.length).toBe(1);
    expect(partitioned.finalBlocks[0].type).toBe("text");
    if (partitioned.finalBlocks[0].type === "text") {
      expect(partitioned.finalBlocks[0].content).toBe("I have successfully verified the fix.");
    }
  });

  it("renders Worked for group when completed, keeping both intro and final message outside", () => {
    const blocks: MessageBlock[] = [
      { type: "text", content: "Checking now..." },
      { type: "reasoning", content: "Thinking...", completed: true },
      { type: "tool_call", callId: "1", name: "view_file", args: { path: "main.ts" }, output: "ok", status: "completed" },
      { type: "text", content: "All done!" },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      <MessageBlocksRenderer blocks={blocks} isStreaming={false} durationSeconds={125} />
    );

    // Intro text message is directly rendered outside before Worked for
    expect(html).toContain("Checking now...");
    // Collapsed header shows Worked for 2m 05s
    expect(html).toContain("Worked for 2m 05s");
    // Final text message is directly rendered outside after Worked for
    expect(html).toContain("All done!");
  });

  it("renders blocks directly without WorkedForBlock while still live streaming", () => {
    const blocks: MessageBlock[] = [
      { type: "reasoning", content: "Thinking live...", completed: false },
      { type: "tool_call", callId: "1", name: "view_file", args: { path: "main.ts" }, output: null, status: "running" },
      { type: "text", content: "Streaming..." },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      <MessageBlocksRenderer blocks={blocks} isStreaming={true} durationSeconds={10} />
    );

    // Should NOT have Worked for header while streaming
    expect(html).not.toContain("Worked for");
    expect(html).toContain("Reading");
    expect(html).toContain("Streaming...");
  });

  it("extracts reasoning headers and formats reasoning block title cleanly", () => {
    expect(extractReasoningHeader("**Planning parallel command execution**\nChecking files")).toBe("Planning parallel command execution");
    expect(extractReasoningHeader("Planning targeted code inspection")).toBe("Planning targeted code inspection");
    expect(extractReasoningHeader("")).toBeNull();

    const htmlCompleted = ReactDOMServer.renderToStaticMarkup(
      <ReasoningBlock content="**Planning parallel command execution**" completed={true} />
    );
    expect(htmlCompleted).toContain("Planning parallel command execution");
    expect(htmlCompleted).not.toContain("animate-pulse");

    const htmlRunning = ReactDOMServer.renderToStaticMarkup(
      <ReasoningBlock content="**Planning parallel command execution**" completed={false} />
    );
    expect(htmlRunning).toContain("Thinking: Planning parallel command execution");
    expect(htmlRunning).toContain("animate-pulse");
  });
});
