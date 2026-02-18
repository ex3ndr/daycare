import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

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
    const converted = rlmArgsConvert(
      ["/tmp/a.txt", new Map([["count", BigInt(3)]])],
      {},
      tool
    );

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

  it("returns joined text content", () => {
    const result: ToolExecutionResult = {
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
      typedResult: { text: "hello\nworld" }
    };

    expect(rlmResultConvert(result)).toEqual({ text: "hello\nworld" });
  });

  it("returns fallback error text for empty error payloads", () => {
    const result: ToolExecutionResult = {
      toolMessage: {
        role: "toolResult",
        toolCallId: "1",
        toolName: "x",
        content: [],
        isError: true,
        timestamp: Date.now()
      },
      typedResult: { text: "" }
    };

    expect(rlmResultConvert(result)).toEqual({ text: "" });
  });
});
