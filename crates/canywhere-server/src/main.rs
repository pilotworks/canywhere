use std::sync::Arc;
use tracing::info;

mod adapters;
mod db;
mod rpc;
mod security;
mod server;

use adapters::CodexAdapter;
use db::repositories::RepositoryManager;
use db::Database;
use security::PairingSecurityManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "7890".to_string())
        .parse::<u16>()?;

    let db = Database::open_default()?;
    let repo = Arc::new(RepositoryManager::new(db));
    let pairing = Arc::new(PairingSecurityManager::new(Arc::clone(&repo), port));

    let codex_bin = std::env::var("CODEX_BIN").unwrap_or_else(|_| "codex".to_string());
    let (adapter, _event_rx) = CodexAdapter::new(&codex_bin);
    let adapter = Arc::new(adapter);

    if let Err(e) = adapter.initialize().await {
        info!("[HostServer] Codex initialization warning (is Codex installed?): {}", e);
    }

    let (event_tx, _) = tokio::sync::broadcast::channel(1024);

    server::run_server(port, repo, adapter, pairing, event_tx).await
}
