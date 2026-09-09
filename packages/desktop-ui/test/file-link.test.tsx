import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { parseFileLink, openFileInRightSidebar } from "../src/lib/file-link";
import { MarkdownContent } from "../src/components/chat/markdown-content";
import { useUiStore, useWorkspaceStore, useChatStore } from "../src/store/index";
import { client } from "../src/network/client";

describe("parseFileLink", () => {
  it("detects explicit file:// URLs with absolute path", () => {
    const result = parseFileLink("file:///Users/user/project/src/App.tsx");
    expect(result).not.toBeNull();
    expect(result?.isFile).toBe(true);
    expect(result?.cleanPath).toBe("/Users/user/project/src/App.tsx");
    expect(result?.fileName).toBe("App.tsx");
    expect(result?.lineRange).toBeUndefined();
  });

  it("extracts line ranges from #L10-L25 format", () => {
    const result = parseFileLink("file:///Users/user/project/src/App.tsx#L10-L25");
    expect(result).not.toBeNull();
    expect(result?.cleanPath).toBe("/Users/user/project/src/App.tsx");
    expect(result?.fileName).toBe("App.tsx");
    expect(result?.lineRange).toEqual({ start: 10, end: 25 });
  });

  it("extracts single line number from #L42 format", () => {
    const result = parseFileLink("file:///Users/user/project/src/App.tsx#L42");
    expect(result).not.toBeNull();
    expect(result?.lineRange).toEqual({ start: 42, end: undefined });
  });

  it("extracts line number from trailing colon :50 format", () => {
    const result = parseFileLink("src/components/chat/markdown-content.tsx:50");
    expect(result).not.toBeNull();
    expect(result?.cleanPath).toBe("src/components/chat/markdown-content.tsx");
    expect(result?.fileName).toBe("markdown-content.tsx");
    expect(result?.lineRange).toEqual({ start: 50 });
  });

  it("extracts line numbers from query param ?line=15&end=30", () => {
    const result = parseFileLink("file:///project/main.rs?line=15&end=30");
    expect(result).not.toBeNull();
    expect(result?.cleanPath).toBe("/project/main.rs");
    expect(result?.fileName).toBe("main.rs");
    expect(result?.lineRange).toEqual({ start: 15, end: 30 });
  });

  it("detects relative paths with file extensions", () => {
    const result = parseFileLink("src/components/layout/right-sidebar.tsx");
    expect(result).not.toBeNull();
    expect(result?.isFile).toBe(true);
    expect(result?.cleanPath).toBe("src/components/layout/right-sidebar.tsx");
    expect(result?.fileName).toBe("right-sidebar.tsx");
  });

  it("detects known extensionless files, taskfiles, licenses, and docs", () => {
    const filesToTest = [
      "Dockerfile",
      "Containerfile",
      "Makefile",
      "GNUmakefile",
      "Justfile",
      "justfile",
      "Procfile",
      "Gemfile",
      "Rakefile",
      "Brewfile",
      "Vagrantfile",
      "Tiltfile",
      "Caddyfile",
      "Jenkinsfile",
      "Fastfile",
      "Podfile",
      "Cartfile",
      "artisan",
      "gradlew",
      "mvnw",
      "LICENSE",
      "LICENCE",
      "COPYING",
      "README",
      "CHANGELOG",
      "CONTRIBUTING",
      "SECURITY",
      "CODE_OF_CONDUCT",
    ];

    for (const f of filesToTest) {
      const res = parseFileLink(f);
      expect(res).not.toBeNull();
      expect(res?.fileName).toBe(f);
    }
  });

  it("detects any valid dotfile regardless of extension", () => {
    const dotfiles = [
      ".gitignore",
      ".gitattributes",
      ".gitmodules",
      ".editorconfig",
      ".npmrc",
      ".yarnrc",
      ".nvmrc",
      ".node-version",
      ".tool-versions",
      ".zshrc",
      ".bashrc",
      ".profile",
      ".clang-format",
      ".env",
      ".env.local",
      ".env.production",
      ".dockerignore",
    ];

    for (const d of dotfiles) {
      const res = parseFileLink(d);
      expect(res).not.toBeNull();
      expect(res?.fileName).toBe(d);
    }
  });

  it("detects extensionless files in relative paths or scripts directories", () => {
    const paths = [
      "./run",
      "../deploy",
      "bin/server",
      "scripts/setup",
      "tools/codegen",
    ];

    for (const p of paths) {
      const res = parseFileLink(p);
      expect(res).not.toBeNull();
      expect(res?.isFile).toBe(true);
    }
  });

  it("handles Windows drive letter file URLs correctly", () => {
    const result = parseFileLink("file:///C:/Users/User/project/src/index.ts#L5");
    expect(result).not.toBeNull();
    expect(result?.cleanPath).toBe("C:/Users/User/project/src/index.ts");
    expect(result?.fileName).toBe("index.ts");
    expect(result?.lineRange).toEqual({ start: 5, end: undefined });
  });

  it("rejects external HTTP and HTTPS URLs", () => {
    expect(parseFileLink("https://github.com/facebook/react")).toBeNull();
    expect(parseFileLink("http://localhost:3000/api")).toBeNull();
  });

  it("rejects non-file protocols and pure page anchors", () => {
    expect(parseFileLink("mailto:test@example.com")).toBeNull();
    expect(parseFileLink("javascript:void(0)")).toBeNull();
    expect(parseFileLink("conversation://b53c60a6")).toBeNull();
    expect(parseFileLink("#section-2")).toBeNull();
  });
});

describe("MarkdownContent file link rendering", () => {
  it("renders file link with FileIcon, hover styling, and sidebar title", () => {
    const markdown = "Check [App.tsx](file:///workspace/packages/desktop-ui/src/App.tsx) for details.";
    const html = ReactDOMServer.renderToStaticMarkup(<MarkdownContent content={markdown} />);

    // File icon image
    expect(html).toContain("<img");
    expect(html).toContain("App.tsx");
    // Hover background class
    expect(html).toContain("hover:bg-[var(--secondary)]");
    // Title attribute for sidebar preview
    expect(html).toContain('title="Preview /workspace/packages/desktop-ui/src/App.tsx in right sidebar"');
  });

  it("renders line numbers badge when present in link anchor", () => {
    const markdown = "See [right-sidebar.tsx](file:///workspace/right-sidebar.tsx#L20-L40)";
    const html = ReactDOMServer.renderToStaticMarkup(<MarkdownContent content={markdown} />);

    expect(html).toContain("right-sidebar.tsx");
    expect(html).toContain(":20-40");
    expect(html).toContain('title="Preview /workspace/right-sidebar.tsx (line 20-40) in right sidebar"');
  });

  it("autolinks raw file:/// URLs in markdown text", () => {
    const markdown = "Open file:///workspace/Cargo.toml now.";
    const html = ReactDOMServer.renderToStaticMarkup(<MarkdownContent content={markdown} />);

    expect(html).toContain("<img");
    expect(html).toContain("Cargo.toml");
    expect(html).toContain("hover:bg-[var(--secondary)]");
  });

  it("leaves external web links as standard anchor tags without FileIcon", () => {
    const markdown = "Visit [GitHub](https://github.com) website.";
    const html = ReactDOMServer.renderToStaticMarkup(<MarkdownContent content={markdown} />);

    expect(html).toContain('href="https://github.com"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("Preview");
    expect(html).not.toContain("<img");
  });
});

describe("openFileInRightSidebar", () => {
  const DEFAULT_TABS = [
    { id: "fileTree", type: "fileTree" as const, title: "Files", isPermanent: true },
    { id: "git", type: "git" as const, title: "Git", isPermanent: true },
    { id: "terminal", type: "terminal" as const, title: "Terminal", isPermanent: true },
  ];

  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [
        {
          id: "ws-1",
          name: "canywhere",
          rootPath: "/Users/user/canywhere",
          subPaths: [],
          providerId: "codex",
          createdAt: BigInt(1),
          lastOpenedAt: BigInt(1),
        },
      ],
      activeWorkspaceId: "ws-1",
    });

    useUiStore.setState({
      rightSidebarOpen: false,
      rightSidebarTabs: DEFAULT_TABS,
      activeRightTabId: "fileTree",
    });
  });

  afterEach(() => {
    useUiStore.setState({
      rightSidebarTabs: DEFAULT_TABS,
      activeRightTabId: "fileTree",
    });
  });

  it("opens right sidebar and sets filePreview tab with content and line highlight", async () => {
    // Mock client.readWorkspaceFile
    client.readWorkspaceFile = async (_wsId: string, relPath: string) => {
      return {
        path: relPath,
        content: "const a = 1;\nconst b = 2;\nconst c = 3;\n",
        size: 36,
      };
    };

    const linkInfo = parseFileLink("file:///Users/user/canywhere/packages/desktop-ui/src/App.tsx#L2")!;
    expect(linkInfo).not.toBeNull();

    await openFileInRightSidebar(linkInfo);

    const uiState = useUiStore.getState();
    expect(uiState.rightSidebarOpen).toBe(true);
    expect(uiState.activeRightTabId).toBe("file:packages/desktop-ui/src/App.tsx");

    const activeTab = uiState.rightSidebarTabs.find((t) => t.id === uiState.activeRightTabId);
    expect(activeTab).toBeDefined();
    expect(activeTab?.type).toBe("filePreview");
    expect(activeTab?.title).toBe("App.tsx");
    expect(activeTab?.data?.content).toContain("const a = 1;");
    expect(activeTab?.data?.highlightLine).toEqual({ start: 2, end: undefined });
  });
});
