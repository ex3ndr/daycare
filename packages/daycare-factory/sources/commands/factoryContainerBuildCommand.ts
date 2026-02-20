import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
    FACTORY_BUILD_COMMAND_ENV,
    FACTORY_BUILD_HISTORY_FILE,
    FACTORY_OUT_ENV,
    FACTORY_TASK_ENV,
    FACTORY_TEST_COMMAND_ENV,
    FACTORY_TEST_MAX_ATTEMPTS_ENV
} from "../constants.js";
import { factoryBuildHistoryAppend } from "../history/factoryBuildHistoryAppend.js";
import { type FactoryPiAgentPromptRunInput, factoryPiAgentPromptRun } from "./factoryPiAgentPromptRun.js";

interface FactoryCommandRunResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
}

type FactoryCommandRunReturn = FactoryCommandRunResult | number | null;

interface FactoryContainerBuildCommandDependencies {
    dockerEnvironmentIs?: () => Promise<boolean>;
    piAgentPromptRun?: (taskPath: string, outDirectory: string, input?: FactoryPiAgentPromptRunInput) => Promise<void>;
    buildCommandRun?: (
        command: string[],
        env: NodeJS.ProcessEnv,
        phase?: "build" | "test"
    ) => Promise<FactoryCommandRunReturn>;
}

/**
 * Executes a configured build command inside a Docker container.
 * Expects: taskPath points to readable TASK.md and templateDirectory is readable.
 */
export async function factoryContainerBuildCommand(
    taskPath: string,
    outDirectory: string,
    templateDirectory: string,
    dependencies: FactoryContainerBuildCommandDependencies = {}
): Promise<void> {
    const dockerEnvironmentIs = dependencies.dockerEnvironmentIs ?? factoryDockerEnvironmentIs;
    const piAgentPromptRun = dependencies.piAgentPromptRun ?? factoryPiAgentPromptRun;
    const buildCommandRun = dependencies.buildCommandRun ?? factoryBuildCommandRun;

    if (!(await dockerEnvironmentIs())) {
        throw new Error("internal factory command can run only inside Docker");
    }

    await access(taskPath, constants.R_OK).catch(() => {
        throw new Error(`TASK.md is not readable: ${taskPath}`);
    });
    await access(templateDirectory, constants.R_OK).catch(() => {
        throw new Error(`template directory is not readable: ${templateDirectory}`);
    });
    const templateStat = await stat(templateDirectory).catch(() => {
        throw new Error(`template directory is not readable: ${templateDirectory}`);
    });
    if (!templateStat.isDirectory()) {
        throw new Error(`template path is not a directory: ${templateDirectory}`);
    }
    await mkdir(outDirectory, { recursive: true });
    await factoryTemplateContentsCopy(templateDirectory, outDirectory);
    await copyFile(taskPath, join(outDirectory, "TASK.md"));
    const outAgentsPath = join(outDirectory, "AGENTS.md");
    await access(outAgentsPath, constants.R_OK).catch(() => {
        throw new Error(`template must provide readable AGENTS.md at ${outAgentsPath}`);
    });

    const historyPath = join(outDirectory, FACTORY_BUILD_HISTORY_FILE);
    await factoryBuildHistoryAppend(historyPath, {
        type: "build.start",
        taskPath,
        outDirectory
    });

    const buildCommand = factoryBuildCommandParse(process.env[FACTORY_BUILD_COMMAND_ENV]);
    const testCommand = factoryBuildCommandParseOptional(process.env[FACTORY_TEST_COMMAND_ENV]);
    const testMaxAttempts = factoryTestMaxAttemptsResolve(process.env[FACTORY_TEST_MAX_ATTEMPTS_ENV]);
    const attempts = testCommand ? testMaxAttempts : 1;

    const buildEnv: NodeJS.ProcessEnv = {
        ...process.env,
        [FACTORY_TASK_ENV]: taskPath,
        [FACTORY_OUT_ENV]: outDirectory
    };

    let feedback: string | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        await factoryBuildHistoryAppend(historyPath, {
            type: "attempt.start",
            attempt,
            attempts
        });

        await piAgentPromptRun(taskPath, outDirectory, {
            attempt,
            feedback,
            historyPath
        });

        const buildResult = factoryCommandRunResultNormalize(await buildCommandRun(buildCommand, buildEnv, "build"));
        await factoryBuildHistoryAppend(historyPath, {
            type: "command.build",
            attempt,
            result: buildResult
        });

        if (buildResult.exitCode !== 0) {
            if (attempt === attempts) {
                throw new Error(`build command exited with code ${buildResult.exitCode ?? -1}`);
            }
            feedback = factoryRetryFeedbackBuild("build", attempt, attempts, buildResult);
            continue;
        }

        if (!testCommand) {
            await factoryBuildHistoryAppend(historyPath, {
                type: "build.complete",
                attempt
            });
            return;
        }

        const testResult = factoryCommandRunResultNormalize(await buildCommandRun(testCommand, buildEnv, "test"));
        await factoryBuildHistoryAppend(historyPath, {
            type: "command.test",
            attempt,
            result: testResult
        });

        if (testResult.exitCode === 0) {
            await factoryBuildHistoryAppend(historyPath, {
                type: "test.complete",
                attempt
            });
            return;
        }

        if (attempt === attempts) {
            throw new Error(`test command exited with code ${testResult.exitCode ?? -1}`);
        }

        feedback = factoryRetryFeedbackBuild("test", attempt, attempts, testResult);
    }
}

async function factoryDockerEnvironmentIs(): Promise<boolean> {
    const dockerenvExists = await access("/.dockerenv", constants.R_OK)
        .then(() => true)
        .catch(() => false);
    if (dockerenvExists) {
        return true;
    }

    const cgroup = await readFile("/proc/1/cgroup", "utf-8").catch(() => "");
    return /(docker|containerd|kubepods|podman)/i.test(cgroup);
}

function factoryBuildCommandParse(raw: string | undefined): string[] {
    if (!raw) {
        throw new Error(`${FACTORY_BUILD_COMMAND_ENV} is required`);
    }
    return factoryCommandArrayParse(raw, FACTORY_BUILD_COMMAND_ENV);
}

function factoryBuildCommandParseOptional(raw: string | undefined): string[] | undefined {
    if (!raw) {
        return undefined;
    }
    return factoryCommandArrayParse(raw, FACTORY_TEST_COMMAND_ENV);
}

function factoryTestMaxAttemptsResolve(raw: string | undefined): number {
    if (!raw) {
        return 5;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${FACTORY_TEST_MAX_ATTEMPTS_ENV} must be an integer >= 1`);
    }

    return parsed;
}

function factoryCommandArrayParse(raw: string, envName: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(`${envName} must be valid JSON array of strings`);
    }

    if (
        !Array.isArray(parsed) ||
        parsed.length === 0 ||
        parsed.some((item) => typeof item !== "string" || item.length === 0)
    ) {
        throw new Error(`${envName} must be a non-empty string array`);
    }

    return parsed;
}

function factoryBuildCommandRun(command: string[], env: NodeJS.ProcessEnv): Promise<FactoryCommandRunResult> {
    return new Promise((resolve, reject) => {
        const executable = command[0];
        if (!executable) {
            reject(new Error("build command executable is required"));
            return;
        }

        const child = spawn(executable, command.slice(1), {
            stdio: ["ignore", "pipe", "pipe"],
            env
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer | string) => {
            const text = chunk.toString();
            stdout += text;
            process.stdout.write(text);
        });

        child.stderr?.on("data", (chunk: Buffer | string) => {
            const text = chunk.toString();
            stderr += text;
            process.stderr.write(text);
        });

        child.once("error", reject);
        child.once("close", (code: number | null) => {
            resolve({
                exitCode: code,
                stdout,
                stderr
            });
        });
    });
}

function factoryCommandRunResultNormalize(result: FactoryCommandRunReturn): FactoryCommandRunResult {
    if (typeof result === "number" || result === null) {
        return {
            exitCode: result,
            stdout: "",
            stderr: ""
        };
    }

    return result;
}

function factoryRetryFeedbackBuild(
    phase: "build" | "test",
    attempt: number,
    attempts: number,
    result: FactoryCommandRunResult
): string {
    const output = factoryCommandOutputLimit(`${result.stdout}${result.stderr}`.trim(), 8_000);

    return [
        `Attempt ${attempt}/${attempts} failed during ${phase}.`,
        `Exit code: ${result.exitCode ?? -1}.`,
        output.length > 0 ? `Command output:\n${output}` : "Command output: <empty>",
        "Update files so the next attempt can pass."
    ].join("\n\n");
}

function factoryCommandOutputLimit(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return value.slice(value.length - maxLength);
}

async function factoryTemplateContentsCopy(templateDirectory: string, outDirectory: string): Promise<void> {
    const entries = await readdir(templateDirectory, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = join(templateDirectory, entry.name);
        const targetPath = join(outDirectory, entry.name);
        if (entry.isDirectory()) {
            await cp(sourcePath, targetPath, { recursive: true });
            continue;
        }
        if (entry.isFile()) {
            await copyFile(sourcePath, targetPath);
        }
    }
}
