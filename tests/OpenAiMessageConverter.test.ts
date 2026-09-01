import {
  describe,
  expect,
  it,
} from "vitest";

import {
  OpenAiMessageConverter,
} from "../src/llm/OpenAiMessageConverter.js";


describe(
  "OpenAiMessageConverter",
  () => {

    it(
      "converts user messages",
      () => {

        const result =
          OpenAiMessageConverter.convert(
            [
              {
                role:
                  "user",

                content:
                  "Hello",
              },
            ],
          );


        expect(
          result[0],
        ).toMatchObject(
          {
            role:
              "user",

            content:
              "Hello",
          },
        );

      },
    );


    it(
      "converts assistant tool calls",
      () => {

        const result =
          OpenAiMessageConverter.convert(
            [
              {
                role:
                  "assistant",

                content:
                  "",

                toolCalls: [
                  {
                    id:
                      "call_1",

                    name:
                      "list_files",

                    arguments:
                      "{\"path\":\".\"}",
                  },
                ],
              },
            ],
          );


        expect(
          result[0],
        ).toMatchObject(
          {
            role:
              "assistant",

            content:
              "",

            tool_calls: [
              {
                id:
                  "call_1",

                type:
                  "function",

                function:
                  {
                    name:
                      "list_files",

                    arguments:
                      "{\"path\":\".\"}",
                  },
              },
            ],
          },
        );

      },
    );


    it(
      "converts tool result messages",
      () => {

        const result =
          OpenAiMessageConverter.convert(
            [
              {
                role:
                  "tool",

                toolCallId:
                  "call_1",

                content:
                  "{\"files\":[]}",
              },
            ],
          );


        expect(
          result[0],
        ).toMatchObject(
          {
            role:
              "tool",

            tool_call_id:
              "call_1",

            content:
              "{\"files\":[]}",
          },
        );

      },
    );

  },
);