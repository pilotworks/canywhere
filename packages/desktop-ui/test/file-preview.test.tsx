import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { detectLanguage, getLanguageLabel, tokenizeCode } from "../src/lib/shiki";
import { FilePreviewPane } from "../src/components/layout/file-preview-pane";
import { DiffPreviewPane } from "../src/components/layout/diff-preview-pane";

describe("Shiki Language Detection", () => {
  it("detects languages correctly from file extensions", () => {
    expect(detectLanguage("src/main.rs")).toBe("rust");
    expect(detectLanguage("components/App.tsx")).toBe("tsx");
    expect(detectLanguage("server.py")).toBe("python");
    expect(detectLanguage("main.go")).toBe("go");
    expect(detectLanguage("styles.css")).toBe("css");
    expect(detectLanguage("Cargo.toml")).toBe("toml");
    expect(detectLanguage("data.json")).toBe("json");
    expect(detectLanguage("query.sql")).toBe("sql");
    expect(detectLanguage("script.sh")).toBe("bash");
  });

  it("detects special filenames like Dockerfile and Makefile", () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("Makefile")).toBe("makefile");
    expect(detectLanguage("Justfile")).toBe("makefile");
    expect(detectLanguage("Gemfile")).toBe("ruby");
    expect(detectLanguage(".env")).toBe("bash");
  });

  it("detects direct language names and aliases", () => {
    expect(detectLanguage("typescript")).toBe("typescript");
    expect(detectLanguage("ts")).toBe("typescript");
    expect(detectLanguage("python")).toBe("python");
    expect(detectLanguage("py")).toBe("python");
    expect(detectLanguage("rust")).toBe("rust");
    expect(detectLanguage("rs")).toBe("rust");
    expect(detectLanguage("shell")).toBe("bash");
    expect(detectLanguage("sh")).toBe("bash");
    expect(detectLanguage("bash")).toBe("bash");
    expect(detectLanguage("c++")).toBe("cpp");
  });

  it("falls back to text for unknown extensions", () => {
    expect(detectLanguage("unknown.unrecognized123")).toBe("text");
  });

  it("returns human-readable labels", () => {
    expect(getLanguageLabel("rust")).toBe("Rust");
    expect(getLanguageLabel("typescript")).toBe("TypeScript");
    expect(getLanguageLabel("tsx")).toBe("TSX");
    expect(getLanguageLabel("python")).toBe("Python");
    expect(getLanguageLabel("json")).toBe("JSON");
    expect(getLanguageLabel("dockerfile")).toBe("Dockerfile");
  });
});

describe("Shiki Code Tokenization", () => {
  it("tokenizes code into colored tokens", async () => {
    const code = "fn main() {\n    println!(\"hello\");\n}";
    const tokens = await tokenizeCode(code, "rust", "dark");
    expect(tokens).not.toBeNull();
    expect(tokens?.length).toBe(3);

    // First line should have 'fn' keyword with color
    const firstLine = tokens?.[0];
    expect(firstLine).toBeDefined();
    const fnToken = firstLine?.find((t) => t.content === "fn");
    expect(fnToken).toBeDefined();
    expect(fnToken?.color).toBeDefined();
  });
});

describe("FilePreviewPane Component", () => {
  it("renders file header with path, language badge, line count and actions", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <FilePreviewPane
        path="src/main.rs"
        content={"fn main() {\n    println!(\"hello\");\n}"}
        highlightLine={{ start: 2 }}
      />
    );

    expect(html).toContain("src/main.rs");
    expect(html).toContain("Rust");
    expect(html).toContain("3 lines");
    expect(html).toContain("Line 2");
    expect(html).toContain("Wrap");
    expect(html).toContain("Copy");
    expect(html).toContain("id=\"preview-line-2\"");
    expect(html).toContain("border-amber-500");
  });
});

describe("DiffPreviewPane Component", () => {
  it("renders diff header with path, language badge, line count, and diff actions", () => {
    const patch = `--- a/src/main.rs\n+++ b/src/main.rs\n@@ -1,3 +1,3 @@\n-fn old() {}\n+fn new() {}\n fn main() {}`;
    const html = ReactDOMServer.renderToStaticMarkup(
      <DiffPreviewPane path="src/main.rs" patch={patch} />
    );

    expect(html).toContain("src/main.rs");
    expect(html).toContain("Rust");
    expect(html).toContain("+1");
    expect(html).toContain("-1");
    expect(html).toContain("File View");
    expect(html).toContain("Wrap");
    expect(html).toContain("Copy");
    expect(html).toContain("fn new() {}");
    expect(html).toContain("fn old() {}");
  });
});
