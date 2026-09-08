use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum ChatKind {
    Workspace,
    Standalone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum ChatStatus {
    Idle,
    Running,
    AwaitingApproval,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub kind: ChatKind,
    pub workspace_id: Option<String>,
    pub provider_id: String,
    pub title: String,
    pub external_thread_id: Option<String>,
    pub status: ChatStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatCreateInput {
    pub kind: ChatKind,
    pub workspace_id: Option<String>,
    pub provider_id: String,
    pub title: Option<String>,
    pub initial_prompt: Option<String>,
}
