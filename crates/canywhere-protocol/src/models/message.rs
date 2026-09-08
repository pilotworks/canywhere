use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum MessageRole {
    User,
    Agent,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum ToolCallStatus {
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum FileDiffStatus {
    Proposed,
    Applied,
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum CommandExecStatus {
    PendingApproval,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessageBlock {
    Text {
        content: String,
    },
    Reasoning {
        content: String,
        completed: bool,
    },
    Plan {
        content: String,
    },
    ToolCall {
        #[serde(rename = "callId")]
        call_id: String,
        name: String,
        args: serde_json::Value,
        output: Option<String>,
        status: ToolCallStatus,
    },
    FileDiff {
        path: String,
        patch: String,
        status: FileDiffStatus,
    },
    CommandExec {
        command: String,
        cwd: String,
        output: Option<String>,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
        status: CommandExecStatus,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub turn_id: Option<String>,
    pub role: MessageRole,
    pub blocks: Vec<MessageBlock>,
    pub created_at: i64,
    pub streaming: bool,
}
