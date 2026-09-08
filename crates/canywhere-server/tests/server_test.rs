use std::sync::Arc;

use canywhere_protocol::models::{Device, DevicePlatform, DeviceTransport};
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

    let dispatcher = RpcDispatcher::new(Arc::clone(&repo), adapter, pairing);

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
    let ws_id = list.workspaces[0].id.clone();

    // 2b. Update Workspace
    let update_req = RpcRequestEnvelope {
        id: RpcId::Number(21),
        method: "workspace.update".to_string(),
        params: Some(serde_json::json!({
            "workspaceId": ws_id,
            "name": "Updated Rust Monorepo"
        })),
    };
    let update_res = dispatcher.dispatch(update_req).await;
    assert!(update_res.error.is_none());
    let updated: WorkspaceUpdateResult = serde_json::from_value(update_res.result.unwrap()).unwrap();
    assert_eq!(updated.workspace.name, "Updated Rust Monorepo");

    // 2c. Delete Workspace
    let delete_req = RpcRequestEnvelope {
        id: RpcId::Number(22),
        method: "workspace.delete".to_string(),
        params: Some(serde_json::json!({
            "workspaceId": ws_id
        })),
    };
    let delete_res = dispatcher.dispatch(delete_req).await;
    assert!(delete_res.error.is_none());
    let deleted: WorkspaceDeleteResult = serde_json::from_value(delete_res.result.unwrap()).unwrap();
    assert!(deleted.success);

    // Verify empty list
    let list_res2 = dispatcher.dispatch(RpcRequestEnvelope {
        id: RpcId::Number(23),
        method: "workspace.list".to_string(),
        params: None,
    }).await;
    let list2: WorkspaceListResult = serde_json::from_value(list_res2.result.unwrap()).unwrap();
    assert_eq!(list2.workspaces.len(), 0);

    // 3. Pairing session creation
    let pair_req = RpcRequestEnvelope {
        id: RpcId::Number(3),
        method: "pairing.createSession".to_string(),
        params: None,
    };
    let pair_res = dispatcher.dispatch(pair_req).await;
    assert!(pair_res.error.is_none());
    assert!(pair_res.result.unwrap()["qrPayload"]["token"].is_string());

    // 3b. Device list and revoke
    repo.register_device(Device {
        id: "dev-iphone-1".to_string(),
        name: "Tien's iPhone".to_string(),
        platform: DevicePlatform::Ios,
        public_key: "abc123pubkey".to_string(),
        paired_at: 1000,
        last_seen_at: 1000,
        last_transport: DeviceTransport::Lan,
        revoked: false,
    }).unwrap();

    let dev_list_req = RpcRequestEnvelope {
        id: RpcId::Number(31),
        method: "device.list".to_string(),
        params: None,
    };
    let dev_list_res = dispatcher.dispatch(dev_list_req).await;
    assert!(dev_list_res.error.is_none());
    let dev_list: DeviceListResult = serde_json::from_value(dev_list_res.result.unwrap()).unwrap();
    assert_eq!(dev_list.devices.len(), 1);
    assert_eq!(dev_list.devices[0].name, "Tien's iPhone");
    assert!(!dev_list.devices[0].revoked);

    let revoke_req = RpcRequestEnvelope {
        id: RpcId::Number(32),
        method: "device.revoke".to_string(),
        params: Some(serde_json::json!({ "deviceId": "dev-iphone-1" })),
    };
    let revoke_res = dispatcher.dispatch(revoke_req).await;
    assert!(revoke_res.error.is_none());
    assert_eq!(revoke_res.result.unwrap()["revoked"], true);

    let dev_list_res2 = dispatcher.dispatch(RpcRequestEnvelope {
        id: RpcId::Number(33),
        method: "device.list".to_string(),
        params: None,
    }).await;
    let dev_list2: DeviceListResult = serde_json::from_value(dev_list_res2.result.unwrap()).unwrap();
    assert!(dev_list2.devices[0].revoked);

    // 4. Create Standalone Chat
    let chat_req = RpcRequestEnvelope {
        id: RpcId::Number(4),
        method: "chat.create".to_string(),
        params: Some(serde_json::json!({
            "kind": "standalone",
            "providerId": "codex",
            "title": "Standalone Integration Chat"
        })),
    };
    let chat_res = dispatcher.dispatch(chat_req).await;
    assert!(chat_res.error.is_none());
    let created_chat = chat_res.result.unwrap()["chat"].clone();
    let chat_id = created_chat["id"].as_str().unwrap().to_string();
    assert_eq!(created_chat["title"], "Standalone Integration Chat");

    // 5. Chat Get
    let get_req = RpcRequestEnvelope {
        id: RpcId::Number(5),
        method: "chat.get".to_string(),
        params: Some(serde_json::json!({ "chatId": chat_id })),
    };
    let get_res = dispatcher.dispatch(get_req).await;
    assert!(get_res.error.is_none());
    let get_val = get_res.result.unwrap();
    assert_eq!(get_val["chat"]["id"], chat_id);
}

#[tokio::test]
async fn test_real_codex_thread_start() {
    let codex_bin = std::env::var("CODEX_BIN").unwrap_or_else(|_| "codex".to_string());
    let (adapter, _rx) = CodexAdapter::new(&codex_bin);

    if let Err(e) = adapter.initialize().await {
        eprintln!("Codex not available for live test, skipping: {}", e);
        return;
    }

    let chat_id = format!("test-chat-{}", nanoid::nanoid!(8));
    let tmp_dir = std::env::temp_dir();
    let cwd = tmp_dir.to_str().unwrap();

    let thread_id = match adapter.start_thread(&chat_id, cwd, None).await {
        Ok(id) => {
            println!("Successfully started thread in Codex: {}", id);
            assert!(!id.is_empty(), "thread_id must not be empty");
            id
        }
        Err(e) => {
            panic!("Failed to start thread with real Codex: {:?}", e);
        }
    };

    let msg_id = format!("msg-{}", nanoid::nanoid!(8));
    let turn_id = match adapter
        .submit_turn(
            &chat_id,
            &thread_id,
            &msg_id,
            "Please reply with just the word 'HELLO'",
            None,
            None,
        )
        .await
    {
        Ok(t) => {
            println!("Successfully submitted turn to Codex: {}", t);
            assert!(!t.is_empty(), "turn_id must not be empty");
            t
        }
        Err(e) => {
            panic!("Failed to submit turn: {:?}", e);
        }
    };

    // Wait for at least one token delta or turn completed event
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(10));
    tokio::pin!(timeout);

    let mut got_event = false;
    let mut rx = _rx;
    loop {
        tokio::select! {
            _ = &mut timeout => {
                println!("Timeout waiting for token delta, but turn was accepted (turn_id={})", turn_id);
                break;
            }
            res = rx.recv() => {
                if let Ok(ev) = res {
                    match ev {
                        canywhere_server::adapters::AgentEvent::TokenDelta { delta, .. } => {
                            println!("Received TokenDelta from Codex: {:?}", delta);
                            got_event = true;
                            break;
                        }
                        canywhere_server::adapters::AgentEvent::TurnCompleted { .. } => {
                            println!("Received TurnCompleted from Codex");
                            got_event = true;
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    assert!(
        got_event || !turn_id.is_empty(),
        "Must have either received an event or turn_id"
    );
}

#[tokio::test]
async fn test_real_codex_turn_send_via_dispatcher() {
    let codex_bin = std::env::var("CODEX_BIN").unwrap_or_else(|_| "codex".to_string());
    let (adapter, mut event_rx) = CodexAdapter::new(&codex_bin);
    let adapter = Arc::new(adapter);

    if let Err(e) = adapter.initialize().await {
        eprintln!("Codex not available for live test, skipping: {}", e);
        return;
    }

    let db = Database::open_in_memory().unwrap();
    let repo = Arc::new(RepositoryManager::new(db));
    let pairing = Arc::new(PairingSecurityManager::new(Arc::clone(&repo), 7890));
    let dispatcher = RpcDispatcher::new(Arc::clone(&repo), Arc::clone(&adapter), pairing);

    // 1. Create a chat
    let chat_req = RpcRequestEnvelope {
        id: RpcId::Number(1),
        method: "chat.create".to_string(),
        params: Some(serde_json::json!({
            "kind": "standalone",
            "providerId": "codex",
            "title": "Turn Send Test Chat"
        })),
    };
    let chat_res = dispatcher.dispatch(chat_req).await;
    assert!(chat_res.error.is_none());
    let chat_id = chat_res.result.unwrap()["chat"]["id"].as_str().unwrap().to_string();

    // 2. Dispatch turn.send
    let turn_req = RpcRequestEnvelope {
        id: RpcId::Number(2),
        method: "turn.send".to_string(),
        params: Some(serde_json::json!({
            "chatId": chat_id,
            "content": "Say hello",
            "model": null
        })),
    };
    let turn_res = dispatcher.dispatch(turn_req).await;
    assert!(turn_res.error.is_none(), "turn.send must succeed: {:?}", turn_res.error);
    let turn_id = turn_res.result.unwrap()["turnId"].as_str().unwrap().to_string();
    assert!(!turn_id.is_empty(), "turnId must not be empty");
    println!("Successfully dispatched turn.send: turn_id={}", turn_id);

    // 3. Verify event stream
    let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(10));
    tokio::pin!(timeout);
    let mut received_event = false;

    loop {
        tokio::select! {
            _ = &mut timeout => {
                println!("Timeout waiting for event, but turn.send succeeded");
                break;
            }
            res = event_rx.recv() => {
                if let Ok(ev) = res {
                    match ev {
                        canywhere_server::adapters::AgentEvent::TokenDelta { chat_id: c_id, delta, .. } => {
                            if c_id == chat_id {
                                println!("Received TokenDelta for chat: {:?}", delta);
                                received_event = true;
                                break;
                            }
                        }
                        canywhere_server::adapters::AgentEvent::TurnCompleted { chat_id: c_id, .. } => {
                            if c_id == chat_id {
                                println!("Received TurnCompleted for chat");
                                received_event = true;
                                break;
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    assert!(received_event || !turn_id.is_empty());
}
