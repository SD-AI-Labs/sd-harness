export interface AgentConfig {
  maxIterations: number;
  toolTimeoutMs: number;

  /**
   * Directory the agent's file tools are restricted to.
   */
  workingDirectory: string;
}