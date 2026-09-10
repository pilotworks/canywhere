use anyhow::{bail, Result};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{broadcast, oneshot, Mutex};
use tracing::info;

use canywhere_protocol::models::*;
use canywhere_protocol::rpc::methods::*;

use async_trait::async_trait;
use super::{AgentEvent, CliAdapter};

pub struct CodexAdapter {
    codex_bin: String,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    next_rpc_id: Arc<Mutex<i64>>,
    pending_rpcs: Arc<Mutex<HashMap<i64, oneshot::Sender<serde_json::Value>>>>,
    thread_to_chat: Arc<Mutex<HashMap<String, String>>>,
    chat_active_turn: Arc<Mutex<HashMap<String, (String, String)>>>,
    chat_accumulated_text: Arc<Mutex<HashMap<String, String>>>,
    chat_accumulated_reasoning: Arc<Mutex<HashMap<String, String>>>,
    chat_accumulated_blocks: Arc<Mutex<HashMap<String, Vec<MessageBlock>>>>,
    chat_pending_approvals: Arc<Mutex<HashMap<String, Vec<ApprovalRequest>>>>,
    event_tx: broadcast::Sender<AgentEvent>,
}

impl CodexAdapter {
    pub fn new(codex_bin: &str) -> (Self, broadcast::Receiver<AgentEvent>) {
        let (event_tx, event_rx) = broadcast::channel(1024);
        let adapter = Self::with_event_tx(codex_bin, event_tx);
        (adapter, event_rx)
    }

    pub fn with_event_tx(codex_bin: &str, event_tx: broadcast::Sender<AgentEvent>) -> Self {
        Self {
            codex_bin: codex_bin.to_string(),
            stdin: Arc::new(Mutex::new(None)),
            next_rpc_id: Arc::new(Mutex::new(1)),
            pending_rpcs: Arc::new(Mutex::new(HashMap::new())),
            thread_to_chat: Arc::new(Mutex::new(HashMap::new())),
            chat_active_turn: Arc::new(Mutex::new(HashMap::new())),
            chat_accumulated_text: Arc::new(Mutex::new(HashMap::new())),
            chat_accumulated_reasoning: Arc::new(Mutex::new(HashMap::new())),
            chat_accumulated_blocks: Arc::new(Mutex::new(HashMap::new())),
            chat_pending_approvals: Arc::new(Mutex::new(HashMap::new())),
            event_tx,
        }
    }

    pub fn resolve_binary() -> String {
        if let Ok(bin) = std::env::var("CODEX_BIN") {
            if !bin.trim().is_empty() {
                return bin;
            }
        }
        if let Ok(output) = std::process::Command::new("which").arg("codex").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return path;
                }
            }
        }
        if let Some(home) = dirs::home_dir() {
            let candidates = [
                format!("{}/.local/bin/codex", home.display()),
                format!("{}/.cargo/bin/codex", home.display()),
                "/opt/homebrew/bin/codex".to_string(),
                "/usr/local/bin/codex".to_string(),
            ];
            for cand in candidates {
                if std::path::Path::new(&cand).exists() {
                    return cand;
                }
            }
        }
        "codex".to_string()
    }


    pub fn event_tx(&self) -> broadcast::Sender<AgentEvent> {
        self.event_tx.clone()
    }

    pub fn codex_bin(&self) -> &str {
        &self.codex_bin
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
        let stderr = child.stderr.take();

        *self.stdin.lock().await = Some(stdin);

        // Spawn background NDJSON reader for stdout
        let pending = Arc::clone(&self.pending_rpcs);
        let thread_to_chat = Arc::clone(&self.thread_to_chat);
        let chat_turn = Arc::clone(&self.chat_active_turn);
        let chat_text = Arc::clone(&self.chat_accumulated_text);
        let chat_reasoning = Arc::clone(&self.chat_accumulated_reasoning);
        let chat_blocks = Arc::clone(&self.chat_accumulated_blocks);
        let chat_approvals = Arc::clone(&self.chat_pending_approvals);
        let tx = self.event_tx.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                tracing::info!("[CodexStdout] {}", line);
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line) {
                    Self::handle_incoming(
                        msg,
                        &pending,
                        &thread_to_chat,
                        &chat_turn,
                        &chat_text,
                        &chat_reasoning,
                        &chat_blocks,
                        &chat_approvals,
                        &tx,
                    )
                    .await;
                }
            }
        });

        // Spawn background stderr logger
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if !line.trim().is_empty() {
                        tracing::debug!("[CodexStderr] {}", line);
                    }
                }
            });
        }

        // Initialize handshake
        self.send_request(
            "initialize",
            serde_json::json!({
                "clientInfo": { "name": "canywhere-server", "version": "0.1.0" },
                "capabilities": { "experimentalApi": true }
            }),
        )
        .await?;

        self.send_notification("initialized", serde_json::json!({}))
            .await?;
        info!("[CodexAdapter] Initialized successfully");
        Ok(())
    }

    pub async fn start_thread(
        &self,
        chat_id: &str,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String> {
        if self.stdin.lock().await.is_none() {
            let mock_id = format!("thread-mock-{}", nanoid::nanoid!(8));
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(mock_id.clone(), chat_id.to_string());
            return Ok(mock_id);
        }

        let res = self
            .send_request(
                "thread/start",
                serde_json::json!({
                    "cwd": cwd,
                    "runtimeWorkspaceRoots": sub_paths,
                    "config": {
                        "model_reasoning_summary": "detailed"
                    }
                }),
            )
            .await?;

        let thread_id = res
            .get("thread")
            .and_then(|t| t.get("id"))
            .and_then(|id| id.as_str())
            .or_else(|| res.get("threadId").and_then(|id| id.as_str()))
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Failed to retrieve thread ID from thread/start response: {:?}",
                    res
                )
            })?
            .to_string();

        {
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(thread_id.clone(), chat_id.to_string());
        }
        Ok(thread_id)
    }

    pub async fn resume_thread(&self, chat_id: &str, thread_id: &str) -> Result<String> {
        if self.stdin.lock().await.is_none() {
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(thread_id.to_string(), chat_id.to_string());
            return Ok(thread_id.to_string());
        }

        let res = self
            .send_request(
                "thread/resume",
                serde_json::json!({
                    "threadId": thread_id,
                    "excludeTurns": true
                }),
            )
            .await?;

        let id = res
            .get("thread")
            .and_then(|t| t.get("id"))
            .and_then(|id| id.as_str())
            .or_else(|| res.get("threadId").and_then(|id| id.as_str()))
            .unwrap_or(thread_id)
            .to_string();

        {
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(id.clone(), chat_id.to_string());
        }
        Ok(id)
    }

    pub async fn resume_or_start_thread(
        &self,
        chat_id: &str,
        thread_id: Option<&str>,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String> {
        if let Some(th_id) = thread_id {
            if !th_id.trim().is_empty() {
                match self.resume_thread(chat_id, th_id).await {
                    Ok(id) => {
                        tracing::info!("[CodexAdapter] Successfully resumed thread: {}", id);
                        return Ok(id);
                    }
                    Err(err) => {
                        tracing::warn!(
                            "[CodexAdapter] Failed to resume thread {}, starting new thread: {}",
                            th_id,
                            err
                        );
                    }
                }
            }
        }
        self.start_thread(chat_id, cwd, sub_paths).await
    }

    pub async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let res = self
            .send_request(
                "model/list",
                serde_json::json!({
                    "limit": 50,
                    "includeHidden": false
                }),
            )
            .await;

        match res {
            Ok(val) => {
                let mut list = Vec::new();
                if let Some(items) = val["data"].as_array() {
                    for item in items {
                        let id = item["id"].as_str().unwrap_or("").to_string();
                        let model = item["model"].as_str().unwrap_or(&id).to_string();
                        let display_name =
                            item["displayName"].as_str().unwrap_or(&model).to_string();
                        let description = item["description"].as_str().map(|s| s.to_string());
                        let is_default = item["isDefault"].as_bool().unwrap_or(false);

                        let mut efforts = Vec::new();
                        if let Some(eff_arr) = item["supportedReasoningEfforts"].as_array() {
                            for eff in eff_arr {
                                if let Some(e) = eff["reasoningEffort"].as_str() {
                                    efforts.push(e.to_string());
                                }
                            }
                        }

                        let default_effort = item["defaultReasoningEffort"]
                            .as_str()
                            .map(|s| s.to_string());

                        list.push(ModelInfo {
                            id,
                            model,
                            display_name,
                            description,
                            is_default,
                            supported_reasoning_efforts: efforts,
                            default_reasoning_effort: default_effort,
                        });
                    }
                }
                if !list.is_empty() {
                    return Ok(list);
                }
            }
            Err(e) => {
                tracing::warn!("[CodexAdapter] model/list RPC failed or unsupported: {}, using fallback presets", e);
            }
        }

        // Fallback models if app-server call is unavailable
        Ok(vec![
            ModelInfo {
                id: "gpt-5-codex".to_string(),
                model: "gpt-5-codex".to_string(),
                display_name: "gpt-5-codex".to_string(),
                description: Some("Default frontier autonomous coding model".to_string()),
                is_default: true,
                supported_reasoning_efforts: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_reasoning_effort: Some("medium".to_string()),
            },
            ModelInfo {
                id: "o3-mini".to_string(),
                model: "o3-mini".to_string(),
                display_name: "o3-mini".to_string(),
                description: Some("High-speed reasoning model".to_string()),
                is_default: false,
                supported_reasoning_efforts: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_reasoning_effort: Some("medium".to_string()),
            },
            ModelInfo {
                id: "gpt-4o".to_string(),
                model: "gpt-4o".to_string(),
                display_name: "gpt-4o".to_string(),
                description: Some("General purpose multimodal model".to_string()),
                is_default: false,
                supported_reasoning_efforts: vec![],
                default_reasoning_effort: None,
            },
        ])
    }

    pub async fn fuzzy_file_search(
        &self,
        roots: Vec<String>,
        query: &str,
        cancellation_token: Option<String>,
    ) -> Result<Vec<FuzzyFileMatchItem>> {
        let res = self
            .send_request(
                "fuzzyFileSearch",
                serde_json::json!({
                    "query": query,
                    "roots": roots,
                    "cancellationToken": cancellation_token
                }),
            )
            .await?;

        let mut list = Vec::new();
        if let Some(files) = res.get("files").and_then(|f| f.as_array()) {
            for file in files {
                let path = file["path"].as_str().unwrap_or("").to_string();
                let root = file["root"].as_str().unwrap_or("").to_string();
                let file_name = file["fileName"].as_str().unwrap_or("").to_string();
                let match_type = file["matchType"].as_str().unwrap_or("file").to_string();
                let score = file["score"].as_u64().unwrap_or(0) as u32;
                let indices = file["indices"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_u64().map(|i| i as u32)).collect());

                list.push(FuzzyFileMatchItem {
                    path,
                    root,
                    file_name,
                    match_type,
                    score,
                    indices,
                });
            }
        }
        Ok(list)
    }

    pub async fn start_review(&self, chat_id: &str, thread_id: &str) -> Result<String> {
        let message_id = uuid::Uuid::new_v4().to_string();
        {
            let mut active = self.chat_active_turn.lock().await;
            active.insert(
                chat_id.to_string(),
                (String::new(), message_id.to_string()),
            );
        }
        {
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(thread_id.to_string(), chat_id.to_string());
        }
        {
            let mut text = self.chat_accumulated_text.lock().await;
            text.insert(chat_id.to_string(), String::new());
        }
        {
            let mut reasoning = self.chat_accumulated_reasoning.lock().await;
            reasoning.insert(chat_id.to_string(), String::new());
        }
        {
            let mut blocks = self.chat_accumulated_blocks.lock().await;
            blocks.insert(chat_id.to_string(), Vec::new());
        }

        if self.stdin.lock().await.is_none() {
            tracing::info!("[CodexAdapter] mock mode: start_review simulated for chat {}", chat_id);
            return Ok(format!("turn-mock-review-{}", nanoid::nanoid!(6)));
        }

        let res = self
            .send_request(
                "review/start",
                serde_json::json!({
                    "threadId": thread_id,
                    "target": { "type": "uncommittedChanges" }
                }),
            )
            .await?;

        let turn_id = res
            .get("turn")
            .and_then(|t| t.get("id"))
            .and_then(|id| id.as_str())
            .or_else(|| res.get("turnId").and_then(|id| id.as_str()))
            .unwrap_or("")
            .to_string();

        {
            let mut active = self.chat_active_turn.lock().await;
            active.insert(
                chat_id.to_string(),
                (turn_id.clone(), message_id.to_string()),
            );
        }

        Ok(turn_id)
    }

    pub async fn compact_thread(&self, thread_id: &str) -> Result<()> {
        if self.stdin.lock().await.is_none() {
            tracing::info!("[CodexAdapter] mock mode: compact_thread simulated for {}", thread_id);
            return Ok(());
        }
        let _ = self
            .send_request(
                "thread/compact/start",
                serde_json::json!({
                    "threadId": thread_id
                }),
            )
            .await?;
        Ok(())
    }

    pub async fn submit_turn(
        &self,
        chat_id: &str,
        thread_id: &str,
        message_id: &str,
        prompt: &str,
        model: Option<&str>,
        effort: Option<&str>,
        permission_mode: Option<PermissionMode>,
        cwd: Option<&str>,
    ) -> Result<String> {
        tracing::info!(
            "[CodexAdapter] submit_turn starting: chat={}, thread={}, model={:?}, effort={:?}, permission={:?}",
            chat_id,
            thread_id,
            model,
            effort,
            permission_mode
        );

        let mut turn_params = serde_json::json!({
            "threadId": thread_id,
            "input": [{ "type": "text", "text": prompt }],
            "summary": "detailed"
        });

        if let Some(m) = model {
            let m_trimmed = m.trim();
            if !m_trimmed.is_empty() && m_trimmed != "default" {
                turn_params["model"] = serde_json::Value::String(m_trimmed.to_string());
            }
        }

        if let Some(eff) = effort {
            let eff_trimmed = eff.trim();
            if !eff_trimmed.is_empty() && eff_trimmed != "default" {
                turn_params["effort"] = serde_json::Value::String(eff_trimmed.to_string());
            }
        }

        match permission_mode.unwrap_or(PermissionMode::OnRequest) {
            PermissionMode::Auto => {
                turn_params["approvalPolicy"] = serde_json::json!("never");
                if let Some(dir) = cwd {
                    turn_params["sandboxPolicy"] = serde_json::json!({
                        "type": "workspaceWrite",
                        "writableRoots": [dir],
                        "networkAccess": true
                    });
                }
            }
            PermissionMode::ReadOnly => {
                turn_params["approvalPolicy"] = serde_json::json!("on-request");
                turn_params["sandboxPolicy"] = serde_json::json!({
                    "type": "readOnly"
                });
            }
            PermissionMode::OnRequest => {
                turn_params["approvalPolicy"] = serde_json::json!("on-request");
                if let Some(dir) = cwd {
                    turn_params["sandboxPolicy"] = serde_json::json!({
                        "type": "workspaceWrite",
                        "writableRoots": [dir],
                        "networkAccess": true
                    });
                }
            }
        }

        // Pre-register mappings before sending request to eliminate streaming delta race conditions
        {
            let mut active = self.chat_active_turn.lock().await;
            active.insert(
                chat_id.to_string(),
                (String::new(), message_id.to_string()),
            );
        }
        {
            let mut t2c = self.thread_to_chat.lock().await;
            t2c.insert(thread_id.to_string(), chat_id.to_string());
        }
        {
            let mut text = self.chat_accumulated_text.lock().await;
            text.insert(chat_id.to_string(), String::new());
        }
        {
            let mut reasoning = self.chat_accumulated_reasoning.lock().await;
            reasoning.insert(chat_id.to_string(), String::new());
        }
        {
            let mut blocks = self.chat_accumulated_blocks.lock().await;
            blocks.insert(chat_id.to_string(), Vec::new());
        }

        let res = self.send_request("turn/start", turn_params).await?;

        let turn_id = res
            .get("turn")
            .and_then(|t| t.get("id"))
            .and_then(|id| id.as_str())
            .or_else(|| res.get("turnId").and_then(|id| id.as_str()))
            .unwrap_or("")
            .to_string();

        {
            let mut active = self.chat_active_turn.lock().await;
            active.insert(
                chat_id.to_string(),
                (turn_id.clone(), message_id.to_string()),
            );
        }

        tracing::info!(
            "[CodexAdapter] submit_turn succeeded: chat={}, turn_id={}",
            chat_id,
            turn_id
        );
        Ok(turn_id)
    }

    pub async fn steer_turn(&self, thread_id: &str, turn_id: &str, prompt: &str) -> Result<String> {
        let res = self
            .send_request(
                "turn/steer",
                serde_json::json!({
                    "threadId": thread_id,
                    "expectedTurnId": turn_id,
                    "input": [{ "type": "text", "text": prompt }]
                }),
            )
            .await?;

        let res_turn_id = res
            .get("turn")
            .and_then(|t| t.get("id"))
            .and_then(|id| id.as_str())
            .or_else(|| res.get("turnId").and_then(|id| id.as_str()))
            .unwrap_or(turn_id)
            .to_string();
        Ok(res_turn_id)
    }

    pub async fn respond_approval(&self, external_request_id: &str, decision: &str) -> Result<()> {
        let codex_decision = match decision {
            "accept" => "accept",
            "accept_for_session" | "acceptForSession" => "acceptForSession",
            "cancel" => "cancel",
            _ => "decline",
        };

        let mut found_chat_id = None;
        // Remove from pending approvals across chats
        {
            let mut approvals = self.chat_pending_approvals.lock().await;
            for (c_id, list) in approvals.iter_mut() {
                if let Some(pos) = list.iter().position(|a| a.id == external_request_id || a.external_request_id == external_request_id) {
                    found_chat_id = Some(c_id.clone());
                    list.remove(pos);
                    break;
                }
            }
        }

        let _ = self.event_tx.send(AgentEvent::ApprovalResolved {
            approval_id: external_request_id.to_string(),
            chat_id: found_chat_id,
            decision: codex_decision.to_string(),
        });

        if let Ok(id) = external_request_id.parse::<i64>() {
            self.send_response(id, serde_json::json!({ "decision": codex_decision }))
                .await?;
        } else {
            let payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": external_request_id,
                "result": { "decision": codex_decision }
            });
            self.write_line(&payload).await?;
        }
        Ok(())
    }

    pub async fn get_pending_approvals(&self, chat_id: &str) -> Vec<ApprovalRequest> {
        let approvals = self.chat_pending_approvals.lock().await;
        approvals.get(chat_id).cloned().unwrap_or_default()
    }

    pub async fn get_all_pending_approvals(&self) -> Vec<ApprovalRequest> {
        let approvals = self.chat_pending_approvals.lock().await;
        approvals.values().flatten().cloned().collect()
    }

    pub async fn get_active_turns_count(&self) -> usize {
        let turns = self.chat_active_turn.lock().await;
        turns.len()
    }

    pub async fn get_active_streaming_message(&self, chat_id: &str) -> Option<Message> {
        let active = self.chat_active_turn.lock().await;
        let (turn_id, message_id) = active.get(chat_id)?;

        let blocks_guard = self.chat_accumulated_blocks.lock().await;
        let mut blocks = blocks_guard.get(chat_id).cloned().unwrap_or_default();

        let text_content = self.chat_accumulated_text.lock().await;
        let text = text_content.get(chat_id).cloned().unwrap_or_default();

        let reasoning_content = self.chat_accumulated_reasoning.lock().await;
        let reasoning = reasoning_content.get(chat_id).cloned().unwrap_or_default();

        if blocks.is_empty() {
            if !reasoning.trim().is_empty() {
                blocks.push(MessageBlock::Reasoning {
                    content: reasoning,
                    completed: false,
                });
            }
            if !text.trim().is_empty() {
                blocks.push(MessageBlock::Text {
                    content: text,
                });
            }
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        Some(Message {
            id: message_id.clone(),
            chat_id: chat_id.to_string(),
            turn_id: if turn_id.is_empty() { None } else { Some(turn_id.clone()) },
            role: MessageRole::Agent,
            blocks,
            created_at: now,
            streaming: true,
        })
    }

    pub async fn get_active_turn(&self, chat_id: &str) -> Option<String> {
        let active = self.chat_active_turn.lock().await;
        active.get(chat_id).map(|(turn_id, _)| turn_id.clone())
    }

    pub async fn clear_active_turn(&self, chat_id: &str) {
        let mut active = self.chat_active_turn.lock().await;
        active.remove(chat_id);
        let mut approvals = self.chat_pending_approvals.lock().await;
        approvals.remove(chat_id);
    }

    pub async fn interrupt_turn(&self, thread_id: &str, turn_id: &str) -> Result<()> {
        if !turn_id.is_empty() {
            let res = self.send_request(
                "turn/interrupt",
                serde_json::json!({
                    "threadId": thread_id,
                    "turnId": turn_id
                }),
            )
            .await;
            if let Err(e) = res {
                tracing::warn!("[CodexAdapter] turn/interrupt warning: {}", e);
            }
        }
        Ok(())
    }

    async fn handle_incoming(
        msg: serde_json::Value,
        pending: &Arc<Mutex<HashMap<i64, oneshot::Sender<serde_json::Value>>>>,
        thread_to_chat: &Arc<Mutex<HashMap<String, String>>>,
        chat_turn: &Arc<Mutex<HashMap<String, (String, String)>>>,
        chat_text: &Arc<Mutex<HashMap<String, String>>>,
        chat_reasoning: &Arc<Mutex<HashMap<String, String>>>,
        chat_blocks: &Arc<Mutex<HashMap<String, Vec<MessageBlock>>>>,
        chat_approvals: &Arc<Mutex<HashMap<String, Vec<ApprovalRequest>>>>,
        tx: &broadcast::Sender<AgentEvent>,
    ) {
        // 1. In JSON-RPC 2.0, a Response has an "id" and ("result" or "error"), but NO "method".
        if msg.get("method").is_none() {
            if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
                if let Some(chan) = pending.lock().await.remove(&id) {
                    let res = if let Some(err) = msg.get("error") {
                        tracing::error!("[CodexAdapter] RPC Error for id {}: {:?}", id, err);
                        msg.clone()
                    } else {
                        msg.get("result")
                            .cloned()
                            .unwrap_or(serde_json::Value::Null)
                    };
                    let _ = chan.send(res);
                }
            }
            return;
        }

        // 2. Incoming Request or Notification from Codex
        let method = match msg["method"].as_str() {
            Some(m) => m,
            None => return,
        };

        // Only handle methods that Canywhere cares about; ignore others immediately without touching locks
        match method {
            "item/agentMessage/delta"
            | "item/reasoning/textDelta"
            | "item/reasoning/summaryTextDelta"
            | "item/reasoning/summaryPartAdded"
            | "item/commandExecution/outputDelta"
            | "item/started"
            | "item/completed"
            | "item/commandExecution/requestApproval"
            | "item/fileChange/requestApproval"
            | "turn/completed"
            | "thread/name/updated" => {}
            _ => return,
        }

        let params = &msg["params"];
        let req_id = msg.get("id"); // If Some, it's a ServerRequest expecting a response

        let thread_id = params
            .get("threadId")
            .and_then(|t| t.as_str())
            .or_else(|| {
                params
                    .get("thread")
                    .and_then(|t| t.get("id"))
                    .and_then(|id| id.as_str())
            })
            .or_else(|| {
                params
                    .get("item")
                    .and_then(|it| it.get("threadId"))
                    .and_then(|t| t.as_str())
            })
            .or_else(|| {
                params
                    .get("item")
                    .and_then(|it| it.get("thread"))
                    .and_then(|t| t.get("id"))
                    .and_then(|id| id.as_str())
            })
            .unwrap_or("");

        let chat_id_opt = {
            let t2c = thread_to_chat.lock().await;
            t2c.get(thread_id).cloned()
        };

        let chat_id = match chat_id_opt {
            Some(c) => c,
            None => {
                let active = chat_turn.lock().await;
                if active.len() == 1 {
                    active.keys().next().cloned().unwrap()
                } else {
                    tracing::warn!(
                        "[CodexAdapter] No chat mapping found for thread_id '{}', method '{}'",
                        thread_id,
                        method
                    );
                    return;
                }
            }
        };

        let active_turn = {
            let active = chat_turn.lock().await;
            active.get(&chat_id).cloned()
        };

        if method == "item/agentMessage/delta" {
            let delta = params["delta"].as_str().unwrap_or("").to_string();
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));
            {
                let mut text_lock = chat_text.lock().await;
                text_lock
                    .entry(chat_id.clone())
                    .or_default()
                    .push_str(&delta);
            }
            {
                let mut blocks_lock = chat_blocks.lock().await;
                let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                if let Some(MessageBlock::Reasoning { completed, .. }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                    *completed = true;
                }
                if let Some(MessageBlock::Text { content }) = blocks.last_mut() {
                    content.push_str(&delta);
                } else {
                    blocks.push(MessageBlock::Text {
                        content: delta.clone(),
                    });
                }
            }
            let _ = tx.send(AgentEvent::TokenDelta {
                chat_id,
                message_id: msg_id,
                delta,
            });
        } else if method == "item/reasoning/textDelta" || method == "item/reasoning/summaryTextDelta" {
            let delta = params["delta"].as_str().unwrap_or("").to_string();
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));
            {
                let mut r_lock = chat_reasoning.lock().await;
                r_lock
                    .entry(chat_id.clone())
                    .or_default()
                    .push_str(&delta);
            }
            {
                let mut blocks_lock = chat_blocks.lock().await;
                let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                if let Some(MessageBlock::Reasoning { content, completed }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                    if !*completed {
                        content.push_str(&delta);
                    } else {
                        blocks.push(MessageBlock::Reasoning {
                            content: delta.clone(),
                            completed: false,
                        });
                    }
                } else {
                    blocks.push(MessageBlock::Reasoning {
                        content: delta.clone(),
                        completed: false,
                    });
                }
            }
            let _ = tx.send(AgentEvent::ReasoningDelta {
                chat_id,
                message_id: msg_id,
                delta,
            });
        } else if method == "item/reasoning/summaryPartAdded" {
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));
            let mut need_newline = false;
            {
                let mut r_lock = chat_reasoning.lock().await;
                let r = r_lock.entry(chat_id.clone()).or_default();
                if !r.is_empty() && !r.ends_with("\n\n") {
                    if r.ends_with('\n') {
                        r.push('\n');
                    } else {
                        r.push_str("\n\n");
                    }
                    need_newline = true;
                }
            }
            if need_newline {
                let mut blocks_lock = chat_blocks.lock().await;
                let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                if let Some(MessageBlock::Reasoning { content, completed }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                    if !*completed && !content.ends_with("\n\n") {
                        if content.ends_with('\n') {
                            content.push('\n');
                        } else {
                            content.push_str("\n\n");
                        }
                    }
                }
                let _ = tx.send(AgentEvent::ReasoningDelta {
                    chat_id,
                    message_id: msg_id,
                    delta: "\n\n".to_string(),
                });
            }
        } else if method == "item/commandExecution/outputDelta" {
            let delta = params["delta"]
                .as_str()
                .or_else(|| params["chunk"].as_str())
                .unwrap_or("");
            if !delta.is_empty() {
                let mut blocks_lock = chat_blocks.lock().await;
                if let Some(blocks) = blocks_lock.get_mut(&chat_id) {
                    for b in blocks.iter_mut().rev() {
                        if let MessageBlock::CommandExec { output, .. } = b {
                            output.get_or_insert_with(String::new).push_str(delta);
                            break;
                        }
                    }
                }
            }
        } else if method == "item/started" {
            let item = &params["item"];
            let item_type = item["type"].as_str().unwrap_or("");
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));
            let item_id = item["id"].as_str().unwrap_or("").to_string();

            // Mark any prior uncompleted reasoning block as complete
            {
                let mut blocks_lock = chat_blocks.lock().await;
                let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                if let Some(MessageBlock::Reasoning { completed, .. }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                    *completed = true;
                }
            }

            if item_type == "commandExecution" {
                let cmd = item["command"].as_str().unwrap_or("").to_string();
                let cwd = item["cwd"].as_str().unwrap_or("").to_string();
                let block = MessageBlock::CommandExec {
                    command: cmd,
                    cwd,
                    output: None,
                    exit_code: None,
                    status: CommandExecStatus::Running,
                };
                {
                    let mut blocks_lock = chat_blocks.lock().await;
                    blocks_lock
                        .entry(chat_id.clone())
                        .or_default()
                        .push(block.clone());
                }
                let _ = tx.send(AgentEvent::BlockStarted {
                    chat_id,
                    message_id: msg_id,
                    block_id: item_id,
                    block,
                });
            } else if item_type == "mcpToolCall"
                || item_type == "dynamicToolCall"
                || item_type == "collabAgentToolCall"
                || item_type == "webSearch"
                || item_type == "toolCall"
            {
                let name = item["tool"]
                    .as_str()
                    .or_else(|| item["name"].as_str())
                    .unwrap_or(if item_type == "webSearch" { "webSearch" } else { "tool" })
                    .to_string();
                let args = item
                    .get("arguments")
                    .cloned()
                    .or_else(|| item.get("query").map(|q| serde_json::json!({ "query": q })))
                    .unwrap_or(serde_json::Value::Null);
                let block = MessageBlock::ToolCall {
                    call_id: item_id.clone(),
                    name,
                    args,
                    output: None,
                    status: ToolCallStatus::Running,
                };
                {
                    let mut blocks_lock = chat_blocks.lock().await;
                    blocks_lock
                        .entry(chat_id.clone())
                        .or_default()
                        .push(block.clone());
                }
                let _ = tx.send(AgentEvent::BlockStarted {
                    chat_id,
                    message_id: msg_id,
                    block_id: item_id,
                    block,
                });
            } else if item_type == "plan" {
                let text = item["text"].as_str().unwrap_or("").to_string();
                let block = MessageBlock::Plan { content: text };
                {
                    let mut blocks_lock = chat_blocks.lock().await;
                    blocks_lock
                        .entry(chat_id.clone())
                        .or_default()
                        .push(block.clone());
                }
                let _ = tx.send(AgentEvent::BlockStarted {
                    chat_id,
                    message_id: msg_id,
                    block_id: item_id,
                    block,
                });
            }
        } else if method == "item/completed" {
            let item = &params["item"];
            let item_type = item["type"].as_str().unwrap_or("");
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));
            let item_id = item["id"].as_str().unwrap_or("").to_string();

            if item_type == "agentMessage" {
                if let Some(text) = item["text"].as_str() {
                    let mut text_lock = chat_text.lock().await;
                    let existing = text_lock.get(&chat_id).cloned().unwrap_or_default();
                    if existing.is_empty() {
                        let _ = tx.send(AgentEvent::TokenDelta {
                            chat_id: chat_id.clone(),
                            message_id: msg_id,
                            delta: text.to_string(),
                        });
                    }
                    text_lock.insert(chat_id.clone(), text.to_string());

                    let mut blocks_lock = chat_blocks.lock().await;
                    let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                    if let Some(MessageBlock::Text { content }) = blocks.last_mut() {
                        if content.is_empty() {
                            *content = text.to_string();
                        }
                    } else if !text.is_empty() {
                        blocks.push(MessageBlock::Text {
                            content: text.to_string(),
                        });
                    }
                }
            } else if item_type == "commandExecution" {
                let agg_out = item["aggregatedOutput"]
                    .as_str()
                    .or_else(|| item["output"].as_str())
                    .map(|s| s.to_string());
                let exit_code = item["exitCode"].as_i64().map(|n| n as i32);
                let status_str = item["status"].as_str().unwrap_or("");
                let status = match status_str {
                    "failed" | "declined" => CommandExecStatus::Failed,
                    "completed" => CommandExecStatus::Completed,
                    _ => {
                        if exit_code.unwrap_or(0) == 0 {
                            CommandExecStatus::Completed
                        } else {
                            CommandExecStatus::Failed
                        }
                    }
                };

                let mut updated_block: Option<MessageBlock> = None;
                {
                    let mut blocks_lock = chat_blocks.lock().await;
                    if let Some(blocks) = blocks_lock.get_mut(&chat_id) {
                        for b in blocks.iter_mut().rev() {
                            if let MessageBlock::CommandExec {
                                output,
                                exit_code: b_exit,
                                status: b_status,
                                ..
                            } = b
                            {
                                if let Some(ao) = agg_out.clone() {
                                    *output = Some(ao);
                                }
                                *b_exit = exit_code;
                                *b_status = status;
                                updated_block = Some(b.clone());
                                break;
                            }
                        }
                    }
                }

                let _ = tx.send(AgentEvent::BlockCompleted {
                    chat_id,
                    message_id: msg_id,
                    block_id: item_id,
                    block: updated_block,
                });
            } else if item_type == "mcpToolCall"
                || item_type == "dynamicToolCall"
                || item_type == "collabAgentToolCall"
                || item_type == "webSearch"
                || item_type == "toolCall"
            {
                let status_str = item["status"].as_str().unwrap_or("");
                let success = item.get("success").and_then(|s| s.as_bool());
                let is_failed = status_str == "failed"
                    || item.get("error").is_some()
                    || success == Some(false);
                let status = if is_failed {
                    ToolCallStatus::Failed
                } else {
                    ToolCallStatus::Completed
                };

                let tool_out = if let Some(err) = item
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(|m| m.as_str())
                {
                    Some(err.to_string())
                } else if let Some(res) = item.get("result") {
                    if let Some(arr) = res.get("content").and_then(|c| c.as_array()) {
                        let texts: Vec<String> = arr
                            .iter()
                            .filter_map(|c| {
                                c.get("text")
                                    .and_then(|t| t.as_str())
                                    .map(|s| s.to_string())
                            })
                            .collect();
                        if !texts.is_empty() {
                            Some(texts.join("\n"))
                        } else {
                            Some(res.to_string())
                        }
                    } else {
                        Some(res.to_string())
                    }
                } else if let Some(items) = item.get("contentItems").and_then(|c| c.as_array()) {
                    let texts: Vec<String> = items
                        .iter()
                        .filter_map(|c| {
                            c.get("text")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string())
                        })
                        .collect();
                    if !texts.is_empty() {
                        Some(texts.join("\n"))
                    } else {
                        Some(item["contentItems"].to_string())
                    }
                } else if let Some(out) = item.get("output").and_then(|o| o.as_str()) {
                    Some(out.to_string())
                } else {
                    None
                };

                let mut updated_block: Option<MessageBlock> = None;
                {
                    let mut blocks_lock = chat_blocks.lock().await;
                    if let Some(blocks) = blocks_lock.get_mut(&chat_id) {
                        let mut matched = false;
                        if !item_id.is_empty() {
                            for b in blocks.iter_mut().rev() {
                                if let MessageBlock::ToolCall {
                                    call_id,
                                    output,
                                    status: b_status,
                                    ..
                                } = b
                                {
                                    if *call_id == item_id {
                                        if let Some(to) = tool_out.clone() {
                                            *output = Some(to);
                                        }
                                        *b_status = status;
                                        updated_block = Some(b.clone());
                                        matched = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if !matched {
                            // Fallback: match the last running ToolCall
                            for b in blocks.iter_mut().rev() {
                                if let MessageBlock::ToolCall {
                                    output,
                                    status: b_status,
                                    ..
                                } = b
                                {
                                    if *b_status == ToolCallStatus::Running {
                                        if let Some(to) = tool_out.clone() {
                                            *output = Some(to);
                                        }
                                        *b_status = status;
                                        updated_block = Some(b.clone());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                let _ = tx.send(AgentEvent::BlockCompleted {
                    chat_id,
                    message_id: msg_id,
                    block_id: item_id,
                    block: updated_block,
                });
            } else if item_type == "fileChange" {
                if let Some(changes) = item.get("changes").and_then(|c| c.as_array()) {
                    for change in changes {
                        let path = change["path"].as_str().unwrap_or("").to_string();
                        let patch = change["diff"]
                            .as_str()
                            .or_else(|| change["patch"].as_str())
                            .unwrap_or("")
                            .to_string();
                        let block = MessageBlock::FileDiff {
                            path,
                            patch,
                            status: FileDiffStatus::Applied,
                        };
                        {
                            let mut blocks_lock = chat_blocks.lock().await;
                            blocks_lock
                                .entry(chat_id.clone())
                                .or_default()
                                .push(block.clone());
                        }
                        let _ = tx.send(AgentEvent::BlockStarted {
                            chat_id: chat_id.clone(),
                            message_id: msg_id.clone(),
                            block_id: item_id.clone(),
                            block,
                        });
                    }
                }
            } else if item_type == "reasoning" {
                let full_reasoning = extract_reasoning_text(item);
                let accumulated_reasoning = {
                    let r_lock = chat_reasoning.lock().await;
                    r_lock.get(&chat_id).cloned().unwrap_or_default()
                };
                let best_reasoning = if !full_reasoning.is_empty() {
                    full_reasoning
                } else {
                    accumulated_reasoning
                };

                let mut blocks_lock = chat_blocks.lock().await;
                let blocks = blocks_lock.entry(chat_id.clone()).or_default();
                if let Some(MessageBlock::Reasoning { content, completed }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                    if !best_reasoning.is_empty() && (content.is_empty() || best_reasoning.len() > content.len()) {
                        *content = best_reasoning;
                    }
                    *completed = true;
                } else if !best_reasoning.is_empty() {
                    blocks.push(MessageBlock::Reasoning {
                        content: best_reasoning,
                        completed: true,
                    });
                }
            }
        } else if method == "item/commandExecution/requestApproval" {
            let external_req_id = req_id
                .and_then(|v| {
                    v.as_i64()
                        .map(|n| n.to_string())
                        .or_else(|| v.as_str().map(|s| s.to_string()))
                })
                .unwrap_or_else(|| params["itemId"].as_str().unwrap_or("").to_string());
            let command = params["command"].as_str().unwrap_or("").to_string();
            let cwd = params["cwd"].as_str().unwrap_or("").to_string();
            let is_high_risk = command.contains("rm -rf")
                || command.contains("sudo")
                || command.contains("git reset --hard")
                || command.contains("mkfs");

            let approval = ApprovalRequest {
                id: nanoid::nanoid!(16),
                chat_id: chat_id.clone(),
                turn_id: active_turn
                    .as_ref()
                    .map(|t| t.0.clone())
                    .unwrap_or_default(),
                external_request_id: external_req_id,
                kind: ApprovalKind::Command,
                payload: ApprovalPayload {
                    command: Some(command),
                    cwd: Some(cwd),
                    reason: params["reason"].as_str().map(|s| s.to_string()),
                    diff: None,
                    path: None,
                    prompt: None,
                    is_high_risk: Some(is_high_risk),
                },
                status: ApprovalStatus::Pending,
                requested_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64,
                resolved_at: None,
                resolved_by_device_id: None,
                resolved_by_device_name: None,
            };
            {
                let mut app_lock = chat_approvals.lock().await;
                app_lock.entry(chat_id.clone()).or_default().push(approval.clone());
            }
            let _ = tx.send(AgentEvent::ApprovalRequested {
                chat_id,
                request: approval,
            });
        } else if method == "item/fileChange/requestApproval" {
            let external_req_id = req_id
                .and_then(|v| {
                    v.as_i64()
                        .map(|n| n.to_string())
                        .or_else(|| v.as_str().map(|s| s.to_string()))
                })
                .unwrap_or_else(|| params["itemId"].as_str().unwrap_or("").to_string());
            let path = params["path"].as_str().unwrap_or("").to_string();
            let diff = params["diff"].as_str().unwrap_or("").to_string();

            let approval = ApprovalRequest {
                id: nanoid::nanoid!(16),
                chat_id: chat_id.clone(),
                turn_id: active_turn
                    .as_ref()
                    .map(|t| t.0.clone())
                    .unwrap_or_default(),
                external_request_id: external_req_id,
                kind: ApprovalKind::FileChange,
                payload: ApprovalPayload {
                    command: None,
                    cwd: None,
                    reason: None,
                    diff: Some(diff),
                    path: Some(path),
                    prompt: None,
                    is_high_risk: Some(false),
                },
                status: ApprovalStatus::Pending,
                requested_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64,
                resolved_at: None,
                resolved_by_device_id: None,
                resolved_by_device_name: None,
            };
            {
                let mut app_lock = chat_approvals.lock().await;
                app_lock.entry(chat_id.clone()).or_default().push(approval.clone());
            }
            let _ = tx.send(AgentEvent::ApprovalRequested {
                chat_id,
                request: approval,
            });
        } else if method == "turn/completed" {
            let _ = chat_approvals.lock().await.remove(&chat_id);
            let active_pair = chat_turn.lock().await.remove(&chat_id);
            let text_content = chat_text.lock().await.remove(&chat_id);
            let reasoning_content = chat_reasoning.lock().await.remove(&chat_id);
            let mut blocks = chat_blocks.lock().await.remove(&chat_id).unwrap_or_default();

            // Extract any completed reasoning from turn items if available
            if let Some(items) = params.get("turn").and_then(|t| t.get("items")).and_then(|i| i.as_array()) {
                for it in items {
                    if it.get("type").and_then(|t| t.as_str()) == Some("reasoning") {
                        let text = extract_reasoning_text(it);
                        if !text.is_empty() {
                            if let Some(MessageBlock::Reasoning { content, completed }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                                if content.is_empty() || text.len() > content.len() {
                                    *content = text;
                                }
                                *completed = true;
                            } else {
                                blocks.push(MessageBlock::Reasoning {
                                    content: text,
                                    completed: true,
                                });
                            }
                        }
                    }
                }
            }

            // If any reasoning block has content less comprehensive than accumulated reasoning_content, update it
            if let Some(r) = reasoning_content.as_ref() {
                let r_trimmed = r.trim();
                if !r_trimmed.is_empty() {
                    if let Some(MessageBlock::Reasoning { content, completed }) = blocks.iter_mut().rev().find(|b| matches!(b, MessageBlock::Reasoning { .. })) {
                        if content.is_empty() || r_trimmed.len() > content.len() {
                            *content = r.clone();
                        }
                        *completed = true;
                    }
                }
            }

            // Ensure any open reasoning, tool call, or command blocks are marked completed
            for b in &mut blocks {
                match b {
                    MessageBlock::Reasoning { completed, .. } => {
                        *completed = true;
                    }
                    MessageBlock::ToolCall { status, .. } => {
                        if *status == ToolCallStatus::Running {
                            *status = ToolCallStatus::Completed;
                        }
                    }
                    MessageBlock::CommandExec { status, exit_code, .. } => {
                        if *status == CommandExecStatus::Running {
                            *status = if exit_code.unwrap_or(0) == 0 {
                                CommandExecStatus::Completed
                            } else {
                                CommandExecStatus::Failed
                            };
                        }
                    }
                    _ => {}
                }
            }

            // Fallback: If blocks is empty but text_content or reasoning_content exists, reconstruct them
            if blocks.is_empty() {
                if let Some(r) = reasoning_content.as_ref() {
                    if !r.trim().is_empty() {
                        blocks.push(MessageBlock::Reasoning {
                            content: r.clone(),
                            completed: true,
                        });
                    }
                }
                if let Some(t) = text_content.as_ref() {
                    if !t.trim().is_empty() {
                        blocks.push(MessageBlock::Text {
                            content: t.clone(),
                        });
                    }
                }
            }

            let turn_id = params
                .get("turn")
                .and_then(|t| t.get("id"))
                .and_then(|id| id.as_str())
                .or_else(|| params.get("turnId").and_then(|id| id.as_str()))
                .map(|s| s.to_string())
                .or_else(|| active_pair.as_ref().map(|(t, _)| t.clone()))
                .unwrap_or_default();

            let message_id = active_pair
                .map(|(_, m)| m)
                .unwrap_or_else(|| nanoid::nanoid!(16));

            let _ = tx.send(AgentEvent::TurnCompleted {
                chat_id,
                message_id,
                turn_id,
                status: ChatStatus::Idle,
                blocks,
                text_content,
                reasoning_content,
            });
        } else if method == "thread/name/updated" {
            let thread_name = params
                .get("threadName")
                .and_then(|n| n.as_str())
                .or_else(|| params.get("name").and_then(|n| n.as_str()))
                .unwrap_or("");
            if !thread_name.trim().is_empty() {
                let _ = tx.send(AgentEvent::ChatTitleUpdated {
                    chat_id,
                    title: thread_name.trim().to_string(),
                });
            }
        }
    }

    async fn send_request(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value> {
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

        tracing::info!("[CodexSendRequest] id={}, method={}, params={}", id, method, params);
        self.write_line(&payload).await?;
        let res = rx.await?;
        tracing::info!("[CodexRecvResponse] id={}, res={}", id, res);
        if let Some(err) = res.get("error") {
            let msg = err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown JSON-RPC error");
            anyhow::bail!("{msg}");
        }
        Ok(res)
    }

    async fn send_response(&self, id: i64, result: serde_json::Value) -> Result<()> {
        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": result
        });
        self.write_line(&payload).await
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

fn extract_reasoning_text(item: &serde_json::Value) -> String {
    let mut summary_parts = Vec::new();
    let mut content_parts = Vec::new();

    let extract = |val: &serde_json::Value, acc: &mut Vec<String>| {
        if let Some(s) = val.as_str() {
            let s_trimmed = s.trim();
            if !s_trimmed.is_empty() {
                acc.push(s.to_string());
            }
        } else if let Some(arr) = val.as_array() {
            for elem in arr {
                if let Some(s) = elem.as_str() {
                    let s_trimmed = s.trim();
                    if !s_trimmed.is_empty() {
                        acc.push(s.to_string());
                    }
                } else if let Some(text) = elem.get("text").and_then(|t| t.as_str()) {
                    let text_trimmed = text.trim();
                    if !text_trimmed.is_empty() {
                        acc.push(text.to_string());
                    }
                }
            }
        } else if let Some(text) = val.get("text").and_then(|t| t.as_str()) {
            let text_trimmed = text.trim();
            if !text_trimmed.is_empty() {
                acc.push(text.to_string());
            }
        }
    };

    let summary_val = item
        .get("summary")
        .or_else(|| item.get("summaryText"))
        .or_else(|| item.get("summary_text"));
    if let Some(val) = summary_val {
        extract(val, &mut summary_parts);
    }

    let content_val = item
        .get("content")
        .or_else(|| item.get("rawContent"))
        .or_else(|| item.get("raw_content"));
    if let Some(val) = content_val {
        extract(val, &mut content_parts);
    }

    if !summary_parts.is_empty() {
        summary_parts.join("\n\n")
    } else if !content_parts.is_empty() {
        content_parts.join("\n\n")
    } else {
        String::new()
    }
}

#[async_trait]
impl CliAdapter for CodexAdapter {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn name(&self) -> &'static str {
        "OpenAI Codex"
    }

    fn description(&self) -> &'static str {
        "Local Codex CLI via app-server --stdio"
    }

    fn is_configured(&self) -> bool {
        std::path::Path::new(&self.codex_bin).exists()
            || std::process::Command::new(&self.codex_bin)
                .arg("--help")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
    }

    fn capabilities(&self) -> AdapterCapabilities {
        AdapterCapabilities {
            supports_reasoning_stream: true,
            supports_file_diffs: true,
            supports_steering: true,
            supports_interrupt: true,
            supports_session_resumption: true,
            supports_approvals: true,
            supported_modes: vec![],
        }
    }

    async fn start_thread(
        &self,
        chat_id: &str,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String> {
        self.start_thread(chat_id, cwd, sub_paths).await
    }

    async fn resume_or_start_thread(
        &self,
        chat_id: &str,
        thread_id: Option<&str>,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String> {
        self.resume_or_start_thread(chat_id, thread_id, cwd, sub_paths).await
    }

    async fn submit_turn(
        &self,
        chat_id: &str,
        thread_id: &str,
        message_id: &str,
        prompt: &str,
        model: Option<&str>,
        effort: Option<&str>,
        permission_mode: Option<PermissionMode>,
        cwd: Option<&str>,
    ) -> Result<String> {
        self.submit_turn(
            chat_id,
            thread_id,
            message_id,
            prompt,
            model,
            effort,
            permission_mode,
            cwd,
        )
        .await
    }

    async fn interrupt_turn(&self, thread_id: &str, turn_id: &str) -> Result<()> {
        self.interrupt_turn(thread_id, turn_id).await
    }

    async fn respond_approval(&self, approval_id: &str, decision: &str) -> Result<()> {
        self.respond_approval(approval_id, decision).await
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        self.list_models().await
    }

    async fn get_active_turn(&self, chat_id: &str) -> Option<String> {
        self.get_active_turn(chat_id).await
    }

    async fn clear_active_turn(&self, chat_id: &str) {
        self.clear_active_turn(chat_id).await
    }

    async fn get_active_turns_count(&self) -> u32 {
        self.get_active_turns_count().await as u32
    }

    async fn get_active_streaming_message(&self, chat_id: &str) -> Option<Message> {
        self.get_active_streaming_message(chat_id).await
    }

    async fn get_pending_approvals(&self, chat_id: &str) -> Vec<ApprovalRequest> {
        self.get_pending_approvals(chat_id).await
    }

    async fn get_all_pending_approvals(&self) -> Vec<ApprovalRequest> {
        self.get_all_pending_approvals().await
    }

    async fn steer_turn(&self, thread_id: &str, turn_id: &str, content: &str) -> Result<String> {
        self.steer_turn(thread_id, turn_id, content).await
    }

    async fn start_review(&self, chat_id: &str, thread_id: &str) -> Result<String> {
        self.start_review(chat_id, thread_id).await
    }

    async fn compact_thread(&self, thread_id: &str) -> Result<()> {
        self.compact_thread(thread_id).await
    }

    async fn fuzzy_file_search(
        &self,
        roots: Vec<String>,
        query: &str,
        cancellation_token: Option<String>,
    ) -> Result<Vec<canywhere_protocol::rpc::FuzzyFileMatchItem>> {
        self.fuzzy_file_search(roots, query, cancellation_token).await
    }

    fn icon(&self) -> Option<String> {
        Some("/icons/provider_codex.svg".to_string())
    }

    fn commands(&self) -> Vec<ProviderCommand> {
        vec![
            ProviderCommand {
                name: "/review".to_string(),
                description: "Run automated git review on uncommitted changes".to_string(),
                category: "agent".to_string(),
                icon: Some("git-compare".to_string()),
                requires_args: false,
            },
            ProviderCommand {
                name: "/compact".to_string(),
                description: "Compact conversational context & summarize thread history".to_string(),
                category: "agent".to_string(),
                icon: Some("minimize".to_string()),
                requires_args: false,
            },
        ]
    }

    fn actions(&self) -> Vec<ProviderAction> {
        vec![
            ProviderAction {
                id: "review".to_string(),
                label: "Review Git Changes".to_string(),
                icon: Some("git-compare".to_string()),
                placement: "toolbar".to_string(),
            },
            ProviderAction {
                id: "compact".to_string(),
                label: "Compact Context".to_string(),
                icon: Some("minimize".to_string()),
                placement: "toolbar".to_string(),
            },
        ]
    }

    async fn execute_command(
        &self,
        chat_id: &str,
        thread_id: &str,
        command: &str,
        _args: Option<&str>,
    ) -> Result<canywhere_protocol::rpc::ChatExecuteCommandResult> {
        match command {
            "/review" | "review" => {
                let _ = self.start_review(chat_id, thread_id).await?;
                Ok(canywhere_protocol::rpc::ChatExecuteCommandResult {
                    success: true,
                    message: Some("Code review started".to_string()),
                })
            }
            "/compact" | "compact" => {
                self.compact_thread(thread_id).await?;
                Ok(canywhere_protocol::rpc::ChatExecuteCommandResult {
                    success: true,
                    message: Some("Conversation thread compacted".to_string()),
                })
            }
            _ => anyhow::bail!("Command '{}' is not supported by Codex", command),
        }
    }
}


