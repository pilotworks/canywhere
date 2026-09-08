import React, { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (inline) {
    return (
      <code
        className="rounded px-1 py-0.5 font-mono text-[11px] bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]"
        {...props}
      >
        {children}
      </code>
    );
  }

  const lang = match ? match[1] : "";

  return (
    <div className="relative my-2.5 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--secondary)]/60 border-b border-[var(--code-border)] text-[var(--muted-foreground)] select-none">
        <span className="text-[11px] font-mono font-medium lowercase tracking-wider text-[var(--muted-foreground)]">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-[var(--foreground)] p-1 rounded transition-colors cursor-pointer text-[10px]"
          title="Copy snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12px] leading-relaxed text-[var(--foreground)] select-text">
        <code>{children}</code>
      </pre>
    </div>
  );
};

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = "" }) => {
  return (
    <div className={`prose-neutral text-[13px] leading-relaxed select-text space-y-2.5 ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as any,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 my-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1 text-[var(--foreground)]">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mt-2.5 mb-1 text-[var(--foreground)]">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-1 text-[var(--foreground)]">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--border)] pl-3 italic text-[var(--muted-foreground)] my-1.5">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--foreground)] underline underline-offset-4 hover:opacity-80 transition-opacity font-medium"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded border border-[var(--border)]">
              <table className="min-w-full text-xs text-left divide-y divide-[var(--border)]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="px-3 py-1.5 font-semibold bg-[var(--secondary)]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 border-t border-[var(--border)]">{children}</td>,
          input: ({ type, checked }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="rounded border-[var(--border)] text-emerald-500 mr-2 inline-block align-middle accent-emerald-500 cursor-default"
                />
              );
            }
            return null;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
