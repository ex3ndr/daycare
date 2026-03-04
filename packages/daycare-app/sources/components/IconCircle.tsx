import { Ionicons } from "@expo/vector-icons";
import { View, type ViewStyle } from "react-native";
import { colorWithOpacity } from "@/components/colorWithOpacity";

type IconCircleSize = "sm" | "md" | "lg";

type IconCircleProps = {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    size?: number | IconCircleSize;
    style?: ViewStyle;
};

const SIZE_PRESETS: Record<IconCircleSize, number> = {
    sm: 28,
    md: 36,
    lg: 48
};

/**
 * Renders an icon inside a colored circular background.
 * Expects a valid Ionicons name and any supported color string.
 */
export function IconCircle({ icon, color, size = "md", style }: IconCircleProps) {
    const resolvedSize = typeof size === "number" ? size : SIZE_PRESETS[size];
    const iconSize = Math.max(12, Math.round(resolvedSize * 0.5));

    const containerStyle: ViewStyle = {
        width: resolvedSize,
        height: resolvedSize,
        borderRadius: resolvedSize / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colorWithOpacity(color, 0.15)
    };

    return (
        <View style={[containerStyle, style]}>
            <Ionicons name={icon} size={iconSize} color={color} />
        </View>
    );
}
