import { describe, expect, it } from "vitest";
import { factoryContainerPiBindBuild } from "./factoryContainerPiBindBuild.js";

describe("factoryContainerPiBindBuild", () => {
    it("builds readonly bind mount for host .pi directory", () => {
        expect(factoryContainerPiBindBuild("/Users/test/.pi")).toBe("/Users/test/.pi:/root/.pi:ro");
    });
});
