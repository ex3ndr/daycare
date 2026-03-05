import {
    AntDesign,
    Entypo,
    EvilIcons,
    Feather,
    FontAwesome,
    FontAwesome5,
    FontAwesome6,
    Fontisto,
    Foundation,
    Ionicons,
    MaterialCommunityIcons,
    MaterialIcons,
    Octicons,
    SimpleLineIcons,
    Zocial
} from "@expo/vector-icons";
import type * as React from "react";

// Icon set lookup — maps set name to the corresponding @expo/vector-icons component.
// biome-ignore lint/suspicious/noExplicitAny: icon components have heterogeneous glyph map types
const iconSets: Record<string, React.ComponentType<any>> = {
    AntDesign,
    Entypo,
    EvilIcons,
    Feather,
    FontAwesome,
    FontAwesome5,
    FontAwesome6,
    Fontisto,
    Foundation,
    Ionicons,
    MaterialCommunityIcons,
    MaterialIcons,
    Octicons,
    SimpleLineIcons,
    Zocial
};

/**
 * Renders an icon, falling back to Ionicons "help-circle-outline" when the glyph is missing.
 */
export function renderIcon(name: string, set: string | null | undefined, size: number, color: string) {
    const IconComponent = iconSets[set ?? "Ionicons"] ?? Ionicons;
    // biome-ignore lint/suspicious/noExplicitAny: glyph maps are untyped record lookups
    const glyphMap = (IconComponent as any).glyphMap as Record<string, number> | undefined;
    if (glyphMap && !(name in glyphMap)) {
        return <Ionicons name="help-circle-outline" size={size} color={color} />;
    }
    return <IconComponent name={name} size={size} color={color} />;
}
