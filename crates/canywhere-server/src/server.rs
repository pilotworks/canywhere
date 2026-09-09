use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

use crate::adapters::{AgentEvent, CodexAdapter};
use crate::db::repositories::RepositoryManager;
use crate::rpc::dispatcher::RpcDispatcher;
use crate::security::PairingSecurityManager;
use canywhere_protocol::rpc::*;

#[derive(Clone)]
pub struct AppState {
    pub dispatcher: Arc<RpcDispatcher>,
    pub event_tx: broadcast::Sender<AgentEvent>,
    pub host_public_key: String,
}

pub async fn run_server(
    port: u16,
    repo: Arc<RepositoryManager>,
    adapter: Arc<CodexAdapter>,
    pairing: Arc<PairingSecurityManager>,
    event_tx: broadcast::Sender<AgentEvent>,
) -> anyhow::Result<()> {
    let dispatcher = Arc::new(RpcDispatcher::new(
        Arc::clone(&repo),
        adapter,
        Arc::clone(&pairing),
    ));
    let host_public_key = pairing.host_public_key().to_string();

    // Spawn background task to persist agent messages and chat status on turn completion
    let repo_persist = Arc::clone(&repo);
    let mut persist_rx = event_tx.subscribe();
    tokio::spawn(async move {
        while let Ok(event) = persist_rx.recv().await {
            match event {
                AgentEvent::TurnCompleted {
                    chat_id,
                    message_id,
                    turn_id,
                    status,
                    blocks,
                    ..
                } => {
                    let _ = repo_persist.update_chat_status(&chat_id, status, None);
                    if !blocks.is_empty() {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                        let msg_id = if message_id.is_empty() {
                            nanoid::nanoid!(16)
                        } else {
                            message_id
                        };
                        let agent_msg = canywhere_protocol::models::Message {
                            id: msg_id,
                            chat_id: chat_id.clone(),
                            turn_id: Some(turn_id),
                            role: canywhere_protocol::models::MessageRole::Agent,
                            blocks,
                            created_at: now,
                            streaming: false,
                        };
                        if let Err(e) = repo_persist.record_message(&agent_msg) {
                            tracing::error!(
                                "[HostServer] Failed to record completed agent message: {}",
                                e
                            );
                        }
                    }
                }
                AgentEvent::ChatTitleUpdated { chat_id, title } => {
                    let _ = repo_persist.update_chat_title(&chat_id, &title);
                }
                _ => {}
            }
        }
    });

    let state = AppState {
        dispatcher,
        event_tx,
        host_public_key,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/rpc", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    info!("[HostServer] Listening on http://{} (LAN & Tailscale accessible)", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0",
        "hostPublicKey": state.host_public_key
    }))
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    info!("🔌 [HostServer] WebSocket client connected");
    let (mut ws_sink, mut ws_stream) = socket.split();
    let (tx_outgoing, mut rx_outgoing) = mpsc::channel::<Message>(100);

    // Outgoing sender pump to WebSocket sink
    let outgoing_pump = tokio::spawn(async move {
        while let Some(msg) = rx_outgoing.recv().await {
            if ws_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Event broadcast subscriber pump
    let mut event_rx = state.event_tx.subscribe();
    let tx_broadcast = tx_outgoing.clone();
    let broadcast_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            let notification = match event {
                AgentEvent::MessageCreated { message } => {
                    info!("💬 [HostServer] Message created: {} in chat {}", message.id, message.chat_id);
                    serde_json::json!({
                        "method": "message.created",
                        "params": {
                            "chatId": message.chat_id,
                            "message": message
                        }
                    })
                }
                AgentEvent::TokenDelta {
                    chat_id,
                    message_id,
                    delta,
                } => {
                    serde_json::json!({
                        "method": "message.delta",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "delta": { "type": "text", "text": delta }
                        }
                    })
                }
                AgentEvent::ReasoningDelta {
                    chat_id,
                    message_id,
                    delta,
                } => {
                    serde_json::json!({
                        "method": "message.delta",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "delta": { "type": "reasoning", "text": delta }
                        }
                    })
                }
                AgentEvent::BlockStarted {
                    chat_id,
                    message_id,
                    block_id,
                    block,
                } => {
                    info!("🛠️  [HostServer] Tool block started for chat {}", chat_id);
                    let mut block_payload = serde_json::to_value(&block).unwrap_or_default();
                    if let Some(obj) = block_payload.as_object_mut() {
                        if !block_id.is_empty() {
                            obj.insert("id".to_string(), serde_json::Value::String(block_id.clone()));
                        }
                    }
                    serde_json::json!({
                        "method": "tool.started",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "block": block_payload
                        }
                    })
                }
                AgentEvent::BlockCompleted {
                    chat_id,
                    message_id,
                    block_id,
                    block,
                } => {
                    info!("✅ [HostServer] Tool block completed: {}", block_id);
                    let mut block_payload = match block {
                        Some(b) => serde_json::to_value(b)
                            .unwrap_or_else(|_| serde_json::json!({ "id": block_id })),
                        None => serde_json::json!({ "id": block_id }),
                    };
                    if let Some(obj) = block_payload.as_object_mut() {
                        if !block_id.is_empty() {
                            if !obj.contains_key("id") {
                                obj.insert("id".to_string(), serde_json::Value::String(block_id.clone()));
                            }
                            if !obj.contains_key("callId") {
                                obj.insert("callId".to_string(), serde_json::Value::String(block_id.clone()));
                            }
                        }
                    }
                    serde_json::json!({
                        "method": "tool.completed",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "block": block_payload
                        }
                    })
                }
                AgentEvent::ApprovalRequested { chat_id, request } => {
                    warn!(
                        "⚠️  [HostServer] Approval requested: {} (chat: {})",
                        request.id, chat_id
                    );
                    serde_json::json!({
                        "method": "approval.requested",
                        "params": {
                            "chatId": chat_id,
                            "approval": request
                        }
                    })
                }
                AgentEvent::TurnCompleted {
                    chat_id,
                    turn_id,
                    status,
                    ..
                } => {
                    info!(
                        "🏁 [HostServer] Turn completed: {} (chat: {})",
                        turn_id, chat_id
                    );
                    serde_json::json!({
                        "method": "turn.completed",
                        "params": {
                            "chatId": chat_id,
                            "turnId": turn_id,
                            "status": status
                        }
                    })
                }
                AgentEvent::ChatTitleUpdated { chat_id, title } => {
                    info!(
                        "🏷️  [HostServer] Chat title updated: {} -> {}",
                        chat_id, title
                    );
                    serde_json::json!({
                        "method": "chat.updated",
                        "params": {
                            "chatId": chat_id,
                            "title": title
                        }
                    })
                }
                AgentEvent::ChatPermissionUpdated {
                    chat_id,
                    permission_mode,
                } => {
                    info!(
                        "🛡️  [HostServer] Chat permission updated: {} -> {:?}",
                        chat_id, permission_mode
                    );
                    serde_json::json!({
                        "method": "chat.updated",
                        "params": {
                            "chatId": chat_id,
                            "permissionMode": permission_mode
                        }
                    })
                }
                AgentEvent::ChatDeleted { chat_id } => {
                    info!("🗑️  [HostServer] Chat deleted: {}", chat_id);
                    serde_json::json!({
                        "method": "chat.deleted",
                        "params": {
                            "chatId": chat_id
                        }
                    })
                }
                AgentEvent::ChatCreated { chat } => {
                    info!("✨ [HostServer] Chat created: {}", chat.id);
                    serde_json::json!({
                        "method": "chat.created",
                        "params": {
                            "chat": chat
                        }
                    })
                }
                AgentEvent::ModelUpdated { model, reasoning_effort } => {
                    info!("🤖 [HostServer] Model updated: {} (effort: {:?})", model, reasoning_effort);
                    serde_json::json!({
                        "method": "model.updated",
                        "params": {
                            "model": model,
                            "reasoningEffort": reasoning_effort
                        }
                    })
                }
                AgentEvent::WorkspaceUpdated { workspace } => {
                    info!("📁 [HostServer] Workspace updated: {}", workspace.id);
                    serde_json::json!({
                        "method": "workspace.updated",
                        "params": {
                            "workspace": workspace
                        }
                    })
                }
                AgentEvent::WorkspaceDeleted { workspace_id } => {
                    info!("🗑️  [HostServer] Workspace deleted: {}", workspace_id);
                    serde_json::json!({
                        "method": "workspace.deleted",
                        "params": {
                            "workspaceId": workspace_id
                        }
                    })
                }
            };

            let json_str = serde_json::to_string(&notification).unwrap_or_default();
            if tx_broadcast
                .send(Message::Text(json_str.into()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    // Incoming Request loop from Client
    let dispatcher = state.dispatcher;
    let tx_response = tx_outgoing.clone();
    while let Some(Ok(msg)) = ws_stream.next().await {
        if let Message::Text(text) = msg {
            if let Ok(req) = serde_json::from_str::<RpcRequestEnvelope>(&text) {
                info!("📩 [RPC Request] id: {:?}, method: {}", req.id, req.method);
                let res = dispatcher.dispatch(req).await;
                if let Some(err) = &res.error {
                    error!("❌ [RPC Error] id: {:?}, message: {}", res.id, err.message);
                }
                let res_str = serde_json::to_string(&res).unwrap_or_default();
                let _ = tx_response.send(Message::Text(res_str.into())).await;
            }
        }
    }

    info!("🔌 [HostServer] WebSocket client disconnected");
    broadcast_task.abort();
    outgoing_pump.abort();
}
