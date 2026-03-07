import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseQuery } from "./databaseQuery";

const BASE_URL = "http://localhost:7332";
const TOKEN = "test-token";

describe("databaseQuery", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () =>
                        Promise.resolve({
                            ok: true,
                            rows: [{ id: "1", name: "Ada" }]
                        })
                })
            )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("posts a query and returns rows", async () => {
        const rows = await databaseQuery(BASE_URL, TOKEN, null, "crm", "SELECT * FROM contacts WHERE id = $1", ["1"]);

        expect(rows).toEqual([{ id: "1", name: "Ada" }]);
        expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/databases/${encodeURIComponent("crm")}/query`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${TOKEN}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                sql: "SELECT * FROM contacts WHERE id = $1",
                params: ["1"]
            })
        });
    });

    it("throws the backend error when query fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () =>
                        Promise.resolve({
                            ok: false,
                            error: "read-only query rejected"
                        })
                })
            )
        );

        await expect(databaseQuery(BASE_URL, TOKEN, null, "crm", "DELETE FROM contacts")).rejects.toThrow(
            "read-only query rejected"
        );
    });
});
