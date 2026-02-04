import type { GatePermissionError } from "./gatePermissionErrorBuild.js";

/**
 * Checks whether a value is a gate permission error.
 * Expects: value is unknown.
 */
export function gatePermissionErrorIs(value: unknown): value is GatePermissionError {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { code?: unknown; missing?: unknown };
  return candidate.code === "gate_permission_denied" && Array.isArray(candidate.missing);
}
