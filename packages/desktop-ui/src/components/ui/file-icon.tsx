import React, { useState } from "react";
import { resolveFileIcon, resolveFolderIcon, getIconUrl } from "../../lib/icons/index.js";

export interface FileIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fileName?: string | null;
  isDirectory?: boolean;
  isOpen?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  fileName = "",
  isDirectory = false,
  isOpen = false,
  className = "w-4 h-4",
  alt,
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const safeName = fileName || "";

  const iconName = isDirectory
    ? resolveFolderIcon(safeName, isOpen)
    : resolveFileIcon(safeName);

  const fallbackIconName = isDirectory
    ? isOpen
      ? "default_folder_opened.svg"
      : "default_folder.svg"
    : "default_file.svg";

  const src = getIconUrl(hasError ? fallbackIconName : iconName);

  return (
    <img
      src={src}
      alt={alt || safeName || (isDirectory ? "folder" : "file")}
      className={`inline-block shrink-0 select-none object-contain pointer-events-none ${className}`}
      loading="lazy"
      onError={() => {
        if (!hasError) {
          setHasError(true);
        }
      }}
      {...rest}
    />
  );
};
