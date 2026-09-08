use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct AdapterCapabilities {
    pub supports_reasoning_stream: bool,
    pub supports_file_diffs: bool,
    pub supports_steering: bool,
    pub supports_interrupt: bool,
    pub supports_session_resumption: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_configured: bool,
    pub capabilities: AdapterCapabilities,
}
