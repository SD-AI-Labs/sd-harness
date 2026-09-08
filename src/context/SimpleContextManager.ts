import type { ContextManager } from "./ContextManager.js";
import type { ContextPolicy } from "../core/AgentConfig.js";
import type { Message } from "../core/Message.js";

/**
 * Structure-preserving context window.
 *
 * Truncation policy:
 * - leading system messages are always retained;
 * - messages are grouped into exchanges at user boundaries;
 * - assistant tool-call messages are kept together with the tool
 *   results that answer them (a "round" is atomic);
 * - the newest exchanges that fit the policy are retained;
 * - if the newest exchange alone exceeds the budget, its opening user
 *   message plus the newest complete rounds are kept.
 *
 * prepare() never mutates the supplied history, so persisted sessions
 * keep their full conversation.
 */
export class SimpleContextManager
  implements ContextManager
{
  constructor(
    private readonly policy: ContextPolicy,
  ) {}

  prepare(messages: Message[]): Message[] {
    if (messages.length === 0) {
      return [];
    }

    if (messages.length <= this.policy.maxMessages) {
      return [...messages];
    }

    // System messages at the head of the history are always preserved.
    const systemMessages: Message[] = [];
    let index = 0;

    while (
      index < messages.length &&
      messages[index].role === "system"
    ) {
      systemMessages.push(messages[index]);
      index++;
    }

    const remaining = messages.slice(index);
    const budget =
      this.policy.maxMessages - systemMessages.length;

    if (budget <= 0) {
      // The policy leaves no room for conversation messages.
      return systemMessages;
    }

    const exchanges = this.splitExchanges(remaining);

    // Keep the newest exchanges that fit the budget.
    const kept: Message[][] = [];
    let size = 0;

    for (let i = exchanges.length - 1; i >= 0; i--) {
      const exchange = exchanges[i];

      if (
        kept.length > 0 &&
        size + exchange.length > budget
      ) {
        break;
      }

      kept.unshift(exchange);
      size += exchange.length;
    }

    // When the newest exchange alone overflows the budget, trim it
    // between complete tool rounds rather than orphaning messages.
    if (kept.length === 1 && size > budget) {
      kept[0] = this.trimExchange(kept[0], budget);
    }

    const truncated = [
      ...systemMessages,
      ...kept.flat(),
    ];

    return this.removeOrphanToolMessages(truncated);
  }

  /**
   * Group messages into exchanges. An exchange starts at a user message
   * (or, defensively, at the head of the history) and runs until the
   * next user message.
   */
  private splitExchanges(
    messages: Message[],
  ): Message[][] {
    const exchanges: Message[][] = [];
    let current: Message[] = [];

    for (const message of messages) {
      if (
        message.role === "user" &&
        current.length > 0
      ) {
        exchanges.push(current);
        current = [];
      }

      current.push(message);
    }

    if (current.length > 0) {
      exchanges.push(current);
    }

    return exchanges;
  }

  /**
   * Reduce an exchange that exceeds the budget to its opening user
   * message plus the newest complete tool rounds that fit. Every
   * retained assistant tool-call message keeps all of its results.
   */
  private trimExchange(
    exchange: Message[],
    budget: number,
  ): Message[] {
    // Without a leading user message there is no safe interior cut
    // point, so the exchange is returned untouched.
    if (exchange.length === 0 || exchange[0].role !== "user") {
      return exchange;
    }

    const head = [exchange[0]];
    const rounds = this.splitRounds(exchange.slice(1));
    const keptRounds: Message[][] = [];
    let size = head.length;

    for (let i = rounds.length - 1; i >= 0; i--) {
      const round = rounds[i];

      if (
        keptRounds.length > 0 &&
        size + round.length > budget
      ) {
        break;
      }

      keptRounds.unshift(round);
      size += round.length;
    }

    return [
      ...head,
      ...keptRounds.flat(),
    ];
  }

  /**
   * Split the body of an exchange into atomic units: an assistant
   * tool-call message together with the tool messages that answer its
   * calls, or any other single message.
   */
  private splitRounds(
    messages: Message[],
  ): Message[][] {
    const rounds: Message[][] = [];
    let index = 0;

    while (index < messages.length) {
      const message = messages[index];

      if (message.role === "assistant" && message.toolCalls?.length) {
        const callIds = new Set(
          message.toolCalls.map((call) => call.id),
        );

        const round = [message];
        index++;

        while (index < messages.length) {
          const next = messages[index];

          if (
            next.role === "tool" &&
            next.toolCallId !== undefined &&
            callIds.has(next.toolCallId)
          ) {
            round.push(next);
            index++;
            continue;
          }

          break;
        }

        rounds.push(round);
        continue;
      }

      rounds.push([message]);
      index++;
    }

    return rounds;
  }

  /**
   * Defensive pass: drop any tool message whose call id is not answered
   * by an earlier, retained assistant tool-call message.
   */
  private removeOrphanToolMessages(
    messages: Message[],
  ): Message[] {
    const answeredCallIds = new Set<string>();
    const result: Message[] = [];

    for (const message of messages) {
      if (
        message.role === "assistant" &&
        message.toolCalls
      ) {
        for (const call of message.toolCalls) {
          answeredCallIds.add(call.id);
        }

        result.push(message);
        continue;
      }

      if (message.role === "tool") {
        if (
          message.toolCallId !== undefined &&
          answeredCallIds.has(message.toolCallId)
        ) {
          result.push(message);
        }

        continue;
      }

      result.push(message);
    }

    return result;
  }
}
