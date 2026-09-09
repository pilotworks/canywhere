import { describe, it, expect } from "vitest";
import { resolveFileIcon, resolveFolderIcon, getIconUrl } from "../index.js";

describe("vscode-icons resolution", () => {
  it("resolves specific file extensions accurately", () => {
    expect(resolveFileIcon("main.rs")).toBe("file_type_rust.svg");
    expect(resolveFileIcon("App.tsx")).toBe("file_type_reactts.svg");
    expect(resolveFileIcon("index.ts")).toBe("file_type_typescript.svg");
    expect(resolveFileIcon("index.js")).toBe("file_type_js.svg");
    expect(resolveFileIcon("script.py")).toBe("file_type_python.svg");
    expect(resolveFileIcon("style.css")).toBe("file_type_css.svg");
    expect(resolveFileIcon("README.md")).toBe("file_type_markdown.svg");
    expect(resolveFileIcon("config.json")).toBe("file_type_json.svg");
    expect(resolveFileIcon("Cargo.toml")).toBe("file_type_cargo.svg");
  });

  it("resolves exact filenames and special stems", () => {
    expect(resolveFileIcon("Dockerfile")).toBe("file_type_docker.svg");
    expect(resolveFileIcon(".gitignore")).toBe("file_type_git.svg");
    expect(resolveFileIcon("package.json")).toBe("file_type_npm.svg");
    expect(resolveFileIcon("AGENTS.md")).toBe("file_type_agents.svg");
    expect(resolveFileIcon("vite.config.ts")).toBe("file_type_vite.svg");
    expect(resolveFileIcon("Makefile")).toBe("file_type_gnu.svg");
  });

  it("resolves multi-part extensions", () => {
    expect(resolveFileIcon("app.test.ts")).toBe("file_type_testts.svg");
    expect(resolveFileIcon("types.d.ts")).toBe("file_type_typescriptdef.svg");
  });

  it("falls back to default_file.svg for unknown files", () => {
    expect(resolveFileIcon("something.unknownxyz123")).toBe("default_file.svg");
    expect(resolveFileIcon("")).toBe("default_file.svg");
  });

  it("resolves named folders when closed and open", () => {
    expect(resolveFolderIcon("src", false)).toBe("folder_type_src.svg");
    expect(resolveFolderIcon("src", true)).toBe("folder_type_src_opened.svg");
    expect(resolveFolderIcon("components", false)).toBe("folder_type_component.svg");
    expect(resolveFolderIcon("components", true)).toBe("folder_type_component_opened.svg");
  });

  it("falls back to default folder icons for unnamed folders", () => {
    expect(resolveFolderIcon("custom_random_folder", false)).toBe("default_folder.svg");
    expect(resolveFolderIcon("custom_random_folder", true)).toBe("default_folder_opened.svg");
    expect(resolveFolderIcon("", false)).toBe("default_folder.svg");
    expect(resolveFolderIcon("", true)).toBe("default_folder_opened.svg");
  });

  it("handles path strings with directory prefixes", () => {
    expect(resolveFileIcon("packages/desktop-ui/src/App.tsx")).toBe("file_type_reactts.svg");
    expect(resolveFolderIcon("crates/canywhere-server/src", false)).toBe("folder_type_src.svg");
  });

  it("builds correct icon URLs", () => {
    expect(getIconUrl("file_type_rust.svg")).toContain("icons/file_type_rust.svg");
  });
});
