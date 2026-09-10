# Contributing to Canywhere

Thank you for your interest in contributing to **Canywhere**! We are building a secure, high-performance bridge that decouples local autonomous coding assistants from developer workstations.

This document provides guidelines and workflows to ensure high engineering density, rigorous type safety, and seamless cross-platform collaboration.

---

## Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior following the guidelines in that document.

---

## Architectural Invariants

Before writing code, please review the core architectural invariants that govern this project:

1. **Host as Single Source of Truth (SSOT)**:
   - The desktop Host daemon (`canywhere-server`) owns all workspace management, process orchestration, SQLite persistence, and git operations.
   - The Mobile client (iOS) is a **zero-persistence live remote companion**. It holds chat threads strictly in-memory while connected. **Do not add local database storage (e.g. SwiftData, CoreData) to the iOS app.**
2. **Equal UI Citizenship**:
   - Both Desktop (Tauri / React) and Mobile (SwiftUI) consume the exact same JSON-RPC 2.0 and WebSocket API over `http://127.0.0.1:7890`. Desktop does not use private IPC shortcuts for business logic.
3. **Pluggable CLI Adapter Layer**:
   - The host server core is agent-agnostic. All CLI assistants implement the `CliAdapter` trait (`crates/canywhere-server/src/adapters/mod.rs`) and yield normalized `AgentEvent` streams.
4. **Single-Source Schema Contract**:
   - All shared network models, RPC methods, and notifications originate in `crates/canywhere-protocol`.
   - **Never manually edit generated files**:
     - `mobile/ios/Models/Generated/*`
     - `packages/desktop-ui/src/types/generated/*`
   - Always edit Rust types in `canywhere-protocol` and run `make codegen`.

---

## Prerequisites & Development Environment

To work across the entire stack, install:

* **Rust**: `1.80+` (`rustup update stable`)
* **Bun**: `1.2+` (`curl -fsSL https://bun.sh/install | bash`)
* **Node.js**: `20+` LTS (optional, for tools expecting node)
* **Xcode**: `16.0+` (for iOS development)
* **xcodegen**: (`brew install xcodegen`)
* **CLI assistants** (optional for end-to-end integration): `codex` and/or `agy`

---

## Common Development Workflows

We use a root `Makefile` to unify development commands across Rust, TypeScript, and Swift:

```bash
# 1. Install dependencies & build all targets (Rust + Desktop UI + iOS)
make build

# 2. Run test suites (Rust unit/integration tests + Vitest UI tests)
make test

# 3. Run typecheckers and linters
make check

# 4. Start the Host Server daemon in development
make server

# 5. Start Desktop UI Vite server
make ui-dev

# 6. Launch Desktop Tauri client
make desktop

# 7. Generate iOS Xcode project & compile for Simulator
make ios-build
```

---

## Contract-First Development & Codegen

When modifying or introducing new RPC endpoints, message block types, or session models:

1. Update Rust types in `crates/canywhere-protocol/src/`.
2. Ensure types derive `Serialize`, `Deserialize`, `JsonSchema`, and `TS`.
3. Run the codegen suite:
   ```bash
   make codegen
   ```
   This exports:
   - JSON schemas into `schemas/`
   - TypeScript interfaces into `packages/desktop-ui/src/types/generated/`
   - Swift structs into `mobile/ios/Models/Generated/` via `scripts/codegen-swift.ts`
4. Update `canywhere-server` RPC handlers and client views to satisfy the updated schema.

---

## Coding Standards

### 1. Rust (`crates/*`, `packages/desktop-app/src-tauri`)
* Format code with `cargo fmt` before committing.
* Ensure code passes `cargo clippy --workspace --all-targets -- -D warnings`.
* Use structured errors with `thiserror` for library crates and `anyhow` for application orchestration.
* SQLite connections must enable WAL mode and foreign key constraints.
* Stdio subprocess streams must handle partial JSON lines with proper newline buffering.

### 2. TypeScript & React (`packages/desktop-ui`)
* Strict mode enabled (`strict: true`, `noImplicitAny: true`).
* Use **Radix UI** primitives and Tailwind CSS v4.
* Approvals and destructive confirmations must use `@radix-ui/react-alert-dialog` to enforce accessible focus trapping.
* **Streaming Performance**: Real-time token streams arrive at high frequencies (100+ tokens/sec). Avoid triggering top-level store re-renders on every token; use batching/throttling and isolate rendering to active message bubbles.

### 3. Swift & iOS (`mobile/ios`)
* Use modern Swift 6 Concurrency (`actor`, `async/await`, `AsyncStream`).
* Avoid legacy Combine or nested GCD completion handlers.
* Network operations live in actor-isolated services (e.g. `ConnectionManager`).
* Store device private keys securely in the iOS Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).

---

## Git Workflow & Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types:
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation changes
* `style`: Code style changes (formatting, missing semi-colons, etc.)
* `refactor`: Code change that neither fixes a bug nor adds a feature
* `perf`: Code change that improves performance
* `test`: Adding or correcting tests
* `build`: Changes to build system or external dependencies
* `ci`: Changes to CI configuration files and scripts
* `chore`: Maintenance tasks or repository housekeeping

### Examples:
* `feat(server): add support for tool call streaming in agy adapter`
* `fix(ios): prevent reconnection loop on invalid pairing token`
* `docs: update protocol spec for dual conversation modes`

---

## Submitting Pull Requests

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. **Implement changes** following the coding standards and architectural invariants.
3. **Verify locally**:
   ```bash
   make check
   make test
   ```
4. **Push your branch** and open a Pull Request against the `main` branch.
5. Provide a clear description in your PR using our PR template, detailing what changed, why, and how it was verified.
