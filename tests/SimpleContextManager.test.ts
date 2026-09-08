import { describe, expect, it } from "vitest";

import { SimpleContextManager } from "../src/context/SimpleContextManager.js";
import type { Message } from "../src/core/Message.js";

function userMessage(content: string): Message {
  return { role: "user", content };
}

function assistantMessage(content: string): Message {
  return { role: "assistant", content };
}

function systemMessage(content: string): Message {
  return { role: "system", content };
}

function toolCallMessage(callId: string): Message {
  return {
    role: "assistant",
    content: "",
    toolCalls: [{ id: callId, name: "read_file", arguments: "{}" }],
  };
}

function toolResultMessage(callId: string): Message {
  return { role: "tool", toolCallId: callId, content: `result of ${callId}` };
}

/**
 * Every tool message must be declared by an earlier assistant tool-call
 * message that was retained.
 */
function expectNoOrphanedToolMessages(messages: Message[]): void {
  const declared = new Set<string>();

  for (const message of messages) {
    if (message.role === "assistant" && message.toolCalls) {
      for (const call of message.toolCalls) {
        declared.add(call.id);
      }
    }
  }

  for (const message of messages) {
    if (message.role === "tool") {
      expect(message.toolCallId).toBeDefined();
      expect(declared.has(message.toolCallId!)).toBe(true);
    }
  }
}

/**
 * Every retained assistant tool-call message must still be followed by
 * the complete set of tool results answering its calls.
 */
function expectRoundsComplete(messages: Message[]): void {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role !== "assistant" || !message.toolCalls) {
      continue;
    }

    const expectedIds = new Set(message.toolCalls.map((call) => call.id));
    const answeredIds = new Set<string>();

    let j = i + 1;
    while (j < messages.length && messages[j].role === "tool") {
      answeredIds.add(messages[j].toolCallId!);
      j++;
    }

    for (const id of expectedIds) {
      expect(answeredIds.has(id)).toBe(true);
    }
  }
}

describe("SimpleContextManager", () => {
  it("returns messages unchanged when below the limit", () => {
    const history = [
      userMessage("u1"),
      assistantMessage("a1"),
      userMessage("u2"),
      assistantMessage("a2"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 10 });

    const result = manager.prepare(history);

    expect(result).toEqual(history);
    expect(result).not.toBe(history);
  });

  it("returns messages unchanged when at the limit", () => {
    const history = [
      userMessage("u1"),
      assistantMessage("a1"),
      userMessage("u2"),
      assistantMessage("a2"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 4 });

    expect(manager.prepare(history)).toEqual(history);
  });

  it("reduces messages above the limit and keeps the newest", () => {
    const history = [
      userMessage("u1"),
      userMessage("u2"),
      userMessage("u3"),
      userMessage("u4"),
      userMessage("u5"),
      userMessage("u6"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 4 });

    const result = manager.prepare(history);

    expect(result.length).toBe(4);
    expect(result.map((message) => message.content)).toEqual([
      "u3",
      "u4",
      "u5",
      "u6",
    ]);
  });

  it("retains the most recent user/assistant interaction", () => {
    const history = [
      userMessage("u1"),
      assistantMessage("a1"),
      userMessage("u2"),
      assistantMessage("a2"),
      userMessage("u3"),
      assistantMessage("a3"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 4 });

    const result = manager.prepare(history);

    expect(result).toEqual([
      userMessage("u2"),
      assistantMessage("a2"),
      userMessage("u3"),
      assistantMessage("a3"),
    ]);
  });

  it("preserves the system message while truncating", () => {
    const history = [
      systemMessage("system prompt"),
      userMessage("u1"),
      assistantMessage("a1"),
      userMessage("u2"),
      assistantMessage("a2"),
      userMessage("u3"),
      assistantMessage("a3"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 5 });

    const result = manager.prepare(history);

    expect(result).toEqual([
      systemMessage("system prompt"),
      userMessage("u2"),
      assistantMessage("a2"),
      userMessage("u3"),
      assistantMessage("a3"),
    ]);
  });

  it("preserves the system message when only system messages fit", () => {
    const history = [
      systemMessage("s1"),
      systemMessage("s2"),
      userMessage("u1"),
      assistantMessage("a1"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 2 });

    const result = manager.prepare(history);

    expect(result).toEqual([systemMessage("s1"), systemMessage("s2")]);
  });

  it("keeps tool-call and tool-result sequences intact across exchanges", () => {
    const history = [
      userMessage("u1"),
      toolCallMessage("call_1"),
      toolResultMessage("call_1"),
      userMessage("u2"),
      toolCallMessage("call_2"),
      toolResultMessage("call_2"),
      assistantMessage("a2"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 5 });

    const result = manager.prepare(history);

    expect(result.length).toBeLessThanOrEqual(5);
    expect(result).toEqual([
      userMessage("u2"),
      toolCallMessage("call_2"),
      toolResultMessage("call_2"),
      assistantMessage("a2"),
    ]);

    expectNoOrphanedToolMessages(result);
    expectRoundsComplete(result);
  });

  it("trims an oversized exchange only between complete rounds", () => {
    const history = [
      userMessage("u1"),
      toolCallMessage("call_1"),
      toolResultMessage("call_1"),
      toolCallMessage("call_2"),
      toolResultMessage("call_2"),
      toolCallMessage("call_3"),
      toolResultMessage("call_3"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 5 });

    const result = manager.prepare(history);

    expect(result.length).toBeLessThanOrEqual(5);
    expect(result[0]).toEqual(userMessage("u1"));
    expect(result[result.length - 1]).toEqual(toolResultMessage("call_3"));

    const contents = result.map((message) => message.content);
    expect(contents).not.toContain("result of call_1");

    expectNoOrphanedToolMessages(result);
    expectRoundsComplete(result);
  });

  it("never leaves orphaned tool messages behind", () => {
    // Broken history: a tool result whose assistant tool-call message
    // lives in the exchange that gets dropped.
    const history = [
      userMessage("u1"),
      toolCallMessage("call_1"),
      toolResultMessage("call_1"),
      userMessage("u2"),
      toolResultMessage("call_1"),
    ];

    const manager = new SimpleContextManager({ maxMessages: 3 });

    const result = manager.prepare(history);

    expect(result).toEqual([userMessage("u2")]);
    expectNoOrphanedToolMessages(result);
  });

  it("does not mutate the input history", () => {
    const history = [
      userMessage("u1"),
      assistantMessage("a1"),
      userMessage("u2"),
      assistantMessage("a2"),
      userMessage("u3"),
      assistantMessage("a3"),
    ];

    const snapshot = JSON.parse(JSON.stringify(history));

    const manager = new SimpleContextManager({ maxMessages: 4 });

    manager.prepare(history);

    expect(history).toEqual(snapshot);
  });

  it("returns an empty array for empty input", () => {
    const manager = new SimpleContextManager({ maxMessages: 20 });

    expect(manager.prepare([])).toEqual([]);
  });
});
