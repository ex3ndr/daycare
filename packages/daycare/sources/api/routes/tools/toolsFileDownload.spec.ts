import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { toolsFileDownload } from "./toolsFileDownload.js";

describe("toolsFileDownload", () => {
    it("returns a downloadable tool definition json file", () => {
        const result = toolsFileDownload({
            toolName: "echo",
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
        if (!result.ok) {
            throw new Error("Expected successful file download.");
        }

        expect(result.file).toEqual({
            path: "definition.json",
            size: result.content.length,
            updatedAt: null,
            mimeType: "application/json",
            filename: "echo.definition.json"
        });
        expect(JSON.parse(result.content.toString("utf8"))).toEqual(
            expect.objectContaining({
                name: "echo",
                description: "Echo input text",
                parameters: expect.objectContaining({
                    type: "object",
                    properties: expect.objectContaining({
                        text: expect.objectContaining({
                            type: "string"
                        })
                    })
                })
            })
        );
    });

    it("returns not found for unknown tools", () => {
        const result = toolsFileDownload({
            toolName: "unknown",
            tools: {
                list: () => []
            }
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 404,
            error: "Tool not found."
        });
    });
});
