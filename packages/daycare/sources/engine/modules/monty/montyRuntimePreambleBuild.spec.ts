import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import { montyRuntimePreambleBuild } from "./montyRuntimePreambleBuild.js";

describe("montyRuntimePreambleBuild", () => {
    it("renders runtime preamble with callable function stubs and without prompt text", () => {
        const result = montyRuntimePreambleBuild([
            {
                name: "run_python",
                description: "meta",
                parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
            },
            {
                name: "echo",
                description: "Echo text",
                parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
            }
        ]);
        const expected = [
            "from typing import Any, TYPE_CHECKING",
            "",
            "ToolError = RuntimeError",
            "",
            "if TYPE_CHECKING:",
            "    def __daycare_print__(*values: Any) -> None:",
            '        raise NotImplementedError("__daycare_print__ is provided by runtime.")',
            "",
            "    def echo(text: str) -> Any:",
            '        raise NotImplementedError("echo is provided by runtime.")'
        ].join("\n");
        expect(result).toBe(expected);
        expect(result).not.toContain("if False:");
        expect(result).not.toContain("# You have the following tools");
    });
});
