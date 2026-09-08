use anyhow::Result;
use rusqlite::params;
use serde_json::json;
use uuid::Uuid;

use canywhere_protocol::models::*;
use super::Database;

pub struct RepositoryManager {
    db: Database,
}

impl RepositoryManager {
    pub fn new(db: Database) -> Self {
        Self { db }
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

    // Chats
    pub fn list_chats(&self, workspace_id: Option<&str>) -> Result<Vec<Chat>> {
        let conn = self.db.conn();
        let mut list = Vec::new();

        if let Some(ws_id) = workspace_id {
            let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at FROM chats WHERE workspace_id = ?1 ORDER BY updated_at DESC")?;
            let rows = stmt.query_map(params![ws_id], map_chat_row)?;
            for r in rows { list.push(r?); }
        } else {
            let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at FROM chats ORDER BY updated_at DESC")?;
            let rows = stmt.query_map([], map_chat_row)?;
            for r in rows { list.push(r?); }
        }

        Ok(list)
    }

    pub fn get_chat(&self, id: &str) -> Result<Option<Chat>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id, workspace_id, title, provider_id, kind, status, thread_id, created_at, updated_at FROM chats WHERE id = ?1")?;
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

        conn.execute(
            "INSERT INTO chats (id, workspace_id, title, provider_id, kind, status, thread_id, scratch_dir, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'idle', NULL, ?6, ?7, ?8)",
            params![id, input.workspace_id, title, input.provider_id, kind_str, scratch_dir, now, now],
        )?;

        Ok(Chat {
            id,
            kind: input.kind,
            workspace_id: input.workspace_id,
            provider_id: input.provider_id,
            title,
            external_thread_id: None,
            status: ChatStatus::Idle,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_chat_status(&self, id: &str, status: ChatStatus, thread_id: Option<&str>) -> Result<()> {
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
                platform: if platform_str == "ios" { DevicePlatform::Ios } else { DevicePlatform::Desktop },
                paired_at: r.get(4)?,
                last_seen_at: r.get(5)?,
                last_transport: if transport_str == "tailscale" { DeviceTransport::Tailscale } else { DeviceTransport::Lan },
                revoked: revoked_int != 0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows { list.push(r?); }
        Ok(list)
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

    Ok(Chat {
        id: r.get(0)?,
        workspace_id: r.get(1)?,
        title: r.get(2)?,
        provider_id: r.get(3)?,
        kind,
        status,
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
