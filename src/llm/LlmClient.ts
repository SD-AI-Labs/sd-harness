import type { Message } from "../core/Message.js";
import type { LlmToolDefinition } from "../core/LlmToolDefinition.js";
import type { LlmResponse } from "./LlmResponse.js";

export interface LlmClient {
  chat(
    messages: Message[],
    tools?: LlmToolDefinition[]
  ): Promise<LlmResponse>;
}