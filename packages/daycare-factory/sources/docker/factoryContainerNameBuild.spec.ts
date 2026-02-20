import { describe, expect, it } from "vitest";
import { factoryContainerNameBuild } from "./factoryContainerNameBuild.js";

describe("factoryContainerNameBuild", () => {
    it("normalizes directory names into a docker-safe suffix", () => {
        const name = factoryContainerNameBuild("/tmp/My Task 01");
        expect(name).toBe("daycare-factory-my-task-01");
    });

    it("falls back when basename has no alphanumeric characters", () => {
        const name = factoryContainerNameBuild("/tmp/---");
        expect(name).toBe("daycare-factory-build");
    });
});
