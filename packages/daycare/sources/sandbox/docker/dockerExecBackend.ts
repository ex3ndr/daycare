import { randomUUID } from "node:crypto";
import path from "node:path";

import { getLogger } from "../../log.js";
import type { PathMountPoint } from "../../utils/pathMountTypes.js";
import type {
    SandboxExecBackend,
    SandboxExecBackendArgs,
    SandboxExecBackendHandle
} from "../sandboxExecBackendTypes.js";
import { sandboxExecRuntimeArgsBuild } from "../sandboxExecRuntimeArgsBuild.js";
import type { SandboxDockerConfig } from "../sandboxTypes.js";
import { dockerContainersShared } from "./dockerContainersShared.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

const logger = getLogger("sandbox.docker");

type DockerExecBackendOptions = {
    homeDir: string;
    mounts: PathMountPoint[];
    docker: SandboxDockerConfig;
};

export class DockerExecBackend implements SandboxExecBackend {
    private readonly homeDir: string;
    private readonly mounts: PathMountPoint[];
    private readonly docker: SandboxDockerConfig;

    constructor(options: DockerExecBackendOptions) {
        this.homeDir = path.resolve(options.homeDir);
        this.mounts = options.mounts;
        this.docker = options.docker;
    }

    async exec(args: SandboxExecBackendArgs): Promise<SandboxExecBackendHandle> {
        const runtimeArgs = sandboxExecRuntimeArgsBuild({
            env: args.env,
            cwd: args.cwd,
            mounts: this.mounts
        });
        const dockerConfig: DockerContainerConfig = {
            ...this.docker,
            hostHomeDir: this.homeDir,
            mounts: this.mounts
        };
        const controlFile = `/tmp/daycare-exec-${randomUUID()}.ctl`;

        logger.debug(`exec: running in docker cwd=${runtimeArgs.cwd} command=${JSON.stringify(args.command)}`);
        const result = await dockerContainersShared.execStream(dockerConfig, {
            command: ["daycare-exec-supervisor", "--control", controlFile, "--", "bash", "-lc", args.command],
            cwd: runtimeArgs.cwd,
            env: runtimeArgs.env,
            timeoutMs: args.timeoutMs,
            maxBufferBytes: args.maxBufferBytes,
            processTreeControlFile: controlFile,
            signal: args.signal
        });
        const wait = async () => {
            const execution = await result.wait();
            logger.debug(`exec: completed exitCode=${execution.exitCode} signal=${execution.signal ?? "none"}`);
            return {
                stdout: execution.stdout,
                stderr: execution.stderr,
                exitCode: execution.exitCode,
                signal: execution.signal
            };
        };

        return {
            stdout: result.stdout,
            stderr: result.stderr,
            wait,
            kill: result.kill
        };
    }

    async destroy(): Promise<void> {
        const dockerConfig: DockerContainerConfig = {
            ...this.docker,
            hostHomeDir: this.homeDir,
            mounts: this.mounts
        };
        await dockerContainersShared.remove(dockerConfig);
    }
}
