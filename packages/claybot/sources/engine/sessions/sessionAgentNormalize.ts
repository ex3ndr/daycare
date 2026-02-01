import type { SessionState } from "./sessionStateTypes.js";

export function sessionAgentNormalize(
  value: unknown
): SessionState["agent"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as { kind?: unknown; parentSessionId?: unknown; name?: unknown };
  if (candidate.kind !== "background") {
    return undefined;
  }
  return {
    kind: "background",
    parentSessionId:
      typeof candidate.parentSessionId === "string" ? candidate.parentSessionId : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined
  };
}
