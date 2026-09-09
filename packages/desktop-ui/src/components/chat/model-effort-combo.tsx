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
    description: "Fast multi-turn problem solving",
    isDefault: false,
    supportedReasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "medium",
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

function formatEffortLabel(effort: string): string {
  if (!effort) return "None";
  if (effort.toLowerCase() === "extra_high") return "Extra High";
  return effort.charAt(0).toUpperCase() + effort.slice(1).toLowerCase();
}

export function ModelEffortCombo({
  models,
  selectedModel,
  selectedEffort,
  onSelectModel,
  onSelectEffort,
  size = "sm",
  className = "",
  align = "start",
}: ModelEffortComboProps) {
  const modelList = models && models.length > 0 ? models : DEFAULT_FALLBACK_MODELS;
  const activeModel = modelList.find((m) => m.model === selectedModel) || modelList[0];
  const activeModelDisplayName = activeModel?.displayName || activeModel?.model || "5.6 Luna";
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

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setView("main"); }}>
      <DropdownMenuTrigger
        className={`group flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] hover:bg-[var(--accent)] hover:border-[var(--ring)]/30 transition-all duration-150 cursor-pointer select-none font-mono outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] ${
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
        } ${className}`}
      >
        <span className="font-semibold text-blue-500 dark:text-blue-400">
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
        className="w-[260px] p-2 bg-[var(--popover)] text-[var(--popover-foreground)] border border-[var(--border)] rounded-2xl shadow-xl backdrop-blur-md z-50 select-none outline-none font-sans"
      >
        {view === "main" ? (
          /* Main Card View: Header with Effort > and Model, Reset button, and Stepped Slider */
          <div className="p-1 space-y-3">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <button
                type="button"
                onClick={() => setView("select_model")}
                className="flex flex-col text-left group/btn cursor-pointer outline-none"
              >
                <div className="flex items-center gap-1 text-[15px] font-medium text-blue-600 dark:text-blue-400 group-hover/btn:text-blue-500 transition-colors">
                  <span>{formattedEffort}</span>
                  <ChevronRight className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-[13px] text-[var(--muted-foreground)] font-normal mt-0.5 group-hover/btn:text-[var(--foreground)] transition-colors">
                  {activeModelDisplayName}
                </div>
              </button>

              {/* Reset to default icon */}
              <button
                type="button"
                onClick={handleResetDefault}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-lg transition-colors cursor-pointer"
                title="Reset to default effort"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Stepped Slider with filled progress track and circular thumb */}
            <div className="py-1">
              {supportedEfforts.length > 0 ? (
                <div className="relative flex items-center h-8">
                  {/* Track container with rounded pill ends */}
                  <div className="relative w-full h-[22px] bg-[var(--secondary)] border border-[var(--border)]/70 rounded-full flex items-center px-2.5">
                    {/* Active Progress Fill */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[#0070f3] rounded-full transition-all duration-150"
                      style={{
                        width:
                          steps.length <= 1
                            ? "100%"
                            : `calc(${(currentIndex / (steps.length - 1)) * 100}% + 11px)`,
                      }}
                    />

                    {/* Step tick points */}
                    <div className="relative w-full flex justify-between items-center z-10 pointer-events-none">
                      {steps.map((step, idx) => (
                        <div
                          key={step}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            idx <= currentIndex
                              ? "bg-white/50"
                              : "bg-[var(--muted-foreground)]/40"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Circular Thumb with drop shadow (NOT clipped by overflow) */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.35)] pointer-events-none transition-all duration-150 z-20"
                      style={{
                        left:
                          steps.length <= 1
                            ? "50%"
                            : `calc(${(currentIndex / (steps.length - 1)) * (100 - (22 / 240) * 100)}%)`,
                      }}
                    />

                    {/* Draggable / Clickable Stepped Range Input */}
                    <input
                      type="range"
                      min={0}
                      max={steps.length - 1}
                      step={1}
                      value={currentIndex}
                      onChange={(e) => {
                        const nextIdx = Number(e.target.value);
                        const nextEffort = steps[nextIdx];
                        if (nextEffort) {
                          onSelectEffort(nextEffort);
                        }
                      }}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-1 text-[11px] text-[var(--muted-foreground)]">
                  Reasoning effort not adjustable for this model
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Select Model View: Clean vertical list matching system tokens */
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setView("main")}
                className="p-1 -ml-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-[var(--muted-foreground)]">Select model</span>
              </div>
            </div>

            {/* Models list */}
            <div className="space-y-0.5 pt-1">
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
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent)] text-[var(--foreground)] font-medium"
                        : "hover:bg-[var(--accent)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="text-[13.5px]">
                      {m.displayName || m.model}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[var(--foreground)] shrink-0" />
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
