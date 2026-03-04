import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { testRender } from "./_testRender";
import { Grid } from "./Grid";

describe("Grid", () => {
    it("applies column-based item sizing", () => {
        const tree = testRender(
            React.createElement(
                Grid,
                { columns: 2 },
                React.createElement(Text, null, "A"),
                React.createElement(Text, null, "B")
            )
        );

        const views = tree.root.findAllByType(View);
        const itemStyle = StyleSheet.flatten(views[1].props.style);

        expect(itemStyle.flexBasis).toBe("50%");
        expect(itemStyle.maxWidth).toBe("50%");
    });

    it("supports fixed column width", () => {
        const tree = testRender(
            React.createElement(
                Grid,
                { columnWidth: 220 },
                React.createElement(Text, null, "A"),
                React.createElement(Text, null, "B")
            )
        );

        const views = tree.root.findAllByType(View);
        const itemStyle = StyleSheet.flatten(views[1].props.style);

        expect(itemStyle.width).toBe(220);
        expect(itemStyle.maxWidth).toBe(220);
    });

    it("renders horizontal scroll container", () => {
        const tree = testRender(
            React.createElement(
                Grid,
                { horizontal: true, columnWidth: 180, gap: 18 },
                React.createElement(Text, null, "A"),
                React.createElement(Text, null, "B")
            )
        );

        const scroll = tree.root.findByType(ScrollView);
        expect(scroll.props.horizontal).toBe(true);

        const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
        expect(contentStyle.gap).toBe(18);
    });
});
