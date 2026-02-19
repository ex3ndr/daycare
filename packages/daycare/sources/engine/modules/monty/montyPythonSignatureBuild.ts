import type { Tool } from "@mariozechner/pi-ai";

import { montyParameterEntriesBuild } from "./montyParameterEntriesBuild.js";
import { montyPythonTypeFromSchema } from "./montyPythonTypeFromSchema.js";

/**
 * Builds a Python function signature from tool JSON schema parameters.
 * Expects: required entries appear before optional entries.
 */
export function montyPythonSignatureBuild(tool: Tool): string {
  const parameterEntries = montyParameterEntriesBuild(tool);
  const signatureEntries: string[] = [];

  for (const { name, schema, required } of parameterEntries) {
    const typeHint = montyPythonTypeFromSchema(schema);
    if (required) {
      signatureEntries.push(`${name}: ${typeHint}`);
      continue;
    }
    signatureEntries.push(`${name}: ${typeHint} | None = None`);
  }

  return signatureEntries.join(", ");
}
