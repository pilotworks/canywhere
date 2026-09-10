use super::{AgentEvent, CliAdapter};
use anyhow::{bail, Result};
use canywhere_protocol::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;

pub struct ProviderRegistry {
    adapters: HashMap<String, Arc<dyn CliAdapter>>,
    default_provider_id: String,
    event_tx: broadcast::Sender<AgentEvent>,
}

impl ProviderRegistry {
    pub fn new(event_tx: broadcast::Sender<AgentEvent>) -> Self {
        Self {
            adapters: HashMap::new(),
            default_provider_id: "codex".to_string(),
            event_tx,
        }
    }

    pub fn register(&mut self, adapter: Arc<dyn CliAdapter>) {
        self.adapters.insert(adapter.id().to_string(), adapter);
    }

    pub fn event_tx(&self) -> broadcast::Sender<AgentEvent> {
        self.event_tx.clone()
    }

    pub fn get(&self, provider_id: &str) -> Option<Arc<dyn CliAdapter>> {
        self.adapters.get(provider_id).cloned()
    }

    pub fn resolve(&self, provider_id: Option<&str>) -> Result<Arc<dyn CliAdapter>> {
        let id = provider_id.unwrap_or(&self.default_provider_id);
        self.adapters
            .get(id)
            .cloned()
            .or_else(|| self.adapters.get(&self.default_provider_id).cloned())
            .or_else(|| self.adapters.values().next().cloned())
            .ok_or_else(|| anyhow::anyhow!("No CLI adapter configured for provider '{}'", id))
    }

    pub fn list_providers(&self) -> Vec<Provider> {
        let mut list = Vec::new();
        for adapter in self.adapters.values() {
            list.push(Provider {
                id: adapter.id().to_string(),
                name: adapter.name().to_string(),
                description: adapter.description().to_string(),
                is_configured: adapter.is_configured(),
                capabilities: adapter.capabilities(),
                icon: adapter.icon(),
                commands: adapter.commands(),
                actions: adapter.actions(),
            });
        }
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    pub async fn get_all_pending_approvals(&self) -> Vec<ApprovalRequest> {
        let mut all = Vec::new();
        for adapter in self.adapters.values() {
            all.extend(adapter.get_all_pending_approvals().await);
        }
        all
    }

    pub async fn get_active_turns_count(&self) -> u32 {
        let mut total = 0;
        for adapter in self.adapters.values() {
            total += adapter.get_active_turns_count().await;
        }
        total
    }

    pub async fn respond_approval(&self, approval_id: &str, decision: &str) -> Result<()> {
        for adapter in self.adapters.values() {
            let approvals = adapter.get_all_pending_approvals().await;
            if approvals.iter().any(|a| a.id == approval_id) {
                return adapter.respond_approval(approval_id, decision).await;
            }
        }
        bail!(
            "Approval request '{}' not found in any active adapter",
            approval_id
        )
    }

    pub fn default_adapter(&self) -> Result<Arc<dyn CliAdapter>> {
        self.resolve(None)
    }

    pub async fn fuzzy_file_search(
        &self,
        roots: Vec<String>,
        query: &str,
        cancellation_token: Option<String>,
    ) -> Result<Vec<canywhere_protocol::rpc::FuzzyFileMatchItem>> {
        let adapter = self.default_adapter()?;
        adapter
            .fuzzy_file_search(roots, query, cancellation_token)
            .await
    }
}
