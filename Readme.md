# SD Harness

A lightweight, extensible AI agent runtime built from scratch in TypeScript.

SD Harness is an experimental project focused on understanding and implementing the core building blocks behind modern AI agent frameworks rather than treating agent frameworks as a black box.

The project currently supports:

- Generic LLM abstractions
- OpenAI-compatible providers
- OpenAI and DeepSeek configuration
- Tool registration and execution
- Iterative agent execution
- Multi-step tool-calling loops
- File tools: read, write, edit, and list files
- Path-safe file access sandboxed to a working directory
- Conversation context management
- Persistent conversation sessions (SQLite)
- Session resume across processes (`--continue`)
- Agent events and observers
- Execution tracing
- Provider-independent request and response models
- Unit and integration testing

---

## Architecture

The project is structured around a provider-independent agent runtime.

```text
                         ┌──────────────────┐
                         │       CLI        │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      Agent       │
                         │                  │
                         │   Agent Loop     │
                         └────────┬─────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
      ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
      │   Context    │     │    Tools     │     │  LLM Client  │
      │   Manager    │     │   Registry   │     │ Abstraction  │
      └──────────────┘     └──────────────┘     └───────┬──────┘
                                                        │
                                      ┌─────────────────┴─────────────────┐
                                      ▼                                   ▼
                              ┌──────────────┐                    ┌──────────────┐
                              │    OpenAI    │                    │   DeepSeek   │
                              └──────────────┘                    └──────────────┘
```

The `Agent` does not directly depend on any LLM provider.

All providers implement the same `LlmClient` interface.

---

# Agent Execution Flow

The core agent loop follows this sequence:

```text
User Input
    │
    ▼
Create Agent Context
    │
    ▼
Send Conversation to LLM
    │
    ▼
Does the LLM request a tool?
    │
 ┌──┴────────┐
 │           │
 No          Yes
 │           │
 ▼           ▼
Return       Store Assistant Tool Call
Answer              │
                    ▼
              Execute Tool
                    │
                    ▼
              Store Tool Result
                    │
                    └──────────────► Send Updated Context to LLM
```

This allows the agent to execute multiple tool calls across multiple iterations before producing a final answer.

---

# Conversation Model

SD Harness maintains its own provider-independent conversation model.

```typescript
export type MessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export interface Message {
  role: MessageRole;

  content: string;

  toolCalls?: ToolCall[];

  toolCallId?: string;
}
```

A typical tool-calling conversation looks like:

```text
USER
"List files in the current directory"

        ↓

ASSISTANT
toolCalls:
  list_files()

        ↓

TOOL
toolCallId: call_1

result:
  [...]

        ↓

ASSISTANT
"Here are the files..."
```

The assistant tool call and tool result are preserved in conversation history before the next LLM request.

---

# Session Persistence

Conversations can be saved to disk and resumed later, including across separate processes.

```text
CLI (start / --continue)
          │
          ▼
AgentSessionManager
          │
          ├──► Agent
          │
          └──► SessionStore (interface)
                    │
                    └──► SqliteSessionStore
                              │
                              └──► SQLite (better-sqlite3)
```

The session manager persists the full conversation state:

```text
start(input)
  → create a session context
  → run the agent
  → save the context

continue(sessionId, input)
  → load the saved context
  → append the user message
  → run the agent
  → save the context again
```

The complete `AgentContext` — including assistant tool calls and tool results — is serialized into the SQLite `sessions` table, so a resumed conversation has its full history available.

The CLI starts a new session by default and resumes an existing one with `--continue`:

```bash
pnpm dev -- "list the files in this project"

pnpm dev -- --continue <sessionId> "now read the readme"
```

---

# Project Structure

```text
sd-harness
│
├── src
│   │
│   ├── cli
│   │   └── index.ts
│   │
│   ├── core
│   │   ├── Agent.ts
│   │   ├── AgentConfig.ts
│   │   ├── AgentContext.ts
│   │   ├── AgentContextFactory.ts
│   │   ├── AgentEvent.ts
│   │   ├── AgentObserver.ts
│   │   ├── AgentResult.ts
│   │   ├── ConsoleAgentObserver.ts
│   │   ├── DefaultAgentConfig.ts
│   │   ├── LlmToolDefinition.ts
│   │   ├── Message.ts
│   │   ├── ToolExecutor.ts
│   │   ├── ToolRegistry.ts
│   │   ├── ToolSchemaConverter.ts
│   │   ├── TraceAgentObserver.ts
│   │   │
│   │   └── tools
│   │       ├── EditFileTool.ts
│   │       ├── ListFilesTool.ts
│   │       ├── ReadFileTool.ts
│   │       ├── WriteFileTool.ts
│   │       └── pathSecurity.ts
│   │
│   ├── context
│   │   ├── ContextManager.ts
│   │   └── SimpleContextManager.ts
│   │
│   ├── llm
│   │   ├── DeepSeekLlmClient.ts
│   │   ├── FakeLlmClient.ts
│   │   ├── LlmClient.ts
│   │   ├── LlmClientFactory.ts
│   │   ├── LlmConfig.ts
│   │   ├── LlmResponse.ts
│   │   ├── OpenAiLlmClient.ts
│   │   ├── OpenAiMessageConverter.ts
│   │   ├── OpenAiResponseMapper.ts
│   │   ├── OpenAiToolConverter.ts
│   │   └── ScriptedFakeLlmClient.ts
│   │
│   └── memory
│       ├── AgentSessionManager.ts
│       ├── SessionStore.ts
│       ├── SqliteSessionStore.ts
│       └── database.ts
│
├── tests
│
├── package.json
├── tsconfig.json
└── README.md
```

The exact structure may evolve as additional capabilities are added.

---

# LLM Abstraction

The agent communicates with language models through a generic interface.

```typescript
export interface LlmClient {

  chat(
    messages: Message[],
    tools?: LlmToolDefinition[],
  ): Promise<LlmResponse>;

}
```

The Agent only knows about this interface.

It does not know whether the underlying provider is:

- OpenAI
- DeepSeek
- Another OpenAI-compatible API
- A local model provider

This keeps the core runtime independent of provider SDKs.

---

# Provider Architecture

OpenAI and DeepSeek currently use the OpenAI SDK interface.

Provider-specific conversion is isolated inside the LLM layer.

```text
Agent
  │
  │ Message[]
  ▼
LlmClient
  │
  ▼
OpenAiMessageConverter
  │
  ▼
OpenAI-Compatible API
  │
  ▼
OpenAI / DeepSeek
  │
  ▼
OpenAiResponseMapper
  │
  ▼
LlmResponse
  │
  ▼
Agent
```

Tool definitions follow a similar flow.

```text
Tool
  │
  ▼
ToolRegistry
  │
  ▼
ToolSchemaConverter
  │
  ▼
LlmToolDefinition
  │
  ▼
OpenAiToolConverter
  │
  ▼
OpenAI-Compatible Tool Definition
```

---

# Tools

Tools are registered with the `ToolRegistry`.

The current implementation includes:

```text
list_files
read_file
write_file
edit_file
```

All file tools are restricted to the agent's working directory (`AgentConfig.workingDirectory`, which defaults to `process.cwd()`). Absolute paths, `..` traversal, and symlinks that point outside the working directory are rejected before any file is touched.

- `read_file` — reads a UTF-8 text file; fails clearly for missing files and directories.
- `write_file` — creates or overwrites a text file, creating parent directories as needed.
- `edit_file` — replaces a block of text; the old text must match exactly once, otherwise the edit fails clearly (missing or ambiguous).
- `list_files` — lists files and directories at a path.

Tool execution is handled by:

```text
ToolExecutor
```

The executor provides a centralized location for handling:

- Tool execution
- Timeouts
- Errors

Future tools may include:

```text
search_files
run_command
web_search
```

Additional safety controls will be required before destructive or system-level tools are introduced.

---

# Context Management

Conversation history is managed through the `ContextManager` abstraction.

The current implementation is:

```text
SimpleContextManager
```

It limits the number of messages sent to the LLM.

Conceptually:

```text
Full Conversation
       │
       ▼
ContextManager
       │
       ▼
Relevant Recent Messages
       │
       ▼
LLM
```

Future versions may support:

- Conversation summarization
- Long-term memory
- Semantic retrieval
- Token-aware context limits

---

# Agent Events and Observability

The Agent emits events during execution.

Examples include:

```text
agent_start
llm_request
llm_response
tool_start
tool_complete
tool_error
agent_complete
```

Observers can consume these events.

Current observers include:

```text
ConsoleAgentObserver
TraceAgentObserver
```

This provides a foundation for debugging and future observability features.

Potential future additions include:

- Structured logging
- Execution timelines
- Token usage tracking
- Cost tracking
- Performance metrics
- Persistent traces

---

# Configuration

LLM configuration is supplied through environment variables.

A typical `.env` file may look like:

```env
LLM_PROVIDER=deepseek

LLM_API_KEY=your_api_key

LLM_MODEL=deepseek-chat

LLM_BASE_URL=https://api.deepseek.com
```

For OpenAI:

```env
LLM_PROVIDER=openai

LLM_API_KEY=your_api_key

LLM_MODEL=your_model

LLM_BASE_URL=https://api.openai.com/v1
```

Do not commit `.env` files.

Add the following to `.gitignore`:

```gitignore
node_modules/
dist/

.env
.env.*
!.env.example
```

An `.env.example` file should contain only variable names and example values without real credentials.

Example:

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/sd-harness.git

cd sd-harness
```

Install dependencies:

```bash
pnpm install
```

Create your environment configuration:

```bash
cp .env.example .env
```

Then update `.env` with your provider credentials.

---

# Development

Run the project in development mode:

```bash
pnpm dev
```

Build the project:

```bash
pnpm build
```

Run the compiled application:

```bash
pnpm start
```

---

# Testing

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

The project includes 45 tests across 15 files for core components such as:

- Fake and scripted fake LLM clients
- Tool implementations (list, read, write, and edit file)
- File-tool path safety (absolute paths, traversal, symlink escape)
- Tool schema conversion
- Agent tool-calling loop
- Agent invocation of file tools
- Session manager and SQLite session store
- OpenAI response mapping
- OpenAI message conversion
- OpenAI tool conversion

The goal is to keep provider-independent runtime logic testable without requiring real API calls.

---

# Current Status

The project currently has a working foundation for an extensible AI agent runtime.

Completed:

```text
✓ TypeScript project setup

✓ Generic LLM abstraction

✓ OpenAI provider support

✓ DeepSeek provider support

✓ Provider factory

✓ Environment-based configuration

✓ Agent execution loop

✓ Maximum iteration protection

✓ Tool registry

✓ Tool schema conversion

✓ Tool execution

✓ Tool timeout handling

✓ Tool error handling

✓ File tools: list_files, read_file, write_file, edit_file

✓ Working-directory sandbox for file tools

✓ Persistent sessions (SQLite)

✓ Session resume across processes (--continue)

✓ Session manager (start / continue / getSession)

✓ Canonical conversation model

✓ Assistant tool-call preservation

✓ Tool result association

✓ Context management

✓ Agent events

✓ Console observer

✓ Trace observer

✓ OpenAI-compatible message conversion

✓ OpenAI-compatible tool conversion

✓ Provider response mapping

✓ Unit tests

✓ Agent loop integration tests
```

---

# Roadmap

## Provider Layer

- [ ] Consolidate OpenAI and DeepSeek clients into a reusable OpenAI-compatible client
- [ ] Add support for additional OpenAI-compatible providers
- [ ] Add local model support
- [ ] Add provider capability detection

## Tools

- [x] Read file tool
- [x] Write file tool
- [x] Edit file tool
- [ ] Search files tool
- [ ] Command execution tool
- [ ] Web access tools
- [ ] Tool permission policies
- [x] Workspace boundaries for file tools
- [ ] Dangerous operation controls
- [ ] Shell / command sandboxing

## Conversation

- [x] Persistent conversation storage
- [x] SQLite-backed sessions
- [x] Conversation resume support
- [ ] Conversation summarization
- [ ] Token-aware context management

## Memory

- [ ] Long-term memory abstraction
- [ ] Persistent memory
- [ ] Semantic retrieval
- [ ] Relevant memory injection

## Observability

- [ ] Structured logs
- [ ] Persistent execution traces
- [ ] Execution timelines
- [ ] Token usage tracking
- [ ] Cost tracking
- [ ] Performance metrics

## Advanced Agent Capabilities

- [ ] Planning
- [ ] Task decomposition
- [ ] Retry strategies
- [ ] Reflection and evaluation
- [ ] Multi-agent coordination

---

# Project Goals

SD Harness is primarily a learning and engineering project.

The objective is to understand and implement the architecture behind AI agent systems from first principles.

The project intentionally avoids hiding the core execution model behind a large framework.

The focus is on understanding how the following pieces fit together:

```text
LLMs
  +
Conversation State
  +
Tool Calling
  +
Tool Execution
  +
Context Management
  +
Memory
  +
Observability
  +
Agent Control Loops
```

The long-term goal is to evolve SD Harness into a modular and understandable AI agent runtime where individual components can be replaced, extended, or experimented with independently.

---

# Technology Stack

- TypeScript
- Node.js
- OpenAI SDK
- Zod
- Vitest
- dotenv
- SQLite support via better-sqlite3

---

# License

Currently not specified.