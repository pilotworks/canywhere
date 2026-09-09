use std::path::Path;
use anyhow::{Context, Result};
use canywhere_protocol::models::{GitBranchesResult, GitCommitItem, GitFileChange, GitStatusResult};
use tokio::process::Command;

pub struct GitService;

impl GitService {
    pub async fn is_repo(root: &Path) -> bool {
        let output = Command::new("git")
            .arg("rev-parse")
            .arg("--is-inside-work-tree")
            .current_dir(root)
            .output()
            .await;

        match output {
            Ok(out) => out.status.success() && String::from_utf8_lossy(&out.stdout).trim() == "true",
            Err(_) => false,
        }
    }

    pub async fn status(root: &Path) -> Result<GitStatusResult> {
        if !Self::is_repo(root).await {
            return Ok(GitStatusResult {
                is_repo: false,
                branch: String::new(),
                ahead: 0,
                behind: 0,
                staged: Vec::new(),
                unstaged: Vec::new(),
            });
        }

        // 1. Current branch
        let branch_out = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to get current git branch")?;

        let mut branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();
        if branch.is_empty() {
            // Fallback for detached HEAD
            let head_out = Command::new("git")
                .args(["rev-parse", "--short", "HEAD"])
                .current_dir(root)
                .output()
                .await;
            if let Ok(h) = head_out {
                branch = format!("HEAD ({})", String::from_utf8_lossy(&h.stdout).trim());
            }
        }

        // 2. Porcelain status with branch ahead/behind
        let status_out = Command::new("git")
            .args(["status", "--porcelain=v1", "-uall", "-b"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to get git status")?;

        let status_str = String::from_utf8_lossy(&status_out.stdout);
        let mut ahead = 0;
        let mut behind = 0;
        let mut staged = Vec::new();
        let mut unstaged = Vec::new();

        for line in status_str.lines() {
            if line.starts_with("## ") {
                // e.g. ## main...origin/main [ahead 1, behind 2]
                if let Some(bracket) = line.find('[') {
                    let info = &line[bracket..];
                    if let Some(a_pos) = info.find("ahead ") {
                        let num_str: String = info[a_pos + 6..]
                            .chars()
                            .take_while(|c| c.is_ascii_digit())
                            .collect();
                        ahead = num_str.parse().unwrap_or(0);
                    }
                    if let Some(b_pos) = info.find("behind ") {
                        let num_str: String = info[b_pos + 7..]
                            .chars()
                            .take_while(|c| c.is_ascii_digit())
                            .collect();
                        behind = num_str.parse().unwrap_or(0);
                    }
                }
                continue;
            }

            if line.len() < 4 {
                continue;
            }

            let x = line.chars().next().unwrap_or(' ');
            let y = line.chars().nth(1).unwrap_or(' ');
            let path_part = line[3..].trim();
            // In case of rename: "old -> new"
            let path = if let Some((_, new_p)) = path_part.split_once(" -> ") {
                new_p.trim().to_string()
            } else {
                path_part.to_string()
            };

            if x == '?' && y == '?' {
                unstaged.push(GitFileChange {
                    path,
                    status: "untracked".to_string(),
                });
            } else {
                if x != ' ' && x != '?' {
                    let status = match x {
                        'A' => "added",
                        'D' => "deleted",
                        'R' => "renamed",
                        _ => "modified",
                    };
                    staged.push(GitFileChange {
                        path: path.clone(),
                        status: status.to_string(),
                    });
                }
                if y != ' ' && y != '?' {
                    let status = match y {
                        'D' => "deleted",
                        _ => "modified",
                    };
                    unstaged.push(GitFileChange {
                        path,
                        status: status.to_string(),
                    });
                }
            }
        }

        Ok(GitStatusResult {
            is_repo: true,
            branch,
            ahead,
            behind,
            staged,
            unstaged,
        })
    }

    pub async fn diff(root: &Path, relative_path: Option<&str>, staged: bool) -> Result<String> {
        let mut cmd = Command::new("git");
        cmd.current_dir(root);

        if staged {
            cmd.args(["diff", "--cached"]);
            if let Some(p) = relative_path {
                cmd.args(["--", p]);
            }
        } else {
            cmd.arg("diff");
            if let Some(p) = relative_path {
                cmd.args(["--", p]);
            }
        }

        let output = cmd.output().await.context("Failed to run git diff")?;
        let diff_text = String::from_utf8_lossy(&output.stdout).to_string();

        if !diff_text.is_empty() || staged {
            return Ok(diff_text);
        }

        // If unstaged diff is empty and path is provided, it might be an untracked file
        if let Some(p) = relative_path {
            let file_full_path = root.join(p);
            if file_full_path.exists() && file_full_path.is_file() {
                let no_index_out = Command::new("git")
                    .args(["diff", "--no-index", "/dev/null", p])
                    .current_dir(root)
                    .output()
                    .await;
                if let Ok(out) = no_index_out {
                    let txt = String::from_utf8_lossy(&out.stdout).to_string();
                    if !txt.is_empty() {
                        return Ok(txt);
                    }
                }
            }
        }

        Ok(diff_text)
    }

    pub async fn stage(root: &Path, paths: &[String]) -> Result<()> {
        let mut cmd = Command::new("git");
        cmd.current_dir(root);
        cmd.arg("add");

        if paths.is_empty() || paths.iter().any(|p| p == ".") {
            cmd.arg("-A");
        } else {
            cmd.arg("--");
            for p in paths {
                cmd.arg(p);
            }
        }

        let output = cmd.output().await.context("Failed to run git add")?;
        if !output.status.success() {
            anyhow::bail!(
                "git add failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(())
    }

    pub async fn unstage(root: &Path, paths: &[String]) -> Result<()> {
        let mut cmd = Command::new("git");
        cmd.current_dir(root);
        cmd.args(["restore", "--staged"]);

        if paths.is_empty() || paths.iter().any(|p| p == ".") {
            cmd.arg(".");
        } else {
            cmd.arg("--");
            for p in paths {
                cmd.arg(p);
            }
        }

        let output = cmd.output().await.context("Failed to run git restore --staged")?;
        if !output.status.success() {
            // Fallback for older git versions: git reset HEAD --
            let mut fallback_cmd = Command::new("git");
            fallback_cmd.current_dir(root);
            fallback_cmd.args(["reset", "HEAD"]);
            if !paths.is_empty() && !paths.iter().any(|p| p == ".") {
                fallback_cmd.arg("--");
                for p in paths {
                    fallback_cmd.arg(p);
                }
            }
            let fb_out = fallback_cmd.output().await?;
            if !fb_out.status.success() {
                anyhow::bail!(
                    "git unstage failed: {}",
                    String::from_utf8_lossy(&fb_out.stderr)
                );
            }
        }
        Ok(())
    }

    pub async fn discard(root: &Path, paths: &[String]) -> Result<()> {
        if paths.is_empty() {
            return Ok(());
        }

        // 1. git restore
        let mut restore_cmd = Command::new("git");
        restore_cmd.current_dir(root).arg("restore");
        if paths.iter().any(|p| p == ".") {
            restore_cmd.arg(".");
        } else {
            restore_cmd.arg("--");
            for p in paths {
                restore_cmd.arg(p);
            }
        }
        let _ = restore_cmd.output().await;

        // 2. git clean -fd for untracked files
        let mut clean_cmd = Command::new("git");
        clean_cmd.current_dir(root).args(["clean", "-f", "-d"]);
        if paths.iter().any(|p| p == ".") {
            clean_cmd.arg(".");
        } else {
            clean_cmd.arg("--");
            for p in paths {
                clean_cmd.arg(p);
            }
        }
        let _ = clean_cmd.output().await;

        Ok(())
    }

    pub async fn commit(root: &Path, message: &str) -> Result<String> {
        let output = Command::new("git")
            .args(["commit", "-m", message])
            .current_dir(root)
            .output()
            .await
            .context("Failed to execute git commit")?;

        if !output.status.success() {
            anyhow::bail!(
                "git commit failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        let hash_out = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to get commit hash")?;

        Ok(String::from_utf8_lossy(&hash_out.stdout).trim().to_string())
    }

    pub async fn branches(root: &Path) -> Result<GitBranchesResult> {
        let current_out = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to get current branch")?;

        let current = String::from_utf8_lossy(&current_out.stdout).trim().to_string();

        let list_out = Command::new("git")
            .args(["branch", "--list", "--format=%(refname:short)"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to list branches")?;

        let branches = String::from_utf8_lossy(&list_out.stdout)
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(GitBranchesResult { current, branches })
    }

    pub async fn checkout(root: &Path, branch: &str, create_new: bool) -> Result<()> {
        let mut cmd = Command::new("git");
        cmd.current_dir(root);
        if create_new {
            cmd.args(["checkout", "-b", branch]);
        } else {
            cmd.args(["checkout", branch]);
        }

        let output = cmd.output().await.context("Failed to execute git checkout")?;
        if !output.status.success() {
            anyhow::bail!(
                "git checkout failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(())
    }

    pub async fn log(root: &Path, max_count: u32) -> Result<Vec<GitCommitItem>> {
        let limit_str = max_count.to_string();
        let output = Command::new("git")
            .args(["log", "-n", &limit_str, "--pretty=format:%H%x1f%h%x1f%an%x1f%ar%x1f%s"])
            .current_dir(root)
            .output()
            .await
            .context("Failed to get git log")?;

        let text = String::from_utf8_lossy(&output.stdout);
        let mut commits = Vec::new();

        for line in text.lines() {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() >= 5 {
                commits.push(GitCommitItem {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    author: parts[2].to_string(),
                    relative_time: parts[3].to_string(),
                    message: parts[4].to_string(),
                });
            }
        }

        Ok(commits)
    }

    pub async fn init(root: &Path) -> Result<()> {
        let output = Command::new("git")
            .arg("init")
            .current_dir(root)
            .output()
            .await
            .context("Failed to run git init")?;

        if !output.status.success() {
            anyhow::bail!(
                "git init failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(())
    }
}
