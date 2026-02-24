import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

const baseConfig: DockerContainerConfig = {
    image: "daycare-sandbox",
    tag: "latest",
    socketPath: "/var/run/docker.sock",
    runtime: "runsc",
    unconfinedSecurity: false,
    capAdd: [],
    capDrop: [],
    userId: "user-1",
    hostHomeDir: "/data/users/user-1/home",
    hostSkillsActiveDir: "/data/users/user-1/skills/active"
};
const IMAGE_REF = "daycare-sandbox:latest";
const CURRENT_IMAGE_ID = "sha256:image-current";

describe("dockerContainerEnsure", () => {
    it("returns existing running container", async () => {
        const container = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop="
                    }
                }
            }),
            start: vi.fn(),
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(container),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn()
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(container);
        expect(docker.getImage).toHaveBeenCalledWith(IMAGE_REF);
        expect(docker.createContainer).not.toHaveBeenCalled();
        expect(container.start).not.toHaveBeenCalled();
        expect(container.stop).not.toHaveBeenCalled();
        expect(container.remove).not.toHaveBeenCalled();
    });

    it("starts existing stopped container", async () => {
        const container = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: false },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop="
                    }
                }
            }),
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(container),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn()
        } as unknown as Docker;

        await dockerContainerEnsure(docker, baseConfig);

        expect(container.start).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).not.toHaveBeenCalled();
        expect(container.stop).not.toHaveBeenCalled();
        expect(container.remove).not.toHaveBeenCalled();
    });

    it("creates and starts container when missing", async () => {
        const existing = {
            inspect: vi.fn().mockRejectedValue({ statusCode: 404 }),
            start: vi.fn(),
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;

        const created = {
            inspect: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(created);
        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "default",
                "daycare.capabilities": "add=;drop="
            },
            HostConfig: {
                Binds: ["/data/users/user-1/home:/home", "/data/users/user-1/skills/active:/shared/skills:ro"],
                Runtime: "runsc"
            }
        });
        expect(created.start).toHaveBeenCalledTimes(1);
    });

    it("recreates container when image version label does not match", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": "0",
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop="
                    }
                }
            }),
            start: vi.fn(),
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const created = {
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(created);
        expect(existing.stop).toHaveBeenCalledTimes(1);
        expect(existing.remove).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).toHaveBeenCalledTimes(1);
    });

    it("recreates container when image id label does not match", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": "sha256:outdated",
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop="
                    }
                }
            }),
            start: vi.fn(),
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const created = {
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(created);
        expect(existing.stop).toHaveBeenCalledTimes(1);
        expect(existing.remove).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).toHaveBeenCalledTimes(1);
    });

    it("creates container with unconfined security opts when enabled", async () => {
        const existing = {
            inspect: vi.fn().mockRejectedValue({ statusCode: 404 }),
            start: vi.fn(),
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;

        const created = {
            inspect: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        await dockerContainerEnsure(docker, {
            ...baseConfig,
            unconfinedSecurity: true
        });

        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "unconfined",
                "daycare.capabilities": "add=;drop="
            },
            HostConfig: {
                Binds: ["/data/users/user-1/home:/home", "/data/users/user-1/skills/active:/shared/skills:ro"],
                Runtime: "runsc",
                SecurityOpt: ["seccomp=unconfined", "apparmor=unconfined"]
            }
        });
    });

    it("recreates container when security profile label does not match", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop="
                    }
                }
            }),
            start: vi.fn(),
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const created = {
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, {
            ...baseConfig,
            unconfinedSecurity: true
        });

        expect(result).toBe(created);
        expect(existing.stop).toHaveBeenCalledTimes(1);
        expect(existing.remove).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).toHaveBeenCalledTimes(1);
    });

    it("creates container with capAdd and capDrop", async () => {
        const existing = {
            inspect: vi.fn().mockRejectedValue({ statusCode: 404 }),
            start: vi.fn(),
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;

        const created = {
            inspect: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        await dockerContainerEnsure(docker, {
            ...baseConfig,
            capAdd: ["NET_ADMIN", "SYS_ADMIN"],
            capDrop: ["MKNOD"]
        });

        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "default",
                "daycare.capabilities": "add=NET_ADMIN,SYS_ADMIN;drop=MKNOD"
            },
            HostConfig: {
                Binds: ["/data/users/user-1/home:/home", "/data/users/user-1/skills/active:/shared/skills:ro"],
                Runtime: "runsc",
                CapAdd: ["NET_ADMIN", "SYS_ADMIN"],
                CapDrop: ["MKNOD"]
            }
        });
    });

    it("recreates container when capabilities label does not match", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=NET_ADMIN;drop="
                    }
                }
            }),
            start: vi.fn(),
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const created = {
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, {
            ...baseConfig,
            capAdd: ["NET_ADMIN", "SYS_ADMIN"]
        });

        expect(result).toBe(created);
        expect(existing.stop).toHaveBeenCalledTimes(1);
        expect(existing.remove).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).toHaveBeenCalledTimes(1);
    });

    it("recreates pre-guard containers when labels are missing", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: { Labels: {} }
            }),
            start: vi.fn(),
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const created = {
            start: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const docker = {
            getContainer: vi.fn().mockReturnValue(existing),
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            createContainer: vi.fn().mockResolvedValue(created)
        } as unknown as Docker;

        const result = await dockerContainerEnsure(docker, baseConfig);

        expect(result).toBe(created);
        expect(existing.stop).toHaveBeenCalledTimes(1);
        expect(existing.remove).toHaveBeenCalledTimes(1);
        expect(docker.createContainer).toHaveBeenCalledTimes(1);
    });
});
