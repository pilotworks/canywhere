pub mod agy;
pub mod codex;
pub mod registry;

use anyhow::Result;
use async_trait::async_trait;
use canywhere_protocol::models::*;

pub use agy::AgyAdapter;
pub use codex::CodexAdapter;
pub use registry::ProviderRegistry;

#[derive(Debug, Clone)]
pub enum AgentEvent {
    MessageCreated {
        message: Message,
    },
    TokenDelta {
        chat_id: String,
        message_id: String,
        delta: String,
    },
    ReasoningDelta {
        chat_id: String,
        message_id: String,
        delta: String,
    },
    BlockStarted {
        chat_id: String,
        message_id: String,
        block_id: String,
        block: MessageBlock,
    },
    BlockCompleted {
        chat_id: String,
        message_id: String,
        block_id: String,
        block: Option<MessageBlock>,
    },
    ApprovalRequested {
        chat_id: String,
        request: ApprovalRequest,
    },
    ApprovalResolved {
        approval_id: String,
        chat_id: Option<String>,
        decision: String,
    },
    TurnCompleted {
        chat_id: String,
        message_id: String,
        turn_id: String,
        status: ChatStatus,
        blocks: Vec<MessageBlock>,
        text_content: Option<String>,
        reasoning_content: Option<String>,
    },
    ChatTitleUpdated {
        chat_id: String,
        title: String,
    },
    ChatPermissionUpdated {
        chat_id: String,
        permission_mode: PermissionMode,
    },
    ChatThreadUpdated {
        chat_id: String,
        thread_id: String,
    },
    ChatDeleted {
        chat_id: String,
    },
    ChatCreated {
        chat: Chat,
    },
    ModelUpdated {
        model: String,
        reasoning_effort: Option<String>,
    },
    WorkspaceUpdated {
        workspace: Workspace,
    },
    WorkspaceDeleted {
        workspace_id: String,
    },
    QueueUpdated {
        chat_id: String,
        items: Vec<QueuedMessage>,
    },
    SettingsUpdated {
        settings: HostSettings,
    },
}

#[async_trait]
pub trait CliAdapter: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn is_configured(&self) -> bool;
    fn capabilities(&self) -> AdapterCapabilities;

    async fn start_thread(
        &self,
        chat_id: &str,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String>;

    async fn resume_or_start_thread(
        &self,
        chat_id: &str,
        thread_id: Option<&str>,
        cwd: &str,
        sub_paths: Option<&[String]>,
    ) -> Result<String>;

    async fn submit_turn(
        &self,
        chat_id: &str,
        thread_id: &str,
        message_id: &str,
        prompt: &str,
        model: Option<&str>,
        effort: Option<&str>,
        permission_mode: Option<PermissionMode>,
        cwd: Option<&str>,
    ) -> Result<String>;

    async fn interrupt_turn(&self, thread_id: &str, turn_id: &str) -> Result<()>;
    async fn respond_approval(&self, approval_id: &str, decision: &str) -> Result<()>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;

    async fn get_active_turn(&self, chat_id: &str) -> Option<String>;
    async fn clear_active_turn(&self, chat_id: &str);
    async fn get_active_turns_count(&self) -> u32;
    async fn get_active_streaming_message(&self, chat_id: &str) -> Option<Message>;
    async fn get_pending_approvals(&self, chat_id: &str) -> Vec<ApprovalRequest>;
    async fn get_all_pending_approvals(&self) -> Vec<ApprovalRequest>;

    async fn steer_turn(&self, _thread_id: &str, _turn_id: &str, _content: &str) -> Result<String> {
        anyhow::bail!("Steer turn not supported by this provider");
    }

    async fn start_review(&self, _chat_id: &str, _thread_id: &str) -> Result<String> {
        anyhow::bail!("Code review not supported by this provider");
    }

    async fn compact_thread(&self, _thread_id: &str) -> Result<()> {
        Ok(())
    }

    async fn fuzzy_file_search(
        &self,
        _roots: Vec<String>,
        _query: &str,
        _cancellation_token: Option<String>,
    ) -> Result<Vec<canywhere_protocol::rpc::FuzzyFileMatchItem>> {
        Ok(Vec::new())
    }

    fn icon(&self) -> Option<String> {
        None
    }

    fn commands(&self) -> Vec<ProviderCommand> {
        Vec::new()
    }

    fn actions(&self) -> Vec<ProviderAction> {
        Vec::new()
    }

    async fn execute_command(
        &self,
        _chat_id: &str,
        _thread_id: &str,
        command: &str,
        _args: Option<&str>,
    ) -> Result<canywhere_protocol::rpc::ChatExecuteCommandResult> {
        anyhow::bail!("Command '{}' is not supported by this provider", command);
    }

    async fn set_auto_approve_read_only(&self, _enabled: bool) {}
}
