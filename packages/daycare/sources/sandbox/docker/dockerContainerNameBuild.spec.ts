import { describe, expect, it } from "vitest";

import { dockerContainerNameBuild } from "./dockerContainerNameBuild.js";

describe("dockerContainerNameBuild", () => {
    it("creates a docker-safe container name from user id", () => {
        const name = dockerContainerNameBuild("User_42");
        expect(name).toBe("daycare-sandbox-user-42");
    });

    it("trims non-alphanumeric boundaries", () => {
        const name = dockerContainerNameBuild("---user---");
        expect(name).toBe("daycare-sandbox-user");
    });

    it("falls back when user id has no safe characters", () => {
        const name = dockerContainerNameBuild("---");
        expect(name).toBe("daycare-sandbox-user");
    });
});
