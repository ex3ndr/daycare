import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

describe("rlmPreambleBuild", () => {
  it("generates sync stubs with python hints", () => {
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

    const preamble = rlmPreambleBuild(tools);

    expect(preamble).toContain("def read_file(path: str, retries: int | None = None, verbose: bool | None = None) -> str:");
    expect(preamble).toContain('"""Read a file from disk."""');
    expect(preamble).toContain("def __daycare_print__(*values: Any) -> None:");
    expect(preamble).toContain("ToolError = RuntimeError");
  });

  it("skips run_python and invalid python identifiers", () => {
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

    const preamble = rlmPreambleBuild(tools);

    expect(preamble).not.toContain("def run_python");
    expect(preamble).not.toContain("def search-v2");
    expect(preamble).toContain("def search_v2(query: str) -> str:");
  });

  it("emits required parameters before optional parameters", () => {
    const tools = [
      {
        name: "create_task",
        description: "Create task",
        parameters: Type.Object(
          {
            note: Type.Optional(Type.String()),
            taskId: Type.String(),
            priority: Type.Optional(Type.Integer())
          },
          { additionalProperties: false }
        )
      }
    ] as unknown as Tool[];

    const preamble = rlmPreambleBuild(tools);

    expect(preamble).toContain(
      "def create_task(taskId: str, note: str | None = None, priority: int | None = None) -> str:"
    );
  });
});
