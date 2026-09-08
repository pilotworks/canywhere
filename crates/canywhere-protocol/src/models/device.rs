use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum DevicePlatform {
    Ios,
    Desktop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub enum DeviceTransport {
    Lan,
    Tailscale,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub name: String,
    pub platform: DevicePlatform,
    pub public_key: String,
    pub paired_at: i64,
    pub last_seen_at: i64,
    pub last_transport: DeviceTransport,
    pub revoked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct PairingQrPayload {
    pub host_id: String,
    pub host_name: String,
    pub token: String,
    pub endpoints: Vec<String>,
    pub host_public_key: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequest {
    pub token: String,
    pub device_id: String,
    pub device_name: String,
    pub device_public_key: String,
    pub platform: DevicePlatform,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
pub struct PairingResponse {
    pub status: String, // "paired"
    pub host_id: String,
    pub auth_token: String,
}
