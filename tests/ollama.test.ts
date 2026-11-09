import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { discoverOllamaModels, getOllamaOpenAIBaseUrl } from "../src/lib/ollama";

const originalBaseUrl = process.env.OLLAMA_BASE_URL;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalBaseUrl === undefined) Reflect.deleteProperty(process.env, "OLLAMA_BASE_URL");
  else process.env.OLLAMA_BASE_URL = originalBaseUrl;
  if (originalVercel === undefined) Reflect.deleteProperty(process.env, "VERCEL");
  else process.env.VERCEL = originalVercel;
});

test("uses local Ollama automatically only outside Vercel", () => {
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.VERCEL;
  assert.equal(getOllamaOpenAIBaseUrl(), "http://127.0.0.1:11434/v1");

  process.env.VERCEL = "1";
  assert.equal(getOllamaOpenAIBaseUrl(), null);
});

test("discovers installed chat models and filters embedding-only models", async () => {
  process.env.OLLAMA_BASE_URL = "http://ollama.test:11434/v1";
  delete process.env.VERCEL;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/tags")) {
      return Response.json({ models: [
        { name: "qwen3.6:latest", size: 22_300_000_000, details: { family: "qwen", parameter_size: "36.0B" } },
        { name: "nomic-embed-text:latest", size: 300_000_000, details: { family: "nomic-bert", parameter_size: "137M" } },
        { name: "llama3.2:3b", size: 1_900_000_000, details: { family: "llama", parameter_size: "3.2B" } },
        { name: "invalid model name", size: 100 },
      ] });
    }

    assert.equal(url, "http://ollama.test:11434/api/show");
    const body = JSON.parse(String(init?.body)) as { model: string };
    return Response.json({ capabilities: body.model.startsWith("nomic-embed") ? ["embedding"] : ["completion"] });
  };

  const result = await discoverOllamaModels(fetcher);
  assert.equal(result.connected, true);
  assert.deepEqual(result.models.map((model) => model.id), ["ollama:llama3.2:3b", "ollama:qwen3.6:latest"]);
  assert.equal(result.models[0].parameterSize, "3.2B");
});

test("uses a conservative fallback when model capability lookup is unavailable", async () => {
  process.env.OLLAMA_BASE_URL = "http://ollama.test:11434/v1";
  delete process.env.VERCEL;
  const fetcher: typeof fetch = async (input) => {
    if (String(input).endsWith("/api/tags")) {
      return Response.json({ models: [
        { name: "bge-m3:latest", size: 1 },
        { name: "deepseek-coder:6.7b", size: 2 },
      ] });
    }
    return new Response("unavailable", { status: 503 });
  };

  const result = await discoverOllamaModels(fetcher);
  assert.deepEqual(result.models.map((model) => model.name), ["deepseek-coder:6.7b"]);
});
