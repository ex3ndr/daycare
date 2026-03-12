import { describe, expect, it } from "vitest";

import { agentRecipientResolve } from "./agentRecipientResolve.js";

describe("agentRecipientResolve", () => {
    it("returns connector recipient data from agent config", () => {
        expect(
            agentRecipientResolve({
                connector: { name: "telegram", key: "channel-1/user-2" }
            })
        ).toEqual({ name: "telegram", key: "channel-1/user-2" });
    });

    it("returns null when connector key is missing", () => {
        expect(
            agentRecipientResolve({
                connector: { name: "telegram", key: "   " }
            })
        ).toBeNull();
    });

    it("returns null when connector name is missing", () => {
        expect(
            agentRecipientResolve({
                connector: { name: "   ", key: "15551234567" }
            })
        ).toBeNull();
    });
});
