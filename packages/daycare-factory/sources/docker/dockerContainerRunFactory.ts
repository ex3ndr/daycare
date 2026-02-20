import Docker from "dockerode";
import { FACTORY_BUILD_COMMAND_ENV, FACTORY_TEST_COMMAND_ENV, FACTORY_TEST_MAX_ATTEMPTS_ENV } from "../constants.js";
import { factoryPiDirectoryResolve } from "../paths/factoryPiDirectoryResolve.js";
import type { FactoryContainerRunInput } from "../types.js";
import { dockerContainerRemoveIfExists } from "./dockerContainerRemoveIfExists.js";
import { factoryContainerBindsBuild } from "./factoryContainerBindsBuild.js";
import { factoryContainerNameBuild } from "./factoryContainerNameBuild.js";
import { factoryContainerPiBindBuild } from "./factoryContainerPiBindBuild.js";

/**
 * Runs daycare-factory inside a Docker container with mounted task and output paths.
 * Expects: image exists locally and mounted host paths are writable/readable as needed.
 */
export async function dockerContainerRunFactory(input: FactoryContainerRunInput): Promise<void> {
    const docker = new Docker();
    const containerName = input.config.containerName ?? factoryContainerNameBuild(input.paths.taskDirectory);

    if (input.config.removeExistingContainer) {
        await dockerContainerRemoveIfExists(docker, containerName);
    }

    const envMap = new Map(Object.entries(input.config.env));
    envMap.set(FACTORY_BUILD_COMMAND_ENV, JSON.stringify(input.config.buildCommand));
    if (input.config.testCommand) {
        envMap.set(FACTORY_TEST_COMMAND_ENV, JSON.stringify(input.config.testCommand));
    }
    envMap.set(FACTORY_TEST_MAX_ATTEMPTS_ENV, String(input.config.testMaxAttempts));

    const hostPiDirectory = await factoryPiDirectoryResolve();
    const binds = [
        ...factoryContainerBindsBuild(input.paths, input.config),
        factoryContainerPiBindBuild(hostPiDirectory)
    ];
    const container = await docker.createContainer({
        name: containerName,
        Image: input.config.image,
        Cmd: input.config.command,
        WorkingDir: input.config.workingDirectory,
        Env: Array.from(envMap.entries()).map(([key, value]) => `${key}=${value}`),
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        HostConfig: {
            Binds: binds
        }
    });

    const outputStream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
        logs: true
    });

    docker.modem.demuxStream(outputStream, process.stdout, process.stderr);

    try {
        await container.start();
        const waitResult = await container.wait();
        const statusCode = typeof waitResult.StatusCode === "number" ? waitResult.StatusCode : -1;

        if (statusCode !== 0) {
            throw new Error(`Container ${containerName} exited with code ${statusCode}`);
        }
    } finally {
        if ("destroy" in outputStream && typeof outputStream.destroy === "function") {
            outputStream.destroy();
        } else if ("end" in outputStream && typeof outputStream.end === "function") {
            outputStream.end();
        }

        if (input.config.removeContainerOnExit) {
            await container.remove({ force: true }).catch(() => undefined);
        }
    }
}
