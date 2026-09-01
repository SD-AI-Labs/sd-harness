import {
  describe,
  expect,
  it,
} from "vitest";

import {
  OpenAiToolConverter,
} from "../src/llm/OpenAiToolConverter.js";


describe(
  "OpenAiToolConverter",
  () => {

    it(
      "converts an LLM tool definition",
      () => {

        const result =
          OpenAiToolConverter.convert(
            [
              {
                type:
                  "function",

                function:
                  {
                    name:
                      "list_files",

                    description:
                      "List files in a directory",

                    parameters:
                      {
                        type:
                          "object",

                        properties:
                          {
                            path:
                              {
                                type:
                                  "string",
                              },
                          },

                        required:
                          [
                            "path",
                          ],
                      },
                  },
              },
            ],
          );


        expect(
          result,
        ).toHaveLength(
          1,
        );


        expect(
          result[0],
        ).toMatchObject(
          {
            type:
              "function",

            function:
              {
                name:
                  "list_files",

                description:
                  "List files in a directory",

                parameters:
                  {
                    type:
                      "object",
                  },
              },
          },
        );

      },
    );

  },
);