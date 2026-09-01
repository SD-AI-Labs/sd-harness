import { describe, expect, it } from "vitest";

import { AgentSessionManager } from "../src/memory/AgentSessionManager.js";
import type { AgentContext } from "../src/core/AgentContext.js";
import type { SessionStore } from "../src/memory/SessionStore.js";

import { Agent } from "../src/core/Agent.js";
import { FakeLlmClient } from "../src/llm/FakeLlmClient.js";
import { ToolRegistry } from "../src/core/ToolRegistry.js";
import { defaultAgentConfig } from "../src/core/DefaultAgentConfig.js";
import { SimpleContextManager } from "../src/context/SimpleContextManager.js";


class FakeSessionStore
  implements SessionStore {

  private readonly sessions =
    new Map<string, AgentContext>();


  save(
    context: AgentContext,
  ): void {

    this.sessions.set(
      context.sessionId,
      context,
    );
  }


  load(
    sessionId: string,
  ): AgentContext | undefined {

    return this.sessions.get(
      sessionId,
    );
  }
}


describe(
  "AgentSessionManager",
  () => {

    it(
      "starts and continues a session",
      async () => {

        const registry =
          new ToolRegistry();


        const agent =
          new Agent(
            new FakeLlmClient(),
            registry,
            defaultAgentConfig,
            new SimpleContextManager(),
          );


        const store =
          new FakeSessionStore();


        const sessions =
          new AgentSessionManager(
            agent,
            store,
          );


        const first =
          await sessions.start(
            "Hello",
          );


        expect(
          first.context.sessionId,
        ).toBeDefined();


        expect(
          first.context.messages
            .some(
              message =>
                message.content === "Hello",
            ),
        ).toBe(true);


        const second =
          await sessions.continue(
            first.context.sessionId,
            "Continue",
          );


        expect(
          second.context.messages
            .some(
              message =>
                message.content === "Continue",
            ),
        ).toBe(true);


        expect(
          second.context.sessionId,
        ).toBe(
          first.context.sessionId,
        );
      },
    );

  },
);