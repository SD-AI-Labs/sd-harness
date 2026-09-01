import type OpenAI from "openai";

import type { LlmToolDefinition } from "../core/LlmToolDefinition.js";


export class OpenAiToolConverter {

  static convert(
    tools: LlmToolDefinition[],
  ): OpenAI.ChatCompletionTool[] {

    return tools.map((tool) => ({
      type: "function",

      function: {
        name: tool.function.name,

        description: tool.function.description,

        parameters: tool.function.parameters as any,
      },
    }));
  }
}