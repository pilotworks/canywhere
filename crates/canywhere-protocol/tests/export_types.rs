use std::fs;
use std::path::Path;
use ts_rs::TS;

use canywhere_protocol::models::*;
use canywhere_protocol::rpc::*;

#[test]
fn export_typescript_and_json_schema() {
    let out_dir = Path::new("../../packages/desktop-ui/src/types/generated");
    fs::create_dir_all(out_dir).unwrap();

    // Export TS types
    Workspace::export_all_to(out_dir).unwrap();
    Chat::export_all_to(out_dir).unwrap();
    Message::export_all_to(out_dir).unwrap();
    ApprovalRequest::export_all_to(out_dir).unwrap();
    Device::export_all_to(out_dir).unwrap();
    RpcRequestEnvelope::export_all_to(out_dir).unwrap();
    RpcResponseEnvelope::export_all_to(out_dir).unwrap();
    RpcNotificationEnvelope::export_all_to(out_dir).unwrap();

    // Export JSON Schema for Swift Codegen
    let schema_dir = Path::new("../../schemas");
    fs::create_dir_all(schema_dir).unwrap();

    let root_schema = schemars::schema_for!(Chat);
    let schema_json = serde_json::to_string_pretty(&root_schema).unwrap();
    fs::write(schema_dir.join("chat.schema.json"), schema_json).unwrap();
}
