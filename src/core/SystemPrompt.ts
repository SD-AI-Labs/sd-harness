import type { AgentConfig } from "./AgentConfig.js";
import type { Message } from "./Message.js";

/**
 * Build the system message for an LLM request from the agent config.
 *
 * The configured instructions are combined with the configured working
 * directory so the agent knows which directory its file tools are
 * sandboxed to. The result is a real `system` message; it is never
 * stored in conversation history.
 */
export function buildSystemMessage(
  config: AgentConfig,
): Message {
  const content = [
    config.systemPrompt,
    `Working directory: ${config.workingDirectory}`,
  ].join("\n\n");

  return {
    role: "system",
    content,
  };
}
