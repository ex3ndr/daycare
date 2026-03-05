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
    View as RNView,
    Text
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import type { Theme } from "@/theme";
import { type FragmentsCatalog, fragmentsCatalog } from "./catalog";
import { colorResolve } from "./theme/colors";
import { flexAlignResolve, flexJustifyResolve } from "./theme/flex";
import { spacingResolve } from "./theme/size";
import { fontWeightResolve } from "./theme/typography";

// -- Token resolvers --

type SurfaceLevel = "lowest" | "low" | "default" | "high" | "highest";
type ElevationLevel = "none" | "low" | "medium" | "high";

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

const components: Components<FragmentsCatalog> = {
    // -- Layout --

    View: ({ props, children, emit }) => {
        const { theme } = useUnistyles();
        const bg = colorResolve(props.color, theme);
        const pressed = colorResolve(props.pressedColor, theme);
        const hovered = colorResolve(props.hoverColor, theme);
        const style = {
            flexDirection: props.direction ?? undefined,
            gap: spacingResolve(props.gap),
            padding: spacingResolve(props.padding),
            paddingHorizontal: spacingResolve(props.paddingHorizontal),
            paddingVertical: spacingResolve(props.paddingVertical),
            paddingTop: spacingResolve(props.paddingTop),
            paddingBottom: spacingResolve(props.paddingBottom),
            paddingLeft: spacingResolve(props.paddingLeft),
            paddingRight: spacingResolve(props.paddingRight),
            margin: spacingResolve(props.margin),
            marginHorizontal: spacingResolve(props.marginHorizontal),
            marginVertical: spacingResolve(props.marginVertical),
            marginTop: spacingResolve(props.marginTop),
            marginBottom: spacingResolve(props.marginBottom),
            marginLeft: spacingResolve(props.marginLeft),
            marginRight: spacingResolve(props.marginRight),
            alignItems: flexAlignResolve(props.alignItems),
            justifyContent: flexJustifyResolve(props.justifyContent),
            flexGrow: props.flexGrow ?? undefined,
            flexShrink: props.flexShrink ?? undefined,
            flexBasis: props.flexBasis ?? undefined,
            flexWrap: props.wrap ? ("wrap" as const) : undefined
        };
        if (props.pressable) {
            return (
                <Pressable
                    onPress={() => emit("press")}
                    style={({ pressed: isPressed, hovered: isHovered }) => ({
                        ...style,
                        backgroundColor: isPressed && pressed ? pressed : isHovered && hovered ? hovered : bg
                    })}
                >
                    {children}
                </Pressable>
            );
        }
        return <RNView style={{ ...style, backgroundColor: bg }}>{children}</RNView>;
    },

    ScrollView: ({ props, children }) => {
        const { theme } = useUnistyles();
        const bg = colorResolve(props.color, theme) ?? (props.surface ? "transparent" : undefined);
        return (
            <ItemList
                containerStyle={{
                    gap: spacingResolve(props.gap),
                    padding: spacingResolve(props.padding),
                    paddingHorizontal: spacingResolve(props.paddingHorizontal),
                    paddingVertical: spacingResolve(props.paddingVertical),
                    paddingTop: spacingResolve(props.paddingTop),
                    paddingBottom: spacingResolve(props.paddingBottom),
                    paddingLeft: spacingResolve(props.paddingLeft),
                    paddingRight: spacingResolve(props.paddingRight),
                    margin: spacingResolve(props.margin),
                    marginHorizontal: spacingResolve(props.marginHorizontal),
                    marginVertical: spacingResolve(props.marginVertical),
                    marginTop: spacingResolve(props.marginTop),
                    marginBottom: spacingResolve(props.marginBottom),
                    marginLeft: spacingResolve(props.marginLeft),
                    marginRight: spacingResolve(props.marginRight),
                    alignItems: flexAlignResolve(props.alignItems),
                    justifyContent: flexJustifyResolve(props.justifyContent),
                    flexGrow: props.flexGrow ?? undefined,
                    flexShrink: props.flexShrink ?? undefined,
                    flexBasis: props.flexBasis ?? undefined
                }}
                style={bg ? { backgroundColor: bg } : undefined}
            >
                {children}
            </ItemList>
        );
    },

    // -- Surfaces --

    Card: ({ props, children }) => {
        const { theme } = useUnistyles();
        const bg = props.color
            ? (colorResolve(props.color, theme) ?? theme.colors.surfaceContainer)
            : surfaceColorResolve(props.surface ?? "default", theme);
        return (
            <RNView
                style={{
                    backgroundColor: bg,
                    borderRadius: 16,
                    padding: spacingResolve(props.padding),
                    boxShadow: elevationResolve(props.elevation, theme),
                    overflow: "hidden"
                }}
            >
                {children}
            </RNView>
        );
    },

    ItemGroup: ({ props, children }) => {
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
            <RNView
                style={{
                    height: Platform.select({ ios: 0.33, default: 1 }),
                    backgroundColor: theme.colors.outlineVariant,
                    marginVertical: spacing
                }}
            />
        );
    },

    Spacer: ({ props }) => <RNView style={{ height: spacingResolve(props.size), flex: props.flex ?? undefined }} />,

    // -- Typography --

    Text: ({ props }) => {
        const { theme } = useUnistyles();
        const decorations: string[] = [];
        if (props.strikethrough) decorations.push("line-through");
        if (props.underline) decorations.push("underline");
        return (
            <Text
                numberOfLines={props.numberOfLines ?? undefined}
                style={{
                    fontFamily: fontWeightResolve(props.weight),
                    fontStyle: props.italic ? "italic" : undefined,
                    fontSize: textSizeResolve(props.size),
                    color: colorResolve(props.color, theme) ?? theme.colors.onSurface,
                    textAlign: props.align ?? undefined,
                    textDecorationLine:
                        decorations.length > 0
                            ? (decorations.join(" ") as "line-through" | "underline" | "underline line-through")
                            : undefined,
                    lineHeight: props.lineHeight ?? undefined,
                    letterSpacing: props.letterSpacing ?? 0.1,
                    opacity: props.opacity ?? undefined,
                    flexGrow: props.flexGrow ?? undefined,
                    flexShrink: props.flexShrink ?? undefined
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
                    color: colorResolve(props.color, theme) ?? theme.colors.onSurface,
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
        const color = colorResolve(props.color, theme) ?? theme.colors.onSurface;
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
            <RNView style={{ flex: props.flex ?? undefined, gap: 6 }}>
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
            </RNView>
        );
    },

    Switch: ({ props, emit, bindings }) => {
        const { theme } = useUnistyles();
        const [checked, setChecked] = useBoundProp<boolean>(props.checked ?? undefined, bindings?.checked);
        const { set } = useStateStore();

        return (
            <RNView style={styles.switchRow}>
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
            </RNView>
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
                <RNView
                    style={[
                        styles.checkboxBox,
                        {
                            backgroundColor: isChecked ? theme.colors.primary : "transparent",
                            borderColor: isChecked ? theme.colors.primary : theme.colors.outline
                        }
                    ]}
                >
                    {isChecked && renderIcon("checkmark", "Ionicons", 14, theme.colors.onPrimary)}
                </RNView>
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
        const fillColor = colorResolve(props.color, theme) ?? theme.colors.primary;
        const trackColor = colorResolve(props.trackColor, theme) ?? theme.colors.surfaceContainerHigh;
        return (
            <RNView style={{ height: h, borderRadius: h / 2, backgroundColor: trackColor, overflow: "hidden" }}>
                <RNView
                    style={{
                        height: "100%",
                        width: `${value * 100}%`,
                        borderRadius: h / 2,
                        backgroundColor: fillColor
                    }}
                />
            </RNView>
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

    Spinner: ({ props }) => {
        const { theme } = useUnistyles();
        return <ActivityIndicator size={props.size ?? "small"} color={theme.colors.primary} />;
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

// -- Registry export --

export const { registry: fragmentsRegistry } = defineRegistry(fragmentsCatalog, { components });

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
    }
});
