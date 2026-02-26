import { describe, expect, it } from "vitest";

import { databaseClose } from "./databaseClose.js";
import { databaseOpen } from "./databaseOpen.js";

describe("databaseClose", () => {
    it("closes an open database", () => {
        const db = databaseOpen(":memory:");
        databaseClose(db);
        expect(() => db.prepare("SELECT 1").get()).toThrow();
    });
});
