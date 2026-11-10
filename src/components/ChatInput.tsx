"use client";

import { ArrowUp, Square } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef } from "react";
import { ModelSelector, type ModelReadiness } from "@/components/ModelSelector";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  model: string;
  readiness: ModelReadiness | null;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  privacyNote: string;
};

export function ChatInput({ value, onChange, onSubmit, model, readiness, onModelChange, disabled, streaming, onStop, privacyNote }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!streaming && !disabled && value.trim()) onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!streaming && !disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AqizaAI"
          aria-label="Message AqizaAI"
          rows={1}
          maxLength={16_000}
          disabled={streaming}
        />
        <div className="composer-bottom">
          <div className="composer-model">
            <ModelSelector value={model} readiness={readiness} onChange={onModelChange} compact />
          </div>
          <div className="composer-controls">
            <span className="composer-hint"><kbd>↵</kbd> to send · <kbd>⇧ ↵</kbd> for newline</span>
            {streaming ? (
              <button className="send-button stop-button" type="button" onClick={onStop} aria-label="Stop response">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button className="send-button" type="submit" disabled={disabled || !value.trim()} aria-label="Send message">
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </form>
      <p className="composer-disclaimer">{privacyNote}</p>
    </div>
  );
}

