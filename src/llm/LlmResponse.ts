export interface LlmResponse {
  content?: string;

  toolCalls?: ToolCall[];
}


export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}