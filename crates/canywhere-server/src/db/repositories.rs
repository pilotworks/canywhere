use anyhow::Result;
use rusqlite::params;
use uuid::Uuid;

use super::Database;
use canywhere_protocol::models::*;

pub struct RepositoryManager {
    db: Database,
}

impl RepositoryManager {
    pub fn new(db: Database) -> Self {
        let repo = Self { db };
        let _ = repo.reset_running_chats_to_idle();
        repo
    }

    pub fn reset_running_chats_to_idle(&self) -> Result<()> {
        let conn = self.db.conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE chats SET status = 'idle', updated_at = ?1 WHERE status = 'running' OR status = 'awaiting_approval'",
            params![now],
        )?;
        Ok(())
    }

    // Workspaces
    pub fn list_workspaces(&self) -> Result<Vec<Workspace>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id, name, root_path, sub_paths_json, provider_id, created_at, updated_at FROM workspaces ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |r| {
            let sub_paths_json: String = r.get(3)?;
            let sub_paths: Vec<String> = serde_json::from_str(&sub_paths_json).unwrap_or_default();
            Ok(Workspace {
                id: r.get(0)?,
                name: r.get(1)?,
                root_path: r.get(2)?,
                sub_paths,
                provider_id: r.get(4)?,
                created_at: r.get(5)?,
                last_opened_at: r.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_workspace(&self, id: &str) -> Result<Option<Workspace>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id, name, root_path, sub_paths_json, provider_id, created_at, updated_at FROM workspaces WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], |r| {
            let sub_paths_json: String = r.get(3)?;
            let sub_paths: Vec<String> = serde_json::from_str(&sub_paths_json).unwrap_or_default();
            Ok(Workspace {
                id: r.get(0)?,
                name: r.get(1)?,
                root_path: r.get(2)?,
                sub_paths,
                provider_id: r.get(4)?,
                created_at: r.get(5)?,
                last_opened_at: r.get(6)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn create_workspace(&self, input: WorkspaceCreateInput) -> Result<Workspace> {
        let conn = self.db.conn();
        let id = Uuid::new_v4().to_string();
        let now = chrono_now();
        let sub_paths = input.sub_paths.unwrap_or_default();
        let sub_paths_json = serde_json::to_string(&sub_paths)?;

        conn.execute(
            "INSERT INTO workspaces (id, name, root_path, sub_paths_json, provider_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, input.name, input.root_path, sub_paths_json, input.provider_id, now, now],
        )?;

        Ok(Workspace {
            id,
            name: input.name,
            root_path: input.root_path,
            sub_paths,
            provider_id: input.provider_id,
            created_at: now,
            last_opened_at: now,
        })
    }

    pub fn update_workspace(
        &self,
        id: &str,
        name: Option<String>,
        root_path: Option<String>,
        sub_paths: Option<Vec<String>>,
    ) -> Result<Option<Workspace>> {
        let existing = self.get_workspace(id)?;
        let Some(mut ws) = existing else {
            return Ok(None);
        };

        if let Some(n) = name {
            ws.name = n;
        }
        if let Some(rp) = root_path {
            ws.root_path = rp;
        }
        if let Some(sp) = sub_paths {
            ws.sub_paths = sp;
        }
        ws.last_opened_at = chrono_now();

        let sub_paths_json = serde_json::to_string(&ws.sub_paths)?;
        let conn = self.db.conn();
        conn.execute(
            "UPDATE workspaces SET name = ?1, root_path = ?2, sub_paths_json = ?3, updated_at = ?4 WHERE id = ?5",
            params![ws.name, ws.root_path, sub_paths_json, ws.last_opened_at, id],
        )?;

        Ok(Some(ws))
    }

    pub fn delete_workspace(&self, id: &str) -> Result<bool> {
        let conn = self.db.conn();
        let rows = conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }

    // Chats
    pub fn list_chats(&self, workspace_id: Option<&str>) -> Result<Vec<Chat>> {
        let conn = self.db.conn();
        let mut list = Vec::new();

        if let Some(ws_id) = workspace_id {
            let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at, permission_mode FROM chats WHERE workspace_id = ?1 ORDER BY updated_at DESC")?;
            let rows = stmt.query_map(params![ws_id], map_chat_row)?;
            for r in rows {
                list.push(r?);
            }
        } else {
            let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at, permission_mode FROM chats ORDER BY updated_at DESC")?;
            let rows = stmt.query_map([], map_chat_row)?;
            for r in rows {
                list.push(r?);
            }
        }

        Ok(list)
    }

    pub fn get_chat(&self, id: &str) -> Result<Option<Chat>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at, permission_mode FROM chats WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], map_chat_row)?;
        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn create_chat(&self, input: ChatCreateInput, scratch_dir: Option<String>) -> Result<Chat> {
        let conn = self.db.conn();
        let id = Uuid::new_v4().to_string();
        let now = chrono_now();
        let kind_str = match input.kind {
            ChatKind::Workspace => "workspace",
            ChatKind::Standalone => "standalone",
        };
        let title = input.title.unwrap_or_else(|| "New Chat".to_string());
        let perm_mode = input.permission_mode.unwrap_or(PermissionMode::OnRequest);
        let perm_str = match perm_mode {
            PermissionMode::ReadOnly => "readOnly",
            PermissionMode::Auto => "auto",
            PermissionMode::OnRequest => "onRequest",
        };

        conn.execute(
            "INSERT INTO chats (id, workspace_id, title, provider_id, kind, status, permission_mode, thread_id, scratch_dir, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'idle', ?6, NULL, ?7, ?8, ?9)",
            params![id, input.workspace_id, title, input.provider_id, kind_str, perm_str, scratch_dir, now, now],
        )?;

        Ok(Chat {
            id,
            kind: input.kind,
            workspace_id: input.workspace_id,
            provider_id: input.provider_id,
            title,
            external_thread_id: None,
            status: ChatStatus::Idle,
            permission_mode: perm_mode,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_chat_status(
        &self,
        id: &str,
        status: ChatStatus,
        thread_id: Option<&str>,
    ) -> Result<()> {
        let conn = self.db.conn();
        let now = chrono_now();
        let status_str = match status {
            ChatStatus::Idle => "idle",
            ChatStatus::Running => "running",
            ChatStatus::AwaitingApproval => "awaiting_approval",
            ChatStatus::Error => "error",
        };

        if let Some(th_id) = thread_id {
            conn.execute(
                "UPDATE chats SET status = ?1, thread_id = ?2, updated_at = ?3 WHERE id = ?4",
                params![status_str, th_id, now, id],
            )?;
        } else {
            conn.execute(
                "UPDATE chats SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status_str, now, id],
            )?;
        }
        Ok(())
    }

    pub fn update_chat_title(&self, id: &str, title: &str) -> Result<()> {
        let conn = self.db.conn();
        let now = chrono_now();
        conn.execute(
            "UPDATE chats SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )?;
        Ok(())
    }

    pub fn update_chat_permission_mode(&self, id: &str, mode: PermissionMode) -> Result<()> {
        let conn = self.db.conn();
        let now = chrono_now();
        let mode_str = match mode {
            PermissionMode::ReadOnly => "readOnly",
            PermissionMode::Auto => "auto",
            PermissionMode::OnRequest => "onRequest",
        };
        conn.execute(
            "UPDATE chats SET permission_mode = ?1, updated_at = ?2 WHERE id = ?3",
            params![mode_str, now, id],
        )?;
        Ok(())
    }

    pub fn delete_chat(&self, id: &str) -> Result<bool> {
        let conn = self.db.conn();
        conn.execute(
            "DELETE FROM message_blocks WHERE message_id IN (SELECT id FROM messages WHERE chat_id = ?1)",
            params![id],
        )?;
        conn.execute(
            "DELETE FROM messages WHERE chat_id = ?1",
            params![id],
        )?;
        conn.execute(
            "DELETE FROM approval_requests WHERE chat_id = ?1",
            params![id],
        )?;
        let changes = conn.execute(
            "DELETE FROM chats WHERE id = ?1",
            params![id],
        )?;
        Ok(changes > 0)
    }

    // Devices & Pairing
    pub fn create_pairing_session(&self, token: &str, secret: &str, ttl_ms: i64) -> Result<i64> {
        let conn = self.db.conn();
        let id = Uuid::new_v4().to_string();
        let now = chrono_now();
        let expires_at = now + ttl_ms;

        conn.execute(
            "INSERT INTO pairing_sessions (id, token, secret, expires_at, used_at, created_at)
             VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
            params![id, token, secret, expires_at, now],
        )?;
        Ok(expires_at)
    }

    pub fn consume_pairing_token(&self, token: &str) -> Result<bool> {
        let conn = self.db.conn();
        let now = chrono_now();
        let changes = conn.execute(
            "UPDATE pairing_sessions SET used_at = ?1 WHERE token = ?2 AND used_at IS NULL AND expires_at > ?3",
            params![now, token, now],
        )?;
        Ok(changes > 0)
    }

    pub fn register_device(&self, dev: Device) -> Result<Device> {
        let conn = self.db.conn();
        let platform_str = match dev.platform {
            DevicePlatform::Ios => "ios",
            DevicePlatform::Desktop => "desktop",
        };
        let transport_str = match dev.last_transport {
            DeviceTransport::Lan => "lan",
            DeviceTransport::Tailscale => "tailscale",
        };

        conn.execute(
            "INSERT INTO devices (id, public_key, name, platform, paired_at, last_seen_at, last_transport, revoked)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)
             ON CONFLICT(public_key) DO UPDATE SET
                name = excluded.name,
                platform = excluded.platform,
                last_seen_at = excluded.last_seen_at,
                revoked = 0",
            params![dev.id, dev.public_key, dev.name, platform_str, dev.paired_at, dev.last_seen_at, transport_str],
        )?;
        Ok(dev)
    }

    pub fn list_devices(&self) -> Result<Vec<Device>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id, public_key, name, platform, paired_at, last_seen_at, last_transport, revoked FROM devices ORDER BY paired_at DESC")?;
        let rows = stmt.query_map([], |r| {
            let platform_str: String = r.get(3)?;
            let transport_str: String = r.get(6)?;
            let revoked_int: i32 = r.get(7)?;
            Ok(Device {
                id: r.get(0)?,
                public_key: r.get(1)?,
                name: r.get(2)?,
                platform: if platform_str == "ios" {
                    DevicePlatform::Ios
                } else {
                    DevicePlatform::Desktop
                },
                paired_at: r.get(4)?,
                last_seen_at: r.get(5)?,
                last_transport: if transport_str == "tailscale" {
                    DeviceTransport::Tailscale
                } else {
                    DeviceTransport::Lan
                },
                revoked: revoked_int != 0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn revoke_device(&self, id: &str) -> Result<bool> {
        let conn = self.db.conn();
        let changes = conn.execute(
            "UPDATE devices SET revoked = 1 WHERE id = ?1",
            params![id],
        )?;
        Ok(changes > 0)
    }

    // Messages & Blocks
    pub fn record_message(&self, msg: &Message) -> Result<()> {
        let conn = self.db.conn();
        let role_str = match msg.role {
            MessageRole::User => "user",
            MessageRole::Agent => "agent",
            MessageRole::System => "system",
        };
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, turn_id, sequence, created_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5)
             ON CONFLICT(id) DO UPDATE SET turn_id = excluded.turn_id",
            params![msg.id, msg.chat_id, role_str, msg.turn_id, msg.created_at],
        )?;

        conn.execute(
            "DELETE FROM message_blocks WHERE message_id = ?1",
            params![msg.id],
        )?;

        for (idx, block) in msg.blocks.iter().enumerate() {
            Self::insert_message_block(&conn, &msg.id, idx as i32, block)?;
        }
        Ok(())
    }

    pub fn record_message_block(
        &self,
        message_id: &str,
        sequence: i32,
        block: &MessageBlock,
    ) -> Result<()> {
        let conn = self.db.conn();
        Self::insert_message_block(&conn, message_id, sequence, block)
    }

    fn insert_message_block(
        conn: &rusqlite::Connection,
        message_id: &str,
        sequence: i32,
        block: &MessageBlock,
    ) -> Result<()> {
        let id = Uuid::new_v4().to_string();
        let now = chrono_now();
        let block_type = match block {
            MessageBlock::Text { .. } => "text",
            MessageBlock::Reasoning { .. } => "reasoning",
            MessageBlock::Plan { .. } => "plan",
            MessageBlock::ToolCall { .. } => "tool_call",
            MessageBlock::FileDiff { .. } => "file_diff",
            MessageBlock::CommandExec { .. } => "command_exec",
        };
        let payload_json = serde_json::to_string(block)?;

        conn.execute(
            "INSERT INTO message_blocks (id, message_id, sequence, block_type, payload_json, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'done', ?6, ?7)",
            params![id, message_id, sequence, block_type, payload_json, now, now],
        )?;
        Ok(())
    }

    pub fn get_chat_history(&self, chat_id: &str) -> Result<Vec<Message>> {
        let conn = self.db.conn();
        let mut msg_stmt = conn.prepare("SELECT id, chat_id, role, turn_id, created_at FROM messages WHERE chat_id = ?1 ORDER BY created_at ASC")?;
        let msg_rows = msg_stmt.query_map(params![chat_id], |r| {
            let role_str: String = r.get(2)?;
            let role = match role_str.as_str() {
                "user" => MessageRole::User,
                "agent" => MessageRole::Agent,
                _ => MessageRole::System,
            };
            Ok(Message {
                id: r.get(0)?,
                chat_id: r.get(1)?,
                role,
                turn_id: r.get(3)?,
                blocks: Vec::new(),
                created_at: r.get(4)?,
                streaming: false,
            })
        })?;

        let mut messages = Vec::new();
        for m in msg_rows {
            messages.push(m?);
        }

        // Attach blocks for each message
        for msg in &mut messages {
            let mut block_stmt = conn.prepare("SELECT payload_json FROM message_blocks WHERE message_id = ?1 ORDER BY sequence ASC")?;
            let block_rows = block_stmt.query_map(params![msg.id], |r| {
                let json_str: String = r.get(0)?;
                Ok(json_str)
            })?;

            for br in block_rows {
                let json_str = br?;
                if let Ok(block) = serde_json::from_str::<MessageBlock>(&json_str) {
                    msg.blocks.push(block);
                }
            }
        }

        Ok(messages)
    }

    // Settings
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.db.conn();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    // Message Queue
    pub fn list_queued_messages(&self, chat_id: &str) -> Result<Vec<QueuedMessage>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, chat_id, content, model, reasoning_effort, permission_mode, sequence, created_at
             FROM queued_messages WHERE chat_id = ?1 ORDER BY sequence ASC, created_at ASC"
        )?;
        let rows = stmt.query_map(params![chat_id], |r| {
            let perm_str: Option<String> = r.get(5)?;
            let permission_mode = perm_str.map(|s| match s.as_str() {
                "readOnly" => PermissionMode::ReadOnly,
                "auto" => PermissionMode::Auto,
                _ => PermissionMode::OnRequest,
            });
            Ok(QueuedMessage {
                id: r.get(0)?,
                chat_id: r.get(1)?,
                content: r.get(2)?,
                model: r.get(3)?,
                reasoning_effort: r.get(4)?,
                permission_mode,
                sequence: r.get(6)?,
                created_at: r.get(7)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_queued_message(&self, queue_id: &str) -> Result<Option<QueuedMessage>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, chat_id, content, model, reasoning_effort, permission_mode, sequence, created_at
             FROM queued_messages WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![queue_id], |r| {
            let perm_str: Option<String> = r.get(5)?;
            let permission_mode = perm_str.map(|s| match s.as_str() {
                "readOnly" => PermissionMode::ReadOnly,
                "auto" => PermissionMode::Auto,
                _ => PermissionMode::OnRequest,
            });
            Ok(QueuedMessage {
                id: r.get(0)?,
                chat_id: r.get(1)?,
                content: r.get(2)?,
                model: r.get(3)?,
                reasoning_effort: r.get(4)?,
                permission_mode,
                sequence: r.get(6)?,
                created_at: r.get(7)?,
            })
        })?;
        if let Some(r) = rows.next() {
            Ok(Some(r?))
        } else {
            Ok(None)
        }
    }

    pub fn add_queued_message(
        &self,
        chat_id: &str,
        content: &str,
        model: Option<&str>,
        reasoning_effort: Option<&str>,
        permission_mode: Option<PermissionMode>,
    ) -> Result<QueuedMessage> {
        let conn = self.db.conn();
        let id = nanoid::nanoid!(16);
        let now = chrono_now();
        let max_seq: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sequence), 0) FROM queued_messages WHERE chat_id = ?1",
                params![chat_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let sequence = max_seq + 1;
        let perm_str = permission_mode.map(|p| match p {
            PermissionMode::ReadOnly => "readOnly",
            PermissionMode::Auto => "auto",
            PermissionMode::OnRequest => "onRequest",
        });

        conn.execute(
            "INSERT INTO queued_messages (id, chat_id, content, model, reasoning_effort, permission_mode, sequence, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, chat_id, content, model, reasoning_effort, perm_str, sequence, now],
        )?;

        Ok(QueuedMessage {
            id,
            chat_id: chat_id.to_string(),
            content: content.to_string(),
            model: model.map(String::from),
            reasoning_effort: reasoning_effort.map(String::from),
            permission_mode,
            sequence,
            created_at: now,
        })
    }

    pub fn remove_queued_message(&self, queue_id: &str) -> Result<bool> {
        let conn = self.db.conn();
        let rows = conn.execute(
            "DELETE FROM queued_messages WHERE id = ?1",
            params![queue_id],
        )?;
        Ok(rows > 0)
    }

    pub fn update_queued_message(&self, queue_id: &str, content: &str) -> Result<bool> {
        let conn = self.db.conn();
        let rows = conn.execute(
            "UPDATE queued_messages SET content = ?1 WHERE id = ?2",
            params![content, queue_id],
        )?;
        Ok(rows > 0)
    }

    pub fn pop_next_queued_message(&self, chat_id: &str) -> Result<Option<QueuedMessage>> {
        let conn = self.db.conn();
        let next_item = {
            let mut stmt = conn.prepare(
                "SELECT id, chat_id, content, model, reasoning_effort, permission_mode, sequence, created_at
                 FROM queued_messages WHERE chat_id = ?1 ORDER BY sequence ASC, created_at ASC LIMIT 1"
            )?;
            let mut rows = stmt.query_map(params![chat_id], |r| {
                let perm_str: Option<String> = r.get(5)?;
                let permission_mode = perm_str.map(|s| match s.as_str() {
                    "readOnly" => PermissionMode::ReadOnly,
                    "auto" => PermissionMode::Auto,
                    _ => PermissionMode::OnRequest,
                });
                Ok(QueuedMessage {
                    id: r.get(0)?,
                    chat_id: r.get(1)?,
                    content: r.get(2)?,
                    model: r.get(3)?,
                    reasoning_effort: r.get(4)?,
                    permission_mode,
                    sequence: r.get(6)?,
                    created_at: r.get(7)?,
                })
            })?;
            if let Some(r) = rows.next() {
                Some(r?)
            } else {
                None
            }
        };

        if let Some(ref item) = next_item {
            conn.execute("DELETE FROM queued_messages WHERE id = ?1", params![item.id])?;
        }

        Ok(next_item)
    }
}

fn map_chat_row(r: &rusqlite::Row) -> rusqlite::Result<Chat> {
    let kind_str: String = r.get(4)?;
    let status_str: String = r.get(5)?;
    let kind = match kind_str.as_str() {
        "standalone" => ChatKind::Standalone,
        _ => ChatKind::Workspace,
    };
    let status = match status_str.as_str() {
        "running" => ChatStatus::Running,
        "awaiting_approval" => ChatStatus::AwaitingApproval,
        "error" => ChatStatus::Error,
        _ => ChatStatus::Idle,
    };

    let perm_str: String = r.get(9).unwrap_or_else(|_| "onRequest".to_string());
    let permission_mode = match perm_str.as_str() {
        "readOnly" => PermissionMode::ReadOnly,
        "auto" => PermissionMode::Auto,
        _ => PermissionMode::OnRequest,
    };

    Ok(Chat {
        id: r.get(0)?,
        workspace_id: r.get(1)?,
        title: r.get(2)?,
        provider_id: r.get(3)?,
        kind,
        status,
        permission_mode,
        external_thread_id: r.get(6)?,
        created_at: r.get(7)?,
        updated_at: r.get(8)?,
    })
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
