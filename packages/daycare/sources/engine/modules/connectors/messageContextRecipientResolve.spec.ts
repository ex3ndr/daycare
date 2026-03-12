import { describe, expect, it } from "vitest";

import { messageContextRecipientResolve } from "./messageContextRecipientResolve.js";

describe("messageContextRecipientResolve", () => {
    it("returns a connector recipient from connectorKey", () => {
        expect(messageContextRecipientResolve({ connectorKey: "telegram:123" })).toEqual({
            connector: "telegram",
            recipient: { connectorKey: "telegram:123" }
        });
    });

    it("returns null when connectorKey is missing", () => {
        expect(messageContextRecipientResolve({})).toBeNull();
    });

    it("returns null for malformed connector keys", () => {
        expect(messageContextRecipientResolve({ connectorKey: "telegram" })).toBeNull();
    });
});
