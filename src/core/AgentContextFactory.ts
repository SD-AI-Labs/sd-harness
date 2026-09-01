import type { AgentContext } from "./AgentContext.js";


export class AgentContextFactory {

  static create(
    input: string,
  ): AgentContext {

    return {
      sessionId:
        crypto.randomUUID(),

      messages: [
        {
          role: "user",
          content: input,
        },
      ],
    };
  }
}