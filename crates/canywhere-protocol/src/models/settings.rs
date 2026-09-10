use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::models::PermissionMode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct HostSettings {
    pub default_provider_id: String,
    pub default_model: String,
    pub default_reasoning_effort: Option<String>,
    pub auto_approve_read_only: bool,
    pub default_permission_mode: PermissionMode,
    pub server_port: u16,
    pub enable_mdns: bool,
}

impl Default for HostSettings {
    fn default() -> Self {
        Self {
            default_provider_id: "codex".to_string(),
            default_model: "gpt-5-codex".to_string(),
            default_reasoning_effort: Some("medium".to_string()),
            auto_approve_read_only: false,
            default_permission_mode: PermissionMode::OnRequest,
            server_port: 7890,
            enable_mdns: true,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct HostSettingsUpdateParams {
    #[ts(optional)]
    pub default_provider_id: Option<String>,
    #[ts(optional)]
    pub default_model: Option<String>,
    #[ts(optional)]
    pub default_reasoning_effort: Option<String>,
    #[ts(optional)]
    pub auto_approve_read_only: Option<bool>,
    #[ts(optional)]
    pub default_permission_mode: Option<PermissionMode>,
    #[ts(optional)]
    pub server_port: Option<u16>,
    #[ts(optional)]
    pub enable_mdns: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct HostSettingsUpdatedNotification {
    pub settings: HostSettings,
}
