# Google Antigravity CLI (`agy`) Interface Specification

> **Audience**: Canywhere core developers, CLI adapter implementers, and system architects.  
> **Source References**: Analyzed directly from the Antigravity CLI binary (`/Users/tienpham/.local/bin/agy`), internal CLI help & subcommands, live `stream-json` execution trace, and runtime event schemas.

---

## 1. Overview & Architecture of `agy` Interfaces

Google Antigravity exposes the **`agy`** command-line interface as its primary developer and machine-to-machine orchestration surface. 

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER / CLIENT TIER                            │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │   Terminal User (CLI)     │         │ External Client (Host/IDE)│   │
│   │   - Interactive TUI       │         │ - Canywhere Desktop Host  │   │
│   │   - Non-interactive Print │         │ - Canywhere Mobile (iOS)  │   │
│   └─────────────┬─────────────┘         └─────────────┬─────────────┘   │
└─────────────────┼─────────────────────────────────────┼─────────────────┘
                  │                                     │
                  │ Command-Line Flags / Args           │ NDJSON Stream (`stream-json`)
                  ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              AGY RUNTIME                                │
│                                                                         │
│  ┌─────────────────────────────┐       ┌─────────────────────────────┐  │
│  │    `agy` CLI Parser (Go)    │       │ `stream-json` I/O Engine    │  │
│  │  - Global flags & models    │       │ - Stdio NDJSON bi-dir stream│  │
│  │  - Subcommand router        │◄─────►│ - Step state-machine updates│  │
│  │  - Settings & Auth loader   │       │ - Multi-turn persistent pipe│  │
│  └──────────────┬──────────────┘       └──────────────┬──────────────┘  │
│                 │                                     │                 │
│                 ▼                                     ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Core Agent Execution Engine                   │  │
│  │  - Context Manager & History     - Gemini / Claude / OSS Models   │  │
│  │  - Sandboxing & Policy Guardian  - Built-in & MCP Tools Engine    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Architectural Comparison: Codex vs Antigravity

| Dimension | OpenAI Codex (`codex app-server`) | Google Antigravity (`agy`) |
|---|---|---|
| **Binary Interface** | Headless daemon (`codex app-server --stdio`). | CLI in streaming mode (`agy --input-format stream-json --output-format stream-json --print=`). |
| **Transport Protocol**| JSON-RPC 2.0 (NDJSON) with explicit method envelopes. | Event-driven NDJSON streaming protocol (`event: init \| step_update \| result`). |
| **Turn Model** | Explicit `turn/start`, `turn/steer`, `turn/interrupt` RPCs. | Persistent `stdin` writing `{"event":"user","message":{"content":"..."}}` per turn. |
| **Delta Streaming** | Granular token delta (`turn/token`), reasoning delta (`item/reasoning`). | Granular step updates (`step_update` with `text_delta` or `tool_info`). |
| **Model Families** | OpenAI proprietary (`gpt-5-codex`, `o3-mini`, `gpt-4o`). | Gemini (`gemini-3.8-flash`, `gemini-3.7-flash`), Claude (`claude-sonnet-4-6`, `claude-opus-4-6`), OSS (`gpt-oss-120b`). |
| **Session Tracking** | Server-tracked `threadId` & `turnId`. | Server-tracked `conversation_id` & sequential `step_index`. |

---

## 2. `agy` CLI Command-Line Reference

### 2.1 Global Flags & Options

The root CLI command `agy` accepts the following options:

| Flag | Short | Type | Description |
|---|---|---|---|
| `--model <MODEL>` | | String | Selects active model (e.g. `gemini-3.8-flash-high`, `claude-sonnet-4-6`). |
| `--effort <EFFORT>` | | Enum | Reasoning effort: `low`, `medium`, `high`. |
| `--mode <MODE>` | | Enum | Agent execution mode: `accept-edits`, `plan`. |
| `--add-dir <DIR>` | | Path (Repeatable) | **Multiple Root Support**: Adds directories to workspace context. |
| `--conversation <ID>` | | UUID | Resumes an existing conversation by ID. |
| `--continue` | `-c` | Boolean | Continues the most recent conversation. |
| `--input-format <FMT>` | | Enum | Input format: `text`, `stream-json`. (`stream-json` reads NDJSON from stdin). |
| `--output-format <FMT>`| | Enum | Output format: `text`, `json`, `stream-json`. |
| `--print [PROMPT]` | `-p` | String | Runs a prompt non-interactively. In `stream-json` mode, pass `--print=` to read from stdin. |
| `--print-timeout <DUR>`| | Duration | Timeout for print mode wait (default: `5m0s`). |
| `--dangerously-skip-permissions` | | Boolean | Auto-approves all tool permission requests without interactive prompt. |
| `--sandbox` | | Boolean | Runs in a sandbox with terminal restrictions enabled. |
| `--agent <NAME>` | | String | Selects agent role/specialization. |
| `--json-schema <SCHEMA>` | | String / Path | JSON schema enforcing structured output on final result. |

### 2.2 Available Models (`agy models`)

Queried dynamically via `agy models`:

| Model ID | Display Name | Reasoning Support |
|---|---|---|
| `gemini-3.8-flash-high` | Gemini 3.8 Flash (High) | Yes (`high`) |
| `gemini-3.8-flash-medium` | Gemini 3.8 Flash (Medium) | Yes (`medium`) |
| `gemini-3.8-flash-low` | Gemini 3.8 Flash (Low) | Yes (`low`) |
| `gemini-3.7-flash-high` | Gemini 3.7 Flash (High) | Yes (`high`) |
| `gemini-3.7-flash-medium` | Gemini 3.7 Flash (Medium) | Yes (`medium`) |
| `gemini-3.7-flash-low` | Gemini 3.7 Flash (Low) | Yes (`low`) |
| `gemini-3.6-flash-high` | Gemini 3.6 Flash (High) | Yes (`high`) |
| `gemini-3.6-flash-medium` | Gemini 3.6 Flash (Medium) | Yes (`medium`) |
| `gemini-3.6-flash-low` | Gemini 3.6 Flash (Low) | Yes (`low`) |
| `gemini-3.1-pro-high` | Gemini 3.1 Pro (High) | Yes (`high`) |
| `gemini-3.1-pro-low` | Gemini 3.1 Pro (Low) | Yes (`low`) |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 (Thinking) | Yes (Thinking) |
| `claude-opus-4-6-thinking`| Claude Opus 4.6 (Thinking) | Yes (Thinking) |
| `gpt-oss-120b-medium` | GPT-OSS 120B (Medium) | Yes (`medium`) |

### 2.3 Subcommand Hierarchy

#### 1. `agy remote-control`
Manages the background daemon:
- `agy remote-control start`: Registers and starts the daemon.
- `agy remote-control status`: Shows daemon status and connection address.
- `agy remote-control stop`: Stops the daemon.

#### 2. `agy mcp`
Model Context Protocol integration:
- `agy mcp list`: Lists configured MCP servers.
- `agy mcp add <NAME> <COMMAND> [ARGS...]`: Registers a local MCP server.
- `agy mcp remove <NAME>`: Unregisters an MCP server.
- `agy mcp enable <NAME>` / `agy mcp disable <NAME>`: Toggles server active status.

#### 3. `agy plugin` (alias: `plugins`)
Manages installed plugins:
- `agy plugin list`: Lists active plugins.
- `agy plugin install <SOURCE>`: Installs plugin (e.g., from Gemini or Claude ecosystems).
- `agy plugin uninstall <NAME>`: Removes plugin.

---

## 3. Wire Protocol Specification (`stream-json`)

When invoked with `--input-format stream-json --output-format stream-json --print=`, `agy` operates as a persistent, bi-directional NDJSON streaming engine over `stdin` and `stdout`.

### 3.1 Framing & Lifecycle
- **Transport**: Standard I/O (`stdin` / `stdout`).
- **Framing**: Newline-delimited JSON (NDJSON / JSON Lines). Each message must end with `\n`.
- **Multi-turn Session**: The process stays alive across multiple user turns. Each turn is initiated by writing a JSON message to `stdin` and completes when `agy` emits a `"result"` event on `stdout`.

### 3.2 Client Input Message (`stdin`)

To send a user prompt or next turn:

```json
{
  "event": "user",
  "message": {
    "content": "Check Cargo.toml file using view_file tool and report dependencies."
  }
}
```

- `event`: String literal `"user"`.
- `message`: Object containing:
  - `content`: Prompt string (or array of content blocks).

---

### 3.3 Server Output Events (`stdout`)

`agy` emits three top-level event families: `init`, `step_update`, and `result`.

#### 1. `init` Event
Emitted immediately after process startup or session resumption:

```json
{
  "event": "init",
  "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
  "init": {
    "cwd": "/Users/tienpham/Work/canywhere",
    "tools": [
      "ask_permission",
      "ask_question",
      "run_command",
      "view_file",
      "write_to_file",
      "replace_file_content",
      "grep_search",
      "find_by_name",
      "call_mcp_tool"
    ],
    "permission_mode": "request-review"
  }
}
```

#### 2. `step_update` Events
Emitted continually during the turn execution lifecycle. Each step represents an atomic operation:

##### A. User Input Acknowledgment (`step_type: "user_input"`)
```json
{
  "event": "step_update",
  "step_update": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "step_index": 0,
    "state": "DONE",
    "step_type": "user_input"
  }
}
```

##### B. Agent Response & Streaming Tokens (`step_type: "agent_response"`)
During text generation, `agy` emits incremental token chunks with `state: "ACTIVE"`:
```json
{
  "event": "step_update",
  "step_update": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "step_index": 1,
    "state": "ACTIVE",
    "step_type": "agent_response",
    "text_delta": "The package name is "
  }
}
```

When response generation completes, a final summary step is emitted with `state: "DONE"` and token usage:
```json
{
  "event": "step_update",
  "step_update": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "step_index": 1,
    "state": "DONE",
    "step_type": "agent_response",
    "text_delta": "\n",
    "duration_seconds": 2.128,
    "usage": {
      "input_tokens": 6388,
      "output_tokens": 866,
      "thinking_tokens": 773,
      "cache_read_tokens": 8127,
      "total_tokens": 7254
    }
  }
}
```

##### C. Tool Execution Lifecycle (`step_type: "tool"`)
When invoking a tool (file read/write, terminal command, MCP tool, search):

**Tool Start (`state: "ACTIVE"`):**
```json
{
  "event": "step_update",
  "step_update": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "step_index": 4,
    "state": "ACTIVE",
    "step_type": "tool",
    "tool_name": "run_command",
    "tool_info": {
      "name": "run_command",
      "parameters": {
        "CommandLine": "cargo check --workspace"
      }
    }
  }
}
```

**Tool Completion (`state: "DONE"`):**
```json
{
  "event": "step_update",
  "step_update": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "step_index": 4,
    "state": "DONE",
    "step_type": "tool",
    "tool_name": "run_command",
    "duration_seconds": 0.532,
    "tool_info": {
      "name": "run_command",
      "parameters": {
        "CommandLine": "cargo check --workspace"
      },
      "output": "Finished `dev` profile [unoptimized + debuginfo] in 0.73s\n"
    }
  }
}
```

#### 3. `result` Event
Emitted at the end of every user turn, signaling that the agent is fully idle and ready for the next prompt:

```json
{
  "event": "result",
  "result": {
    "conversation_id": "cfcb180e-a812-4925-b256-011502afd892",
    "status": "SUCCESS",
    "response": "The first line of Cargo.toml is [workspace]\n",
    "duration_seconds": 12.458,
    "num_turns": 1,
    "usage": {
      "input_tokens": 27786,
      "output_tokens": 1816,
      "thinking_tokens": 1520,
      "cache_read_tokens": 36564,
      "total_tokens": 29602
    }
  }
}
```

---

## 4. Mapping `agy` to Canywhere (`AgyAdapter`)

### 4.1 Event Mapping Matrix

| `agy` Wire Event | Canywhere `AgentEvent` | Canywhere `MessageBlock` |
|---|---|---|
| `event: "init"` | `AgentEvent::ChatCreated` | Stores `conversation_id` as `externalThreadId`. |
| `step_update.state == "ACTIVE"` && `step_type == "agent_response"` | `AgentEvent::TokenDelta` | Appends to active markdown text stream. |
| `step_update.step_type == "tool"` && `state == "ACTIVE"` | `AgentEvent::BlockStarted` | `MessageBlock::ToolCall` (or `MessageBlock::CommandExec`). |
| `step_update.step_type == "tool"` && `state == "DONE"` | `AgentEvent::BlockCompleted` | Updates block output and sets status to `"completed"`. |
| `step_update.usage.thinking_tokens > 0` | `AgentEvent::ReasoningDelta` | Maps to `MessageBlock::Reasoning` block. |
| `event: "result"` | `AgentEvent::TurnCompleted` | Marks chat status as `idle`, persists finalized blocks to SQLite. |

### 4.2 Tool Semantic Normalization

`agy` tools are cleanly mapped into Canywhere's domain types:

```rust
match tool_name.as_str() {
    "run_command" => {
        let cmd = tool_info.parameters.get("CommandLine").and_then(|v| v.as_str()).unwrap_or("");
        MessageBlock::CommandExec {
            command: cmd.to_string(),
            cwd: cwd.clone(),
            output: tool_info.output.clone(),
            exit_code: Some(0),
            status: if is_done { CommandExecStatus::Completed } else { CommandExecStatus::Running },
        }
    }
    "replace_file_content" | "write_to_file" | "multi_replace_file_content" => {
        let path = tool_info.parameters.get("TargetFile").and_then(|v| v.as_str()).unwrap_or("");
        MessageBlock::FileDiff {
            path: path.to_string(),
            patch: tool_info.parameters.get("ReplacementContent").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            status: FileDiffStatus::Applied,
        }
    }
    _ => {
        MessageBlock::ToolCall {
            call_id: format!("{}-step-{}", chat_id, step_index),
            name: tool_name.clone(),
            args: serde_json::to_value(&tool_info.parameters).unwrap_or_default(),
            output: tool_info.output.clone(),
            status: if is_done { ToolCallStatus::Completed } else { ToolCallStatus::Running },
        }
    }
}
```

### 4.3 Multi-Turn Process Lifecycle in Rust

```rust
pub struct AgyAdapter {
    agy_bin: String,
    // Child process stdin handles per chat/session
    sessions: Arc<Mutex<HashMap<String, AgySession>>>,
    event_tx: broadcast::Sender<AgentEvent>,
}

struct AgySession {
    conversation_id: String,
    stdin: ChildStdin,
    active_turn_id: Option<String>,
}
```

1. **New Chat**:
   - Spawn: `agy --input-format stream-json --output-format stream-json --print= --model <MODEL> --effort <EFFORT> --add-dir <WORKSPACE_ROOT>`.
   - Read `init` event $\to$ store `conversation_id`.
   - Write first turn JSON $\to$ pipe `stdout` reader task.
2. **Resume Chat**:
   - Spawn: `agy --conversation <CONVERSATION_ID> --input-format stream-json --output-format stream-json --print=`.
3. **Interrupting Turns**:
   - Send `SIGINT` to child process, or invoke cooperative cancel.

---

## 5. Security & Permission Guardrails

1. **Permission Modes in `agy`**:
   - `request-review`: Requires approval for sensitive filesystem mutations and shell executions.
   - `always-proceed`: Equivalent to `--dangerously-skip-permissions`.
   - `plan`: Read-only analysis without making workspace changes.
2. **Remote Approval Flow**:
   - When `agy` requests permission (via `ask_permission` / `ask_question`), `AgyAdapter` transforms it into a Canywhere `ApprovalRequest`.
   - The user accepts/declines on Mobile (iOS) or Desktop UI.
   - Upon resolution, `AgyAdapter` writes the approval answer to child `stdin`.
3. **Sandboxing**:
   - Pass `--sandbox` to enforce operating system seatbelt / container restrictions on terminal execution.
