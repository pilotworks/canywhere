# Canywhere — UI Wireframes & User Flows (Draft)

> **Document Purpose**: Complete visual text/ASCII wireframes and interaction flow specifications for both the **Desktop UI** (React 19 + Tailwind + Radix UI) and **Mobile Client** (iOS 17+ Native SwiftUI).

---

## 1. Design Language & UI Foundations

### 1.1 Aesthetic Target
- **Dark-First Developer Tool**: Aesthetic inspired by modern developer tooling (Linear, Raycast, Cursor).
- **High-Density, Low-Clutter**: Information-dense typography without wasted whitespace.
- **Accented States**:
  - `Neutral / Surface`: Zinc-900 (Canvas), Zinc-850 (Cards/Sidebar), Zinc-800 (Borders).
  - `Accent / Brand`: Indigo-500 (`#6366f1`) for active highlights and primary controls.
  - `Reasoning / Thinking`: Violet-400 / Purple-900 badge for Chain-of-Thought streaming.
  - `Success / Applied`: Emerald-500 for successful commands and accepted patches.
  - `Warning / Destructive`: Rose-500 / Amber-500 for dangerous shell commands (`rm`, `sudo`, branch resets).

---

## 2. Desktop UI Layout & Wireframes (React 19)

### 2.1 Main Application Shell

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [● ● ●]  Canywhere ─ Host: Localhost:7890 ─ ● Connected (1 Device Online: Tien's iPhone)               │
├───────────────────┬────────────────────────────────────────────────────────────────────────────────────┤
│ ❖ WORKSPACES      │ 📂 canywhere  ›  Branch: main  ›  Model: [ gpt-5-codex ▾ ]        [ Devices (1) ] │
│  ▸ codex-anywhere ├────────────────────────────────────────────────────────────────────────────────────┤
│  ▾ canywhere      │                                                                                    │
│    • auth-fix     │  🧑 You                                                                 10:42:15 AM │
│    • refactor-ws  │  Please inspect why `thread/start` rejects empty cwd and add fallback.            │
│  ▸ rust-backend   │                                                                                    │
│                   │  🤖 Codex (gpt-5-codex)                                                10:42:18 AM │
│ 💬 STANDALONE     │  ┌─ 🧠 Thinking (12.4s) ─────────────────────────────────────────────────────────┐ │
│  • Quick Ideas    │  │ Checking app-server protocol docs for thread/start params schema...            │ │
│  • Regex Helper   │  │ Identified that cwd is required unless ephemeral: true is passed.              │ │
│                   │  └───────────────────────────────────────────────────────────────────────────────┘ │
│ ───────────────── │                                                                                    │
│ [＋ New Chat]     │  I will inspect `thread.rs` and configure the scratch fallback directory.          │
│                   │                                                                                    │
│ [⚙ Settings]     │  ┌─ ⚙️ Executed Command ─────────────────────────────────────────────────────────┐ │
│ [📱 Pair Mobile]  │  │ $ git grep -n "thread/start" codex-rs/app-server-protocol/src/                │ │
│                   │  │ ↳ 4 matches found in `protocol/common.rs`                                      │ │
│                   │  └───────────────────────────────────────────────────────────────────────────────┘ │
│                   │                                                                                    │
│                   │  I've prepared the patch for `CodexAdapter` to inject a default scratch root.     │
│                   │                                                                                    │
│                   ├────────────────────────────────────────────────────────────────────────────────────┤
│                   │ ┌────────────────────────────────────────────────────────────────────────────────┐ │
│                   │ │ Ask anything or type / for commands...                                         │ │
│                   │ └────────────────────────────────────────────────────────────────────────────────┘ │
│                   │  ⚡ Context: 4 files (32k tokens)      [ ⏏ Scratch Mode ]         [ Send ↵ ]       │
└───────────────────┴────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Command & Patch Approval Modal (`@radix-ui/react-alert-dialog`)

Triggered whenever `item/commandExecution/requestApproval` or `item/fileChange/requestApproval` is received by the Host. Focus is strictly trapped; background clicks are disabled.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ APPROVAL REQUIRED                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  The agent is requesting permission to execute an external shell command:    │
│                                                                              │
│  ┌─ COMMAND EXECUTION ─────────────────────────────────────────────────────┐ │
│  │ $ rm -rf target/debug && cargo build --release                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  • Working Directory:  `/Users/tienpham/Work/canywhere/packages/host-server` │
│  • Risk Evaluation:    🚨 HIGH RISK — Destructive command detected (`rm -rf`)│
│  • Target Environment: Local Host Workstation                                │
│                                                                              │
│  Proposed Policy Amendment:                                                  │
│  [ ] Remember decision for the remainder of this session                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ Cancel Turn ]         [ ✕ Decline ]              [ ✓ Approve Command ↵ ]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 QR Pairing & Connected Devices Modal

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  📱 Pair Remote Mobile Device                                    [✕ Close]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│       ┌────────────────────────┐      Scan this QR code from the Canywhere   │
│       │ ██████████████████████ │      iOS app to establish an encrypted,     │
│       │ ██  ████  ██  ████  ██ │      authenticated peer connection.         │
│       │ ██████████████████████ │                                             │
│       │ ██  ██  ██████  ██  ██ │      • Local LAN:     192.168.1.104:7890    │
│       │ ██████  ██  ██  ██████ │      • Tailscale:     my-mac.ts.net:7890    │
│       │ ██████████████████████ │      • Expires In:    04:32 (Single use)    │
│       └────────────────────────┘                                             │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│  CURRENTLY PAIRED DEVICES                                                    │
│                                                                              │
│  • Tien's iPhone 15 Pro     Last seen: Just now (via LAN)       [ Revoke ✕ ] │
│    Key: `ed25519:e8f2...9a1b`                                                │
│                                                                              │
│  • Tien's iPad Mini         Last seen: 2 days ago (via TS)      [ Revoke ✕ ] │
│    Key: `ed25519:12c4...7f8d`                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mobile Client Layout & Wireframes (iOS / SwiftUI)

The mobile client is a **Zero-Persistence Live Terminal**. It maintains no local database; all data is hydrated dynamically while connected.

### 3.1 Mobile Connection States

#### State A: Disconnected / Auto-Discovering
When the Host is unreachable or the app just opened:

```
┌───────────────────────────┐
│ 09:41                 📶🔋 │
├───────────────────────────┤
│                           │
│          📡               │
│     Connecting...         │
│                           │
│  Searching for Host on    │
│  LAN (_canywhere._tcp)    │
│  and Tailscale...         │
│                           │
│  ┌─────────────────────┐  │
│  │ ◌ Candidate:        │  │
│  │   192.168.1.104     │  │
│  └─────────────────────┘  │
│                           │
│  [ Pair New Host (QR) ]   │
│                           │
└───────────────────────────┘
```

#### State B: Live Home Screen (Connected)
```
┌───────────────────────────┐
│ 09:41                 📶🔋 │
├───────────────────────────┤
│ Canywhere      ● Mac-Mini │
│ [ Workspaces ] [ Chats ]  │
├───────────────────────────┤
│ WORKSPACES                │
│                           │
│ 📂 canywhere              │
│   • auth-fix   (Running)  │
│   • dev-docs   (Idle)     │
│                           │
│ 📂 codex-rs               │
│   • app-server (Idle)     │
│                           │
│ 💬 STANDALONE CHATS       │
│   • Rust Syntax Q&A       │
│   • Bash script helper    │
│                           │
├───────────────────────────┤
│ [＋ New Workspace Chat]   │
└───────────────────────────┘
```

---

### 3.2 Mobile Active Chat Screen

```
┌───────────────────────────┐
│ ‹ Back  canywhere:auth-fix│
│         ● Connected       │
├───────────────────────────┤
│                           │
│ 🧑 You                    │
│ Run the test suite and    │
│ check why token auth fails│
│                           │
│ 🤖 Codex                  │
│ ┌─ 🧠 Thinking (8.1s) ──┐ │
│ │ Checking test fixtures│ │
│ └───────────────────────┘ │
│                           │
│ I will run cargo test:    │
│                           │
│ ┌─ ⚡ cargo test -p auth─┐│
│ │ running 4 tests       │ │
│ │ test test_ok ... ok   │ │
│ │ test test_exp ... FAIL│ │
│ └───────────────────────┘ │
│                           │
│ Test failed due to expired│
│ token TTL in mock data.   │
│                           │
├───────────────────────────┤
│ ┌───────────────────────┐ │
│ │ Message agent...      │ │
│ └───────────────────────┘ │
│ [ ⚡ Prompt ]    [ ⏏ Steer ]│
└───────────────────────────┘
```

---

### 3.3 Mobile Interactive Approval Bottom Sheet

When a command requires user consent, an iOS modal sheet pops up with **haptic feedback** (`UINotificationFeedbackGenerator.warning`):

```
┌───────────────────────────┐
│                           │
│  ═══════════════════════  │
│  ⚠️ APPROVAL REQUESTED    │
│  Host: Mac-Mini (Desktop) │
├───────────────────────────┤
│                           │
│  $ git checkout -B main   │
│    && git reset --hard    │
│                                                │
│  📂 /Users/tienpham/canywhere                  │
│                                                │
│  🚨 Risk: DESTRUCTIVE GIT                      │
│     May overwrite uncommitted changes.         │
│                                                │
│  Reason: Clean working tree before patch.      │
│                                                │
├───────────────────────────┤
│  [ ✓ APPROVE EXECUTION ]  │ (Green button)     │
│                           │                    │
│  [ ✕ DECLINE COMMAND ]    │ (Secondary button) │
│                           │                    │
│  [ Cancel In-Flight Turn ]│ (Muted red text)   │
└───────────────────────────┘
```

---

## 4. End-to-End User Interaction Flows

### 4.1 Flow 1: First-Time One-Shot Pairing

```
Desktop Host (Screen)                                   Mobile iOS App (Camera)
        │                                                           │
   1. User clicks "Pair Mobile"                                     │
   2. Host displays Pairing QR:                                     │
      { token, hostPubkey, candidates }                             │
        │                                                           │
        │                                                      3. User taps "Scan QR"
        │                                                      4. Camera scans payload
        │                                                      5. Generate Curve25519 Keypair
        │                                                         (Store PrivKey in Keychain)
        │                                                           │
        │◄─── 6. POST /api/v1/pair ─────────────────────────────────┤
        │        { token, deviceId, devicePublicKey }               │
   7. Validate token TTL (≤ 300s)                                   │
   8. Save devicePublicKey to SQLite                                │
   9. Burn pairing token                                            │
        │                                                           │
        ├──── 10. HTTP 200 OK { hostId, status: "paired" } ────────►│
   11. Update UI:                                              12. Update UI:
       "Tien's iPhone Connected"                                   "Connected to Mac-Mini"
```

---

### 4.2 Flow 2: Live Turn Streaming & Dual-Client Rendering

When user sends a prompt from either device, both interfaces receive delta streams simultaneously:

```
Mobile Client               Host Server (Node.js)             Desktop UI
      │                              │                            │
 1. User submits turn                │                            │
      ├─ turn.send { chatId, "fix" }►│                            │
      │                              ├─ Broadcast "turn.started" ─► Render user message
      │                              ├─ Call CodexAdapter         │
      │                              │  turn/start                │
      │                              │                            │
      │                              │◄─ item/agentMessage/delta ─┤ (from codex)
      │◄─ chat.message.delta ────────┼─ chat.message.delta ──────►│
      │   (Buffer 25ms ──► Render)   │   (Buffer 25ms ──► Render) │
      │                              │                            │
      │                              │◄─ item/reasoning/textDelta ┤
      │◄─ chat.reasoning.delta ──────┼─ chat.reasoning.delta ────►│
      │   (Append to Collapsible)    │   (Append to Collapsible)  │
      │                              │                            │
      │                              │◄─ turn/completed ──────────┤
      │◄─ chat.turn.completed ───────┼─ chat.turn.completed ─────►│
```

---

### 4.3 Flow 3: Remote Mobile Approval with Desktop Sync

A high-risk command triggers an approval request. When Mobile authorizes, Desktop instantly reflects the resolution without user collision:

```
codex app-server        Host Server (Node.js)          Mobile Client         Desktop UI
      │                          │                           │                   │
 1. Command requires approval    │                           │                   │
      ├─ requestApproval ───────►│                           │                   │
      │  (cmd: "rm -rf build")   ├─ approval.requested ─────►│ (Haptic buzz)     │
      │                          │  { id: "app-1", cmd }     │   Show Sheet      │
      │                          │                           │                   │
      │                          ├─ approval.requested ─────────────────────────►│ Show AlertDialog
      │                          │                                               │
      │                          │◄── 2. User taps "Approve" ┤                   │
      │                          │    approval.respond       │                   │
      │                          │    { id: "app-1",         │                   │
      │                          │      decision: "accept" } │                   │
      │                          │                           │                   │
 3. Send RPC Response            │                           │                   │
   { decision: "accept" } ◄──────┤                           │                   │
      │                          ├─ 4. approval.resolved ───►│ Dismiss Sheet     │
      │                          │     { by: "iPhone" }      │                   │
      │                          │                           │                   │
      │                          ├─ 5. approval.resolved ───────────────────────►│ Dismiss Dialog
      │                          │     { by: "iPhone" }      │                   │ (Badge: "Approved
      │                          │                           │                   │  from Mobile")
 4. Execute command & stream     │                           │                   │
    output...                    │                           │                   │
```

---

### 4.4 Flow 4: Mid-Turn Steering & Cooperative Interruption

```
User (Desktop or Mobile)                  Host Server                    codex app-server
           │                                   │                                 │
      1. Turn is actively streaming            │                                 │
           │                                   │                                 │
      2. User notices incorrect direction      │                                 │
         Taps [ ⏏ Steer ] with new prompt      │                                 │
           ├─ chat.turn.steer ────────────────►│                                 │
           │  { expectedTurnId: "turn-1",      ├─ turn/steer ───────────────────►│
           │    prompt: "Stop, check X first" }│  (Injects steering into model)  │
           │                                   │                                 │
           │                                   │◄─ item/agentMessage/delta ──────┤
           │◄─ Streaming pivots immediately ───┼─ (Reflects steered guidance) ───┤
           │                                   │                                 │
      3. OR User taps [ ✕ Interrupt ]          │                                 │
           ├─ chat.turn.interrupt ────────────►│                                 │
           │                                   ├─ turn/interrupt ───────────────►│
           │                                   │◄─ turn/completed (interrupted) ─┤
           │◄─ chat.turn.completed ───────────┴─────────────────────────────────┤
           │   (Status: "interrupted")                                           │
```

---

### 4.5 Flow 5: Device Revocation

```
Desktop Host (Connected Devices Screen)                       Mobile Client (iPhone)
                  │                                                     │
 1. User clicks [ Revoke Device ]                                       │
    on "Tien's iPhone 15 Pro"                                           │
                  │                                                     │
 2. Host SQLite updates:                                                │
    `UPDATE devices SET revoked = 1`                                    │
 3. Host immediately terminates WebSocket:                              │
    `ws.close(4001, "Device revoked by host")`                          │
                  │                                                     │
                  ├────────────────── Socket Closed ───────────────────►│
                  │                                                4. Receive close code 4001
                  │                                                5. Purge stored session tokens
                  │                                                6. Transition UI to:
                  │                                                   "Device Revoked by Host.
                  │                                                    Pair again to connect."
```

---

## 5. UI Error & Edge Case Specifications

| Scenario | UI Experience on Desktop | UI Experience on Mobile |
|---|---|---|
| **Host Machine Sleep / Network Drop** | Status indicator turns amber: `Host Reconnecting...` | Top banner: `Host Offline (Retrying via Tailscale...)`. Chat becomes read-only with disabled inputs. |
| **CLI Agent Crash (e.g. Codex killed)** | Toast alert: `Codex subprocess exited unexpectedly (Code 137). Restarting daemon...` | Notification banner: `Agent restarted. Session preserved.` Inputs re-enabled after recovery. |
| **Simultaneous Approvals** | If Desktop approves first, Mobile sheet auto-dismisses with a green toast: *"Approved on Desktop"*. | If Mobile approves first, Desktop dialog auto-dismisses with: *"Approved on iPhone"*. |
| **Invalid Working Directory** | Path picker turns red: `Directory not found or inaccessible`. | Workspace creation modal shows validation error before submitting. |
| **Huge Token Output Spike (100k tokens)** | Virtualized message list avoids DOM node bloat; streaming buffers batches into 30ms updates. | SwiftUI `ScrollViewReader` maintains smooth 60fps pinning at bottom without freezing main thread. |
