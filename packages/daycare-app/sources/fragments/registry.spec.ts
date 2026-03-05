import * as React from "react";
import { Pressable, Text, View } from "react-native";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { testRender } from "@/components/_testRender";
import { TODO_HEIGHT } from "@/views/todos/todoHeight";

let latestBoundItems: unknown = [];
const stateSet = vi.fn();

vi.mock("react-native-unistyles", () => ({
    useUnistyles: () => ({
        theme: {
            colors: {
                primary: "#5B8DEF",
                onPrimary: "#FFFFFF",
                onSurface: "#111827",
                onSurfaceVariant: "#6B7280",
                surfaceContainer: "#F3F4F6",
                surfaceContainerLow: "#F5F6F8",
                surfaceContainerHigh: "#E5E7EB",
                surfaceContainerHighest: "#D1D5DB",
                surfaceContainerLowest: "#FAFAFA",
                secondaryContainer: "#D9F5E5",
                onSecondaryContainer: "#065F46",
                outline: "#D1D5DB",
                outlineVariant: "#D1D5DB"
            },
            elevation: {
                level0: "",
                level1: "",
                level2: "",
                level3: ""
            }
        }
    }),
    StyleSheet: {
        create: (styles: unknown) => styles,
        hairlineWidth: 1
    }
}));

vi.mock("@json-render/react-native", async () => {
    const ReactModule = await import("react");

    return {
        defineRegistry: (_catalog: unknown, options: { components: unknown }) => ({
            registry: options.components
        }),
        useStateStore: () => ({
            set: stateSet
        }),
        useBoundProp: (value: unknown) => {
            const [boundValue, setBoundValue] = ReactModule.useState(value);
            latestBoundItems = boundValue;

            return [
                boundValue,
                (nextValue: unknown) => {
                    latestBoundItems = nextValue;
                    setBoundValue(nextValue);
                }
            ] as const;
        }
    };
});

vi.mock("@/components/ReorderingList", () => ({
    ReorderingList: function MockReorderingList(props: {
        items: Array<{ id: string }>;
        renderItem: (item: { id: string }) => React.ReactNode;
        keyExtractor: (item: { id: string }) => string;
        itemHeight: number;
        gap: number;
        onMove?: (id: string, toIndex: number) => void;
    }) {
        return React.createElement(
            View,
            { testID: "mock-reordering-list-web" },
            React.createElement(Text, { testID: "mock-item-height" }, String(props.itemHeight)),
            React.createElement(Text, { testID: "mock-gap" }, String(props.gap)),
            React.createElement(Pressable, {
                testID: "mock-move",
                onPress: () => {
                    if (props.items.length > 1) {
                        props.onMove?.(props.items[0].id, props.items.length - 1);
                    }
                }
            }),
            ...props.items.map((item) =>
                React.createElement(View, { key: props.keyExtractor(item) }, props.renderItem(item))
            )
        );
    }
}));

vi.mock("@/components/ReorderingList2", () => ({
    ReorderingList2: function MockReorderingList2() {
        return React.createElement(View, { testID: "mock-reordering-list-mobile" });
    }
}));

vi.mock("@/components/Item", () => ({
    Item: function MockItem() {
        return React.createElement(View, { testID: "mock-item" });
    }
}));

vi.mock("@/components/ItemGroup", () => ({
    ItemGroup: function MockItemGroup(props: { children?: React.ReactNode }) {
        return React.createElement(View, { testID: "mock-item-group" }, props.children);
    }
}));

vi.mock("@/components/ItemList", () => ({
    ItemList: function MockItemList(props: { children?: React.ReactNode }) {
        return React.createElement(View, { testID: "mock-item-list" }, props.children);
    }
}));

vi.mock("./TodoItem", () => ({
    TodoItem: function MockTodoItem(props: {
        id: string;
        title: string;
        editable?: boolean;
        onPress?: (id: string) => void;
        onToggle?: (id: string, next: boolean) => void;
        onToggleIcon?: (id: string, next: boolean) => void;
        onValueChange?: (id: string, value: string) => void;
    }) {
        return React.createElement(
            View,
            { testID: `mock-todo-item-${props.id}` },
            React.createElement(Pressable, {
                testID: `mock-item-press-${props.id}`,
                onPress: () => props.onPress?.(props.id)
            }),
            React.createElement(Pressable, {
                testID: `mock-item-toggle-${props.id}`,
                onPress: () => props.onToggle?.(props.id, true)
            }),
            React.createElement(Pressable, {
                testID: `mock-item-toggle-icon-${props.id}`,
                onPress: () => props.onToggleIcon?.(props.id, true)
            }),
            props.editable
                ? React.createElement(Pressable, {
                      testID: `mock-item-change-${props.id}`,
                      onPress: () => props.onValueChange?.(props.id, "Updated title")
                  })
                : null
        );
    }
}));

vi.mock("./TodoSeparator", () => ({
    TodoSeparator: function MockTodoSeparator(props: { id: string; onPress?: (id: string) => void }) {
        return React.createElement(Pressable, {
            testID: `mock-separator-press-${props.id}`,
            onPress: () => props.onPress?.(props.id)
        });
    }
}));

import { fragmentsComponents } from "./registry";

function findByTestId(tree: ReturnType<typeof testRender>, testID: string) {
    return tree.root.find((node) => node.props?.testID === testID);
}

describe("fragments registry TodoList component", () => {
    it("renders items, updates bound items, and emits all todo events", () => {
        const emit = vi.fn();
        const items = [
            { id: "1", title: "Review PR", done: false, toggleIcon: { active: false } },
            { id: "s1", type: "separator" as const, title: "Work" },
            { id: "2", title: "Ship release", done: false, toggleIcon: { active: false } }
        ];

        latestBoundItems = items;
        stateSet.mockReset();

        const Host = () =>
            fragmentsComponents.TodoList({
                props: {
                    items,
                    itemHeight: null,
                    gap: null,
                    showCheckbox: null,
                    editable: true,
                    pillColor: null,
                    pillTextColor: null,
                    toggleIcon: {
                        icon: "star",
                        activeIcon: "star-fill",
                        set: "Octicons",
                        color: null,
                        activeColor: null
                    }
                },
                bindings: {
                    items: "/todos"
                },
                emit,
                children: null
            });

        const tree = testRender(React.createElement(Host));
        expect(findByTestId(tree, "mock-item-height").props.children).toBe(String(TODO_HEIGHT));
        expect(findByTestId(tree, "mock-gap").props.children).toBe("4");
        expect(findByTestId(tree, "mock-todo-item-1")).toBeDefined();
        expect(findByTestId(tree, "mock-separator-press-s1")).toBeDefined();

        renderer.act(() => {
            findByTestId(tree, "mock-item-press-1").props.onPress();
        });
        renderer.act(() => {
            findByTestId(tree, "mock-item-toggle-1").props.onPress();
        });
        renderer.act(() => {
            findByTestId(tree, "mock-item-toggle-icon-1").props.onPress();
        });
        renderer.act(() => {
            findByTestId(tree, "mock-item-change-1").props.onPress();
        });
        renderer.act(() => {
            findByTestId(tree, "mock-move").props.onPress();
        });

        expect(emit).toHaveBeenCalledWith("press");
        expect(emit).toHaveBeenCalledWith("toggle");
        expect(emit).toHaveBeenCalledWith("toggleIcon");
        expect(emit).toHaveBeenCalledWith("change");
        expect(emit).toHaveBeenCalledWith("move");

        const nextItems = latestBoundItems as Array<{
            id: string;
            title: string;
            done?: boolean;
            toggleIcon?: { active?: boolean };
        }>;
        expect(nextItems[nextItems.length - 1]?.id).toBe("1");
        expect(nextItems.find((item) => item.id === "1")?.done).toBe(true);
        expect(nextItems.find((item) => item.id === "1")?.toggleIcon?.active).toBe(true);
        expect(nextItems.find((item) => item.id === "1")?.title).toBe("Updated title");
        expect(stateSet).toHaveBeenCalled();
    });
});
