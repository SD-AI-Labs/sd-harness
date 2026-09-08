# TODO — Milestone 3 follow-ups

Status of Milestone 3 (Context Management): implemented and verified
(57 tests pass, tsc build clean) but intentionally NOT committed yet.

## Finish the milestone

- [ ] Review the uncommitted Milestone 3 diff
      (8 modified + 1 new file, listed below)
- [ ] Commit the Milestone 3 changes once reviewed

Files awaiting commit:

```text
M src/cli/index.ts
M src/context/SimpleContextManager.ts
M src/core/AgentConfig.ts
M src/core/DefaultAgentConfig.ts
M tests/AgentFileToolInvocation.test.ts
M tests/AgentSessionManager.integration.test.ts
M tests/AgentSessionManager.test.ts
M tests/AgentToolLoop.test.ts
?? tests/SimpleContextManager.test.ts
```

## Docs

- [ ] Update Readme.md for Milestone 3:
      contextPolicy config, structure-preserving truncation, test count
      (now 57 tests / 16 files)
- [ ] Sync PROJECT_STATE.md — still stale from before Milestone 1
      (sessions are wired into the CLI; file tools exist)

## Known limitations (from the M3 report)

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

- [ ] Do not start Milestone 4 until its brief is provided
- [ ] File tools remain untouched by context work
- [ ] Keep context policy provider-independent
