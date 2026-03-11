# App Workflows

Use this reference when designing end-to-end app workflows from user prompt to final result.

## Minimal workflow pattern

1. Define the task in one sentence.
2. Identify required tools and data reads.
3. Apply allow/deny constraints before execution.
4. Execute tool calls through review middleware.
5. Return concise final output with rationale.

## Decision checkpoints

- **Before first call**: Is the requested action in app scope?
- **Before each tool call**: Does allow/deny policy permit it?
- **After denial**: Can the app adapt with a safer alternative?
- **Before response**: Is output complete and actionable?

## Escalation pattern

If the app cannot complete safely:

1. Explain what was blocked.
2. Explain why it was blocked.
3. Offer a safe alternative path.

## Stable workflow guidance

- Prefer deterministic steps over open-ended exploration.
- Keep tool-call count low for predictable latency.
- Avoid mixing unrelated responsibilities in one app flow.
