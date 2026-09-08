use anyhow::Result;
use std::sync::Arc;

use canywhere_protocol::models::*;
use canywhere_protocol::rpc::*;
use crate::adapters::CodexAdapter;
use crate::db::repositories::RepositoryManager;
use crate::security::PairingSecurityManager;

pub struct RpcDispatcher {
    repo: Arc<RepositoryManager>,
    adapter: Arc<CodexAdapter>,
    pairing: Arc<PairingSecurityManager>,
}

impl RpcDispatcher {
    pub fn new(
        repo: Arc<RepositoryManager>,
        adapter: Arc<CodexAdapter>,
        pairing: Arc<PairingSecurityManager>,
    ) -> Self {
        Self { repo, adapter, pairing }
    }

    pub async fn dispatch(&self, req: RpcRequestEnvelope) -> RpcResponseEnvelope {
        let id = req.id.clone();
        match self.handle_method(&req.method, req.params).await {
            Ok(result) => RpcResponseEnvelope {
                id,
                result: Some(result),
                error: None,
            },
            Err(e) => RpcResponseEnvelope {
                id,
                result: None,
                error: Some(RpcErrorData {
                    code: -32603,
                    message: e.to_string(),
                    data: None,
                }),
            },
        }
    }

    async fn handle_method(&self, method: &str, params: Option<serde_json::Value>) -> Result<serde_json::Value> {
        let p = params.unwrap_or(serde_json::Value::Null);

        match method {
            "workspace.list" => {
                let workspaces = self.repo.list_workspaces()?;
                Ok(serde_json::to_value(WorkspaceListResult { workspaces })?)
            }

            "workspace.create" => {
                let input: WorkspaceCreateInput = serde_json::from_value(p)?;
                let workspace = self.repo.create_workspace(input)?;
                Ok(serde_json::json!({ "workspace": workspace }))
            }

            "workspace.tree" => {
                let params: WorkspaceTreeParams = serde_json::from_value(p)?;
                let ws = self.repo.get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;

                let base_path = std::path::Path::new(&ws.root_path);
                let target_dir = if let Some(sub) = &params.sub_path {
                    base_path.join(sub)
                } else {
                    base_path.to_path_buf()
                };

                let max_depth = params.max_depth.unwrap_or(3);
                let root_node = build_file_tree(&target_dir, base_path, 0, max_depth)?;
                Ok(serde_json::to_value(WorkspaceTreeResult { root: root_node })?)
            }

            "workspace.readFile" => {
                let params: WorkspaceReadFileParams = serde_json::from_value(p)?;
                let ws = self.repo.get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;

                let base_path = std::path::Path::new(&ws.root_path);
                let file_path = base_path.join(&params.relative_path);

                // Security sandbox check: prevent directory traversal
                let canonical_base = base_path.canonicalize()?;
                let canonical_file = file_path.canonicalize()?;
                if !canonical_file.starts_with(&canonical_base) {
                    anyhow::bail!("Access denied: path is outside workspace root");
                }

                let content = std::fs::read_to_string(&canonical_file)?;
                let size = content.len();
                Ok(serde_json::to_value(WorkspaceReadFileResult {
                    path: params.relative_path,
                    content,
                    size,
                })?)
            }

            "workspace.pickFolder" => {
                let chosen_path = tokio::task::spawn_blocking(|| {
                    #[cfg(target_os = "macos")]
                    {
                        // Use AppleScript to prompt for folder on macOS
                        let script = r#"try
POSIX path of (choose folder with prompt "Select Project Folder for Canywhere")
on error
return ""
end try"#;
                        let output = std::process::Command::new("osascript")
                            .arg("-e")
                            .arg(script)
                            .output();

                        if let Ok(out) = output {
                            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
                            if !text.is_empty() {
                                // Remove trailing slash if present
                                let clean = text.strip_suffix('/').unwrap_or(&text).to_string();
                                return Some(clean);
                            }
                        }
                    }
                    None
                }).await?;

                Ok(serde_json::to_value(WorkspacePickFolderResult {
                    path: chosen_path,
                })?)
            }

            "chat.list" => {
                let ws_id = p["workspaceId"].as_str();
                let chats = self.repo.list_chats(ws_id)?;
                Ok(serde_json::to_value(ChatListResult { chats })?)
            }

            "chat.create" => {
                let input: ChatCreateInput = serde_json::from_value(p.clone())?;
                let mut cwd = ".".to_string();
                let mut sub_paths = None;

                if let Some(ws_id) = &input.workspace_id {
                    if let Some(ws) = self.repo.get_workspace(ws_id)? {
                        cwd = ws.root_path;
                        sub_paths = Some(ws.sub_paths);
                    }
                }

                let chat = self.repo.create_chat(input, None)?;

                // Initialize underlying thread in Codex
                if let Ok(thread_id) = self.adapter.start_thread(&chat.id, &cwd, sub_paths.as_deref()).await {
                    let _ = self.repo.update_chat_status(&chat.id, ChatStatus::Idle, Some(&thread_id));
                }

                Ok(serde_json::json!({ "chat": chat }))
            }

            "chat.get" => {
                let chat_id = p["chatId"].as_str().ok_or_else(|| anyhow::anyhow!("chatId required"))?;
                let chat = self.repo.get_chat(chat_id)?.ok_or_else(|| anyhow::anyhow!("Chat not found"))?;
                let messages = self.repo.get_chat_history(chat_id)?;
                let pending_approvals = Vec::new(); // Approvals handled in-flight
                Ok(serde_json::to_value(ChatGetResult {
                    chat,
                    messages,
                    pending_approvals,
                })?)
            }

            "turn.send" => {
                let params: TurnSendParams = serde_json::from_value(p)?;
                let chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };

                let thread_id = chat.external_thread_id.unwrap_or_default();
                let message_id = nanoid::nanoid!(16);

                // Save user message to persistent history
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;

                let user_msg = Message {
                    id: message_id.clone(),
                    chat_id: chat.id.clone(),
                    turn_id: None,
                    role: MessageRole::User,
                    blocks: vec![MessageBlock::Text { content: params.content.clone() }],
                    created_at: now,
                    streaming: false,
                };
                let _ = self.repo.record_message(&user_msg);

                let turn_id = self.adapter.submit_turn(
                    &chat.id,
                    &thread_id,
                    &message_id,
                    &params.content,
                    params.model.as_deref(),
                ).await?;

                let _ = self.repo.update_chat_status(&chat.id, ChatStatus::Running, None);

                Ok(serde_json::to_value(TurnSendResult {
                    turn_id,
                    status: ChatStatus::Running,
                })?)
            }

            "turn.steer" => {
                let params: TurnSteerParams = serde_json::from_value(p)?;
                let chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };
                let thread_id = chat.external_thread_id.unwrap_or_default();
                let message_id = nanoid::nanoid!(16);
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;

                let user_msg = Message {
                    id: message_id,
                    chat_id: chat.id.clone(),
                    turn_id: Some(params.turn_id.clone()),
                    role: MessageRole::User,
                    blocks: vec![MessageBlock::Text { content: format!("[Steer] {}", params.content) }],
                    created_at: now,
                    streaming: false,
                };
                let _ = self.repo.record_message(&user_msg);

                let steered_turn_id = self.adapter.steer_turn(&thread_id, &params.turn_id, &params.content).await?;
                Ok(serde_json::to_value(TurnSteerResult {
                    turn_id: steered_turn_id,
                    status: ChatStatus::Running,
                })?)
            }

            "turn.interrupt" => {
                let chat_id = p["chatId"].as_str().ok_or_else(|| anyhow::anyhow!("chatId required"))?;
                let turn_id = p["turnId"].as_str().ok_or_else(|| anyhow::anyhow!("turnId required"))?;
                let chat = self.repo.get_chat(chat_id)?.ok_or_else(|| anyhow::anyhow!("Chat not found"))?;
                let thread_id = chat.external_thread_id.unwrap_or_default();

                self.adapter.interrupt_turn(&thread_id, turn_id).await?;
                let _ = self.repo.update_chat_status(chat_id, ChatStatus::Idle, None);
                Ok(serde_json::json!({ "status": "interrupted" }))
            }

            "approval.respond" => {
                let approval_id = p["approvalId"].as_str().ok_or_else(|| anyhow::anyhow!("approvalId required"))?;
                let decision = p["decision"].as_str().unwrap_or("accept");
                // Notify adapter of approval decision
                let _ = self.adapter.respond_approval(approval_id, decision).await;
                Ok(serde_json::json!({ "status": "ok", "approvalId": approval_id, "decision": decision }))
            }

            "pairing.createSession" => {
                let qr_payload = self.pairing.create_pairing_session("Canywhere Rust Host")?;
                Ok(serde_json::json!({ "qrPayload": qr_payload }))
            }

            "device.list" => {
                let devices = self.repo.list_devices()?;
                Ok(serde_json::to_value(DeviceListResult { devices })?)
            }

            "model.list" => {
                let models = self.adapter.list_models().await?;
                Ok(serde_json::to_value(ModelListResult { models })?)
            }

            "provider.list" => {
                let providers = vec![Provider {
                    id: "codex".to_string(),
                    name: "OpenAI Codex".to_string(),
                    description: "Local Codex CLI via app-server --stdio".to_string(),
                    is_configured: true,
                    capabilities: AdapterCapabilities {
                        supports_reasoning_stream: true,
                        supports_file_diffs: true,
                        supports_steering: true,
                        supports_interrupt: true,
                        supports_session_resumption: true,
                    },
                }];
                Ok(serde_json::to_value(ProviderListResult { providers })?)
            }

            _ => anyhow::bail!("Method not found: {}", method),
        }
    }
}

fn build_file_tree(
    current_path: &std::path::Path,
    base_root: &std::path::Path,
    current_depth: u32,
    max_depth: u32,
) -> Result<FileTreeNode> {
    let name = current_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    let relative_path = current_path
        .strip_prefix(base_root)
        .unwrap_or(current_path)
        .to_string_lossy()
        .to_string();

    let is_dir = current_path.is_dir();

    let mut children = None;
    let mut size = None;

    if is_dir {
        if current_depth < max_depth {
            let mut node_children = Vec::new();
            if let Ok(entries) = std::fs::read_dir(current_path) {
                let mut sorted_entries: Vec<_> = entries.flatten().collect();
                sorted_entries.sort_by_key(|e| {
                    let is_file = e.file_type().map(|ft| ft.is_file()).unwrap_or(false);
                    (is_file, e.file_name())
                });

                for entry in sorted_entries {
                    let entry_name = entry.file_name().to_string_lossy().to_string();
                    // Skip hidden git/node_modules/target to prevent huge trees
                    if entry_name.starts_with('.') || entry_name == "node_modules" || entry_name == "target" || entry_name == "dist" {
                        continue;
                    }

                    if let Ok(child_node) = build_file_tree(&entry.path(), base_root, current_depth + 1, max_depth) {
                        node_children.push(child_node);
                    }
                }
            }
            children = Some(node_children);
        } else {
            children = Some(Vec::new());
        }
    } else if let Ok(meta) = std::fs::metadata(current_path) {
        size = Some(meta.len() as i64);
    }

    Ok(FileTreeNode {
        name,
        path: relative_path,
        is_directory: is_dir,
        size,
        children,
    })
}
