import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GitBranch,
  RotateCw,
  Plus,
  Minus,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  History,
  GitCommit,
  FolderGit2,
  Loader2,
  AlertCircle,
  Eye,
  Sparkles,
} from "lucide-react";
import { client } from "../../network/client.js";
import { useUiStore, useWorkspaceStore } from "../../store/index.js";
import { GitStatusResult, GitFileChange, GitCommitItem } from "../../types/index.js";
import { FileIcon } from "../ui/file-icon.js";
import { Button } from "../ui/button.js";

interface GitViewProps {
  workspaceId?: string | null;
}

export const GitView: React.FC<GitViewProps> = ({ workspaceId }) => {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const currentWsId = workspaceId || activeWorkspaceId;

  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [generatingCommitMsg, setGeneratingCommitMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-resize commit textarea (initial height fits 1 text line)
  const commitTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = commitTextareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [commitMessage]);

  // Branch switcher state
  const [branches, setBranches] = useState<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // Collapsible sections
  const [stagedOpen, setStagedOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Action loading indicator per path
  const [activeActionPath, setActiveActionPath] = useState<string | null>(null);

  const openOrFocusTab = useUiStore((s) => s.openOrFocusTab);

  const refreshStatus = useCallback(async () => {
    if (!currentWsId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await client.gitStatus(currentWsId);
      setStatus(res);
      if (res.isRepo) {
        // Also fetch branches
        try {
          const branchRes = await client.gitBranches(currentWsId);
          setBranches(branchRes.branches);
        } catch {}
      }
    } catch (err: any) {
      console.error("[GitView] Failed to fetch git status:", err);
      setErrorMsg(err.message || "Failed to load Git status");
    } finally {
      setLoading(false);
    }
  }, [currentWsId]);

  const loadCommits = useCallback(async () => {
    if (!currentWsId) return;
    setLoadingCommits(true);
    try {
      const logRes = await client.gitLog(currentWsId, 15);
      setCommits(logRes.commits);
    } catch (err: any) {
      console.error("[GitView] Failed to fetch git log:", err);
    } finally {
      setLoadingCommits(false);
    }
  }, [currentWsId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (logOpen && commits.length === 0) {
      loadCommits();
    }
  }, [logOpen, loadCommits, commits.length]);

  // Stage single or all
  const handleStage = async (paths: string[]) => {
    if (!currentWsId) return;
    setActiveActionPath(paths.length === 1 ? paths[0] : "all");
    try {
      const res = await client.gitStage(currentWsId, paths);
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to stage files");
    } finally {
      setActiveActionPath(null);
    }
  };

  // Unstage single or all
  const handleUnstage = async (paths: string[]) => {
    if (!currentWsId) return;
    setActiveActionPath(paths.length === 1 ? paths[0] : "all");
    try {
      const res = await client.gitUnstage(currentWsId, paths);
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to unstage files");
    } finally {
      setActiveActionPath(null);
    }
  };

  // Discard changes
  const handleDiscard = async (paths: string[]) => {
    if (!currentWsId) return;
    const confirmMsg =
      paths.length === 1
        ? `Are you sure you want to discard changes in ${paths[0]}?`
        : "Are you sure you want to discard all working directory changes?";
    if (!window.confirm(confirmMsg)) return;

    setActiveActionPath(paths.length === 1 ? paths[0] : "all");
    try {
      const res = await client.gitDiscard(currentWsId, paths);
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to discard changes");
    } finally {
      setActiveActionPath(null);
    }
  };

  // Commit
  const handleCommit = async () => {
    if (!currentWsId || !commitMessage.trim()) return;
    setCommitting(true);
    setErrorMsg(null);
    try {
      // If nothing staged but unstaged files exist, auto-stage all
      if (status && status.staged.length === 0 && status.unstaged.length > 0) {
        await client.gitStage(currentWsId, ["."]);
      }
      await client.gitCommit(currentWsId, commitMessage.trim());
      setCommitMessage("");
      await refreshStatus();
      if (logOpen) {
        loadCommits();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  // Generate Commit Message
  const handleGenerateCommitMsg = async () => {
    if (!currentWsId || generatingCommitMsg) return;
    setGeneratingCommitMsg(true);
    setErrorMsg(null);
    try {
      const res = await client.gitGenerateCommitMessage(currentWsId);
      if (res?.message) {
        setCommitMessage(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate commit message");
    } finally {
      setGeneratingCommitMsg(false);
    }
  };

  // Open Diff in Right Sidebar
  const handleOpenFileDiff = async (file: GitFileChange, staged: boolean) => {
    if (!currentWsId) return;
    try {
      const res = await client.gitDiff(currentWsId, file.path, staged);
      openOrFocusTab({
        id: `diff:${file.path}:${staged ? "staged" : "working"}`,
        type: "diff",
        title: `${file.path.split("/").pop()} (${staged ? "Staged" : "Diff"})`,
        data: {
          patch: res.diff,
          filePath: file.path,
          workspaceId: currentWsId,
        },
      });
    } catch (err) {
      console.error("Failed to load diff", err);
    }
  };

  // Switch Branch
  const handleCheckoutBranch = async (branchName: string, createNew: boolean = false) => {
    if (!currentWsId) return;
    try {
      setLoading(true);
      const res = await client.gitCheckout(currentWsId, branchName, createNew);
      setStatus(res);
      setShowBranchDropdown(false);
      setIsCreatingBranch(false);
      setNewBranchName("");
      const bRes = await client.gitBranches(currentWsId);
      setBranches(bRes.branches);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to checkout branch");
    } finally {
      setLoading(false);
    }
  };

  // Initialize Repo
  const handleInitRepo = async () => {
    if (!currentWsId) return;
    try {
      setLoading(true);
      const res = await client.gitInit(currentWsId);
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to init repo");
    } finally {
      setLoading(false);
    }
  };

  if (!currentWsId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center font-mono select-none">
        <FolderGit2 className="w-8 h-8 opacity-30 mb-2 text-[var(--foreground)]" />
        <p>No workspace selected.</p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 py-4 px-3 text-[11px] font-mono text-[var(--muted-foreground)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--foreground)]" />
        <span>Loading Git repository status...</span>
      </div>
    );
  }

  if (status && !status.isRepo) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--muted-foreground)] p-4 text-center font-mono select-none space-y-3">
        <FolderGit2 className="w-8 h-8 opacity-30 text-[var(--foreground)]" />
        <div>
          <p className="font-semibold text-[var(--foreground)]">Not a Git repository</p>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
            Initialize this workspace folder to start tracking changes.
          </p>
        </div>
        <Button
          size="xs"
          variant="outline"
          onClick={handleInitRepo}
          disabled={loading}
          className="gap-1.5 font-mono text-[11px]"
        >
          <GitBranch className="w-3 h-3 text-[var(--foreground)]" />
          <span>Initialize Git Repository</span>
        </Button>
      </div>
    );
  }

  const stagedCount = status?.staged.length || 0;
  const unstagedCount = status?.unstaged.length || 0;
  const totalChanges = stagedCount + unstagedCount;

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none font-mono text-xs">
      {/* Top Toolbar: Branch + Controls */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--secondary)]/40 flex items-center justify-between gap-2 shrink-0">
        {/* Branch selector button */}
        <div className="relative">
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--secondary)] text-[var(--foreground)] font-medium text-[11px] cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]"
            title="Switch branch"
          >
            <GitBranch className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0" />
            <span className="truncate max-w-[120px]">{status?.branch || "main"}</span>
            {Boolean(status?.ahead || status?.behind) && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--secondary)] border border-[var(--border)] text-[var(--muted-foreground)] font-mono font-bold">
                {status?.ahead ? `↑${status.ahead}` : ""}
                {status?.behind ? `↓${status.behind}` : ""}
              </span>
            )}
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {/* Branch dropdown popup */}
          {showBranchDropdown && (
            <div className="absolute top-full left-0 mt-1 w-52 rounded-md border border-[var(--border)] bg-[var(--card)] shadow-lg z-30 p-1.5 text-[11px] animate-in fade-in-0 duration-100">
              <div className="px-1.5 py-1 text-[10px] uppercase font-bold text-[var(--muted-foreground)] tracking-wider flex items-center justify-between">
                <span>Branches</span>
                <button
                  onClick={() => setIsCreatingBranch(!isCreatingBranch)}
                  className="text-[var(--foreground)] hover:text-[var(--muted-foreground)] cursor-pointer"
                  title="Create new branch"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {isCreatingBranch && (
                <div className="my-1.5 px-1 flex gap-1">
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="new-branch-name"
                    className="flex-1 bg-[var(--code-bg)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[10px] text-[var(--foreground)] outline-hidden focus:border-[var(--ring)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newBranchName.trim()) {
                        handleCheckoutBranch(newBranchName.trim(), true);
                      }
                    }}
                  />
                  <Button
                    size="xs"
                    className="px-1.5 py-0.5 text-[10px]"
                    disabled={!newBranchName.trim()}
                    onClick={() => handleCheckoutBranch(newBranchName.trim(), true)}
                  >
                    Create
                  </Button>
                </div>
              )}

              <div className="max-h-40 overflow-y-auto space-y-0.5 no-scrollbar">
                {branches.map((b) => {
                  const isCurrent = b === status?.branch;
                  return (
                    <div
                      key={b}
                      onClick={() => !isCurrent && handleCheckoutBranch(b, false)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-[var(--secondary)] font-semibold text-[var(--foreground)]"
                          : "hover:bg-[var(--secondary)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span className="truncate">{b}</span>
                      {isCurrent && <Check className="w-3 h-3 text-[var(--foreground)] shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Toolbar buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setLogOpen(!logOpen);
            }}
            className={`p-1 h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)] ${
              logOpen ? "bg-[var(--secondary)] text-[var(--foreground)]" : ""
            }`}
            title="Toggle Git History"
          >
            <History className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={refreshStatus}
            disabled={loading}
            className="p-1 h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Refresh Git status"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="m-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-all">{errorMsg}</span>
        </div>
      )}

      {/* Main Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 no-scrollbar">
        {/* Commit Composer Box */}
        <div className="space-y-1.5 bg-[var(--secondary)]/30 p-2 rounded-lg border border-[var(--border)]">
          <div className="relative">
            <textarea
              ref={commitTextareaRef}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (Cmd+Enter)..."
              rows={1}
              className="w-full bg-[var(--code-bg)] border border-[var(--border)] rounded px-2 py-1.5 pr-7 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-hidden focus:border-[var(--ring)] resize-none font-mono leading-normal min-h-[32px] max-h-[160px]"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && commitMessage.trim()) {
                  handleCommit();
                }
              }}
            />
            <button
              type="button"
              onClick={handleGenerateCommitMsg}
              disabled={generatingCommitMsg || totalChanges === 0}
              className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Generate commit message using Codex (matches recent commit format)"
            >
              {generatingCommitMsg ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
            </button>
          </div>

          <Button
            size="xs"
            onClick={handleCommit}
            disabled={committing || (!commitMessage.trim() && totalChanges === 0)}
            className="w-full justify-center gap-1.5 font-mono text-[11px]"
          >
            {committing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Committing...</span>
              </>
            ) : (
              <>
                <GitCommit className="w-3 h-3" />
                <span>
                  {stagedCount > 0
                    ? `Commit (${stagedCount} staged)`
                    : unstagedCount > 0
                    ? "Stage All & Commit"
                    : "Commit"}
                </span>
              </>
            )}
          </Button>
        </div>

        {/* 1. STAGED CHANGES SECTION */}
        <div className="space-y-1">
          <div className="flex items-center justify-between py-1 px-1 text-[11px] text-[var(--muted-foreground)]">
            <button
              onClick={() => setStagedOpen(!stagedOpen)}
              className="flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-[var(--foreground)] cursor-pointer"
            >
              {stagedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Staged Changes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
                {stagedCount}
              </span>
            </button>

            {stagedCount > 0 && (
              <button
                onClick={() => handleUnstage(["."])}
                className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100"
                title="Unstage all changes"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}
          </div>

          {stagedOpen && (
            <div className="space-y-0.5">
              {stagedCount === 0 ? (
                <div className="px-2 py-1 text-[10px] text-[var(--muted-foreground)] italic">
                  No staged changes.
                </div>
              ) : (
                status?.staged.map((file) => {
                  const isBusy = activeActionPath === file.path;
                  return (
                    <div
                      key={file.path}
                      onClick={() => handleOpenFileDiff(file, true)}
                      className="group flex items-center h-7 gap-1.5 px-2 rounded hover:bg-[var(--secondary)] cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-[11px]"
                    >
                      <FileIcon fileName={file.path} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1" title={file.path}>
                        {file.path}
                      </span>

                      {/* Hover action (unstage) + Permanent status indicator on the right */}
                      <div className="flex items-center gap-1 shrink-0 h-full">
                        {/* Hover action: unstage (takes 0 space when hidden) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnstage([file.path]);
                          }}
                          disabled={isBusy}
                          className={`p-0.5 rounded cursor-pointer hover:text-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity ${
                            isBusy ? "flex" : "hidden group-hover:flex"
                          }`}
                          title="Unstage change"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Minus className="w-3 h-3" />
                          )}
                        </button>

                        {/* Status indicator (M, A, D, R) - always visible at right edge */}
                        <span
                          className={`text-[9px] font-bold px-1 rounded flex items-center justify-center ${
                            file.status === "added"
                              ? "text-emerald-500/90 dark:text-emerald-400/90"
                              : file.status === "deleted"
                              ? "text-red-500/90 dark:text-red-400/90"
                              : file.status === "renamed"
                              ? "text-purple-400/90"
                              : "text-amber-500/90 dark:text-amber-400/90"
                          }`}
                        >
                          {file.status[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 2. WORKING DIRECTORY CHANGES SECTION */}
        <div className="space-y-1">
          <div className="flex items-center justify-between py-1 px-1 text-[11px] text-[var(--muted-foreground)]">
            <button
              onClick={() => setChangesOpen(!changesOpen)}
              className="flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-[var(--foreground)] cursor-pointer"
            >
              {changesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Changes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
                {unstagedCount}
              </span>
            </button>

            {unstagedCount > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDiscard(["."])}
                  className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100"
                  title="Discard all changes"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleStage(["."])}
                  className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100"
                  title="Stage all changes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {changesOpen && (
            <div className="space-y-0.5">
              {unstagedCount === 0 ? (
                <div className="px-2 py-1 text-[10px] text-[var(--muted-foreground)] italic">
                  Working tree clean.
                </div>
              ) : (
                status?.unstaged.map((file) => {
                  const isBusy = activeActionPath === file.path;
                  return (
                    <div
                      key={file.path}
                      onClick={() => handleOpenFileDiff(file, false)}
                      className="group flex items-center h-7 gap-1.5 px-2 rounded hover:bg-[var(--secondary)] cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors text-[11px]"
                    >
                      <FileIcon fileName={file.path} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1" title={file.path}>
                        {file.path}
                      </span>

                      {/* Hover actions (discard & stage) + Permanent status indicator on the right */}
                      <div className="flex items-center gap-1 shrink-0 h-full">
                        {/* Hover actions: discard & stage (takes 0 space when hidden) */}
                        <div className={`items-center gap-1 ${
                          isBusy ? "flex" : "hidden group-hover:flex"
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDiscard([file.path]);
                            }}
                            disabled={isBusy}
                            className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                            title="Discard changes"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStage([file.path]);
                            }}
                            disabled={isBusy}
                            className="hover:text-[var(--foreground)] p-0.5 rounded cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                            title="Stage change"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Status indicator (M, U, D) - always visible at right edge */}
                        <span
                          className={`text-[9px] font-bold px-1 rounded flex items-center justify-center ${
                            file.status === "untracked"
                              ? "text-emerald-500/90 dark:text-emerald-400/90"
                              : file.status === "deleted"
                              ? "text-red-500/90 dark:text-red-400/90"
                              : "text-amber-500/90 dark:text-amber-400/90"
                          }`}
                        >
                          {file.status === "untracked" ? "U" : file.status[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 3. RECENT COMMITS SECTION */}
        {logOpen && (
          <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between py-1 px-1 text-[11px] text-[var(--muted-foreground)]">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--foreground)]">
                <History className="w-3 h-3" />
                <span>Recent Commits</span>
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={loadCommits}
                disabled={loadingCommits}
                className="h-5 w-5 p-0"
              >
                <RotateCw className={`w-2.5 h-2.5 ${loadingCommits ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="space-y-1.5">
              {loadingCommits ? (
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading commit log...</span>
                </div>
              ) : commits.length === 0 ? (
                <div className="px-2 py-1 text-[10px] text-[var(--muted-foreground)] italic">
                  No commits found.
                </div>
              ) : (
                commits.map((c) => (
                  <div
                    key={c.hash}
                    className="p-1.5 rounded bg-[var(--secondary)]/30 border border-[var(--border)] space-y-1 text-[11px]"
                  >
                    <div className="font-semibold text-[var(--foreground)] line-clamp-2 leading-tight">
                      {c.message}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[var(--muted-foreground)]">
                      <span>{c.author} • {c.relativeTime}</span>
                      <span className="font-mono bg-[var(--secondary)] px-1 py-0.2 rounded text-[var(--foreground)]/80">
                        {c.shortHash}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
