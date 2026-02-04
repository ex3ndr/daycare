export type GatePermissionError = Error & {
  code: "gate_permission_denied";
  missing: string[];
};

/**
 * Builds a gate permission error describing missing/invalid permission tags.
 * Expects: missing contains one or more permission tags.
 */
export function gatePermissionErrorBuild(missing: string[]): GatePermissionError {
  const detail = missing.join(", ");
  const error = new Error(`Gate permissions not allowed: ${detail}`) as GatePermissionError;
  error.code = "gate_permission_denied";
  error.missing = [...missing];
  return error;
}
