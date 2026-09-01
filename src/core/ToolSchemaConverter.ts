import { z } from "zod";
import type { Tool } from "./Tool.js";
import type { LlmToolDefinition } from "./LlmToolDefinition.js";

export class ToolSchemaConverter {
  static convert(tool: Tool): LlmToolDefinition {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.inputSchema),
      },
    };
  }
}