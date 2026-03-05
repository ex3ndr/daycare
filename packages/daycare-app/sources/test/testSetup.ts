import * as React from "react";
import { vi } from "vitest";

type StyleValue = Record<string, unknown> | StyleValue[] | null | false | undefined;

// Vitest compiles TSX with a runtime that expects global React in this workspace.
(globalThis as { React?: typeof React }).React = React;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

function styleFlatten(style: StyleValue): Record<string, unknown> {
    if (!style) {
        return {};
    }
    if (Array.isArray(style)) {
        return style.reduce<Record<string, unknown>>((acc, item) => {
            Object.assign(acc, styleFlatten(item));
            return acc;
        }, {});
    }
    return style;
}

function primitive(name: string) {
    return React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
        return React.createElement(name, { ...props, ref }, props.children as React.ReactNode);
    });
}

const View = primitive("View");
const Text = primitive("Text");
const ScrollView = primitive("ScrollView");
const Pressable = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const style = typeof props.style === "function" ? props.style({ pressed: false }) : props.style;
    return React.createElement("Pressable", { ...props, ref, style }, props.children as React.ReactNode);
});

vi.mock("react-native", () => ({
    View,
    Text,
    ScrollView,
    Pressable,
    Platform: {
        OS: "web",
        select: <T>(value: { default?: T; web?: T; ios?: T; android?: T }): T | undefined => {
            return value.web ?? value.default;
        }
    },
    StyleSheet: {
        create: <T extends object>(value: T): T => value,
        flatten: (style: StyleValue): Record<string, unknown> => styleFlatten(style)
    }
}));

const Ionicons = Object.assign(primitive("Ionicons"), {
    glyphMap: {
        "arrow-up": 1,
        "heart-outline": 2,
        "list-outline": 3,
        "star-outline": 4,
        "trending-up-outline": 5,
        "checkmark-circle": 6,
        check: 7,
        star: 8,
        "star-fill": 9
    }
});

const iconSet = Ionicons;

vi.mock("@expo/vector-icons", () => ({
    Ionicons,
    AntDesign: iconSet,
    Entypo: iconSet,
    EvilIcons: iconSet,
    Feather: iconSet,
    FontAwesome: iconSet,
    FontAwesome5: iconSet,
    FontAwesome6: iconSet,
    Fontisto: iconSet,
    Foundation: iconSet,
    MaterialCommunityIcons: iconSet,
    MaterialIcons: iconSet,
    Octicons: iconSet,
    SimpleLineIcons: iconSet,
    Zocial: iconSet
}));

vi.mock("react-native-unistyles", () => ({
    useUnistyles: () => ({
        theme: {
            colors: {
                primary: "#3B82F6",
                surface: "#FFFFFF",
                surfaceContainer: "#F3F4F6",
                outlineVariant: "#D1D5DB",
                onSurface: "#111827"
            }
        }
    })
}));
