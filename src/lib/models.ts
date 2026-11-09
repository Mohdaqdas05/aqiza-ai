export type ProviderId = "google" | "groq" | "openrouter" | "ollama";

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  detail: string;
};

export const DEFAULT_MODEL = "gemini-2.5-flash";

// Keep this list deliberately small and explicit. Providers can add model IDs
// without allowing arbitrary upstream model names through the public API.
export const MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", detail: "Fast · Google" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", detail: "Reasoning · Google" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq", detail: "Fast · Groq" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq", detail: "Lightweight · Groq" },
  { id: "openrouter/free", label: "Auto · Free models", provider: "openrouter", detail: "Rotating catalog · OpenRouter" },
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  ollama: "Ollama",
};

export function getModelOption(modelId: string): ModelOption | undefined {
  return MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function isOllamaModel(modelId: string): boolean {
  return /^ollama:[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(modelId);
}

export function modelLabel(modelId: string): string {
  const option = getModelOption(modelId);
  if (option) return option.label;
  return isOllamaModel(modelId) ? `${modelId.slice("ollama:".length)} · Ollama` : modelId;
}
