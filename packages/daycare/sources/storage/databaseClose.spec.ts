import { describe, expect, it } from "vitest";

import { databaseClose } from "./databaseClose.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseClose", () => {
    it("closes an open database", async () => {
        const db = databaseOpenTest();
        await databaseClose(db);
        await expect(db.prepare("SELECT 1").get()).rejects.toThrow();
    });
});
