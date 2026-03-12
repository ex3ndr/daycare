import { describe, expect, it } from "vitest";

import { messageContextRecipientResolve } from "./messageContextRecipientResolve.js";

describe("messageContextRecipientResolve", () => {
    it("returns a connector recipient from context.connector", () => {
        expect(messageContextRecipientResolve({ connector: { name: "telegram", key: "123" } })).toEqual({
            name: "telegram",
            key: "123"
        });
    });

    it("returns null when connectorKey is missing", () => {
        expect(messageContextRecipientResolve({})).toBeNull();
    });

    it("returns null for malformed connector values", () => {
        expect(messageContextRecipientResolve({ connector: { name: "telegram", key: "   " } })).toBeNull();
    });
});
