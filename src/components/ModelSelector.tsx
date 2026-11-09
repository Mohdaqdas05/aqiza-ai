"use client";

import { ChevronDown, Cpu } from "lucide-react";
import { MODEL_OPTIONS, PROVIDER_LABELS, type ProviderId } from "@/lib/models";
import type { AuthProviderId } from "@/lib/auth-providers";

export type ModelReadiness = {
  models: { id: string; enabled: boolean }[];
  providers: Record<ProviderId, boolean>;
  authProviders?: AuthProviderId[];
  ollama: {
    localRuntime: boolean;
    installed: boolean;
    connected: boolean;
    models: { id: string; name: string; size: number; parameterSize: string | null; family: string | null }[];
  };
};

type Props = {
  value: string;
  readiness: ModelReadiness | null;
  onChange: (value: string) => void;
  compact?: boolean;
  ariaLabel?: string;
};

export function ModelSelector({ value, readiness, onChange, compact = false, ariaLabel = "Select model" }: Props) {
  const current = MODEL_OPTIONS.find((option) => option.id === value);
  const providers = Object.keys(PROVIDER_LABELS) as ProviderId[];
  const localModels = readiness?.ollama.models ?? [];
  const selectedLocalName = value.startsWith("ollama:") ? value.slice("ollama:".length) : "";
  const selectedLocalIsMissing = Boolean(selectedLocalName && !localModels.some((model) => model.id === value));

  return (
    <label className={`model-select ${compact ? "model-select-compact" : ""}`}>
      <Cpu size={15} aria-hidden="true" />
      {!compact && <span className="model-select-label">Model</span>}
      <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
        {!readiness && <option value={value}>{current?.label ?? value}</option>}
        {selectedLocalIsMissing && <option value={value}>{selectedLocalName} · unavailable</option>}
        {providers.map((provider) => {
          const models = MODEL_OPTIONS.filter((option) => option.provider === provider);
          if (models.length === 0) return null;
          return (
            <optgroup key={provider} label={PROVIDER_LABELS[provider]}>
              {models.map((option) => {
                const enabled = readiness?.models.find((model) => model.id === option.id)?.enabled ?? false;
                return (
                  <option key={option.id} value={option.id} disabled={!enabled}>
                    {option.label}{enabled ? "" : " · Add API key"}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
        {localModels.length > 0 && (
          <optgroup label={`Ollama · ${localModels.length} local ${localModels.length === 1 ? "model" : "models"}`}>
            {localModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}{model.parameterSize ? ` · ${model.parameterSize}` : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <span className="model-select-provider">{current?.detail.split(" · ").at(-1) ?? (value.startsWith("ollama:") ? "Ollama" : "Choose a model")}</span>
      <ChevronDown size={14} className="model-select-chevron" aria-hidden="true" />
    </label>
  );
}
