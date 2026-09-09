import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { ModelEffortCombo, getSliderStepPosition } from "../src/components/chat/model-effort-combo";
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

  describe("getSliderStepPosition calculations", () => {
    it("bounds thumb position and progress width at the beginning and end for 3 steps", () => {
      // Step 0 of 3 (low)
      const step0 = getSliderStepPosition(0, 3, 22);
      expect(step0.fraction).toBe(0);
      expect(step0.center).toBe("calc(11px + 0% - 0px)");
      expect(step0.progressWidth).toBe("calc(11px + 0% - 0px)");

      // Step 1 of 3 (medium)
      const step1 = getSliderStepPosition(1, 3, 22);
      expect(step1.fraction).toBe(0.5);
      expect(step1.center).toBe("calc(11px + 50% - 11px)");

      // Step 2 of 3 (high - last step)
      const step2 = getSliderStepPosition(2, 3, 22);
      expect(step2.fraction).toBe(1);
      expect(step2.center).toBe("calc(11px + 100% - 22px)");
      // Crucial: progress width must be capped at 100%, never overflowing
      expect(step2.progressWidth).toBe("100%");
    });

    it("bounds thumb position and progress width at the beginning and end for 4 steps", () => {
      // Step 3 of 4 (extra_high - last step)
      const step3 = getSliderStepPosition(3, 4, 22);
      expect(step3.fraction).toBe(1);
      expect(step3.center).toBe("calc(11px + 100% - 22px)");
      expect(step3.progressWidth).toBe("100%");
    });

    it("handles single-step or empty steps gracefully without division by zero", () => {
      const single = getSliderStepPosition(0, 1, 22);
      expect(single.fraction).toBe(0.5);
      expect(single.center).toBe("50%");
      expect(single.progressWidth).toBe("100%");
    });
  });
});
