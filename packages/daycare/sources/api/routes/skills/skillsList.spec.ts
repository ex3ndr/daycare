import { describe, expect, it } from "vitest";
import { skillsList } from "./skillsList.js";

describe("skillsList", () => {
    it("returns listed skills without sourcePath", async () => {
        const result = await skillsList({
            skills: {
                list: async () => [
                    {
                        id: "user:my-skill",
                        name: "My Skill",
                        description: "desc",
                        sandbox: true,
                        permissions: ["@read:/tmp"],
                        source: "user",
                        sourcePath: "/tmp/SKILL.md"
                    }
                ]
            }
        });

        expect(result).toEqual({
            ok: true,
            skills: [
                {
                    id: "user:my-skill",
                    name: "My Skill",
                    description: "desc",
                    sandbox: true,
                    permissions: ["@read:/tmp"],
                    source: "user"
                }
            ]
        });
    });

    it("returns empty list", async () => {
        const result = await skillsList({
            skills: {
                list: async () => []
            }
        });

        expect(result).toEqual({ ok: true, skills: [] });
    });
});
