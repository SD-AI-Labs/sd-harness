import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../src/llm/FakeLlmClient.js";

describe("FakeLlmClient", () => {
  it("requests a tool on first call", async () => {
    const llm = new FakeLlmClient();

    const response = await llm.chat([
      {
        role: "user",
        content: "Find files",
      },
    ]);

    expect(response.toolCalls).toHaveLength(1);

    expect(response.toolCalls?.[0].name)
      .toBe("list_files");
  });


  it("returns final response after tool result", async () => {
    const llm = new FakeLlmClient();

    const response = await llm.chat([
      {
        role: "user",
        content: "Find files",
      },
      {
        role: "tool",
        toolCallId: "call_001",
        content: '["file1.ts"]',
      },
    ]);

    expect(response.content)
      .toBe(
        "I received the tool result and completed the task."
      );
  });
});