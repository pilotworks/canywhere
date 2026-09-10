import React from "react";
import { useProviderStore } from "../../store/index.js";

export interface ProviderLogoProps {
  providerId?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  providerId,
  className = "",
  size = "sm",
}) => {
  const providers = useProviderStore((s) => s.providers);
  const selectedProviderId = useProviderStore((s) => s.selectedProviderId);
  const effectiveId = providerId || selectedProviderId;
  const provider = providers.find((p) => p.id === effectiveId);

  const sizeClass =
    size === "xs"
      ? "w-3 h-3 min-w-[12px]"
      : size === "md"
      ? "w-4 h-4 min-w-[16px]"
      : size === "lg"
      ? "w-5 h-5 min-w-[20px]"
      : "w-3.5 h-3.5 min-w-[14px]";

  const iconUrl = provider?.icon || (effectiveId ? `/icons/provider_${effectiveId}.svg` : null);

  if (!iconUrl) {
    return (
      <span
        className={`shrink-0 inline-flex items-center justify-center select-none rounded bg-neutral-800 text-[10px] text-neutral-400 font-mono ${sizeClass} ${className}`}
        title={provider?.name || "Provider"}
      >
        {(provider?.name || "P").charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center select-none ${sizeClass} ${className}`}
      title={provider?.name || effectiveId || "Provider"}
    >
      <img
        src={iconUrl}
        alt={provider?.name || effectiveId || "Provider"}
        className="w-full h-full object-contain block"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = "none";
        }}
      />
    </span>
  );
};
