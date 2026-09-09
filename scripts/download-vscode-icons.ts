import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicIconsDir = path.resolve(rootDir, "packages/desktop-ui/public/icons");
const iconsLibDir = path.resolve(rootDir, "packages/desktop-ui/src/lib/icons");
const tempZipPath = "/tmp/vscode-icons.zip";

async function main() {
  console.log("==> Ensuring target directories exist...");
  fs.mkdirSync(publicIconsDir, { recursive: true });
  fs.mkdirSync(iconsLibDir, { recursive: true });

  let downloadUrl = "https://github.com/vscode-icons/vscode-icons/releases/download/v12.19.0/vscode-icons-12.19.0.vsix";

  try {
    const res = await fetch("https://api.github.com/repos/vscode-icons/vscode-icons/releases/latest", {
      headers: { "User-Agent": "Canywhere-Icon-Downloader" },
    });
    if (res.ok) {
      const data = (await res.json()) as { assets?: Array<{ name: string; browser_download_url: string }> };
      const vsixAsset = data.assets?.find((a) => a.name.endsWith(".vsix"));
      if (vsixAsset?.browser_download_url) {
        downloadUrl = vsixAsset.browser_download_url;
      }
    }
  } catch {
    console.log("GitHub API request failed or rate limited, using fallback release URL:", downloadUrl);
  }

  if (!fs.existsSync(tempZipPath)) {
    console.log(`==> Downloading vscode-icons from: ${downloadUrl}`);
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download vsix: ${downloadRes.status} ${downloadRes.statusText}`);
    }
    const arrayBuffer = await downloadRes.arrayBuffer();
    fs.writeFileSync(tempZipPath, Buffer.from(arrayBuffer));
    console.log("==> Download complete, saved to", tempZipPath);
  } else {
    console.log("==> Using existing archive:", tempZipPath);
  }

  console.log("==> Extracting SVG icons to public/icons...");
  const tempExtractDir = "/tmp/vscode-icons-extracted";
  fs.mkdirSync(tempExtractDir, { recursive: true });

  const unzipProc = Bun.spawnSync([
    "unzip",
    "-q",
    "-o",
    tempZipPath,
    "extension/icons/*",
    "extension/dist/src/vsicons-icon-theme-zed.json",
    "-d",
    tempExtractDir,
  ]);
  if (unzipProc.exitCode !== 0) {
    throw new Error(`unzip failed: ${unzipProc.stderr.toString()}`);
  }

  const extractedIconsDir = path.join(tempExtractDir, "extension/icons");
  const svgFiles = fs.readdirSync(extractedIconsDir).filter((f) => f.endsWith(".svg"));
  for (const file of svgFiles) {
    fs.copyFileSync(path.join(extractedIconsDir, file), path.join(publicIconsDir, file));
  }
  console.log(`==> Copied ${svgFiles.length} SVG icons to ${publicIconsDir}`);

  console.log("==> Parsing theme manifest...");
  const manifestPath = path.join(tempExtractDir, "extension/dist/src/vsicons-icon-theme-zed.json");
  const zedData = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const theme = zedData.themes[0];

  const clean = (p: string) => p.replace("./icons/", "");

  const fileNames: Record<string, string> = {};
  for (const [stem, id] of Object.entries(theme.file_stems as Record<string, string>)) {
    const icon = (theme.file_icons as Record<string, { path: string }>)[id]?.path;
    if (icon) fileNames[stem.toLowerCase()] = clean(icon);
  }

  const fileExtensions: Record<string, string> = {};
  for (const [suffix, id] of Object.entries(theme.file_suffixes as Record<string, string>)) {
    const icon = (theme.file_icons as Record<string, { path: string }>)[id]?.path;
    if (icon) fileExtensions[suffix.toLowerCase()] = clean(icon);
  }

  // Ensure standard extensions match their primary language icon
  if (fs.existsSync(path.join(publicIconsDir, "file_type_css.svg"))) {
    fileExtensions["css"] = "file_type_css.svg";
  }

  const folderNames: Record<string, string> = {};
  const folderNamesOpened: Record<string, string> = {};
  for (const [name, paths] of Object.entries(
    theme.named_directory_icons as Record<string, { collapsed?: string; expanded?: string }>
  )) {
    if (paths.collapsed) folderNames[name.toLowerCase()] = clean(paths.collapsed);
    if (paths.expanded) folderNamesOpened[name.toLowerCase()] = clean(paths.expanded);
  }

  const finalManifest = {
    defaultFile: clean(theme.file_icons._file?.path || "./icons/default_file.svg"),
    defaultFolder: clean(theme.directory_icons.collapsed),
    defaultFolderOpened: clean(theme.directory_icons.expanded),
    fileNames,
    fileExtensions,
    folderNames,
    folderNamesOpened,
  };

  const manifestDest = path.join(iconsLibDir, "theme-manifest.json");
  fs.writeFileSync(manifestDest, JSON.stringify(finalManifest, null, 2), "utf-8");
  console.log(`==> Manifest generated successfully at ${manifestDest}`);
  console.log(`    File names mapped: ${Object.keys(fileNames).length}`);
  console.log(`    File extensions mapped: ${Object.keys(fileExtensions).length}`);
  console.log(`    Folder names mapped: ${Object.keys(folderNames).length}`);
}

main().catch((err) => {
  console.error("Error downloading vscode-icons:", err);
  process.exit(1);
});
