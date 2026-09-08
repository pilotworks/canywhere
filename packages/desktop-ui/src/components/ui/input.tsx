import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "default" | "sm" | "xs" | "lg";
  inputSize?: "default" | "sm" | "xs" | "lg";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "default", inputSize, ...props }, ref) => {
    const effectiveSize = inputSize || size;

    const sizeStyles = {
      default: "h-9 px-3 text-xs",
      sm: "h-8 px-2.5 text-xs",
      xs: "h-7 rounded-md px-2 text-[11px]",
      lg: "h-10 px-3.5 text-sm",
    };

    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-lg border border-[var(--input)] bg-[var(--background)] py-1 text-[var(--foreground)] shadow-xs transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
          sizeStyles[effectiveSize as keyof typeof sizeStyles] || sizeStyles.default,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
