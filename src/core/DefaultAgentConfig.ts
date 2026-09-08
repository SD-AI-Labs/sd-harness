import type { AgentConfig } from "./AgentConfig.js";

export const defaultAgentConfig: AgentConfig = {
  maxIterations: 5,
  toolTimeoutMs: 10000,
  workingDirectory: process.cwd(),
};