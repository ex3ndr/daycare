import type Docker from "dockerode";
import { describe, expect, it, vi } from "vitest";

import { dockerImageIdResolve } from "./dockerImageIdResolve.js";

describe("dockerImageIdResolve", () => {
    it("returns image Id from docker inspect", async () => {
        const inspect = vi.fn().mockResolvedValue({ Id: "sha256:abc123" });
        const getImage = vi.fn().mockReturnValue({ inspect });
        const docker = {
            getImage
        } as unknown as Docker;

        const result = await dockerImageIdResolve(docker, "daycare-sandbox:latest");

        expect(result).toBe("sha256:abc123");
        expect(getImage).toHaveBeenCalledWith("daycare-sandbox:latest");
        expect(inspect).toHaveBeenCalledTimes(1);
    });
});
