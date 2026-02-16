export type TailscaleStatusDomain = {
  dnsName: string;
  domain: string;
};

/**
 * Resolves machine DNS and base tailnet domain from `tailscale status --json` output.
 * Expects: JSON contains `Self.DNSName`.
 */
export function tailscaleStatusDomainResolve(output: string): TailscaleStatusDomain {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output) as unknown;
  } catch {
    throw new Error("Invalid tailscale status JSON.");
  }

  const dnsName =
    typeof (parsed as { Self?: { DNSName?: unknown } })?.Self?.DNSName === "string"
      ? ((parsed as { Self: { DNSName: string } }).Self.DNSName || "")
      : "";
  const normalizedDnsName = dnsName.trim().replace(/\.$/, "").toLowerCase();
  if (!normalizedDnsName) {
    throw new Error("Tailscale status did not include Self.DNSName.");
  }

  const labels = normalizedDnsName.split(".").filter((label) => label.length > 0);
  if (labels.length < 3) {
    throw new Error(`Invalid Tailscale DNS name: ${normalizedDnsName}`);
  }

  return {
    dnsName: normalizedDnsName,
    domain: labels.slice(1).join(".")
  };
}
