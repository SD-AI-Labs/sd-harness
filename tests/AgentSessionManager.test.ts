import { describe, expect, it } from "vitest";

import { AgentSessionManager } from "../src/memory/AgentSessionManager.js";
import type { AgentContext } from "../src/core/AgentContext.js";
import type { SessionStore } from "../src/memory/SessionStore.js";

import { Agent } from "../src/core/Agent.js";
import { FakeLlmClient } from "../src/llm/FakeLlmClient.js";
import { ScriptedFakeLlmClient } from "../src/llm/ScriptedFakeLlmClient.js";
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
            new SimpleContextManager({
              maxMessages: 20,
            }),
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

    it(
      "keeps a persisted session valid under a small context window",
      async () => {
        const registry =
          new ToolRegistry();

        const llm =
          new ScriptedFakeLlmClient([
            {
              content: "answer one",
            },
            {
              content: "answer two",
            },
            {
              content: "answer three",
            },
          ]);

        const agent =
          new Agent(
            llm,
            registry,
            defaultAgentConfig,
            new SimpleContextManager({
              maxMessages: 3,
            }),
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
            "First message",
          );

        const sessionId =
          first.result.sessionId;

        await sessions.continue(
          sessionId,
          "Second message",
        );

        const third =
          await sessions.continue(
            sessionId,
            "Third message",
          );

        expect(
          third.result.answer,
        ).toBe(
          "answer three",
        );

        /*
         * The persisted history stays complete even though the
         * requests sent to the LLM were truncated.
         */
        const persisted =
          store.load(
            sessionId,
          )!;

        expect(
          persisted.messages.length,
        ).toBe(6);

        expect(
          persisted.messages[0],
        ).toEqual({
          role: "user",
          content: "First message",
        });

        /*
         * The last LLM request was truncated to the newest
         * exchange that fits the policy: the oldest user message
         * is gone but the latest user turn is retained.
         */
        const requests =
          llm.getRequests();

        expect(
          requests.length,
        ).toBe(3);

        const lastRequestMessages =
          requests[2][0].map(
            (message) =>
              message.content,
          );

        expect(
          lastRequestMessages,
        ).toEqual([
          "Second message",
          "answer two",
          "Third message",
        ]);

        expect(
          lastRequestMessages,
        ).not.toContain(
          "First message",
        );
      },
    );

  },
);