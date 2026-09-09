# sd-harness — Project State

Date: 2026-09-08
Status: Milestones 1–4 implemented and verified (65 tests pass, build clean). Milestone 1–3 committed; Milestone 4 changes are uncommitted, pending review — see TODO.md.

---

## 1. What sd-harness currently does

sd-harness is a lightweight TypeScript agent runtime — a minimal ReAct-style loop that wraps LLM calls with tool execution. You give it a natural-language prompt, it can call registered tools (`list_files`, `read_file`, `write_file`, `edit_file`), feed results back to the LLM, and loop until the LLM returns a plain-text final answer or hits a max-iteration limit.

The agent carries a configurable system prompt / identity and is told which working directory its file tools are sandboxed to. Conversations persist to SQLite and can be resumed across separate processes with `--continue`. Context sent to the LLM is trimmed by an explicit, structure-preserving policy; system instructions are composed per request and never stored with the conversation.

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
  │      ├── SystemPrompt.buildSystemMessage(config)
  │      │       └── system message prepended to every LLM request
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

**Configuration:** `AgentConfig` — `maxIterations`, `toolTimeoutMs`, `workingDirectory` (file-tool sandbox root), `contextPolicy: { maxMessages }`, `systemPrompt` (agent identity/instructions). Defaults live in `DefaultAgentConfig` (which also exports `defaultSystemPrompt`).

**LLM abstraction:** `LlmClient` interface has one method — `chat(messages, tools?) → LlmResponse`. Both real backends (OpenAI, DeepSeek) delegate to the same `openai` npm SDK, differing only in base URL and model name. `LlmClientFactory` picks the implementation by `config.provider`. `OpenAiMessageConverter` already maps the runtime's `system` role to a provider system message.

**Agent loop** (`Agent.ts`): per iteration, builds `[systemMessage, ...preparedConversation]` and calls `llm.chat`. If the response has tool calls, they are executed via `ToolExecutor` (with timeout); assistant messages and tool results are appended to `context.messages`; loop until the LLM returns no tool calls or max iterations hit. Events are emitted to all registered observers throughout.

**System prompt / agent identity** (Milestone 4): `AgentConfig.systemPrompt` holds the instructions (default = coding-assistant persona in `defaultSystemPrompt`; a custom string replaces it entirely). `buildSystemMessage(config)` composes the configured text with `Working directory: <AgentConfig.workingDirectory>` and returns a real `system` message. The Agent prepends it to every request **after** context preparation. It is never pushed into `AgentContext.messages`, so it is never persisted; on session resume the current config's prompt is re-applied over the restored history.

**Context policy** (Milestone 3): before each LLM request, `SimpleContextManager.prepare()` truncates a copy of `context.messages` to `contextPolicy.maxMessages` while preserving structure (leading system messages retained if present, exchanges grouped at user boundaries, assistant tool-call + tool-result rounds atomic, newest exchanges retained, oversized newest exchange trimmed between rounds). The stored `AgentContext` is never mutated. Because the Agent composes the system message after preparation, truncation can never remove it.

**Persistence:** `AgentSessionManager` wraps `Agent` + a `SessionStore` to support `start(input)` (create + persist), `continue(sessionId, input)` (load + append + run + persist), and `getSession(sessionId)`. Storage is SQLite via `better-sqlite3`, serializing the full `AgentContext` as JSON — pure user/assistant/tool conversation, no system messages.

---

## 3. Important components and their relationships

| Component | Role | Depended on by |
|---|---|---|
| `Agent` (`src/core/Agent.ts`) | ReAct loop; composes system message + prepared conversation per request | CLI, `AgentSessionManager`, tests |
| `AgentConfig` + `ContextPolicy` | maxIterations, toolTimeoutMs, workingDirectory, contextPolicy.maxMessages, systemPrompt | `DefaultAgentConfig`, `Agent`, CLI |
| `DefaultAgentConfig` / `defaultSystemPrompt` | Single default config (cwd sandbox, 20-message policy, coding-agent persona) | CLI, tests |
| `buildSystemMessage` (`SystemPrompt.ts`) | Config → proper `system` Message, prompt text + working-directory line | `Agent` |
| `Tool` (interface, `src/core/Tool.ts`) | `name`, `description`, `inputSchema` (Zod), `execute(input) → Promise<output>` | `ToolRegistry`, `ToolExecutor`, `ToolSchemaConverter` |
| `ToolRegistry` | Map-backed register/get/list | `Agent`, CLI |
| `ToolExecutor` | Runs a tool with a configurable timeout via `Promise.race` | `Agent` |
| `ListFilesTool` | `list_files(path)` → `readdir(path)`. Legacy: not sandboxed | CLI registration |
| `ReadFileTool` | `read_file(path)` → UTF-8 content; sandboxed; errors on missing files/dirs | CLI registration |
| `WriteFileTool` | `write_file(path, content)` → `{path, bytesWritten}`; mkdir -p parents; sandboxed | CLI registration |
| `EditFileTool` | `edit_file(path, oldText, newText)` → `{path, replacements}`; unique-match required | CLI registration |
| `pathSecurity.ts` | `resolveSafePath` — rejects absolute paths, `../` traversal, symlink escape | file tools |
| `LlmClient` (interface) | `chat(messages, tools?) → LlmResponse` | `Agent` |
| `OpenAiLlmClient` / `DeepSeekLlmClient` | OpenAI SDK wrappers; identical structure, different base URL | `LlmClientFactory` |
| `ScriptedFakeLlmClient` | Test double: returns pre-scripted responses, records all requests | tests |
| `AgentContext` | `messages[]`, `sessionId`, optional `metadata` — conversation only, no system prompt | `Agent`, `SessionStore`, `AgentContextFactory` |
| `Message` | Internal message type: `role` (incl. `system`), `content`, optional `toolCalls` / `toolCallId` | `Agent`, converters, managers |
| `ContextManager` (interface) + `SimpleContextManager` | Structure-preserving truncation driven by `ContextPolicy` | `Agent` |
| `AgentSessionManager` | Start/continue/getSession with persistence | CLI |
| `SqliteSessionStore` | JSON-serializes `AgentContext` into SQLite `sessions` table | `AgentSessionManager` |
| `database.ts` | Creates/opens `sd-harness.db`, ensures `sessions` table exists | `SqliteSessionStore` |

---

## 4. What is implemented (working code)

**Milestone 1 — Persistent Sessions (committed, 4f470f3)**
- `AgentSessionManager` + `SessionStore` + `SqliteSessionStore`, wired into the CLI; `--continue <sessionId>` restores full history; assistant final responses persisted in `context.messages`; integration tests cover cross-process persistence.

**Milestone 2 — Tool Inventory (committed, 7c095e4)**
- `read_file`, `write_file`, `edit_file` beside the original `list_files`.
- `AgentConfig.workingDirectory` + `pathSecurity.resolveSafePath`: rejects absolute paths, `../` traversal, and symlink escape; tools operate on real resolved paths; `write_file` mkdir -p; `edit_file` fails on missing/ambiguous text.

**Milestone 3 — Context Management (committed, 4e91ae7)**
- `ContextPolicy { maxMessages }` on `AgentConfig` (default 20); `SimpleContextManager` rewritten for structure-preserving truncation; non-destructive to persisted history; CLI builds the manager from config.

**Milestone 4 — Agent Identity & System Prompt (implemented; uncommitted)**
- `AgentConfig.systemPrompt` with default coding-agent persona (`defaultSystemPrompt` in `DefaultAgentConfig`); custom prompt replaces it.
- `buildSystemMessage(config)` composes prompt + `Working directory: <config.workingDirectory>` into a real `system` message; the Agent prepends it to every LLM request after truncation.
- System instructions never enter `AgentContext.messages` → not persisted; re-applied from config on session resume.
- Message model/converter unchanged (`system` role already supported); provider-independent.
- 8 new tests (default prompt present + sent, custom prompt, workingDirectory from AgentConfig, system/user separation, no persistence of prompt, continuation re-applies prompt with intact history, prompt survives truncation, tool calling works with system present).

**Foundational**
- ReAct loop with timeout, error feed-back, max-iteration protection; OpenAI/DeepSeek backends; event/observer system; test doubles; OpenAI mapping adapters; CLI with start/`--continue` + trace. Test suite: 65 tests across 17 files. Build: `tsc` clean.

---

## 5. What is incomplete / next

- **Milestone 5+ not started** (per milestone sequencing).
- **No shell execution / web access tools** (deliberately deferred).
- **No interactive multi-turn REPL**, no real subcommand CLI (`run`, `list-sessions`, `help`).
- **No persisted traces or structured logging**; no output-schema validation for tool results.
- **`list_files` is legacy-unrestricted** — candidate for future sandboxing.
- **No per-session prompt pinning** — the prompt is config-derived on every run.

## 6. Known limitations

- Context policy is message-count based; no token accounting (system message is an extra message beyond `maxMessages`).
- A single newest tool round larger than `maxMessages` is kept whole (validity over the cap).
- No explicit truncation signal to the agent when history is cut.
- Histories not starting with a user message are only trimmed as a whole unit.
- Changing `systemPrompt`/`workingDirectory` between sessions re-prompts old history with the new config (no per-session pinning).
- `SimpleContextManager`'s internal system-preservation is now defensive only (Agent prepends post-truncation).
- `better-sqlite3` is synchronous and file-based (local harness scope).

Milestone 4 limitations and follow-ups are tracked in TODO.md.

---

## 7. Milestone roadmap (as executed)

1. **M1 — Persistent Sessions** ✓ committed
2. **M2 — Tool Inventory** ✓ committed
3. **M3 — Context Management** ✓ committed
4. **M4 — Agent Identity & System Prompt** ✓ implemented + verified, changes uncommitted (see TODO.md)
5. **M5+** — as briefed by the project owner. Plausible candidates from the original roadmap: richer tooling (search/command — terminal explicitly deferred), CLI polish, deeper observability, token-aware context, multi-agent. Nothing invented beyond the existing plan.

---

## 8. Architectural decisions inferred from the code

- **OpenAI-shaped LLM interface** — assistant `tool_calls`, `tool`-role results with `tool_call_id`; non-OpenAI-format providers need an adapter layer.
- **Zod-first tool definitions** — schemas convert to LLM-native tool schemas; outputs not validated.
- **Config-injected policies** — `contextPolicy` and `systemPrompt` both live on `AgentConfig` and are single-sourced in `DefaultAgentConfig`; working directory is configured once (M2) and both enforced by tools and surfaced via the system message.
- **System prompt as a request-time composition** — never stored, never truncated; keeps persistence schema and context manager unchanged.
- **Truncation is request-scoped** — persisted sessions always keep full history.
- **Sandbox enforced per tool at construction** — `Tool` interface unchanged across M2–M4.
- **Single synchronous SQLite** — fine locally; not a distributed choice.
- **Fake/scripted LLM clients as the primary test strategy** — no real API calls in tests.
- **FSI-style, no framework** — plain TypeScript classes wired together.

---

## 9. Risks / open questions

- `better-sqlite3` concurrency across processes. [Uncertain: intended deployment.]
- Prompt/identity is config-global, not per-session; desired once real product UX lands. [Uncertain: whether sessions should pin prompts.]
- `list_files` unrestricted vs sandboxed peers — intentional compatibility gap.
- Prototype maturity: solid tested core, demo-grade CLI UX.
- TODO.md + uncommitted M4 changes: next action is review + commit.
