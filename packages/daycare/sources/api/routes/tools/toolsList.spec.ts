import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { toolsList } from "./toolsList.js";

describe("toolsList", () => {
    it("returns tools with definition download metadata", () => {
        const result = toolsList({
            tools: {
                list: () =>
                    [
                        {
                            name: "echo",
                            description: "Echo input text",
                            parameters: Type.Object({
                                text: Type.String()
                            })
                        } satisfies Tool
                    ] satisfies Tool[]
            }
        });

        expect(result.ok).toBe(true);
        expect(result.tools).toHaveLength(1);
        expect(result.tools[0]).toEqual({
            name: "echo",
            description: "Echo input text",
            parameters: expect.objectContaining({
                type: "object",
                properties: expect.objectContaining({
                    text: expect.objectContaining({
                        type: "string"
                    })
                })
            }),
            files: [
                expect.objectContaining({
                    path: "definition.json",
                    updatedAt: null,
                    download: {
                        method: "GET",
                        path: "/tools/echo/download"
                    }
                })
            ]
        });
        expect(result.tools[0]?.files[0]?.size).toBeGreaterThan(0);
    });

    it("returns an empty list", () => {
        const result = toolsList({
            tools: {
                list: () => []
            }
        });

        expect(result).toEqual({
            ok: true,
            tools: []
        });
    });
});
