import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsList } from "./fragmentsList.js";

describe("fragmentsList", () => {
    it("lists public fragment fields", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const findAll = vi.fn(async () => [
            {
                id: "fragment-1",
                userId: "user-1",
                version: 2,
                validFrom: 10,
                validTo: null,
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile",
                spec: { type: "Column", children: [] },
                archived: false,
                createdAt: 1,
                updatedAt: 2
            }
        ]);

        const result = await fragmentsList({
            ctx,
            fragments: {
                findAll
            } as never
        });

        expect(result).toEqual({
            ok: true,
            fragments: [
                {
                    id: "fragment-1",
                    kitVersion: "1",
                    title: "Profile Card",
                    description: "Shows profile",
                    spec: { type: "Column", children: [] },
                    archived: false,
                    version: 2,
                    createdAt: 1,
                    updatedAt: 2
                }
            ]
        });
    });
});
