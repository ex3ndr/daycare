/**
 * Resolves a hostname domain and preserved public URL from custom expose script output.
 * Expects: value is either a URL or a host-like token.
 */
export function customTunnelDomainResolve(value: string): {
  domain: string;
  publicUrl: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Custom expose script returned an empty URL.");
  }

  if (trimmed.includes("://")) {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) {
      throw new Error("Custom expose script URL is missing a hostname.");
    }
    return {
      domain: parsed.hostname,
      publicUrl: trimmed
    };
  }

  const firstSegment = trimmed.split("/")[0] ?? trimmed;
  const withoutPort = firstSegment.startsWith("[")
    ? firstSegment
    : (firstSegment.split(":")[0] ?? firstSegment);
  if (!withoutPort) {
    throw new Error("Custom expose script URL is missing a hostname.");
  }

  return {
    domain: withoutPort,
    publicUrl: trimmed
  };
}
