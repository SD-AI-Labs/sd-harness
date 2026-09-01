import "dotenv/config";

import { ToolRegistry } from "../core/ToolRegistry.js";
import { ListFilesTool } from "../core/tools/ListFilesTool.js";
import { Agent } from "../core/Agent.js";
import { ConsoleAgentObserver } from "../core/ConsoleAgentObserver.js";
import { TraceAgentObserver } from "../core/TraceAgentObserver.js";

import { SimpleContextManager } from "../context/SimpleContextManager.js";

import { defaultAgentConfig } from "../core/DefaultAgentConfig.js";

import { LlmClientFactory } from "../llm/LlmClientFactory.js";
import type { LlmConfig } from "../llm/LlmConfig.js";


const registry =
  new ToolRegistry();


registry.register(
  new ListFilesTool(),
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


const result =
  await agent.run(
    "List files in the current directory",
  );


console.log(
  "\nAnswer:",
);


console.log(
  result.answer,
);


console.log(
  "\nRun information:",
);


console.log({
  sessionId:
    result.sessionId,

  iterations:
    result.iterations,

  durationMs:
    result.durationMs,
});


console.log(
  "\nTrace:",
);


console.log(
  traceObserver.getTrace(),
);