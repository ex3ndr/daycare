import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import type { TodoTreeItem } from "@/modules/todos/todosFetch";

export type TodoCardViewProps = {
    item: TodoTreeItem;
    depth: number;
};

const DEPTH_INDENT = 24;

type StatusConfig = {
    icon: "circle" | "dot-fill" | "check-circle-fill" | "x-circle-fill" | "skip-fill";
    color: (theme: ReturnType<typeof useUnistyles>["theme"]) => string;
};

const STATUS_MAP: Record<TodoTreeItem["status"], StatusConfig> = {
    draft: {
        icon: "circle",
        color: (t) => t.colors.onSurfaceVariant
    },
    unstarted: {
        icon: "circle",
        color: (t) => t.colors.onSurfaceVariant
    },
    started: {
        icon: "dot-fill",
        color: (t) => t.colors.primary
    },
    finished: {
        icon: "check-circle-fill",
        color: (t) => t.colors.primary
    },
    abandoned: {
        icon: "skip-fill",
        color: (t) => t.colors.onSurfaceVariant
    }
};

/**
 * Renders a single todo as a compact card with status icon and title.
 * Indented by depth level for hierarchy visualization.
 */
export const TodoCardView = React.memo<TodoCardViewProps>(({ item, depth }) => {
    const { theme } = useUnistyles();
    const isMobile = theme.layout.isMobileLayout;

    const config = STATUS_MAP[item.status] ?? STATUS_MAP.unstarted;
    const iconColor = config.color(theme);
    const isCompleted = item.status === "finished" || item.status === "abandoned";

    const height = isMobile ? 52 : 44;
    const fontSize = isMobile ? 16 : 14;
    const iconSize = isMobile ? 18 : 16;
    const horizontalPadding = isMobile ? 14 : 12;
    const borderRadius = isMobile ? 14 : 8;

    return (
        <View
            style={{
                height,
                flexDirection: "row",
                justifyContent: "center",
                paddingHorizontal: 16,
                paddingLeft: 16 + depth * DEPTH_INDENT
            }}
        >
            <View
                style={{
                    height,
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
                <View
                    style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", marginRight: 10 }}
                >
                    <Octicons name={config.icon} size={iconSize} color={iconColor} />
                </View>
                <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                        flex: 1,
                        color: isCompleted ? theme.colors.onSurfaceVariant : theme.colors.onSurface,
                        fontSize,
                        fontFamily: "IBMPlexSans-Regular",
                        opacity: isCompleted ? 0.6 : 1,
                        textDecorationLine: item.status === "finished" ? "line-through" : "none"
                    }}
                >
                    {item.title}
                </Text>
            </View>
        </View>
    );
});
