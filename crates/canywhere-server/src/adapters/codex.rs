use anyhow::{bail, Result};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::{broadcast, oneshot, Mutex};
use tracing::info;

use canywhere_protocol::models::*;

#[derive(Debug, Clone)]
pub enum AgentEvent {
    TokenDelta {
        chat_id: String,
        message_id: String,
        delta: String,
    },
    BlockStarted {
        chat_id: String,
        message_id: String,
        block: MessageBlock,
    },
    BlockCompleted {
        chat_id: String,
        message_id: String,
        block_id: String,
    },
    ApprovalRequested {
        chat_id: String,
        request: ApprovalRequest,
    },
    TurnCompleted {
        chat_id: String,
        turn_id: String,
        status: ChatStatus,
        text_content: Option<String>,
    },
    ChatTitleUpdated {
        chat_id: String,
        title: String,
    },
    ChatDeleted {
        chat_id: String,
    },
}

pub struct CodexAdapter {
    codex_bin: String,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    next_rpc_id: Arc<Mutex<i64>>,
    pending_rpcs: Arc<Mutex<HashMap<i64, oneshot::Sender<serde_json::Value>>>>,
    thread_to_chat: Arc<Mutex<HashMap<String, String>>>,
    chat_active_turn: Arc<Mutex<HashMap<String, (String, String)>>>,
    chat_accumulated_text: Arc<Mutex<HashMap<String, String>>>,
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
            chat_accumulated_text: Arc::new(Mutex::new(HashMap::new())),
            event_tx,
        };
        (adapter, event_rx)
    }

    pub fn event_tx(&self) -> broadcast::Sender<AgentEvent> {
        self.event_tx.clone()
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
        let res = self
            .send_request(
                "thread/start",
                serde_json::json!({
                    "cwd": cwd,
                    "runtimeWorkspaceRoots": sub_paths
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

    pub async fn submit_turn(
        &self,
        chat_id: &str,
        thread_id: &str,
        message_id: &str,
        prompt: &str,
        model: Option<&str>,
        effort: Option<&str>,
    ) -> Result<String> {
        tracing::info!(
            "[CodexAdapter] submit_turn starting: chat={}, thread={}, model={:?}, effort={:?}",
            chat_id,
            thread_id,
            model,
            effort
        );

        let mut turn_params = serde_json::json!({
            "threadId": thread_id,
            "input": [{ "type": "text", "text": prompt }]
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

    pub async fn get_active_turn(&self, chat_id: &str) -> Option<String> {
        let active = self.chat_active_turn.lock().await;
        active.get(chat_id).map(|(turn_id, _)| turn_id.clone()).filter(|s| !s.is_empty())
    }

    pub async fn clear_active_turn(&self, chat_id: &str) {
        let mut active = self.chat_active_turn.lock().await;
        active.remove(chat_id);
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
            let _ = tx.send(AgentEvent::TokenDelta {
                chat_id,
                message_id: msg_id,
                delta,
            });
        } else if method == "item/completed" {
            let item = &params["item"];
            let item_type = item["type"].as_str().unwrap_or("");
            let msg_id = active_turn
                .as_ref()
                .map(|t| t.1.clone())
                .unwrap_or_else(|| nanoid::nanoid!(16));

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
            let _ = tx.send(AgentEvent::ApprovalRequested {
                chat_id,
                request: approval,
            });
        } else if method == "turn/completed" {
            chat_turn.lock().await.remove(&chat_id);
            let text_content = chat_text.lock().await.remove(&chat_id);
            let turn_id = params
                .get("turn")
                .and_then(|t| t.get("id"))
                .and_then(|id| id.as_str())
                .or_else(|| params.get("turnId").and_then(|id| id.as_str()))
                .unwrap_or("")
                .to_string();
            let _ = tx.send(AgentEvent::TurnCompleted {
                chat_id,
                turn_id,
                status: ChatStatus::Idle,
                text_content,
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
