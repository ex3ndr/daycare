import { shellQuote } from "../../utils/shellQuote.js";

type OpenSandboxCommandBuildInput = {
    command: string;
    env: NodeJS.ProcessEnv;
};

/**
 * Builds a shell command that injects the full execution environment before running the user command.
 * Expects: env contains the final merged environment and command is intended for bash -lc execution.
 */
export function opensandboxCommandBuild(input: OpenSandboxCommandBuildInput): string {
    const envEntries = Object.entries(input.env)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => shellQuote(`${key}=${value}`));

    return `env -i ${envEntries.join(" ")} bash -lc ${shellQuote(input.command)}`;
}
