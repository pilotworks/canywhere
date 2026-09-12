import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { groupMessageBlocks, MessageBlocksRenderer, partitionMessageBlocks } from "../src/components/chat/render-block.js";
import { extractReasoningHeader, ReasoningBlock } from "../src/components/chat/reasoning-block.js";
import { formatToolAction, summarizeToolGroup, formatWorkedDuration, isEditFileBlock } from "../src/components/chat/tool-formatting.js";
import { ToolCallGroup, FileDiffItem } from "../src/components/chat/tool-call-group.js";
import { ToolCallBlock } from "../src/components/chat/tool-call-block.js";
import { EditFileItem } from "../src/components/chat/edit-file-item.js";
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
    expect(action.isEdit).toBe(true);
  });

  it("extracts diff stats and unified patch for replace_file_content", () => {
    const action = formatToolAction({
      type: "tool_call",
      callId: "2-diff",
      name: "replace_file_content",
      args: {
        TargetFile: "/Users/dev/project/src/index.ts",
        TargetContent: "const a = 1;\nconst b = 2;",
        ReplacementContent: "const a = 10;\nconst b = 20;\nconst c = 30;",
        Description: "Update constants",
      },
      output: "ok",
      status: "completed",
    });
    expect(action.isEdit).toBe(true);
    expect(action.diffStats).toEqual({ added: 3, removed: 2 });
    expect(action.patch).toContain("-const a = 1;");
    expect(action.patch).toContain("+const a = 10;");
    expect(action.description).toBe("Update constants");
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

  it("renders ToolCallGroup open when active, showing tool calls inside", () => {
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

    const html = ReactDOMServer.renderToStaticMarkup(
      <ToolCallGroup blocks={blocks} isActive={true} />
    );
    // Should render group summary
    expect(html).toContain("Read 2 files");
    // When active, group is open and shows tool calls inside
    expect(html).toContain("first.ts");
    expect(html).toContain("last.ts");
  });

  it("MessageBlocksRenderer keeps last tool group open during streaming, and closes it when followed by text", () => {
    // 1. Tool group at end during streaming is active -> expanded
    const streamingWithActiveToolGroup: MessageBlock[] = [
      {
        type: "tool_call",
        callId: "1",
        name: "view_file",
        args: { path: "active1.ts" },
        output: null,
        status: "completed",
      },
      {
        type: "tool_call",
        callId: "2",
        name: "view_file",
        args: { path: "active2.ts" },
        output: null,
        status: "completed",
      },
    ];
    const htmlActive = ReactDOMServer.renderToStaticMarkup(
      <MessageBlocksRenderer blocks={streamingWithActiveToolGroup} isStreaming={true} />
    );
    expect(htmlActive).toContain("Read 2 files");
    expect(htmlActive).toContain("active1.ts");
    expect(htmlActive).toContain("active2.ts");

    // 2. Once followed by text, tool group is no longer the last group -> closes
    const streamingWithFinishedToolGroup: MessageBlock[] = [
      ...streamingWithActiveToolGroup,
      { type: "text", content: "Analysis complete." },
    ];
    const htmlClosed = ReactDOMServer.renderToStaticMarkup(
      <MessageBlocksRenderer blocks={streamingWithFinishedToolGroup} isStreaming={true} />
    );
    expect(htmlClosed).toContain("Read 2 files");
    expect(htmlClosed).not.toContain("active2.ts");
    expect(htmlClosed).toContain("Analysis complete.");
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

  it("isEditFileBlock correctly identifies edit tools and file_diff", () => {
    expect(
      isEditFileBlock({
        type: "tool_call",
        callId: "1",
        name: "replace_file_content",
        args: { TargetFile: "src/app.tsx" },
        output: null,
        status: "completed",
      })
    ).toBe(true);

    expect(
      isEditFileBlock({
        type: "tool_call",
        callId: "2",
        name: "write_to_file",
        args: { TargetFile: "src/utils.ts" },
        output: null,
        status: "completed",
      })
    ).toBe(true);

    expect(
      isEditFileBlock({
        type: "file_diff",
        path: "src/index.ts",
        patch: "+hello",
        status: "completed",
      })
    ).toBe(true);

    expect(
      isEditFileBlock({
        type: "tool_call",
        callId: "3",
        name: "view_file",
        args: { AbsolutePath: "src/app.tsx" },
        output: null,
        status: "completed",
      })
    ).toBe(false);

    expect(
      isEditFileBlock({
        type: "command_exec",
        command: "cargo test",
        cwd: "/",
        output: null,
        exitCode: 0,
        status: "completed",
      })
    ).toBe(false);
  });

  it("groupMessageBlocks does NOT merge edit file toolcalls into toolcall groups and breaks tool groups", () => {
    const blocks: MessageBlock[] = [
      {
        type: "tool_call",
        callId: "1",
        name: "view_file",
        args: { path: "a.ts" },
        output: null,
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
      // Edit file tool call: must be standalone and break group
      {
        type: "tool_call",
        callId: "3",
        name: "replace_file_content",
        args: {
          TargetFile: "c.ts",
          TargetContent: "old",
          ReplacementContent: "new",
        },
        output: "ok",
        status: "completed",
      },
      // Subsequent tool calls must start a new group
      {
        type: "command_exec",
        command: "npm test",
        cwd: "/",
        output: null,
        exitCode: 0,
        status: "completed",
      },
      {
        type: "tool_call",
        callId: "4",
        name: "grep_search",
        args: { Query: "test" },
        output: null,
        status: "completed",
      },
    ];

    const grouped = groupMessageBlocks(blocks);
    expect(grouped.length).toBe(3);

    // Group 1: initial 2 view_file calls
    expect(grouped[0].type).toBe("tool_group");
    if (grouped[0].type === "tool_group") {
      expect(grouped[0].blocks.length).toBe(2);
      expect(grouped[0].blocks[0].type).toBe("tool_call");
      expect((grouped[0].blocks[0] as any).name).toBe("view_file");
    }

    // Single: standalone edit file tool call
    expect(grouped[1].type).toBe("single");
    if (grouped[1].type === "single") {
      expect(grouped[1].block.type).toBe("tool_call");
      expect((grouped[1].block as any).name).toBe("replace_file_content");
    }

    // Group 2: subsequent command_exec + grep_search
    expect(grouped[2].type).toBe("tool_group");
    if (grouped[2].type === "tool_group") {
      expect(grouped[2].blocks.length).toBe(2);
    }
  });

  it("EditFileItem renders cleanly without box, border, padding, bg, and with (+green, -red) badge on right", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <EditFileItem
        filePath="/Users/dev/project/src/app.tsx"
        target="src/app.tsx"
        verb="Edited"
        diffStats={{ added: 15, removed: 4 }}
        status="completed"
      />
    );

    // Shows verb & target
    expect(html).toContain("Edited");
    expect(html).toContain("src/app.tsx");

    // Has no box, border, padding, bg (uses transparent, border-none, p-0)
    expect(html).toContain("bg-transparent");
    expect(html).toContain("border-none");
    expect(html).toContain("p-0");

    // Has NO ChevronRight icon (no expand/collapse view)
    expect(html).not.toContain("lucide-chevron-right");

    // Displays (+green, -red) on the right
    expect(html).toContain("+15");
    expect(html).toContain("-4");
    expect(html).toContain("text-emerald-400");
    expect(html).toContain("text-rose-400");
  });

  it("ToolCallBlock delegates edit tools to EditFileItem without collapsible trigger", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ToolCallBlock
        callId="edit-1"
        name="replace_file_content"
        args={{
          TargetFile: "src/button.tsx",
          TargetContent: "const a = 1;",
          ReplacementContent: "const a = 2;\nconst b = 3;",
        }}
        output="success"
        status="completed"
      />
    );

    expect(html).toContain("Edited");
    expect(html).toContain("src/button.tsx");
    expect(html).toContain("+2");
    expect(html).toContain("-1");
    // No chevron-right icon
    expect(html).not.toContain("lucide-chevron-right");
  });

  it("FileDiffItem renders EditFileItem with (+, -) badge", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <FileDiffItem
        block={{
          type: "file_diff",
          path: "src/header.tsx",
          patch: "--- a/src/header.tsx\n+++ b/src/header.tsx\n@@ -1,2 +1,3 @@\n-old\n+new1\n+new2",
          status: "completed",
        }}
      />
    );

    expect(html).toContain("Edited");
    expect(html).toContain("src/header.tsx");
    expect(html).toContain("+2");
    expect(html).toContain("-1");
    expect(html).toContain("text-emerald-400");
    expect(html).toContain("text-rose-400");
    expect(html).not.toContain("lucide-chevron-right");
  });
});
