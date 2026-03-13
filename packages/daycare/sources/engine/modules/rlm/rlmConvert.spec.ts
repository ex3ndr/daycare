import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import type { ToolExecutionResult } from "@/types";
import { MONTY_RESPONSE_SCHEMA_KEY } from "../monty/montyResponseSchemaKey.js";
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
    const flexibleTool = {
        name: "write_file",
        description: "",
        parameters: Type.Object(
            {
                path: Type.String(),
                content: Type.Unknown(),
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
            parameters: Type.Object(
                {
                    mode: Type.Optional(Type.String()),
                    path: Type.String(),
                    content: Type.String()
                },
                { additionalProperties: false }
            )
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

    it("converts nested Monty map and bigint values when the schema allows them", () => {
        const converted = rlmArgsConvert(["/tmp/a.txt", new Map([["count", BigInt(3)]])], {}, flexibleTool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: {
                count: 3
            }
        });
    });

    it("treats Python None for optional arguments as omission", () => {
        const converted = rlmArgsConvert(["/tmp/a.txt", "hello", null], {}, tool);

        expect(converted).toEqual({
            path: "/tmp/a.txt",
            content: "hello"
        });
    });

    it("throws when a Python value does not match the declared schema", () => {
        expect(() => rlmArgsConvert(["/tmp/a.txt", new Map([["count", 3]])], {}, tool)).toThrow(
            'Tool "write_file" arguments.content must be a string.'
        );
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

    it("falls back to generic safe object conversion when no response schema is provided", () => {
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

    it("omits undefined optional fields when a response schema is available", () => {
        const result = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "read_json",
                content: [{ type: "text", text: "ok" }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: {
                rows: [{ id: "1", parentId: undefined }]
            }
        } as unknown as ToolExecutionResult;

        expect(
            rlmResultConvert(
                result,
                toolWithResponseSchemaBuild(
                    {
                        name: "read_json",
                        description: "",
                        parameters: Type.Object({}, { additionalProperties: false })
                    },
                    Type.Object(
                        {
                            rows: Type.Array(
                                Type.Object(
                                    {
                                        id: Type.String(),
                                        parentId: Type.Optional(Type.String())
                                    },
                                    { additionalProperties: false }
                                )
                            )
                        },
                        { additionalProperties: false }
                    )
                )
            )
        ).toEqual({
            rows: [{ id: "1" }]
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
                invalid: Symbol("bad")
            }
        } as unknown as ToolExecutionResult;

        expect(() => rlmResultConvert(result)).toThrow(
            'Tool "broken_tool" response.invalid cannot be converted from symbol.'
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

    it("does not fall back to tool summary text when response conversion fails", () => {
        const result = {
            toolMessage: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "broken_tool",
                content: [{ type: "text", text: "summary fallback text" }],
                isError: false,
                timestamp: Date.now()
            },
            typedResult: {
                value: new Date("2020-01-01T00:00:00Z")
            }
        } as unknown as ToolExecutionResult;

        expect(() =>
            rlmResultConvert(
                result,
                toolWithResponseSchemaBuild(
                    {
                        name: "broken_tool",
                        description: "",
                        parameters: Type.Object({}, { additionalProperties: false })
                    },
                    Type.Object(
                        {
                            value: Type.Unknown()
                        },
                        { additionalProperties: false }
                    )
                )
            )
        ).toThrow('Tool "broken_tool" response.value cannot be converted from Date.');
    });
});

function toolWithResponseSchemaBuild(tool: Tool, schema: unknown): Tool {
    const result = { ...tool } as Tool;
    Object.defineProperty(result, MONTY_RESPONSE_SCHEMA_KEY, {
        value: schema,
        enumerable: false,
        configurable: false
    });
    return result;
}
