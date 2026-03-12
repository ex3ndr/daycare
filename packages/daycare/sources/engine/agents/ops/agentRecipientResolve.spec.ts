import { describe, expect, it } from "vitest";

import { agentRecipientResolve } from "./agentRecipientResolve.js";

describe("agentRecipientResolve", () => {
    it("returns connector recipient data from agent config", () => {
        expect(
            agentRecipientResolve({
                connectorName: "telegram",
                connectorKey: "telegram:channel-1/user-2"
            })
        ).toEqual({
            connector: "telegram",
            recipient: { connectorKey: "telegram:channel-1/user-2" }
        });
    });

    it("returns null when connectorKey is missing", () => {
        expect(
            agentRecipientResolve({
                connectorName: "telegram",
                connectorKey: null
            })
        ).toBeNull();
    });

    it("returns null when connectorName conflicts with connectorKey", () => {
        expect(
            agentRecipientResolve({
                connectorName: "telegram",
                connectorKey: "whatsapp:15551234567"
            })
        ).toBeNull();
    });
});
