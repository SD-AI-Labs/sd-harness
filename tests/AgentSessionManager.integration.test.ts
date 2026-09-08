import { describe, expect, it } from "vitest";

import { AgentSessionManager } from "../src/memory/AgentSessionManager.js";
import { SqliteSessionStore } from "../src/memory/SqliteSessionStore.js";
import { Agent } from "../src/core/Agent.js";
import { ScriptedFakeLlmClient } from "../src/llm/ScriptedFakeLlmClient.js";
import { ToolRegistry } from "../src/core/ToolRegistry.js";
import { ListFilesTool } from "../src/core/tools/ListFilesTool.js";
import { defaultAgentConfig } from "../src/core/DefaultAgentConfig.js";
import { SimpleContextManager } from "../src/context/SimpleContextManager.js";

describe("AgentSessionManager + SqliteSessionStore integration", () => {
  it("starts a session, persists it, continues, and verifies full history", async () => {
    const registry = new ToolRegistry();
    registry.register(new ListFilesTool());

    const startLlm = new ScriptedFakeLlmClient([
      {
        toolCalls: [
          {
            id: "call_1",
            name: "list_files",
            arguments: JSON.stringify({ path: "." }),
          },
        ],
      },
      {
        content: "The files were listed successfully.",
      },
    ]);

    const startAgent = new Agent(
      startLlm,
      registry,
      defaultAgentConfig,
      new SimpleContextManager(20),
    );

    const store = new SqliteSessionStore();
    const startManager = new AgentSessionManager(startAgent, store);

    // 1. Start session
    const first = await startManager.start("List files in the current directory");

    // 2. Capture sessionId
    const sessionId = first.result.sessionId;
    expect(sessionId).toBeDefined();
    expect(first.result.answer).toBe("The files were listed successfully.");
    console.log(`Session started: ${sessionId}`);

    // 3. Verify SQLite contains it (load directly from store)
    const loadedFromStore = store.load(sessionId);
    expect(loadedFromStore).toBeDefined();
    expect(loadedFromStore!.sessionId).toBe(sessionId);
    expect(loadedFromStore!.messages.length).toBeGreaterThanOrEqual(3); // user + assistant + tool

    // 4. Continue using sessionId (new agent, new manager, same store)
    const continueLlm = new ScriptedFakeLlmClient([
      {
        content: "Continued successfully.",
      },
    ]);

    const continueAgent = new Agent(
      continueLlm,
      registry,
      defaultAgentConfig,
      new SimpleContextManager(20),
    );

    const continueManager = new AgentSessionManager(continueAgent, store);

    const second = await continueManager.continue(sessionId, "Now count them");

    // 5. Load session directly from SQLite again
    const finalFromStore = store.load(sessionId);

    // 6. Verify both user messages and assistant responses exist
    expect(finalFromStore).toBeDefined();
    const messages = finalFromStore!.messages;

    const userMessages = messages.filter((m) => m.role === "user");
    expect(userMessages.length).toBe(2);
    expect(userMessages[0].content).toBe("List files in the current directory");
    expect(userMessages[1].content).toBe("Now count them");

    const assistantMessages = messages.filter((m) => m.role === "assistant");
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2); // tool-call assistant + final answer assistant

    const finalAssistantMessage = messages.find(
      (m) => m.role === "assistant" && m.content === "The files were listed successfully."
    );
    expect(finalAssistantMessage).toBeDefined();

    const toolMessages = messages.filter((m) => m.role === "tool");
    expect(toolMessages.length).toBeGreaterThanOrEqual(1);

    // 7. Verify the same sessionId is retained
    expect(second.result.sessionId).toBe(sessionId);
    expect(finalFromStore!.sessionId).toBe(sessionId);
  });
});
