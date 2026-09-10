use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{broadcast, Mutex};
use uuid::Uuid;

use super::{AgentEvent, CliAdapter};
use canywhere_protocol::models::*;

struct AgySession {
    child: Child,
    stdin: ChildStdin,
    active_turn_id: Option<String>,
}

pub struct AgyAdapter {
    agy_bin: String,
    sessions: Arc<Mutex<HashMap<String, AgySession>>>,
    chat_active_turn: Arc<Mutex<HashMap<String, (String, String)>>>, // chat_id -> (thread_id, turn_id)
    chat_accumulated_text: Arc<Mutex<HashMap<String, String>>>,
    chat_accumulated_blocks: Arc<Mutex<HashMap<String, Vec<MessageBlock>>>>,
    chat_reasoning: Arc<Mutex<HashMap<String, String>>>,
    cached_models: Arc<Mutex<Option<(std::time::Instant, Vec<ModelInfo>)>>>,
    event_tx: broadcast::Sender<AgentEvent>,
}

impl AgyAdapter {
    pub fn new(agy_bin: &str, event_tx: broadcast::Sender<AgentEvent>) -> Self {
        let cached_models = Arc::new(Mutex::new(None));

        // Prefetch available models in background so subsequent list_models calls return in 0ms
        let bin = agy_bin.to_string();
        let cache_clone = Arc::clone(&cached_models);
        tokio::spawn(async move {
            if let Ok(output) = Command::new(&bin).arg("models").output().await {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    let models = parse_agy_models_output(&text);
                    if !models.is_empty() {
                        let mut guard = cache_clone.lock().await;
                        *guard = Some((std::time::Instant::now(), models));
                    }
                }
            }
        });

        Self {
            agy_bin: agy_bin.to_string(),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            chat_active_turn: Arc::new(Mutex::new(HashMap::new())),
            chat_accumulated_text: Arc::new(Mutex::new(HashMap::new())),
            chat_accumulated_blocks: Arc::new(Mutex::new(HashMap::new())),
            chat_reasoning: Arc::new(Mutex::new(HashMap::new())),
            cached_models,
            event_tx,
        }
    }

    pub fn resolve_binary() -> String {
        if let Ok(bin) = std::env::var("AGY_BIN") {
            return bin;
        }
        if let Ok(output) = std::process::Command::new("which").arg("agy").output() {
            if output.status.success() {
                let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !p.is_empty() {
                    return p;
                }
            }
        }
        if let Some(home) = dirs::home_dir() {
            let candidates = [
                format!("{}/.local/bin/agy", home.display()),
                "/opt/homebrew/bin/agy".to_string(),
                "/usr/local/bin/agy".to_string(),
            ];
            for c in candidates {
                if Path::new(&c).exists() {
                    return c;
                }
            }
        }
        "agy".to_string()
    }

    pub fn agy_bin(&self) -> &str {
        &self.agy_bin
    }
}

fn conversation_exists(thread_id: &str) -> bool {
    let Some(home) = dirs::home_dir() else {
        return false;
    };
    let paths = [
        home.join(".gemini/antigravity-cli/brain").join(thread_id),
        home.join(".gemini/antigravity/brain").join(thread_id),
    ];
    paths.iter().any(|p| p.exists())
}

fn extract_last_thinking(thread_id: &str) -> Option<String> {
    let home = dirs::home_dir()?;
    let paths = [
        home.join(".gemini/antigravity-cli/brain")
            .join(thread_id)
            .join(".system_generated/logs/transcript.jsonl"),
        home.join(".gemini/antigravity/brain")
            .join(thread_id)
            .join(".system_generated/logs/transcript.jsonl"),
    ];

    use std::io::BufRead;
    for transcript_path in &paths {
        if !transcript_path.exists() {
            continue;
        }
        if let Ok(file) = std::fs::File::open(transcript_path) {
            let reader = std::io::BufReader::new(file);
            let mut last_thinking: Option<String> = None;
            for line in reader.lines().flatten() {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                    if val.get("type").and_then(|t| t.as_str()) == Some("PLANNER_RESPONSE") {
                        if let Some(th) = val.get("thinking").and_then(|t| t.as_str()) {
                            if !th.trim().is_empty() {
                                last_thinking = Some(th.to_string());
                            }
                        }
                    }
                }
            }
            if last_thinking.is_some() {
                return last_thinking;
            }
        }
    }
    None
}

#[async_trait]
impl CliAdapter for AgyAdapter {
    fn id(&self) -> &'static str {
        "agy"
    }

    fn name(&self) -> &'static str {
        "Google Antigravity"
    }

    fn description(&self) -> &'static str {
        "Local Antigravity CLI (Gemini 3.8/3.7 Flash, Claude Sonnet 4.6, GPT-OSS)"
    }

    fn is_configured(&self) -> bool {
        Path::new(&self.agy_bin).exists()
            || std::process::Command::new(&self.agy_bin)
                .arg("--help")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
    }

    fn capabilities(&self) -> AdapterCapabilities {
        AdapterCapabilities {
            supports_reasoning_stream: true,
            supports_file_diffs: true,
            supports_steering: false,
            supports_interrupt: true,
            supports_session_resumption: true,
            supports_approvals: false,
            supported_modes: vec!["agent".to_string(), "plan".to_string()],
        }
    }

    async fn start_thread(
        &self,
        _chat_id: &str,
        _cwd: &str,
        _sub_paths: Option<&[String]>,
    ) -> Result<String> {
        let conversation_id = Uuid::new_v4().to_string();
        Ok(conversation_id)
    }

    async fn resume_or_start_thread(
        &self,
        _chat_id: &str,
        thread_id: Option<&str>,
        _cwd: &str,
        _sub_paths: Option<&[String]>,
    ) -> Result<String> {
        Ok(thread_id
            .map(|t| t.to_string())
            .unwrap_or_else(|| Uuid::new_v4().to_string()))
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
        let turn_id = format!("turn-{}", Uuid::new_v4());

        // Reset accumulated state
        self.chat_accumulated_text
            .lock()
            .await
            .insert(chat_id.to_string(), String::new());
        self.chat_accumulated_blocks
            .lock()
            .await
            .insert(chat_id.to_string(), Vec::new());
        self.chat_reasoning
            .lock()
            .await
            .insert(chat_id.to_string(), String::new());
        self.chat_active_turn.lock().await.insert(
            chat_id.to_string(),
            (thread_id.to_string(), turn_id.clone()),
        );

        // Initial agent message
        let agent_message = Message {
            id: message_id.to_string(),
            chat_id: chat_id.to_string(),
            turn_id: Some(turn_id.clone()),
            role: MessageRole::Agent,
            blocks: Vec::new(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
            streaming: true,
        };
        let _ = self.event_tx.send(AgentEvent::MessageCreated {
            message: agent_message,
        });

        let (eff_model, eff_effort) = normalize_model_and_effort(model, effort);

        let mut sessions = self.sessions.lock().await;
        let session_exists = sessions.contains_key(chat_id);

        if !session_exists {
            let mut cmd = Command::new(&self.agy_bin);
            cmd.arg("--input-format")
                .arg("stream-json")
                .arg("--output-format")
                .arg("stream-json")
                .arg("--print=");

            if let Some(PermissionMode::ReadOnly) = permission_mode {
                cmd.arg("--mode").arg("plan");
            } else {
                cmd.arg("--mode").arg("accept-edits");
            }
            cmd.arg("--dangerously-skip-permissions");

            if conversation_exists(thread_id) {
                cmd.arg("--conversation").arg(thread_id);
            }

            if let Some(m) = &eff_model {
                cmd.arg("--model").arg(m);
            }
            if let Some(e) = &eff_effort {
                cmd.arg("--effort").arg(e);
            }
            if let Some(dir) = cwd {
                if !dir.is_empty() {
                    cmd.current_dir(dir);
                    cmd.arg("--add-dir").arg(dir);
                }
            }

            cmd.stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd.spawn()?;
            let stdin = child.stdin.take().expect("Failed to open child stdin");
            let stdout = child.stdout.take().expect("Failed to open child stdout");

            sessions.insert(
                chat_id.to_string(),
                AgySession {
                    child,
                    stdin,
                    active_turn_id: Some(turn_id.clone()),
                },
            );

            // Spawn background reader for this session
            let chat_id_str = chat_id.to_string();
            let msg_id_str = message_id.to_string();
            let turn_id_str = turn_id.clone();
            let thread_id_str = thread_id.to_string();
            let captured_conv_id =
                Arc::new(tokio::sync::Mutex::new(if conversation_exists(thread_id) {
                    Some(thread_id.to_string())
                } else {
                    None
                }));
            let captured_conv_id_clone = Arc::clone(&captured_conv_id);
            let event_tx = self.event_tx.clone();
            let chat_active_turn = Arc::clone(&self.chat_active_turn);
            let chat_text = Arc::clone(&self.chat_accumulated_text);
            let chat_blocks = Arc::clone(&self.chat_accumulated_blocks);
            let chat_reasoning = Arc::clone(&self.chat_reasoning);
            let sessions_clone = Arc::clone(&self.sessions);

            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        let ev = val.get("event").and_then(|v| v.as_str()).unwrap_or("");
                        match ev {
                            "init" => {
                                if let Some(conv_id) =
                                    val.get("conversation_id").and_then(|v| v.as_str())
                                {
                                    if !conv_id.is_empty() {
                                        *captured_conv_id_clone.lock().await =
                                            Some(conv_id.to_string());
                                        let _ = event_tx.send(AgentEvent::ChatThreadUpdated {
                                            chat_id: chat_id_str.clone(),
                                            thread_id: conv_id.to_string(),
                                        });
                                    }
                                }
                            }
                            "step_update" => {
                                if let Some(su) = val.get("step_update") {
                                    let step_type =
                                        su.get("step_type").and_then(|v| v.as_str()).unwrap_or("");
                                    let state =
                                        su.get("state").and_then(|v| v.as_str()).unwrap_or("");
                                    let step_idx =
                                        su.get("step_index").and_then(|v| v.as_i64()).unwrap_or(0);

                                    if step_type == "agent_response" {
                                        let reasoning_delta = su
                                            .get("thinking_delta")
                                            .or_else(|| su.get("thought_delta"))
                                            .or_else(|| su.get("reasoning_delta"))
                                            .or_else(|| su.get("delta_raw_thinking"))
                                            .and_then(|v| v.as_str());

                                        if let Some(r_delta) = reasoning_delta {
                                            if !r_delta.is_empty() {
                                                {
                                                    let mut r_guard = chat_reasoning.lock().await;
                                                    r_guard
                                                        .entry(chat_id_str.clone())
                                                        .or_default()
                                                        .push_str(r_delta);
                                                }
                                                {
                                                    let mut blocks_lock = chat_blocks.lock().await;
                                                    let blocks = blocks_lock
                                                        .entry(chat_id_str.clone())
                                                        .or_default();
                                                    if let Some(MessageBlock::Reasoning {
                                                        content,
                                                        completed,
                                                    }) = blocks.iter_mut().rev().find(|b| {
                                                        matches!(b, MessageBlock::Reasoning { .. })
                                                    }) {
                                                        if !*completed {
                                                            content.push_str(r_delta);
                                                        } else {
                                                            blocks.push(MessageBlock::Reasoning {
                                                                content: r_delta.to_string(),
                                                                completed: false,
                                                            });
                                                        }
                                                    } else {
                                                        blocks.push(MessageBlock::Reasoning {
                                                            content: r_delta.to_string(),
                                                            completed: false,
                                                        });
                                                    }
                                                }
                                                let _ = event_tx.send(AgentEvent::ReasoningDelta {
                                                    chat_id: chat_id_str.clone(),
                                                    message_id: msg_id_str.clone(),
                                                    delta: r_delta.to_string(),
                                                });
                                            }
                                        }

                                        if let Some(delta) =
                                            su.get("text_delta").and_then(|v| v.as_str())
                                        {
                                            if !delta.is_empty() {
                                                let current_text = {
                                                    let mut text_guard = chat_text.lock().await;
                                                    let entry = text_guard
                                                        .entry(chat_id_str.clone())
                                                        .or_default();
                                                    entry.push_str(delta);
                                                    entry.clone()
                                                };

                                                {
                                                    let mut blocks_lock = chat_blocks.lock().await;
                                                    let blocks = blocks_lock
                                                        .entry(chat_id_str.clone())
                                                        .or_default();
                                                    if let Some(MessageBlock::Reasoning {
                                                        completed,
                                                        ..
                                                    }) = blocks.iter_mut().rev().find(|b| {
                                                        matches!(b, MessageBlock::Reasoning { .. })
                                                    }) {
                                                        *completed = true;
                                                    }
                                                    if let Some(MessageBlock::Text { content }) =
                                                        blocks.iter_mut().rev().find(|b| {
                                                            matches!(b, MessageBlock::Text { .. })
                                                        })
                                                    {
                                                        *content = current_text;
                                                    } else {
                                                        blocks.push(MessageBlock::Text {
                                                            content: current_text,
                                                        });
                                                    }
                                                }

                                                let _ = event_tx.send(AgentEvent::TokenDelta {
                                                    chat_id: chat_id_str.clone(),
                                                    message_id: msg_id_str.clone(),
                                                    delta: delta.to_string(),
                                                });
                                            }
                                        }
                                    } else if step_type == "thinking" || step_type == "reasoning" {
                                        let r_delta = su
                                            .get("text_delta")
                                            .or_else(|| su.get("thinking_delta"))
                                            .or_else(|| su.get("thought_delta"))
                                            .or_else(|| su.get("reasoning_delta"))
                                            .and_then(|v| v.as_str());
                                        if let Some(r_delta) = r_delta {
                                            if !r_delta.is_empty() {
                                                {
                                                    let mut r_guard = chat_reasoning.lock().await;
                                                    r_guard
                                                        .entry(chat_id_str.clone())
                                                        .or_default()
                                                        .push_str(r_delta);
                                                }
                                                {
                                                    let mut blocks_lock = chat_blocks.lock().await;
                                                    let blocks = blocks_lock
                                                        .entry(chat_id_str.clone())
                                                        .or_default();
                                                    if let Some(MessageBlock::Reasoning {
                                                        content,
                                                        completed,
                                                    }) = blocks.iter_mut().rev().find(|b| {
                                                        matches!(b, MessageBlock::Reasoning { .. })
                                                    }) {
                                                        if !*completed {
                                                            content.push_str(r_delta);
                                                        } else {
                                                            blocks.push(MessageBlock::Reasoning {
                                                                content: r_delta.to_string(),
                                                                completed: false,
                                                            });
                                                        }
                                                    } else {
                                                        blocks.push(MessageBlock::Reasoning {
                                                            content: r_delta.to_string(),
                                                            completed: false,
                                                        });
                                                    }
                                                }
                                                let _ = event_tx.send(AgentEvent::ReasoningDelta {
                                                    chat_id: chat_id_str.clone(),
                                                    message_id: msg_id_str.clone(),
                                                    delta: r_delta.to_string(),
                                                });
                                            }
                                        }
                                    } else if step_type == "tool" {
                                        {
                                            let mut blocks_lock = chat_blocks.lock().await;
                                            let blocks =
                                                blocks_lock.entry(chat_id_str.clone()).or_default();
                                            if let Some(MessageBlock::Reasoning {
                                                completed, ..
                                            }) = blocks.iter_mut().rev().find(|b| {
                                                matches!(b, MessageBlock::Reasoning { .. })
                                            }) {
                                                *completed = true;
                                            }
                                        }

                                        let tool_name = su
                                            .get("tool_name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("tool");
                                        let block_id = format!("{}-step-{}", chat_id_str, step_idx);
                                        let tool_info = su.get("tool_info");

                                        let cmd_cwd = tool_info
                                            .and_then(|ti| ti.get("parameters"))
                                            .and_then(|p| p.get("Cwd"))
                                            .and_then(|c| c.as_str())
                                            .unwrap_or(".")
                                            .to_string();

                                        if state == "ACTIVE" {
                                            let block = if tool_name == "run_command" {
                                                let cmd = tool_info
                                                    .and_then(|ti| ti.get("parameters"))
                                                    .and_then(|p| p.get("CommandLine"))
                                                    .and_then(|c| c.as_str())
                                                    .unwrap_or("");
                                                MessageBlock::CommandExec {
                                                    command: cmd.to_string(),
                                                    cwd: cmd_cwd,
                                                    output: None,
                                                    exit_code: None,
                                                    status: CommandExecStatus::Running,
                                                }
                                            } else {
                                                let args = tool_info
                                                    .and_then(|ti| ti.get("parameters"))
                                                    .cloned()
                                                    .unwrap_or(serde_json::Value::Null);
                                                MessageBlock::ToolCall {
                                                    call_id: block_id.clone(),
                                                    name: tool_name.to_string(),
                                                    args,
                                                    output: None,
                                                    status: ToolCallStatus::Running,
                                                }
                                            };

                                            let _ = event_tx.send(AgentEvent::BlockStarted {
                                                chat_id: chat_id_str.clone(),
                                                message_id: msg_id_str.clone(),
                                                block_id: block_id.clone(),
                                                block: block.clone(),
                                            });

                                            let mut blocks_guard = chat_blocks.lock().await;
                                            blocks_guard
                                                .entry(chat_id_str.clone())
                                                .or_default()
                                                .push(block);
                                        } else if state == "DONE" {
                                            let output = tool_info
                                                .and_then(|ti| ti.get("output"))
                                                .and_then(|o| o.as_str())
                                                .map(|s| s.to_string());

                                            let block = if tool_name == "run_command" {
                                                let cmd = tool_info
                                                    .and_then(|ti| ti.get("parameters"))
                                                    .and_then(|p| p.get("CommandLine"))
                                                    .and_then(|c| c.as_str())
                                                    .unwrap_or("");
                                                MessageBlock::CommandExec {
                                                    command: cmd.to_string(),
                                                    cwd: cmd_cwd,
                                                    output,
                                                    exit_code: Some(0),
                                                    status: CommandExecStatus::Completed,
                                                }
                                            } else {
                                                let args = tool_info
                                                    .and_then(|ti| ti.get("parameters"))
                                                    .cloned()
                                                    .unwrap_or(serde_json::Value::Null);
                                                MessageBlock::ToolCall {
                                                    call_id: block_id.clone(),
                                                    name: tool_name.to_string(),
                                                    args,
                                                    output,
                                                    status: ToolCallStatus::Completed,
                                                }
                                            };

                                            let _ = event_tx.send(AgentEvent::BlockCompleted {
                                                chat_id: chat_id_str.clone(),
                                                message_id: msg_id_str.clone(),
                                                block_id: block_id.clone(),
                                                block: Some(block.clone()),
                                            });

                                            let mut blocks_guard = chat_blocks.lock().await;
                                            let list = blocks_guard
                                                .entry(chat_id_str.clone())
                                                .or_default();
                                            if let Some(pos) = list.iter().rposition(|b| match b {
                                                MessageBlock::ToolCall { call_id, .. } => {
                                                    call_id == &block_id
                                                }
                                                MessageBlock::CommandExec { command, .. } => {
                                                    if let MessageBlock::CommandExec {
                                                        command: cmd2,
                                                        ..
                                                    } = &block
                                                    {
                                                        command == cmd2
                                                    } else {
                                                        false
                                                    }
                                                }
                                                _ => false,
                                            }) {
                                                list[pos] = block;
                                            } else {
                                                list.push(block);
                                            }
                                        }
                                    }
                                }
                            }
                            "result" => {
                                let status = val
                                    .get("result")
                                    .and_then(|r| r.get("status"))
                                    .and_then(|s| s.as_str())
                                    .unwrap_or("SUCCESS");

                                let chat_status = if status == "SUCCESS" {
                                    ChatStatus::Idle
                                } else {
                                    ChatStatus::Error
                                };

                                let active_conv_id = captured_conv_id_clone
                                    .lock()
                                    .await
                                    .clone()
                                    .unwrap_or_else(|| thread_id_str.clone());

                                let disk_thinking = extract_last_thinking(&active_conv_id);
                                let mut reasoning =
                                    chat_reasoning.lock().await.get(&chat_id_str).cloned();
                                if reasoning.as_ref().map_or(true, |r| r.trim().is_empty()) {
                                    reasoning = disk_thinking;
                                }

                                if let Some(ref r_text) = reasoning {
                                    if !r_text.trim().is_empty() {
                                        let mut blocks_guard = chat_blocks.lock().await;
                                        let blocks =
                                            blocks_guard.entry(chat_id_str.clone()).or_default();
                                        if let Some(MessageBlock::Reasoning {
                                            content,
                                            completed,
                                        }) = blocks
                                            .iter_mut()
                                            .rev()
                                            .find(|b| matches!(b, MessageBlock::Reasoning { .. }))
                                        {
                                            if content.trim().is_empty() {
                                                *content = r_text.clone();
                                            }
                                            *completed = true;
                                        } else {
                                            blocks.insert(
                                                0,
                                                MessageBlock::Reasoning {
                                                    content: r_text.clone(),
                                                    completed: true,
                                                },
                                            );
                                        }
                                    }
                                }

                                let final_text = chat_text.lock().await.get(&chat_id_str).cloned();
                                let mut final_blocks = chat_blocks
                                    .lock()
                                    .await
                                    .get(&chat_id_str)
                                    .cloned()
                                    .unwrap_or_default();

                                if let Some(ref text) = final_text {
                                    if !text.is_empty() {
                                        if let Some(MessageBlock::Text { content }) = final_blocks
                                            .iter_mut()
                                            .rev()
                                            .find(|b| matches!(b, MessageBlock::Text { .. }))
                                        {
                                            *content = text.clone();
                                        } else {
                                            final_blocks.push(MessageBlock::Text {
                                                content: text.clone(),
                                            });
                                        }
                                    }
                                }

                                let _ = event_tx.send(AgentEvent::TurnCompleted {
                                    chat_id: chat_id_str.clone(),
                                    message_id: msg_id_str.clone(),
                                    turn_id: turn_id_str.clone(),
                                    status: chat_status,
                                    blocks: final_blocks,
                                    text_content: final_text,
                                    reasoning_content: reasoning,
                                });

                                chat_active_turn.lock().await.remove(&chat_id_str);
                                sessions_clone.lock().await.remove(&chat_id_str);
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                chat_active_turn.lock().await.remove(&chat_id_str);
                sessions_clone.lock().await.remove(&chat_id_str);
            });
        }

        // Send turn to child stdin
        if let Some(session) = sessions.get_mut(chat_id) {
            session.active_turn_id = Some(turn_id.clone());
            let input_obj = serde_json::json!({
                "event": "user",
                "message": {
                    "content": prompt
                }
            });
            let line = format!("{}\n", serde_json::to_string(&input_obj)?);
            session.stdin.write_all(line.as_bytes()).await?;
            session.stdin.flush().await?;
        }

        Ok(turn_id)
    }

    async fn interrupt_turn(&self, _thread_id: &str, _turn_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        for (_, session) in sessions.iter_mut() {
            let _ = session.child.start_kill();
        }
        sessions.clear();
        Ok(())
    }

    async fn respond_approval(&self, _approval_id: &str, _decision: &str) -> Result<()> {
        Ok(())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        const CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(600); // 10 minutes

        {
            let guard = self.cached_models.lock().await;
            if let Some((timestamp, models)) = guard.as_ref() {
                if timestamp.elapsed() < CACHE_TTL {
                    return Ok(models.clone());
                }
                // Stale-while-revalidate: return stale models immediately, refresh in background
                let bin = self.agy_bin.clone();
                let cache_clone = Arc::clone(&self.cached_models);
                tokio::spawn(async move {
                    if let Ok(output) = Command::new(&bin).arg("models").output().await {
                        if output.status.success() {
                            let text = String::from_utf8_lossy(&output.stdout);
                            let fresh = parse_agy_models_output(&text);
                            if !fresh.is_empty() {
                                let mut g = cache_clone.lock().await;
                                *g = Some((std::time::Instant::now(), fresh));
                            }
                        }
                    }
                });
                return Ok(models.clone());
            }
        }

        let output = Command::new(&self.agy_bin).arg("models").output().await;
        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let models = parse_agy_models_output(&text);
                if !models.is_empty() {
                    let mut guard = self.cached_models.lock().await;
                    *guard = Some((std::time::Instant::now(), models.clone()));
                    return Ok(models);
                }
            }
        }

        // Fallback models
        Ok(vec![
            ModelInfo {
                id: "gemini-3.8-flash".to_string(),
                model: "gemini-3.8-flash".to_string(),
                display_name: "Gemini 3.8 Flash".to_string(),
                description: Some("Google Antigravity model (Gemini 3.8 Flash)".to_string()),
                is_default: true,
                supported_reasoning_efforts: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_reasoning_effort: Some("high".to_string()),
            },
            ModelInfo {
                id: "gemini-3.7-flash".to_string(),
                model: "gemini-3.7-flash".to_string(),
                display_name: "Gemini 3.7 Flash".to_string(),
                description: Some("Google Antigravity model (Gemini 3.7 Flash)".to_string()),
                is_default: false,
                supported_reasoning_efforts: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_reasoning_effort: Some("high".to_string()),
            },
            ModelInfo {
                id: "claude-sonnet-4-6".to_string(),
                model: "claude-sonnet-4-6".to_string(),
                display_name: "Claude Sonnet 4.6 (Thinking)".to_string(),
                description: Some("Google Antigravity model (Claude Sonnet 4.6)".to_string()),
                is_default: false,
                supported_reasoning_efforts: vec![],
                default_reasoning_effort: None,
            },
            ModelInfo {
                id: "gpt-oss-120b".to_string(),
                model: "gpt-oss-120b".to_string(),
                display_name: "GPT-OSS 120B".to_string(),
                description: Some("Google Antigravity model (GPT-OSS 120B)".to_string()),
                is_default: false,
                supported_reasoning_efforts: vec!["medium".to_string()],
                default_reasoning_effort: Some("medium".to_string()),
            },
        ])
    }

    async fn get_active_turn(&self, chat_id: &str) -> Option<String> {
        self.chat_active_turn
            .lock()
            .await
            .get(chat_id)
            .map(|(_, t)| t.clone())
    }

    async fn clear_active_turn(&self, chat_id: &str) {
        self.chat_active_turn.lock().await.remove(chat_id);
    }

    async fn get_active_turns_count(&self) -> u32 {
        self.chat_active_turn.lock().await.len() as u32
    }

    async fn get_active_streaming_message(&self, chat_id: &str) -> Option<Message> {
        let active = self.chat_active_turn.lock().await.get(chat_id).cloned();
        if let Some((_, turn_id)) = active {
            let text = self
                .chat_accumulated_text
                .lock()
                .await
                .get(chat_id)
                .cloned()
                .unwrap_or_default();
            let blocks = self
                .chat_accumulated_blocks
                .lock()
                .await
                .get(chat_id)
                .cloned()
                .unwrap_or_default();
            let mut final_blocks = blocks;
            if !text.is_empty() {
                final_blocks.push(MessageBlock::Text { content: text });
            }
            Some(Message {
                id: format!("msg-{}", turn_id),
                chat_id: chat_id.to_string(),
                turn_id: Some(turn_id),
                role: MessageRole::Agent,
                blocks: final_blocks,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64,
                streaming: true,
            })
        } else {
            None
        }
    }

    async fn get_pending_approvals(&self, _chat_id: &str) -> Vec<ApprovalRequest> {
        Vec::new()
    }

    async fn get_all_pending_approvals(&self) -> Vec<ApprovalRequest> {
        Vec::new()
    }

    fn icon(&self) -> Option<String> {
        Some("/icons/provider_agy.svg".to_string())
    }

    fn commands(&self) -> Vec<ProviderCommand> {
        vec![
            ProviderCommand {
                name: "/goal".to_string(),
                description: "Run autonomous long-running task until goal is achieved".to_string(),
                category: "agent".to_string(),
                icon: Some("target".to_string()),
                requires_args: true,
            },
            ProviderCommand {
                name: "/learn".to_string(),
                description: "Persist learned preferences and behaviors for future tasks"
                    .to_string(),
                category: "agent".to_string(),
                icon: Some("book-open".to_string()),
                requires_args: true,
            },
            ProviderCommand {
                name: "/grill-me".to_string(),
                description: "Interactive interview to align on design decisions and trade-offs"
                    .to_string(),
                category: "agent".to_string(),
                icon: Some("message-circle-question".to_string()),
                requires_args: false,
            },
            ProviderCommand {
                name: "/browser".to_string(),
                description: "Web browsing and automated research on pages".to_string(),
                category: "agent".to_string(),
                icon: Some("globe".to_string()),
                requires_args: true,
            },
        ]
    }

    fn actions(&self) -> Vec<ProviderAction> {
        vec![ProviderAction {
            id: "grill-me".to_string(),
            label: "Grill Me (Plan Interview)".to_string(),
            icon: Some("message-circle-question".to_string()),
            placement: "toolbar".to_string(),
        }]
    }

    async fn execute_command(
        &self,
        chat_id: &str,
        thread_id: &str,
        command: &str,
        args: Option<&str>,
    ) -> Result<canywhere_protocol::rpc::ChatExecuteCommandResult> {
        let prompt = match command {
            "/goal" | "goal" => {
                let goal_desc = args.unwrap_or("").trim();
                if goal_desc.is_empty() {
                    anyhow::bail!("Command /goal requires a goal description");
                }
                format!("/goal {}", goal_desc)
            }
            "/learn" | "learn" => {
                let note = args.unwrap_or("").trim();
                if note.is_empty() {
                    anyhow::bail!("Command /learn requires instruction content to remember");
                }
                format!("/learn {}", note)
            }
            "/grill-me" | "grill-me" => {
                if let Some(topic) = args.filter(|s| !s.trim().is_empty()) {
                    format!("/grill-me {}", topic.trim())
                } else {
                    "/grill-me".to_string()
                }
            }
            "/browser" | "browser" => {
                let query = args.unwrap_or("").trim();
                if query.is_empty() {
                    anyhow::bail!("Command /browser requires a search query or URL");
                }
                format!("/browser {}", query)
            }
            _ => anyhow::bail!("Command '{}' is not supported by AGY", command),
        };

        let message_id = nanoid::nanoid!(16);
        let turn_id = self
            .submit_turn(
                chat_id,
                thread_id,
                &message_id,
                &prompt,
                None,
                None,
                None,
                None,
            )
            .await?;
        Ok(canywhere_protocol::rpc::ChatExecuteCommandResult {
            success: true,
            message: Some(format!(
                "Executed AGY command '{}' (turn: {})",
                command, turn_id
            )),
        })
    }
}

fn normalize_model_and_effort(
    model: Option<&str>,
    effort: Option<&str>,
) -> (Option<String>, Option<String>) {
    let raw_model = match model {
        Some(m) if !m.trim().is_empty() => m.trim(),
        _ => return (None, None),
    };

    // If raw_model has -high, -medium, -low suffix, extract it
    let (base_model, extracted_effort) = if let Some(stripped) = raw_model.strip_suffix("-high") {
        (stripped, Some("high"))
    } else if let Some(stripped) = raw_model.strip_suffix("-medium") {
        (stripped, Some("medium"))
    } else if let Some(stripped) = raw_model.strip_suffix("-low") {
        (stripped, Some("low"))
    } else {
        (raw_model, None)
    };

    // Claude models NEVER accept --effort in agy CLI
    if base_model.starts_with("claude") {
        return (Some(base_model.to_string()), None);
    }

    // Determine final effort
    let final_effort = effort.or(extracted_effort);

    // If gpt-oss-120b, agy only supports medium effort
    if base_model == "gpt-oss-120b" {
        return (Some(base_model.to_string()), Some("medium".to_string()));
    }

    // For other models (e.g. Gemini), validate effort if provided
    let validated_effort = final_effort.map(|e| match e.to_lowercase().as_str() {
        "low" => "low".to_string(),
        "medium" => "medium".to_string(),
        _ => "high".to_string(),
    });

    (Some(base_model.to_string()), validated_effort)
}

fn parse_agy_models_output(text: &str) -> Vec<ModelInfo> {
    struct GroupedModel {
        id: String,
        display_name: String,
        efforts: Vec<String>,
    }

    let mut groups: Vec<GroupedModel> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Fetching") {
            continue;
        }
        let parts: Vec<&str> = trimmed.split('\t').collect();
        if parts.is_empty() {
            continue;
        }

        let raw_id = parts[0].trim();
        let raw_display_name = if parts.len() > 1 {
            parts[1].trim()
        } else {
            raw_id
        };

        // Determine if ID ends with -high, -medium, -low
        let (base_id, effort) = if let Some(stripped) = raw_id.strip_suffix("-high") {
            (stripped, Some("high"))
        } else if let Some(stripped) = raw_id.strip_suffix("-medium") {
            (stripped, Some("medium"))
        } else if let Some(stripped) = raw_id.strip_suffix("-low") {
            (stripped, Some("low"))
        } else {
            (raw_id, None)
        };

        // Clean display name by stripping (High), (Medium), (Low) if effort is present
        let clean_display_name = if effort.is_some() {
            let mut name = raw_display_name;
            for suffix in &[
                " (High)",
                " (high)",
                " (Medium)",
                " (medium)",
                " (Low)",
                " (low)",
            ] {
                if let Some(stripped) = name.strip_suffix(suffix) {
                    name = stripped;
                    break;
                }
            }
            name.trim().to_string()
        } else {
            raw_display_name.to_string()
        };

        if let Some(group) = groups.iter_mut().find(|g| g.id == base_id) {
            if let Some(eff) = effort {
                if !group.efforts.contains(&eff.to_string()) {
                    group.efforts.push(eff.to_string());
                }
            }
        } else {
            let mut efforts = Vec::new();
            if let Some(eff) = effort {
                efforts.push(eff.to_string());
            }
            groups.push(GroupedModel {
                id: base_id.to_string(),
                display_name: clean_display_name,
                efforts,
            });
        }
    }

    groups
        .into_iter()
        .map(|group| {
            // Sort efforts into standard order ["low", "medium", "high"]
            let mut ordered_efforts = Vec::new();
            for std_eff in &["low", "medium", "high"] {
                if group.efforts.iter().any(|e| e == std_eff) {
                    ordered_efforts.push(std_eff.to_string());
                }
            }
            for eff in &group.efforts {
                if !ordered_efforts.contains(eff) {
                    ordered_efforts.push(eff.clone());
                }
            }

            let default_effort = if ordered_efforts.iter().any(|e| e == "high") {
                Some("high".to_string())
            } else if ordered_efforts.iter().any(|e| e == "medium") {
                Some("medium".to_string())
            } else {
                ordered_efforts.first().cloned()
            };

            let is_default = group.id == "gemini-3.8-flash";
            let description = Some(format!("Google Antigravity model ({})", group.display_name));

            ModelInfo {
                id: group.id.clone(),
                model: group.id.clone(),
                display_name: group.display_name,
                description,
                is_default,
                supported_reasoning_efforts: ordered_efforts,
                default_reasoning_effort: default_effort,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_agy_models_output_groups_and_separates_efforts() {
        let sample_output = "\
Fetching available models...
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
gemini-3.7-flash-high\tGemini 3.7 Flash (High)
gemini-3.7-flash-medium\tGemini 3.7 Flash (Medium)
gemini-3.7-flash-low\tGemini 3.7 Flash (Low)
gemini-3.6-flash-high\tGemini 3.6 Flash (High)
gemini-3.6-flash-medium\tGemini 3.6 Flash (Medium)
gemini-3.6-flash-low\tGemini 3.6 Flash (Low)
gemini-3.1-pro-high\tGemini 3.1 Pro (High)
gemini-3.1-pro-low\tGemini 3.1 Pro (Low)
claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)
";

        let models = parse_agy_models_output(sample_output);
        assert_eq!(models.len(), 7);

        // 1. Gemini 3.8 Flash
        let g38 = &models[0];
        assert_eq!(g38.id, "gemini-3.8-flash");
        assert_eq!(g38.model, "gemini-3.8-flash");
        assert_eq!(g38.display_name, "Gemini 3.8 Flash");
        assert!(g38.is_default);
        assert_eq!(
            g38.supported_reasoning_efforts,
            vec!["low".to_string(), "medium".to_string(), "high".to_string()]
        );
        assert_eq!(g38.default_reasoning_effort, Some("high".to_string()));

        // 2. Gemini 3.7 Flash
        let g37 = &models[1];
        assert_eq!(g37.id, "gemini-3.7-flash");
        assert_eq!(g37.display_name, "Gemini 3.7 Flash");
        assert!(!g37.is_default);
        assert_eq!(
            g37.supported_reasoning_efforts,
            vec!["low".to_string(), "medium".to_string(), "high".to_string()]
        );

        // 3. Gemini 3.6 Flash
        let g36 = &models[2];
        assert_eq!(g36.id, "gemini-3.6-flash");
        assert_eq!(g36.display_name, "Gemini 3.6 Flash");

        // 4. Gemini 3.1 Pro
        let g31 = &models[3];
        assert_eq!(g31.id, "gemini-3.1-pro");
        assert_eq!(g31.display_name, "Gemini 3.1 Pro");
        assert_eq!(
            g31.supported_reasoning_efforts,
            vec!["low".to_string(), "high".to_string()]
        );
        assert_eq!(g31.default_reasoning_effort, Some("high".to_string()));

        // 5. Claude Sonnet 4.6
        let cs = &models[4];
        assert_eq!(cs.id, "claude-sonnet-4-6");
        assert_eq!(cs.display_name, "Claude Sonnet 4.6 (Thinking)");
        assert!(cs.supported_reasoning_efforts.is_empty());
        assert_eq!(cs.default_reasoning_effort, None);

        // 6. Claude Opus 4.6 Thinking
        let co = &models[5];
        assert_eq!(co.id, "claude-opus-4-6-thinking");
        assert_eq!(co.display_name, "Claude Opus 4.6 (Thinking)");
        assert!(co.supported_reasoning_efforts.is_empty());
        assert_eq!(co.default_reasoning_effort, None);

        // 7. GPT-OSS 120B
        let gpt = &models[6];
        assert_eq!(gpt.id, "gpt-oss-120b");
        assert_eq!(gpt.display_name, "GPT-OSS 120B");
        assert_eq!(gpt.supported_reasoning_efforts, vec!["medium".to_string()]);
        assert_eq!(gpt.default_reasoning_effort, Some("medium".to_string()));
    }

    #[test]
    fn test_normalize_model_and_effort() {
        // Standard Gemini with effort
        let (m, e) = normalize_model_and_effort(Some("gemini-3.8-flash"), Some("low"));
        assert_eq!(m, Some("gemini-3.8-flash".to_string()));
        assert_eq!(e, Some("low".to_string()));

        // Legacy suffixed model with no effort provided -> extracts suffix as effort
        let (m, e) = normalize_model_and_effort(Some("gemini-3.8-flash-high"), None);
        assert_eq!(m, Some("gemini-3.8-flash".to_string()));
        assert_eq!(e, Some("high".to_string()));

        // Legacy suffixed model with explicit effort override
        let (m, e) = normalize_model_and_effort(Some("gemini-3.8-flash-high"), Some("medium"));
        assert_eq!(m, Some("gemini-3.8-flash".to_string()));
        assert_eq!(e, Some("medium".to_string()));

        // Claude models never accept --effort flag
        let (m, e) = normalize_model_and_effort(Some("claude-sonnet-4-6"), Some("high"));
        assert_eq!(m, Some("claude-sonnet-4-6".to_string()));
        assert_eq!(e, None);

        let (m, e) = normalize_model_and_effort(Some("claude-opus-4-6-thinking"), Some("low"));
        assert_eq!(m, Some("claude-opus-4-6-thinking".to_string()));
        assert_eq!(e, None);

        // GPT-OSS 120B is pinned to medium effort
        let (m, e) = normalize_model_and_effort(Some("gpt-oss-120b"), Some("high"));
        assert_eq!(m, Some("gpt-oss-120b".to_string()));
        assert_eq!(e, Some("medium".to_string()));

        // Empty / None
        let (m, e) = normalize_model_and_effort(None, None);
        assert_eq!(m, None);
        assert_eq!(e, None);
    }

    #[tokio::test]
    async fn test_agy_adapter_cached_models() {
        let (tx, _rx) = broadcast::channel(16);
        let adapter = AgyAdapter::new("non_existent_binary", tx);

        // Pre-fill cache
        let test_models = vec![ModelInfo {
            id: "test-model".to_string(),
            model: "test-model".to_string(),
            display_name: "Test Model".to_string(),
            description: None,
            is_default: true,
            supported_reasoning_efforts: vec!["high".to_string()],
            default_reasoning_effort: Some("high".to_string()),
        }];

        {
            let mut guard = adapter.cached_models.lock().await;
            *guard = Some((std::time::Instant::now(), test_models.clone()));
        }

        // list_models should return immediately from cache without calling binary
        let models = adapter
            .list_models()
            .await
            .expect("list_models should succeed");
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "test-model");
    }
}
