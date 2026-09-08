import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Agent } from "../src/core/Agent.js";
import { ToolRegistry } from "../src/core/ToolRegistry.js";
import { SimpleContextManager } from "../src/context/SimpleContextManager.js";
import { defaultAgentConfig } from "../src/core/DefaultAgentConfig.js";
import { ScriptedFakeLlmClient } from "../src/llm/ScriptedFakeLlmClient.js";
import type { LlmClient } from "../src/llm/LlmClient.js";

import { ListFilesTool } from "../src/core/tools/ListFilesTool.js";
import { ReadFileTool } from "../src/core/tools/ReadFileTool.js";
import { WriteFileTool } from "../src/core/tools/WriteFileTool.js";
import { EditFileTool } from "../src/core/tools/EditFileTool.js";

import { createTempDir, removeTempDir } from "./toolTestUtils.js";

describe("Agent file tool invocation", () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  function runAgent(llm: LlmClient, tools: ToolRegistry): Agent {
    return new Agent(
      llm,
      tools,
      defaultAgentConfig,
      new SimpleContextManager({
        maxMessages: 20,
      }),
    );
  }

  it("advertises read_file, write_file and edit_file to the LLM", async () => {
    const llm = new ScriptedFakeLlmClient([{ content: "ok" }]);

    const registry = new ToolRegistry();
    registry.register(new ListFilesTool());
    registry.register(new ReadFileTool(root));
    registry.register(new WriteFileTool(root));
    registry.register(new EditFileTool(root));

    const agent = runAgent(llm, registry);

    await agent.run("hello");

    const advertisedTools = llm.getRequests()[0][1];
    const names = advertisedTools?.map(
      (definition) => definition.function.name,
    );

    expect(names).toContain("list_files");
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("edit_file");
  });

  it("invokes read_file through the tool-calling loop", async () => {
    await writeFile(join(root, "greeting.txt"), "hello agent", "utf8");

    const llm = new ScriptedFakeLlmClient([
      {
        toolCalls: [
          {
            id: "call_read",
            name: "read_file",
            arguments: JSON.stringify({ path: "greeting.txt" }),
          },
        ],
      },
      { content: "The file says hello agent." },
    ]);

    const registry = new ToolRegistry();
    registry.register(new ReadFileTool(root));

    const agent = runAgent(llm, registry);

    const result = await agent.run("Read greeting.txt");

    expect(result.answer).toBe("The file says hello agent.");
    expect(result.iterations).toBe(2);
    expect(llm.getCallCount()).toBe(2);

    // The tool result must have been fed back to the LLM.
    const secondMessages = llm.getRequests()[1][0];
    const toolMessage = secondMessages.find(
      (message) => message.role === "tool",
    );
    expect(toolMessage?.content).toContain("hello agent");
  });

  it("invokes write_file and persists the file on disk", async () => {
    const llm = new ScriptedFakeLlmClient([
      {
        toolCalls: [
          {
            id: "call_write",
            name: "write_file",
            arguments: JSON.stringify({
              path: "src/generated.txt",
              content: "made by agent",
            }),
          },
        ],
      },
      { content: "Wrote the file." },
    ]);

    const registry = new ToolRegistry();
    registry.register(new WriteFileTool(root));

    const agent = runAgent(llm, registry);

    const result = await agent.run("Write a file");

    expect(result.answer).toBe("Wrote the file.");
    expect(
      await readFile(join(root, "src", "generated.txt"), "utf8"),
    ).toBe("made by agent");

    const secondMessages = llm.getRequests()[1][0];
    const toolMessage = secondMessages.find(
      (message) => message.role === "tool",
    );
    expect(toolMessage?.content).toContain("src/generated.txt");
  });

  it("invokes edit_file and applies the replacement on disk", async () => {
    await writeFile(join(root, "todo.txt"), "alpha\nbeta\nalpha", "utf8");

    const llm = new ScriptedFakeLlmClient([
      {
        toolCalls: [
          {
            id: "call_edit",
            name: "edit_file",
            arguments: JSON.stringify({
              path: "todo.txt",
              oldText: "beta",
              newText: "BETA",
            }),
          },
        ],
      },
      { content: "Edited the file." },
    ]);

    const registry = new ToolRegistry();
    registry.register(new EditFileTool(root));

    const agent = runAgent(llm, registry);

    const result = await agent.run("Edit todo.txt");

    expect(result.answer).toBe("Edited the file.");
    expect(await readFile(join(root, "todo.txt"), "utf8")).toBe(
      "alpha\nBETA\nalpha",
    );
  });
});
