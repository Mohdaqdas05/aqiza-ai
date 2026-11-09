"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/CodeBlock";

function textContent(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (value && typeof value === "object" && "props" in value) {
    return textContent((value as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" {...props}>{children}</a>
  ),
  pre: ({ children }) => {
    const codeElement = Array.isArray(children) ? children[0] : children;
    const className = codeElement && typeof codeElement === "object" && "props" in codeElement
      ? String((codeElement as React.ReactElement<{ className?: string }>).props.className ?? "")
      : "";
    const language = className.match(/language-([\w-]+)/)?.[1] ?? "text";
    const code = textContent(codeElement);
    return <CodeBlock code={code} language={language}>{children}</CodeBlock>;
  },
  code: ({ children, className, ...props }) => className
    ? <code className={className} {...props}>{children}</code>
    : <code className="inline-code" {...props}>{children}</code>,
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
