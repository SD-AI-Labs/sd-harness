import { z } from "zod";

const envSchema = z.object({
  LLM_PROVIDER: z.string().min(1),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  LLM_BASE_URL: z.url(),
});

export function loadLlmConfig() {
  const env = envSchema.parse(process.env);

  return {
    provider: env.LLM_PROVIDER,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    baseUrl: env.LLM_BASE_URL,
  };
}