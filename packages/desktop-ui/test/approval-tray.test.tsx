import { describe, it, expect } from "bun:test";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { ApprovalTray } from "../src/components/chat/approval-tray";
import { ApprovalRequest } from "../src/types";

describe("ApprovalTray Component", () => {
  const mockCommandApproval: ApprovalRequest = {
    id: "app-1",
    chatId: "chat-1",
    turnId: "turn-1",
    externalRequestId: "ext-1",
    kind: "command",
    payload: {
      command: "cargo test --workspace",
      cwd: "/Users/dev/canywhere",
      reason: "Run unit test suite",
      diff: null,
      path: null,
      prompt: null,
      isHighRisk: false,
    },
    status: "pending",
    requestedAt: Date.now(),
    resolvedAt: null,
    resolvedByDeviceId: null,
    resolvedByDeviceName: null,
  };

  const mockHighRiskApproval: ApprovalRequest = {
    id: "app-2",
    chatId: "chat-1",
    turnId: "turn-1",
    externalRequestId: "ext-2",
    kind: "command",
    payload: {
      command: "rm -rf /tmp/test-dir",
      cwd: "/tmp",
      reason: "Clean temporary build cache",
      diff: null,
      path: null,
      prompt: null,
      isHighRisk: true,
    },
    status: "pending",
    requestedAt: Date.now(),
    resolvedAt: null,
    resolvedByDeviceId: null,
    resolvedByDeviceName: null,
  };

  const mockFileDiffApproval: ApprovalRequest = {
    id: "app-3",
    chatId: "chat-1",
    turnId: "turn-1",
    externalRequestId: "ext-3",
    kind: "file_change",
    payload: {
      command: null,
      cwd: null,
      reason: "Update configuration",
      diff: "--- old\n+++ new\n@@ -1,1 +1,1 @@\n-false\n+true",
      path: "src/config.json",
      prompt: null,
      isHighRisk: false,
    },
    status: "pending",
    requestedAt: Date.now(),
    resolvedAt: null,
    resolvedByDeviceId: null,
    resolvedByDeviceName: null,
  };

  it("returns null when approvals array is empty", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ApprovalTray chatId="chat-1" approvals={[]} />
    );
    expect(html).toBe("");
  });

  it("renders pending approvals with command and actions on the right", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ApprovalTray chatId="chat-1" approvals={[mockCommandApproval]} />
    );
    expect(html).toContain("Approval Required (1)");
    expect(html).toContain("cargo test --workspace");
    expect(html).toContain("Approve");
    expect(html).toContain("Decline");
    expect(html).toContain("Details");
  });

  it("displays HIGH RISK badge for destructive commands", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ApprovalTray chatId="chat-1" approvals={[mockHighRiskApproval]} />
    );
    expect(html).toContain("HIGH RISK");
    expect(html).toContain("rm -rf /tmp/test-dir");
  });

  it("renders file change approval with target path and details button", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ApprovalTray chatId="chat-1" approvals={[mockFileDiffApproval]} />
    );
    expect(html).toContain("src/config.json");
    expect(html).toContain("Details");
    expect(html).toContain("Approve");
    expect(html).toContain("Decline");
  });
});
