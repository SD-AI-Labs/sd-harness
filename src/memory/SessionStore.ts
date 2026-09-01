import type { AgentContext } from "../core/AgentContext.js";


export interface SessionStore {

  save(context: AgentContext): void;

  load(sessionId: string): AgentContext | undefined;

}