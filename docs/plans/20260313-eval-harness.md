# Eval Harness

## Overview

A lightweight, headless evaluation harness that runs scripted conversations against agents and captures a full trace of everything that happened — messages sent/received, tool calls, automations created, RLM execution — rendered as a human-readable markdown report.

**End result:** A developer can write a JSON scenario file specifying an agent kind/path and a sequence of conversation turns, run it via a CLI command (`yarn eval <scenario.json>`), and get back a markdown report showing the complete agent behavior trace for human review.

**Key properties:**
- Runs fully in-process with PGlite (no HTTP, no portless, no external services)
- Uses `AgentSystem.postAndAwait()` for synchronous message delivery (already exists)
- Uses `agentHistoryLoad()` to capture full history after each turn
- Scenario references agent kind/path — does not define agent config inline
- Output is a markdown file with conversation log, tool calls, and all side effects

## Context

**Existing infrastructure that this builds on:**
- `agentSystem.spec.ts` has a `harnessCreate()` function that boots `AgentSystem` with PGlite in-memory — this is the template
- `AgentSystem.postAndAwait()` already delivers messages synchronously and returns `AgentInboxResult`
- `agentHistoryLoad()` retrieves full session history as `AgentHistoryRecord[]`
- `AgentHistoryRecord` captures all event types: `user_message`, `assistant_message`, `rlm_start`, `rlm_tool_call`, `rlm_tool_result`, `rlm_complete`, `note`
- Agent path builders (`agentPathAgent`, `agentPathConnector`, etc.) handle kind-to-path mapping

**Key files:**
- `sources/engine/agents/agentSystem.ts` — `AgentSystem` class, `postAndAwait()`
- `sources/engine/agents/agentSystem.spec.ts` — `harnessCreate()` test harness (line 896)
- `sources/engine/agents/ops/agentTypes.ts` — `AgentHistoryRecord`, `AgentInboxItem`
- `sources/engine/agents/ops/agentHistoryLoad.ts` — history retrieval
- `sources/engine/agents/ops/agentPathBuild.ts` — path builders
- `sources/config/configResolve.ts` — config creation

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change

## Testing Strategy
- **Unit tests**: required for every task — scenario parsing, trace rendering, harness boot
- Tests use in-memory PGlite (`:memory:`) and mock inference router (canned responses)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Scenario format — parse and validate JSON scenario files

Define the scenario JSON schema and write a parser/validator.

Scenario format:
```json
{
    "name": "greeting-test",
    "agent": {
        "kind": "agent",
        "path": "test-agent"
    },
    "turns": [
        { "role": "user", "text": "Hello, what can you do?" },
        { "role": "user", "text": "Create a reminder for tomorrow" }
    ]
}
```

- `agent.kind` maps to an `AgentKind` (e.g. `"agent"`, `"connector"`, `"cron"`)
- `agent.path` is the name/id segment used with the path builder
- `turns` is a sequential list of user messages to send

Files: `sources/eval/evalScenario.ts`, `sources/eval/evalScenario.spec.ts`

- [x] Define `EvalScenario` and `EvalTurn` types
- [x] Implement `evalScenarioParse(json: unknown): EvalScenario` with validation
- [x] Write tests for valid scenario parsing
- [x] Write tests for invalid scenarios (missing fields, bad kind, empty turns)
- [x] Run tests — must pass before task 2

### Task 2: Eval harness — boot AgentSystem in-process

Extract and generalize the test harness pattern from `agentSystem.spec.ts` into a reusable eval harness.

Files: `sources/eval/evalHarness.ts`, `sources/eval/evalHarness.spec.ts`

- [x] Implement `evalHarnessCreate()` that boots `AgentSystem` with PGlite, mock inference, mock plugins
- [x] Accept an optional `InferenceRouter` parameter (so callers can provide custom mock responses)
- [x] Return `{ agentSystem, storage, eventBus, cleanup }` — cleanup tears down temp dir
- [x] Write tests verifying harness boots and can create/resolve an agent
- [x] Run tests — must pass before task 3

### Task 3: Eval runner — execute scenario turns and collect history

The core loop: create agent, send each turn via `postAndAwait`, collect history after completion.

Files: `sources/eval/evalRun.ts`, `sources/eval/evalRun.spec.ts`

- [x] Implement `evalRun(scenario: EvalScenario, harness: EvalHarness): Promise<EvalTrace>`
- [x] `EvalTrace` contains: scenario metadata, per-turn results (`AgentInboxResult`), full history (`AgentHistoryRecord[]`), event log, timing
- [x] Create agent using path builder based on `scenario.agent.kind` + `scenario.agent.path`
- [x] Send each turn sequentially via `postAndAwait()`, recording timing per turn
- [x] After all turns, load full history via `agentHistoryLoad()`
- [x] Collect events emitted during the run via `eventBus.onEvent()`
- [x] Write tests with mock inference that returns canned responses
- [x] Write tests for multi-turn scenarios
- [x] Run tests — must pass before task 4

### Task 4: Trace renderer — convert EvalTrace to markdown

Render the collected trace as a human-readable markdown report.

Files: `sources/eval/evalTraceRender.ts`, `sources/eval/evalTraceRender.spec.ts`

- [x] Implement `evalTraceRender(trace: EvalTrace): string`
- [x] Render header with scenario name, agent kind/path, timestamp, total duration
- [x] Render each history record:
  - `user_message` → `### User\n\n{text}`
  - `assistant_message` → `### Assistant\n\n{content}` (extract text from content blocks)
  - `rlm_start` → `#### Code Execution\n\n\`\`\`\n{code}\n\`\`\``
  - `rlm_tool_call` → `> Tool: {toolName}({toolArgs})`
  - `rlm_tool_result` → `> Result: {toolResult}` (truncate long results)
  - `rlm_complete` → `> Output: {output}`
  - `note` → `> Note: {text}`
- [x] Render footer with token usage summary and event counts
- [x] Write tests with sample traces covering all record types
- [x] Write tests for edge cases (empty history, very long tool results)
- [x] Run tests — must pass before task 5

### Task 5: CLI entry point — `yarn eval <scenario.json>`

Wire everything together with a CLI command.

Files: `sources/eval/evalCli.ts`, `scripts/evalRun.mjs`, update `package.json`

- [x] Implement `evalCli(scenarioPath: string, outputPath?: string)` — reads JSON, boots harness, runs scenario, writes markdown
- [x] Default output path: `<scenario-name>.trace.md` next to the scenario file
- [x] Add `scripts/evalRun.mjs` entry script that calls `evalCli`
- [x] Add `"eval": "node ./scripts/evalRun.mjs"` to `package.json` scripts
- [x] Print summary to stdout (scenario name, turns count, total duration, output path)
- [x] Write test for CLI function with a temp scenario file
- [x] Run tests — must pass before task 6

### Task 6: Verify acceptance criteria
- [x] Verify: scenario JSON is parsed and validated with clear errors
- [x] Verify: harness boots fully in-process with no external dependencies
- [x] Verify: messages are sent and responses captured synchronously
- [x] Verify: full trace includes all history record types (messages, tool calls, RLM)
- [x] Verify: markdown output is readable and complete
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed

### Task 7: [Final] Update documentation
- [x] Add `sources/eval/README.md` documenting the eval harness, scenario format, and usage
- [x] Update project docs if new patterns discovered

## Technical Details

**Scenario JSON schema:**
```typescript
type EvalScenario = {
    name: string;
    agent: {
        kind: AgentKind;
        path: string;
    };
    turns: EvalTurn[];
};

type EvalTurn = {
    role: "user";
    text: string;
};
```

**Trace output structure:**
```typescript
type EvalTrace = {
    scenario: EvalScenario;
    agentId: string;
    startedAt: number;
    endedAt: number;
    turnResults: Array<{
        turn: EvalTurn;
        result: AgentInboxResult;
        durationMs: number;
    }>;
    history: AgentHistoryRecord[];
    events: EngineEvent[];
};
```

**Processing flow:**
1. Parse scenario JSON → `EvalScenario`
2. Boot harness → `AgentSystem` + PGlite + mock inference
3. Build agent path from `kind` + `path` → `AgentPath`
4. Initialize agent via `postAndAwait(target, { type: "reset" })`
5. For each turn: `postAndAwait(target, { type: "message", message: { text }, context: {} })`
6. Load history via `agentHistoryLoad(storage, ctx)`
7. Render trace → markdown string
8. Write to output file

**Mock inference:** Default mock returns `"ok"` (matching existing test pattern). Callers can inject custom `InferenceRouter` for richer canned responses.

⚠️ Scope adjustment during implementation: the scenario parser accepts only direct path-addressable agent kinds with a single path segment:
`connector`, `agent`, `app`, `cron`, `task`, `subuser`, and `supervisor`. Nested kinds such as `sub`, `memory`, `compactor`, and `search` require extra parent context and remain out of scope for this first eval harness.

## Post-Completion

**Future enhancements (not in scope):**
- Assertion layer (structural checks on traces)
- Batch execution (run multiple scenarios, aggregate results)
- Custom inference mocks per scenario (define canned responses in JSON)
- Full Engine boot mode for plugin/tool testing
- Diff mode (compare traces across runs)
