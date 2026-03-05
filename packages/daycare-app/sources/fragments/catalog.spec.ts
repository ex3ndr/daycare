import type { Spec } from "@json-render/react-native";
import { describe, expect, it } from "vitest";
import { fragmentsCatalog } from "./catalog";

function todoListSpec(props: Record<string, unknown>): Spec {
    return {
        root: "root",
        elements: {
            root: {
                type: "TodoList",
                props,
                children: []
            }
        }
    };
}

describe("fragmentsCatalog TodoList schema", () => {
    it("accepts a bound-state TodoList with optional visual props", () => {
        const spec = todoListSpec({
            items: { $bindState: "/todos" },
            gap: "sm",
            showCheckbox: true,
            editable: true,
            pillColor: "primaryContainer",
            pillTextColor: "onPrimaryContainer",
            toggleIcon: {
                icon: "star",
                activeIcon: "star-fill",
                set: "Octicons",
                color: "onSurfaceVariant",
                activeColor: "tertiary"
            }
        });

        const result = fragmentsCatalog.validate(spec);
        expect(result.success).toBe(true);
    });

    it("rejects invalid showCheckbox type", () => {
        const todoListPropsSchema = fragmentsCatalog.data.components.TodoList.props;
        const result = todoListPropsSchema.safeParse({
            items: [{ id: "1", title: "Review PR", done: false }],
            // biome-ignore lint/suspicious/noExplicitAny: intentional invalid value for schema test
            showCheckbox: "yes" as any
        });

        expect(result.success).toBe(false);
    });

    it("rejects toggleIcon when required icon fields are missing", () => {
        const todoListPropsSchema = fragmentsCatalog.data.components.TodoList.props;
        const result = todoListPropsSchema.safeParse({
            items: [
                {
                    id: "1",
                    title: "Review PR",
                    done: false
                }
            ],
            toggleIcon: {
                icon: "star"
            }
        });

        expect(result.success).toBe(false);
    });
});
