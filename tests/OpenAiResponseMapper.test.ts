import { describe, expect, it } from "vitest";
import { OpenAiResponseMapper } from "../src/llm/OpenAiResponseMapper.js";


describe("OpenAiResponseMapper", () => {

  it("maps tool calls", () => {

    const response: any = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "list_files",
                  arguments: '{"path":"."}'
                }
              }
            ]
          }
        }
      ]
    };


    const result =
      OpenAiResponseMapper.map(response);


    expect(result.toolCalls?.[0].name)
      .toBe("list_files");

  });

});