import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerNetworksEnsure } from "./dockerNetworksEnsure.js";

describe("dockerNetworksEnsure", () => {
    it("creates isolated and local networks", async () => {
        const inspect = vi.fn().mockRejectedValue({ statusCode: 404 });
        const docker = {
            getNetwork: vi.fn().mockReturnValue({ inspect }),
            createNetwork: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker;

        await dockerNetworksEnsure(docker);

        expect(docker.createNetwork).toHaveBeenNthCalledWith(1, {
            Name: "daycare-isolated",
            Driver: "bridge",
            Internal: false,
            Options: {
                "com.docker.network.bridge.enable_icc": "false"
            }
        });
        expect(docker.createNetwork).toHaveBeenNthCalledWith(2, {
            Name: "daycare-local",
            Driver: "bridge",
            Internal: false
        });
    });
});
