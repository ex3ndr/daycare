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
import { type Components, defineRegistry, useBoundProp, useStateStore } from "@json-render/react-native";
import type * as React from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    Switch as RNSwitch,
    TextInput as RNTextInput,
    Text,
    View
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import type { Theme } from "@/theme";
import { type WidgetsCatalog, widgetsCatalog } from "./widgets";

// -- Token resolvers --

type SpacingScale = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type SurfaceLevel = "lowest" | "low" | "default" | "high" | "highest";
type ElevationLevel = "none" | "low" | "medium" | "high";
type ColorRole = keyof Theme["colors"];

function spacingResolve(scale: SpacingScale | null | undefined): number {
    switch (scale) {
        case "xs":
            return 4;
        case "sm":
            return 8;
        case "md":
            return 16;
        case "lg":
            return 24;
        case "xl":
            return 32;
        default:
            return 0;
    }
}

function surfaceColorResolve(level: SurfaceLevel | null | undefined, theme: Theme): string {
    switch (level) {
        case "lowest":
            return theme.colors.surfaceContainerLowest;
        case "low":
            return theme.colors.surfaceContainerLow;
        case "high":
            return theme.colors.surfaceContainerHigh;
        case "highest":
            return theme.colors.surfaceContainerHighest;
        case "default":
            return theme.colors.surfaceContainer;
        default:
            return "transparent";
    }
}

function elevationResolve(level: ElevationLevel | null | undefined, theme: Theme): string {
    switch (level) {
        case "low":
            return theme.elevation.level1;
        case "medium":
            return theme.elevation.level2;
        case "high":
            return theme.elevation.level3;
        default:
            return theme.elevation.level0;
    }
}

function colorResolve(role: ColorRole | null | undefined, theme: Theme, fallback: string): string {
    if (!role) return fallback;
    return (theme.colors as Record<string, string>)[role] ?? fallback;
}

function flexAlignResolve(
    v: "start" | "center" | "end" | "stretch" | "baseline" | null | undefined
): "flex-start" | "center" | "flex-end" | "stretch" | "baseline" | undefined {
    switch (v) {
        case "start":
            return "flex-start";
        case "end":
            return "flex-end";
        case "center":
        case "stretch":
        case "baseline":
            return v;
        default:
            return undefined;
    }
}

function flexJustifyResolve(
    v: "start" | "center" | "end" | "between" | null | undefined
): "flex-start" | "center" | "flex-end" | "space-between" | undefined {
    switch (v) {
        case "start":
            return "flex-start";
        case "end":
            return "flex-end";
        case "between":
            return "space-between";
        case "center":
            return v;
        default:
            return undefined;
    }
}

function textSizeResolve(size: "xs" | "sm" | "md" | "lg" | "xl" | null | undefined): number {
    switch (size) {
        case "xs":
            return 11;
        case "sm":
            return 13;
        case "lg":
            return 18;
        case "xl":
            return 22;
        default:
            return 15;
    }
}

function textFontResolve(weight: "regular" | "medium" | "semibold" | null | undefined): string {
    switch (weight) {
        case "medium":
            return "IBMPlexSans-SemiBold";
        case "semibold":
            return "IBMPlexSans-SemiBold";
        default:
            return "IBMPlexSans-Regular";
    }
}

function headingFontSize(level: "h1" | "h2" | "h3" | null | undefined): number {
    switch (level) {
        case "h1":
            return 28;
        case "h3":
            return 18;
        default:
            return 22;
    }
}

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

// Renders an icon, falling back to Ionicons "help-circle-outline" if the name is missing from the glyph map.
function renderIcon(name: string, set: string | null | undefined, size: number, color: string) {
    const IconComponent = iconSets[set ?? "Ionicons"] ?? Ionicons;
    // biome-ignore lint/suspicious/noExplicitAny: glyph maps are untyped record lookups
    const glyphMap = (IconComponent as any).glyphMap as Record<string, number> | undefined;
    if (glyphMap && !(name in glyphMap)) {
        return <Ionicons name="help-circle-outline" size={size} color={color} />;
    }
    return <IconComponent name={name} size={size} color={color} />;
}

// -- Component implementations --

const components: Components<WidgetsCatalog> = {
    // -- Layout --

    Column: ({ props, children }) => {
        const { theme } = useUnistyles();
        return (
            <View
                style={{
                    flexDirection: "column",
                    gap: spacingResolve(props.gap),
                    padding: spacingResolve(props.padding),
                    alignItems: flexAlignResolve(props.alignItems),
                    justifyContent: flexJustifyResolve(props.justifyContent),
                    flex: props.flex ?? undefined,
                    backgroundColor: surfaceColorResolve(props.surface, theme)
                }}
            >
                {children}
            </View>
        );
    },

    Row: ({ props, children }) => (
        <View
            style={{
                flexDirection: "row",
                gap: spacingResolve(props.gap),
                padding: spacingResolve(props.padding),
                alignItems: flexAlignResolve(props.alignItems),
                justifyContent: flexJustifyResolve(props.justifyContent),
                flex: props.flex ?? undefined,
                flexWrap: props.wrap ? "wrap" : undefined
            }}
        >
            {children}
        </View>
    ),

    ScrollArea: ({ props, children }) => (
        <ItemList
            containerStyle={{ padding: spacingResolve(props.padding) }}
            style={props.surface ? { backgroundColor: "transparent" } : undefined}
        >
            {children}
        </ItemList>
    ),

    // -- Surfaces --

    Card: ({ props, children }) => {
        const { theme } = useUnistyles();
        const bg = props.color
            ? colorResolve(props.color as ColorRole, theme, theme.colors.surfaceContainer)
            : surfaceColorResolve(props.surface ?? "default", theme);
        return (
            <View
                style={{
                    backgroundColor: bg,
                    borderRadius: 16,
                    padding: spacingResolve(props.padding),
                    boxShadow: elevationResolve(props.elevation, theme),
                    overflow: "hidden"
                }}
            >
                {children}
            </View>
        );
    },

    Section: ({ props, children }) => {
        const { theme } = useUnistyles();
        return (
            <ItemGroup
                title={props.title ?? undefined}
                footer={props.subtitle ?? undefined}
                containerStyle={{
                    backgroundColor: surfaceColorResolve(props.surface ?? "low", theme),
                    ...(props.padding ? { padding: spacingResolve(props.padding) } : {})
                }}
            >
                {children}
            </ItemGroup>
        );
    },

    Divider: ({ props }) => {
        const { theme } = useUnistyles();
        const spacing = spacingResolve(props.spacing);
        return (
            <View
                style={{
                    height: Platform.select({ ios: 0.33, default: 1 }),
                    backgroundColor: theme.colors.outlineVariant,
                    marginVertical: spacing
                }}
            />
        );
    },

    Spacer: ({ props }) => <View style={{ height: spacingResolve(props.size), flex: props.flex ?? undefined }} />,

    // -- Typography --

    Text: ({ props }) => {
        const { theme } = useUnistyles();
        return (
            <Text
                numberOfLines={props.numberOfLines ?? undefined}
                style={{
                    fontFamily: textFontResolve(props.weight),
                    fontSize: textSizeResolve(props.size),
                    color: colorResolve(props.color as ColorRole, theme, theme.colors.onSurface),
                    textAlign: props.align ?? undefined,
                    textDecorationLine: props.strikethrough ? "line-through" : undefined,
                    letterSpacing: 0.1
                }}
            >
                {String(props.text ?? "")}
            </Text>
        );
    },

    Heading: ({ props }) => {
        const { theme } = useUnistyles();
        return (
            <Text
                style={{
                    fontFamily: "IBMPlexSans-SemiBold",
                    fontSize: headingFontSize(props.level),
                    color: colorResolve(props.color as ColorRole, theme, theme.colors.onSurface),
                    textAlign: props.align ?? undefined,
                    letterSpacing: -0.3
                }}
            >
                {String(props.text ?? "")}
            </Text>
        );
    },

    // -- Icons --

    Icon: ({ props }) => {
        const { theme } = useUnistyles();
        const color = colorResolve(props.color as ColorRole, theme, theme.colors.onSurface);
        return renderIcon(props.name, props.set, props.size ?? 24, color);
    },

    // -- Controls --

    Button: ({ props, emit }) => {
        const { theme } = useUnistyles();
        const variant = props.variant ?? "filled";
        const size = props.size ?? "md";

        const palette = buttonPaletteResolve(variant, theme);
        const sizing = buttonSizeResolve(size);

        return (
            <Pressable
                onPress={() => emit("press")}
                disabled={props.disabled ?? false}
                style={({ pressed }) => [
                    styles.buttonBase,
                    {
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                        borderWidth: variant === "outlined" ? 1 : 0,
                        paddingVertical: sizing.pv,
                        paddingHorizontal: sizing.ph,
                        opacity: props.disabled ? 0.5 : pressed ? 0.8 : 1
                    }
                ]}
            >
                {props.loading ? (
                    <ActivityIndicator size="small" color={palette.text} />
                ) : (
                    <Text style={[styles.buttonLabel, { color: palette.text, fontSize: sizing.font }]}>
                        {String(props.label ?? "")}
                    </Text>
                )}
            </Pressable>
        );
    },

    IconButton: ({ props, emit }) => {
        const { theme } = useUnistyles();
        const variant = props.variant ?? "standard";
        const size = props.size ?? "md";
        const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;
        const hitSize = size === "sm" ? 32 : size === "lg" ? 48 : 40;

        const palette = iconButtonPaletteResolve(variant, theme);

        return (
            <Pressable
                onPress={() => emit("press")}
                disabled={props.disabled ?? false}
                style={({ pressed }) => ({
                    width: hitSize,
                    height: hitSize,
                    borderRadius: hitSize / 2,
                    backgroundColor: palette.bg,
                    borderColor: palette.border,
                    borderWidth: variant === "outlined" ? 1 : 0,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: props.disabled ? 0.5 : pressed ? 0.8 : 1
                })}
            >
                {renderIcon(props.icon, props.set, iconSize, palette.icon)}
            </Pressable>
        );
    },

    TextInput: ({ props, bindings }) => {
        const { theme } = useUnistyles();
        const { set } = useStateStore();
        const [value, setValue] = useBoundProp<string>(props.value ?? undefined, bindings?.value);
        const textValue = typeof value === "string" ? value : "";

        return (
            <View style={{ flex: props.flex ?? undefined, gap: 6 }}>
                {props.label && (
                    <Text style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>{props.label}</Text>
                )}
                <RNTextInput
                    style={[
                        styles.inputField,
                        {
                            borderColor: theme.colors.outline,
                            color: theme.colors.onSurface,
                            backgroundColor: theme.colors.surface
                        }
                    ]}
                    value={textValue}
                    placeholder={props.placeholder ?? undefined}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    multiline={props.multiline ?? false}
                    numberOfLines={props.numberOfLines ?? undefined}
                    onChangeText={(next) => {
                        setValue(next);
                        if (bindings?.value) {
                            set(bindings.value, next);
                        }
                    }}
                />
            </View>
        );
    },

    Switch: ({ props, emit, bindings }) => {
        const { theme } = useUnistyles();
        const [checked, setChecked] = useBoundProp<boolean>(props.checked ?? undefined, bindings?.checked);
        const { set } = useStateStore();

        return (
            <View style={styles.switchRow}>
                {props.label && (
                    <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]}>{props.label}</Text>
                )}
                <RNSwitch
                    value={checked ?? false}
                    disabled={props.disabled ?? false}
                    trackColor={{ false: theme.colors.surfaceVariant, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                    onValueChange={(next) => {
                        setChecked(next);
                        if (bindings?.checked) {
                            set(bindings.checked, next);
                        }
                        emit("change");
                    }}
                />
            </View>
        );
    },

    Checkbox: ({ props, emit, bindings }) => {
        const { theme } = useUnistyles();
        const [checked, setChecked] = useBoundProp<boolean>(props.checked ?? undefined, bindings?.checked);
        const { set } = useStateStore();
        const isChecked = checked ?? false;

        return (
            <Pressable
                style={styles.checkboxRow}
                disabled={props.disabled ?? false}
                onPress={() => {
                    const next = !isChecked;
                    setChecked(next);
                    if (bindings?.checked) {
                        set(bindings.checked, next);
                    }
                    emit("change");
                }}
            >
                <View
                    style={[
                        styles.checkboxBox,
                        {
                            backgroundColor: isChecked ? theme.colors.primary : "transparent",
                            borderColor: isChecked ? theme.colors.primary : theme.colors.outline
                        }
                    ]}
                >
                    {isChecked && renderIcon("checkmark", "Ionicons", 14, theme.colors.onPrimary)}
                </View>
                {props.label && (
                    <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>{props.label}</Text>
                )}
            </Pressable>
        );
    },

    // -- Data Display --

    ProgressBar: ({ props }) => {
        const { theme } = useUnistyles();
        const value = Math.max(0, Math.min(1, props.value ?? 0));
        const h = props.height ?? 6;
        const fillColor = colorResolve(props.color as ColorRole, theme, theme.colors.primary);
        const trackColor = colorResolve(props.trackColor as ColorRole, theme, theme.colors.surfaceContainerHigh);
        return (
            <View style={{ height: h, borderRadius: h / 2, backgroundColor: trackColor, overflow: "hidden" }}>
                <View
                    style={{
                        height: "100%",
                        width: `${value * 100}%`,
                        borderRadius: h / 2,
                        backgroundColor: fillColor
                    }}
                />
            </View>
        );
    },

    Chip: ({ props }) => {
        const { theme } = useUnistyles();
        const palette = chipPaletteResolve(props.variant, theme);
        return (
            <View
                style={[
                    styles.chip,
                    {
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                        borderWidth: props.variant === "outlined" ? 1 : 0
                    }
                ]}
            >
                {props.icon && renderIcon(props.icon, props.iconSet, 14, palette.text)}
                <Text style={[styles.chipText, { color: palette.text }]}>{String(props.label ?? "")}</Text>
            </View>
        );
    },

    Metric: ({ props }) => {
        const { theme } = useUnistyles();
        const size = props.size ?? "md";
        const valueFontSize = size === "sm" ? 14 : size === "lg" ? 22 : 16;
        const labelFontSize = size === "sm" ? 11 : size === "lg" ? 13 : 12;
        const color = colorResolve(props.color as ColorRole, theme, theme.colors.onSurface);
        const align = props.align ?? "left";
        return (
            <View style={{ alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start" }}>
                <Text style={{ fontFamily: "IBMPlexSans-SemiBold", fontSize: valueFontSize, color }}>
                    {String(props.value ?? "")}
                </Text>
                <Text style={{ fontFamily: "IBMPlexSans-Regular", fontSize: labelFontSize, color, opacity: 0.7 }}>
                    {String(props.label ?? "")}
                </Text>
            </View>
        );
    },

    ListItem: ({ props, emit }) => (
        <Item
            title={String(props.title ?? "")}
            subtitle={props.subtitle ?? undefined}
            showChevron={props.showChevron ?? true}
            showDivider={props.showDivider ?? true}
            onPress={() => emit("press")}
        />
    ),

    Badge: ({ props }) => {
        const { theme } = useUnistyles();
        const palette = badgePaletteResolve(props.variant, theme);
        return (
            <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                <Text style={[styles.badgeText, { color: palette.text }]}>{String(props.label ?? "")}</Text>
            </View>
        );
    },

    Avatar: ({ props }) => {
        const { theme } = useUnistyles();
        const sz = props.size === "sm" ? 28 : props.size === "lg" ? 48 : 36;
        const fontSize = props.size === "sm" ? 11 : props.size === "lg" ? 18 : 14;

        return (
            <View
                style={{
                    width: sz,
                    height: sz,
                    borderRadius: sz / 2,
                    backgroundColor: theme.colors.primaryContainer,
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Text style={{ fontFamily: "IBMPlexSans-SemiBold", fontSize, color: theme.colors.onPrimaryContainer }}>
                    {String(props.initials ?? "")
                        .slice(0, 2)
                        .toUpperCase()}
                </Text>
            </View>
        );
    },

    Spinner: ({ props }) => {
        const { theme } = useUnistyles();
        return <ActivityIndicator size={props.size ?? "small"} color={theme.colors.primary} />;
    },

    // -- Feedback --

    Banner: ({ props }) => {
        const { theme } = useUnistyles();
        const palette = bannerPaletteResolve(props.variant, theme);
        return (
            <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Text style={[styles.bannerText, { color: palette.text }]}>{String(props.text ?? "")}</Text>
            </View>
        );
    },

    EmptyState: ({ props }) => {
        const { theme } = useUnistyles();
        return (
            <View style={styles.emptyState}>
                {props.icon && (
                    <View style={{ marginBottom: 12 }}>
                        {renderIcon(props.icon, props.iconSet, 48, theme.colors.onSurfaceVariant)}
                    </View>
                )}
                <Text style={[styles.emptyStateTitle, { color: theme.colors.onSurface }]}>
                    {String(props.title ?? "")}
                </Text>
                {props.subtitle && (
                    <Text style={[styles.emptyStateSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {props.subtitle}
                    </Text>
                )}
            </View>
        );
    }
};

// -- Palette helpers --

function buttonPaletteResolve(
    variant: "filled" | "tonal" | "outlined" | "text",
    theme: Theme
): { bg: string; border: string; text: string } {
    switch (variant) {
        case "tonal":
            return {
                bg: theme.colors.secondaryContainer,
                border: "transparent",
                text: theme.colors.onSecondaryContainer
            };
        case "outlined":
            return { bg: "transparent", border: theme.colors.outline, text: theme.colors.primary };
        case "text":
            return { bg: "transparent", border: "transparent", text: theme.colors.primary };
        default:
            return { bg: theme.colors.primary, border: "transparent", text: theme.colors.onPrimary };
    }
}

function buttonSizeResolve(size: "sm" | "md" | "lg"): { pv: number; ph: number; font: number } {
    switch (size) {
        case "sm":
            return { pv: 6, ph: 12, font: 13 };
        case "lg":
            return { pv: 14, ph: 24, font: 16 };
        default:
            return { pv: 10, ph: 16, font: 14 };
    }
}

function iconButtonPaletteResolve(
    variant: "filled" | "tonal" | "outlined" | "standard",
    theme: Theme
): { bg: string; border: string; icon: string } {
    switch (variant) {
        case "filled":
            return { bg: theme.colors.primary, border: "transparent", icon: theme.colors.onPrimary };
        case "tonal":
            return {
                bg: theme.colors.secondaryContainer,
                border: "transparent",
                icon: theme.colors.onSecondaryContainer
            };
        case "outlined":
            return { bg: "transparent", border: theme.colors.outline, icon: theme.colors.onSurfaceVariant };
        default:
            return { bg: "transparent", border: "transparent", icon: theme.colors.onSurfaceVariant };
    }
}

function chipPaletteResolve(
    variant: "filled" | "tonal" | "outlined" | null | undefined,
    theme: Theme
): { bg: string; border: string; text: string } {
    switch (variant) {
        case "filled":
            return { bg: theme.colors.primary, border: "transparent", text: theme.colors.onPrimary };
        case "outlined":
            return { bg: "transparent", border: theme.colors.outline, text: theme.colors.onSurface };
        default:
            return {
                bg: theme.colors.secondaryContainer,
                border: "transparent",
                text: theme.colors.onSecondaryContainer
            };
    }
}

function badgePaletteResolve(
    variant: "default" | "primary" | "secondary" | "error" | null | undefined,
    theme: Theme
): { bg: string; text: string } {
    switch (variant) {
        case "primary":
            return { bg: theme.colors.primaryContainer, text: theme.colors.onPrimaryContainer };
        case "secondary":
            return { bg: theme.colors.secondaryContainer, text: theme.colors.onSecondaryContainer };
        case "error":
            return { bg: theme.colors.errorContainer, text: theme.colors.onErrorContainer };
        default:
            return { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
    }
}

function bannerPaletteResolve(
    variant: "info" | "success" | "warning" | "error" | null | undefined,
    theme: Theme
): { bg: string; border: string; text: string } {
    switch (variant) {
        case "success":
            return {
                bg: theme.colors.tertiaryContainer,
                border: theme.colors.tertiary,
                text: theme.colors.onTertiaryContainer
            };
        case "warning":
            return {
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                text: theme.colors.onPrimaryContainer
            };
        case "error":
            return {
                bg: theme.colors.errorContainer,
                border: theme.colors.error,
                text: theme.colors.onErrorContainer
            };
        default:
            return {
                bg: theme.colors.secondaryContainer,
                border: theme.colors.secondary,
                text: theme.colors.onSecondaryContainer
            };
    }
}

// -- Registry export --

export const { registry: widgetsRegistry } = defineRegistry(widgetsCatalog, { components });

// -- Styles --

const styles = StyleSheet.create({
    buttonBase: {
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        letterSpacing: 0.1
    },
    inputLabel: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12
    },
    inputField: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
    },
    switchLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15,
        flex: 1
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center"
    },
    checkboxLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 15
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: "flex-start"
    },
    chipText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        letterSpacing: 0.1
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: "flex-start"
    },
    badgeText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 12,
        letterSpacing: 0.1
    },
    banner: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12
    },
    bannerText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        letterSpacing: 0.1
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
        paddingHorizontal: 24
    },
    emptyStateTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 18,
        letterSpacing: -0.2,
        textAlign: "center"
    },
    emptyStateSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        textAlign: "center",
        marginTop: 6,
        letterSpacing: 0.1
    }
});
