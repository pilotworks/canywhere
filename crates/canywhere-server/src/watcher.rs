use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc, Mutex};
use tracing::{debug, info, warn};

use crate::adapters::AgentEvent;
use canywhere_protocol::models::Workspace;

/// Directories and files to strictly ignore to avoid event floods
fn is_ignored_path(path: &Path) -> bool {
    for component in path.components() {
        if let std::path::Component::Normal(c) = component {
            let name = c.to_string_lossy();
            if name == ".git"
                || name == ".DS_Store"
                || name == "node_modules"
                || name == "target"
                || name == "dist"
                || name == ".next"
                || name == "build"
                || name == "gen"
                || name == ".turbo"
                || name == ".cache"
            {
                return true;
            }
        }
    }
    false
}

pub struct WorkspaceWatcherService {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
    /// Map of canonical root path -> workspace ID
    watched_workspaces: Arc<Mutex<HashMap<PathBuf, String>>>,
}

impl WorkspaceWatcherService {
    pub fn new(
        event_tx: broadcast::Sender<AgentEvent>,
    ) -> (Self, mpsc::UnboundedSender<Result<Event, notify::Error>>) {
        let (raw_tx, mut raw_rx) = mpsc::unbounded_channel::<Result<Event, notify::Error>>();
        let watched_workspaces: Arc<Mutex<HashMap<PathBuf, String>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let watched_clone = Arc::clone(&watched_workspaces);
        let event_tx_clone = event_tx.clone();

        // Spawn debouncing and event processing task
        tokio::spawn(async move {
            let mut pending_changes: HashMap<String, HashSet<String>> = HashMap::new();
            let debounce_duration = Duration::from_millis(200);

            loop {
                // Wait for either a new raw event or debounce flush timeout
                let timeout_fut = async {
                    if pending_changes.is_empty() {
                        futures_util::future::pending::<()>().await;
                    } else {
                        tokio::time::sleep(debounce_duration).await;
                    }
                };

                tokio::select! {
                    Some(res) = raw_rx.recv() => {
                        match res {
                            Ok(event) => {
                                for path in event.paths {
                                    if is_ignored_path(&path) {
                                        continue;
                                    }

                                    // Find which workspace owns this path
                                    let map = watched_clone.lock().await;
                                    let mut matched_ws = None;
                                    for (root, ws_id) in map.iter() {
                                        if path.starts_with(root) {
                                            let rel = path
                                                .strip_prefix(root)
                                                .unwrap_or_else(|_| path.as_path())
                                                .to_string_lossy()
                                                .to_string();
                                            matched_ws = Some((ws_id.clone(), rel));
                                            break;
                                        }
                                    }
                                    drop(map);

                                    if let Some((ws_id, rel_path)) = matched_ws {
                                        pending_changes
                                            .entry(ws_id)
                                            .or_default()
                                            .insert(rel_path);
                                    }
                                }
                            }
                            Err(e) => {
                                warn!("⚠️ [WorkspaceWatcher] Notify error: {}", e);
                            }
                        }
                    }
                    _ = timeout_fut => {
                        // Flush debounced pending changes
                        for (ws_id, paths) in pending_changes.drain() {
                            let path_list: Vec<String> = paths.into_iter().collect();
                            debug!(
                                "🔄 [WorkspaceWatcher] Emitting filesChanged for ws {}: {} files",
                                ws_id,
                                path_list.len()
                            );
                            let _ = event_tx_clone.send(AgentEvent::WorkspaceFilesChanged {
                                workspace_id: ws_id,
                                paths: path_list,
                            });
                        }
                    }
                }
            }
        });

        (
            Self {
                watcher: Arc::new(Mutex::new(None)),
                watched_workspaces,
            },
            raw_tx,
        )
    }

    pub async fn init_watcher(
        &self,
        raw_tx: mpsc::UnboundedSender<Result<Event, notify::Error>>,
    ) -> anyhow::Result<()> {
        let watcher = RecommendedWatcher::new(
            move |res| {
                let _ = raw_tx.send(res);
            },
            Config::default(),
        )?;
        let mut lock = self.watcher.lock().await;
        *lock = Some(watcher);
        Ok(())
    }

    pub async fn watch_workspace(&self, workspace: &Workspace) {
        let root = PathBuf::from(&workspace.root_path);
        let canonical_root = match root.canonicalize() {
            Ok(p) => p,
            Err(_) => root.clone(),
        };

        let mut lock = self.watcher.lock().await;
        if let Some(watcher) = lock.as_mut() {
            match watcher.watch(&canonical_root, RecursiveMode::Recursive) {
                Ok(_) => {
                    let mut map = self.watched_workspaces.lock().await;
                    map.insert(canonical_root.clone(), workspace.id.clone());
                    info!(
                        "👀 [WorkspaceWatcher] Watching workspace {} at {}",
                        workspace.id,
                        canonical_root.display()
                    );
                }
                Err(e) => {
                    warn!(
                        "⚠️ [WorkspaceWatcher] Could not watch path {}: {}",
                        canonical_root.display(),
                        e
                    );
                }
            }
        }
    }

    pub async fn unwatch_workspace(&self, root_path: &str) {
        let root = PathBuf::from(root_path);
        let canonical_root = match root.canonicalize() {
            Ok(p) => p,
            Err(_) => root,
        };

        let mut lock = self.watcher.lock().await;
        if let Some(watcher) = lock.as_mut() {
            let _ = watcher.unwatch(&canonical_root);
        }
        let mut map = self.watched_workspaces.lock().await;
        map.remove(&canonical_root);
        info!(
            "🛑 [WorkspaceWatcher] Unwatched path: {}",
            canonical_root.display()
        );
    }

    pub async fn sync_workspaces(&self, workspaces: &[Workspace]) {
        let current_ids: HashSet<&str> = workspaces.iter().map(|w| w.id.as_str()).collect();

        // Remove obsolete watches
        let existing_paths: Vec<(PathBuf, String)> = {
            let map = self.watched_workspaces.lock().await;
            map.iter().map(|(p, id)| (p.clone(), id.clone())).collect()
        };

        for (path, ws_id) in existing_paths {
            if !current_ids.contains(ws_id.as_str()) {
                self.unwatch_workspace(&path.to_string_lossy()).await;
            }
        }

        // Add new watches
        for ws in workspaces {
            let root = PathBuf::from(&ws.root_path);
            let canonical_root = match root.canonicalize() {
                Ok(p) => p,
                Err(_) => root,
            };
            let already_watched = {
                let map = self.watched_workspaces.lock().await;
                map.contains_key(&canonical_root)
            };
            if !already_watched && canonical_root.exists() {
                self.watch_workspace(ws).await;
            }
        }
    }
}
