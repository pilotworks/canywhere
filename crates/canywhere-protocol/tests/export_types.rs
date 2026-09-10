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
    FileTreeNode::export_all_to(out_dir).unwrap();
    Chat::export_all_to(out_dir).unwrap();
    Message::export_all_to(out_dir).unwrap();
    ApprovalRequest::export_all_to(out_dir).unwrap();
    Device::export_all_to(out_dir).unwrap();
    ModelInfo::export_all_to(out_dir).unwrap();
    Provider::export_all_to(out_dir).unwrap();
    RpcRequestEnvelope::export_all_to(out_dir).unwrap();
    RpcResponseEnvelope::export_all_to(out_dir).unwrap();
    RpcNotificationEnvelope::export_all_to(out_dir).unwrap();
    FuzzyFileMatchItem::export_all_to(out_dir).unwrap();
    WorkspaceFileSearchResult::export_all_to(out_dir).unwrap();
    GitFileChange::export_all_to(out_dir).unwrap();
    GitStatusResult::export_all_to(out_dir).unwrap();
    GitDiffResult::export_all_to(out_dir).unwrap();
    GitBranchesResult::export_all_to(out_dir).unwrap();
    GitCommitItem::export_all_to(out_dir).unwrap();
    GitLogResult::export_all_to(out_dir).unwrap();
    GitGenerateCommitMessageParams::export_all_to(out_dir).unwrap();
    GitGenerateCommitMessageResult::export_all_to(out_dir).unwrap();
    HostSettings::export_all_to(out_dir).unwrap();
    HostSettingsUpdateParams::export_all_to(out_dir).unwrap();
    HostSettingsUpdatedNotification::export_all_to(out_dir).unwrap();

    // Export JSON Schema for Swift Codegen
    let schema_dir = Path::new("../../schemas");
    fs::create_dir_all(schema_dir).unwrap();

    let schemas: Vec<(&str, serde_json::Value)> = vec![
        ("chat.schema.json", serde_json::to_value(schemars::schema_for!(Chat)).unwrap()),
        ("message.schema.json", serde_json::to_value(schemars::schema_for!(Message)).unwrap()),
        ("workspace.schema.json", serde_json::to_value(schemars::schema_for!(Workspace)).unwrap()),
        ("approval.schema.json", serde_json::to_value(schemars::schema_for!(ApprovalRequest)).unwrap()),
        ("device.schema.json", serde_json::to_value(schemars::schema_for!(Device)).unwrap()),
        ("pairing_qr.schema.json", serde_json::to_value(schemars::schema_for!(PairingQrPayload)).unwrap()),
        ("pairing_response.schema.json", serde_json::to_value(schemars::schema_for!(PairingResponse)).unwrap()),
        ("provider.schema.json", serde_json::to_value(schemars::schema_for!(Provider)).unwrap()),
        ("settings.schema.json", serde_json::to_value(schemars::schema_for!(HostSettings)).unwrap()),
    ];

    for (filename, schema) in schemas {
        let schema_json = serde_json::to_string_pretty(&schema).unwrap();
        fs::write(schema_dir.join(filename), schema_json).unwrap();
    }
}
