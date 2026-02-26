import { describe, expect, it } from "vitest";

import { databaseClose } from "./databaseClose.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseClose", () => {
    it("closes an open database", () => {
        const db = databaseOpenTest();
        databaseClose(db);
        expect(() => db.prepare("SELECT 1").get()).toThrow();
    });
});
