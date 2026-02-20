import type { ExposeMode } from "@/types";

export type TailscaleTunnelCommandInput =
    | {
          action: "create";
          mode: ExposeMode;
          proxyPort: number;
          httpsPort?: number;
          binary?: string;
      }
    | {
          action: "destroy";
          mode: ExposeMode;
          httpsPort?: number;
          binary?: string;
      };

/**
 * Builds tailscale serve/funnel command arguments for expose lifecycle.
 * Expects: proxyPort is a valid listening local port for create actions.
 */
export function tailscaleTunnelCommandBuild(input: TailscaleTunnelCommandInput): { command: string; args: string[] } {
    const binary = input.binary ?? "tailscale";
    const httpsPort = input.httpsPort ?? 443;
    const service = `https:${httpsPort}`;
    if (input.action === "create") {
        const path = `http://127.0.0.1:${input.proxyPort}`;
        if (input.mode === "public") {
            return {
                command: binary,
                args: ["funnel", "--bg", "--https", String(httpsPort), path]
            };
        }
        return {
            command: binary,
            args: ["serve", "--bg", "--https", String(httpsPort), path]
        };
    }

    if (input.mode === "public") {
        return {
            command: binary,
            args: ["funnel", "clear", service]
        };
    }
    return {
        command: binary,
        args: ["serve", "clear", service]
    };
}
