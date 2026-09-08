import "dotenv/config";

import { ToolRegistry } from "../core/ToolRegistry.js";
import { ListFilesTool } from "../core/tools/ListFilesTool.js";
import { ReadFileTool } from "../core/tools/ReadFileTool.js";
import { WriteFileTool } from "../core/tools/WriteFileTool.js";
import { EditFileTool } from "../core/tools/EditFileTool.js";
import { Agent } from "../core/Agent.js";
import { ConsoleAgentObserver } from "../core/ConsoleAgentObserver.js";
import { TraceAgentObserver } from "../core/TraceAgentObserver.js";

import { SimpleContextManager } from "../context/SimpleContextManager.js";

import { defaultAgentConfig } from "../core/DefaultAgentConfig.js";

import { LlmClientFactory } from "../llm/LlmClientFactory.js";
import type { LlmConfig } from "../llm/LlmConfig.js";

import { AgentSessionManager } from "../memory/AgentSessionManager.js";
import { SqliteSessionStore } from "../memory/SqliteSessionStore.js";


const registry =
  new ToolRegistry();


registry.register(
  new ListFilesTool(),
);

registry.register(
  new ReadFileTool(
    defaultAgentConfig.workingDirectory,
  ),
);

registry.register(
  new WriteFileTool(
    defaultAgentConfig.workingDirectory,
  ),
);

registry.register(
  new EditFileTool(
    defaultAgentConfig.workingDirectory,
  ),
);


const contextManager =
  new SimpleContextManager(
    20,
  );


const traceObserver =
  new TraceAgentObserver();


const config: LlmConfig = {

  provider:
    process.env.LLM_PROVIDER ??
    "deepseek",

  apiKey:
    process.env.LLM_API_KEY ??
    "",

  model:
    process.env.LLM_MODEL ??
    "deepseek-chat",

  baseUrl:
    process.env.LLM_BASE_URL ??
    "https://api.deepseek.com",
};


if (!config.apiKey) {

  throw new Error(
    "LLM_API_KEY is missing. Check your .env file.",
  );
}


const llm =
  LlmClientFactory.create(
    config,
  );


const agent =
  new Agent(
    llm,
    registry,
    defaultAgentConfig,
    contextManager,
    [
      new ConsoleAgentObserver(),
      traceObserver,
    ],
  );


const store =
  new SqliteSessionStore();


const sessionManager =
  new AgentSessionManager(
    agent,
    store,
  );


/*
 * Minimal argument parsing.
 *
 * Usage:
 *   node index.ts "prompt"                        → start new session
 *   node index.ts --continue <sessionId> "prompt" → continue existing session
 */

const args =
  process.argv.slice(2);


if (args.length === 0) {

  console.error(
    "Usage:",
  );

  console.error(
    "  node index.ts \"prompt\"",
  );

  console.error(
    "  node index.ts --continue <sessionId> \"prompt\"",
  );

  process.exit(1);
}


let sessionId: string | undefined;
let userInput: string;

if (args[0] === "--continue") {

  if (args.length < 3) {

    console.error(
      "Error: --continue requires a sessionId and a prompt",
    );

    process.exit(1);
  }

  sessionId = args[1];
  userInput = args[2];

} else {

  userInput = args[0];
}


/*
 * Execute via session manager.
 */

let result;

if (sessionId) {

  console.log(
    `Continuing session: ${sessionId}`,
  );

  result =
    await sessionManager.continue(
      sessionId,
      userInput,
    );

} else {

  result =
    await sessionManager.start(
      userInput,
    );
}


console.log(
  "\nAnswer:",
);

console.log(
  result.result.answer,
);

console.log(
  "\nRun information:",
);

console.log({
  sessionId:
    result.result.sessionId,

  iterations:
    result.result.iterations,

  durationMs:
    result.result.durationMs,
});

console.log(
  "\nTrace:",
);

console.log(
  traceObserver.getTrace(),
);
