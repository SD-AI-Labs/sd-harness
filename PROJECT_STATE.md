# sd-harness — Project State

Date: 2026-09-07
Status: Inspected, no modifications made.

---

## 1. What sd-harness currently does

sd-harness is a lightweight TypeScript agent runtime — a minimal ReAct-style loop that wraps LLM calls with tool execution. You give it a natural-language prompt, it can call registered tools (e.g. `list_files`), feed results back to the LLM, and loop until the LLM returns a plain-text final answer or hits a max-iteration limit.

The CLI entry point boots a single agent with one tool (`list_files`), prompts it with "List files in the current directory", and prints the answer plus a trace.

**Not yet:** multi-turn interactive mode, real CLI argument parsing, multiple tools, or a production UX. The project is a working core — scaffolding for a coding/tool-using agent, not a finished agent application.

---

## 2. Current architecture

Three layers, all wired through interfaces and dependency injection:

```
CLI entry (src/cli/index.ts)
  │
  ├── ToolRegistry ──► ListFilesTool (only real tool)
  │
  ├── Agent ──► ToolExecutor ──► Tool (interface)
  │      │                           │
  │      └── ContextManager ──► SimpleContextManager (sliding window)
  │      │
  │      └── LlmClient (interface) ──► OpenAiLlmClient / DeepSeekLlmClient
  │                                              │
  │                                              └── openai npm SDK (both providers)
  │
  └── Observers (AgentObserver interface)
         ├── ConsoleAgentObserver
         └── TraceAgentObserver

Session layer (src/memory/), tested but NOT wired into the CLI flow:
  AgentSessionManager ──► SessionStore (interface) ──► SqliteSessionStore ──► better-sqlite3 DB
```

**LLM abstraction:** `LlmClient` interface has one method — `chat(messages, tools?) → LlmResponse`. Both real backends (OpenAI, DeepSeek) delegate to the same `openai` npm SDK, differing only in base URL and model name. The factory (`LlmClientFactory`) picks the implementation by `config.provider`.

**Agent loop** (`Agent.ts`): sends messages to the LLM → if the response has tool calls, executes them via `ToolExecutor` (with timeout) → appends assistant message + tool result messages back into conversation history → repeats until the LLM returns no tool calls or max iterations hit. Events are emitted to all registered observers throughout.

**Persistence:** `AgentSessionManager` wraps `Agent` + a `SessionStore` to support `start(input)` (create + persist), `continue(sessionId, input)` (load + append + run + persist), and `getSession(sessionId)`. Storage is SQLite via `better-sqlite3`, serializing the full `AgentContext` as JSON.

**Context management:** `ContextManager.prepare(messages)` is the truncation/windowing hook. Currently only `SimpleContextManager` exists — a naive sliding window that keeps the most recent N messages.

---

## 3. Important components and their relationships

| Component | Role | Depended on by |
|---|---|---|
| `Agent` (`src/core/Agent.ts`) | ReAct loop: LLM call → tool execution → history accumulation → repeat | CLI, `AgentSessionManager`, tests |
| `Tool` (interface, `src/core/Tool.ts`) | `name`, `description`, `inputSchema` (Zod), `execute(input) → Promise<output>` | `ToolRegistry`, `ToolExecutor`, `ToolSchemaConverter` |
| `ToolRegistry` | Map-backed register/get/list | `Agent` (tool list + lookup) |
| `ToolExecutor` | Runs a tool with a configurable timeout via `Promise.race` | `Agent` |
| `ToolSchemaConverter` | Converts a Zod-based `Tool` into an `LlmToolDefinition` for the LLM | `Agent` (per-request) |
| `LlmClient` (interface) | `chat(messages, tools?) → LlmResponse` | `Agent` |
| `OpenAiLlmClient` / `DeepSeekLlmClient` | OpenAI SDK wrappers; identical structure, different base URL | `LlmClientFactory`, `Agent` |
| `LlmClientFactory` | Picks LLM implementation by `config.provider` | CLI |
| `ScriptedFakeLlmClient` | Test double: returns pre-scripted responses, records all requests | tests |
| `AgentContext` | `messages[]`, `sessionId`, optional `metadata` | `Agent`, `SessionStore`, `AgentContextFactory` |
| `Message` | Internal message type: `role`, `content`, optional `toolCalls` / `toolCallId` | `Agent`, `AgentContext`, `SimpleContextManager`, converters |
| `ContextManager` (interface) + `SimpleContextManager` | Message truncation/windowing before each LLM call | `Agent` |
| `AgentObserver` (interface) + events | Lifecycle hooks: `agent_start`, `llm_request`, `llm_response`, `tool_start`, `tool_complete`, `tool_error`, `agent_complete` | `ConsoleAgentObserver`, `TraceAgentObserver` |
| `AgentSessionManager` | Start/continue/getSession with persistence | Currently unconnected from CLI; tested directly |
| `SqliteSessionStore` | JSON-serializes `AgentContext` into SQLite `sessions` table | `AgentSessionManager` |
| `database.ts` | Creates/opens `sd-harness.db`, ensures `sessions` table exists | `SqliteSessionStore` |
| `ListFilesTool` | `list_files(path)` → `readdir(path)` | `ToolRegistry` (CLI registers it) |

---

## 4. What is implemented (working code)

- Full ReAct agent loop: LLM call → parse tool calls → execute with timeout → accumulate history → loop until final answer or max iterations. Handles tool errors by feeding error messages back as tool messages. Throws when max iterations exceeded.
- Two LLM backends (OpenAI, DeepSeek) via the OpenAI-compatible npm SDK, selectable through the factory.
- One real tool: `list_files(path)` using Node `fs/promises.readdir`.
- Event/observer system with two observers (console logging + trace capture).
- SQLite-backed session store + session manager (start/continue/getSession), fully tested.
- Naive sliding-window context manager.
- Test doubles: `FakeLlmClient`, `ScriptedFakeLlmClient` (records requests, returns scripted responses).
- OpenAI message/tool/response mapping adapters.
- CLI that runs one hardcoded prompt and prints answer + trace (demo quality).
- Test suite: 10 test files covering agent loop, tool schema conversion, OpenAI mapping, fake clients, session store, and session manager.

---

## 5. What is incomplete

- **Only one tool exists.** The `Tool` interface, registry, and executor are ready for more, but there is no `read_file`, `write_file`, shell execution, web access, or any other tool.
- **Session persistence is not wired into the main flow.** The CLI calls `Agent.run()` directly. `AgentSessionManager` is implemented and tested but orphaned — the CLI does not use it.
- **No real CLI.** The entry point hardcodes the prompt and model config. There is no argument parsing, no subcommands (`run`, `continue`, `list-sessions`), no help text.
- **No interactive / multi-turn mode.** One-shot fire-and-forget only.
- **Context management is trivial.** Only the sliding-window `SimpleContextManager` exists. The `ContextManager` interface is available for richer strategies (summarization, token-budget awareness, relevance-based trimming) but nothing is implemented.
- **No system prompt / agent persona.** The initial message is just the user prompt — there is no configurable system message shaping agent behavior.
- **No persisted trace or structured logging.** `TraceAgentObserver` captures a trace in memory for the current run, but nothing is written to disk or queryable after the fact.
- **No output-schema validation for tools.** Tools validate input with Zod; outputs are returned as-is.
- **`pnpm-workspace.yaml` exists but is unused** — the project is a single package so far.

---

## 6. Prioritized development roadmap (identified during inspection)

These are observations about what naturally comes next, not instructions. Adjust to your goals.

1. **Expand the tool inventory.** The interface and registry are ready. The most useful next tools for a coding agent: `read_file`, `write_file`, `edit_file`, `execute`/shell, and possibly `web_search` / `web_fetch`.

2. **Wire session persistence into the main flow.** Connect `AgentSessionManager` to the CLI (or whatever UX layer comes next) so `start`/`continue`/`getSession` become the primary API instead of the direct `Agent.run()` call.

3. **Improve context management beyond the sliding window.** Fill the `ContextManager` interface with something smarter — token-budget-aware truncation, summarization, system-message preservation — once conversations get long.

4. **Make the CLI a real CLI.** Add argument parsing and subcommands so the harness is usable beyond the hardcoded demo.

5. **Add a system prompt / agent persona slot.** A configurable system message is a small gap with large behavioral impact.

6. **Collapse the two LLM backends.** OpenAI and DeepSeek are both OpenAI-format. A single "openai-compatible" client parameterized by base URL + auth would merge them and make adding Groq, LM Studio, Ollama, etc. trivial.

7. **Rich observability / tracing.** Persist traces, add structured logging, and/or OpenTelemetry-style spans — the observer system already exists as a hook, the storage layer is ready.

8. **Strengthen the tool safety / error / retry story.** Tool errors are fed back to the LLM as text (correct), but there is no retry policy, no output schema validation, and no confirmation of destructive actions. This will matter once more tools exist.

9. **Multi-agent or composition layer (longer term).** The observer/event system and session manager hint at a path toward composing agents, but this is a bigger roadmap item.

---

## 7. Important architectural decisions inferred from the code

- **OpenAI-shaped LLM interface.** The whole LLM abstraction is modeled on the OpenAI function-calling pattern: assistant messages carry `tool_calls`, tool results come back as `tool`-role messages with `tool_call_id`. This is a reasonable and widely used contract, but it does mean non-OpenAI-format providers would need a new adapter layer rather than just a config tweak.

- **Zod-first tool definitions.** Tools declare input schemas with Zod, and `ToolSchemaConverter` converts them to LLM-native tool schemas. This is the correct modern approach for typed, validated tool I/O. Outputs are not currently validated.

- **Single synchronous SQLite for session storage.** `better-sqlite3` is synchronous and file-based. Fine for a local harness, but it is not a multi-process-safe or distributed choice. If multiple agents or processes share the same DB path, there could be locking/contention issues. [Uncertain: whether the intended deployment is single-process local only.]

- **Naive sliding window as the only context strategy.** The `ContextManager` interface anticipates richer strategies, but only the trivial one exists. This is a deliberate extension point, not an oversight — but it means long conversations lose history abruptly once the window fills.

- **Event-based observability from the start.** The agent emits typed lifecycle events to an array of observers. This is a good foundation for tracing, logging, and debugging. The current observers are simple (console + in-memory trace).

- **Fake/ScriptedLlmClient as the primary test strategy.** The test suite leans heavily on scripted fake responses rather than real API calls — sensible for a harness where the LLM is an external dependency.

- **FSI-style, no framework.** There is no agent framework, no runtime like LangGraph/AutoGen/CrewAI, no HTTP layer. It is plain TypeScript classes wired together. That keeps it small and understandable but means everything (UX, multiplexing, planning, memory) is on the roadmap.

---

## 8. Known risks or uncertainties

- **Only one tool, and no indication of which tools are actually wanted.** The roadmap above assumes a coding-agent toolset, but the project's intended use is not explicitly documented. [Uncertain: target persona / intended agent behavior.]

- **Session store is synchronous and local-file-based.** If the harness is ever used concurrently or across processes, `better-sqlite3` may need a different storage layer. Currently nothing in the code signals that concurrency is expected, but it is not ruled out either. [Uncertain: intended concurrency / deployment model.]

- **No system prompt / persona means agent behavior is whatever the base model defaults to.** For a tool-using agent, this can produce inconsistent or unsafe tool use. The gap is structural, not urgent, but it will matter as soon as more powerful tools exist.

- **No output validation on tools.** A tool can return anything; the LLM sees it as a string. If a tool returns malformed data, the LLM has to guess. [Uncertain: whether output schemas are planned.]

- **LLM clients are OpenAI-format specific.** Adding a non-OpenAI-format provider (e.g. Anthropic) would require new message/tool/response converters, not just a factory case. The current abstraction is clean for OpenAI-compatible models only. [Uncertain: whether non-OpenAI providers are in scope.]

- **The project is at demo/prototype maturity.** The loop works, the tests pass, but the CLI is a single hardcoded call, session persistence is unconnected, and there is no UX beyond stdout. It is a solid core, not a usable agent product yet.

- **`.gitignore` / `.env` contents were not inspected in detail.** I did not read `.env` or `.gitignore`, so I cannot confirm whether secrets, the DB file, or build artifacts are correctly excluded from version control. [Uncertain: repo hygiene for secrets and generated files.]
