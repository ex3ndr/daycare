import * as React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { testRender } from "@/components/_testRender";

vi.mock("react-native", () => {
    function primitive(name: string) {
        return React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
            return React.createElement(name, { ...props, ref }, props.children as React.ReactNode);
        });
    }

    return {
        View: primitive("View"),
        Text: primitive("Text"),
        TextInput: primitive("TextInput"),
        Pressable: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
            return React.createElement("Pressable", { ...props, ref }, props.children as React.ReactNode);
        }),
        Platform: {
            OS: "ios",
            select: <T>(value: { default?: T; web?: T; ios?: T; android?: T }): T | undefined => {
                return value.ios ?? value.default;
            }
        }
    };
});

vi.mock("react-native-gesture-handler", async () => {
    const ReactModule = await import("react");
    return {
        Gesture: {
            Tap: () => ({
                onEnd: () => ({})
            })
        },
        GestureDetector: ({ children }: { children: React.ReactNode }) =>
            ReactModule.createElement(ReactModule.Fragment, null, children)
    };
});

vi.mock("react-native-unistyles", () => ({
    useUnistyles: () => ({
        theme: {
            layout: {
                isMobileLayout: false
            },
            colors: {
                primary: "#5B8DEF",
                onPrimary: "#FFFFFF",
                tertiary: "#8B5CF6",
                onSurface: "#111827",
                onSurfaceVariant: "#6B7280",
                surfaceContainerHigh: "#E5E7EB",
                secondaryContainer: "#D9F5E5",
                onSecondaryContainer: "#065F46"
            }
        }
    })
}));

import { TodoItem } from "./TodoItem";

function findByTestId(tree: ReturnType<typeof testRender>, testID: string) {
    return tree.root.find((node) => node.props?.testID === testID);
}

describe("TodoItem", () => {
    it("renders checkbox, icons, badges, and hint", () => {
        const onToggle = vi.fn();
        const onToggleIcon = vi.fn();
        const onPress = vi.fn();
        const tree = testRender(
            React.createElement(TodoItem, {
                id: "todo-1",
                title: "Review PR",
                done: true,
                icons: [
                    { name: "clock", set: "Feather" },
                    { name: "alert-circle", set: "Feather", color: "error" }
                ],
                counter: { current: 2, total: 5 },
                pill: "Today",
                hint: "Before standup",
                toggleIcon: { icon: "star", activeIcon: "star-fill", set: "Octicons", active: true },
                onToggle,
                onToggleIcon,
                onPress
            })
        );

        expect(findByTestId(tree, "todo-item-checkbox-todo-1")).toBeDefined();
        expect(findByTestId(tree, "todo-item-counter-todo-1")).toBeDefined();
        expect(findByTestId(tree, "todo-item-pill-todo-1")).toBeDefined();
        expect(findByTestId(tree, "todo-item-hint-todo-1")).toBeDefined();
        expect(findByTestId(tree, "todo-item-toggle-icon-todo-1")).toBeDefined();
        expect(
            tree.root.findAll((node) => node.props?.testID === "todo-item-icon-todo-1").length
        ).toBeGreaterThanOrEqual(2);

        findByTestId(tree, "todo-item-checkbox-todo-1").props.onPress();
        findByTestId(tree, "todo-item-toggle-icon-todo-1").props.onPress();
        findByTestId(tree, "todo-item-press-todo-1").props.onPress();

        expect(onToggle).toHaveBeenCalledWith("todo-1", false);
        expect(onToggleIcon).toHaveBeenCalledWith("todo-1", false);
        expect(onPress).toHaveBeenCalledWith("todo-1");
    });

    it("emits value changes when editing", async () => {
        const onValueChange = vi.fn();
        const tree = testRender(
            React.createElement(TodoItem, {
                id: "todo-2",
                title: "Draft spec",
                done: false,
                editable: true,
                showCheckbox: false,
                onValueChange
            })
        );

        const input = findByTestId(tree, "todo-item-title-input-todo-2");
        await renderer.act(async () => {
            input.props.onChangeText("  Finalize spec  ");
        });
        await renderer.act(async () => {
            input.props.onBlur();
        });

        expect(onValueChange).toHaveBeenCalledWith("todo-2", "Finalize spec");
    });
});
