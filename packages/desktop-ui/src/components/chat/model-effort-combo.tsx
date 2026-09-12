import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { ModelInfo } from "../../types/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

interface ModelEffortComboProps {
  models: ModelInfo[];
  selectedModel: string;
  selectedEffort: string;
  onSelectModel: (model: string) => void;
  onSelectEffort: (effort: string) => void;
  providerId?: string;
  size?: "sm" | "md";
  className?: string;
  align?: "start" | "end" | "center";
}

const DEFAULT_FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "gpt-5-codex",
    model: "gpt-5-codex",
    displayName: "5.6 Luna",
    description: "Frontier autonomous coding agent",
    isDefault: true,
    supportedReasoningEfforts: ["low", "medium", "high", "extra_high"],
    defaultReasoningEffort: "medium",
  },
  {
    id: "o3-mini",
    model: "o3-mini",
    displayName: "5.6 Sol",
    description: "High-speed reasoning & STEM analysis",
    isDefault: false,
    supportedReasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5-terra",
    model: "gpt-5-terra",
    displayName: "5.6 Terra",
    description: "Balanced reasoning & deep comprehension",
    isDefault: false,
    supportedReasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-6-astra",
    model: "gpt-6-astra",
    displayName: "6 Astra",
    description: "Next-gen flagship reasoning model",
    isDefault: false,
    supportedReasoningEfforts: ["low", "medium", "high", "extra_high"],
    defaultReasoningEffort: "medium",
  },
  {
    id: "gpt-5.5",
    model: "gpt-5.5",
    displayName: "5.5",
    description: "Fast multimodal intelligence",
    isDefault: false,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
  },
  {
    id: "gpt-5.2",
    model: "gpt-5.2",
    displayName: "5.2",
    description: "Lightweight, responsive assistant",
    isDefault: false,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
  },
];

const AGY_FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "gemini-3.8-flash",
    model: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    description: "Google frontier multimodal & reasoning model",
    isDefault: true,
    supportedReasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "high",
  },
  {
    id: "claude-sonnet-4-6",
    model: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    description: "Anthropic frontier reasoning model",
    isDefault: false,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
  },
  {
    id: "gpt-oss-120b",
    model: "gpt-oss-120b",
    displayName: "GPT-OSS 120B",
    description: "Open-weights frontier reasoning model",
    isDefault: false,
    supportedReasoningEfforts: ["medium"],
    defaultReasoningEffort: "medium",
  },
];

function formatEffortLabel(effort: string): string {
  if (!effort) return "None";
  if (effort.toLowerCase() === "extra_high") return "Extra High";
  return effort.charAt(0).toUpperCase() + effort.slice(1).toLowerCase();
}

export function getSliderStepPosition(
  currentIndex: number,
  totalSteps: number,
  thumbDiameter: number = 22
) {
  const thumbRadius = thumbDiameter / 2;
  const fraction =
    totalSteps <= 1 ? 0.5 : Math.max(0, Math.min(1, currentIndex / (totalSteps - 1)));
  const center =
    totalSteps <= 1
      ? "50%"
      : `calc(${thumbRadius}px + ${fraction * 100}% - ${fraction * thumbDiameter}px)`;
  const progressWidth =
    totalSteps <= 1
      ? "100%"
      : currentIndex >= totalSteps - 1
      ? "100%"
      : `calc(${thumbRadius}px + ${fraction * 100}% - ${fraction * thumbDiameter}px)`;

  return { fraction, center, progressWidth };
}

export function ModelEffortCombo({
  models,
  selectedModel,
  selectedEffort,
  onSelectModel,
  onSelectEffort,
  providerId,
  size = "sm",
  className = "",
  align = "start",
}: ModelEffortComboProps) {
  const fallbackList = providerId === "agy" ? AGY_FALLBACK_MODELS : DEFAULT_FALLBACK_MODELS;
  const modelList = models && models.length > 0 ? models : fallbackList;
  const activeModel = modelList.find((m) => m.model === selectedModel) || modelList[0];
  const activeModelDisplayName = activeModel?.displayName || activeModel?.model || (providerId === "agy" ? "Gemini 3.8 Flash" : "5.6 Luna");
  const supportedEfforts = activeModel?.supportedReasoningEfforts || [];

  // Determine current active effort
  const currentEffort =
    selectedEffort || activeModel?.defaultReasoningEffort || (supportedEfforts[0] ?? "");
  const formattedEffort = formatEffortLabel(currentEffort);

  // Sub-view: "main" (slider card) vs "select_model" (picker list)
  const [view, setView] = useState<"main" | "select_model">("main");

  // Determine slider steps based on current model's supported reasoning efforts
  const steps =
    supportedEfforts.length > 0
      ? supportedEfforts
      : ["none"];
  const currentIndex = Math.max(0, steps.indexOf(currentEffort));

  // Reset to default effort handler
  const handleResetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defEffort = activeModel?.defaultReasoningEffort || steps[Math.floor(steps.length / 2)] || steps[0];
    if (defEffort) {
      onSelectEffort(defEffort);
    }
  };

  const activeSliderPosition = getSliderStepPosition(currentIndex, steps.length, 22);

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setView("main"); }}>
      <DropdownMenuTrigger
        className={`group flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] hover:bg-[var(--accent)] hover:border-[var(--ring)]/30 transition-all duration-150 cursor-pointer select-none font-mono outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] ${
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
        } ${className}`}
      >
        <span className="font-semibold text-[var(--foreground)]">
          {formattedEffort}
        </span>
        <span className="text-[var(--border)]">·</span>
        <span className="text-[var(--foreground)] opacity-85 group-hover:opacity-100 transition-opacity">
          {activeModelDisplayName}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className="w-[240px] p-1.5 bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-md shadow-lg z-50 select-none outline-none font-mono"
      >
        {view === "main" ? (
          /* Main Card View: Header with Effort > and Model, Reset button, and Stepped Slider */
          <div className="p-1 space-y-2.5">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <button
                type="button"
                onClick={() => setView("select_model")}
                className="flex flex-col text-left group/btn cursor-pointer outline-none"
              >
                <div className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground)] transition-colors">
                  <span>{formattedEffort}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover/btn:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] font-normal mt-0.5 group-hover/btn:text-[var(--foreground)] transition-colors">
                  {activeModelDisplayName}
                </div>
              </button>

              {/* Reset to default icon */}
              <button
                type="button"
                onClick={handleResetDefault}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded transition-colors cursor-pointer"
                title="Reset to default effort"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stepped Slider with original line track and larger circular thumb */}
            <div className="py-0.5">
              {supportedEfforts.length > 0 ? (
                <div className="relative flex items-center h-7 select-none">
                  {/* Track line kept as original h-[20px] pill */}
                  <div className="relative w-full h-[20px] bg-[var(--secondary)] border border-[var(--border)]/70 rounded-full overflow-hidden flex items-center">
                    {/* Active Progress Fill */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[var(--foreground)]/25 dark:bg-white/25 transition-all duration-150"
                      style={{
                        width: activeSliderPosition.progressWidth,
                      }}
                    />
                  </div>

                  {/* Step tick points placed on track */}
                  <div className="absolute inset-0 pointer-events-none flex items-center">
                    {steps.map((step, idx) => {
                      const stepPos = getSliderStepPosition(idx, steps.length, 22);
                      return (
                        <div
                          key={step}
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-colors ${
                            idx <= currentIndex
                              ? "bg-white/70"
                              : "bg-[var(--muted-foreground)]/40"
                          }`}
                          style={{
                            left: stepPos.center,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Circular Thumb (subtly bigger than 20px line, w-[22px] h-[22px]) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[22px] h-[22px] bg-white rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)] border border-black/10 dark:border-white/20 pointer-events-none transition-all duration-150 z-20"
                    style={{
                      left: activeSliderPosition.center,
                    }}
                  />

                  {/* Draggable / Clickable Stepped Range Input */}
                  <input
                    type="range"
                    min={0}
                    max={steps.length - 1}
                    step={1}
                    value={currentIndex}
                    aria-label="Reasoning effort"
                    aria-valuetext={formatEffortLabel(steps[currentIndex] ?? "")}
                    onChange={(e) => {
                      const nextIdx = Number(e.target.value);
                      const nextEffort = steps[nextIdx];
                      if (nextEffort) {
                        onSelectEffort(nextEffort);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                  />
                </div>
              ) : (
                <div className="text-center py-1 text-[10px] text-[var(--muted-foreground)]">
                  Reasoning effort not adjustable for this model
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Select Model View: Clean vertical list matching system tokens */
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center gap-1.5 px-1 py-1 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setView("main")}
                className="p-1 -ml-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded hover:bg-[var(--secondary)] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Select model</span>
            </div>

            {/* Models list */}
            <div className="max-h-56 overflow-y-auto space-y-0.5 pt-0.5 no-scrollbar">
              {modelList.map((m) => {
                const isSelected =
                  selectedModel === m.model ||
                  (!selectedModel && m.isDefault);

                return (
                  <button
                    key={m.id || m.model}
                    type="button"
                    onClick={() => {
                      onSelectModel(m.model);
                      setView("main");
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? "bg-[var(--secondary)] text-[var(--foreground)] font-semibold"
                        : "hover:bg-[var(--secondary)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="truncate">
                      {m.displayName || m.model}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
