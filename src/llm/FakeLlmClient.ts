import type { LlmClient } from "./LlmClient.js";
import type { Message } from "../core/Message.js";
import type { LlmToolDefinition } from "../core/LlmToolDefinition.js";
import type { LlmResponse } from "./LlmResponse.js";


export class FakeLlmClient implements LlmClient {

  async chat(
    messages: Message[],
    tools?: LlmToolDefinition[],
  ): Promise<LlmResponse> {

    const hasToolResult =
      messages.some(
        message => message.role === "tool"
      );


    if (hasToolResult) {
      return {
        content:
          "I received the tool result and completed the task."
      };
    }


    return {
      toolCalls: [
        {
          id: "call_001",
          name: "list_files",
          arguments: JSON.stringify({
            path: "."
          })
        }
      ]
    };
  }
}