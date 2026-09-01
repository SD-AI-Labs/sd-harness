import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Agent,
} from "../src/core/Agent.js";

import {
  ToolRegistry,
} from "../src/core/ToolRegistry.js";

import {
  ListFilesTool,
} from "../src/core/tools/ListFilesTool.js";

import {
  ScriptedFakeLlmClient,
} from "../src/llm/ScriptedFakeLlmClient.js";

import {
  SimpleContextManager,
} from "../src/context/SimpleContextManager.js";

import {
  defaultAgentConfig,
} from "../src/core/DefaultAgentConfig.js";


describe(
  "Agent tool loop",
  () => {

    it(
      "preserves assistant tool calls and tool results in conversation history",
      async () => {

        const llm =
          new ScriptedFakeLlmClient(
            [
              {
                toolCalls: [
                  {
                    id:
                      "call_1",

                    name:
                      "list_files",

                    arguments:
                      JSON.stringify({
                        path: ".",
                      }),
                  },
                ],
              },

              {
                content:
                  "The files were listed successfully.",
              },
            ],
          );


        const registry =
          new ToolRegistry();


        registry.register(
          new ListFilesTool(),
        );


        const agent =
          new Agent(
            llm,
            registry,
            defaultAgentConfig,
            new SimpleContextManager(
              20,
            ),
          );


        const result =
          await agent.run(
            "List files",
          );


        /*
         * Verify the final result.
         */

        expect(
          result.answer,
        ).toBe(
          "The files were listed successfully.",
        );


        expect(
          result.iterations,
        ).toBe(2);


        /*
         * The LLM should have been called
         * once for the tool request and
         * once for the final answer.
         */

        expect(
          llm.getCallCount(),
        ).toBe(2);


        const requests =
          llm.getRequests();


        expect(
          requests.length,
        ).toBe(2);


        /*
         * Inspect the messages supplied
         * to the second LLM request.
         */

        const secondMessages =
          requests[1][0];


        /*
         * Expected conversation structure:
         *
         * user
         * assistant (tool call)
         * tool (tool result)
         */


        expect(
          secondMessages.length,
        ).toBeGreaterThanOrEqual(
          3,
        );


        /*
         * Original user message.
         */

        const userMessage =
          secondMessages.find(
            (
              message,
            ) =>
              message.role ===
              "user",
          );


        expect(
          userMessage,
        ).toBeDefined();


        expect(
          userMessage?.content,
        ).toBe(
          "List files",
        );


        /*
         * Assistant message that requested
         * the tool.
         */

        const assistantMessage =
          secondMessages.find(
            (
              message,
            ) =>
              message.role ===
              "assistant",
          );


        expect(
          assistantMessage,
        ).toBeDefined();


        expect(
          assistantMessage?.toolCalls,
        ).toBeDefined();


        expect(
          assistantMessage
            ?.toolCalls?.[0]
            ?.id,
        ).toBe(
          "call_1",
        );


        expect(
          assistantMessage
            ?.toolCalls?.[0]
            ?.name,
        ).toBe(
          "list_files",
        );


        /*
         * Tool result message.
         */

        const toolMessage =
          secondMessages.find(
            (
              message,
            ) =>
              message.role ===
              "tool",
          );


        expect(
          toolMessage,
        ).toBeDefined();


        expect(
          toolMessage?.toolCallId,
        ).toBe(
          "call_1",
        );


        expect(
          toolMessage?.content,
        ).toBeTruthy();

      },
    );

  },
);