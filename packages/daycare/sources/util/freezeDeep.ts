/**
 * Deeply freezes plain objects and arrays.
 * Expects: values are JSON-compatible and acyclic.
 */
export function freezeDeep<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const entry of Object.values(value as Record<string, unknown>)) {
    freezeDeep(entry);
  }

  return value;
}
