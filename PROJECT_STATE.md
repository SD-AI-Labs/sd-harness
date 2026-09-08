# sd-harness — Project State

Date: 2026-09-08
Status: Milestones 1–3 implemented and verified (57 tests pass, build clean). Milestone 3 changes are uncommitted, pending review — see TODO.md.

---

## 1. What sd-harness currently does

sd-harness is a lightweight TypeScript agent runtime — a minimal ReAct-style loop that wraps LLM calls with tool execution. You give it a natural-language prompt, it can call registered tools (`list_files`, `read_file`, `write_file`, `edit_file`), feed results back to the LLM, and loop until the LLM returns a plain-text final answer or hits a max-iteration limit.

Conversations persist to SQLite and can be resumed across separate processes with `--continue`. File tools are sandboxed to a configured working directory. Context sent to the LLM is trimmed by an explicit, structure-preserving policy.

**Not yet:** shell execution, web access, real interactive mode, or multi-agent behavior. The project is a working core — scaffolding for a coding/tool-using agent, not a finished agent application.

---

## 2. Current architecture

```
CLI entry (src/cli/index.ts)
  │
  ├── ToolRegistry ──► tools: list_files, read_file, write_file, edit_file
  │                       └── pathSecurity (sandbox helper)
  │
  ├── Agent ──► ToolExecutor ──► Tool (interface)
  │      │
  │      ├── ContextManager ──► SimpleContextManager (structure-preserving,
  │      │                       policy from AgentConfig.contextPolicy)
  │      │
  │      └── LlmClient (interface) ──► OpenAiLlmClient / DeepSeekLlmClient
  │                                            │
  │                                            └── openai npm SDK (both providers)
  │
  └── Observers (AgentObserver interface)
         ├── ConsoleAgentObserver
         └── TraceAgentObserver

Session layer (src/memory/), wired into the CLI:
  AgentSessionManager ──► SessionStore (interface) ──► SqliteSessionStore ──► better-sqlite3 DB
```

**Configuration:** `AgentConfig` — `maxIterations`, `toolTimeoutMs`, `workingDirectory` (file-tool sandbox root), `contextPolicy: { maxMessages }`. Defaults live in `DefaultAgentConfig`.

**LLM abstraction:** `LlmClient` interface has one method — `chat(messages, tools?) → LlmResponse`. Both real backends (OpenAI, DeepSeek) delegate to the same `openai` npm SDK, differing only in base URL and model name. The factory (`LlmClientFactory`) picks the implementation by `config.provider`.

**Agent loop** (`Agent.ts`): sends messages to the LLM → if the response has tool calls, executes them via `ToolExecutor` (with timeout) → appends assistant message + tool result messages back into conversation history → repeats until the LLM returns no tool calls or max iterations hit. Events are emitted to all registered observers throughout.

**Context policy** (Milestone 3): before each LLM request, `Agent` calls `contextManager.prepare(context.messages)`. `SimpleContextManager` truncates to `ContextPolicy.maxMessages` while preserving structure: leading system messages always retained, exchanges grouped at user boundaries, assistant tool-call + tool-result rounds kept atomic, newest exchanges retained, oversized newest exchange trimmed between complete rounds. The stored `AgentContext` is never mutated — only the per-request copy is trimmed.

**Persistence:** `AgentSessionManager` wraps `Agent` + a `SessionStore` to support `start(input)` (create + persist), `continue(sessionId, input)` (load + append + run + persist), and `getSession(sessionId)`. Storage is SQLite via `better-sqlite3`, serializing the full `AgentContext` as JSON — full history survives regardless of truncation policy.

---

## 3. Important components and their relationships

| Component | Role | Depended on by |
|---|---|---|
| `Agent` (`src/core/Agent.ts`) | ReAct loop: LLM call → tool execution → history accumulation → repeat | CLI, `AgentSessionManager`, tests |
| `AgentConfig` + `ContextPolicy` | maxIterations, toolTimeoutMs, workingDirectory, contextPolicy.maxMessages | `DefaultAgentConfig`, `Agent`, CLI |
| `DefaultAgentConfig` | Single default config object (cwd sandbox, 20-message context policy) | CLI, tests |
| `Tool` (interface, `src/core/Tool.ts`) | `name`, `description`, `inputSchema` (Zod), `execute(input) → Promise<output>` | `ToolRegistry`, `ToolExecutor`, `ToolSchemaConverter` |
| `ToolRegistry` | Map-backed register/get/list | `Agent` (tool list + lookup) |
| `ToolExecutor` | Runs a tool with a configurable timeout via `Promise.race` | `Agent` |
| `ToolSchemaConverter` | Converts a Zod-based `Tool` into an `LlmToolDefinition` | `Agent` (per-request) |
| `ListFilesTool` | `list_files(path)` → `readdir(path)`. Legacy: not sandboxed | `ToolRegistry` (CLI registers it) |
| `ReadFileTool` | `read_file(path)` → UTF-8 content; sandboxed; errors on missing files/dirs | CLI registration |
| `WriteFileTool` | `write_file(path, content)` → `{path, bytesWritten}`; mkdir -p parents; sandboxed | CLI registration |
| `EditFileTool` | `edit_file(path, oldText, newText)` → `{path, replacements}`; unique-match required | CLI registration |
| `pathSecurity.ts` | `resolveSafePath` — rejects absolute paths, `../` traversal, symlink escape | file tools |
| `LlmClient` (interface) | `chat(messages, tools?) → LlmResponse` | `Agent` |
| `OpenAiLlmClient` / `DeepSeekLlmClient` | OpenAI SDK wrappers; identical structure, different base URL | `LlmClientFactory`, `Agent` |
| `LlmClientFactory` | Picks LLM implementation by `config.provider` | CLI |
| `ScriptedFakeLlmClient` | Test double: returns pre-scripted responses, records all requests | tests |
| `AgentContext` | `messages[]`, `sessionId`, optional `metadata` | `Agent`, `SessionStore`, `AgentContextFactory` |
| `Message` | Internal message type: `role`, `content`, optional `toolCalls` / `toolCallId` | `Agent`, converters, managers |
| `ContextManager` (interface) + `SimpleContextManager` | Structure-preserving truncation driven by `ContextPolicy` | `Agent` |
| `AgentObserver` (interface) + events | Lifecycle hooks: `agent_start`, `llm_request`, `llm_response`, `tool_start`, `tool_complete`, `tool_error`, `agent_complete` | observers |
| `AgentSessionManager` | Start/continue/getSession with persistence | CLI |
| `SqliteSessionStore` | JSON-serializes `AgentContext` into SQLite `sessions` table | `AgentSessionManager` |
| `database.ts` | Creates/opens `sd-harness.db`, ensures `sessions` table exists | `SqliteSessionStore` |

---

## 4. What is implemented (working code)

**Milestone 1 — Persistent Sessions (committed)**
- `AgentSessionManager` + `SessionStore` + `SqliteSessionStore`, wired into the CLI.
- SQLite persistence verified across separate processes; `--continue <sessionId>` restores full history.
- Assistant final responses persisted in `context.messages`.
- Integration tests cover final assistant-message persistence.

**Milestone 2 — Tool Inventory (committed)**
- `read_file`, `write_file`, `edit_file` added beside the original `list_files`.
- `AgentConfig.workingDirectory` + `pathSecurity.resolveSafePath`: rejects absolute paths, `../` traversal, and symlink-based escape; tools operate on real resolved paths.
- `write_file` creates parent directories; `edit_file` fails clearly on missing/ambiguous old text.
- CLI registers all four tools bound to the configured working directory.
- 28 new tests: per-tool unit coverage + Agent tool-loop invocation tests.

**Milestone 3 — Context Management (implemented, uncommitted)**
- `ContextPolicy { maxMessages }` on `AgentConfig`; `DefaultAgentConfig` sets 20.
- `SimpleContextManager` rewritten: structure-preserving truncation (system retention, exchange grouping, atomic tool rounds, newest-first retention), non-destructive to persisted history.
- CLI builds the manager from the config policy (magic number removed).
- 12 new tests: unit coverage of the policy + session continuation under a small window.

**Foundational**
- Full ReAct agent loop with timeout, error feed-back, max-iteration protection.
- Two LLM backends (OpenAI, DeepSeek) via the OpenAI-compatible npm SDK.
- Event/observer system with console + trace observers.
- Naive-to-now structured context manager behind the `ContextManager` interface.
- Test doubles (`FakeLlmClient`, `ScriptedFakeLlmClient`), OpenAI mapping adapters.
- CLI with start/`--continue` and printed trace.
- Test suite: 57 tests across 16 files.

---

## 5. What is incomplete / next

- **Milestone 4 and beyond not started** (per milestone sequencing).
- **No shell execution / web access tools** (deliberately deferred).
- **No system prompt / agent persona slot** — no code creates system messages yet (the truncation policy already handles them if introduced).
- **Message-count policy, not tokens** — no token-counting infrastructure.
- **No explicit truncation signal** to the agent when history is cut.
- **`list_files` is legacy-unrestricted** — a candidate for future sandboxing.
- No interactive multi-turn REPL, no real subcommand CLI (`run`, `list-sessions`, `help`).
- No persisted traces or structured logging.
- No output-schema validation for tool results.

Known limitations of the M3 truncation are tracked in TODO.md (oversized newest round kept whole, histories not starting with a user message, etc.).

---

## 6. Milestone roadmap (as executed)

1. **M1 — Persistent Sessions** ✓ committed
2. **M2 — Tool Inventory** ✓ committed
3. **M3 — Context Management** ✓ implemented + verified, changes uncommitted (see TODO.md)
4. **M4+** — as briefed by the project owner; expected candidates from PROJECT_STATE v1 roadmap: richer tooling (search/command), CLI polish, persona/system prompt, deeper observability, token-aware context, multi-agent.

---

## 7. Architectural decisions inferred from the code

- **OpenAI-shaped LLM interface** — function-calling pattern: assistant messages carry `tool_calls`, results come back as `tool`-role messages with `tool_call_id`. Non-OpenAI-format providers would need a new adapter layer.
- **Zod-first tool definitions** — schemas convert to LLM-native tool schemas via `ToolSchemaConverter`. Outputs are not validated.
- **Config-injected, interface-driven context policy** — `AgentConfig.contextPolicy` single-sources the window size; the `ContextManager` interface remains the extension point for future strategies (summarization, token budgets).
- **Truncation is request-scoped** — persisted sessions always keep full history; only the per-request copy is trimmed. Persistence model deliberately untouched.
- **Sandbox enforced per tool at construction** — tools receive the working directory; the `Tool` interface itself is unchanged.
- **Single synchronous SQLite** — fine for a local harness; not a multi-process-safe or distributed choice.
- **Fake/scripted LLM clients as the primary test strategy** — no real API calls in tests.
- **FSI-style, no framework** — plain TypeScript classes; everything (UX, memory, planning) is on the roadmap.

---

## 8. Known risks or uncertainties

- **`better-sqlite3` is synchronous and file-based** — concurrency across processes is not ruled out long-term. [Uncertain: intended concurrency model.]
- **No system prompt / persona** — agent behavior is whatever the base model defaults to; matters more as tooling grows.
- **`list_files` remains unrestricted** — inconsistent with the sandboxed file tools; intentional (kept for compatibility) but a latent gap.
- **Message-count context policy** may under- or over-shoot token budgets on variable-length messages.
- **Project maturity is prototype-level** — solid tested core, demo-grade UX.
- **TODO.md and uncommitted M3 changes** — next action is review + commit; docs in this file were synced to M3 on 2026-09-08.
