import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { montyPreambleBuild } from "./montyPreambleBuild.js";

describe("montyPreambleBuild", () => {
  it("renders full preamble with exact stub text", () => {
    const tools = [
      {
        name: "read_file",
        description: "Read a file from disk.",
        parameters: Type.Object(
          {
            path: Type.String(),
            retries: Type.Optional(Type.Integer()),
            verbose: Type.Optional(Type.Boolean())
          },
          { additionalProperties: false }
        )
      }
    ] as unknown as Tool[];

    const result = montyPreambleBuild(tools);
    const expected = [
      "# You have the following tools available as Python functions.",
      "# Call tool functions directly (no await).",
      "# Tool failures raise ToolError (alias of RuntimeError).",
      "# Use print() for debug logs; the last expression is returned.",
      "",
      "from typing import Any",
      "",
      "ToolError = RuntimeError",
      "",
      "# Typed tool stubs for code assistance only (not executed).",
      "if False:",
      "    def __daycare_print__(*values: Any) -> None:",
      "        ...",
      "",
      "    def read_file(path: str, retries: int | None = None, verbose: bool | None = None) -> str:",
      "        \"\"\"Read a file from disk.\"\"\"",
      "        ..."
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("skips run_python and invalid tool names with exact output", () => {
    const tools = [
      {
        name: "run_python",
        description: "Meta tool",
        parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
      },
      {
        name: "search-v2",
        description: "invalid python name",
        parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
      },
      {
        name: "search_v2",
        description: "valid python name",
        parameters: Type.Object({ query: Type.String() }, { additionalProperties: false })
      }
    ] as unknown as Tool[];

    const result = montyPreambleBuild(tools);
    const expected = [
      "# You have the following tools available as Python functions.",
      "# Call tool functions directly (no await).",
      "# Tool failures raise ToolError (alias of RuntimeError).",
      "# Use print() for debug logs; the last expression is returned.",
      "",
      "from typing import Any",
      "",
      "ToolError = RuntimeError",
      "",
      "# Typed tool stubs for code assistance only (not executed).",
      "if False:",
      "    def __daycare_print__(*values: Any) -> None:",
      "        ...",
      "",
      "    def search_v2(query: str) -> str:",
      "        \"\"\"valid python name\"\"\"",
      "        ..."
    ].join("\n");

    expect(result).toBe(expected);
  });

  it("renders pass when no callable tools remain", () => {
    const tools = [
      {
        name: "run_python",
        description: "Meta tool",
        parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
      }
    ] as unknown as Tool[];

    const result = montyPreambleBuild(tools);
    const expected = [
      "# You have the following tools available as Python functions.",
      "# Call tool functions directly (no await).",
      "# Tool failures raise ToolError (alias of RuntimeError).",
      "# Use print() for debug logs; the last expression is returned.",
      "",
      "from typing import Any",
      "",
      "ToolError = RuntimeError",
      "",
      "# Typed tool stubs for code assistance only (not executed).",
      "if False:",
      "    def __daycare_print__(*values: Any) -> None:",
      "        ...",
      "",
      "    pass"
    ].join("\n");

    expect(result).toBe(expected);
  });
});
