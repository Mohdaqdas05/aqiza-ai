import { access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/v1";
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/;

const modelTagSchema = z.object({
  name: z.string().min(1).max(160),
  size: z.number().nonnegative().optional(),
  details: z.object({
    family: z.string().optional(),
    parameter_size: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

const tagsResponseSchema = z.object({ models: z.array(modelTagSchema).max(100) }).passthrough();
const showResponseSchema = z.object({ capabilities: z.array(z.string()).optional() }).passthrough();

export type LocalOllamaModel = {
  id: string;
  name: string;
  size: number;
  parameterSize: string | null;
  family: string | null;
};

export type OllamaDiscovery = {
  localRuntime: boolean;
  installed: boolean;
  connected: boolean;
  models: LocalOllamaModel[];
};

function configuredBaseUrl(): URL | null {
  const configured = process.env.OLLAMA_BASE_URL?.trim();
  if (!configured && process.env.VERCEL === "1") return null;

  try {
    const url = new URL(configured || DEFAULT_OLLAMA_URL);
    if ((url.protocol !== "http:" && url.protocol !== "https:")
      || url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.replace(/\/$/, "")) url.pathname = "/v1";
    return url;
  } catch {
    return null;
  }
}

export function getOllamaOpenAIBaseUrl(): string | null {
  const url = configuredBaseUrl();
  return url?.toString().replace(/\/$/, "") ?? null;
}

function getOllamaApiBaseUrl(): string | null {
  const url = configuredBaseUrl();
  if (!url) return null;
  const apiPath = url.pathname.replace(/\/v1\/?$/, "").replace(/\/$/, "");
  return `${url.origin}${apiPath}/api`;
}

export function usesLocalOllamaServer(): boolean {
  if (process.env.VERCEL === "1") return false;
  const url = configuredBaseUrl();
  return Boolean(url && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname.toLowerCase()));
}

export async function findOllamaExecutable(): Promise<string | null> {
  const executableNames = process.platform === "win32" ? ["ollama.exe"] : ["ollama"];
  const directories = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);

  for (const directory of directories) {
    for (const executableName of executableNames) {
      const candidate = path.join(directory.replace(/^"|"$/g, ""), executableName);
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Continue through PATH; Ollama is optional.
      }
    }
  }

  return null;
}

function supportsChat(capabilities: string[] | undefined, name: string): boolean {
  if (capabilities) return capabilities.includes("completion");
  const likelyEmbeddingModel = /(embed|rerank|speech|whisper|phonem|tts|bert)/i.test(name)
    || /(^|[-_.:/])(bge|gte|e5)([-_.:/]|$)/i.test(name);
  return !likelyEmbeddingModel;
}

async function mapConcurrent<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await map(items[index]);
    }
  }));
  return results;
}

export async function discoverOllamaModels(fetcher: typeof fetch = fetch): Promise<OllamaDiscovery> {
  const apiBase = getOllamaApiBaseUrl();
  const localRuntime = usesLocalOllamaServer();
  const installed = localRuntime && Boolean(await findOllamaExecutable());
  if (!apiBase) return { localRuntime, installed, connected: false, models: [] };

  try {
    const response = await fetcher(`${apiBase}/tags`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(1_800),
    });
    if (!response.ok) return { localRuntime, installed, connected: false, models: [] };

    const parsed = tagsResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { localRuntime, installed, connected: false, models: [] };

    const models = await mapConcurrent(parsed.data.models, 4, async (model) => {
      if (!MODEL_NAME_PATTERN.test(model.name)) return null;

      let capabilities: string[] | undefined;
      try {
        const detailResponse = await fetcher(`${apiBase}/show`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: model.name }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(3_000),
        });
        if (detailResponse.ok) {
          const detail = showResponseSchema.safeParse(await detailResponse.json());
          if (detail.success) capabilities = detail.data.capabilities;
        }
      } catch {
        // Older Ollama builds may not return capability metadata; use a conservative name fallback.
      }

      if (!supportsChat(capabilities, model.name)) return null;
      return {
        id: `ollama:${model.name}`,
        name: model.name,
        size: model.size ?? 0,
        parameterSize: model.details?.parameter_size ?? null,
        family: model.details?.family ?? null,
      } satisfies LocalOllamaModel;
    });

    return {
      localRuntime,
      installed,
      connected: true,
      models: models.filter((model): model is LocalOllamaModel => model !== null)
        .sort((left, right) => left.size - right.size || left.name.localeCompare(right.name)),
    };
  } catch {
    return { localRuntime, installed, connected: false, models: [] };
  }
}
