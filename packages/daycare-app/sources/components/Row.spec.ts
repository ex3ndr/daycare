import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { testRender } from "./_testRender";
import { Row } from "./Row";

describe("Row", () => {
    it("renders center content without leading/trailing", () => {
        const tree = testRender(React.createElement(Row, null, React.createElement(Text, null, "Body")));
        const views = tree.root.findAllByType(View);

        expect(views.length).toBeGreaterThanOrEqual(2);
    });

    it("applies gap override", () => {
        const tree = testRender(
            React.createElement(
                Row,
                {
                    gap: 20,
                    leading: React.createElement(Text, null, "L"),
                    trailing: React.createElement(Text, null, "R")
                },
                React.createElement(Text, null, "Center")
            )
        );
        const row = tree.root.findAllByType(View)[0];
        const style = StyleSheet.flatten(row.props.style);

        expect(style.gap).toBe(20);
    });

    it("supports pressable rows", () => {
        const onPress = vi.fn();
        const tree = testRender(React.createElement(Row, { onPress }, React.createElement(Text, null, "Tap me")));

        tree.root.findByProps({ onPress }).props.onPress();
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
