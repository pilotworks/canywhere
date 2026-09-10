use anyhow::Result;
use std::sync::Arc;

use crate::adapters::{AgentEvent, ProviderRegistry};
use crate::db::repositories::RepositoryManager;
use crate::security::PairingSecurityManager;
use canywhere_protocol::models::*;
use canywhere_protocol::rpc::*;

pub struct RpcDispatcher {
    repo: Arc<RepositoryManager>,
    registry: Arc<ProviderRegistry>,
    pairing: Arc<PairingSecurityManager>,
}

impl RpcDispatcher {
    pub fn new(
        repo: Arc<RepositoryManager>,
        registry: Arc<ProviderRegistry>,
        pairing: Arc<PairingSecurityManager>,
    ) -> Self {
        Self {
            repo,
            registry,
            pairing,
        }
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

    async fn handle_method(
        &self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value> {
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

            "workspace.update" => {
                let params: WorkspaceUpdateParams = serde_json::from_value(p)?;
                let updated = self.repo.update_workspace(
                    &params.workspace_id,
                    params.name,
                    params.root_path,
                    params.sub_paths,
                )?;
                let ws = updated.ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let _ = self.registry.event_tx().send(AgentEvent::WorkspaceUpdated {
                    workspace: ws.clone(),
                });
                Ok(serde_json::to_value(WorkspaceUpdateResult {
                    workspace: ws,
                })?)
            }

            "workspace.delete" => {
                let params: WorkspaceDeleteParams = serde_json::from_value(p)?;
                let deleted = self.repo.delete_workspace(&params.workspace_id)?;
                if deleted {
                    let _ = self.registry.event_tx().send(AgentEvent::WorkspaceDeleted {
                        workspace_id: params.workspace_id,
                    });
                }
                Ok(serde_json::to_value(WorkspaceDeleteResult {
                    success: deleted,
                })?)
            }

            "workspace.tree" => {
                let params: WorkspaceTreeParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;

                let base_path = std::path::Path::new(&ws.root_path);
                let target_dir = if let Some(sub) = &params.sub_path {
                    base_path.join(sub)
                } else {
                    base_path.to_path_buf()
                };

                let max_depth = params.max_depth.unwrap_or(3);
                let root_node = build_file_tree(&target_dir, base_path, 0, max_depth)?;
                Ok(serde_json::to_value(WorkspaceTreeResult {
                    root: root_node,
                })?)
            }

            "workspace.readFile" => {
                let params: WorkspaceReadFileParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
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

            "workspace.searchFiles" => {
                let params: WorkspaceFileSearchParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;

                let mut roots = vec![ws.root_path.clone()];
                if !ws.sub_paths.is_empty() {
                    roots.extend(ws.sub_paths);
                }
                let files = self
                    .registry
                    .fuzzy_file_search(roots, &params.query, params.cancellation_token)
                    .await?;
                Ok(serde_json::to_value(WorkspaceFileSearchResult { files })?)
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
                })
                .await?;

                Ok(serde_json::to_value(WorkspacePickFolderResult {
                    path: chosen_path,
                })?)
            }

            "git.status" => {
                let params: GitStatusParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.diff" => {
                let params: GitDiffParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let diff = crate::git::GitService::diff(root, params.path.as_deref(), params.staged).await?;
                Ok(serde_json::to_value(GitDiffResult { diff })?)
            }

            "git.stage" => {
                let params: GitStageParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                crate::git::GitService::stage(root, &params.paths).await?;
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.unstage" => {
                let params: GitUnstageParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                crate::git::GitService::unstage(root, &params.paths).await?;
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.discard" => {
                let params: GitDiscardParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                crate::git::GitService::discard(root, &params.paths).await?;
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.commit" => {
                let params: GitCommitParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let hash = crate::git::GitService::commit(root, &params.message).await?;
                Ok(serde_json::to_value(GitCommitResult { hash })?)
            }

            "git.branches" => {
                let params: GitBranchesParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let branches = crate::git::GitService::branches(root).await?;
                Ok(serde_json::to_value(branches)?)
            }

            "git.checkout" => {
                let params: GitCheckoutParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                crate::git::GitService::checkout(root, &params.branch, params.create_new).await?;
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.log" => {
                let params: GitLogParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let commits = crate::git::GitService::log(root, params.max_count.unwrap_or(15)).await?;
                Ok(serde_json::to_value(GitLogResult { commits })?)
            }

            "git.init" => {
                let params: GitInitParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                crate::git::GitService::init(root).await?;
                let status = crate::git::GitService::status(root).await?;
                Ok(serde_json::to_value(status)?)
            }

            "git.generateCommitMessage" => {
                let params: GitGenerateCommitMessageParams = serde_json::from_value(p)?;
                let ws = self
                    .repo
                    .get_workspace(&params.workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("Workspace not found"))?;
                let root = std::path::Path::new(&ws.root_path);
                let codex_bin = crate::adapters::codex::CodexAdapter::resolve_binary();
                let message = crate::git::GitService::generate_commit_message(root, &codex_bin).await?;
                Ok(serde_json::to_value(GitGenerateCommitMessageResult { message })?)
            }

            "chat.list" => {
                let ws_id = p["workspaceId"].as_str();
                let chats = self.repo.list_chats(ws_id)?;
                Ok(serde_json::to_value(ChatListResult { chats })?)
            }

            "chat.create" => {
                let mut input: ChatCreateInput = serde_json::from_value(p.clone())?;
                if input.provider_id.trim().is_empty() {
                    input.provider_id = "codex".to_string();
                }
                if input.workspace_id.is_some() {
                    input.kind = ChatKind::Workspace;
                }

                if input.permission_mode.is_none() {
                    if let Ok(ad) = self.registry.resolve(Some(&input.provider_id)) {
                        if !ad.capabilities().supports_approvals {
                            input.permission_mode = Some(PermissionMode::Auto);
                        }
                    }
                }

                let mut cwd = String::new();
                let mut sub_paths = None;

                if let Some(ws_id) = &input.workspace_id {
                    if let Some(ws) = self.repo.get_workspace(ws_id)? {
                        cwd = ws.root_path;
                        sub_paths = Some(ws.sub_paths);
                    }
                }

                let mut chat = self.repo.create_chat(input, None)?;

                if cwd.is_empty() {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                    let scratch_dir = std::path::PathBuf::from(home)
                        .join(".canywhere")
                        .join("scratch")
                        .join(&chat.provider_id)
                        .join(&chat.id);
                    let _ = std::fs::create_dir_all(&scratch_dir);
                    cwd = scratch_dir.to_string_lossy().to_string();
                }

                // Initialize underlying thread in target adapter
                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                match adapter
                    .start_thread(&chat.id, &cwd, sub_paths.as_deref())
                    .await
                {
                    Ok(thread_id) => {
                        let _ = self.repo.update_chat_status(
                            &chat.id,
                            ChatStatus::Idle,
                            Some(&thread_id),
                        );
                        chat.external_thread_id = Some(thread_id);
                    }
                    Err(e) => {
                        tracing::warn!(
                            "[RpcDispatcher] Failed to initialize {} thread on chat.create: {}",
                            chat.provider_id,
                            e
                        );
                    }
                }

                let _ = self.registry.event_tx().send(AgentEvent::ChatCreated {
                    chat: chat.clone(),
                });

                Ok(serde_json::json!({ "chat": chat }))
            }

            "chat.get" => {
                let chat_id = p["chatId"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("chatId required"))?;
                let mut chat = self
                    .repo
                    .get_chat(chat_id)?
                    .ok_or_else(|| anyhow::anyhow!("Chat not found"))?;

                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let streaming_msg = adapter.get_active_streaming_message(chat_id).await;
                if streaming_msg.is_some() {
                    if chat.status != ChatStatus::AwaitingApproval {
                        chat.status = ChatStatus::Running;
                    }
                } else if chat.status == ChatStatus::Running {
                    let has_active_turn = adapter.get_active_turn(chat_id).await.is_some();
                    if !has_active_turn {
                        let _ = self.repo.update_chat_status(chat_id, ChatStatus::Idle, None);
                        chat.status = ChatStatus::Idle;
                    }
                }

                let mut messages = self.repo.get_chat_history(chat_id)?;
                if let Some(s_msg) = streaming_msg {
                    messages.push(s_msg);
                }
                let pending_approvals = adapter.get_pending_approvals(chat_id).await;
                let queued_messages = self.repo.list_queued_messages(chat_id)?;
                Ok(serde_json::to_value(ChatGetResult {
                    chat,
                    messages,
                    pending_approvals,
                    queued_messages,
                })?)
            }

            "chat.delete" => {
                let params: ChatDeleteParams = serde_json::from_value(p)?;
                let success = self.repo.delete_chat(&params.chat_id)?;
                if success {
                    let _ = self.registry.event_tx().send(AgentEvent::ChatDeleted {
                        chat_id: params.chat_id,
                    });
                }
                Ok(serde_json::to_value(ChatDeleteResult { success })?)
            }

            "chat.setPermission" => {
                let params: ChatSetPermissionParams = serde_json::from_value(p)?;
                self.repo
                    .update_chat_permission_mode(&params.chat_id, params.permission_mode)?;
                let _ = self.registry.event_tx().send(AgentEvent::ChatPermissionUpdated {
                    chat_id: params.chat_id.clone(),
                    permission_mode: params.permission_mode,
                });
                Ok(serde_json::to_value(ChatSetPermissionResult {
                    success: true,
                    permission_mode: params.permission_mode,
                })?)
            }

            "chat.review" => {
                let params: ChatReviewParams = serde_json::from_value(p)?;
                let mut chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };

                let mut cwd = String::new();
                let mut sub_paths = None;
                if let Some(ws_id) = &chat.workspace_id {
                    if let Some(ws) = self.repo.get_workspace(ws_id)? {
                        cwd = ws.root_path;
                        sub_paths = Some(ws.sub_paths);
                    }
                }
                if cwd.is_empty() {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                    let scratch_dir = std::path::PathBuf::from(home)
                        .join(".canywhere")
                        .join("scratch")
                        .join(&chat.provider_id)
                        .join(&chat.id);
                    let _ = std::fs::create_dir_all(&scratch_dir);
                    cwd = scratch_dir.to_string_lossy().to_string();
                }

                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let thread_id = adapter
                    .resume_or_start_thread(
                        &chat.id,
                        chat.external_thread_id.as_deref(),
                        &cwd,
                        sub_paths.as_deref(),
                    )
                    .await?;

                let _ = self
                    .repo
                    .update_chat_status(&chat.id, ChatStatus::Running, Some(&thread_id));
                chat.external_thread_id = Some(thread_id.clone());

                let turn_id = adapter.start_review(&chat.id, &thread_id).await?;
                Ok(serde_json::json!({
                    "turnId": turn_id,
                    "status": "running"
                }))
            }

            "chat.compact" => {
                let params: ChatCompactParams = serde_json::from_value(p)?;
                let chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };

                if let Some(thread_id) = chat.external_thread_id.as_deref() {
                    let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                    adapter.compact_thread(thread_id).await?;
                    Ok(serde_json::json!({ "success": true }))
                } else {
                    anyhow::bail!("No active thread for chat to compact");
                }
            }

            "chat.executeCommand" => {
                let params: ChatExecuteCommandParams = serde_json::from_value(p)?;
                let mut chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };

                let mut cwd = String::new();
                let mut sub_paths = None;
                if let Some(ws_id) = &chat.workspace_id {
                    if let Some(ws) = self.repo.get_workspace(ws_id)? {
                        cwd = ws.root_path;
                        sub_paths = Some(ws.sub_paths);
                    }
                }
                if cwd.is_empty() {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                    let scratch_dir = std::path::PathBuf::from(home)
                        .join(".canywhere")
                        .join("scratch")
                        .join(&chat.provider_id)
                        .join(&chat.id);
                    let _ = std::fs::create_dir_all(&scratch_dir);
                    cwd = scratch_dir.to_string_lossy().to_string();
                }

                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let thread_id = adapter
                    .resume_or_start_thread(
                        &chat.id,
                        chat.external_thread_id.as_deref(),
                        &cwd,
                        sub_paths.as_deref(),
                    )
                    .await?;

                let _ = self
                    .repo
                    .update_chat_status(&chat.id, ChatStatus::Running, Some(&thread_id));
                chat.external_thread_id = Some(thread_id.clone());

                let result = adapter
                    .execute_command(
                        &chat.id,
                        &thread_id,
                        &params.command,
                        params.args.as_deref(),
                    )
                    .await?;

                Ok(serde_json::to_value(result)?)
            }

            "turn.send" => {
                let params: TurnSendParams = serde_json::from_value(p)?;
                let mut chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };

                let mut cwd = String::new();
                let mut sub_paths = None;
                if let Some(ws_id) = &chat.workspace_id {
                    if let Some(ws) = self.repo.get_workspace(ws_id)? {
                        cwd = ws.root_path;
                        sub_paths = Some(ws.sub_paths);
                    }
                }
                if cwd.is_empty() {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                    let scratch_dir = std::path::PathBuf::from(home)
                        .join(".canywhere")
                        .join("scratch")
                        .join(&chat.provider_id)
                        .join(&chat.id);
                    let _ = std::fs::create_dir_all(&scratch_dir);
                    cwd = scratch_dir.to_string_lossy().to_string();
                }

                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let thread_id = adapter
                    .resume_or_start_thread(
                        &chat.id,
                        chat.external_thread_id.as_deref(),
                        &cwd,
                        sub_paths.as_deref(),
                    )
                    .await?;

                let _ = self
                    .repo
                    .update_chat_status(&chat.id, ChatStatus::Running, Some(&thread_id));
                chat.external_thread_id = Some(thread_id.clone());

                let user_msg_id = params
                    .client_message_id
                    .unwrap_or_else(|| nanoid::nanoid!(16));
                let agent_msg_id = nanoid::nanoid!(16);

                // Save user message to persistent history
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;

                let user_msg = Message {
                    id: user_msg_id.clone(),
                    chat_id: chat.id.clone(),
                    turn_id: None,
                    role: MessageRole::User,
                    blocks: vec![MessageBlock::Text {
                        content: params.content.clone(),
                    }],
                    created_at: now,
                    streaming: false,
                };
                if let Err(e) = self.repo.record_message(&user_msg) {
                    tracing::error!("[RpcDispatcher] Failed to record user message: {}", e);
                }
                let _ = self.registry.event_tx().send(AgentEvent::MessageCreated {
                    message: user_msg.clone(),
                });

                // Broadcast agent placeholder so all clients know the streaming agent message ID
                let agent_placeholder = Message {
                    id: agent_msg_id.clone(),
                    chat_id: chat.id.clone(),
                    turn_id: None,
                    role: MessageRole::Agent,
                    blocks: vec![],
                    created_at: now + 1,
                    streaming: true,
                };
                let _ = self.registry.event_tx().send(AgentEvent::MessageCreated {
                    message: agent_placeholder,
                });

                tracing::info!(
                    "[RpcDispatcher] Submitting turn for chat={}, thread={}, model={:?}",
                    chat.id,
                    thread_id,
                    params.model
                );

                if let Some(m) = &params.model {
                    let prev = self.repo.get_setting("current_model")?.unwrap_or_default();
                    if prev != *m {
                        let _ = self.repo.set_setting("current_model", m);
                        if let Some(eff) = &params.reasoning_effort {
                            let _ = self.repo.set_setting("current_reasoning_effort", eff);
                        }
                        let _ = self.registry.event_tx().send(AgentEvent::ModelUpdated {
                            model: m.clone(),
                            reasoning_effort: params.reasoning_effort.clone(),
                        });
                    }
                }

                let resolved_perm_mode = params.permission_mode.unwrap_or(chat.permission_mode);
                if params.permission_mode.is_some() && params.permission_mode != Some(chat.permission_mode) {
                    let _ = self.repo.update_chat_permission_mode(&chat.id, resolved_perm_mode);
                    chat.permission_mode = resolved_perm_mode;
                    let _ = self.registry.event_tx().send(AgentEvent::ChatPermissionUpdated {
                        chat_id: chat.id.clone(),
                        permission_mode: resolved_perm_mode,
                    });
                }

                let turn_id = adapter
                    .submit_turn(
                        &chat.id,
                        &thread_id,
                        &agent_msg_id,
                        &params.content,
                        params.model.as_deref(),
                        params.reasoning_effort.as_deref(),
                        Some(resolved_perm_mode),
                        Some(&cwd),
                    )
                    .await?;

                tracing::info!(
                    "[RpcDispatcher] Turn submitted: chat={}, turn_id={}",
                    chat.id,
                    turn_id
                );

                // Auto-generate title from first prompt if still default
                if chat.title == "New Chat" || chat.title.trim().is_empty() {
                    let clean_prompt = params.content.lines().next().unwrap_or("New Chat").trim();
                    let new_title = if clean_prompt.chars().count() > 36 {
                        format!("{}...", clean_prompt.chars().take(33).collect::<String>())
                    } else {
                        clean_prompt.to_string()
                    };
                    if !new_title.is_empty() {
                        let _ = self.repo.update_chat_title(&chat.id, &new_title);
                        let _ = self.registry.event_tx().send(AgentEvent::ChatTitleUpdated {
                            chat_id: chat.id.clone(),
                            title: new_title,
                        });
                    }
                }

                let _ = self
                    .repo
                    .update_chat_status(&chat.id, ChatStatus::Running, None);

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
                    blocks: vec![MessageBlock::Text {
                        content: params.content.clone(),
                    }],
                    created_at: now,
                    streaming: false,
                };
                let _ = self.repo.record_message(&user_msg);
                let _ = self.registry.event_tx().send(AgentEvent::MessageCreated {
                    message: user_msg.clone(),
                });

                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let steered_turn_id = adapter
                    .steer_turn(&thread_id, &params.turn_id, &params.content)
                    .await?;
                Ok(serde_json::to_value(TurnSteerResult {
                    turn_id: steered_turn_id,
                    status: ChatStatus::Running,
                })?)
            }

            "turn.interrupt" => {
                let chat_id = p["chatId"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("chatId required"))?;
                let mut turn_id = p.get("turnId")
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .to_string();

                let chat = self
                    .repo
                    .get_chat(chat_id)?
                    .ok_or_else(|| anyhow::anyhow!("Chat not found"))?;
                let thread_id = chat.external_thread_id.unwrap_or_default();
                let adapter = self.registry.resolve(Some(&chat.provider_id))?;

                if turn_id.is_empty() {
                    if let Some(t_id) = adapter.get_active_turn(chat_id).await {
                        turn_id = t_id;
                    }
                }

                if !thread_id.is_empty() && !turn_id.is_empty() {
                    let _ = adapter.interrupt_turn(&thread_id, &turn_id).await;
                }

                adapter.clear_active_turn(chat_id).await;

                let _ = self
                    .repo
                    .update_chat_status(chat_id, ChatStatus::Idle, None);

                let _ = self.registry.event_tx().send(AgentEvent::TurnCompleted {
                    chat_id: chat_id.to_string(),
                    message_id: String::new(),
                    turn_id,
                    status: ChatStatus::Idle,
                    blocks: Vec::new(),
                    text_content: None,
                    reasoning_content: None,
                });

                Ok(serde_json::json!({ "status": "interrupted" }))
            }

            "queue.list" => {
                let params: QueueListParams = serde_json::from_value(p)?;
                let items = self.repo.list_queued_messages(&params.chat_id)?;
                Ok(serde_json::to_value(QueueListResult { items })?)
            }

            "queue.add" => {
                let params: QueueAddParams = serde_json::from_value(p)?;
                let item = self.repo.add_queued_message(
                    &params.chat_id,
                    &params.content,
                    params.model.as_deref(),
                    params.reasoning_effort.as_deref(),
                    params.permission_mode,
                )?;
                let items = self.repo.list_queued_messages(&params.chat_id)?;
                let _ = self.registry.event_tx().send(AgentEvent::QueueUpdated {
                    chat_id: params.chat_id,
                    items,
                });
                Ok(serde_json::to_value(item)?)
            }

            "queue.remove" => {
                let params: QueueRemoveParams = serde_json::from_value(p)?;
                let success = self.repo.remove_queued_message(&params.queue_id)?;
                let items = self.repo.list_queued_messages(&params.chat_id)?;
                let _ = self.registry.event_tx().send(AgentEvent::QueueUpdated {
                    chat_id: params.chat_id,
                    items,
                });
                Ok(serde_json::json!({ "success": success }))
            }

            "queue.update" => {
                let params: QueueUpdateParams = serde_json::from_value(p)?;
                let success = self.repo.update_queued_message(&params.queue_id, &params.content)?;
                let items = self.repo.list_queued_messages(&params.chat_id)?;
                let _ = self.registry.event_tx().send(AgentEvent::QueueUpdated {
                    chat_id: params.chat_id,
                    items,
                });
                Ok(serde_json::json!({ "success": success }))
            }

            "queue.steer" => {
                let params: QueueSteerParams = serde_json::from_value(p)?;
                let item = self.repo.get_queued_message(&params.queue_id)?
                    .ok_or_else(|| anyhow::anyhow!("Queued message not found"))?;
                self.repo.remove_queued_message(&params.queue_id)?;
                let items = self.repo.list_queued_messages(&params.chat_id)?;
                let _ = self.registry.event_tx().send(AgentEvent::QueueUpdated {
                    chat_id: params.chat_id.clone(),
                    items,
                });

                let chat = match self.repo.get_chat(&params.chat_id)? {
                    Some(c) => c,
                    None => anyhow::bail!("Chat not found"),
                };
                let thread_id = chat.external_thread_id.unwrap_or_default();
                let adapter = self.registry.resolve(Some(&chat.provider_id))?;
                let active_turn = adapter.get_active_turn(&params.chat_id).await;

                if let Some(turn_id) = active_turn {
                    let message_id = nanoid::nanoid!(16);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as i64;

                    let user_msg = Message {
                        id: message_id,
                        chat_id: chat.id.clone(),
                        turn_id: Some(turn_id.clone()),
                        role: MessageRole::User,
                        blocks: vec![MessageBlock::Text {
                            content: item.content.clone(),
                        }],
                        created_at: now,
                        streaming: false,
                    };
                    let _ = self.repo.record_message(&user_msg);
                    let _ = self.registry.event_tx().send(AgentEvent::MessageCreated {
                        message: user_msg.clone(),
                    });

                    let steered_turn_id = adapter
                        .steer_turn(&thread_id, &turn_id, &item.content)
                        .await?;
                    Ok(serde_json::json!({
                        "success": true,
                        "turnId": steered_turn_id,
                        "status": ChatStatus::Running,
                    }))
                } else {
                    anyhow::bail!("No active turn to steer");
                }
            }

            "approval.list" => {
                let approvals = self.registry.get_all_pending_approvals().await;
                Ok(serde_json::to_value(ApprovalListResult { approvals })?)
            }

            "approval.respond" => {
                let approval_id = p["approvalId"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("approvalId required"))?;
                let decision = p["decision"].as_str().unwrap_or("accept");
                // Notify adapter of approval decision
                let _ = self.registry.respond_approval(approval_id, decision).await;
                Ok(
                    serde_json::json!({ "status": "ok", "approvalId": approval_id, "decision": decision }),
                )
            }

            "pairing.createSession" => {
                let qr_payload = self.pairing.create_pairing_session("Canywhere Rust Host")?;
                Ok(serde_json::json!({ "qrPayload": qr_payload }))
            }

            "pairing.exchange" => {
                let token = p
                    .get("token")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing token parameter"))?;
                let client_pubkey = p
                    .get("clientPublicKey")
                    .or_else(|| p.get("client_public_key"))
                    .or_else(|| p.get("publicKey"))
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing clientPublicKey parameter"))?;
                let signature = p
                    .get("signature")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing signature parameter"))?;
                let device_name = p
                    .get("deviceName")
                    .or_else(|| p.get("device_name"))
                    .or_else(|| p.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("iOS Client");
                let platform_str = p
                    .get("platform")
                    .and_then(|v| v.as_str())
                    .unwrap_or("ios");
                let platform = match platform_str.to_lowercase().as_str() {
                    "desktop" => DevicePlatform::Desktop,
                    _ => DevicePlatform::Ios,
                };

                let device = self.pairing.verify_and_register(
                    token,
                    client_pubkey,
                    signature,
                    device_name,
                    platform,
                )?;

                Ok(serde_json::json!({
                    "status": "paired",
                    "device": device,
                    "hostPublicKey": self.pairing.host_public_key(),
                }))
            }

            "device.list" => {
                let devices = self.repo.list_devices()?;
                Ok(serde_json::to_value(DeviceListResult { devices })?)
            }

            "device.revoke" => {
                let device_id = p
                    .get("deviceId")
                    .or_else(|| p.get("id"))
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow::anyhow!("Missing deviceId parameter"))?;

                let success = self.repo.revoke_device(device_id)?;
                Ok(serde_json::json!({
                    "status": "ok",
                    "deviceId": device_id,
                    "revoked": success,
                }))
            }

            "model.list" => {
                let provider_id = p.get("providerId").and_then(|v| v.as_str());
                let adapter = self.registry.resolve(provider_id)?;
                let models = adapter.list_models().await?;
                let provider_key = adapter.id();

                let saved_model = self.repo.get_setting(&format!("{}_current_model", provider_key))?
                    .or_else(|| self.repo.get_setting("current_model").ok().flatten());
                let current_model = saved_model
                    .filter(|sm| models.iter().any(|m| &m.model == sm || &m.id == sm))
                    .or_else(|| models.iter().find(|m| m.is_default).map(|m| m.model.clone()))
                    .or_else(|| models.first().map(|m| m.model.clone()));

                let saved_effort = self.repo.get_setting(&format!("{}_current_reasoning_effort", provider_key))?
                    .or_else(|| self.repo.get_setting("current_reasoning_effort").ok().flatten());
                let current_reasoning_effort = saved_effort
                    .or_else(|| {
                        current_model.as_ref().and_then(|cm| {
                            models.iter().find(|m| &m.model == cm || &m.id == cm)
                                .and_then(|m| m.default_reasoning_effort.clone())
                        })
                    });

                Ok(serde_json::to_value(ModelListResult {
                    models,
                    current_model,
                    current_reasoning_effort,
                })?)
            }

            "model.get" => {
                let model = self.repo.get_setting("current_model")?.unwrap_or_else(|| "gpt-5-codex".to_string());
                let reasoning_effort = self.repo.get_setting("current_reasoning_effort")?.or_else(|| Some("medium".to_string()));
                Ok(serde_json::to_value(ModelGetResult {
                    model,
                    reasoning_effort,
                })?)
            }

            "model.set" => {
                let provider_id = p.get("providerId").and_then(|v| v.as_str()).map(|s| s.to_string());
                let params: ModelSetParams = serde_json::from_value(p)?;
                if let Ok(adapter) = self.registry.resolve(provider_id.as_deref()) {
                    let provider_key = adapter.id();
                    self.repo.set_setting(&format!("{}_current_model", provider_key), &params.model)?;
                    if let Some(effort) = &params.reasoning_effort {
                        self.repo.set_setting(&format!("{}_current_reasoning_effort", provider_key), effort)?;
                    }
                }
                self.repo.set_setting("current_model", &params.model)?;
                if let Some(effort) = &params.reasoning_effort {
                    self.repo.set_setting("current_reasoning_effort", effort)?;
                }
                let effort = self.repo.get_setting("current_reasoning_effort")?;
                let _ = self.registry.event_tx().send(AgentEvent::ModelUpdated {
                    model: params.model.clone(),
                    reasoning_effort: effort.clone(),
                });
                Ok(serde_json::json!({
                    "success": true,
                    "model": params.model,
                    "reasoningEffort": effort,
                }))
            }

            "provider.list" => {
                let providers = self.registry.list_providers();
                Ok(serde_json::to_value(ProviderListResult { providers })?)
            }

            "host.info" => {
                let host_name = std::process::Command::new("hostname")
                    .output()
                    .ok()
                    .and_then(|o| String::from_utf8(o.stdout).ok())
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "Canywhere Host".to_string());
                let os = format!("{} ({})", std::env::consts::OS, std::env::consts::ARCH);
                let active_turns = self.registry.get_active_turns_count().await;
                let default_adapter = self.registry.default_adapter().ok();
                let agent_ver = default_adapter.as_ref().map(|a| format!("{} CLI", a.name()));
                Ok(serde_json::to_value(HostInfoResult {
                    host_name,
                    os,
                    agent_version: agent_ver.clone(),
                    codex_version: agent_ver,
                    active_turns_count: active_turns as u32,
                    uptime_seconds: 0,
                })?)
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
                    if entry_name.starts_with('.')
                        || entry_name == "node_modules"
                        || entry_name == "target"
                        || entry_name == "dist"
                    {
                        continue;
                    }

                    if let Ok(child_node) =
                        build_file_tree(&entry.path(), base_root, current_depth + 1, max_depth)
                    {
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
