import type { TodoDbRecord, TodoStatus } from "@/types";

/**
 * Formats a flat todo list into a simple ASCII tree for tool output.
 * Expects: todos belong to the same workspace and include parentId links.
 */
export function todoTreeFormat(todos: TodoDbRecord[]): string {
    if (todos.length === 0) {
        return "(no todos)";
    }

    const todoIds = new Set(todos.map((todo) => todo.id));
    const childrenByParent = new Map<string, TodoDbRecord[]>();
    const roots = todos.filter((todo) => todo.parentId == null || !todoIds.has(todo.parentId));

    for (const todo of todos) {
        if (todo.parentId == null || !todoIds.has(todo.parentId)) {
            continue;
        }
        const siblings = childrenByParent.get(todo.parentId) ?? [];
        siblings.push(todo);
        siblings.sort((left, right) => left.rank.localeCompare(right.rank) || left.id.localeCompare(right.id));
        childrenByParent.set(todo.parentId, siblings);
    }

    roots.sort((left, right) => left.rank.localeCompare(right.rank) || left.id.localeCompare(right.id));

    const lines: string[] = [];
    for (const root of roots) {
        lines.push(todoLineBuild(root, 0));
        walk(root.id, 1, lines, childrenByParent);
    }
    return lines.join("\n");
}

function walk(parentId: string, depth: number, lines: string[], childrenByParent: Map<string, TodoDbRecord[]>): void {
    for (const child of childrenByParent.get(parentId) ?? []) {
        lines.push(todoLineBuild(child, depth));
        walk(child.id, depth + 1, lines, childrenByParent);
    }
}

function todoLineBuild(todo: TodoDbRecord, depth: number): string {
    return `${"  ".repeat(depth)}${todoStatusIcon(todo.status)} ${todo.title} [${todo.status}] (id: ${todo.id})`;
}

function todoStatusIcon(status: TodoStatus): string {
    switch (status) {
        case "draft":
            return "◻";
        case "unstarted":
            return "○";
        case "started":
            return "●";
        case "finished":
            return "✓";
        case "abandoned":
            return "✗";
    }
}
