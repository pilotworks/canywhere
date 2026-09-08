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

                let turn_id = self.adapter.submit_turn(&chat.id, &thread_id, &message_id, &params.content).await?;

                let _ = self.repo.update_chat_status(&chat.id, ChatStatus::Running, None);

                Ok(serde_json::to_value(TurnSendResult {
                    turn_id,
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
                // Notify adapter of approval decision if needed
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

            _ => anyhow::bail!("Method not found: {}", method),
        }
    }
}
