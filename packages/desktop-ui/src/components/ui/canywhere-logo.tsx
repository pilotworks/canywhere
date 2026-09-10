import React from "react";

export interface CanywhereLogoProps {
  className?: string;
  size?: number | string;
  bracketColor?: string;
  accentColor?: string;
}

export const CanywhereLogo: React.FC<CanywhereLogoProps> = ({
  className = "",
  size = 20,
  bracketColor = "currentColor",
  accentColor = "#38BDF8",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      {/* Architectural Monospace C Bracket */}
      <path
        d="M 352 136 L 224 136 C 162.144 136 112 186.144 112 248 L 112 264 C 112 325.856 162.144 376 224 376 L 352 376"
        stroke={bracketColor}
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Outbound Forward Prompt Chevron */}
      <path
        d="M 288 200 L 344 256 L 288 312"
        stroke={accentColor}
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Remote Tether Beacon Node */}
      <circle cx="408" cy="256" r="22" fill={accentColor} />
    </svg>
  );
};
