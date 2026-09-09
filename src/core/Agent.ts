import type { LlmClient } from "../llm/LlmClient.js";
import type { ToolRegistry } from "./ToolRegistry.js";
import type { AgentConfig } from "./AgentConfig.js";
import type { AgentObserver } from "./AgentObserver.js";
import type { AgentEvent } from "./AgentEvent.js";
import type { AgentContext } from "./AgentContext.js";
import type { AgentResult } from "./AgentResult.js";

import type { ContextManager } from "../context/ContextManager.js";

import { ToolSchemaConverter } from "./ToolSchemaConverter.js";
import { ToolExecutor } from "./ToolExecutor.js";
import { AgentContextFactory } from "./AgentContextFactory.js";
import { buildSystemMessage } from "./SystemPrompt.js";


export class Agent {

  private readonly executor:
    ToolExecutor;


  constructor(
    private readonly llm: LlmClient,
    private readonly tools: ToolRegistry,
    private readonly config: AgentConfig,
    private readonly contextManager:
      ContextManager,
    private readonly observers:
      AgentObserver[] = [],
  ) {

    this.executor =
      new ToolExecutor();

  }


  /**
   * Start a completely new conversation.
   */
  async run(
    input: string,
  ): Promise<AgentResult> {

    const context =
      AgentContextFactory.create(
        input,
      );


    return this.runWithContext(
      context,
    );
  }


  /**
   * Run the agent using an existing context.
   */
  async runWithContext(
    context: AgentContext,
  ): Promise<AgentResult> {

    const startTime =
      Date.now();


    this.emit(
      "agent_start",
      {
        sessionId:
          context.sessionId,
      },
    );


    /**
     * Compose the system message once per run, from the agent config.
     * It is prepended to each request after context preparation, so it
     * survives truncation and is never stored with the persisted
     * conversation history.
     */
    const systemMessage =
      buildSystemMessage(
        this.config,
      );


    for (
      let iteration = 0;
      iteration <
        this.config.maxIterations;
      iteration++
    ) {

      this.emit(
        "llm_request",
        {
          sessionId:
            context.sessionId,

          iteration,
        },
      );


      /**
       * The system message is sent ahead of the prepared conversation
       * on every LLM request.
       */
      const response =
        await this.llm.chat(
          [
            systemMessage,

            ...this.contextManager.prepare(
              context.messages,
            ),
          ],

          this.tools
            .list()
            .map(
              ToolSchemaConverter.convert,
            ),
        );


      this.emit(
        "llm_response",
        {
          sessionId:
            context.sessionId,

          response,
        },
      );


      /**
       * The model has finished when it
       * requests no further tool calls.
       */
      if (
        !response.toolCalls ||
        response.toolCalls.length === 0
      ) {

        const answer =
          response.content ?? "";


        /**
         * Store the assistant's final answer so
         * that subsequent turns have the complete
         * conversation history.
         */
        context.messages.push(
          {
            role:
              "assistant",

            content:
              answer,
          },
        );


        const result:
          AgentResult = {

          answer,

          sessionId:
            context.sessionId,

          iterations:
            iteration + 1,

          durationMs:
            Date.now() -
            startTime,

        };


        this.emit(
          "agent_complete",
          result,
        );


        return result;
      }


      /**
       * Store the assistant response that
       * requested the tool calls.
       *
       * This is required so that the next
       * LLM request has the complete
       * conversation history.
       */
      context.messages.push(
        {
          role:
            "assistant",

          content:
            response.content ?? "",

          toolCalls:
            response.toolCalls,
        },
      );


      /**
       * Execute all requested tool calls.
       */
      for (
        const call
        of response.toolCalls
      ) {

        this.emit(
          "tool_start",
          {

            sessionId:
              context.sessionId,

            tool:
              call.name,

            arguments:
              call.arguments,

          },
        );


        try {

          const tool =
            this.tools.get(
              call.name,
            );


          const input =
            JSON.parse(
              call.arguments,
            );


          const result =
            await this.executor.execute(
              tool,
              input,
              this.config.toolTimeoutMs,
            );


          this.emit(
            "tool_complete",
            {

              sessionId:
                context.sessionId,

              tool:
                call.name,

              result,

            },
          );


          /**
           * Store the result associated
           * with the specific tool call.
           */
          context.messages.push(
            {
              role:
                "tool",

              toolCallId:
                call.id,

              content:
                JSON.stringify(
                  result,
                ),
            },
          );

        } catch (
          error
        ) {

          const errorMessage =
            error instanceof Error
              ? error.message
              : "Unknown error";


          this.emit(
            "tool_error",
            {

              sessionId:
                context.sessionId,

              tool:
                call.name,

              error:
                errorMessage,

            },
          );


          /**
           * Tool errors are also returned
           * to the LLM as tool messages.
           */
          context.messages.push(
            {
              role:
                "tool",

              toolCallId:
                call.id,

              content:
                `Tool failed: ${errorMessage}`,
            },
          );

        }
      }
    }


    throw new Error(
      `Agent exceeded maximum iterations: ${this.config.maxIterations}`,
    );
  }


  /**
   * Continue an existing conversation.
   */
  async continue(
    context: AgentContext,
    input: string,
  ): Promise<AgentResult> {

    context.messages.push(
      {
        role:
          "user",

        content:
          input,
      },
    );


    return this.runWithContext(
      context,
    );
  }


  /**
   * Send an event to all registered
   * observers.
   */
  private emit(
    type:
      AgentEvent["type"],

    data?: unknown,
  ): void {

    const event:
      AgentEvent = {

      type,

      timestamp:
        new Date(),

      data,

    };


    for (
      const observer
      of this.observers
    ) {

      observer.onEvent(
        event,
      );
    }
  }
}