import { describe, expect, it, vi } from "vitest";

import { OpenSandboxSandboxes } from "./opensandboxSandboxes.js";

const { createMock } = vi.hoisted(() => ({
    createMock: vi.fn()
}));

vi.mock("@alibaba-group/opensandbox", () => ({
    Sandbox: {
        create: createMock
    }
}));

describe("OpenSandboxSandboxes", () => {
    it("creates volumes from mounts and reuses the sandbox for the same user", async () => {
        const sandbox = {
            getInfo: vi.fn().mockResolvedValue({
                expiresAt: new Date(Date.now() + 600_000)
            }),
            renew: vi.fn(),
            kill: vi.fn(),
            close: vi.fn()
        };
        createMock.mockReset();
        createMock.mockResolvedValue(sandbox);

        const sandboxes = new OpenSandboxSandboxes();
        const config = {
            domain: "localhost:8080",
            image: "ubuntu",
            resourceLimits: {
                cpu: 4,
                memory: "16Gi"
            },
            userId: "user-1",
            timeoutSeconds: 600
        };
        const mounts = [
            { hostPath: "/host/home", mappedPath: "/home" },
            { hostPath: "/host/skills", mappedPath: "/shared/skills" }
        ];

        const first = await sandboxes.ensure(config, mounts);
        const second = await sandboxes.ensure(config, mounts);

        expect(first).toBe(sandbox);
        expect(second).toBe(sandbox);
        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                image: "ubuntu",
                resource: {
                    cpu: "4",
                    memory: "16Gi"
                },
                timeoutSeconds: 600,
                volumes: [
                    {
                        name: "daycare-mount-0",
                        host: { path: "/host/home" },
                        mountPath: "/home",
                        readOnly: false
                    },
                    {
                        name: "daycare-mount-1",
                        host: { path: "/host/skills" },
                        mountPath: "/shared/skills",
                        readOnly: true
                    }
                ]
            })
        );
    });

    it("kills stale sandboxes when config changes", async () => {
        const firstSandbox = {
            getInfo: vi.fn().mockResolvedValue({
                expiresAt: new Date(Date.now() + 600_000)
            }),
            renew: vi.fn(),
            kill: vi.fn(),
            close: vi.fn()
        };
        const secondSandbox = {
            getInfo: vi.fn().mockResolvedValue({
                expiresAt: new Date(Date.now() + 600_000)
            }),
            renew: vi.fn(),
            kill: vi.fn(),
            close: vi.fn()
        };
        createMock.mockReset();
        createMock.mockResolvedValueOnce(firstSandbox).mockResolvedValueOnce(secondSandbox);

        const sandboxes = new OpenSandboxSandboxes();
        const mounts = [{ hostPath: "/host/home", mappedPath: "/home" }];

        await sandboxes.ensure(
            {
                domain: "localhost:8080",
                image: "ubuntu",
                resourceLimits: {
                    cpu: 4,
                    memory: "16Gi"
                },
                userId: "user-1",
                timeoutSeconds: 600
            },
            mounts
        );
        await sandboxes.ensure(
            {
                domain: "localhost:8080",
                image: "ubuntu:24.04",
                resourceLimits: {
                    cpu: 4,
                    memory: "16Gi"
                },
                userId: "user-1",
                timeoutSeconds: 600
            },
            mounts
        );

        expect(firstSandbox.kill).toHaveBeenCalledTimes(1);
        expect(firstSandbox.close).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledTimes(2);
    });
});
