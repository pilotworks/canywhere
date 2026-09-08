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
use tracing::info;

use canywhere_protocol::rpc::*;
use crate::adapters::{AgentEvent, CodexAdapter};
use crate::db::repositories::RepositoryManager;
use crate::rpc::dispatcher::RpcDispatcher;
use crate::security::PairingSecurityManager;

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
    let dispatcher = Arc::new(RpcDispatcher::new(repo, adapter, Arc::clone(&pairing)));
    let host_public_key = pairing.host_public_key().to_string();

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

    let addr = format!("127.0.0.1:{}", port);
    info!("[HostServer] Listening on http://{}", addr);

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
                AgentEvent::TokenDelta { chat_id, message_id, delta } => {
                    serde_json::json!({
                        "method": "message.delta",
                        "params": {
                            "chatId": chat_id,
                            "messageId": message_id,
                            "delta": { "type": "text", "text": delta }
                        }
                    })
                }
                AgentEvent::TurnCompleted { chat_id, turn_id, status } => {
                    serde_json::json!({
                        "method": "turn.completed",
                        "params": {
                            "chatId": chat_id,
                            "turnId": turn_id,
                            "status": status
                        }
                    })
                }
                _ => continue,
            };

            let json_str = serde_json::to_string(&notification).unwrap_or_default();
            if tx_broadcast.send(Message::Text(json_str.into())).await.is_err() {
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
                let res = dispatcher.dispatch(req).await;
                let res_str = serde_json::to_string(&res).unwrap_or_default();
                let _ = tx_response.send(Message::Text(res_str.into())).await;
            }
        }
    }

    broadcast_task.abort();
    outgoing_pump.abort();
}
