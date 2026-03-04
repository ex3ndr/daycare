import * as React from "react";
import { StyleSheet, View } from "react-native";
import { describe, expect, it } from "vitest";
import { testRender } from "./_testRender";
import { IconCircle } from "./IconCircle";

describe("IconCircle", () => {
    it("uses md preset size by default", () => {
        const tree = testRender(React.createElement(IconCircle, { icon: "star-outline", color: "#8B5CF6" }));
        const container = tree.root.findByType(View);
        const style = StyleSheet.flatten(container.props.style);

        expect(style.width).toBe(36);
        expect(style.height).toBe(36);
        expect(style.borderRadius).toBe(18);
        expect(style.backgroundColor).toBe("rgba(139, 92, 246, 0.15)");
    });

    it("supports numeric size", () => {
        const tree = testRender(React.createElement(IconCircle, { icon: "heart-outline", color: "#EF4444", size: 40 }));
        const container = tree.root.findByType(View);
        const style = StyleSheet.flatten(container.props.style);

        expect(style.width).toBe(40);
        expect(style.height).toBe(40);
        expect(style.borderRadius).toBe(20);
    });
});
