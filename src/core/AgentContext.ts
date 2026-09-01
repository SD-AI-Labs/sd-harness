import type { Message } from "./Message.js";


export interface AgentContext {

  messages: Message[];

  sessionId: string;

  metadata?: Record<string, unknown>;

}