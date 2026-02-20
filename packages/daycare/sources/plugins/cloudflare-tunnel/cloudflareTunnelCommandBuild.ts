export type CloudflareTunnelCommandInput =
    | {
          action: "create";
          domain: string;
          proxyPort: number;
      }
    | {
          action: "destroy";
          domain: string;
      };

/**
 * Builds cloudflared commands for expose tunnel setup/teardown.
 * Expects: domain is a fully-qualified hostname.
 */
export function cloudflareTunnelCommandBuild(input: CloudflareTunnelCommandInput): { command: string; args: string[] } {
    if (input.action === "create") {
        return {
            command: "cloudflared",
            args: [
                "tunnel",
                "route",
                "dns",
                "daycare",
                input.domain,
                "--overwrite-dns",
                "--url",
                `http://127.0.0.1:${input.proxyPort}`
            ]
        };
    }

    return {
        command: "cloudflared",
        args: ["tunnel", "route", "dns", "daycare", input.domain, "--delete"]
    };
}
