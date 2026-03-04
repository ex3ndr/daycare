import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { testRender } from "./_testRender";
import { Grid } from "./Grid";

describe("Grid", () => {
    it("renders children directly without wrapper Views", () => {
        const tree = testRender(
            React.createElement(Grid, null, React.createElement(Text, null, "A"), React.createElement(Text, null, "B"))
        );

        const container = tree.root.findByType(View);
        const containerStyle = StyleSheet.flatten(container.props.style);

        expect(containerStyle.flexDirection).toBe("row");
        expect(containerStyle.flexWrap).toBe("wrap");
        expect(containerStyle.gap).toBe(12);

        // Children are rendered (not lost)
        const texts = container.findAllByType(Text);
        expect(texts).toHaveLength(2);
    });

    it("applies custom gap", () => {
        const tree = testRender(React.createElement(Grid, { gap: 8 }, React.createElement(Text, null, "A")));

        const container = tree.root.findByType(View);
        const containerStyle = StyleSheet.flatten(container.props.style);
        expect(containerStyle.gap).toBe(8);
    });

    it("renders horizontal scroll container", () => {
        const tree = testRender(
            React.createElement(
                Grid,
                { horizontal: true, gap: 18 },
                React.createElement(Text, null, "A"),
                React.createElement(Text, null, "B")
            )
        );

        const scroll = tree.root.findByType(ScrollView);
        expect(scroll.props.horizontal).toBe(true);

        const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
        expect(contentStyle.gap).toBe(18);
        expect(contentStyle.flexWrap).toBeUndefined();
    });

    it("does not add flexWrap in horizontal mode", () => {
        const tree = testRender(React.createElement(Grid, { horizontal: true }, React.createElement(Text, null, "A")));

        const scroll = tree.root.findByType(ScrollView);
        const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
        expect(contentStyle.flexWrap).toBeUndefined();
    });
});
