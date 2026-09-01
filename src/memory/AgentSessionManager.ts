import type { Agent } from "../core/Agent.js";
import type { AgentContext } from "../core/AgentContext.js";
import type { AgentResult } from "../core/AgentResult.js";
import type { SessionStore } from "./SessionStore.js";

import { AgentContextFactory } from "../core/AgentContextFactory.js";


export class AgentSessionManager {

  constructor(
    private readonly agent: Agent,
    private readonly store: SessionStore,
  ) {}


  async start(
    input: string,
  ): Promise<{
    result: AgentResult;
    context: AgentContext;
  }> {

    const context =
      AgentContextFactory.create(
        input,
      );


    const result =
      await this.agent.runWithContext(
        context,
      );


    this.store.save(
      context,
    );


    return {
      result,
      context,
    };
  }


  async continue(
    sessionId: string,
    input: string,
  ): Promise<{
    result: AgentResult;
    context: AgentContext;
  }> {

    const context =
      this.store.load(
        sessionId,
      );


    if (!context) {

      throw new Error(
        `Session not found: ${sessionId}`,
      );
    }


    const result =
      await this.agent.continue(
        context,
        input,
      );


    this.store.save(
      context,
    );


    return {
      result,
      context,
    };
  }


  getSession(
    sessionId: string,
  ): AgentContext | undefined {

    return this.store.load(
      sessionId,
    );
  }
}