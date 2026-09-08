pub mod adapters;
pub mod db;
pub mod discovery;
pub mod rpc;
pub mod security;
pub mod server;

use std::sync::Arc;
use tracing::{info, warn};

pub async fn start_daemon(port: u16) -> anyhow::Result<()> {
    // Initialize standard logging subscriber with EnvFilter (default to info level)
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                tracing_subscriber::EnvFilter::new("info,canywhere_server=debug")
            }),
        )
        .try_init();

    info!("============================================================");
    info!("🚀 [CanywhereDaemon] Starting Host Server on port {}", port);
    info!("============================================================");

    let db = db::Database::open_default()?;
    info!("📦 [CanywhereDaemon] SQLite Database initialized");

    let repo = Arc::new(db::repositories::RepositoryManager::new(db));
    let pairing = Arc::new(security::PairingSecurityManager::new(
        Arc::clone(&repo),
        port,
    ));
    info!(
        "🔐 [CanywhereDaemon] Ed25519 Host Public Key: {}",
        pairing.host_public_key()
    );

    let codex_bin = std::env::var("CODEX_BIN").unwrap_or_else(|_| "codex".to_string());
    info!("🤖 [CanywhereDaemon] Probing Codex CLI at: {}", codex_bin);

    let (adapter, _event_rx) = adapters::CodexAdapter::new(&codex_bin);
    let adapter = Arc::new(adapter);

    if let Err(e) = adapter.initialize().await {
        warn!(
            "⚠️  [CanywhereDaemon] Codex initialization warning (is 'codex' installed?): {}",
            e
        );
    } else {
        info!("✅ [CanywhereDaemon] Codex app-server adapter connected over stdio");
    }

    let event_tx = adapter.event_tx();
    server::run_server(port, repo, adapter, pairing, event_tx).await
}
