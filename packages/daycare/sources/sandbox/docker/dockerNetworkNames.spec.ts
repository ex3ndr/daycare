import { describe, expect, it } from "vitest";

import { DOCKER_NETWORK_ISOLATED, DOCKER_NETWORK_LOCAL } from "./dockerNetworkNames.js";

describe("dockerNetworkNames", () => {
    it("exports stable network names", () => {
        expect(DOCKER_NETWORK_ISOLATED).toBe("daycare-isolated");
        expect(DOCKER_NETWORK_LOCAL).toBe("daycare-local");
    });
});
