/**
 * Checks whether assistant text is the NO_MESSAGE sentinel used to suppress user output.
 * Expects: input is the raw assistant text payload; returns true only when the sentinel is alone.
 */
export function messageNoMessageIs(text: string | null): boolean {
  if (!text) {
    return false;
  }

  let candidate = text.trim();
  if (candidate.length === 0) {
    return false;
  }

  for (let i = 0; i < 2; i += 1) {
    const unwrapped = unwrapOnce(candidate);
    if (unwrapped === candidate) {
      break;
    }
    candidate = unwrapped.trim();
  }

  return /^NO_MESSAGE[.!?]?$/.test(candidate);
}

function unwrapOnce(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fencedMatch) {
    const fencedBody = fencedMatch[1] ?? "";
    return fencedBody.trim();
  }

  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed.slice(3, -3).trim();
  }

  if (trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.includes("\n")) {
    return trimmed.slice(1, -1).trim();
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}
