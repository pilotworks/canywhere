pub mod adapters;
pub mod db;
pub mod discovery;
pub mod git;
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

    let codex_bin = resolve_codex_binary();
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

fn resolve_codex_binary() -> String {
    if let Ok(bin) = std::env::var("CODEX_BIN") {
        if !bin.trim().is_empty() {
            return bin;
        }
    }

    // Try `which codex`
    if let Ok(output) = std::process::Command::new("which").arg("codex").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    // Check common user installation directories
    if let Ok(home) = std::env::var("HOME") {
        let candidates = [
            format!("{}/.local/bin/codex", home),
            format!("{}/.cargo/bin/codex", home),
            "/opt/homebrew/bin/codex".to_string(),
            "/usr/local/bin/codex".to_string(),
        ];
        for cand in candidates {
            if std::path::Path::new(&cand).exists() {
                return cand;
            }
        }
    }

    "codex".to_string()
}
