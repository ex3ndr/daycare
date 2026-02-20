import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    FACTORY_BUILD_COMMAND_ENV,
    FACTORY_BUILD_HISTORY_FILE,
    FACTORY_OUT_ENV,
    FACTORY_TASK_ENV,
    FACTORY_TEST_COMMAND_ENV,
    FACTORY_TEST_MAX_ATTEMPTS_ENV
} from "../constants.js";
import { factoryContainerBuildCommand } from "./factoryContainerBuildCommand.js";

const tempDirectories: string[] = [];

afterEach(async () => {
    for (const directory of tempDirectories.splice(0, tempDirectories.length)) {
        await rm(directory, { recursive: true, force: true });
    }
    delete process.env[FACTORY_BUILD_COMMAND_ENV];
    delete process.env[FACTORY_TEST_COMMAND_ENV];
    delete process.env[FACTORY_TEST_MAX_ATTEMPTS_ENV];
});

async function factoryEnvironmentFilesWrite(
    directory: string
): Promise<{ taskPath: string; outPath: string; templatePath: string }> {
    const taskPath = join(directory, "TASK.md");
    const templatePath = join(directory, "template");
    const templateFilePath = join(templatePath, "seed.txt");
    const templateAgentsPath = join(templatePath, "AGENTS.md");
    const outPath = join(directory, "out");
    await writeFile(taskPath, "# task\n");
    await mkdir(templatePath, { recursive: true });
    await writeFile(templateFilePath, "seed\n");
    await writeFile(templateAgentsPath, "# agents\n");
    return { taskPath, outPath, templatePath };
}

describe("factoryContainerBuildCommand", () => {
    it("rejects when not running inside Docker", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-no-docker-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);

        await expect(
            factoryContainerBuildCommand(taskPath, outPath, templatePath, {
                dockerEnvironmentIs: async () => false
            })
        ).rejects.toThrow("inside Docker");
    });

    it("runs configured build command and sets task/out env vars", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-docker-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);

        const piRunSpy = vi.fn().mockResolvedValue(undefined);
        const runSpy = vi.fn().mockResolvedValue(0);

        await factoryContainerBuildCommand(taskPath, outPath, templatePath, {
            dockerEnvironmentIs: async () => true,
            piAgentPromptRun: piRunSpy,
            buildCommandRun: runSpy
        });

        expect(piRunSpy).toHaveBeenCalledTimes(1);
        expect(piRunSpy.mock.calls[0]?.[0]).toBe(taskPath);
        expect(piRunSpy.mock.calls[0]?.[1]).toBe(outPath);
        expect(runSpy).toHaveBeenCalledTimes(1);
        expect(runSpy.mock.calls[0]?.[0]).toEqual(["npm", "run", "build"]);
        expect(runSpy.mock.calls[0]?.[1]?.[FACTORY_TASK_ENV]).toBe(taskPath);
        expect(runSpy.mock.calls[0]?.[1]?.[FACTORY_OUT_ENV]).toBe(outPath);
        const outStat = await stat(outPath);
        expect(outStat.isDirectory()).toBe(true);
        const copiedTaskStat = await stat(join(outPath, "TASK.md"));
        expect(copiedTaskStat.isFile()).toBe(true);
        const copiedAgentsStat = await stat(join(outPath, "AGENTS.md"));
        expect(copiedAgentsStat.isFile()).toBe(true);
        const copiedTemplateStat = await stat(join(outPath, "seed.txt"));
        expect(copiedTemplateStat.isFile()).toBe(true);
        const historyStat = await stat(join(outPath, FACTORY_BUILD_HISTORY_FILE));
        expect(historyStat.isFile()).toBe(true);
    });

    it("fails when template does not provide AGENTS.md", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-no-agents-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        await rm(join(templatePath, "AGENTS.md"));
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);

        await expect(
            factoryContainerBuildCommand(taskPath, outPath, templatePath, {
                dockerEnvironmentIs: async () => true,
                piAgentPromptRun: vi.fn().mockResolvedValue(undefined),
                buildCommandRun: vi.fn().mockResolvedValue(0)
            })
        ).rejects.toThrow("template must provide readable AGENTS.md");
    });

    it("propagates Pi prompt failure without fallback behavior", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-pi-fail-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);

        const runSpy = vi.fn().mockResolvedValue(0);
        const piRunError = new Error("pi auth failed");

        await expect(
            factoryContainerBuildCommand(taskPath, outPath, templatePath, {
                dockerEnvironmentIs: async () => true,
                piAgentPromptRun: async () => {
                    throw piRunError;
                },
                buildCommandRun: runSpy
            })
        ).rejects.toThrow("pi auth failed");

        expect(runSpy).not.toHaveBeenCalled();
    });

    it("runs optional test command after build command", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-test-command-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);
        process.env[FACTORY_TEST_COMMAND_ENV] = JSON.stringify(["npm", "run", "test"]);

        const runSpy = vi.fn().mockResolvedValue(0);

        await factoryContainerBuildCommand(taskPath, outPath, templatePath, {
            dockerEnvironmentIs: async () => true,
            piAgentPromptRun: vi.fn().mockResolvedValue(undefined),
            buildCommandRun: runSpy
        });

        expect(runSpy).toHaveBeenCalledTimes(2);
        expect(runSpy.mock.calls[0]?.[0]).toEqual(["npm", "run", "build"]);
        expect(runSpy.mock.calls[1]?.[0]).toEqual(["npm", "run", "test"]);
    });

    it("fails when optional test command exits non-zero", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-test-fail-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);
        process.env[FACTORY_TEST_COMMAND_ENV] = JSON.stringify(["npm", "run", "test"]);
        process.env[FACTORY_TEST_MAX_ATTEMPTS_ENV] = "1";

        const runSpy = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);

        await expect(
            factoryContainerBuildCommand(taskPath, outPath, templatePath, {
                dockerEnvironmentIs: async () => true,
                piAgentPromptRun: vi.fn().mockResolvedValue(undefined),
                buildCommandRun: runSpy
            })
        ).rejects.toThrow("test command exited with code 1");
    });

    it("retries after failing test command and passes on next attempt", async () => {
        const directory = await mkdtemp(join(tmpdir(), "factory-test-retry-"));
        tempDirectories.push(directory);
        const { taskPath, outPath, templatePath } = await factoryEnvironmentFilesWrite(directory);
        process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify(["npm", "run", "build"]);
        process.env[FACTORY_TEST_COMMAND_ENV] = JSON.stringify(["npm", "run", "test"]);
        process.env[FACTORY_TEST_MAX_ATTEMPTS_ENV] = "3";

        const runSpy = vi
            .fn()
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);
        const piRunSpy = vi.fn().mockResolvedValue(undefined);

        await factoryContainerBuildCommand(taskPath, outPath, templatePath, {
            dockerEnvironmentIs: async () => true,
            piAgentPromptRun: piRunSpy,
            buildCommandRun: runSpy
        });

        expect(piRunSpy).toHaveBeenCalledTimes(2);
        expect(runSpy).toHaveBeenCalledTimes(4);
    });
});
