import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  FileSearchPopup,
  SlashCommandPopup,
  CANYWHERE_SLASH_COMMANDS,
} from "../src/components/chat/composer-popups";
import { FuzzyFileMatchItem } from "../src/types/index";

describe("Composer Popups (@ and /)", () => {
  it("renders FileSearchPopup with file items, directories, and highlighted indices", () => {
    const mockFiles: FuzzyFileMatchItem[] = [
      {
        path: "src/server.ts",
        root: "/workspace",
        fileName: "server.ts",
        matchType: "file",
        score: 100,
        indices: [0, 1, 2], // "ser" highlighted
      },
      {
        path: "src/adapters",
        root: "/workspace",
        fileName: "adapters",
        matchType: "directory",
        score: 90,
        indices: [0, 1], // "ad" highlighted
      },
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      <FileSearchPopup
        files={mockFiles}
        selectedIndex={0}
        query="ser"
        isLoading={false}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("src/");
    expect(html).toContain("file");
    expect(html).toContain("dir");
    expect(html).toContain("text-emerald-400 font-bold underline"); // highlighted indices
    expect(html).toContain("Files in Workspace");
    expect(html).toContain("(@ser)");
  });

  it("renders FileSearchPopup empty state when no files found", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <FileSearchPopup
        files={[]}
        selectedIndex={0}
        query="nonexistent"
        isLoading={false}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("No matching files or directories found for &quot;@nonexistent&quot;");
  });

  it("renders FileSearchPopup guidance prompt when query is empty", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <FileSearchPopup
        files={[]}
        selectedIndex={0}
        query=""
        isLoading={false}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("Type to search files");
    expect(html).toContain("Enter a file or folder name to fuzzy match with Codex Nucleo");
  });

  it("renders FileSearchPopup loading state", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <FileSearchPopup
        files={[]}
        selectedIndex={0}
        query="app"
        isLoading={true}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("Searching files with Codex Nucleo engine...");
  });

  it("renders SlashCommandPopup with built-in commands including /review and /compact", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <SlashCommandPopup
        commands={CANYWHERE_SLASH_COMMANDS}
        selectedIndex={0}
        filter=""
        onSelect={() => {}}
      />
    );

    expect(html).toContain("/review");
    expect(html).toContain("/compact");
    expect(html).toContain("/reset");
    expect(html).toContain("/scratch");
    expect(html).toContain("codex");
    expect(html).toContain("chat");
  });

  it("correctly identifies @ mention token at cursor position", () => {
    const text = "Please inspect @src/serv";
    const cursor = text.length;
    const textBefore = text.slice(0, cursor);
    const atMatch = textBefore.match(/(?:^|\s)@([^\s]*)$/);

    expect(atMatch).not.toBeNull();
    expect(atMatch![1]).toBe("src/serv");
  });

  it("correctly identifies / command only at the start of first line", () => {
    const text1 = "/review";
    const match1 = text1.split("\n")[0].match(/^\/([^\s]*)$/);
    expect(match1).not.toBeNull();
    expect(match1![1]).toBe("review");

    const text2 = "Hello /review";
    const match2 = text2.split("\n")[0].match(/^\/([^\s]*)$/);
    expect(match2).toBeNull();
  });
});
