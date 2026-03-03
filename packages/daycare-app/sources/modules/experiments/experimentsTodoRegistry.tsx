import { type ComponentRegistry, type ComponentRenderProps, useStateStore } from "@json-render/react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item as AppItem } from "@/components/Item";
import { ItemList as AppItemList } from "@/components/ItemList";

type ViewProps = {
    direction?: "row" | "column";
    gap?: number;
    padding?: number;
    flex?: number;
    alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
};

type ItemProps = {
    title?: string;
    subtitle?: string;
    padding?: number;
    backgroundColor?: string;
    borderColor?: string;
    onPress?: boolean;
};

type ItemListProps = {
    gap?: number;
    padding?: number;
    backgroundColor?: string;
    scroll?: boolean;
};

type TextProps = {
    text: string;
    color?: string;
    size?: "sm" | "md" | "lg";
    weight?: "regular" | "medium" | "bold";
    strike?: boolean;
    numberOfLines?: number;
};

type TextInputProps = {
    label?: string;
    placeholder?: string;
    value?: string;
    flex?: number;
};

type ButtonProps = {
    label: string;
    variant?: "primary" | "secondary" | "danger";
    size?: "sm" | "md";
};

function TodoView({ element, children }: ComponentRenderProps<ViewProps>) {
    const props = element.props as ViewProps;
    return (
        <View
            style={[
                styles.viewBase,
                {
                    flexDirection: props.direction ?? "column",
                    gap: props.gap ?? 0,
                    padding: props.padding ?? 0,
                    flex: props.flex ?? undefined,
                    alignItems: props.alignItems ?? undefined,
                    justifyContent: props.justifyContent ?? undefined,
                    backgroundColor: props.backgroundColor ?? undefined,
                    borderColor: props.borderColor ?? undefined,
                    borderWidth: props.borderWidth ?? 0,
                    borderRadius: props.borderRadius ?? 0
                }
            ]}
        >
            {children}
        </View>
    );
}

function TodoItem({ element, children }: ComponentRenderProps<ItemProps>) {
    const { theme } = useUnistyles();
    const props = element.props as ItemProps;
    const hasHeader = Boolean((props.title && props.title.length > 0) || (props.subtitle && props.subtitle.length > 0));

    const shellStyle = [
        styles.itemShell,
        {
            backgroundColor: props.backgroundColor ?? theme.colors.surfaceContainer,
            borderColor: props.borderColor ?? theme.colors.outlineVariant
        }
    ];

    if (hasHeader) {
        return (
            <View style={shellStyle}>
                <AppItem
                    title={props.title ?? ""}
                    subtitle={props.subtitle}
                    showChevron={false}
                    showDivider={false}
                    style={{ minHeight: 0, paddingVertical: props.padding ?? 12 }}
                    pressableStyle={styles.itemHeaderPressable}
                />
                {children ? <View style={styles.itemBody}>{children}</View> : null}
            </View>
        );
    }

    return <View style={[shellStyle, { padding: props.padding ?? 12 }]}>{children}</View>;
}

function TodoItemList({ element, children }: ComponentRenderProps<ItemListProps>) {
    const props = element.props as ItemListProps;
    if (!props.scroll) {
        return (
            <View
                style={{
                    width: "100%",
                    gap: props.gap ?? 8,
                    padding: props.padding ?? 0,
                    backgroundColor: props.backgroundColor ?? undefined
                }}
            >
                {children}
            </View>
        );
    }

    return (
        <AppItemList
            insetGrouped={false}
            style={[styles.itemList, { backgroundColor: props.backgroundColor ?? undefined }]}
            containerStyle={{
                paddingTop: props.padding ?? 0,
                paddingBottom: props.padding ?? 0,
                paddingHorizontal: props.padding ?? 0,
                gap: props.gap ?? 8
            }}
        >
            {children}
        </AppItemList>
    );
}

function TodoText({ element }: ComponentRenderProps<TextProps>) {
    const props = element.props as TextProps;
    return (
        <Text
            numberOfLines={typeof props.numberOfLines === "number" ? props.numberOfLines : undefined}
            style={[
                styles.textBase,
                {
                    color: props.color ?? "#0f172a",
                    fontSize: textSizeResolve(props.size),
                    fontWeight: textWeightResolve(props.weight),
                    textDecorationLine: props.strike ? "line-through" : "none"
                }
            ]}
        >
            {String(props.text ?? "")}
        </Text>
    );
}

function TodoTextInput({ element, bindings }: ComponentRenderProps<TextInputProps>) {
    const props = element.props as TextInputProps;
    const { set } = useStateStore();
    const valuePath = bindings?.value;
    const textValue = typeof props.value === "string" ? props.value : "";

    return (
        <View style={{ flex: props.flex ?? undefined, gap: 6 }}>
            {props.label ? <Text style={styles.inputLabel}>{props.label}</Text> : null}
            <TextInput
                style={styles.input}
                value={textValue}
                placeholder={props.placeholder}
                placeholderTextColor="#94a3b8"
                onChangeText={(next) => {
                    if (!valuePath) {
                        return;
                    }
                    set(valuePath, next);
                }}
            />
        </View>
    );
}

function TodoButton({ element, emit }: ComponentRenderProps<ButtonProps>) {
    const props = element.props as ButtonProps;
    const palette = buttonPaletteResolve(props.variant);
    return (
        <Pressable
            style={({ pressed }) => [
                styles.buttonBase,
                { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
                buttonSizeStyle(props.size),
                pressed ? { opacity: 0.8 } : null
            ]}
            onPress={() => emit("press")}
        >
            <Text style={[styles.buttonText, { color: palette.textColor }]}>{String(props.label ?? "")}</Text>
        </Pressable>
    );
}

function textSizeResolve(size?: TextProps["size"]): number {
    if (size === "sm") {
        return 13;
    }
    if (size === "lg") {
        return 18;
    }
    return 15;
}

function textWeightResolve(weight?: TextProps["weight"]): "400" | "500" | "700" {
    if (weight === "bold") {
        return "700";
    }
    if (weight === "medium") {
        return "500";
    }
    return "400";
}

function buttonPaletteResolve(variant?: ButtonProps["variant"]): {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
} {
    if (variant === "danger") {
        return { backgroundColor: "#ef4444", borderColor: "#dc2626", textColor: "#ffffff" };
    }
    if (variant === "secondary") {
        return { backgroundColor: "#ffffff", borderColor: "#94a3b8", textColor: "#0f172a" };
    }
    return { backgroundColor: "#2563eb", borderColor: "#1d4ed8", textColor: "#ffffff" };
}

function buttonSizeStyle(size?: ButtonProps["size"]): {
    paddingVertical: number;
    paddingHorizontal: number;
} {
    if (size === "sm") {
        return { paddingVertical: 8, paddingHorizontal: 12 };
    }
    return { paddingVertical: 10, paddingHorizontal: 14 };
}

export const experimentsTodoRegistry: ComponentRegistry = {
    View: TodoView,
    Item: TodoItem,
    ItemList: TodoItemList,
    Text: TodoText,
    TextInput: TodoTextInput,
    Button: TodoButton
};

const styles = StyleSheet.create({
    viewBase: {},
    itemList: {
        flex: 1
    },
    itemShell: {
        borderWidth: 1,
        borderRadius: 12,
        overflow: "hidden",
        width: "100%"
    },
    itemHeaderPressable: {
        backgroundColor: "transparent"
    },
    itemBody: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 8
    },
    textBase: {
        letterSpacing: 0.1
    },
    inputLabel: {
        color: "#475569",
        fontSize: 12,
        fontWeight: "500"
    },
    input: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: "#0f172a",
        backgroundColor: "#ffffff"
    },
    buttonBase: {
        borderWidth: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonText: {
        fontSize: 13,
        fontWeight: "600"
    }
});
