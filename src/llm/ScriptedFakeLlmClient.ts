import type { LlmClient } from "./LlmClient.js";
import type { LlmResponse } from "./LlmResponse.js";


export class ScriptedFakeLlmClient
  implements LlmClient {

  private currentIndex = 0;


  private readonly requests:
    Parameters<
      LlmClient["chat"]
    >[] = [];


  constructor(
    private readonly responses:
      LlmResponse[],
  ) {}


  async chat(
    ...args: Parameters<
      LlmClient["chat"]
    >
  ): Promise<LlmResponse> {

    this.requests.push(
      args,
    );


    if (
      this.currentIndex >=
      this.responses.length
    ) {

      throw new Error(
        "ScriptedFakeLlmClient has no more responses",
      );
    }


    const response =
      this.responses[
        this.currentIndex
      ];


    this.currentIndex++;


    return response;
  }


  reset(): void {

    this.currentIndex = 0;

    this.requests.length = 0;
  }


  getCallCount(): number {

    return this.currentIndex;
  }


  getRequests(): ReadonlyArray<
    Parameters<
      LlmClient["chat"]
    >
  > {

    return this.requests;
  }
}