# TODO — Milestone 4 follow-ups

Status of Milestone 4 (Agent Identity & System Prompt): implemented and
verified (65 tests pass, tsc build clean) but intentionally NOT committed
yet. Milestones 1–3 are committed (M3 in 4e91ae7).

## Finish Milestone 4

- [ ] Review the uncommitted Milestone 4 diff (files below)
- [ ] Commit the Milestone 4 changes once reviewed

Files awaiting commit:

```text
M src/core/Agent.ts
M src/core/AgentConfig.ts
M src/core/DefaultAgentConfig.ts
A src/core/SystemPrompt.ts
M tests/AgentSessionManager.test.ts
A tests/AgentSystemPrompt.test.ts
M TODO.md
M Readme.md
M PROJECT_STATE.md
```

## Milestone 4 limitations discovered during implementation

- [ ] Decide whether the system message should count against
      contextPolicy.maxMessages — today the policy budgets conversation
      messages only, so a request is up to maxMessages + 1 messages
- [ ] Consider pinning the system prompt per session: the prompt is
      re-derived from the current AgentConfig on every continue, so
      changing systemPrompt/workingDirectory between sessions re-prompts
      old history with the new instructions
- [ ] Consider per-session prompt overrides (prompt is always
      config-driven today; no way to store a custom prompt with a session)
- [ ] Consolidate system-message handling: the Agent prepends the system
      message after truncation, so SimpleContextManager's internal
      system-preservation logic is now only defensive (for histories that
      already contain system messages)

## Unresolved Milestone 3 follow-ups (still genuine)

- [ ] Consider token-aware context limits
      (policy is message-count based; no token-counting infra yet)
- [ ] Decide behavior when a single newest tool round exceeds
      maxMessages — currently kept whole, validity over the hard cap
- [ ] Surface truncation to the agent explicitly
      (no metadata on AgentContext today; a truncation signal or event
      would prevent silent loss of oldest instructions)
- [ ] Harden truncation for histories that do not start with a user
      message (currently trimmed only as a whole unit)

## Constraints to respect

- [ ] Do not start Milestone 5 until its brief is provided
- [ ] No terminal/shell execution, multi-agent behavior, long-term
      semantic memory, RAG, or embeddings until explicitly briefed
- [ ] File-tool behavior must remain unchanged by identity work
- [ ] Keep system-prompt handling provider-independent
