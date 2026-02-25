import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";
import type { DockerContainerResolvedConfig } from "./dockerTypes.js";

const baseConfig: DockerContainerResolvedConfig = {
    image: "daycare-sandbox",
    tag: "latest",
    socketPath: "/var/run/docker.sock",
    runtime: "runsc",
    readOnly: false,
    unconfinedSecurity: false,
    capAdd: [],
    capDrop: [],
    userId: "user-1",
    networkName: "daycare-isolated",
    hostHomeDir: "/tmp/daycare-home-user-1",
    hostSkillsActiveDir: "/tmp/daycare-skills-user-1",
    hostExamplesDir: "/tmp/daycare-examples"
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
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0",
                        "daycare.dns.profile": "public",
                        "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                        "daycare.dns.resolver": "bind"
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
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0",
                        "daycare.dns.profile": "public",
                        "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                        "daycare.dns.resolver": "bind"
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

    it("recreates container when attached to the wrong network", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0",
                        "daycare.network": "daycare-local",
                        "daycare.dns.profile": "default",
                        "daycare.dns.servers": "default",
                        "daycare.dns.resolver": "docker"
                    }
                },
                NetworkSettings: {
                    Networks: {
                        "daycare-local": {}
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
                "daycare.capabilities": "add=;drop=",
                "daycare.readonly": "0",
                "daycare.network": "daycare-isolated",
                "daycare.dns.profile": "public",
                "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                "daycare.dns.resolver": "bind"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro",
                    "/tmp/daycare-home-user-1/.tmp/daycare-resolv.conf:/etc/resolv.conf:ro"
                ],
                NetworkMode: "daycare-isolated",
                Dns: ["1.1.1.1", "8.8.8.8"],
                Runtime: "runsc"
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-isolated": {}
                }
            }
        });
        expect(created.start).toHaveBeenCalledTimes(1);
    });

    it("uses default DNS policy for local network containers", async () => {
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
            networkName: "daycare-local"
        });

        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "default",
                "daycare.capabilities": "add=;drop=",
                "daycare.readonly": "0",
                "daycare.network": "daycare-local",
                "daycare.dns.profile": "default",
                "daycare.dns.servers": "default",
                "daycare.dns.resolver": "docker"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro"
                ],
                NetworkMode: "daycare-local",
                Runtime: "runsc"
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-local": {}
                }
            }
        });
    });

    it("uses configured private DNS policy for local network containers", async () => {
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
            networkName: "daycare-local",
            localDnsServers: ["192.168.1.1", "192.168.1.2"]
        });

        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "default",
                "daycare.capabilities": "add=;drop=",
                "daycare.readonly": "0",
                "daycare.network": "daycare-local",
                "daycare.dns.profile": "private",
                "daycare.dns.servers": "192.168.1.1,192.168.1.2",
                "daycare.dns.resolver": "bind"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro",
                    "/tmp/daycare-home-user-1/.tmp/daycare-resolv.conf:/etc/resolv.conf:ro"
                ],
                NetworkMode: "daycare-local",
                Dns: ["192.168.1.1", "192.168.1.2"],
                Runtime: "runsc"
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-local": {}
                }
            }
        });
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
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0"
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
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0"
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
                "daycare.capabilities": "add=;drop=",
                "daycare.readonly": "0",
                "daycare.network": "daycare-isolated",
                "daycare.dns.profile": "public",
                "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                "daycare.dns.resolver": "bind"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro",
                    "/tmp/daycare-home-user-1/.tmp/daycare-resolv.conf:/etc/resolv.conf:ro"
                ],
                NetworkMode: "daycare-isolated",
                Dns: ["1.1.1.1", "8.8.8.8"],
                Runtime: "runsc",
                SecurityOpt: ["seccomp=unconfined", "apparmor=unconfined"]
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-isolated": {}
                }
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
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0"
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

    it("creates container with readonly rootfs when enabled", async () => {
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
            readOnly: true
        });

        expect(docker.createContainer).toHaveBeenCalledWith({
            name: "daycare-sandbox-user-1",
            Image: IMAGE_REF,
            WorkingDir: "/home",
            Labels: {
                "daycare.image.version": DOCKER_IMAGE_VERSION,
                "daycare.image.id": CURRENT_IMAGE_ID,
                "daycare.security.profile": "default",
                "daycare.capabilities": "add=;drop=",
                "daycare.readonly": "1",
                "daycare.network": "daycare-isolated",
                "daycare.dns.profile": "public",
                "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                "daycare.dns.resolver": "bind"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro",
                    "/tmp/daycare-home-user-1/.tmp/daycare-resolv.conf:/etc/resolv.conf:ro"
                ],
                NetworkMode: "daycare-isolated",
                Dns: ["1.1.1.1", "8.8.8.8"],
                Runtime: "runsc",
                ReadonlyRootfs: true
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-isolated": {}
                }
            }
        });
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
                "daycare.capabilities": "add=NET_ADMIN,SYS_ADMIN;drop=MKNOD",
                "daycare.readonly": "0",
                "daycare.network": "daycare-isolated",
                "daycare.dns.profile": "public",
                "daycare.dns.servers": "1.1.1.1,8.8.8.8",
                "daycare.dns.resolver": "bind"
            },
            HostConfig: {
                Binds: [
                    "/tmp/daycare-home-user-1:/home",
                    "/tmp/daycare-skills-user-1:/shared/skills:ro",
                    "/tmp/daycare-examples:/shared/examples:ro",
                    "/tmp/daycare-home-user-1/.tmp/daycare-resolv.conf:/etc/resolv.conf:ro"
                ],
                NetworkMode: "daycare-isolated",
                Dns: ["1.1.1.1", "8.8.8.8"],
                Runtime: "runsc",
                CapAdd: ["NET_ADMIN", "SYS_ADMIN"],
                CapDrop: ["MKNOD"]
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    "daycare-isolated": {}
                }
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
                        "daycare.capabilities": "add=NET_ADMIN;drop=",
                        "daycare.readonly": "0"
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

    it("recreates container when readonly label does not match", async () => {
        const existing = {
            inspect: vi.fn().mockResolvedValue({
                State: { Running: true },
                Config: {
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID,
                        "daycare.security.profile": "default",
                        "daycare.capabilities": "add=;drop=",
                        "daycare.readonly": "0"
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
            readOnly: true
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
