import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useUnistyles } from "react-native-unistyles";
import { TODO_HEIGHT } from "@/views/todos/todoHeight";

export type TodoSeparatorProps = {
    id: string;
    title: string;
    onPress?: (id: string) => void;
};

export const TodoSeparator = React.memo<TodoSeparatorProps>((props) => {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;
    const fontSize = isMobile ? 15 : 14;
    const horizontalPadding = isMobile ? 16 : 12;
    const displayText = props.title.startsWith("# ") ? props.title.slice(2) : props.title;

    const pressGesture = Gesture.Tap().onEnd(() => {
        props.onPress?.(props.id);
    });

    const content = (
        <View
            style={{
                flex: 1,
                flexDirection: "column",
                justifyContent: "center",
                paddingVertical: 8
            }}
        >
            <Text
                style={{
                    color: theme.colors.onSurfaceVariant,
                    fontSize,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8
                }}
                testID={`todo-separator-title-${props.id}`}
            >
                {displayText}
            </Text>
            <View
                style={{
                    height: 1,
                    backgroundColor: theme.colors.outline,
                    opacity: 0.3
                }}
                testID={`todo-separator-divider-${props.id}`}
            />
        </View>
    );

    const rowStyle = {
        height: TODO_HEIGHT,
        width: "100%" as const,
        flexDirection: "row" as const,
        paddingHorizontal: horizontalPadding,
        maxWidth: 1100,
        flexGrow: 1,
        flexBasis: 0
    };

    return (
        <View
            style={{
                height: TODO_HEIGHT,
                flexDirection: "row",
                justifyContent: "center",
                paddingHorizontal: 16
            }}
            testID={`todo-separator-${props.id}`}
        >
            {props.onPress ? (
                Platform.OS === "web" ? (
                    <GestureDetector gesture={pressGesture}>
                        <View
                            style={[rowStyle, { cursor: "pointer" as const }]}
                            testID={`todo-separator-press-${props.id}`}
                        >
                            {content}
                        </View>
                    </GestureDetector>
                ) : (
                    <Pressable
                        onPress={() => props.onPress?.(props.id)}
                        style={rowStyle}
                        testID={`todo-separator-press-${props.id}`}
                    >
                        {content}
                    </Pressable>
                )
            ) : (
                <View style={rowStyle}>{content}</View>
            )}
        </View>
    );
});
