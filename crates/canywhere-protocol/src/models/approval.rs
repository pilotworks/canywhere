use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalKind {
    Command,
    FileChange,
    UserInput,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied,
    Canceled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalDecision {
    Accept,
    AcceptForSession,
    Decline,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalPayload {
    pub command: Option<String>,
    pub cwd: Option<String>,
    pub reason: Option<String>,
    pub diff: Option<String>,
    pub path: Option<String>,
    pub prompt: Option<String>,
    pub is_high_risk: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequest {
    pub id: String,
    pub chat_id: String,
    pub turn_id: String,
    pub external_request_id: String,
    pub kind: ApprovalKind,
    pub payload: ApprovalPayload,
    pub status: ApprovalStatus,
    pub requested_at: i64,
    pub resolved_at: Option<i64>,
    pub resolved_by_device_id: Option<String>,
    pub resolved_by_device_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalResponseInput {
    pub approval_id: String,
    pub decision: ApprovalDecision,
}
