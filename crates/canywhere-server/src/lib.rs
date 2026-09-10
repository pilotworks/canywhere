pub mod adapters;
pub mod db;
pub mod discovery;
pub mod git;
pub mod rpc;
pub mod security;
pub mod server;

use std::sync::Arc;
use tracing::{info, warn};
use crate::adapters::CliAdapter;

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

    let (event_tx, _event_rx) = tokio::sync::broadcast::channel(2048);
    let mut registry = adapters::ProviderRegistry::new(event_tx.clone());

    let codex_bin = adapters::CodexAdapter::resolve_binary();
    info!("🤖 [CanywhereDaemon] Probing Codex CLI at: {}", codex_bin);
    let codex_adapter = Arc::new(adapters::CodexAdapter::with_event_tx(&codex_bin, event_tx.clone()));
    if let Err(e) = codex_adapter.initialize().await {
        warn!(
            "⚠️  [CanywhereDaemon] Codex initialization warning (is 'codex' installed?): {}",
            e
        );
    } else {
        info!("✅ [CanywhereDaemon] Codex app-server adapter connected over stdio");
    }
    registry.register(codex_adapter);

    let agy_bin = adapters::AgyAdapter::resolve_binary();
    info!("🤖 [CanywhereDaemon] Probing Antigravity (agy) CLI at: {}", agy_bin);
    let agy_adapter = Arc::new(adapters::AgyAdapter::new(&agy_bin, event_tx.clone()));
    if agy_adapter.is_configured() {
        info!("✅ [CanywhereDaemon] Antigravity CLI adapter configured");
    } else {
        info!("ℹ️  [CanywhereDaemon] Antigravity CLI not detected (optional)");
    }
    registry.register(agy_adapter);

    let registry = Arc::new(registry);
    server::run_server(port, repo, registry, pairing, event_tx).await
}
