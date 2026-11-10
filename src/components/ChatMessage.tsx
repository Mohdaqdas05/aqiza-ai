"use client";

import { Check, Copy, UserRound } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
};

type Props = {
  message: ChatMessageItem;
  streaming?: boolean;
  loadingModel?: boolean;
  loadingHint?: string;
  userName?: string | null;
  userImage?: string | null;
};

export function ChatMessage({ message, streaming = false, loadingModel = false, loadingHint, userName, userImage }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`message-row ${isUser ? "message-row-user" : "message-row-assistant"}`}>
      <div className={`message-avatar ${isUser ? "message-avatar-user" : "message-avatar-assistant"}`} aria-hidden="true">
        {isUser
          ? userImage ? <img src={userImage} alt="" referrerPolicy="no-referrer" /> : userName ? userName.slice(0, 1).toUpperCase() : <UserRound size={15} />
          : "a"}
      </div>
      <div className="message-main">
        <div className="message-meta">
          <span>{isUser ? userName || "You" : "AqizaAI"}</span>
          {!isUser && streaming && <span className="streaming-label"><i /> {loadingModel ? "loading local model" : "generating"}</span>}
        </div>
        <div className={isUser ? "user-message-content" : "assistant-message-content"}>
          {isUser ? <p>{message.content}</p> : message.content
            ? <MarkdownRenderer content={message.content} />
            : streaming
              ? loadingModel
                ? <span className="model-warmup"><i />{loadingHint ?? "Starting the local model. The first reply can take a little longer while it loads."}</span>
                : <span className="thinking-indicator"><i /><i /><i /><span>Thinking</span></span>
              : <span className="empty-message">No response was returned.</span>}
          {!isUser && streaming && message.content && <span className="streaming-cursor" aria-label="Response is streaming" />}
        </div>
        {!isUser && message.content && !streaming && (
          <div className="message-actions">
            <button type="button" onClick={copyMessage} aria-label="Copy response" title="Copy response">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

