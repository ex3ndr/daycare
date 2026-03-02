import { Octicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as React from "react";
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useUnistyles } from "react-native-unistyles";
import type { TodoDueDate, TodoSubtask } from "./todoTypes";

export const TODO_HEIGHT = Platform.OS === "web" ? 48 : 56;

export type TodoViewProps = {
    id: string;
    done: boolean;
    favorite: boolean;
    magic?: boolean;
    magicProcessed?: boolean;
    value: string;
    notes?: string;
    due?: TodoDueDate | null;
    hint?: string;
    subtasks?: TodoSubtask[];
    onToggle?: (id: string, newValue: boolean) => void;
    onToggleFavorite?: (id: string, newValue: boolean) => void;
    onValueChange?: (id: string, newValue: string) => void;
    onPress?: (id: string) => void;
    editable?: boolean;
};

export const TodoView = React.memo<TodoViewProps>((props) => {
    const { theme } = useUnistyles();

    const formatDueDate = React.useCallback((dueDate: TodoDueDate): string => {
        const [year, month, day] = dueDate.date.split("-").map(Number);
        if (!year || !month || !day) {
            return dueDate.date;
        }

        const date = new Date(year, month - 1, day);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const compareDate = new Date(year, month - 1, day);
        compareDate.setHours(0, 0, 0, 0);

        const diffTime = compareDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays === -1) return "Yesterday";

        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }, []);

    const isMobile = theme.layout.isMobileLayout;
    const checkboxSize = 24;
    const checkboxTouchTarget = 24;
    const starButtonSize = isMobile ? 24 : 32;
    const fontSize = isMobile ? 17 : 18;
    const horizontalPadding = isMobile ? 16 : 12;
    const checkboxMargin = isMobile ? 8 : 12;
    const starIconSize = isMobile ? 24 : 20;
    const notesIconSize = 16;
    const borderRadius = isMobile ? 18 : 4;

    const [editingValue, setEditingValue] = React.useState(props.value);
    const [isEditing, setIsEditing] = React.useState(false);
    const inputRef = React.useRef<TextInput>(null);

    const [textWidth, setTextWidth] = React.useState<number>(0);
    const [containerWidth, setContainerWidth] = React.useState<number>(0);

    const starTranslate = useSharedValue(0);
    const indicatorsOpacity = useSharedValue(1);

    React.useEffect(() => {
        if (!isEditing) {
            setEditingValue(props.value);
        }
    }, [props.value, isEditing]);

    const handleSubmit = React.useCallback(() => {
        if (editingValue.trim() && editingValue !== props.value) {
            props.onValueChange?.(props.id, editingValue.trim());
        }

        setIsEditing(false);
    }, [editingValue, props]);

    const handleRevert = React.useCallback(() => {
        setEditingValue(props.value);
        setIsEditing(false);
        inputRef.current?.blur();
    }, [props.value]);

    const handleFocus = React.useCallback(() => {
        setIsEditing(true);

        if (isMobile) {
            starTranslate.value = withSpring(100, {
                damping: 30,
                stiffness: 400,
                mass: 0.5
            });
            indicatorsOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [indicatorsOpacity, isMobile, starTranslate]);

    const handleBlur = React.useCallback(() => {
        handleSubmit();

        if (isMobile) {
            starTranslate.value = withSpring(0, {
                damping: 30,
                stiffness: 400,
                mass: 0.5
            });
            indicatorsOpacity.value = withTiming(1, { duration: 200 });
        }
    }, [handleSubmit, indicatorsOpacity, isMobile, starTranslate]);

    const handleKeyPress = React.useCallback(
        (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
            const key = event.nativeEvent.key;
            if (key === "Escape") {
                handleRevert();
            } else if (key === "Enter") {
                handleSubmit();
            }
        },
        [handleRevert, handleSubmit]
    );

    const favoriteGesture = Gesture.Tap().onEnd(() => {
        props.onToggleFavorite?.(props.id, !props.favorite);
    });

    const checkboxGesture = Gesture.Tap().onEnd(() => {
        props.onToggle?.(props.id, !props.done);
    });

    const overlayGesture = Gesture.Tap().onEnd(() => {
        props.onPress?.(props.id);
    });

    const indicatorsAnimatedStyle = useAnimatedStyle(() => {
        if (!isMobile) {
            return {};
        }

        return {
            transform: [{ translateX: starTranslate.value }],
            opacity: indicatorsOpacity.value
        };
    });

    const textStyle = {
        paddingLeft: 4,
        paddingRight: isMobile ? 0 : 4,
        paddingTop: 0,
        paddingBottom: 0,
        alignSelf: "center" as const,
        color: props.done ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
        fontSize,
        height: 48,
        flexGrow: 1,
        textDecorationLine: props.done ? ("line-through" as const) : ("none" as const),
        opacity: props.done ? 0.6 : 1
    };

    const editable = props.editable ?? props.onValueChange !== undefined;

    const content = (
        <>
            {Platform.OS === "web" ? (
                <GestureDetector gesture={checkboxGesture}>
                    <Animated.View
                        hitSlop={isMobile ? 16 : 8}
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
                            {props.done && (
                                <Octicons name="check" size={isMobile ? 18 : 14} color={theme.colors.onPrimary} />
                            )}
                        </View>
                    </Animated.View>
                </GestureDetector>
            ) : (
                <Pressable
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
                        {props.done && (
                            <Octicons name="check" size={isMobile ? 18 : 14} color={theme.colors.onPrimary} />
                        )}
                    </View>
                </Pressable>
            )}

            <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
            >
                <TextInput
                    ref={inputRef}
                    value={editingValue}
                    onChangeText={setEditingValue}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyPress={handleKeyPress}
                    editable={editable}
                    style={textStyle}
                />

                <Text
                    style={[
                        textStyle,
                        {
                            position: "absolute",
                            opacity: 0,
                            left: -10000
                        }
                    ]}
                    onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
                >
                    {editingValue}
                </Text>

                {!isEditing && textWidth > 0 && containerWidth > 0 && props.onPress
                    ? (() => {
                          const rightPadding = isMobile ? 0 : 4;
                          const availableSpace = containerWidth - textWidth - 4 - 16 - rightPadding;
                          const minWidth = 48;
                          const overlayLeft =
                              availableSpace >= minWidth
                                  ? textWidth + 4 + 16
                                  : containerWidth - minWidth - rightPadding;

                          const headerColor = theme.colors.surfaceContainer;
                          let hex = headerColor.replace("#", "");
                          if (hex.length === 3) {
                              hex = hex
                                  .split("")
                                  .map((char) => char + char)
                                  .join("");
                          }

                          const red = Number.parseInt(hex.substring(0, 2), 16);
                          const green = Number.parseInt(hex.substring(2, 4), 16);
                          const blue = Number.parseInt(hex.substring(4, 6), 16);
                          const gradientLeft = overlayLeft - 16;

                          return (
                              <>
                                  <View
                                      style={{
                                          position: "absolute",
                                          left: gradientLeft,
                                          top: 0,
                                          bottom: 0,
                                          width: 16,
                                          pointerEvents: "none"
                                      }}
                                  >
                                      <LinearGradient
                                          colors={[
                                              `rgba(${red}, ${green}, ${blue}, 1)`,
                                              `rgba(${red}, ${green}, ${blue}, 0)`
                                          ]}
                                          start={{ x: 1, y: 0.5 }}
                                          end={{ x: 0, y: 0.5 }}
                                          style={{ width: 16, height: "100%" }}
                                      />
                                  </View>

                                  {Platform.OS === "web" ? (
                                      <GestureDetector gesture={overlayGesture}>
                                          <Animated.View
                                              style={{
                                                  position: "absolute",
                                                  left: overlayLeft,
                                                  top: 0,
                                                  bottom: 0,
                                                  right: rightPadding,
                                                  cursor: "pointer",
                                                  backgroundColor: theme.colors.surfaceContainer
                                              }}
                                          />
                                      </GestureDetector>
                                  ) : (
                                      <Pressable
                                          onPress={() => props.onPress?.(props.id)}
                                          style={{
                                              position: "absolute",
                                              left: overlayLeft,
                                              top: 0,
                                              bottom: 0,
                                              right: rightPadding,
                                              backgroundColor: theme.colors.surfaceContainer
                                          }}
                                      />
                                  )}
                              </>
                          );
                      })()
                    : null}
            </View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {props.subtasks && props.subtasks.length > 0 ? (
                    <View
                        style={{
                            marginRight: isMobile ? 4 : 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4
                        }}
                    >
                        <Octicons name="tasklist" size={16} color={theme.colors.primary} />
                        <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, fontWeight: "600" }}>
                            {props.subtasks.filter((subtask) => subtask.done).length}/{props.subtasks.length}
                        </Text>
                    </View>
                ) : null}
            </Animated.View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {props.notes?.trim().length ? (
                    <View
                        style={{
                            marginRight: 8,
                            width: 20,
                            height: 20,
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <Octicons name="note" size={notesIconSize} color={theme.colors.primary} />
                    </View>
                ) : null}
            </Animated.View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {props.due ? (
                    <View
                        style={{
                            marginRight: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: theme.colors.tertiaryContainer
                        }}
                    >
                        <Octicons name="calendar" size={12} color={theme.colors.onTertiaryContainer} />
                        <Text
                            style={{
                                fontSize: 11,
                                color: theme.colors.onTertiaryContainer,
                                fontWeight: "600",
                                fontFamily: "IBMPlexSans-SemiBold"
                            }}
                        >
                            {formatDueDate(props.due)}
                        </Text>
                    </View>
                ) : null}
            </Animated.View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {props.hint ? (
                    <View style={{ marginRight: 8, maxWidth: 120 }}>
                        <Text
                            style={{
                                fontSize: 12,
                                color: theme.colors.onSurfaceVariant,
                                fontFamily: "IBMPlexSans-Regular"
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {props.hint}
                        </Text>
                    </View>
                ) : null}
            </Animated.View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {props.magic && !props.magicProcessed ? (
                    <View
                        style={{
                            width: 24,
                            height: 24,
                            marginRight: 8,
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <Octicons name="zap" size={16} color={theme.colors.tertiary} />
                    </View>
                ) : null}
            </Animated.View>

            <Animated.View style={indicatorsAnimatedStyle}>
                {Platform.OS === "web" ? (
                    <GestureDetector gesture={favoriteGesture}>
                        <Animated.View
                            hitSlop={isMobile ? 16 : 8}
                            style={{
                                width: starButtonSize,
                                height: starButtonSize,
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer"
                            }}
                        >
                            <Octicons
                                name={props.favorite ? "star-fill" : "star"}
                                size={starIconSize}
                                color={props.favorite ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
                            />
                        </Animated.View>
                    </GestureDetector>
                ) : (
                    <Pressable
                        onPress={() => props.onToggleFavorite?.(props.id, !props.favorite)}
                        hitSlop={isMobile ? 16 : 8}
                        style={{
                            width: starButtonSize,
                            height: starButtonSize,
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <Octicons
                            name={props.favorite ? "star-fill" : "star"}
                            size={starIconSize}
                            color={props.favorite ? theme.colors.tertiary : theme.colors.onSurfaceVariant}
                        />
                    </Pressable>
                )}
            </Animated.View>
        </>
    );

    return (
        <View
            style={{
                height: TODO_HEIGHT,
                flexDirection: "row",
                justifyContent: "center",
                paddingHorizontal: 16
            }}
        >
            <View
                style={{
                    height: TODO_HEIGHT,
                    width: "100%",
                    borderRadius,
                    backgroundColor: theme.colors.surfaceContainer,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: horizontalPadding,
                    maxWidth: 1100,
                    flexGrow: 1,
                    flexBasis: 0,
                    overflow: "hidden"
                }}
            >
                {content}
            </View>
        </View>
    );
});
