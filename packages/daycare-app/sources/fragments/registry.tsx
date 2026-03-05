import { type Components, defineRegistry, useBoundProp, useStateStore } from "@json-render/react-native";
import * as React from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    Switch as RNSwitch,
    View as RNView,
    Text,
    TextInput
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { ReorderingList } from "@/components/ReorderingList";
import { ReorderingList2 } from "@/components/ReorderingList2";
import type { Theme } from "@/theme";
import { TODO_HEIGHT } from "@/views/todos/todoHeight";
import { type FragmentsCatalog, fragmentsCatalog } from "./catalog";
import { renderIcon } from "./iconRender";
import { TodoItem } from "./TodoItem";
import type { TodoListEntry, TodoListItem } from "./TodoListTypes";
import { TodoSeparator } from "./TodoSeparator";
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

// -- Component implementations --

export const fragmentsComponents: Components<FragmentsCatalog> = {
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
            flexWrap: props.wrap ? ("wrap" as const) : undefined,
            position: props.position ?? undefined,
            top: props.top ?? undefined,
            right: props.right ?? undefined,
            bottom: props.bottom ?? undefined,
            left: props.left ?? undefined
        };
        if (props.pressable) {
            return (
                <Pressable
                    onPress={() => emit("press")}
                    style={(state) => {
                        const isPressed = state.pressed;
                        // hovered is a React Native Web extension, not in base RN types
                        const isHovered = (state as unknown as Record<string, unknown>).hovered === true;
                        return {
                            ...style,
                            backgroundColor: isPressed && pressed ? pressed : isHovered && hovered ? hovered : bg
                        };
                    }}
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

    Section: ({ props, children }) => {
        const { theme } = useUnistyles();
        const title = props.title ?? undefined;
        const subtitle = props.subtitle ?? undefined;
        return (
            <RNView style={{ alignItems: "center" }}>
                <RNView style={{ width: "100%" }}>
                    {title ? (
                        <RNView
                            style={{
                                paddingTop: Platform.select({ ios: 35, default: 16 }),
                                paddingBottom: Platform.select({ ios: 6, default: 8 }),
                                paddingHorizontal: Platform.select({ ios: 32, default: 24 })
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "IBMPlexSans-Regular",
                                    color: theme.colors.onSurfaceVariant,
                                    fontSize: Platform.select({ ios: 13, default: 14 }),
                                    lineHeight: Platform.select({ ios: 18, default: 20 }),
                                    textTransform: "uppercase",
                                    fontWeight: Platform.select({ ios: "normal", default: "500" })
                                }}
                            >
                                {title}
                            </Text>
                        </RNView>
                    ) : (
                        <RNView style={{ paddingTop: Platform.select({ ios: 20, default: 16 }) }} />
                    )}
                    <RNView
                        style={{
                            marginHorizontal: Platform.select({ ios: 16, default: 12 }),
                            gap: spacingResolve(props.gap),
                            ...(props.padding ? { padding: spacingResolve(props.padding) } : {})
                        }}
                    >
                        {children}
                    </RNView>
                    {subtitle ? (
                        <RNView
                            style={{
                                paddingTop: Platform.select({ ios: 6, default: 8 }),
                                paddingBottom: Platform.select({ ios: 8, default: 16 }),
                                paddingHorizontal: Platform.select({ ios: 32, default: 24 })
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "IBMPlexSans-Regular",
                                    color: theme.colors.onSurfaceVariant,
                                    fontSize: Platform.select({ ios: 13, default: 14 }),
                                    lineHeight: Platform.select({ ios: 18, default: 20 })
                                }}
                            >
                                {subtitle}
                            </Text>
                        </RNView>
                    ) : null}
                </RNView>
            </RNView>
        );
    },

    Divider: ({ props }) => {
        const { theme } = useUnistyles();
        const spacing = spacingResolve(props.spacing);
        return (
            <RNView
                style={{
                    height: StyleSheet.hairlineWidth,
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
                <TextInput
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

    TodoList: ({ props, bindings, emit }) => {
        const { set } = useStateStore();
        const [boundItems, setItems] = useBoundProp<unknown>(props.items, bindings?.items);
        const items = React.useMemo(() => todoListEntriesNormalize(boundItems), [boundItems]);
        const listGap =
            props.gap === null || props.gap === undefined ? (Platform.OS === "web" ? 4 : 8) : spacingResolve(props.gap);
        const itemHeight = props.itemHeight ?? TODO_HEIGHT;
        const ReorderComponent = Platform.OS === "web" ? ReorderingList : ReorderingList2;

        const applyItems = React.useCallback(
            (nextItems: TodoListEntry[]) => {
                setItems(nextItems);
                if (bindings?.items) {
                    set(bindings.items, nextItems);
                }
            },
            [bindings?.items, set, setItems]
        );

        const handleMove = React.useCallback(
            (id: string, toIndex: number) => {
                const fromIndex = items.findIndex((item) => item.id === id);
                if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
                    return;
                }

                const nextItems = [...items];
                const [moved] = nextItems.splice(fromIndex, 1);
                if (!moved) {
                    return;
                }
                nextItems.splice(toIndex, 0, moved);
                applyItems(nextItems);
                emit("move");
            },
            [applyItems, emit, items]
        );

        const handlePress = React.useCallback(
            (_id: string) => {
                emit("press");
            },
            [emit]
        );

        const handleToggle = React.useCallback(
            (id: string, nextValue: boolean) => {
                const nextItems = items.map((item) =>
                    item.id === id && item.type !== "separator" ? { ...item, done: nextValue } : item
                );
                applyItems(nextItems);
                emit("toggle");
            },
            [applyItems, emit, items]
        );

        const handleToggleIcon = React.useCallback(
            (id: string, nextValue: boolean) => {
                const nextItems = items.map((item) =>
                    item.id === id && item.type !== "separator"
                        ? {
                              ...item,
                              toggleIcon: {
                                  ...(item.toggleIcon ?? {}),
                                  active: nextValue
                              }
                          }
                        : item
                );
                applyItems(nextItems);
                emit("toggleIcon");
            },
            [applyItems, emit, items]
        );

        const handleTitleChange = React.useCallback(
            (id: string, nextTitle: string) => {
                const nextItems = items.map((item) =>
                    item.id === id && item.type !== "separator" ? { ...item, title: nextTitle } : item
                );
                applyItems(nextItems);
                emit("change");
            },
            [applyItems, emit, items]
        );

        const renderItem = React.useCallback(
            (item: TodoListEntry) => {
                if (item.type === "separator") {
                    return <TodoSeparator id={item.id} title={item.title} onPress={handlePress} />;
                }

                return (
                    <TodoItem
                        id={item.id}
                        title={item.title}
                        done={item.done ?? false}
                        icons={item.icons}
                        counter={item.counter}
                        toggleIcon={
                            props.toggleIcon
                                ? {
                                      ...props.toggleIcon,
                                      active: item.toggleIcon?.active ?? false
                                  }
                                : null
                        }
                        pill={item.pill}
                        hint={item.hint}
                        editable={props.editable ?? false}
                        showCheckbox={props.showCheckbox ?? true}
                        pillColor={props.pillColor}
                        pillTextColor={props.pillTextColor}
                        onPress={handlePress}
                        onToggle={handleToggle}
                        onToggleIcon={handleToggleIcon}
                        onValueChange={handleTitleChange}
                    />
                );
            },
            [
                handlePress,
                handleTitleChange,
                handleToggle,
                handleToggleIcon,
                props.editable,
                props.pillColor,
                props.pillTextColor,
                props.showCheckbox,
                props.toggleIcon
            ]
        );

        return (
            <RNView style={{ flexGrow: 1, flexBasis: 0 }}>
                <ReorderComponent
                    items={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    itemHeight={itemHeight}
                    gap={listGap}
                    onMove={handleMove}
                />
            </RNView>
        );
    },

    Item: ({ props, emit }) => (
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

function todoListEntriesNormalize(value: unknown): TodoListEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalized: TodoListEntry[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            continue;
        }

        const record = item as Record<string, unknown>;
        if (typeof record.id !== "string" || typeof record.title !== "string") {
            continue;
        }

        if (record.type === "separator") {
            normalized.push({ id: record.id, title: record.title, type: "separator" });
            continue;
        }

        normalized.push({
            id: record.id,
            title: record.title,
            type: "item",
            done: typeof record.done === "boolean" ? record.done : false,
            icons: Array.isArray(record.icons) ? (record.icons as TodoListItem["icons"]) : undefined,
            counter:
                record.counter && typeof record.counter === "object"
                    ? (record.counter as TodoListItem["counter"])
                    : undefined,
            toggleIcon:
                record.toggleIcon && typeof record.toggleIcon === "object"
                    ? (record.toggleIcon as TodoListItem["toggleIcon"])
                    : undefined,
            pill: typeof record.pill === "string" ? record.pill : undefined,
            hint: typeof record.hint === "string" ? record.hint : undefined
        });
    }

    return normalized;
}

// -- Registry export --

export const { registry: fragmentsRegistry } = defineRegistry(fragmentsCatalog, { components: fragmentsComponents });

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
