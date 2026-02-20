import { describe, expect, it } from "vitest";

import { userConnectorKeyCreate } from "./userConnectorKeyCreate.js";

describe("userConnectorKeyCreate", () => {
    it("builds connector keys from connector and userId", () => {
        expect(userConnectorKeyCreate("telegram", "123")).toBe("telegram:123");
    });

    it("trims inputs", () => {
        expect(userConnectorKeyCreate(" telegram ", " 123 ")).toBe("telegram:123");
    });

    it("throws for empty connector", () => {
        expect(() => userConnectorKeyCreate("", "123")).toThrow("Connector is required");
    });

    it("throws for empty userId", () => {
        expect(() => userConnectorKeyCreate("telegram", "   ")).toThrow("Connector userId is required");
    });
});
