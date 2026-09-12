import { MessageBlock } from "../../types/index.js";
import { LineRange } from "../../lib/file-link.js";

export interface FormattedToolAction {
  verb: string;
  target: string;
  isMono: boolean;
  fullSummary: string;
  filePath?: string;
  lineRange?: LineRange;
  isEdit?: boolean;
  diffStats?: { added: number; removed: number };
  patch?: string;
  description?: string;
}

function getShortPath(filePath: string): string {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return parts.join("/");
  return parts.slice(-2).join("/");
}

function truncateString(str: string, maxLen = 45): string {
  if (!str) return "";
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
}

export function formatToolAction(
  block: Extract<MessageBlock, { type: "tool_call" | "command_exec" }>
): FormattedToolAction {
  const isRunning = block.status === "running";

  if (block.type === "command_exec") {
    const cmd = truncateString(block.command, 50);
    return {
      verb: isRunning ? "Running" : "Ran",
      target: `$ ${cmd}`,
      isMono: true,
      fullSummary: `${isRunning ? "Running" : "Ran"} $ ${cmd}`,
    };
  }

  // Tool Call block
  const name = block.name || "tool";
  const lower = name.toLowerCase();
  const rawArgs = block.args;
  let argsObj: Record<string, any> = {};

  if (typeof rawArgs === "string") {
    try {
      argsObj = JSON.parse(rawArgs);
    } catch {
      argsObj = { raw: rawArgs };
    }
  } else if (typeof rawArgs === "object" && rawArgs !== null) {
    argsObj = rawArgs as Record<string, any>;
  }

  // 1. Directory Listing (list_dir, ls, dir)
  if (
    lower === "list_dir" ||
    lower.includes("list_dir") ||
    lower === "dir" ||
    lower === "ls"
  ) {
    const rawPath =
      argsObj.DirectoryPath ||
      argsObj.directory_path ||
      argsObj.path ||
      argsObj.dir ||
      "";
    const shortPath = getShortPath(String(rawPath));
    const target = shortPath || (argsObj.toolSummary ? String(argsObj.toolSummary) : "directory");
    return {
      verb: isRunning ? "Listing" : "Listed",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Listing" : "Listed"} ${target}`,
    };
  }

  // 2. File Reading
  if (
    lower.includes("read") ||
    lower.includes("view") ||
    lower === "cat" ||
    lower === "fetch_file"
  ) {
    const rawPath =
      argsObj.AbsolutePath ||
      argsObj.absolute_path ||
      argsObj.path ||
      argsObj.filePath ||
      argsObj.file ||
      argsObj.TargetFile ||
      "";
    const shortPath = getShortPath(String(rawPath));
    const target = shortPath || (argsObj.toolSummary ? String(argsObj.toolSummary) : name);

    let lineRange: LineRange | undefined;
    const startLine = argsObj.StartLine ?? argsObj.start_line ?? argsObj.startLine ?? argsObj.line;
    const endLine = argsObj.EndLine ?? argsObj.end_line ?? argsObj.endLine;
    if (typeof startLine === "number" || (typeof startLine === "string" && !isNaN(parseInt(startLine, 10)))) {
      const start = typeof startLine === "number" ? startLine : parseInt(startLine, 10);
      const end = typeof endLine === "number" ? endLine : (typeof endLine === "string" && !isNaN(parseInt(endLine, 10)) ? parseInt(endLine, 10) : undefined);
      lineRange = { start, end };
    }

    return {
      verb: isRunning ? "Reading" : "Read",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Reading" : "Read"} ${target}`,
      filePath: rawPath ? String(rawPath) : undefined,
      lineRange,
    };
  }

  // 3. File Writing / Editing
  if (
    lower.includes("write") ||
    lower.includes("edit") ||
    lower.includes("replace") ||
    lower.includes("patch")
  ) {
    const rawPath =
      argsObj.TargetFile ||
      argsObj.target_file ||
      argsObj.targetFile ||
      argsObj.AbsolutePath ||
      argsObj.absolute_path ||
      argsObj.path ||
      argsObj.filePath ||
      argsObj.file_path ||
      argsObj.file ||
      (Array.isArray(argsObj.changes) && argsObj.changes[0]?.path) ||
      "";
    const shortPath = getShortPath(String(rawPath));
    const target = shortPath || (argsObj.toolSummary ? String(argsObj.toolSummary) : name);

    let lineRange: LineRange | undefined;
    const startLine = argsObj.StartLine ?? argsObj.start_line ?? argsObj.startLine;
    const endLine = argsObj.EndLine ?? argsObj.end_line ?? argsObj.endLine;
    if (typeof startLine === "number" || (typeof startLine === "string" && !isNaN(parseInt(startLine, 10)))) {
      const start = typeof startLine === "number" ? startLine : parseInt(startLine, 10);
      const end = typeof endLine === "number" ? endLine : (typeof endLine === "string" && !isNaN(parseInt(endLine, 10)) ? parseInt(endLine, 10) : undefined);
      lineRange = { start, end };
    }

    let diffStats: { added: number; removed: number } | undefined;
    let patch: string | undefined;

    const description =
      typeof argsObj.Description === "string"
        ? argsObj.Description
        : typeof argsObj.description === "string"
        ? argsObj.description
        : typeof argsObj.Instruction === "string"
        ? argsObj.Instruction
        : typeof argsObj.instruction === "string"
        ? argsObj.instruction
        : undefined;

    const directPatch =
      (typeof argsObj.patch === "string" && argsObj.patch.trim() ? argsObj.patch : "") ||
      (typeof argsObj.diff === "string" && argsObj.diff.trim() ? argsObj.diff : "") ||
      (typeof argsObj.unified_diff === "string" && argsObj.unified_diff.trim() ? argsObj.unified_diff : "") ||
      (typeof argsObj.unifiedDiff === "string" && argsObj.unifiedDiff.trim() ? argsObj.unifiedDiff : "");

    const changePatch =
      Array.isArray(argsObj.changes) && argsObj.changes.length > 0
        ? argsObj.changes[0]?.diff || argsObj.changes[0]?.patch || ""
        : "";

    const outputPatch =
      typeof block.output === "string" &&
      (block.output.includes("@@ -") || block.output.startsWith("---") || block.output.startsWith("diff --git"))
        ? block.output
        : "";

    const targetContent =
      typeof argsObj.TargetContent === "string"
        ? argsObj.TargetContent
        : typeof argsObj.target_content === "string"
        ? argsObj.target_content
        : typeof argsObj.targetContent === "string"
        ? argsObj.targetContent
        : typeof argsObj.old_string === "string"
        ? argsObj.old_string
        : typeof argsObj.old_str === "string"
        ? argsObj.old_str
        : typeof argsObj.oldString === "string"
        ? argsObj.oldString
        : typeof argsObj.find === "string"
        ? argsObj.find
        : undefined;

    const replacementContent =
      typeof argsObj.ReplacementContent === "string"
        ? argsObj.ReplacementContent
        : typeof argsObj.replacement_content === "string"
        ? argsObj.replacement_content
        : typeof argsObj.replacementContent === "string"
        ? argsObj.replacementContent
        : typeof argsObj.new_string === "string"
        ? argsObj.new_string
        : typeof argsObj.new_str === "string"
        ? argsObj.new_str
        : typeof argsObj.newString === "string"
        ? argsObj.newString
        : typeof argsObj.replace === "string"
        ? argsObj.replace
        : undefined;

    const codeContent =
      typeof argsObj.CodeContent === "string"
        ? argsObj.CodeContent
        : typeof argsObj.code_content === "string"
        ? argsObj.code_content
        : typeof argsObj.codeContent === "string"
        ? argsObj.codeContent
        : typeof argsObj.content === "string"
        ? argsObj.content
        : typeof argsObj.contents === "string"
        ? argsObj.contents
        : typeof argsObj.text === "string"
        ? argsObj.text
        : undefined;

    const foundPatch = directPatch || changePatch || outputPatch;

    if (foundPatch) {
      patch = foundPatch;
      const lines = foundPatch.split(/\r?\n/);
      const added = lines.filter((l: string) => l.startsWith("+") && !l.startsWith("+++")).length;
      const removed = lines.filter((l: string) => l.startsWith("-") && !l.startsWith("---")).length;
      diffStats = { added, removed };
    } else if (targetContent !== undefined || replacementContent !== undefined) {
      const oldLines = targetContent ? targetContent.split(/\r?\n/) : [];
      const newLines = replacementContent ? replacementContent.split(/\r?\n/) : [];
      diffStats = { added: newLines.length, removed: oldLines.length };
      const file = rawPath ? String(rawPath).split("/").pop() || "file" : "file";
      let p = `--- a/${file}\n+++ b/${file}\n`;
      for (const line of oldLines) {
        p += `-${line}\n`;
      }
      for (const line of newLines) {
        p += `+${line}\n`;
      }
      patch = p.replace(/\n$/, "");
    } else if (codeContent !== undefined) {
      const newLines = codeContent ? codeContent.split(/\r?\n/) : [];
      diffStats = { added: newLines.length, removed: 0 };
      const file = rawPath ? String(rawPath).split("/").pop() || "file" : "file";
      let p = `--- /dev/null\n+++ b/${file}\n`;
      for (const line of newLines) {
        p += `+${line}\n`;
      }
      patch = p.replace(/\n$/, "");
    }

    return {
      verb: isRunning ? "Editing" : "Edited",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Editing" : "Edited"} ${target}`,
      filePath: rawPath ? String(rawPath) : undefined,
      lineRange,
      isEdit: true,
      diffStats,
      patch,
      description,
    };
  }

  // 4. Command / Terminal Execution
  if (
    lower.includes("command") ||
    lower.includes("bash") ||
    lower.includes("exec") ||
    lower.includes("terminal") ||
    lower.includes("shell")
  ) {
    const cmd =
      argsObj.CommandLine ||
      argsObj.command ||
      argsObj.cmd ||
      argsObj.script ||
      "";
    const truncatedCmd = truncateString(String(cmd), 50);
    const target = truncatedCmd ? `$ ${truncatedCmd}` : (argsObj.toolSummary ? String(argsObj.toolSummary) : name);
    return {
      verb: isRunning ? "Running" : "Ran",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Running" : "Ran"} ${target}`,
    };
  }

  // 5. CodeGraph Exploration / Search
  if (lower.includes("codegraph_explore") || lower.includes("explore")) {
    const query = argsObj.query || argsObj.Query || "";
    const truncatedQuery = truncateString(String(query), 45);
    const target = truncatedQuery ? `"${truncatedQuery}"` : "";
    return {
      verb: isRunning ? "Exploring" : "Explored",
      target,
      isMono: false,
      fullSummary: target
        ? `${isRunning ? "Exploring" : "Explored"} ${target}`
        : `${isRunning ? "Exploring" : "Explored"} codebase`,
    };
  }

  // 6. Search / Grep / Find
  if (
    lower.includes("grep") ||
    lower.includes("find") ||
    lower.includes("search")
  ) {
    const query =
      argsObj.Query ||
      argsObj.query ||
      argsObj.Pattern ||
      argsObj.pattern ||
      argsObj.toolSummary ||
      "";
    const truncatedQuery = truncateString(String(query), 40);
    const target = truncatedQuery ? `"${truncatedQuery}"` : "codebase";
    return {
      verb: isRunning ? "Searching" : "Searched",
      target,
      isMono: false,
      fullSummary: `${isRunning ? "Searching" : "Searched"} for ${target}`,
    };
  }

  // 7. MCP Tools
  if (lower.includes("mcp")) {
    const toolName = argsObj.ToolName || argsObj.tool_name || "";
    const serverName = argsObj.ServerName || argsObj.server_name || "";
    const summary = argsObj.toolSummary || toolName || "MCP tool";
    const target = serverName && toolName ? `${serverName}/${toolName}` : String(summary);
    return {
      verb: isRunning ? "Calling" : "Called",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Calling" : "Called"} ${target}`,
    };
  }

  // 8. Tasks / Subagents
  if (lower.includes("subagent") || lower.includes("task")) {
    const action = argsObj.Action || argsObj.toolSummary || (argsObj.Subagents ? `${argsObj.Subagents.length} subagents` : "");
    const target = action ? String(action) : name;
    return {
      verb: isRunning ? "Running" : "Completed",
      target,
      isMono: false,
      fullSummary: `${isRunning ? "Running" : "Completed"} ${target}`,
    };
  }

  // 9. Web / Browse / Fetch (with URL)
  const hasUrl = argsObj.Url || argsObj.url || argsObj.link;
  if (hasUrl && (lower.includes("web") || lower.includes("browse") || lower.includes("fetch") || lower.includes("url"))) {
    const truncatedUrl = truncateString(String(hasUrl), 40);
    return {
      verb: isRunning ? "Fetching" : "Fetched",
      target: truncatedUrl,
      isMono: true,
      fullSummary: `${isRunning ? "Fetching" : "Fetched"} ${truncatedUrl}`,
    };
  }

  // 10. General query parameter if present
  if (argsObj.query || argsObj.Query) {
    const query = String(argsObj.query || argsObj.Query);
    const truncated = truncateString(query, 35);
    return {
      verb: isRunning ? "Calling" : "Called",
      target: `${name} "${truncated}"`,
      isMono: false,
      fullSummary: `${isRunning ? "Calling" : "Called"} ${name} "${truncated}"`,
    };
  }

  // 11. Tool summary if present
  if (argsObj.toolSummary) {
    const summary = String(argsObj.toolSummary);
    return {
      verb: isRunning ? "Running" : "Completed",
      target: summary,
      isMono: false,
      fullSummary: `${isRunning ? "Running" : "Completed"} ${summary}`,
    };
  }

  // Default fallback
  const firstVal = Object.values(argsObj).find(
    (v) => typeof v === "string" && v.length > 0
  );
  const target = firstVal
    ? `${name} (${truncateString(String(firstVal), 35)})`
    : name;

  return {
    verb: isRunning ? "Calling" : "Called",
    target,
    isMono: true,
    fullSummary: `${isRunning ? "Calling" : "Called"} ${target}`,
  };
}

export function summarizeToolGroup(
  blocks: Array<Extract<MessageBlock, { type: "tool_call" | "command_exec" }>>
): string {
  if (blocks.length === 0) return "";

  let filesRead = 0;
  let filesEdited = 0;
  let commands = 0;
  let searches = 0;
  let explores = 0;
  let directories = 0;
  let fetches = 0;
  let other = 0;

  for (const block of blocks) {
    if (block.type === "command_exec") {
      commands++;
      continue;
    }

    const lower = (block.name || "").toLowerCase();
    if (
      lower.includes("command") ||
      lower.includes("bash") ||
      lower.includes("exec") ||
      lower.includes("terminal") ||
      lower.includes("shell")
    ) {
      commands++;
    } else if (
      lower === "list_dir" ||
      lower.includes("list_dir") ||
      lower === "dir" ||
      lower === "ls"
    ) {
      directories++;
    } else if (
      lower.includes("read") ||
      lower.includes("view") ||
      lower === "cat"
    ) {
      filesRead++;
    } else if (
      lower.includes("write") ||
      lower.includes("edit") ||
      lower.includes("replace") ||
      lower.includes("patch")
    ) {
      filesEdited++;
    } else if (
      lower.includes("codegraph_explore") ||
      lower.includes("explore")
    ) {
      explores++;
    } else if (
      lower.includes("grep") ||
      lower.includes("find") ||
      lower.includes("search")
    ) {
      searches++;
    } else if (
      lower.includes("web") ||
      lower.includes("browse") ||
      lower.includes("fetch") ||
      lower.includes("url")
    ) {
      fetches++;
    } else {
      other++;
    }
  }

  const parts: string[] = [];

  // 1. Files explored / read
  if (explores > 0 && filesRead === 0) {
    parts.push(explores === 1 ? "explored 1 file" : `explored ${explores} files`);
  } else if (filesRead > 0 && explores === 0) {
    parts.push(filesRead === 1 ? "read 1 file" : `read ${filesRead} files`);
  } else if (filesRead > 0 && explores > 0) {
    parts.push(`explored ${filesRead + explores} files`);
  }

  // 2. Directories checked / listed
  if (directories > 0) {
    parts.push(directories === 1 ? "checked 1 directory" : `checked ${directories} directories`);
  }

  // 3. Searches
  if (searches > 0) {
    parts.push(searches === 1 ? "1 search" : `${searches} searches`);
  }

  // 4. Commands
  if (commands > 0) {
    parts.push(commands === 1 ? "ran 1 command" : `ran ${commands} commands`);
  }

  // 5. Edits
  if (filesEdited > 0) {
    parts.push(filesEdited === 1 ? "edited 1 file" : `edited ${filesEdited} files`);
  }

  // 6. Fetches
  if (fetches > 0) {
    parts.push(fetches === 1 ? "1 fetch" : `${fetches} fetches`);
  }

  // 7. Other actions if nothing else was grouped
  if (parts.length === 0 && other > 0) {
    parts.push(other === 1 ? "called 1 tool" : `called ${other} tools`);
  }

  if (parts.length === 0) {
    return `Called ${blocks.length} tool${blocks.length === 1 ? "" : "s"}`;
  }

  const joined = parts.join(", ");
  // Capitalize first character (e.g. "Explored 3 files, 5 searches, ran 5 commands")
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export function formatWorkedDuration(durationSeconds: number): string {
  if (durationSeconds < 1) return "Worked for 1s";
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = Math.floor(durationSeconds % 60);

  if (hours > 0) {
    const minStr = minutes > 0 ? (minutes < 10 ? `0${minutes}m` : `${minutes}m`) : "";
    return minStr ? `Worked for ${hours}h ${minStr}` : `Worked for ${hours}h`;
  }
  if (minutes > 0) {
    const secStr = seconds > 0 ? (seconds < 10 ? `0${seconds}s` : `${seconds}s`) : "";
    return secStr ? `Worked for ${minutes}m ${secStr}` : `Worked for ${minutes}m`;
  }
  return `Worked for ${seconds}s`;
}

export function isEditToolName(name: string): boolean {
  const lower = (name || "").toLowerCase();
  return (
    lower.includes("write") ||
    lower.includes("edit") ||
    lower.includes("replace") ||
    lower.includes("patch")
  );
}

export function isEditFileBlock(block: MessageBlock): boolean {
  if (block.type === "file_diff") return true;
  if (block.type === "tool_call") {
    if (isEditToolName(block.name)) return true;
    return formatToolAction(block).isEdit === true;
  }
  return false;
}

