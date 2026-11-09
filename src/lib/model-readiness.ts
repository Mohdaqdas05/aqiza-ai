import { getConfiguredModels } from "@/lib/ai-providers";
import { discoverOllamaModels } from "@/lib/ollama";

export async function getModelReadiness() {
  const [configured, ollama] = await Promise.all([
    Promise.resolve(getConfiguredModels()),
    discoverOllamaModels(),
  ]);

  const localModels = ollama.models.map(({ id }) => ({ id, enabled: true }));
  return {
    ...configured,
    models: [...configured.models, ...localModels],
    providers: { ...configured.providers, ollama: ollama.models.length > 0 },
    ollama,
  };
}
