import type { AgentTrace } from "./AgentTrace.js";


export interface AgentResult {

  answer: string;

  sessionId: string;

  iterations: number;

  durationMs: number;

  trace?: AgentTrace;
}