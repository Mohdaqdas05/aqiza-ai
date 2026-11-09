import { z } from "zod";
import { getModelOption, isOllamaModel } from "./models";

export const userPreferencesPatchSchema = z.object({
  defaultModel: z.string().min(1).max(140).optional().refine(
    (value) => value === undefined || Boolean(getModelOption(value)) || isOllamaModel(value),
    "Choose a supported model.",
  ),
  theme: z.enum(["dark", "light"]).optional(),
  defaultSystemPrompt: z.string().max(4_000).optional(),
}).strict().refine((preferences) => Object.keys(preferences).length > 0);

export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;
