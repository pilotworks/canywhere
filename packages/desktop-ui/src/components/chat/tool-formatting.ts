import { MessageBlock } from "../../types/index.js";

export interface FormattedToolAction {
  verb: string;
  target: string;
  isMono: boolean;
  fullSummary: string;
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

  // 1. File Reading
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
    const target = shortPath || name;
    return {
      verb: isRunning ? "Reading" : "Read",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Reading" : "Read"} ${target}`,
    };
  }

  // 2. File Writing / Editing
  if (
    lower.includes("write") ||
    lower.includes("edit") ||
    lower.includes("replace") ||
    lower.includes("patch")
  ) {
    const rawPath =
      argsObj.TargetFile ||
      argsObj.target_file ||
      argsObj.AbsolutePath ||
      argsObj.path ||
      argsObj.filePath ||
      argsObj.file ||
      "";
    const shortPath = getShortPath(String(rawPath));
    const target = shortPath || name;
    return {
      verb: isRunning ? "Editing" : "Edited",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Editing" : "Edited"} ${target}`,
    };
  }

  // 3. Command / Terminal Execution
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
    const target = truncatedCmd ? `$ ${truncatedCmd}` : name;
    return {
      verb: isRunning ? "Running" : "Ran",
      target,
      isMono: true,
      fullSummary: `${isRunning ? "Running" : "Ran"} ${target}`,
    };
  }

  // 4. CodeGraph Exploration / Search
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

  // 5. Search / Grep / Find
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

  // 6. Web / Browse / Fetch (with URL)
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

  // 7. General query parameter if present
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

  // 2. Searches
  if (searches > 0) {
    parts.push(searches === 1 ? "1 search" : `${searches} searches`);
  }

  // 3. Commands
  if (commands > 0) {
    parts.push(commands === 1 ? "ran 1 command" : `ran ${commands} commands`);
  }

  // 4. Edits
  if (filesEdited > 0) {
    parts.push(filesEdited === 1 ? "edited 1 file" : `edited ${filesEdited} files`);
  }

  // 5. Fetches
  if (fetches > 0) {
    parts.push(fetches === 1 ? "1 fetch" : `${fetches} fetches`);
  }

  if (parts.length === 0) return "";

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

