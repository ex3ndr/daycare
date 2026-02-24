import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerContainersStaleRemove } from "./dockerContainersStaleRemove.js";
import { DOCKER_IMAGE_VERSION } from "./dockerImageVersion.js";

const CURRENT_IMAGE_ID = "sha256:image-current";

describe("dockerContainersStaleRemove", () => {
    it("removes only stale containers from a mixed list", async () => {
        const currentContainer = {
            stop: vi.fn(),
            remove: vi.fn()
        } as unknown as Docker.Container;
        const staleVersionContainer = {
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const staleImageContainer = {
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;
        const byId = new Map<string, Docker.Container>([
            ["1", currentContainer],
            ["2", staleVersionContainer],
            ["3", staleImageContainer]
        ]);

        const docker = {
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            listContainers: vi.fn().mockResolvedValue([
                {
                    Id: "1",
                    Names: ["/daycare-sandbox-user-a"],
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": CURRENT_IMAGE_ID
                    }
                },
                {
                    Id: "2",
                    Names: ["/daycare-sandbox-user-b"],
                    Labels: {
                        "daycare.image.version": "0",
                        "daycare.image.id": CURRENT_IMAGE_ID
                    }
                },
                {
                    Id: "3",
                    Names: ["/daycare-sandbox-user-c"],
                    Labels: {
                        "daycare.image.version": DOCKER_IMAGE_VERSION,
                        "daycare.image.id": "sha256:old"
                    }
                }
            ]),
            getContainer: vi.fn().mockImplementation((id: string) => byId.get(id))
        } as unknown as Docker;

        await dockerContainersStaleRemove(docker, "daycare-sandbox:latest");

        expect(docker.listContainers).toHaveBeenCalledWith({
            all: true,
            filters: {
                name: ["daycare-sandbox-"]
            }
        });
        expect(currentContainer.stop).not.toHaveBeenCalled();
        expect(currentContainer.remove).not.toHaveBeenCalled();
        expect(staleVersionContainer.stop).toHaveBeenCalledTimes(1);
        expect(staleVersionContainer.remove).toHaveBeenCalledTimes(1);
        expect(staleImageContainer.stop).toHaveBeenCalledTimes(1);
        expect(staleImageContainer.remove).toHaveBeenCalledTimes(1);
    });

    it("treats containers without labels as stale", async () => {
        const staleContainer = {
            stop: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker.Container;

        const docker = {
            getImage: vi.fn().mockReturnValue({
                inspect: vi.fn().mockResolvedValue({ Id: CURRENT_IMAGE_ID })
            }),
            listContainers: vi.fn().mockResolvedValue([
                {
                    Id: "7",
                    Names: ["/daycare-sandbox-user-d"],
                    Labels: {}
                }
            ]),
            getContainer: vi.fn().mockReturnValue(staleContainer)
        } as unknown as Docker;

        await dockerContainersStaleRemove(docker, "daycare-sandbox:latest");

        expect(staleContainer.stop).toHaveBeenCalledTimes(1);
        expect(staleContainer.remove).toHaveBeenCalledTimes(1);
    });
});
