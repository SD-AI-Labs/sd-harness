import type { ChatCompletion } from "openai/resources/chat/completions";

import type { LlmResponse } from "./LlmResponse.js";


export class OpenAiResponseMapper {

  static map(
    response: ChatCompletion
  ): LlmResponse {

    const message =
      response.choices[0]?.message;


    const toolCalls =
      message?.tool_calls
        ?.filter(
          (call) => call.type === "function"
        )
        .map(
          (call) => ({
            id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          })
        );


    return {
      content:
        message?.content ?? undefined,

      toolCalls:
        toolCalls && toolCalls.length > 0
          ? toolCalls
          : undefined,
    };
  }
}