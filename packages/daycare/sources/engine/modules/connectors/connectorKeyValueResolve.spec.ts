import { describe, expect, it } from "vitest";

import { connectorKeyValueResolve } from "./connectorKeyValueResolve.js";

describe("connectorKeyValueResolve", () => {
    it("returns the connector value for a matching connector key", () => {
        expect(connectorKeyValueResolve("telegram", "telegram:123/456")).toBe("123/456");
    });

    it("rejects mismatched connector keys", () => {
        expect(() => connectorKeyValueResolve("telegram", "whatsapp:123")).toThrow(
            "Connector key does not match connector telegram"
        );
    });
});
