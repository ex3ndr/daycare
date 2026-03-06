import { Octicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type FilesBreadcrumbProps = {
    path: string;
    onNavigate: (segmentPath: string | null) => void;
};

/**
 * Horizontal breadcrumb bar for file path navigation.
 * Home icon navigates to roots list; each segment navigates to that directory.
 */
export const FilesBreadcrumb = React.memo<FilesBreadcrumbProps>(({ path, onNavigate }) => {
    const { theme } = useUnistyles();
    const segments = path.split("/").filter(Boolean);

    return (
        <View style={[styles.wrapper, { borderBottomColor: theme.colors.outlineVariant }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
                <Pressable onPress={() => onNavigate(null)} style={styles.segment}>
                    <Octicons name="home" size={14} color={theme.colors.primary} />
                </Pressable>
                {segments.map((segment, index) => {
                    const segmentPath = segments.slice(0, index + 1).join("/");
                    const isLast = index === segments.length - 1;
                    return (
                        <React.Fragment key={segmentPath}>
                            <Octicons
                                name="chevron-right"
                                size={12}
                                color={theme.colors.onSurfaceVariant}
                                style={styles.chevron}
                            />
                            <Pressable onPress={() => onNavigate(segmentPath)} style={styles.segment}>
                                <Text
                                    style={{
                                        color: isLast ? theme.colors.onSurface : theme.colors.primary,
                                        fontSize: 14,
                                        fontWeight: isLast ? "600" : "400"
                                    }}
                                    numberOfLines={1}
                                >
                                    {segment}
                                </Text>
                            </Pressable>
                        </React.Fragment>
                    );
                })}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    wrapper: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        maxWidth: theme.layout.maxWidth,
        width: "100%",
        alignSelf: "center"
    },
    container: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 2
    },
    segment: {
        paddingHorizontal: 4,
        paddingVertical: 2
    },
    chevron: {
        marginHorizontal: 2
    }
}));
