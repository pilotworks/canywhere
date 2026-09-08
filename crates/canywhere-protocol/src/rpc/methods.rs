use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::{
    ApprovalRequest, Chat, ChatStatus, Device, FileTreeNode, Message, MessageBlock, Workspace,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendParams {
    pub chat_id: String,
    pub content: String,
    pub client_message_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnSendResult {
    pub turn_id: String,
    pub status: ChatStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct DeviceListResult {
    pub devices: Vec<Device>,
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
pub struct TurnCompletedNotification {
    pub chat_id: String,
    pub turn_id: String,
    pub status: ChatStatus,
}
