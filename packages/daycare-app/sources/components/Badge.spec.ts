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

import { Badge } from "./Badge";

describe("Badge", () => {
    it("renders filled variant with background tint", () => {
        const tree = testRender(React.createElement(Badge, { color: "#10B981" }, "Live"));
        const view = tree.root.findByType(View);
        const style = StyleSheet.flatten(view.props.style);

        expect(style.backgroundColor).toBe("rgba(16, 185, 129, 0.15)");
        expect(style.borderWidth).toBe(0);
    });

    it("renders outlined variant", () => {
        const tree = testRender(React.createElement(Badge, { color: "#EF4444", variant: "outlined" }, "High"));
        const view = tree.root.findByType(View);
        const style = StyleSheet.flatten(view.props.style);

        expect(style.backgroundColor).toBe("transparent");
        expect(style.borderWidth).toBe(1);
        expect(style.borderColor).toBe("#EF4444");
    });

    it("renders number children", () => {
        const tree = testRender(React.createElement(Badge, { color: "#6366F1" }, 12));
        const text = tree.root.findByType(Text);

        expect(text.props.children).toBe(12);
    });
});
