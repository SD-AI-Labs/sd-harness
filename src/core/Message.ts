import type { ToolCall } from "../llm/LlmResponse.js";


export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";


export interface Message {

  role: MessageRole;


  content: string;


  /**
   * Tool calls requested by an assistant.
   */
  toolCalls?: ToolCall[];


  /**
   * Identifies which tool call a tool result
   * belongs to.
   */
  toolCallId?: string;
}