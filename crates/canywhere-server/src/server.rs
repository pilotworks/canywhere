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
            if let AgentEvent::TurnCompleted {
                chat_id,
                turn_id,
                status,
                text_content,
            } = event
            {
                let _ = repo_persist.update_chat_status(&chat_id, status, None);
                if let Some(text) = text_content {
                    if !text.trim().is_empty() {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                        let agent_msg = canywhere_protocol::models::Message {
                            id: nanoid::nanoid!(16),
                            chat_id: chat_id.clone(),
                            turn_id: Some(turn_id),
                            role: canywhere_protocol::models::MessageRole::Agent,
                            blocks: vec![canywhere_protocol::models::MessageBlock::Text {
                                content: text,
                            }],
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
                AgentEvent::BlockStarted {
                    chat_id,
                    message_id,
                    block,
                } => {
                    info!("🛠️  [HostServer] Tool block started for chat {}", chat_id);
                    serde_json::json!({
                        "method": "tool.started",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "block": block
                        }
                    })
                }
                AgentEvent::BlockCompleted {
                    chat_id,
                    message_id,
                    block_id,
                } => {
                    info!("✅ [HostServer] Tool block completed: {}", block_id);
                    serde_json::json!({
                        "method": "tool.completed",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "block": { "id": block_id }
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
