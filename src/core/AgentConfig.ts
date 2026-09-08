/**
 * Explicit context-management policy for the agent.
 *
 * Controls how much conversation history is sent to the LLM on each
 * request. Kept provider-independent: message counts, not tokens, since
 * the runtime has no token-counting infrastructure.
 */
export interface ContextPolicy {
  /**
   * Maximum number of messages included in an LLM request after
   * structure-preserving truncation.
   */
  maxMessages: number;
}

export interface AgentConfig {
  maxIterations: number;
  toolTimeoutMs: number;

  /**
   * Directory the agent's file tools are restricted to.
   */
  workingDirectory: string;

  /**
   * Conversation history policy applied before each LLM request.
   */
  contextPolicy: ContextPolicy;
}
