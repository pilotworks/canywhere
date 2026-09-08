use anyhow::{bail, Result};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{broadcast, oneshot, Mutex};
use tracing::{error, info, warn};

use canywhere_protocol::models::*;

#[derive(Debug, Clone)]
pub enum AgentEvent {
    TokenDelta { chat_id: String, message_id: String, delta: String },
    BlockStarted { chat_id: String, message_id: String, block: MessageBlock },
    BlockCompleted { chat_id: String, message_id: String, block_id: String },
    ApprovalRequested { chat_id: String, request: ApprovalRequest },
    TurnCompleted { chat_id: String, turn_id: String, status: ChatStatus },
}

pub struct CodexAdapter {
    codex_bin: String,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    next_rpc_id: Arc<Mutex<i64>>,
    pending_rpcs: Arc<Mutex<HashMap<i64, oneshot::Sender<serde_json::Value>>>>,
    thread_to_chat: Arc<Mutex<HashMap<String, String>>>,
    chat_active_turn: Arc<Mutex<HashMap<String, (String, String)>>>,
    event_tx: broadcast::Sender<AgentEvent>,
}

impl CodexAdapter {
    pub fn new(codex_bin: &str) -> (Self, broadcast::Receiver<AgentEvent>) {
        let (event_tx, event_rx) = broadcast::channel(1024);
        let adapter = Self {
            codex_bin: codex_bin.to_string(),
            stdin: Arc::new(Mutex::new(None)),
            next_rpc_id: Arc::new(Mutex::new(1)),
            pending_rpcs: Arc::new(Mutex::new(HashMap::new())),
            thread_to_chat: Arc::new(Mutex::new(HashMap::new())),
            chat_active_turn: Arc::new(Mutex::new(HashMap::new())),
            event_tx,
        };
        (adapter, event_rx)
    }

    pub async fn initialize(&self) -> Result<()> {
        let mut child = Command::new(&self.codex_bin)
            .args(["app-server", "--stdio"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().expect("Child stdin not found");
        let stdout = child.stdout.take().expect("Child stdout not found");

        *self.stdin.lock().await = Some(stdin);

        // Spawn background NDJSON reader
        let pending = Arc::clone(&self.pending_rpcs);
        let thread_to_chat = Arc::clone(&self.thread_to_chat);
        let chat_turn = Arc::clone(&self.chat_active_turn);
        let tx = self.event_tx.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.trim().is_empty() { continue; }
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
                    Self::handle_incoming(msg, &pending, &thread_to_chat, &chat_turn, &tx).await;
                }
            }
        });

        // Initialize handshake
        self.send_request("initialize", serde_json::json!({
            "clientInfo": { "name": "canywhere-server", "version": "0.1.0" },
            "capabilities": { "experimentalApi": true }
        })).await?;

        self.send_notification("initialized", serde_json::json!({})).await?;
        info!("[CodexAdapter] Initialized successfully");
        Ok(())
    }

    pub async fn start_thread(&self, chat_id: &str, cwd: &str, sub_paths: Option<&[String]>) -> Result<String> {
        let res = self.send_request("thread/start", serde_json::json!({
            "cwd": cwd,
            "runtimeWorkspaceRoots": sub_paths
        })).await?;

        let thread_id = res["threadId"].as_str().unwrap_or("").to_string();
        self.thread_to_chat.lock().await.insert(thread_id.clone(), chat_id.to_string());
        Ok(thread_id)
    }

    pub async fn submit_turn(&self, chat_id: &str, thread_id: &str, message_id: &str, prompt: &str) -> Result<String> {
        let res = self.send_request("turn/start", serde_json::json!({
            "threadId": thread_id,
            "input": [{ "type": "text", "text": prompt }]
        })).await?;

        let turn_id = res["turnId"].as_str().unwrap_or("").to_string();
        self.chat_active_turn.lock().await.insert(chat_id.to_string(), (turn_id.clone(), message_id.to_string()));
        Ok(turn_id)
    }

    pub async fn interrupt_turn(&self, thread_id: &str, turn_id: &str) -> Result<()> {
        self.send_request("turn/interrupt", serde_json::json!({
            "threadId": thread_id,
            "expectedTurnId": turn_id
        })).await?;
        Ok(())
    }

    async fn handle_incoming(
        msg: serde_json::Value,
        pending: &Arc<Mutex<HashMap<i64, oneshot::Sender<serde_json::Value>>>>,
        thread_to_chat: &Arc<Mutex<HashMap<String, String>>>,
        chat_turn: &Arc<Mutex<HashMap<String, (String, String)>>>,
        tx: &broadcast::Sender<AgentEvent>,
    ) {
        // Response
        if let Some(id) = msg["id"].as_i64() {
            if let Some(chan) = pending.lock().await.remove(&id) {
                let _ = chan.send(msg["result"].clone());
            }
            return;
        }

        // Notification
        if let Some(method) = msg["method"].as_str() {
            let params = &msg["params"];
            let thread_id = params["threadId"].as_str().unwrap_or("");
            let chat_id = match thread_to_chat.lock().await.get(thread_id).cloned() {
                Some(c) => c,
                None => return,
            };

            let active_turn = chat_turn.lock().await.get(&chat_id).cloned();

            if method == "item/agentMessage/delta" {
                if let Some((_, message_id)) = active_turn {
                    let delta = params["delta"].as_str().unwrap_or("").to_string();
                    let _ = tx.send(AgentEvent::TokenDelta { chat_id, message_id, delta });
                }
            } else if method == "turn/completed" {
                chat_turn.lock().await.remove(&chat_id);
                let turn_id = params["turnId"].as_str().unwrap_or("").to_string();
                let _ = tx.send(AgentEvent::TurnCompleted { chat_id, turn_id, status: ChatStatus::Idle });
            }
        }
    }

    async fn send_request(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value> {
        let id = {
            let mut id_lock = self.next_rpc_id.lock().await;
            let current = *id_lock;
            *id_lock += 1;
            current
        };

        let (tx, rx) = oneshot::channel();
        self.pending_rpcs.lock().await.insert(id, tx);

        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        self.write_line(&payload).await?;
        Ok(rx.await?)
    }

    async fn send_notification(&self, method: &str, params: serde_json::Value) -> Result<()> {
        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });
        self.write_line(&payload).await
    }

    async fn write_line(&self, val: &serde_json::Value) -> Result<()> {
        let mut stdin_lock = self.stdin.lock().await;
        if let Some(stdin) = stdin_lock.as_mut() {
            let mut s = serde_json::to_string(val)?;
            s.push('\n');
            stdin.write_all(s.as_bytes()).await?;
            stdin.flush().await?;
            Ok(())
        } else {
            bail!("Stdin not open")
        }
    }
}
