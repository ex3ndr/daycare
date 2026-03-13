import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import type { ToolExecutionResult } from "@/types";
import { rlmArgsConvert, rlmResultConvert } from "./rlmConvert.js";

describe("rlmArgsConvert", () => {
    const tool = {
        name: "write_file",
        description: "",
        parameters: Type.Object(
            {
                path: Type.String(),
                content: Type.String(),
                mode: Type.Optional(Type.String())
            },
            { additionalProperties: false }
        )
    } as unknown as Tool;

    it("maps positional arguments by generated stub parameter order", () => {
        const converted = rlmArgsConvert(["/tmp/a.txt", "hello"], {}, tool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: "hello"
        });
    });

    it("maps positional arguments required-first when optional keys appear first", () => {
        const reorderedTool = {
            name: "write_file",
            description: "",
            parameters: {
                type: "object",
                properties: {
                    mode: { type: "string" },
                    path: { type: "string" },
                    content: { type: "string" }
                },
                required: ["path", "content"],
                additionalProperties: false
            }
        } as unknown as Tool;

        const converted = rlmArgsConvert(["/tmp/a.txt", "hello"], {}, reorderedTool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: "hello"
        });
    });

    it("merges kwargs and lets kwargs override positional args", () => {
        const converted = rlmArgsConvert(["/tmp/a.txt", "hello"], { content: "override" }, tool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: "override"
        });
    });

    it("converts nested Monty map and bigint values", () => {
        const converted = rlmArgsConvert(["/tmp/a.txt", new Map([["count", BigInt(3)]])], {}, tool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: {
                count: 3
            }
        });
    });
});

describe("rlmResultConvert", () => {
    it("prefers typed results for python return values", () => {
        const result: ToolExecutionResult<{ ok: boolean; rows: Array<{ name: string }> }> = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "x",
                content: [{ type: "text", text: "fallback text" }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: {
                ok: true,
                rows: [{ name: "alice" }]
            }
        };

        expect(rlmResultConvert(result)).toEqual({
            ok: true,
            rows: [{ name: "alice" }]
        });
    });

    it("normalizes undefined values to null", () => {
        const result = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "x",
                content: [
                    { type: "text", text: "hello" },
                    { type: "text", text: "world" }
                ],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: {
                rows: [{ id: "1", parentId: undefined }]
            }
        } as unknown as ToolExecutionResult;

        expect(rlmResultConvert(result)).toEqual({
            rows: [{ id: "1", parentId: null }]
        });
    });

    it("throws when typed result cannot be converted to Monty", () => {
        const result = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "broken_tool",
                content: [{ type: "text", text: "fallback text" }],
                isError: true,
                timestamp: Date.now()
            },
            typedResult: {
                invalid: BigInt(1)
            }
        } as unknown as ToolExecutionResult;

        expect(() => rlmResultConvert(result)).toThrow(
            'Tool "broken_tool" returned a value that cannot be converted for Monty.'
        );
    });

    it("keeps nested typed JSON structures", () => {
        const result: ToolExecutionResult<{
            value: { meta: { ids: string[]; enabled: boolean }; rows: Array<{ id: string; tags: string[] }> };
        }> = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "read_json",
                content: [{ type: "text", text: "ok" }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: {
                value: {
                    meta: { ids: ["a", "b"], enabled: true },
                    rows: [{ id: "1", tags: ["x", "y"] }]
                }
            }
        };

        expect(rlmResultConvert(result)).toEqual({
            value: {
                meta: { ids: ["a", "b"], enabled: true },
                rows: [{ id: "1", tags: ["x", "y"] }]
            }
        });
    });
});
