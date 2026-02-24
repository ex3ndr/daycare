import { describe, expect, it } from "vitest";

import { dockerContainerNetworkStateResolve } from "./dockerContainerNetworkStateResolve.js";

describe("dockerContainerNetworkStateResolve", () => {
    it("returns correct when inspect payload omits network info", () => {
        const state = dockerContainerNetworkStateResolve({}, "daycare-isolated");
        expect(state).toBe("correct");
    });

    it("returns correct when only expected network is attached", () => {
        const state = dockerContainerNetworkStateResolve(
            {
                NetworkSettings: {
                    Networks: {
                        "daycare-isolated": {}
                    }
                }
            },
            "daycare-isolated"
        );
        expect(state).toBe("correct");
    });

    it("returns wrong when different network is attached", () => {
        const state = dockerContainerNetworkStateResolve(
            {
                NetworkSettings: {
                    Networks: {
                        bridge: {}
                    }
                }
            },
            "daycare-isolated"
        );
        expect(state).toBe("wrong");
    });

    it("returns wrong when multiple networks are attached", () => {
        const state = dockerContainerNetworkStateResolve(
            {
                NetworkSettings: {
                    Networks: {
                        "daycare-isolated": {},
                        bridge: {}
                    }
                }
            },
            "daycare-isolated"
        );
        expect(state).toBe("wrong");
    });
});
