import { describe, expect, it } from "vitest";
import type { Tool } from "@mariozechner/pi-ai";

import { montyPythonSignatureBuild } from "./montyPythonSignatureBuild.js";

describe("montyPythonSignatureBuild", () => {
  it("builds exact required-first signature with defaults for optional args", () => {
    const tool = {
      name: "create_task",
      description: "Create task",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string" },
          taskId: { type: "string" },
          priority: { type: "integer" }
        },
        required: ["taskId"],
        additionalProperties: false
      }
    } as unknown as Tool;

    expect(montyPythonSignatureBuild(tool)).toBe(
      "taskId: str, note: str | None = None, priority: int | None = None"
    );
  });

  it("skips invalid Python parameter names exactly", () => {
    const tool = {
      name: "search",
      description: "Search",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          "bad-name": { type: "string" },
          page: { type: "integer" }
        },
        required: ["query", "bad-name"],
        additionalProperties: false
      }
    } as unknown as Tool;

    expect(montyPythonSignatureBuild(tool)).toBe("query: str, page: int | None = None");
  });
});
