import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", ...props }) => {
  const base = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors select-none font-mono";

  const variants = {
    default: "bg-[var(--primary)] text-[var(--primary-foreground)]",
    secondary: "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]",
    outline: "border border-[var(--border)] text-[var(--muted-foreground)]",
    destructive: "bg-rose-950/40 text-rose-400 border border-rose-800/40",
    success: "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40",
    warning: "bg-amber-950/40 text-amber-400 border border-amber-800/40",
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
};
