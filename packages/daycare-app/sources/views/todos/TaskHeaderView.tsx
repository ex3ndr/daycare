import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { TODO_HEIGHT } from "./TodoView";

export type TaskHeaderViewProps = {
    id: string;
    value: string;
    onPress?: (id: string) => void;
};

export const TaskHeaderView = React.memo<TaskHeaderViewProps>((props) => {
    const { theme } = useUnistyles();

    const isMobile = theme.layout.isMobileLayout;
    const fontSize = isMobile ? 15 : 14;
    const horizontalPadding = isMobile ? 16 : 12;

    const displayText = props.value.startsWith("# ") ? props.value.slice(2) : props.value;

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
            >
                {displayText}
            </Text>
            <View
                style={{
                    height: 1,
                    backgroundColor: theme.colors.outline,
                    opacity: 0.3
                }}
            />
        </View>
    );

    const containerStyle = {
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
        >
            {props.onPress ? (
                <Pressable
                    onPress={() => props.onPress?.(props.id)}
                    style={[containerStyle, Platform.OS === "web" ? { cursor: "pointer" as const } : null]}
                >
                    {content}
                </Pressable>
            ) : (
                <View style={containerStyle}>{content}</View>
            )}
        </View>
    );
});
