import * as React from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useUnistyles } from "react-native-unistyles";
import { TODO_HEIGHT } from "@/views/todos/todoHeight";
import { renderIcon } from "./iconRender";
import type { TodoListCounter, TodoListIcon, TodoListToggleIconConfig } from "./TodoListTypes";
import { colorResolve } from "./theme/colors";

type TodoItemToggleIcon = TodoListToggleIconConfig & {
    active?: boolean;
};

export type TodoItemProps = {
    id: string;
    title: string;
    done: boolean;
    icons?: TodoListIcon[];
    counter?: TodoListCounter;
    toggleIcon?: TodoItemToggleIcon | null;
    pill?: string;
    hint?: string;
    editable?: boolean;
    showCheckbox?: boolean;
    pillColor?: string | null;
    pillTextColor?: string | null;
    onToggle?: (id: string, next: boolean) => void;
    onToggleIcon?: (id: string, next: boolean) => void;
    onPress?: (id: string) => void;
    onValueChange?: (id: string, value: string) => void;
};

export const TodoItem = React.memo<TodoItemProps>((props) => {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;
    const checkboxSize = 24;
    const checkboxTouchTarget = 24;
    const iconSize = isMobile ? 18 : 16;
    const iconButtonSize = isMobile ? 28 : 24;
    const fontSize = isMobile ? 17 : 18;
    const horizontalPadding = isMobile ? 16 : 12;
    const checkboxMargin = isMobile ? 8 : 12;
    const editable = props.editable ?? false;
    const showCheckbox = props.showCheckbox ?? true;
    const [draftTitle, setDraftTitle] = React.useState(props.title);

    React.useEffect(() => {
        setDraftTitle(props.title);
    }, [props.title]);

    const commitTitle = React.useCallback(() => {
        const nextValue = draftTitle.trim();
        if (!nextValue) {
            setDraftTitle(props.title);
            return;
        }

        if (nextValue !== props.title) {
            props.onValueChange?.(props.id, nextValue);
        }
    }, [draftTitle, props]);

    const toggleGesture = Gesture.Tap().onEnd(() => {
        props.onToggle?.(props.id, !props.done);
    });

    const pressGesture = Gesture.Tap().onEnd(() => {
        props.onPress?.(props.id);
    });

    const toggleIconActive = props.toggleIcon?.active ?? false;
    const toggleIconGesture = Gesture.Tap().onEnd(() => {
        props.onToggleIcon?.(props.id, !toggleIconActive);
    });

    const pillBackgroundColor = colorResolve(props.pillColor ?? undefined, theme) ?? theme.colors.secondaryContainer;
    const pillTextColor = colorResolve(props.pillTextColor ?? undefined, theme) ?? theme.colors.onSecondaryContainer;
    const textColor = props.done ? theme.colors.onSurfaceVariant : theme.colors.onSurface;

    return (
        <View
            style={{
                height: TODO_HEIGHT,
                flexDirection: "row",
                justifyContent: "center",
                paddingHorizontal: 16
            }}
            testID={`todo-item-${props.id}`}
        >
            <View
                style={{
                    height: TODO_HEIGHT,
                    width: "100%",
                    maxWidth: 1100,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: horizontalPadding,
                    flexGrow: 1,
                    flexBasis: 0
                }}
            >
                {showCheckbox &&
                    (Platform.OS === "web" ? (
                        <GestureDetector gesture={toggleGesture}>
                            <View
                                testID={`todo-item-checkbox-${props.id}`}
                                style={{
                                    width: checkboxTouchTarget,
                                    height: checkboxTouchTarget,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: checkboxMargin,
                                    cursor: "pointer"
                                }}
                            >
                                <View
                                    style={{
                                        width: checkboxSize,
                                        height: checkboxSize,
                                        borderRadius: checkboxSize / 2,
                                        borderWidth: 2,
                                        borderColor: props.done ? theme.colors.primary : theme.colors.onSurfaceVariant,
                                        backgroundColor: props.done ? theme.colors.primary : "transparent",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    {props.done
                                        ? renderIcon("check", "Octicons", isMobile ? 18 : 14, theme.colors.onPrimary)
                                        : null}
                                </View>
                            </View>
                        </GestureDetector>
                    ) : (
                        <Pressable
                            testID={`todo-item-checkbox-${props.id}`}
                            onPress={() => props.onToggle?.(props.id, !props.done)}
                            hitSlop={isMobile ? 16 : 8}
                            style={{
                                width: checkboxTouchTarget,
                                height: checkboxTouchTarget,
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: checkboxMargin
                            }}
                        >
                            <View
                                style={{
                                    width: checkboxSize,
                                    height: checkboxSize,
                                    borderRadius: checkboxSize / 2,
                                    borderWidth: 2,
                                    borderColor: props.done ? theme.colors.primary : theme.colors.onSurfaceVariant,
                                    backgroundColor: props.done ? theme.colors.primary : "transparent",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                            >
                                {props.done
                                    ? renderIcon("check", "Octicons", isMobile ? 18 : 14, theme.colors.onPrimary)
                                    : null}
                            </View>
                        </Pressable>
                    ))}

                {Platform.OS === "web" && props.onPress ? (
                    <GestureDetector gesture={pressGesture}>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                cursor: "pointer"
                            }}
                            testID={`todo-item-press-${props.id}`}
                        >
                            {editable ? (
                                <TextInput
                                    testID={`todo-item-title-input-${props.id}`}
                                    value={draftTitle}
                                    onChangeText={setDraftTitle}
                                    onBlur={commitTitle}
                                    onSubmitEditing={commitTitle}
                                    style={{
                                        flex: 1,
                                        height: 48,
                                        color: textColor,
                                        fontSize,
                                        textDecorationLine: props.done ? "line-through" : "none",
                                        opacity: props.done ? 0.6 : 1
                                    }}
                                />
                            ) : (
                                <Text
                                    testID={`todo-item-title-${props.id}`}
                                    numberOfLines={1}
                                    style={{
                                        flex: 1,
                                        color: textColor,
                                        fontSize,
                                        textDecorationLine: props.done ? "line-through" : "none",
                                        opacity: props.done ? 0.6 : 1
                                    }}
                                >
                                    {props.title}
                                </Text>
                            )}
                        </View>
                    </GestureDetector>
                ) : (
                    <Pressable
                        disabled={!props.onPress}
                        onPress={() => props.onPress?.(props.id)}
                        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                        testID={`todo-item-press-${props.id}`}
                    >
                        {editable ? (
                            <TextInput
                                testID={`todo-item-title-input-${props.id}`}
                                value={draftTitle}
                                onChangeText={setDraftTitle}
                                onBlur={commitTitle}
                                onSubmitEditing={commitTitle}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    color: textColor,
                                    fontSize,
                                    textDecorationLine: props.done ? "line-through" : "none",
                                    opacity: props.done ? 0.6 : 1
                                }}
                            />
                        ) : (
                            <Text
                                testID={`todo-item-title-${props.id}`}
                                numberOfLines={1}
                                style={{
                                    flex: 1,
                                    color: textColor,
                                    fontSize,
                                    textDecorationLine: props.done ? "line-through" : "none",
                                    opacity: props.done ? 0.6 : 1
                                }}
                            >
                                {props.title}
                            </Text>
                        )}
                    </Pressable>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {props.icons?.map((icon, index) => (
                        <View
                            key={`${icon.set ?? "Ionicons"}:${icon.name}:${index}`}
                            testID={`todo-item-icon-${props.id}`}
                        >
                            {renderIcon(
                                icon.name,
                                icon.set,
                                iconSize,
                                colorResolve(icon.color ?? undefined, theme) ?? theme.colors.onSurfaceVariant
                            )}
                        </View>
                    ))}

                    {props.counter ? (
                        <View
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                backgroundColor: theme.colors.surfaceContainerHigh
                            }}
                            testID={`todo-item-counter-${props.id}`}
                        >
                            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: "600" }}>
                                {props.counter.current}/{props.counter.total}
                            </Text>
                        </View>
                    ) : null}

                    {props.pill ? (
                        <View
                            style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 999,
                                maxWidth: 120,
                                backgroundColor: pillBackgroundColor
                            }}
                            testID={`todo-item-pill-${props.id}`}
                        >
                            <Text numberOfLines={1} style={{ color: pillTextColor, fontSize: 12, fontWeight: "600" }}>
                                {props.pill}
                            </Text>
                        </View>
                    ) : null}

                    {props.hint ? (
                        <Text
                            numberOfLines={1}
                            style={{
                                maxWidth: isMobile ? 96 : 140,
                                color: theme.colors.onSurfaceVariant,
                                fontSize: 12
                            }}
                            testID={`todo-item-hint-${props.id}`}
                        >
                            {props.hint}
                        </Text>
                    ) : null}

                    {props.toggleIcon ? (
                        Platform.OS === "web" ? (
                            <GestureDetector gesture={toggleIconGesture}>
                                <View
                                    style={{
                                        width: iconButtonSize,
                                        height: iconButtonSize,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer"
                                    }}
                                    testID={`todo-item-toggle-icon-${props.id}`}
                                >
                                    {renderIcon(
                                        toggleIconActive ? props.toggleIcon.activeIcon : props.toggleIcon.icon,
                                        props.toggleIcon.set ?? undefined,
                                        iconSize,
                                        colorResolve(
                                            toggleIconActive
                                                ? (props.toggleIcon.activeColor ?? undefined)
                                                : (props.toggleIcon.color ?? undefined),
                                            theme
                                        ) ?? (toggleIconActive ? theme.colors.tertiary : theme.colors.onSurfaceVariant)
                                    )}
                                </View>
                            </GestureDetector>
                        ) : (
                            <Pressable
                                onPress={() => props.onToggleIcon?.(props.id, !toggleIconActive)}
                                style={{
                                    width: iconButtonSize,
                                    height: iconButtonSize,
                                    alignItems: "center",
                                    justifyContent: "center"
                                }}
                                testID={`todo-item-toggle-icon-${props.id}`}
                            >
                                {renderIcon(
                                    toggleIconActive ? props.toggleIcon.activeIcon : props.toggleIcon.icon,
                                    props.toggleIcon.set ?? undefined,
                                    iconSize,
                                    colorResolve(
                                        toggleIconActive
                                            ? (props.toggleIcon.activeColor ?? undefined)
                                            : (props.toggleIcon.color ?? undefined),
                                        theme
                                    ) ?? (toggleIconActive ? theme.colors.tertiary : theme.colors.onSurfaceVariant)
                                )}
                            </Pressable>
                        )
                    ) : null}
                </View>
            </View>
        </View>
    );
});
