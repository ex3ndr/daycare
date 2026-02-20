import { execFile } from "node:child_process";

import { describe, expect, it } from "vitest";

import { tailscaleBinaryResolve } from "./tailscaleBinaryResolve.js";
import { tailscaleStatusDomainResolve } from "./tailscaleStatusDomainResolve.js";

const RUN_TAILSCALE_INTEGRATION =
    process.env.RUN_TAILSCALE_INTEGRATION === "1" || process.env.RUN_TAILSCALE_INTEGRATION === "true";
const describeIf = RUN_TAILSCALE_INTEGRATION ? describe : describe.skip;

describeIf("tailscale integration", () => {
    it("reads real tailscale status json and resolves domain", async () => {
        const binary = await tailscaleBinaryResolve();
        const statusJson = await commandRun(binary, ["status", "--json"]);
        const resolved = tailscaleStatusDomainResolve(statusJson);

        expect(resolved.dnsName.length).toBeGreaterThan(0);
        expect(resolved.domain.length).toBeGreaterThan(0);
    }, 30000);
});

function commandRun(binary: string, args: string[]): Promise<string> {
    const shellCommand = [binary, ...args].map(shellEscape).join(" ");

    return new Promise((resolve, reject) => {
        execFile("bash", ["-lc", shellCommand], { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                const details = stderr?.trim() || stdout?.trim() || error.message;
                reject(new Error(details));
                return;
            }
            resolve(stdout);
        });
    });
}

function shellEscape(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
