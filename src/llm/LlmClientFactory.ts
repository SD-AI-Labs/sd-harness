import type { LlmClient } from "./LlmClient.js";
import type { LlmConfig } from "./LlmConfig.js";
import { DeepSeekLlmClient } from "./DeepSeekLlmClient.js";
import { OpenAiLlmClient } from "./OpenAiLlmClient.js";

export class LlmClientFactory {
  static create(config: LlmConfig): LlmClient {
    switch (config.provider.toLowerCase()) {
      case "deepseek":
        return new DeepSeekLlmClient(config);
      case "openai":
        return new OpenAiLlmClient(config)  ;

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}