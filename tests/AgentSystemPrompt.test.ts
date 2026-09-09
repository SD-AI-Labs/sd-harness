import { describe, expect, it } from "vitest";

import { Agent } from "../src/core/Agent.js";
import { ToolRegistry } from "../src/core/ToolRegistry.js";
import { SimpleContextManager } from "../src/context/SimpleContextManager.js";
import { defaultAgentConfig } from "../src/core/DefaultAgentConfig.js";
import type { AgentConfig } from "../src/core/AgentConfig.js";
import type { AgentContext } from "../src/core/AgentContext.js";
import type { SessionStore } from "../src/memory/SessionStore.js";
import { AgentSessionManager } from "../src/memory/AgentSessionManager.js";
import { buildSystemMessage } from "../src/core/SystemPrompt.js";
import { ScriptedFakeLlmClient } from "../src/llm/ScriptedFakeLlmClient.js";
import { ListFilesTool } from "../src/core/tools/ListFilesTool.js";

function createConfig(
  overrides: Partial<AgentConfig> = {},
): AgentConfig {
  return { ...defaultAgentConfig, ...overrides };
}

function createAgent(
  config: AgentConfig,
  llm: ScriptedFakeLlmClient,
): Agent {
  return new Agent(
    llm,
    new ToolRegistry(),
    config,
    new SimpleContextManager(config.contextPolicy),
  );
}

class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, AgentContext>();

  save(context: AgentContext): void {
    this.sessions.set(context.sessionId, context);
  }

  load(sessionId: string): AgentContext | undefined {
    return this.sessions.get(sessionId);
  }
}

describe("Agent system prompt", () => {
  it("provides a default system prompt and sends it first", async () => {
    const config = createConfig();

    expect(config.systemPrompt.length).toBeGreaterThan(0);

    const llm = new ScriptedFakeLlmClient([{ content: "done" }]);
    const agent = createAgent(config, llm);

    await agent.run("hi");

    const request = llm.getRequests()[0][0];

    expect(request[0].role).toBe("system");
    expect(request[0].content).toContain(config.systemPrompt);
    expect(request[0].content).toContain(
      `Working directory: ${config.workingDirectory}`,
    );
    expect(request[1].role).toBe("user");
  });

  it("sends a configured custom system prompt", async () => {
    const config = createConfig({
      systemPrompt: "You are a unit-test bot.",
    });

    const llm = new ScriptedFakeLlmClient([{ content: "done" }]);
    const agent = createAgent(config, llm);

    await agent.run("hi");

    const systemMessage = llm.getRequests()[0][0][0];

    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("You are a unit-test bot.");
    expect(systemMessage.content).not.toContain("You are sd-harness");
  });

  it("represents the configured working directory from AgentConfig", async () => {
    const config = createConfig({
      systemPrompt: "Work here.",
      workingDirectory: "/opt/unit-workspace",
    });

    const llm = new ScriptedFakeLlmClient([{ content: "done" }]);
    const agent = createAgent(config, llm);

    await agent.run("hi");

    const systemContent = llm.getRequests()[0][0][0].content;

    expect(systemContent).toContain(
      `Working directory: ${config.workingDirectory}`,
    );
    expect(systemContent).toContain("/opt/unit-workspace");
  });

  it("sends instructions as a system message, not merged into a user message", async () => {
    const config = createConfig({
      systemPrompt: "Custom instructions.",
    });

    const llm = new ScriptedFakeLlmClient([{ content: "done" }]);
    const agent = createAgent(config, llm);

    await agent.run("say hello");

    const request = llm.getRequests()[0][0];

    expect(request[0].role).toBe("system");
    expect(
      request.filter((message) => message.role === "system").length,
    ).toBe(1);

    const userMessage = request.find((message) => message.role === "user");
    expect(userMessage?.content).toBe("say hello");
    expect(userMessage?.content).not.toContain("Custom instructions.");
  });

  it("does not persist the system prompt as a conversation message", async () => {
    const config = createConfig();
    const llm = new ScriptedFakeLlmClient([{ content: "persisted" }]);

    const store = new InMemorySessionStore();
    const sessions = new AgentSessionManager(createAgent(config, llm), store);

    const started = await sessions.start("persist me");

    const persisted = store.load(started.result.sessionId)!;

    expect(persisted.messages.length).toBeGreaterThanOrEqual(2);
    expect(persisted.messages.every((message) => message.role !== "system")).toBe(
      true,
    );
    expect(persisted.messages[0]).toEqual({ role: "user", content: "persist me" });
    expect(
      persisted.messages.some((message) =>
        message.content.includes("software development assistant"),
      ),
    ).toBe(false);
  });

  it("reapplies the system prompt when a persisted session is continued", async () => {
    const config = createConfig();
    const store = new InMemorySessionStore();

    const startLlm = new ScriptedFakeLlmClient([{ content: "answer one" }]);
    const startSessions = new AgentSessionManager(
      createAgent(config, startLlm),
      store,
    );

    const started = await startSessions.start("first");

    // A fresh agent and session manager over the same store simulates a
    // new process resuming the persisted session.
    const continueLlm = new ScriptedFakeLlmClient([{ content: "answer two" }]);
    const continueSessions = new AgentSessionManager(
      createAgent(config, continueLlm),
      store,
    );

    const continued = await continueSessions.continue(
      started.result.sessionId,
      "second",
    );

    expect(continued.result.answer).toBe("answer two");

    const continueRequest = continueLlm.getRequests()[0][0];
    expect(continueRequest[0].role).toBe("system");
    expect(continueRequest[0].content).toBe(buildSystemMessage(config).content);

    // Restored history is intact and still free of system messages.
    const persisted = store.load(started.result.sessionId)!;
    const userMessages = persisted.messages.filter(
      (message) => message.role === "user",
    );
    expect(userMessages.map((message) => message.content)).toEqual([
      "first",
      "second",
    ]);
    expect(persisted.messages.every((message) => message.role !== "system")).toBe(
      true,
    );
  });

  it("keeps system instructions when conversation is truncated", async () => {
    const config = createConfig({
      contextPolicy: { maxMessages: 2 },
    });

    const llm = new ScriptedFakeLlmClient([
      { content: "answer one" },
      { content: "answer two" },
      { content: "answer three" },
    ]);

    const store = new InMemorySessionStore();
    const sessions = new AgentSessionManager(createAgent(config, llm), store);

    const started = await sessions.start("First message");
    const sessionId = started.result.sessionId;

    await sessions.continue(sessionId, "Second message");
    const third = await sessions.continue(sessionId, "Third message");

    expect(third.result.answer).toBe("answer three");

    const lastRequest = llm.getRequests()[2][0];

    // System instructions survive truncation unchanged.
    expect(lastRequest[0].role).toBe("system");
    expect(lastRequest[0].content).toBe(buildSystemMessage(config).content);

    // Conversation messages are still truncated per the context policy.
    const conversation = lastRequest.filter(
      (message) => message.role !== "system",
    );
    expect(conversation.length).toBeLessThanOrEqual(2);
    expect(conversation[conversation.length - 1].content).toBe("Third message");

    // The persisted history keeps everything, with no system message.
    const persisted = store.load(sessionId)!;
    expect(persisted.messages.length).toBe(6);
    expect(persisted.messages.every((message) => message.role !== "system")).toBe(
      true,
    );
  });

  it("keeps tool calling working with the system prompt present", async () => {
    const config = createConfig();

    const llm = new ScriptedFakeLlmClient([
      {
        toolCalls: [
          {
            id: "call_list",
            name: "list_files",
            arguments: JSON.stringify({ path: "." }),
          },
        ],
      },
      { content: "Files listed." },
    ]);

    const registry = new ToolRegistry();
    registry.register(new ListFilesTool());

    const agent = new Agent(
      llm,
      registry,
      config,
      new SimpleContextManager(config.contextPolicy),
    );

    const result = await agent.run("List files");

    expect(result.answer).toBe("Files listed.");
    expect(result.iterations).toBe(2);

    const toolRequest = llm.getRequests()[1][0];
    expect(toolRequest[0].role).toBe("system");
    expect(
      toolRequest.some((message) => message.role === "tool"),
    ).toBe(true);
  });
});
