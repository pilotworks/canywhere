import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { GitView } from "../src/components/layout/git-view";
import { useUiStore } from "../src/store";

describe("Git Tab & Right Sidebar GitView", () => {
  it("includes git in default right sidebar tabs", () => {
    const tabs = useUiStore.getState().rightSidebarTabs;
    const gitTab = tabs.find((t) => t.id === "git");
    expect(gitTab).toBeDefined();
    expect(gitTab?.type).toBe("git");
    expect(gitTab?.title).toBe("Git");
    expect(gitTab?.isPermanent).toBe(true);
  });

  it("renders empty state when no workspace is selected", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <GitView workspaceId={null} />
    );
    expect(html).toContain("No workspace selected");
  });

  it("allows switching active tab to git", () => {
    useUiStore.getState().setActiveRightTabId("git");
    expect(useUiStore.getState().activeRightTabId).toBe("git");
  });
});
