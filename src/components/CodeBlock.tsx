"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CodeBlockProps = {
  code: string;
  language: string;
  children: React.ReactNode;
};

export function CodeBlock({ code, language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lineCount = Math.max(1, code.replace(/\n$/, "").split("\n").length);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-toolbar">
        <span className="code-language">{language || "code"}</span>
        <button type="button" className="code-copy" onClick={copyCode} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="code-block-body">
        <div className="code-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <pre>{children}</pre>
      </div>
    </div>
  );
}
