# Canywhere — Developer & AI Agent Guidelines

> This document defines the engineering standards, architecture invariants, coding conventions, and workflows for agents and developers working on the **Canywhere** project.

---

## 1. Project Vision & Architecture Invariants

**Canywhere** decouples local autonomous coding assistants (such as OpenAI Codex and Grok CLI) from developer workstations, providing a secure, real-time remote control interface on Mobile (iOS) and Desktop (Electron).

### Non-Negotiable Invariants:
1. **Host as Single Source of Truth (SSOT)**:
   - The desktop Host (Node.js daemon) is the sole owner of workspace access, process spawning, SQLite persistence, and CLI orchestration.
   - The Mobile client is a **zero-persistence live client** (no offline database, no SwiftData / CoreData). When disconnected from the Host, Mobile displays a connection-waiting state. When connected, state is streamed and retained strictly in-memory.
2. **Equal UI Citizenship**:
   - The Desktop UI (React) and Mobile UI (SwiftUI) are both clients to the Host's internal HTTP and WebSocket API (`http://127.0.0.1:7890`).
   - The Desktop UI never calls internal Host functions directly via proprietary IPC; it communicates over the standardized JSON-RPC 2.0 wire protocol.
3. **Pluggable CLI Adapter Layer**:
   - Core server logic must **never** couple to OpenAI Codex-specific structures directly.
   - All CLI interactions must implement the `CliAdapter` interface and yield normalized `AgentEvent` streams.
4. **Single-Source Schema Contract**:
   - Every network model and RPC method originates in `packages/protocol-schema` using `@sinclair/typebox`.
   - Swift models on iOS are strictly generated from JSON Schema via `quicktype` (`pnpm run codegen`). **Never** write or edit generated Swift models by hand.
5. **Zero AI Slop & High-Density Engineering**:
   - Write concise, concrete, strictly-typed code without decorative comments, useless boilerplate, or speculative abstractions before they are needed.
   - Documentation must stay factual, architectural, and tied directly to schemas, wire contracts, and real code. No marketing filler.

---

## 2. Monorepo Topology & Responsibility Boundaries

```
canywhere/
├── package.json                 # Monorepo root scripts & dev dependencies
├── pnpm-workspace.yaml          # Workspace configuration
├── packages/
│   ├── protocol-schema/         # TypeBox definitions, JSON-RPC schema & codegen script
│   ├── host-server/             # Fastify, WebSocket, SQLite, CLI Adapters (Codex)
│   ├── desktop-ui/              # React 19 + Tailwind CSS + Radix UI + Zustand (Vite)
│   └── desktop-app/             # Electron thin wrapper launching host-server & desktop-ui
├── mobile/
│   └── ios/                     # Native Xcode Project (SwiftUI, iOS 17+, zero local DB)
└── docs/                        # Architecture & API documentation (spec.md, codex-interfaces.md)
```

### Module Responsibilities:
- **`packages/protocol-schema`**:
  - Contains TypeBox definitions for: `Provider`, `Workspace`, `Chat`, `Message`, `MessageBlock`, `ApprovalRequest`, `Device`, `PairingSession`.
  - Defines the JSON-RPC request/response/notification envelope contracts.
  - Houses the `scripts/codegen-swift.ts` script.
- **`packages/host-server`**:
  - `src/server.ts`: Fastify HTTP + WebSocket initialization.
  - `src/db/`: SQLite database setup using `better-sqlite3` with WAL mode.
  - `src/discovery/`: mDNS / Bonjour advertiser (`bonjour-service`) and Tailscale IP resolver.
  - `src/pairing/`: Ed25519 pairing token generator, QR payload encoder, and device manager.
  - `src/adapters/`: `CliAdapter` interface and implementations (`CodexAdapter`, etc.).
- **`packages/desktop-ui`**:
  - React 19 SPA built with Vite.
  - Zustand stores for connection, workspaces, active chat, and real-time token streaming.
- **`packages/desktop-app`**:
  - Minimal Electron main process responsible only for launching the background daemon, creating the browser window, and system tray management.
- **`mobile/ios`**:
  - Native Swift 5.10+ / SwiftUI application targeting iOS 17+.
  - `Models/Generated/`: Output directory for generated `Codable` Swift structs.
  - `Network/`: `ConnectionManager` actor managing Bonjour scanning (`NWBrowser`) and `URLSessionWebSocketTask`.
  - `Security/`: `CryptoKit` Ed25519 keypair generator and iOS Keychain wrapper.

---

## 3. Technology Stack & Coding Standards

### 3.1 TypeScript & Node.js (`host-server`, `protocol-schema`, `desktop-app`)
- **Node.js**: v20+ LTS. Use ESM (`"type": "module"`).
- **TypeScript**: Strict mode enabled (`"strict": true`, `"noImplicitAny": true`).
- **Database Rules**:
  - Always use `better-sqlite3`.
  - On startup, unconditionally enable WAL mode and foreign keys:
    ```typescript
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    ```
  - Use prepared statements (`db.prepare(...)`) for all parameterized operations.
- **Stdio & Process Streaming**:
  - When spawning CLI subprocesses (e.g. `codex app-server`), **never** assume `child.stdout.on('data')` yields complete JSON lines.
  - Always use Node's `readline` module or a robust newline-buffering transform to parse incoming NDJSON lines.
- **Error Handling**:
  - Use structured, typed errors. Never throw unhandled string errors.

### 3.2 React 19 & Desktop UI (`desktop-ui`)
- **Build Tool**: Vite.
- **Styling & Components**: Tailwind CSS + **Radix UI Primitives** (`@radix-ui/react-*`, following the `shadcn/ui` pattern).
  - **Approvals & Critical Actions**: Always use `@radix-ui/react-alert-dialog` for shell command / patch approvals to ensure accessible focus trapping, keyboard navigation, and prevention of accidental dismissals.
  - **Reasoning Blocks**: Use `@radix-ui/react-collapsible` for model thinking/reasoning streams.
  - **Menus & Pickers**: Use `@radix-ui/react-dropdown-menu` for model selectors, session menus, and workspace pickers.
- **State Management**: Zustand.
- **Streaming Performance (Critical)**:
  - Agent token deltas can arrive at 100–150 tokens/second.
  - **Do not** trigger a top-level Zustand store update on every raw token delta.
  - Implement a token buffer in the WebSocket listener that flushes batches into state every `16ms - 30ms` (using `requestAnimationFrame` or throttle).
  - Scope streaming text rendering to the active message component to prevent re-rendering the entire chat history list.

### 3.3 Swift & iOS Client (`mobile/ios`)
- **Language**: Swift 5.10+ or Swift 6.
- **Target OS**: iOS 17.0+.
- **UI Framework**: Pure SwiftUI.
- **Concurrency**: Use modern Swift Concurrency (`async/await`, `actor`, `AsyncStream`). Avoid legacy Combine or nested GCD completion handlers.
- **Networking**:
  - Use `URLSessionWebSocketTask` inside a dedicated `ConnectionManager` actor.
  - Handle reconnection with exponential backoff and jitter.
- **Zero Local Database**:
  - Do not import SwiftData or CoreData for chat records.
  - Thread state and turn items live exclusively in-memory inside `Observable` view models while connected.
- **Security**:
  - Device private key must be generated via `Curve25519.Signing.PrivateKey()` and stored strictly in the iOS Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

---

## 4. Contract-Driven Development Workflow

Whenever API methods, data models, or streaming notifications need to change:

1. **Modify Schema First**:
   - Edit the relevant TypeBox schema in `packages/protocol-schema/src/`.
2. **Compile Schemas**:
   - Run `pnpm run build` in `packages/protocol-schema`.
3. **Regenerate Swift Models**:
   - Run `pnpm run codegen` from the root directory.
   - Verify that `mobile/ios/Models/Generated/` reflects the updated Swift structs.
4. **Implement in Host**:
   - Update `packages/host-server` handlers and adapters to satisfy the new schema.
5. **Implement in Clients**:
   - Update `packages/desktop-ui` and `mobile/ios` UI views to render the new fields.

---

## 5. Codex CLI Adapter Guidelines (`CodexAdapter`)

When working on or refining the OpenAI Codex integration:

- **Reference Implementation**: Consult `/Users/tienpham/Work/entj-pham/codex-anywhere/codex/` and [docs/codex-interfaces.md](file:///Users/tienpham/Work/entj-pham/codex-anywhere/canywhere/docs/codex-interfaces.md).
- **Process Model**:
  - One long-running `codex app-server --stdio` subprocess multiplexes multiple conversations. Do not spawn a new process per chat unless explicitly isolating sandbox environments.
- **Handshake Order**:
  1. Send `initialize` request $\to$ receive `InitializeResponse`.
  2. Send `initialized` notification.
- **Thread Operations**:
  - Use `thread/start` with `cwd` and experimental `runtimeWorkspaceRoots` for workspaces.
  - For standalone chats, provide an invisible scratch directory (`~/.canywhere/scratch/codex/<chatId>`).
  - Use `thread/resume` to reload existing stored threads.
- **Turn Operations**:
  - Map user turn input to `UserInput::Text`.
  - Handle mid-turn guidance using `turn/steer`.
  - Cancel in-flight turns using cooperative `turn/interrupt`.
- **Approvals**:
  - Transform `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` into Canywhere `ApprovalRequest` objects.
  - When the user decides (`accept`, `decline`, etc.), send back the JSON-RPC response with matching ID over stdio.

---

## 6. Remote Security & Approval Guardrails

- **Execution Safety**:
  - Remote approval from mobile is high-risk. Shell commands must always display:
    - Full verbatim command string.
    - Resolved working directory.
    - Highlighted risk warnings (e.g., `rm -rf`, `sudo`, destructive git operations).
- **Device Revocation**:
  - If a device is revoked in the Host's Connected Devices screen, immediately sever its active WebSocket connection and blacklist its public key in SQLite.
- **Pairing Secret**:
  - Pairing tokens must expire in $\le 5$ minutes and must be strictly single-use.

---

## 7. Common Development Commands

```bash
# Install all dependencies across monorepo
pnpm install

# Build all packages
pnpm run build

# Run TypeScript typechecks
pnpm run typecheck

# Run unit and integration tests
pnpm run test

# Run code generator (TypeBox JSON Schema -> Swift Models)
pnpm run codegen

# Start Host server and Desktop UI in development mode
pnpm run dev
```
