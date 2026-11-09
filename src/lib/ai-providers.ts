import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { MODEL_OPTIONS, getModelOption, isOllamaModel } from "@/lib/models";
import { getOllamaOpenAIBaseUrl } from "@/lib/ollama";

export class ProviderConfigurationError extends Error {
  constructor(provider: string, message?: string) {
    super(message ?? `${provider} is not configured. Add its server-side API key to .env.`);
    this.name = "ProviderConfigurationError";
  }
}

function requireKey(name: string, provider: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ProviderConfigurationError(provider);
  return value;
}

export function getConfiguredModels() {
  const googleReady = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  const groqReady = Boolean(process.env.GROQ_API_KEY?.trim());
  const openRouterReady = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return {
    models: MODEL_OPTIONS.map(({ id, provider }) => ({
      id,
      enabled: provider === "google" ? googleReady
        : provider === "groq" ? groqReady
          : provider === "openrouter" ? openRouterReady : false,
    })),
    providers: {
      google: googleReady,
      groq: groqReady,
      openrouter: openRouterReady,
      ollama: false,
    },
  };
}

export function resolveModel(modelId: string): LanguageModel {
  if (isOllamaModel(modelId)) {
    const baseURL = getOllamaOpenAIBaseUrl();
    if (!baseURL) {
      throw new ProviderConfigurationError("Ollama", "Ollama is not reachable from this AqizaAI server. Run AqizaAI beside Ollama or configure OLLAMA_BASE_URL.");
    }
    const ollama = createOpenAICompatible({
      name: "ollama",
      baseURL,
      apiKey: process.env.OLLAMA_API_KEY?.trim() || "ollama",
    });
    return ollama(modelId.slice("ollama:".length));
  }

  const option = getModelOption(modelId);
  if (!option) throw new Error("Choose a supported model.");

  if (option.provider === "google") {
    requireKey("GOOGLE_GENERATIVE_AI_API_KEY", "Google Gemini");
    return google(modelId);
  }

  if (option.provider === "groq") {
    requireKey("GROQ_API_KEY", "Groq");
    return groq(modelId);
  }

  if (option.provider === "openrouter") {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: requireKey("OPENROUTER_API_KEY", "OpenRouter"),
      headers: {
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
        "X-Title": "AqizaAI",
      },
    });
    return openrouter(modelId);
  }

  throw new Error("Choose a supported model.");
}
