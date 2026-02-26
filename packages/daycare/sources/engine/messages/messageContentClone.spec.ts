import { describe, expect, it } from "vitest";
import { messageContentClone } from "./messageContentClone.js";

describe("messageContentClone", () => {
    it("deep-clones tool call arguments", () => {
        const content = [
            {
                type: "toolCall" as const,
                id: "tool-1",
                name: "echo",
                arguments: { nested: { value: 1 } }
            }
        ];

        const cloned = messageContentClone(content);
        const first = cloned[0];
        if (!first || first.type !== "toolCall") {
            throw new Error("Expected cloned tool call");
        }
        (first.arguments.nested as { value: number }).value = 2;

        expect(content[0]?.arguments).toEqual({ nested: { value: 1 } });
    });
});
