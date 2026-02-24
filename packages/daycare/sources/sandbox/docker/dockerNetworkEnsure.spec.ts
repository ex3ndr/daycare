import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerNetworkEnsure } from "./dockerNetworkEnsure.js";

describe("dockerNetworkEnsure", () => {
    it("does nothing when network already exists", async () => {
        const inspect = vi.fn().mockResolvedValue({ Name: "daycare-isolated" });
        const docker = {
            getNetwork: vi.fn().mockReturnValue({ inspect }),
            createNetwork: vi.fn()
        } as unknown as Docker;

        await dockerNetworkEnsure(docker, "daycare-isolated", { internal: false, enableIcc: false });

        expect(docker.createNetwork).not.toHaveBeenCalled();
    });

    it("creates the network when missing", async () => {
        const inspect = vi.fn().mockRejectedValue({ statusCode: 404 });
        const docker = {
            getNetwork: vi.fn().mockReturnValue({ inspect }),
            createNetwork: vi.fn().mockResolvedValue(undefined)
        } as unknown as Docker;

        await dockerNetworkEnsure(docker, "daycare-isolated", { internal: false, enableIcc: false });

        expect(docker.createNetwork).toHaveBeenCalledWith({
            Name: "daycare-isolated",
            Driver: "bridge",
            Internal: false,
            Options: {
                "com.docker.network.bridge.enable_icc": "false"
            }
        });
    });

    it("ignores create races", async () => {
        const inspect = vi.fn().mockRejectedValue({ statusCode: 404 });
        const docker = {
            getNetwork: vi.fn().mockReturnValue({ inspect }),
            createNetwork: vi.fn().mockRejectedValue({ statusCode: 409 })
        } as unknown as Docker;

        await expect(
            dockerNetworkEnsure(docker, "daycare-isolated", {
                internal: false,
                enableIcc: false
            })
        ).resolves.toBeUndefined();
    });
});
