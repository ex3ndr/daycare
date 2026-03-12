import { describe, expect, it } from "vitest";

import { connectorRecipientKeyResolve } from "./connectorRecipientKeyResolve.js";

describe("connectorRecipientKeyResolve", () => {
    it("returns the trimmed raw key for a matching connector", () => {
        expect(connectorRecipientKeyResolve("telegram", { name: " telegram ", key: " 123 " })).toBe("123");
    });

    it("throws when the recipient connector does not match", () => {
        expect(() => connectorRecipientKeyResolve("telegram", { name: "whatsapp", key: "123" })).toThrow(
            "Connector recipient does not match connector telegram: whatsapp"
        );
    });

    it("throws when the recipient key is empty", () => {
        expect(() => connectorRecipientKeyResolve("telegram", { name: "telegram", key: "   " })).toThrow(
            "Connector recipient key is required for telegram."
        );
    });
});
