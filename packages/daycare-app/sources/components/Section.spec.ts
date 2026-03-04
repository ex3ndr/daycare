import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { testRender } from "./_testRender";

const theme = {
    colors: {
        primary: "#3B82F6",
        surface: "#FFFFFF",
        surfaceContainer: "#F3F4F6",
        outlineVariant: "#D1D5DB",
        onSurface: "#111827"
    }
};

vi.mock("react-native-unistyles", () => ({
    useUnistyles: () => ({ theme })
}));

import { Section } from "./Section";

function textChildrenValues(textNodes: React.ComponentProps<typeof Text>[]) {
    return textNodes.map((node) => node.children);
}

describe("Section", () => {
    it("renders title and children", () => {
        const tree = testRender(
            React.createElement(Section, { title: "Metrics", spacing: 0 }, React.createElement(Text, null, "A"))
        );

        const values = textChildrenValues(tree.root.findAllByType(Text).map((node) => node.props));
        expect(values).toContain("Metrics");
    });

    it("renders icon, count, and action", () => {
        const action = React.createElement(Text, null, "Action");
        const tree = testRender(
            React.createElement(
                Section,
                { title: "Queue", icon: "list-outline", count: 4, action, spacing: 12, gap: 10 },
                React.createElement(Text, null, "Body")
            )
        );

        const values = textChildrenValues(tree.root.findAllByType(Text).map((node) => node.props));
        expect(values).toContain("Action");
        expect(values).toContain(4);

        const rootView = tree.root.findAllByType(View)[0];
        const style = StyleSheet.flatten(rootView.props.style);
        expect(style.marginTop).toBe(12);
        expect(style.gap).toBe(10);
    });
});
