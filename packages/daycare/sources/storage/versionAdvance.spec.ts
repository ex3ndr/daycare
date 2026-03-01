import { describe, expect, it } from "vitest";
import { versionAdvance } from "./versionAdvance.js";

type TestRecord = {
    id: string;
    value: string;
    version: number;
    validFrom: number;
    validTo: number | null;
};

describe("versionAdvance", () => {
    it("closes current version and inserts next version", async () => {
        const rows: TestRecord[] = [
            {
                id: "item-1",
                value: "first",
                version: 1,
                validFrom: 100,
                validTo: null
            }
        ];

        const next = await versionAdvance<TestRecord>({
            now: 200,
            changes: { value: "second" },
            findCurrent: async () => rows.find((row) => row.validTo === null) ?? null,
            closeCurrent: async (current, now) => {
                const target = rows.find((row) => row.id === current.id && row.version === current.version);
                if (target) {
                    target.validTo = now;
                    return 1;
                }
                return 0;
            },
            insertNext: async (record) => {
                rows.push(record);
            }
        });

        expect(next.version).toBe(2);
        expect(next.validFrom).toBe(200);
        expect(next.validTo).toBeNull();
        expect(next.value).toBe("second");

        const closed = rows.find((row) => row.version === 1);
        expect(closed?.validTo).toBe(200);
    });

    it("throws when current version does not exist", async () => {
        await expect(
            versionAdvance<TestRecord>({
                changes: { value: "next" },
                findCurrent: async () => null,
                closeCurrent: async () => 0,
                insertNext: async () => undefined
            })
        ).rejects.toThrow("Current version not found.");
    });

    it("advances repeatedly from the latest current row", async () => {
        const rows: TestRecord[] = [
            {
                id: "item-1",
                value: "v1",
                version: 1,
                validFrom: 10,
                validTo: null
            }
        ];

        const handlers = {
            findCurrent: async () => rows.find((row) => row.validTo === null) ?? null,
            closeCurrent: async (current: TestRecord, now: number) => {
                const target = rows.find((row) => row.id === current.id && row.version === current.version);
                if (target) {
                    target.validTo = now;
                    return 1;
                }
                return 0;
            },
            insertNext: async (record: TestRecord) => {
                rows.push(record);
            }
        };

        const second = await versionAdvance<TestRecord>({
            now: 20,
            changes: { value: "v2" },
            ...handlers
        });
        const third = await versionAdvance<TestRecord>({
            now: 30,
            changes: { value: "v3" },
            ...handlers
        });

        expect(second.version).toBe(2);
        expect(third.version).toBe(3);
        expect(rows.filter((row) => row.validTo === null)).toHaveLength(1);
        expect(rows.find((row) => row.version === 3)?.value).toBe("v3");
    });

    it("throws when closing current version affects zero rows", async () => {
        await expect(
            versionAdvance<TestRecord>({
                now: 20,
                changes: { value: "second" },
                findCurrent: async () => ({
                    id: "item-1",
                    value: "first",
                    version: 1,
                    validFrom: 10,
                    validTo: null
                }),
                closeCurrent: async () => 0,
                insertNext: async () => undefined
            })
        ).rejects.toThrow("Current version close failed. Expected 1 row, got 0.");
    });
});
