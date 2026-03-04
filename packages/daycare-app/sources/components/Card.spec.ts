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

import { Card } from "./Card";

describe("Card", () => {
    it("renders filled variant by default", () => {
        const tree = testRender(React.createElement(Card, null, React.createElement(Text, null, "Body")));
        const card = tree.root.findByType(View);
        const style = StyleSheet.flatten(card.props.style);

        expect(style.backgroundColor).toBe(theme.colors.surfaceContainer);
        expect(style.padding).toBe(16);
        expect(style.borderRadius).toBe(16);
    });

    it("supports outlined variant", () => {
        const tree = testRender(
            React.createElement(Card, { variant: "outlined" }, React.createElement(Text, null, "Body"))
        );
        const card = tree.root.findByType(View);
        const style = StyleSheet.flatten(card.props.style);

        expect(style.borderWidth).toBe(1);
        expect(style.borderColor).toBe(theme.colors.outlineVariant);
    });

    it("supports accent stripe and custom gap", () => {
        const tree = testRender(
            React.createElement(
                Card,
                { accent: "#10B981", gap: 14, size: "lg" },
                React.createElement(Text, null, "Line 1"),
                React.createElement(Text, null, "Line 2")
            )
        );
        const card = tree.root.findByType(View);
        const style = StyleSheet.flatten(card.props.style);

        expect(style.borderLeftWidth).toBe(4);
        expect(style.borderLeftColor).toBe("#10B981");
        expect(style.gap).toBe(14);
        expect(style.padding).toBe(20);
    });
});
