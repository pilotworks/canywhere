use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use crate::models::git::*;
pub use crate::models::settings::*;
use crate::models::{
    ApprovalRequest, Chat, ChatStatus, Device, FileTreeNode, Message, MessageBlock, ModelInfo,
    Provider, Workspace,
};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListResult {
    pub workspaces: Vec<Workspace>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTreeParams {
    pub workspace_id: String,
    pub sub_path: Option<String>,
    pub max_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTreeResult {
    pub root: FileTreeNode,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReadFileParams {
    pub workspace_id: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReadFileResult {
    pub path: String,
    pub content: String,
    pub size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileSearchParams {
    pub workspace_id: String,
    pub query: String,
    #[serde(default)]
    pub cancellation_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct FuzzyFileMatchItem {
    pub path: String,
    pub root: String,
    pub file_name: String,
    pub match_type: String,
    pub score: u32,
    #[serde(default)]
    pub indices: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileSearchResult {
    pub files: Vec<FuzzyFileMatchItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatReviewParams {
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompactParams {
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePickFolderResult {
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUpdateParams {
    pub workspace_id: String,
    pub name: Option<String>,
    pub root_path: Option<String>,
    pub sub_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUpdateResult {
    pub workspace: Workspace,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDeleteParams {
    pub workspace_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDeleteResult {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatListParams {
    pub workspace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatListResult {
    pub chats: Vec<Chat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatGetParams {
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatGetResult {
    pub chat: Chat,
    pub messages: Vec<Message>,
    pub pending_approvals: Vec<ApprovalRequest>,
    #[serde(default)]
    pub queued_messages: Vec<crate::models::QueuedMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatDeleteParams {
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatDeleteResult {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatSetPermissionParams {
    pub chat_id: String,
    pub permission_mode: crate::models::PermissionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatSetPermissionResult {
    pub success: bool,
    pub permission_mode: crate::models::PermissionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendParams {
    pub chat_id: String,
    pub content: String,
    pub client_message_id: Option<String>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub permission_mode: Option<crate::models::PermissionMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendResult {
    pub turn_id: String,
    pub status: ChatStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSteerParams {
    pub chat_id: String,
    pub turn_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSteerResult {
    pub turn_id: String,
    pub status: ChatStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct DeviceListResult {
    pub devices: Vec<Device>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelListResult {
    pub models: Vec<ModelInfo>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_model: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelGetResult {
    pub model: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelSetParams {
    pub model: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelUpdatedNotification {
    pub model: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListResult {
    pub providers: Vec<Provider>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatExecuteCommandParams {
    pub chat_id: String,
    pub command: String,
    #[serde(default)]
    pub args: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatExecuteCommandResult {
    pub success: bool,
    #[serde(default)]
    pub message: Option<String>,
}

// Notifications
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessageDeltaPayload {
    Text { text: String },
    Reasoning { text: String },
    Plan { text: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct MessageDeltaNotification {
    pub chat_id: String,
    pub turn_id: String,
    pub message_id: String,
    pub delta: MessageDeltaPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ToolNotification {
    pub chat_id: String,
    pub turn_id: String,
    pub block: MessageBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequestedNotification {
    pub chat_id: String,
    pub turn_id: String,
    pub approval: ApprovalRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalListResult {
    pub approvals: Vec<ApprovalRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalResolvedNotification {
    pub approval_id: String,
    pub chat_id: Option<String>,
    pub decision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct HostInfoResult {
    pub host_name: String,
    pub os: String,
    #[serde(default)]
    pub agent_version: Option<String>,
    #[serde(default)]
    pub codex_version: Option<String>,
    pub active_turns_count: u32,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnCompletedNotification {
    pub chat_id: String,
    pub turn_id: String,
    pub status: ChatStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUpdatedNotification {
    pub workspace: Workspace,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDeletedNotification {
    pub workspace_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueListParams {
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueListResult {
    pub items: Vec<crate::models::QueuedMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueAddParams {
    pub chat_id: String,
    pub content: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub reasoning_effort: Option<String>,
    #[serde(default)]
    pub permission_mode: Option<crate::models::PermissionMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueRemoveParams {
    pub chat_id: String,
    pub queue_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueUpdateParams {
    pub chat_id: String,
    pub queue_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueSteerParams {
    pub chat_id: String,
    pub queue_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct QueueUpdatedNotification {
    pub chat_id: String,
    pub items: Vec<crate::models::QueuedMessage>,
}
