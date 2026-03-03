import { describe, expect, it } from "vitest";
import { experimentsTodoStateBuild } from "./experimentsTodoStateBuild";

describe("experimentsTodoStateBuild", () => {
    it("builds pointer updates with totals", () => {
        const updates = experimentsTodoStateBuild([
            { id: "a", title: "Draft UI schema", done: false, createdAt: 1 },
            { id: "b", title: "Persist todos", done: true, createdAt: 2 }
        ]);

        expect(updates["/stats/total"]).toBe(2);
        expect(updates["/stats/completed"]).toBe(1);
        expect(updates["/stats/open"]).toBe(1);
        expect(updates["/todos"]).toHaveLength(2);
    });
});
