import type {
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

import type {
  Message,
} from "../core/Message.js";


export class OpenAiMessageConverter {

  static convert(
    messages: Message[],
  ): ChatCompletionMessageParam[] {

    return messages.map(
      (
        message,
      ) => {

        switch (
          message.role
        ) {

          case "system":

            return {
              role:
                "system",

              content:
                message.content,
            };


          case "user":

            return {
              role:
                "user",

              content:
                message.content,
            };


          case "assistant":

            return {
              role:
                "assistant",

              content:
                message.content,

              tool_calls:
                message.toolCalls?.map(
                  (
                    call,
                  ) => (
                    {
                      id:
                        call.id,

                      type:
                        "function",

                      function:
                        {
                          name:
                            call.name,

                          arguments:
                            call.arguments,
                        },
                    }
                  ),
                ),
            };


          case "tool":

            return {
              role:
                "tool",

              tool_call_id:
                message.toolCallId ?? "",

              content:
                message.content,
            };

        }
      },
    );
  }
}