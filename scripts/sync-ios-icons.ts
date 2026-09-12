import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const manifestPath = path.resolve(rootDir, "packages/desktop-ui/src/lib/icons/theme-manifest.json");
const iconsSrcDir = path.resolve(rootDir, "packages/desktop-ui/public/icons");
const targetBaseDir = path.resolve(rootDir, "mobile/ios/Assets.xcassets/FileIcons");

if (!fs.existsSync(manifestPath)) {
  console.error(`Theme manifest not found at ${manifestPath}`);
  process.exit(1);
}

if (!fs.existsSync(iconsSrcDir)) {
  console.error(`Icons directory not found at ${iconsSrcDir}`);
  process.exit(1);
}

console.log("==> Reading theme manifest...");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
  defaultFile: string;
  defaultFolder?: string;
  defaultFolderOpened?: string;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesOpened?: Record<string, string>;
};

const stripExt = (s: string) => (s ? s.replace(/\.svg$/i, "") : s);

console.log("==> Preparing target directory:", targetBaseDir);
fs.mkdirSync(targetBaseDir, { recursive: true });

// Ensure top-level folder Contents.json does not namespace the asset names
fs.writeFileSync(
  path.join(targetBaseDir, "Contents.json"),
  JSON.stringify(
    {
      info: { author: "xcode", version: 1 },
      properties: { "provides-namespace": false },
    },
    null,
    2
  )
);

// Collect all unique icons referenced by the manifest
const allIcons = new Set<string>([
  manifest.defaultFile,
  ...Object.values(manifest.fileNames),
  ...Object.values(manifest.fileExtensions),
]);

console.log(`==> Copying ${allIcons.size} unique icons to iOS Asset Catalog...`);
let copiedCount = 0;
let missingCount = 0;

for (const iconFile of allIcons) {
  const srcPath = path.join(iconsSrcDir, iconFile);
  if (!fs.existsSync(srcPath)) {
    missingCount++;
    continue;
  }

  const baseName = stripExt(iconFile);
  const imagesetDir = path.join(targetBaseDir, `${baseName}.imageset`);
  fs.mkdirSync(imagesetDir, { recursive: true });

  const destSvgPath = path.join(imagesetDir, `${baseName}.svg`);
  fs.copyFileSync(srcPath, destSvgPath);

  const imagesetContents = {
    images: [
      {
        filename: `${baseName}.svg`,
        idiom: "universal",
      },
    ],
    info: { author: "xcode", version: 1 },
    properties: { "preserves-vector-representation": true },
  };

  fs.writeFileSync(
    path.join(imagesetDir, "Contents.json"),
    JSON.stringify(imagesetContents, null, 2)
  );
  copiedCount++;
}

console.log(`==> Copied ${copiedCount} icons (${missingCount} missing).`);

// Generate clean manifest for iOS (without .svg suffixes)
const iosFileNames: Record<string, string> = {};
for (const [k, v] of Object.entries(manifest.fileNames)) {
  iosFileNames[k] = stripExt(v);
}

const iosFileExtensions: Record<string, string> = {};
for (const [k, v] of Object.entries(manifest.fileExtensions)) {
  iosFileExtensions[k] = stripExt(v);
}

const iosManifest = {
  defaultFile: stripExt(manifest.defaultFile),
  fileNames: iosFileNames,
  fileExtensions: iosFileExtensions,
};

const datasetDir = path.join(targetBaseDir, "FileIconTheme.dataset");
fs.mkdirSync(datasetDir, { recursive: true });
fs.writeFileSync(
  path.join(datasetDir, "manifest.json"),
  JSON.stringify(iosManifest)
);
fs.writeFileSync(
  path.join(datasetDir, "Contents.json"),
  JSON.stringify(
    {
      data: [{ filename: "manifest.json", idiom: "universal" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2
  )
);

console.log("==> Successfully generated FileIconTheme.dataset for iOS runtime.");
