import { describe, expect, it } from "vitest";

import { connectorKeyTargetIdResolve } from "./connectorKeyTargetIdResolve.js";

describe("connectorKeyTargetIdResolve", () => {
    it("returns the target id for a matching connector key", () => {
        expect(connectorKeyTargetIdResolve("telegram", "telegram:123/456")).toBe("123/456");
    });

    it("rejects mismatched connector keys", () => {
        expect(() => connectorKeyTargetIdResolve("telegram", "whatsapp:123")).toThrow(
            "Connector key does not match connector telegram"
        );
    });
});
