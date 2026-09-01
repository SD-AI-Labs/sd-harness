export type AgentEventType =
  | "agent_start"
  | "llm_request"
  | "llm_response"
  | "tool_start"
  | "tool_complete"
  | "tool_error"
  | "agent_complete";


export interface AgentEvent {
  type: AgentEventType;
  timestamp: Date;
  data?: unknown;
}