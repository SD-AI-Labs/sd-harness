import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ScriptedFakeLlmClient,
} from "../src/llm/ScriptedFakeLlmClient.js";


describe(
  "ScriptedFakeLlmClient",
  () => {

    it(
      "returns responses in sequence",
      async () => {

        const llm =
          new ScriptedFakeLlmClient(
            [
              {
                content:
                  "First response",
              },
              {
                content:
                  "Second response",
              },
            ],
          );


        const first =
          await llm.chat(
            [],
          );


        const second =
          await llm.chat(
            [],
          );


        expect(
          first.content,
        ).toBe(
          "First response",
        );


        expect(
          second.content,
        ).toBe(
          "Second response",
        );


        expect(
          llm.getCallCount(),
        ).toBe(2);

      },
    );


    it(
      "throws when responses are exhausted",
      async () => {

        const llm =
          new ScriptedFakeLlmClient(
            [
              {
                content:
                  "Only response",
              },
            ],
          );


        await llm.chat(
          [],
        );


        await expect(
          llm.chat(
            [],
          ),
        ).rejects.toThrow(
          "ScriptedFakeLlmClient has no more responses",
        );

      },
    );


    it(
      "can reset the script",
      async () => {

        const llm =
          new ScriptedFakeLlmClient(
            [
              {
                content:
                  "Hello",
              },
            ],
          );


        await llm.chat(
          []);


        expect(
          llm.getCallCount(),
        ).toBe(1);


        llm.reset();


        expect(
          llm.getCallCount(),
        ).toBe(0);


        const response =
          await llm.chat(
            [],
          );


        expect(
          response.content,
        ).toBe(
          "Hello",
        );

      },
    );

  },
);