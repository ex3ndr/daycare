/**
 * Builds the Python preamble used at Monty execution time.
 * Expects: runtime preamble stays minimal and excludes prompt-only comments/stubs.
 */
export function montyRuntimePreambleBuild(): string {
  return [
    "from typing import Any",
    "",
    "ToolError = RuntimeError"
  ].join("\n");
}
