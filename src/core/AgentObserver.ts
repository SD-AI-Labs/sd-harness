import type { AgentEvent } from "./AgentEvent.js";

export interface AgentObserver {

  onEvent(event: AgentEvent): void;

}