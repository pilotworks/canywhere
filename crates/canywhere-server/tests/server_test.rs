use std::sync::Arc;

use canywhere_protocol::rpc::*;
use canywhere_server::adapters::CodexAdapter;
use canywhere_server::db::repositories::RepositoryManager;
use canywhere_server::db::Database;
use canywhere_server::rpc::RpcDispatcher;
use canywhere_server::security::PairingSecurityManager;

#[tokio::test]
async fn test_rpc_dispatcher_workspaces_and_chats() {
    let db = Database::open_in_memory().unwrap();
    let repo = Arc::new(RepositoryManager::new(db));
    let pairing = Arc::new(PairingSecurityManager::new(Arc::clone(&repo), 7890));
    let (adapter, _) = CodexAdapter::new("mock");
    let adapter = Arc::new(adapter);

    let dispatcher = RpcDispatcher::new(repo, adapter, pairing);

    // 1. Create Workspace
    let req = RpcRequestEnvelope {
        id: RpcId::Number(1),
        method: "workspace.create".to_string(),
        params: Some(serde_json::json!({
            "name": "Rust Monorepo",
            "rootPath": "/tmp/rust",
            "providerId": "codex"
        })),
    };
    let res = dispatcher.dispatch(req).await;
    assert!(res.error.is_none());
    assert_eq!(res.result.unwrap()["workspace"]["name"], "Rust Monorepo");

    // 2. List Workspaces
    let list_req = RpcRequestEnvelope {
        id: RpcId::Number(2),
        method: "workspace.list".to_string(),
        params: None,
    };
    let list_res = dispatcher.dispatch(list_req).await;
    assert!(list_res.error.is_none());
    let list: WorkspaceListResult = serde_json::from_value(list_res.result.unwrap()).unwrap();
    assert_eq!(list.workspaces.len(), 1);
    assert_eq!(list.workspaces[0].name, "Rust Monorepo");

    // 3. Pairing session creation
    let pair_req = RpcRequestEnvelope {
        id: RpcId::Number(3),
        method: "pairing.createSession".to_string(),
        params: None,
    };
    let pair_res = dispatcher.dispatch(pair_req).await;
    assert!(pair_res.error.is_none());
    assert!(pair_res.result.unwrap()["qrPayload"]["token"].is_string());
}
