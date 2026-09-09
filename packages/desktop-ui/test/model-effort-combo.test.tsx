import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { ModelEffortCombo } from "../src/components/chat/model-effort-combo";
import { ModelInfo } from "../src/types/index";

describe("ModelEffortCombo", () => {
  const mockModels: ModelInfo[] = [
    {
      id: "gpt-5-codex",
      model: "gpt-5-codex",
      displayName: "5.6 Luna",
      description: "Frontier autonomous coding agent",
      isDefault: true,
      supportedReasoningEfforts: ["low", "medium", "high"],
      defaultReasoningEffort: "medium",
    },
    {
      id: "gpt-4o",
      model: "gpt-4o",
      displayName: "5.2",
      description: "Fast multimodal general intelligence",
      isDefault: false,
      supportedReasoningEfforts: [],
      defaultReasoningEffort: null,
    },
  ];

  it("renders trigger button with active model name and formatted effort", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ModelEffortCombo
        models={mockModels}
        selectedModel="gpt-5-codex"
        selectedEffort="high"
        onSelectModel={() => {}}
        onSelectEffort={() => {}}
        size="sm"
      />
    );

    expect(html).toContain("5.6 Luna");
    expect(html).toContain("High");
  });

  it("renders None when active model has no reasoning effort support", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ModelEffortCombo
        models={mockModels}
        selectedModel="gpt-4o"
        selectedEffort=""
        onSelectModel={() => {}}
        onSelectEffort={() => {}}
        size="sm"
      />
    );

    expect(html).toContain("5.2");
    expect(html).toContain("None");
  });

  it("renders default fallback models when models array is empty", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <ModelEffortCombo
        models={[]}
        selectedModel=""
        selectedEffort=""
        onSelectModel={() => {}}
        onSelectEffort={() => {}}
      />
    );

    expect(html).toContain("5.6 Luna");
    expect(html).toContain("Medium");
  });
});
