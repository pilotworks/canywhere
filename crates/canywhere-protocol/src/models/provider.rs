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
    #[serde(default)]
    pub supports_approvals: bool,
    #[serde(default)]
    pub supported_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub model: String,
    pub display_name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub supported_reasoning_efforts: Vec<String>,
    pub default_reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCommand {
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub requires_args: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAction {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub placement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_configured: bool,
    pub capabilities: AdapterCapabilities,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub commands: Vec<ProviderCommand>,
    #[serde(default)]
    pub actions: Vec<ProviderAction>,
}
