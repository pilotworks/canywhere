import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { useWorkspaceStore, useUiStore } from "../src/store/index.js";
import { FileTreeView, FileTreeNodeItem } from "../src/components/layout/file-tree-view.js";
import { FileTreeNode } from "../src/types/index";

describe("Workspace File Tree & Lazy Loading", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "Test Workspace",
          rootPath: "/path/to/test",
          subPaths: [],
          providerId: "codex",
          createdAt: 1000,
          lastOpenedAt: 1000,
        },
      ],
      activeWorkspaceId: "ws-1",
      fileTrees: {},
      fileTreeVersion: {},
      activeFile: null,
    });
    useUiStore.setState({
      rightSidebarTabs: [
        { id: "fileTree", type: "fileTree", title: "Files", isPermanent: true },
      ],
      activeRightTabId: "fileTree",
      rightSidebarOpen: true,
    });
  });

  it("increments fileTreeVersion when invalidateFileTree is called", () => {
    expect(useWorkspaceStore.getState().fileTreeVersion["ws-1"] || 0).toBe(0);
    useWorkspaceStore.getState().invalidateFileTree("ws-1");
    expect(useWorkspaceStore.getState().fileTreeVersion["ws-1"]).toBe(1);
    useWorkspaceStore.getState().invalidateFileTree("ws-1");
    expect(useWorkspaceStore.getState().fileTreeVersion["ws-1"]).toBe(2);
  });

  it("renders empty folder when children array is empty []", () => {
    const emptyFolderNode: FileTreeNode = {
      name: "empty_dir",
      path: "empty_dir",
      isDirectory: true,
      size: null,
      children: [],
    };

    const html = ReactDOMServer.renderToString(
      <FileTreeNodeItem
        node={emptyFolderNode}
        workspaceId="ws-1"
        depth={0}
        forceOpen={true}
      />
    );
    expect(html).toContain("empty_dir");
    expect(html).toContain("(empty)");
  });

  it("renders non-empty folders and their file children correctly", () => {
    const treeNode: FileTreeNode = {
      name: "components",
      path: "src/components",
      isDirectory: true,
      size: null,
      children: [
        {
          name: "button.tsx",
          path: "src/components/button.tsx",
          isDirectory: false,
          size: 1024,
          children: null,
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      <FileTreeNodeItem
        node={treeNode}
        workspaceId="ws-1"
        depth={0}
        forceOpen={true}
      />
    );
    expect(html).toContain("components");
    expect(html).toContain("button.tsx");
    expect(html).not.toContain("(empty)");
  });

  it("renders FileTreeView with search filter input and refresh button", () => {
    const rootNode: FileTreeNode = {
      name: "root",
      path: "",
      isDirectory: true,
      size: null,
      children: [
        {
          name: "src",
          path: "src",
          isDirectory: true,
          size: null,
          children: [
            {
              name: "index.ts",
              path: "src/index.ts",
              isDirectory: false,
              size: 512,
              children: null,
            },
          ],
        },
      ],
    };

    const html = ReactDOMServer.renderToString(
      <FileTreeView workspaceId="ws-1" />
    );
    expect(html).toContain("Filter files...");
    expect(html).toContain("Refresh files");
  });
});
