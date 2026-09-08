import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "xs" | "lg" | "icon" | "icon-sm" | "icon-xs";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none active:scale-[0.98]";

    const variantStyles = {
      default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 shadow-xs",
      secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] border border-[var(--border)]",
      outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--secondary)] text-[var(--foreground)]",
      ghost: "hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
      destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-110 shadow-xs",
      link: "text-[var(--primary)] underline-offset-4 hover:underline",
    };

    const sizeStyles = {
      default: "h-9 px-3.5 text-xs",
      sm: "h-8 px-2.5 text-xs",
      xs: "h-7 rounded-md px-2 text-[11px]",
      lg: "h-10 px-4 text-sm",
      icon: "h-9 w-9 p-0",
      "icon-sm": "h-8 w-8 p-0 text-xs",
      "icon-xs": "h-7 w-7 rounded-md p-0 text-xs",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
