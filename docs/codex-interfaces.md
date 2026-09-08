# OpenAI Codex CLI & App-Server Interface Specification

> **Audience**: Canywhere core developers, CLI adapter implementers, and system architects.  
> **Source References**: Analyzed directly from the Codex codebase (`codex-cli`, `codex-rs/cli`, `codex-rs/app-server`, `codex-rs/app-server-protocol`, `codex-rs/protocol`, `codex-rs/utils/cli`).

---

## 1. Overview & Architecture of Codex Interfaces

OpenAI Codex exposes two primary integration tiers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER / CLIENT TIER                            │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │   Terminal User (CLI)     │         │ External Client (Host/IDE)│   │
│   │   - Interactive TUI       │         │ - Canywhere Desktop Host  │   │
│   │   - Non-interactive Exec  │         │ - VS Code Extension       │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
└─────────────────┼─────────────────────────────────────┼─────────────────┘
                  │                                     │
                  │ Command-Line Flags / Args           │ JSON-RPC 2.0 (NDJSON)
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            CODEX RUNTIME                                │
│                                                                         │
│  ┌─────────────────────────────┐       ┌─────────────────────────────┐  │
│  │   `codex-cli` / `cli` Crate │       │ `codex app-server` (Daemon) │  │
│  │   - Clap CLI parser         │       │ - Stdio / Socket transport  │  │
│  │   - Subcommand router       │◄─────►│ - Thread/Turn state machine │  │
│  │   - Config layered loader   │       │ - Multi-client multiplexing │  │
│  └──────────────┬──────────────┘       └──────────────┬──────────────┘  │
│                 │                                     │                 │
│                 ▼                                     ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Core Engine (`codex-core`)                     │  │
│  │  - Context Manager & History     - Responses API Client           │  │
│  │  - Sandboxing (Seatbelt/bwrap)   - MCP Tool Execution Engine      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **Codex CLI Surface (`codex [OPTIONS] [PROMPT]` / `codex <COMMAND>`)**:
   - The user-facing terminal binary compiled from Rust (`codex-rs/cli`).
   - Packaged and distributed via npm as `@openai/codex` with architecture-specific native binaries (`@openai/codex-darwin-arm64`, `@openai/codex-linux-x64`, etc.).
   - Provides rich interactive terminal UI (`codex-tui`) or batch command execution (`codex exec`).

2. **Codex App-Server Protocol Surface (`codex app-server`)**:
   - The headless RPC protocol layer powering GUI extensions (e.g., VS Code, Desktop apps) and remote orchestrators (like **Canywhere**).
   - Bi-directional JSON-RPC 2.0 over Stdio (NDJSON) or Unix domain sockets.
   - Full conversational state-machine abstraction (`Thread` $\to$ `Turn` $\to$ `Item`).
   - Bidirectional approval flow where the server interrupts execution and requests client permission for commands or file patches.

---

## 2. Codex CLI Command-Line Interface Reference

The CLI entrypoint is parsed via `clap` in `codex-rs/cli/src/main.rs`.

### 2.1 Global Options & Shared Flags (`SharedCliOptions`)

These options can be passed to the root command `codex` as well as subcommands like `exec`, `resume`, and `fork`:

| Flag | Short | Type | Description |
|---|---|---|---|
| `--model <MODEL>` | `-m` | String | Overrides the active model (e.g. `gpt-5-codex`, `o3-mini`). |
| `--cd <DIR>` | `-C` | Path | Sets the working root directory for the session. |
| `--add-dir <DIR>` | | Path (List) | **Multiple Root Support**: Additional directories granted read/write access alongside the primary workspace. |
| `--sandbox <MODE>` | `-s` | Enum | Sandbox isolation level: `read-only`, `workspace-write`, `danger-full-access`. |
| `--ask-for-approval <POLICY>`| `-a` | Enum | When human approval is prompted: `always`, `on-request`, `never`. |
| `--approve-for-me` | | Boolean | Auto-routes approvals through Guardian automated scoring with `workspace-write` sandbox (alias: `--not-so-yolo`). |
| `--dangerously-bypass-approvals-and-sandbox` | | Boolean | Disables all sandboxing and approvals. **Extreme risk** (alias: `--yolo`). |
| `--profile <NAME>` | `-p` | String | Layer named configuration file `$CODEX_HOME/<name>.config.toml` on top of base config. |
| `--worktree` | | Boolean | Spawns and executes the session in a newly isolated Git worktree. |
| `--image <FILE>` | `-i` | Path (List) | Attaches image file(s) to the initial prompt. |
| `--oss` | | Boolean | Enables local open-source model providers. |
| `--local-provider <NAME>` | | String | Specifies local engine: `ollama` or `lmstudio`. |

### 2.2 Root Interactive Mode Flags (`TuiCli`)

When invoked without subcommands (e.g., `codex "prompt"`):

| Flag | Type | Description |
|---|---|---|
| `[PROMPT]` | Positional String | Optional starting message to immediately kick off the agent turn. |
| `--search` | Boolean | Enables native live web search tool (`web_search`) without per-call approval. |
| `--no-alt-screen` | Boolean | Disables fullscreen terminal alternate buffer, rendering inline to preserve scrollback. |
| `--strict-config` | Boolean | Fails immediately if `config.toml` contains unrecognized fields. |

### 2.3 Subcommand Hierarchy

#### 1. `codex exec` (alias: `codex e`)
Runs Codex non-interactively for CI/CD, automation scripts, and command-line piping:
```bash
codex exec "Audit dependencies in Cargo.lock and report security vulnerabilities"
cat patch.diff | codex exec --json "Explain these changes"
```
- Accepts stdin text as context.
- Can emit JSON output via `--json`.

#### 2. `codex review`
Non-interactive, dedicated code review mode:
```bash
codex review --base main
```
- Computes git diff against `--base <BRANCH>` and invokes the review specialist model to return structured feedback.

#### 3. Session Operations (`resume`, `fork`, `queue`, `archive`, `delete`)
- `codex resume [--last | <SESSION_ID>]`: Reopens an existing persisted conversation. If omitted, opens an interactive TUI session picker.
- `codex fork [--last | <SESSION_ID>]`: Copies conversation history up to the current turn into a new independent session thread.
- `codex queue <SESSION_ID> "Next task"`: Persists a message into the thread's queue for FIFO execution when the agent becomes idle.
- `codex archive <SESSION_ID>` / `codex unarchive <SESSION_ID>`: Archives or restores session rollout logs.
- `codex delete <SESSION_ID>`: Permanently purges session data.

#### 4. Tool & Ecosystem Management (`mcp`, `plugin`)
- `codex mcp list`: Lists all configured Model Context Protocol servers.
- `codex mcp add <NAME> <COMMAND> [ARGS...]`: Registers a local stdio MCP server.
- `codex plugin list` / `codex plugin add <NAME>` / `codex plugin remove <NAME>`: Manages installed plugins and marketplace extensions.

#### 5. `codex app-server`
Spawns the headless JSON-RPC daemon:
```bash
codex app-server --stdio
codex app-server --listen ws://127.0.0.1:7890
codex app-server --listen unix:///tmp/codex-app-server.sock
codex app-server daemon start
```

#### 6. `codex doctor`
Runs comprehensive environment diagnostic checks (auth tokens, network connectivity, API access, compiler dependencies, sandbox capabilities).

---

## 3. App-Server Protocol Specification (v2 Wire Protocol)

The protocol powering `codex app-server` is a bidirectional JSON-RPC 2.0 implementation without the redundant `"jsonrpc": "2.0"` envelope keys on the wire.

### 3.1 Transport & Framing
- **Stdio Transport**: Newline-delimited JSON (NDJSON / JSONL). Every message is a single UTF-8 line ending in `\n`.
- **Unix Domain Socket Transport**: WebSocket HTTP upgrade handshake followed by standard WebSocket text frames carrying JSON payloads.

### 3.2 Message Taxonomy
1. **ClientRequest**: Client $\to$ Server. Carries `id` (string or integer), `method`, and optional `params`. Requires a matching response.
2. **ClientResponse**: Server $\to$ Client. Carries `id` matching the request and `result` (or JSON-RPC `error`).
3. **ServerRequest**: Server $\to$ Client. Initiated by the server (e.g. asking for approval or user input). Carries `id`, `method`, and `params`. Client **must** answer with a response envelope.
4. **ServerNotification**: Server $\to$ Client. Asynchronous fire-and-forget event stream (item deltas, lifecycle state changes). Does not contain an `id`.
5. **ClientNotification**: Client $\to$ Server. Asynchronous acknowledgment (e.g., `initialized`).

### 3.3 Connection Handshake Phase

```
Client (Canywhere)                                       codex app-server
       │                                                         │
       ├─ 1. Send "initialize" Request ─────────────────────────►│
       │     id: 1, params: { clientInfo, capabilities }         │
       │                                                         │
       │◄─ 2. Receive "initialize" Response ─────────────────────┤
       │     result: { codexHome, platformFamily, platformOs }   │
       │                                                         │
       ├─ 3. Send "initialized" Notification ───────────────────►│
       │     method: "initialized", params: {}                   │
       │                                                         │
       │  [ Connection fully operational for thread/turn calls ] │
```

#### `initialize` Params (`v1::InitializeParams`):
```json
{
  "id": 1,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "canywhere-desktop",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true,
      "optOutNotificationMethods": []
    }
  }
}
```

---

## 4. Client-to-Server Methods (`ClientRequest`)

All API methods are defined in `app-server-protocol/src/protocol/common.rs`.

### 4.1 Thread Lifecycle Methods

#### `thread/start`
Creates and registers a new conversation thread.
- **Method**: `"thread/start"`
- **Params** (`ThreadStartParams`):
  ```typescript
  interface ThreadStartParams {
    model?: string;                                 // Model override
    modelProvider?: string;                         // e.g. "openai"
    cwd?: string;                                   // Main working directory (absolute path)
    runtimeWorkspaceRoots?: string[];               // Multi-root directory paths
    approvalPolicy?: "always" | "onRequest" | "never";
    approvalsReviewer?: "user" | "autoReview";
    sandbox?: "readOnly" | "workspaceWrite" | "dangerFullAccess";
    permissions?: string;                           // Named permission profile ID
    baseInstructions?: string;                      // System instructions override
    developerInstructions?: string;                 // Project custom instructions
    ephemeral?: boolean;                            // In-memory only thread
    historyMode?: "legacy" | "paginated";           // Persisted storage format
  }
  ```
- **Response** (`ThreadStartResponse`):
  ```typescript
  interface ThreadStartResponse {
    thread: Thread;                                 // Complete initial Thread object
  }
  ```

#### `thread/resume`
Re-attaches to an existing persisted thread.
- **Method**: `"thread/resume"`
- **Params** (`ThreadResumeParams`):
  ```typescript
  interface ThreadResumeParams {
    threadId: string;                               // Thread ID to resume
    cwd?: string;                                   // Optional working directory override
    approvalPolicy?: "always" | "onRequest" | "never";
    permissions?: string;
  }
  ```

#### `thread/fork`
Clones an existing thread up to a given turn boundary into a new thread ID.
- **Method**: `"thread/fork"`
- **Params**: `{ threadId: string, lastTurnId?: string, ephemeral?: boolean }`
- **Response**: `{ thread: Thread }`

#### `thread/archive` / `thread/unarchive` / `thread/delete`
- `thread/archive`: `{ threadId: string }` $\to$ moves session files to archive folder.
- `thread/unarchive`: `{ threadId: string }` $\to$ restores archived session.
- `thread/delete`: `{ threadId: string }` $\to$ hard deletion from disk.

#### `thread/read` & `thread/list`
- `thread/read`: `{ threadId: string, includeTurns?: boolean }` $\to$ queries thread metadata without loading into memory.
- `thread/list`: `{ cursor?: string, limit?: number }` $\to$ pages persisted conversations.

---

### 4.2 Turn Execution & Steering Methods

#### `turn/start`
Starts an agent execution turn with user input.
- **Method**: `"turn/start"`
- **Params** (`TurnStartParams`):
  ```typescript
  interface TurnStartParams {
    threadId: string;
    input: UserInput[];                             // Array of input items (text, image, mentions)
    clientUserMessageId?: string;                   // Echoed client ID for tracking
    model?: string;                                 // Turn-scoped model override
    effort?: "none" | "low" | "medium" | "high" | "ultra"; // Reasoning effort
    cwd?: string;
    runtimeWorkspaceRoots?: string[];
    approvalPolicy?: "always" | "onRequest" | "never";
    permissions?: string;
  }
  ```
- **Response** (`TurnStartResponse`):
  ```typescript
  interface TurnStartResponse {
    turn: Turn;                                     // Initial turn metadata (id, status: "inProgress")
  }
  ```

#### `turn/steer`
Injects additional user steering into an **already running turn** without canceling it.
- **Method**: `"turn/steer"`
- **Params**:
  ```typescript
  interface TurnSteerParams {
    threadId: string;
    expectedTurnId: string;                         // Precondition: active turn must match
    input: UserInput[];
  }
  ```
- **Response**: `{ turnId: string }`

#### `turn/interrupt`
Cooperatively cancels an ongoing turn.
- **Method**: `"turn/interrupt"`
- **Params**: `{ threadId: string, turnId: string }`
- **Response**: `{}` (turn completes with `status: "interrupted"`)

---

## 5. Server-Initiated Requests (`ServerRequest`) & Approval Workflows

During a turn, the agent may execute a command or patch a file that requires user consent. In this state, `codex app-server` issues a **ServerRequest** to the client. The turn blocks until the client responds.

### 5.1 Command Execution Approval
- **Method**: `"item/commandExecution/requestApproval"`
- **Payload** (`CommandExecutionRequestApprovalParams`):
  ```typescript
  interface CommandExecutionRequestApprovalParams {
    itemId: string;                                 // Identifier of the CommandExecution item
    threadId: string;
    turnId: string;
    command: string;                                // Shell command line to be executed
    cwd: string;                                    // Working directory
    reason?: string;                                // Model's justification
    commandActions: CommandAction[];                // Parsed actions (file writes, network requests)
    availableDecisions?: string[];                  // Supported decisions
  }
  ```
- **Client Response**:
  The client sends back a JSON-RPC response envelope with the matching request `id`:
  ```json
  {
    "id": 42,
    "result": {
      "decision": "accept"
    }
  }
  ```
  **Valid Decision Options**:
  - `"accept"`: Approve execution for this single command.
  - `"acceptForSession"`: Approve this command and remember permission for the remainder of the session.
  - `{ "acceptWithExecpolicyAmendment": { "execpolicy_amendment": ... } }`: Persist an execpolicy rule to config.
  - `{ "applyNetworkPolicyAmendment": { "network_policy_amendment": ... } }`: Add persistent network rule.
  - `"decline"`: Reject the command. The agent continues the turn and attempts alternatives.
  - `"cancel"`: Abort the entire turn immediately.

### 5.2 File Change Approval
- **Method**: `"item/fileChange/requestApproval"`
- **Payload** (`FileChangeRequestApprovalParams`):
  ```typescript
  interface FileChangeRequestApprovalParams {
    itemId: string;                                 // Identifier of FileChange item
    threadId: string;
    turnId: string;
    reason?: string;
    grantRoot?: string;                             // Proposed directory write access
  }
  ```
- **Client Response**:
  ```json
  {
    "id": 43,
    "result": {
      "decision": "accept" 
    }
  }
  ```
  **Valid Decisions**: `"accept"`, `"acceptForSession"`, `"decline"`, `"cancel"`.

### 5.3 User Input Request
- **Method**: `"item/tool/requestUserInput"`
- **Payload**: `{ itemId: string, threadId: string, turnId: string, isBlocking: boolean, questions: [...] }`
- **Client Response**: Answers submitted by the user.

---

## 6. Server-to-Client Event Streams (`ServerNotification`)

Notifications deliver live progress without request/response semantics.

### 6.1 Lifecycle Notifications

| Event Name | Payload Summary |
|---|---|
| `thread/started` | `{ thread: Thread }` — emitted immediately when thread initializes or resumes |
| `thread/status/changed` | `{ threadId: string, status: ThreadStatus }` |
| `thread/tokenUsage/updated` | `{ threadId: string, tokenUsage: TokenUsage }` — updated token metrics |
| `turn/started` | `{ threadId: string, turn: Turn }` |
| `turn/diff/updated` | `{ threadId: string, turnId: string, diff: string }` — cumulative workspace diff |
| `turn/plan/updated` | `{ threadId: string, turnId: string, plan: PlanItem[] }` |
| `turn/completed` | `{ threadId: string, turn: Turn }` — final turn status (`completed`, `failed`, `interrupted`) |
| `item/started` | `{ threadId: string, turnId: string, item: ThreadItem }` |
| `item/completed` | `{ threadId: string, turnId: string, item: ThreadItem }` |
| `serverRequest/resolved` | `{ threadId: string, requestId: RequestId }` — confirms approval resolved |

### 6.2 Streaming Delta Notifications

| Event Name | Payload Summary | Use Case |
|---|---|---|
| `item/agentMessage/delta` | `{ threadId, turnId, itemId, textDelta: string }` | Live token stream of assistant response |
| `item/reasoning/textDelta` | `{ threadId, turnId, itemId, textDelta: string }` | Live stream of internal CoT reasoning |
| `item/reasoning/summaryTextDelta` | `{ threadId, turnId, itemId, textDelta: string }` | Concise reasoning summary |
| `item/plan/delta` | `{ threadId, turnId, itemId, textDelta: string }` | Real-time procedural plan updates |
| `item/commandExecution/outputDelta` | `{ threadId, turnId, itemId, chunk: string }` | Live stdout/stderr chunks from running commands |
| `item/fileChange/patchUpdated` | `{ threadId, turnId, itemId, patch: string }` | Live unified diff updates before applying |

---

## 7. Data Models: Thread Items & User Inputs

### 7.1 `ThreadItem` Polymorphic Structure

Defined in `v2/item.rs`. Serialized with `type` discriminant tag:

```typescript
type ThreadItem =
  | UserMessageItem
  | AgentMessageItem
  | ReasoningItem
  | PlanItem
  | CommandExecutionItem
  | FileChangeItem
  | McpToolCallItem
  | DynamicToolCallItem
  | FunctionCallOutputItem
  | ContextCompactionItem;

interface UserMessageItem {
  type: "userMessage";
  id: string;
  clientId?: string;
  content: UserInput[];
}

interface AgentMessageItem {
  type: "agentMessage";
  id: string;
  text: string;
  phase?: "thought" | "final";
  memoryCitation?: MemoryCitation;
}

interface ReasoningItem {
  type: "reasoning";
  id: string;
  summary: string[];                              // High-level bullet points
  content: string[];                              // Detailed chain-of-thought blocks
}

interface PlanItem {
  type: "plan";
  id: string;
  text: string;                                   // Formatted markdown checklist plan
}

interface CommandExecutionItem {
  type: "commandExecution";
  id: string;
  command: string;
  cwd: string;
  status: "inProgress" | "completed" | "failed" | "declined";
  commandActions: CommandAction[];
  aggregatedOutput?: string;                      // Full captured stdout/stderr
  exitCode?: number;
  durationMs?: number;
}

interface FileChangeItem {
  type: "fileChange";
  id: string;
  changes: FileUpdateChange[];                    // List of files and unified diff patches
  status: "inProgress" | "completed" | "failed" | "declined";
}

interface McpToolCallItem {
  type: "mcpToolCall";
  id: string;
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: "inProgress" | "completed" | "failed";
  result?: McpToolCallResult;
}
```

### 7.2 `UserInput` Polymorphic Structure

Defined in `v2/turn.rs`. Serialized with `type` discriminant:

```typescript
type UserInput =
  | { type: "text"; text: string; textElements?: TextElement[] }
  | { type: "image"; url: string; detail?: "low" | "high" | "auto" }
  | { type: "localImage"; path: string; detail?: "low" | "high" | "auto" }
  | { type: "audio"; url: string }
  | { type: "localAudio"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string }; // Direct file @mention
```

---

## 8. Canywhere Adapter Mapping Architecture

The `CodexAdapter` in Canywhere acts as a translator between Canywhere's domain concepts and Codex's v2 protocol:

```
┌─────────────────────────────────┐
│     Canywhere Domain Layer      │
│  - Chat (kind: workspace)       │
│  - Message (blocks: text, diff) │
│  - ApprovalRequest              │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│          CodexAdapter           │
│  - Spawns: codex app-server     │
│  - Manages Stdio JSON-RPC       │
│  - Bidirectional Event Mapping  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     codex app-server (v2)       │
│  - Thread (id: UUIDv7)          │
│  - Turn & ThreadItem            │
│  - ServerRequest (Approval)     │
└─────────────────────────────────┘
```

### 8.1 Domain Mapping Table

| Canywhere Concept | Codex App-Server (v2) Mapping | Details |
|---|---|---|
| **Workspace** | `cwd` + `runtimeWorkspaceRoots` on `thread/start` | Main root becomes `cwd`; extra sub-roots map to `runtimeWorkspaceRoots`. |
| **Standalone Chat** | `thread/start` with hidden scratch dir | Scratch dir `~/.canywhere/scratch/codex/<chatId>` satisfies Codex `cwd`. |
| **Create Chat** | `thread/start` | Returns thread ID (UUIDv7). |
| **Resume Chat** | `thread/resume` | Fast warm-reload of thread session on demand. |
| **Send Message** | `turn/start` | `TurnInput` converted to `Vec<UserInput::Text>`. |
| **Interrupt** | `turn/interrupt` | Cancels turn while retaining generated conversation prefix. |
| **Steering** | `turn/steer` | Sends mid-turn instructions to running turn. |
| **Stream Text** | `item/agentMessage/delta` | Mapped to `chat.message.delta` with block type `text`. |
| **Stream Reasoning** | `item/reasoning/textDelta` | Mapped to `chat.message.delta` with block type `reasoning`. |
| **Command Approval** | `item/commandExecution/requestApproval` | Transformed into `ApprovalRequest` and dispatched to Mobile/Desktop. |
| **Patch Approval** | `item/fileChange/requestApproval` | Transformed into `ApprovalRequest` with unified diff preview. |
| **Approval Reply** | JSON-RPC response with `decision` | Transmitted back over stdio to unblock `codex app-server`. |
| **Completion** | `turn/completed` | Concludes message streaming and logs token usage. |
