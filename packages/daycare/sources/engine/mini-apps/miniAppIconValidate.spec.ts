import { describe, expect, it } from "vitest";
import { MiniAppIconError } from "./miniAppIconError.js";
import { miniAppIconValidate } from "./miniAppIconValidate.js";

describe("miniAppIconValidate", () => {
    it("accepts valid octicons", () => {
        expect(miniAppIconValidate("browser")).toBe("browser");
    });

    it("rejects invalid octicons with the supported icon list", () => {
        expect(() => miniAppIconValidate("not-a-real-icon")).toThrowError(MiniAppIconError);
    });
});
