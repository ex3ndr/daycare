import { describe, expect, it } from "vitest";
import type { TodoDbRecord } from "@/types";
import { todoTreeFormat } from "./todoTreeFormat.js";

describe("todoTreeFormat", () => {
    it("formats an empty todo list", () => {
        expect(todoTreeFormat([])).toBe("(no todos)");
    });

    it("formats a single todo", () => {
        expect(
            todoTreeFormat([
                todoBuild({
                    id: "todo-1",
                    title: "Write spec",
                    status: "draft",
                    rank: "a0"
                })
            ])
        ).toBe("◻ Write spec [draft] (id: todo-1)");
    });

    it("formats nested todos", () => {
        expect(
            todoTreeFormat([
                todoBuild({ id: "root", title: "Build MVP", status: "unstarted", rank: "a0" }),
                todoBuild({
                    id: "child",
                    parentId: "root",
                    title: "Design schema",
                    status: "started",
                    rank: "a0"
                }),
                todoBuild({
                    id: "grandchild",
                    parentId: "child",
                    title: "Choose ORM",
                    status: "finished",
                    rank: "a0"
                })
            ])
        ).toBe(
            [
                "○ Build MVP [unstarted] (id: root)",
                "  ● Design schema [started] (id: child)",
                "    ✓ Choose ORM [finished] (id: grandchild)"
            ].join("\n")
        );
    });

    it("formats multiple roots in rank order", () => {
        expect(
            todoTreeFormat([
                todoBuild({ id: "second", title: "Second", status: "abandoned", rank: "a1" }),
                todoBuild({ id: "first", title: "First", status: "unstarted", rank: "a0" })
            ])
        ).toBe(["○ First [unstarted] (id: first)", "✗ Second [abandoned] (id: second)"].join("\n"));
    });
});

function todoBuild(
    input: Partial<TodoDbRecord> & Pick<TodoDbRecord, "id" | "title" | "status" | "rank">
): TodoDbRecord {
    return {
        id: input.id,
        workspaceId: input.workspaceId ?? "workspace-1",
        parentId: input.parentId ?? null,
        title: input.title,
        description: input.description ?? "",
        status: input.status,
        rank: input.rank,
        version: input.version ?? 1,
        validFrom: input.validFrom ?? 1,
        validTo: input.validTo ?? null,
        createdAt: input.createdAt ?? 1,
        updatedAt: input.updatedAt ?? 1
    };
}
