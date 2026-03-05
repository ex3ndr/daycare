import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { fragmentsCreate } from "./fragmentsCreate.js";

describe("fragmentsCreate", () => {
    it("creates a fragment with valid input", async () => {
        const ctx = contextForUser({ userId: "user-1" });
        const create = vi.fn(async () => ({
            id: "fragment-1",
            userId: "user-1",
            version: 1,
            validFrom: 100,
            validTo: null,
            kitVersion: "1",
            title: "Profile Card",
            description: "Shows profile summary",
            spec: { root: "main", elements: { main: { type: "View", props: {}, children: [] } } },
            archived: false,
            createdAt: 100,
            updatedAt: 100
        }));
        vi.spyOn(Date, "now").mockReturnValue(100);

        const result = await fragmentsCreate({
            ctx,
            body: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { root: "main", elements: { main: { type: "View", props: {}, children: [] } } }
            },
            fragments: {
                create
            } as never
        });

        expect(result).toEqual({
            ok: true,
            fragment: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Profile Card",
                description: "Shows profile summary",
                spec: { root: "main", elements: { main: { type: "View", props: {}, children: [] } } },
                archived: false,
                version: 1,
                createdAt: 100,
                updatedAt: 100
            }
        });
    });

    it("rejects invalid input and reports repository errors", async () => {
        const ctx = contextForUser({ userId: "user-1" });

        await expect(
            fragmentsCreate({
                ctx,
                body: {
                    kitVersion: "1",
                    title: "No id",
                    spec: {}
                },
                fragments: {} as never
            })
        ).resolves.toEqual({ ok: false, error: "id is required." });

        await expect(
            fragmentsCreate({
                ctx,
                body: {
                    id: "fragment-1",
                    kitVersion: "1",
                    title: "Needs spec"
                },
                fragments: {} as never
            })
        ).resolves.toEqual({ ok: false, error: "spec is required." });

        const validSpec = { root: "main", elements: { main: { type: "View", props: {}, children: [] } } };
        const failed = await fragmentsCreate({
            ctx,
            body: {
                id: "fragment-1",
                kitVersion: "1",
                title: "Card",
                spec: validSpec
            },
            fragments: {
                create: async () => {
                    throw new Error("Fragment id already exists: fragment-1");
                }
            } as never
        });
        expect(failed).toEqual({ ok: false, error: "Fragment id already exists: fragment-1" });
    });
});
