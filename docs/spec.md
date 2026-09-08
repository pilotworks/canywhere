# Canywhere — Technical Specification (v0.1 Draft)

> **Scope**: System architecture and protocol specification for the Host (Electron/Node.js desktop application), Mobile Client (iOS/Swift application), and the Extensible Multi-CLI Adapter Layer (focusing on OpenAI Codex first, followed by Grok and other autonomous CLI coding agents).

---

## 1. Objectives & Scope

### 1.1 Core Vision
Modern terminal-based and local coding assistants (such as OpenAI Codex, Grok CLI, Claude Code, and Aider) are bound to local development machines because they require access to local repositories, system compilers, language servers, and runtime execution sandboxes. 

**Canywhere** decouples the human interface from the execution machine:
- **Host (Desktop application, Electron / Node.js runtime)**: Acts as the execution brain. It runs directly on the user's primary workstation, manages workspaces, coordinates CLI agent subprocesses, persists chat histories, and performs local file and terminal operations.
- **Mobile Client (iOS, Swift native)**: Acts as a remote control and companion interface. It connects securely over **LAN** or **Tailscale**, renders conversations, streams agent deltas in real-time, browses project workspaces, and reviews/approves execution and patch requests.
- **Equal Desktop & Mobile Citizenry**: The desktop interface is architected as an internal client to the Host's local server. Both desktop and mobile share identical API endpoints, data models, and event protocols.

### 1.2 Guiding Design Principles
1. **Host as Single Source of Truth (SSOT) & Pure Online Client**: The mobile client is a lightweight, zero-persistence live control surface (no offline mode). It does not maintain a local database of chat history or thread states. When connected, state is streamed and held in-memory; when disconnected from the Host, the client displays a clear reconnection/disconnected status. All durable thread history, workspace metadata, and agent execution live exclusively on the Host.
2. **Pluggable CLI Adapter Layer**: While Phase 1 targets `codex app-server`, the system decouples agent orchestration from agent implementation via a standardized `CliAdapter` interface and normalized `AgentEvent` streams. Adding Grok, Claude Code, or custom agents will not require alterations to core Host or client logic.
3. **Dual Conversation Modes**:
   - **Workspace Chat**: Bound to a specific local project directory (`rootPath` and optional `subPaths`). The CLI agent has access to directory files, git history, and runtime environments.
   - **Standalone Chat**: Unbound from any project directory, functioning as a general-purpose agent chat. For CLI agents that require an active working directory, the Host manages transparent, isolated scratch directories under the hood.
4. **Defense-in-Depth for Remote Execution**: Mobile access to desktop shell execution and filesystem modification introduces high security risks. The protocol enforces cryptographic pairing, role-based approval gates, explicit visual diffs, and revocation controls.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HOST (Desktop)                             │
│                                                                         │
│  ┌───────────────────────┐             ┌─────────────────────────────┐  │
│  │   Desktop UI Client   │             │     Host Core Service       │  │
│  │  (Electron Renderer)  │             │      (Node.js / Main)       │  │
│  └───────────┬───────────┘             └──────────────┬──────────────┘  │
│              │                                        │                 │
│              │ HTTP / WS (localhost)                  │                 │
│              ▼                                        ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                  Internal API Server (HTTP + WS)                  │  │
│  │  - JSON-RPC 2.0 / REST Handlers    - Connection & Transport Mgr   │  │
│  │  - Pairing & Discovery (mDNS)      - Session & Database Store     │  │
│  │  - Security & Approval Dispatcher  - Workspace & File Watcher     │  │
│  └──────────────────────────────────┬────────────────────────────────┘  │
│                                     │                                   │
│                        ┌────────────┴────────────┐                      │
│                        │   CLI Adapter Engine    │                      │
│                        │       (CliAdapter)      │                      │
│                        └──────┬────────────────┬─┘                      │
│                               │                │                        │
│            ┌──────────────────┴───┐        ┌───┴───────────────────┐    │
│            │     CodexAdapter     │        │  GrokAdapter (Future) │    │
│            └──────────┬───────────┘        └───────────────────────┘    │
│                       │ Stdio (JSON-RPC)                                │
│                       ▼                                                 │
│            [codex app-server process]                                   │
└─────────────────────────────────────────────────────────────────────────┘
                               ▲
                               │ Encrypted LAN (mDNS + TLS)
                               │ OR Tailscale (MagicDNS / WireGuard)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOBILE (iOS / Swift)                          │
│                                                                         │
│  ┌─────────────────────────┐             ┌───────────────────────────┐  │
│  │   SwiftUI Presentation  │             │    Network & Transport    │  │
│  │  - Workspace Browser    │◄───────────►│  - Discovery (Bonjour)    │  │
│  │  - Realtime Chat View   │             │  - Tailscale Client       │  │
│  │  - Interactive Approvals│             │  - WebSocket Wire Handler │  │
│  └─────────────────────────┘             └─────────────┬─────────────┘  │
│                                                        │                │
│                                          ┌─────────────▼─────────────┐  │
│                                          │  In-Memory State & Keys   │  │
│                                          │  - Live UI state (RAM)    │  │
│                                          │  - Device keys in Keychain│  │
│                                          └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Locked Technical Stack & Repository Topology

Based on technical evaluation and architectural requirements, the tech stack is locked as follows:

| Layer | Technology Choice | Rationale & Strict Guardrails |
|---|---|---|
| **Host Daemon (Core)** | **Node.js LTS (v20+) + TypeScript**<br>• Fastify (REST)<br>• `ws` (WebSocket)<br>• `better-sqlite3` (WAL mode) | • Fastify provides lightweight, low-overhead HTTP routing.<br>• `better-sqlite3` offers synchronous, non-blocking zero-overhead queries with WAL mode (`PRAGMA journal_mode = WAL`).<br>• Node's native `child_process` / `execa` handles stdio streaming with minimal latency. |
| **Desktop Frontend** | **React 19 + Tailwind CSS + Radix UI + Zustand**<br>(Vite bundle inside Electron) | • Rich component ecosystem and rapid development with Tailwind CSS.<br>• **UI Primitives**: Uses **Radix UI** headless primitives (`@radix-ui/react-*` / `shadcn/ui` pattern) for accessible, focus-trapped approval dialogs, collapsible reasoning blocks, dropdown menus, and tooltips.<br>• **Critical Constraint**: To prevent 60fps re-render bottlenecks during high-throughput token streaming (100+ tokens/sec), delta updates must buffer via `requestAnimationFrame` or mutate dedicated message-slice refs rather than triggering root-level state re-renders. |
| **Desktop Wrapper** | **Electron (Thin Shell)** | • Electron serves merely as the desktop container launching the Node.js daemon and hosting the React Vite UI.<br>• Desktop UI connects to `http://127.0.0.1:7890` as an ordinary client. |
| **Mobile Client** | **Native Swift 5.10+ / SwiftUI (iOS 17+)** | • Uses native `URLSessionWebSocketTask` for resilient socket streams.<br>• Uses `NWBrowser` for Bonjour/mDNS discovery.<br>• Uses CryptoKit for Ed25519 signing and iOS Keychain for key storage.<br>• **Zero Local Database**: Purely in-memory UI state, completely eliminating sync engines and migration headaches. |
| **Schema & Codegen** | **TypeBox (JSON Schema) $\to$ Swift CodeGen** | • `packages/protocol-schema` defines all models using `@sinclair/typebox`.<br>• Fast JSON Schema validation on the Host.<br>• Quicktype CLI script (`pnpm run codegen`) compiles schemas directly into Swift `Codable` structs in `mobile/ios/Models/Generated/`. |

#### Monorepo Workspace Structure (`pnpm-workspace.yaml`)
```
codex-anywhere/
├── canywhere/
│   ├── package.json
│   ├── pnpm-workspace.yaml
│   ├── packages/
│   │   ├── protocol-schema/         # TypeBox schemas & JSON-RPC contracts + Codegen script
│   │   ├── host-server/             # Fastify + WebSocket + SQLite + CLI Adapters (Codex)
│   │   ├── desktop-ui/              # React 19 + Tailwind + Zustand (Vite)
│   │   └── desktop-app/             # Minimal Electron main process wrapper
│   ├── mobile/
│   │   └── ios/                     # Xcode Project: SwiftUI native app (Zero local DB)
│   └── docs/                        # Architecture & interface specifications
└── codex/                           # Upstream OpenAI Codex reference repository
```

---

## 3. Core System Components

### 3.1 Host (Electron Main Process)
The Host main process is the orchestrator and server. It runs headless services in Node.js:
- **Local API Server**: Listens on a configurable port (default: `7890`) bound to `0.0.0.0` or specific interfaces (LAN and Tailscale `100.x.y.z`). Exposes authenticated REST and WebSocket protocols.
- **Pairing & Discovery Service**: 
  - Advertises the service across the local network using mDNS / DNS-SD (`_canywhere._tcp.local`).
  - Generates single-use, time-bounded pairing tokens and encodes them into QR codes alongside host connection candidates (LAN IP, Tailscale IP, MagicDNS hostname).
- **Session & Persistence Store**: Powered by SQLite (`better-sqlite3` or embedded SQLite). Stores workspaces, chat threads, turn histories, approval logs, and authorized device credentials.
- **CLI Adapter Manager**: Supervises provider lifecycles, health checks, subprocess spawning, stdio piping, and thread multiplexing.
- **File System & Workspace Service**: Resolves directory structures, calculates file diffs, checks permissions, and monitors file changes via `chokidar`.

### 3.2 Mobile Client (iOS / Swift)
Native iOS app targeting iOS 17+ built with Swift and SwiftUI:
- **Discovery & Connection Manager**: Scans LAN via `NWBrowser` for Bonjour advertisements. Supports manual entry and deep-linking of Tailscale hostnames. Implements automatic failover (LAN $\leftrightarrow$ Tailscale) with exponential backoff.
- **Pairing Client**: Reads pairing QR codes via `AVFoundation`, conducts mutual public-key exchange, and securely stores the client private key in iOS Keychain.
- **Interactive Turn & Approval UI**: Renders real-time markdown deltas, collapsible reasoning blocks, tool execution pills, and interactive approval banners with syntax-highlighted diffs.
- **Zero Local Data Persistence (No Offline Mode)**: The mobile client deliberately avoids running an embedded database (no SwiftData / CoreData). Message histories, workspace structures, and thread states are held strictly in memory while connected and fetched on-demand from the Host. Only device credentials (Ed25519 keypair in Keychain) and Host connection endpoints are stored locally. If disconnected from the Host, the client presents a connection-status screen rather than stale cached data.

### 3.3 CLI Adapter Layer
An abstraction separating UI and session semantics from underlying CLI agent specifics:
- Translates high-level operations (`createThread`, `sendTurn`, `interruptTurn`, `respondApproval`) into CLI-specific RPC or stdio signals.
- Standardizes diverse output formats into a unified stream of `AgentEvent` objects.

```typescript
export interface CliAdapter {
  readonly id: string;
  readonly capabilities: AdapterCapabilities;

  /** Lifecycle management */
  start(): Promise<void>;
  stop(): Promise<void>;
  isHealthy(): Promise<boolean>;

  /** Thread operations */
  createThread(params: CreateThreadParams): Promise<ThreadHandle>;
  resumeThread(threadId: string): Promise<ThreadHandle>;
  archiveThread?(threadId: string): Promise<void>;

  /** Turn operations */
  sendTurn(threadId: string, input: TurnInput): AsyncIterable<AgentEvent>;
  steerTurn?(threadId: string, input: TurnInput): Promise<void>;
  interruptTurn(threadId: string): Promise<void>;

  /** Approval handling */
  respondApproval(requestId: string, decision: ApprovalDecision): Promise<void>;
}

export interface AdapterCapabilities {
  workspace: boolean;         // Supports binding to a project directory
  multiRoot: boolean;         // Supports multiple directory roots simultaneously
  approvals: boolean;         // Supports execution/diff approval workflows
  resumeThread: boolean;      // Supports reloading existing threads
  standaloneChat: boolean;    // Supports running without any project directory
  steering: boolean;          // Supports mid-turn user guidance (turn/steer)
}
```

---

## 4. Domain Data Models

```typescript
/** CLI Provider descriptor */
interface Provider {
  id: string;                                 // e.g., "codex", "grok"
  name: string;                               // e.g., "OpenAI Codex"
  version: string;
  capabilities: AdapterCapabilities;
  status: "ready" | "unavailable" | "error";
  statusMessage?: string;
}

/** Workspace binding */
interface Workspace {
  id: string;                                 // UUID v4
  name: string;                               // User-friendly display name
  rootPath: string;                           // Absolute host filesystem path
  subPaths: string[];                         // Additional roots (if multiRoot supported)
  providerId: string;
  createdAt: number;                          // Unix timestamp (ms)
  lastOpenedAt: number;
}

/** Conversation Chat */
interface Chat {
  id: string;                                 // Host UUID v4
  kind: "workspace" | "standalone";
  workspaceId?: string;                       // Present when kind === "workspace"
  providerId: string;
  title: string;
  externalThreadId?: string;                  // Underlying provider ID (e.g. Codex threadId)
  status: "idle" | "running" | "awaiting_approval" | "error";
  createdAt: number;
  updatedAt: number;
}

/** Discrete Chat Message */
interface Message {
  id: string;                                 // UUID v4
  chatId: string;
  turnId?: string;                            // Underlying provider turn identifier
  role: "user" | "agent" | "system";
  blocks: MessageBlock[];
  createdAt: number;
  streaming: boolean;
}

/** Polymorphic Content Blocks */
type MessageBlock = 
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string; completed: boolean }
  | { type: "plan"; content: string }
  | { type: "tool_call"; callId: string; name: string; args: Record<string, unknown>; output?: string; status: "running" | "completed" | "failed" }
  | { type: "file_diff"; path: string; patch: string; status: "proposed" | "applied" | "rejected" }
  | { type: "command_exec"; command: string; cwd: string; output?: string; exitCode?: number; status: "pending_approval" | "running" | "completed" | "failed" };

/** Action Approval Request */
interface ApprovalRequest {
  id: string;                                 // Unique host approval request ID
  chatId: string;
  turnId: string;
  externalRequestId: string;                  // Request ID used by the underlying provider
  kind: "command" | "file_change" | "user_input";
  payload: {
    command?: string;
    cwd?: string;
    reason?: string;
    diff?: string;
    path?: string;
    prompt?: string;                          // For user_input requests
  };
  status: "pending" | "approved" | "denied" | "canceled";
  requestedAt: number;
  resolvedAt?: number;
  resolvedByDeviceId?: string;
}

/** Paired Client Device */
interface Device {
  id: string;                                 // Public key fingerprint or UUID
  name: string;                               // e.g. "Tien's iPhone 15 Pro"
  platform: "ios" | "desktop";
  publicKey: string;                          // Ed25519 public key in base64
  pairedAt: number;
  lastSeenAt: number;
  lastTransport: "lan" | "tailscale";
  revoked: boolean;
}

/** Ephemeral Pairing Handshake Session */
interface PairingSession {
  token: string;                              // High-entropy one-time secret
  expiresAt: number;                          // TTL ~5 minutes
  hostPublicKey: string;
  candidateAddresses: string[];               // e.g. ["192.168.1.50:7890", "my-mac.tailnet.ts.net:7890"]
  consumed: boolean;
  consumedByDeviceId?: string;
}
```

---

## 5. Pairing, Networking & Security

### 5.1 Discovery Mechanisms
- **LAN Discovery (Bonjour / mDNS)**:
  - The Host registers service `_canywhere._tcp.local` on the active port.
  - TXT records include: `hostId`, `version`, `tlsFingerprint`.
  - The iOS app uses `NWBrowser` to automatically discover active hosts on the local subnet without manual IP entry.
- **Tailscale Discovery**:
  - For remote access outside the home/office network, the Host detects its local Tailscale IP (`100.x.y.z`) and MagicDNS FQDN (via `tailscale status --json` or local API).
  - The pairing QR code encodes both LAN and Tailscale candidate endpoints.

### 5.2 One-Time Cryptographic Pairing Flow
```
Host                                                     Mobile (iOS)
  │                                                           │
  ├─ 1. Generate PairingSession                               │
  │     (Token, TTL=300s, HostKeypair)                        │
  ├─ 2. Display QR on Desktop Screen                          │
  │     Payload: { hostId, token, endpoints, hostPubkey }     │
  │                                                           │
  │                                                           ├─ 3. Scan QR Code
  │                                                           ├─ 4. Generate DeviceKeypair (Ed25519)
  │                                                           │     Save PrivateKey in iOS Keychain
  │                                                           │
  │  POST /api/v1/pair                                        │
  │  { token, deviceId, deviceName, devicePublicKey }         │
  │◄──────────────────────────────────────────────────────────┤
  │                                                           │
  ├─ 5. Verify token validity and TTL                         │
  ├─ 6. Register Device (devicePublicKey)                     │
  ├─ 7. Invalidate Pairing Token                              │
  │                                                           │
  │  HTTP 200 OK                                              │
  │  { status: "paired", authToken: signedJwtOrProof }        │
  ├──────────────────────────────────────────────────────────►│
  │                                                           │
  │                                                           ├─ 8. Complete pairing UI
```

### 5.3 Daily Connection & Authentication
Subsequent connections use persistent WebSockets without displaying the QR code:
1. Mobile initiates WebSocket connection to preferred candidate address (LAN first, falling back to Tailscale).
2. Host presents a random cryptographic challenge (`nonce`).
3. Mobile signs `nonce + hostId + timestamp` using its stored Ed25519 private key.
4. Host verifies signature against stored `devicePublicKey`. If valid and `device.revoked === false`, the connection is upgraded to authenticated state.

### 5.4 Remote Execution Security Controls
Allowing a mobile phone to authorize commands executing on a primary development machine requires strict security guardrails:
1. **Host-Enforced Execution Profiles**:
   - `Strict Mode (Default)`: All command executions and file patches outside the workspace require manual confirmation. Shell commands display exact command line, working directory, and risk tags.
   - `Desktop-Only Approval Mode`: Mobile client can view chats and send user prompts, but approval buttons are disabled on mobile; approvals must be clicked physically on the desktop.
   - `Relaxed Mode`: Auto-approves safe read-only commands (e.g. `git status`, `ls`, `cat`), while mutating actions (`rm`, `git reset`, script executions) still prompt.
2. **Instant Device Revocation**:
   - The desktop Host UI provides a "Connected Devices" dashboard with immediate "Revoke" actions that sever active WebSockets and blacklists keys.
3. **Transport Layer Security**:
   - **LAN**: Self-signed TLS certificate generated on first Host launch, with certificate SHA-256 fingerprint pinned during the QR code pairing exchange.
   - **Tailscale**: Encrypted automatically end-to-end via WireGuard; authenticated at the application layer via device signature.

---

## 6. Host $\leftrightarrow$ Client Protocol Specification

The protocol uses a unified JSON-RPC 2.0-style envelope for requests, responses, and real-time streaming notifications over both HTTP and WebSocket.

### 6.1 Envelope Formats

#### Client-to-Server Request:
```json
{
  "id": "req-101",
  "method": "chat.message.send",
  "params": {
    "chatId": "c56a-...",
    "content": "Please inspect the error in tests/auth.rs and fix it."
  }
}
```

#### Server-to-Client Response:
```json
{
  "id": "req-101",
  "result": {
    "turnId": "turn-55",
    "status": "running"
  }
}
```

#### Server-to-Client Notification / Stream Event:
```json
{
  "method": "chat.message.delta",
  "params": {
    "chatId": "c56a-...",
    "turnId": "turn-55",
    "delta": {
      "type": "text",
      "text": "I'm checking the test assertions now..."
    }
  }
}
```

### 6.2 API Method Catalog

| Domain | Method | Type | Description |
|---|---|---|---|
| **System** | `system.info` | Request/Response | Get host OS, version, active adapters, paired devices |
| **Provider** | `provider.list` | Request/Response | List supported CLI providers and their capabilities |
| **Workspace** | `workspace.list` | Request/Response | List all registered local workspaces |
| **Workspace** | `workspace.create` | Request/Response | Register a local directory as a new workspace |
| **Workspace** | `workspace.tree` | Request/Response | Query directory tree hierarchy (with depth filter) |
| **Chat** | `chat.list` | Request/Response | List active conversations (filtered by workspace or standalone) |
| **Chat** | `chat.create` | Request/Response | Create a new conversation thread |
| **Chat** | `chat.get` | Request/Response | Retrieve full chat history, message blocks, and pending approvals |
| **Chat** | `chat.delete` | Request/Response | Delete chat and clean up provider session |
| **Turn** | `chat.turn.send` | Request/Response | Submit a user turn to the active thread |
| **Turn** | `chat.turn.interrupt` | Request/Response | Cancel an in-flight turn execution |
| **Turn** | `chat.turn.steer` | Request/Response | Guide an in-progress turn without interrupting |
| **Approval** | `chat.approval.respond` | Request/Response | Submit user decision (`accept`, `decline`, `cancel`) |
| **Device** | `device.list` | Request/Response | View all registered paired devices |
| **Device** | `device.revoke` | Request/Response | Revoke access for a specific device |

### 6.3 Real-Time Streaming Notifications

| Event Name | Direction | Description |
|---|---|---|
| `chat.turn.started` | Server $\to$ Client | Emitted when CLI agent starts processing a turn |
| `chat.message.delta` | Server $\to$ Client | Incremental text, reasoning, or plan chunk |
| `chat.tool.started` | Server $\to$ Client | Notification that a tool call (shell, edit) has commenced |
| `chat.tool.completed` | Server $\to$ Client | Notification of tool execution output and exit status |
| `chat.approval.requested` | Server $\to$ Client | Agent is blocked awaiting approval (command exec / file diff) |
| `chat.approval.resolved` | Server $\to$ Client | Informs clients that an approval was handled (by any device) |
| `chat.turn.completed` | Server $\to$ Client | Turn ended (success, failed, or interrupted) + token metrics |
| `device.presence` | Server $\to$ Client | Broadcasts online/offline status of paired devices |

---

## 7. CLI Adapter #1: OpenAI Codex (`codex app-server`)

The initial reference implementation adapts `codex app-server`, the JSON-RPC interface powering the official Codex editor integrations.

### 7.1 Real-World `codex app-server` Protocol Characteristics
Based on analysis of the `codex app-server` implementation in `codex-rs`:
- **Subprocess & Transport**: Runs as a long-lived local subprocess. Communication happens over **stdio** via **NDJSON** (newline-delimited JSON-RPC 2.0 without `"jsonrpc":"2.0"` wire boilerplate).
- **Process Multiplexing**: A **single** `codex app-server` process can host and multiplex multiple active threads concurrently. Spawning a new subprocess per conversation is unnecessary; one long-lived daemon handles all sessions.
- **Connection Handshake**:
  1. Client sends `initialize` request with client info and optional capabilities.
  2. Server responds with server metadata (`codexHome`, platform information).
  3. Client acknowledges with `initialized` notification.
- **Thread Lifecycle**:
  - `thread/start`: Initializes a thread. Accepts `cwd` (working directory), optional experimental `runtimeWorkspaceRoots` (for multi-root workspaces), and sandbox / approval policies. Returns thread ID and emits `thread/started`.
  - `thread/resume`: Resumes a persisted historical thread by ID.
  - `thread/fork`: Branches an existing thread into an independent branch.
- **Turn Lifecycle**:
  - `turn/start`: Dispatches user input. Accepts `threadId`, `input: Vec<TurnInputItem>`, model overrides, and permissions.
  - `turn/steer`: Injects mid-flight user steering into an active turn.
  - `turn/interrupt`: Requests cooperative cancellation of an in-flight turn.
  - Events streamed: `item/started`, `item/agentMessage/delta`, `item/reasoning/delta`, `item/plan/delta`, `item/completed`, `turn/completed`.

### 7.2 Approval Protocols in Codex
Codex implements server-initiated requests during a turn:
1. **Command Execution Approval**:
   - Server emits `item/started` for `commandExecution`.
   - Server sends `item/commandExecution/requestApproval` with `requestId`, `command`, `cwd`, `reason`, and `availableDecisions`.
   - Client must respond with JSON-RPC result:
     ```json
     { "decision": "accept" } 
     // or "acceptForSession", "decline", "cancel"
     ```
   - Server confirms with `serverRequest/resolved` and concludes with `item/completed`.
2. **File Change Approval**:
   - Server emits `item/started` with `fileChange` diff chunk summary.
   - Server sends `item/fileChange/requestApproval` with `requestId`, `itemId`, `reason`.
   - Client responds with `{ "decision": "accept" }` or `{ "decision": "decline" }`.
3. **User Input Requests**:
   - Server sends `item/tool/requestUserInput` with `isBlocking: true`.
   - Client responds with user answers.

### 7.3 `CodexAdapter` Implementation Mapping

```
Host (Canywhere Core)                      CodexAdapter                   codex app-server
         │                                      │                                 │
         ├─ createThread(workspace) ───────────►│                                 │
         │                                      ├─ thread/start { cwd } ─────────►│
         │                                      │◄─ thread/started ───────────────┤
         │◄─ ThreadHandle ──────────────────────┤                                 │
         │                                      │                                 │
         ├─ sendTurn(threadId, "fix bug") ─────►│                                 │
         │                                      ├─ turn/start { threadId } ──────►│
         │                                      │◄─ item/agentMessage/delta ──────┤
         │◄─ AgentEvent(TextDelta) ─────────────┤                                 │
         │                                      │◄─ item/commandExecution/... ────┤
         │◄─ AgentEvent(ApprovalRequest) ───────┤   (request approval)            │
         │                                      │                                 │
         ├─ respondApproval("accept") ─────────►│                                 │
         │                                      ├─ RPC Response { accept } ──────►│
         │                                      │◄─ item/completed ───────────────┤
         │                                      │◄─ turn/completed ───────────────┤
         │◄─ AgentEvent(TurnCompleted) ─────────┤                                 │
```

---

## 8. Workspace & Standalone Chat Management

### 8.1 Workspace Management
- A workspace represents a primary codebase directory on the Host:
  - `rootPath`: Verified absolute path on the Host.
  - `subPaths`: Optional auxiliary directories. Codex supports `runtimeWorkspaceRoots` on `thread/start`, enabling multi-folder contexts. For adapters lacking native multi-root support, subpaths are exposed via context instructions or ignored gracefully.
- Each workspace can host multiple concurrent or sequential chats.
- Host monitors active workspace changes with a debounced file watcher to update the mobile file navigator in real-time.

### 8.2 Standalone (No-Workspace) Chat
- Standalone chats provide unrestricted reasoning without project repository attachment.
- **Handling CLI Restrictions**: Certain CLIs fail to start if launched without a valid working directory. When `capabilities.standaloneChat === false`, the Host transparently binds the session to a reserved scratch directory (`~/.canywhere/scratch/<providerId>/<chatId>`).
- UI explicitly segregates **Workspaces** and **General Chats** into distinct tabs to preserve mental clarity.

---

## 9. Mobile Client Architecture (iOS / Swift)

### 9.1 Technical Stack
- **Framework**: SwiftUI on iOS 17+.
- **Architecture**: Clean Architecture / MVVM with Swift Concurrency (`async/await`, `AsyncStream`).
- **Networking**: `URLSessionWebSocketTask` wrapped in a resilient state-machine actor (`ConnectionManager`).
- **State Management**: Purely in-memory Observable state models (no local SQLite/SwiftData database); iOS Keychain for device cryptographic keypair, UserDefaults for Host endpoints.
- **Security**: CryptoKit for Ed25519 signatures; iOS Keychain Services for storing device private keys.

### 9.2 State Machine & Connectivity
```
             ┌─────────────────────────┐
             │       DISCONNECTED      │
             └────────────┬────────────┘
                          │ Network available / App foreground
                          ▼
             ┌─────────────────────────┐
             │       DISCOVERING       │
             │ (Bonjour scan / Tailnet)│
             └────────────┬────────────┘
                          │ Candidate endpoint found
                          ▼
             ┌─────────────────────────┐
   ┌─────────┤       CONNECTING        │
   │ Fail    │     (TCP / TLS Handshake│
   │         └────────────┬────────────┘
   │                      │ Socket open
   │                      ▼
   │         ┌─────────────────────────┐
   │         │      AUTHENTICATING     │
   │         │   (Sign nonce challenge)│
   │         └────────────┬────────────┘
   │                      │ Auth verified
   │                      ▼
   │         ┌─────────────────────────┐
   │         │        CONNECTED        │
   │         │ (Sync state & stream WS)│
   └────────►└────────────┬────────────┘
                          │ Heartbeat loss / TCP RST
                          ▼
             ┌─────────────────────────┐
             │       RECONNECTING      │
             │ (Exponential backoff)   │
             └─────────────────────────┘
```

### 9.3 Mobile Approval Experience
Approvals on mobile must provide complete situational awareness before authorizing:
- **Command Approvals**:
  - Displays full bash command with command highlighting.
  - Shows working directory (`cwd`) relative to workspace root.
  - Highlights destructive patterns (e.g. `rm -rf`, `sudo`, `curl | sh`, git branch resets).
- **File Patch Approvals**:
  - Unified diff viewer highlighting additions (green) and deletions (red).
  - Target file path indicator.
- Single-tap actions: `Approve`, `Decline`, or `Cancel Turn`.

---

## 10. Edge Cases, Reliability & Open Technical Solutions

### 10.1 Background Notifications on iOS
- **Problem**: When the iOS app is backgrounded or suspended, WebSocket connections terminate after brief grace periods. Direct LAN/Tailscale connections cannot wake a suspended iOS app.
- **Solution Strategy**:
  - **Phase 1 (Direct)**: Maintain connection during active use. Provide brief background audio/VoIP entitlement for short grace windows. If disconnected, display a reconnecting status banner and automatically re-establish the live connection upon foregrounding.
  - **Phase 2 (Cloudless Local Push / APNs Relay)**: Introduce an optional, privacy-preserving notification relay. When a long turn finishes or requires approval, the Host dispatches an encrypted push trigger through an APNs gateway containing only `{ chatId, event: "approval_needed" }`. The phone wakes, establishes a direct Tailscale/LAN link, and fetches details.

### 10.2 Host Shutdown & Process Recovery
- **Problem**: If the Host machine sleeps or restarts mid-turn, what happens to ongoing turns?
- **Handling**:
  - On shutdown/crash, turns left in `running` status are updated in SQLite to `interrupted`.
  - On restart, the Host checks if the underlying adapter supports resumption (`thread/resume` for Codex). If the user re-opens the chat, the Host re-attaches to the thread and informs the user: *"Host restarted during last turn. You can continue the conversation or resubmit your prompt."*

### 10.3 Multi-Device Concurrent Interaction
- Multiple devices (Desktop + 1 or more iPhones/iPads) can observe the same chat concurrently.
- All deltas and approval requests broadcast to all connected devices.
- When Device A answers an approval, the Host broadcasts `chat.approval.resolved` with `resolvedByDeviceId`. Device B immediately dismisses the prompt and updates the UI to show *"Approved on Desktop"* or *"Approved on iPhone"*.

---

## 11. Implementation Roadmap & Milestones

### Phase 0: Host Core & Codex Adapter (Headless & Desktop)
- Setup Electron + Node.js foundation with embedded SQLite.
- Implement `CliAdapter` interface and concrete `CodexAdapter` interfacing with `codex app-server` over stdio.
- Validate thread creation, multi-turn exchanges, and streaming deltas locally.
- Build internal HTTP & WebSocket API server.
- Basic Electron desktop UI verifying core chat interactions.

### Phase 1: Local Discovery, Pairing & Mobile Chat MVP
- Implement mDNS/Bonjour advertiser on Host and `NWBrowser` client on iOS.
- Implement QR code pairing protocol with Ed25519 mutual authentication.
- Build iOS Swift/SwiftUI chat interface supporting standalone chats.
- Handle streaming text and reasoning blocks smoothly on iOS.

### Phase 2: Workspaces & Remote Approval Workflow
- Implement Workspace management (create, list, scan directories).
- Implement bidirectional approval flows for shell commands and file diffs.
- Build mobile diff renderer and secure approval modal.
- Host-side security controls (Desktop-only approval toggle).

### Phase 3: Tailscale Networking & Remote Mobility
- Integrate Tailscale detection on Host (candidate IP discovery).
- Implement automatic network transition handling on iOS (LAN $\to$ Tailscale seamlessly).
- Test connection stability across cellular networks and Wi-Fi handoffs.

### Phase 4: Second CLI Adapter (Grok / Claude Code)
- Implement `GrokAdapter` or `ClaudeCodeAdapter` to validate generic abstraction.
- Refine `CliAdapter` based on differences in subprocess streaming and error models.
- Support runtime switching of providers within the workspace.

### Phase 5: Polish, Background Notifications & Packaging
- Notification relay solution (APNs push triggers for approvals).
- Binary distribution: packaged Electron app for macOS/Linux/Windows, TestFlight build for iOS.
- Performance profiling for token-heavy conversations.
