import * as React from "react";
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
                outline: "#D1D5DB",
                onSurfaceVariant: "#6B7280"
            }
        }
    })
}));

import { TodoSeparator } from "./TodoSeparator";

function findByTestId(tree: ReturnType<typeof testRender>, testID: string) {
    return tree.root.find((node) => node.props?.testID === testID);
}

describe("TodoSeparator", () => {
    it("renders separator title and divider", () => {
        const tree = testRender(React.createElement(TodoSeparator, { id: "sep-1", title: "# Work" }));

        const title = findByTestId(tree, "todo-separator-title-sep-1");
        expect(title.props.children).toBe("Work");
        expect(findByTestId(tree, "todo-separator-divider-sep-1")).toBeDefined();
    });

    it("calls onPress when separator is tapped", () => {
        const onPress = vi.fn();
        const tree = testRender(React.createElement(TodoSeparator, { id: "sep-2", title: "Personal", onPress }));

        findByTestId(tree, "todo-separator-press-sep-2").props.onPress();
        expect(onPress).toHaveBeenCalledWith("sep-2");
    });
});
