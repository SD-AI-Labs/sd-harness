import OpenAI from "openai";

import type { Message } from "../core/Message.js";
import type { LlmToolDefinition } from "../core/LlmToolDefinition.js";

import type { LlmClient } from "./LlmClient.js";
import type { LlmResponse } from "./LlmResponse.js";
import type { LlmConfig } from "./LlmConfig.js";

import {
  OpenAiMessageConverter,
} from "./OpenAiMessageConverter.js";

import {
  OpenAiToolConverter,
} from "./OpenAiToolConverter.js";

import {
  OpenAiResponseMapper,
} from "./OpenAiResponseMapper.js";


export class DeepSeekLlmClient
  implements LlmClient {

  private readonly client:
    OpenAI;


  constructor(
    private readonly config:
      LlmConfig,
  ) {

    this.client =
      new OpenAI(
        {
          apiKey:
            config.apiKey,

          baseURL:
            config.baseUrl,
        },
      );
  }


  async chat(
    messages:
      Message[],

    tools?:
      LlmToolDefinition[],
  ): Promise<LlmResponse> {

    const completion =
      await this.client
        .chat
        .completions
        .create(
          {
            model:
              this.config.model,

            messages:
              OpenAiMessageConverter.convert(
                messages,
              ),

            tools:
              tools
                ? OpenAiToolConverter.convert(
                    tools,
                  )
                : undefined,
          },
        );


    return OpenAiResponseMapper.map(
      completion,
    );
  }
}