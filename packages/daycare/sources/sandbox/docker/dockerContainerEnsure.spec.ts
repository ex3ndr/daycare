import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

const baseConfig: DockerContainerConfig = {
    image: "daycare-sandbox",
    tag: "latest",
    socketPath: "/var/run/docker.sock",
    runtime: "runsc",
    userId: "user-1",
    hostHomeDir: "/data/users/user-1/home"
};

describe("dockerContainerEnsure", () => {
    it("returns existing running container", async () => {
        const container = {
            inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
            start: vi.fn()
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(container),
            createContainer: vi.fn()
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(container);
        expect(docker.createContainer).not.toHaveBeenCalled();
        expect(container.start).not.toHaveBeenCalled();
    });

    it("starts existing stopped container", async () => {
        const container = {
            inspect: vi.fn().mockResolvedValue({ State: { Running: false } }),
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(container),
            createContainer: vi.fn()
        } as unknown as Docker;

        await dockerContainerEnsure(docker, baseConfig);

        expect(container.start).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).not.toHaveBeenCalled();
    });

    it("creates and starts container when missing", async () => {
        const existing = {
            inspect: vi.fn().mockRejectedValue({ statusCode: 404 }),
            start: vi.fn()
        } as unknown as Docker.Container;

        const created = {
            inspect: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(created);
        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: "daycare-sandbox:latest",
            WorkingDir: "/home",
            HostConfig: {
                Binds: ["/data/users/user-1/home:/home"],
                Runtime: "runsc"
            }
        });
        expect(created.start).toHaveBeenCalledTimes(1);
    });
});
