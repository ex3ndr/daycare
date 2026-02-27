import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppHeader, type AppMode } from "@/components/AppHeader";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { TreePanelLayout } from "@/components/layout/TreePanelLayout";
import { AgentsView } from "@/views/AgentsView";
import { ChatView } from "@/views/ChatView";
import { SettingsView } from "@/views/SettingsView";

const leftItems: Record<AppMode, Array<{ id: string; title: string; subtitle: string }>> = {
    agents: [
        { id: "a1", title: "Scout", subtitle: "General helper" },
        { id: "a2", title: "Builder", subtitle: "Code specialist" },
        { id: "a3", title: "Operator", subtitle: "Runtime ops" }
    ],
    chat: [
        { id: "c1", title: "Team Channel", subtitle: "Most recent" },
        { id: "c2", title: "Direct Notes", subtitle: "Pinned" },
        { id: "c3", title: "Archive", subtitle: "Older chats" }
    ],
    settings: [
        { id: "s1", title: "Account", subtitle: "Identity" },
        { id: "s2", title: "Appearance", subtitle: "Theme and layout" },
        { id: "s3", title: "About", subtitle: "Version info" }
    ]
};

function RightPlaceholder() {
    const { theme } = useUnistyles();

    return (
        <View style={styles.centered}>
            <Text style={[styles.centerTitle, { color: theme.colors.onSurface }]}>Conversation Details</Text>
            <Text style={[styles.centerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Details and files for the conversation.
            </Text>
        </View>
    );
}

function PanelOne({
    mode,
    selectedChatId,
    onSelectChat
}: {
    mode: AppMode;
    selectedChatId: string | null;
    onSelectChat: (id: string) => void;
}) {
    return (
        <ItemListStatic>
            <ItemGroup>
                {leftItems[mode].map((item) => (
                    <Item
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        selected={mode === "chat" && selectedChatId === item.id}
                        onPress={mode === "chat" ? () => onSelectChat(item.id) : undefined}
                    />
                ))}
            </ItemGroup>
        </ItemListStatic>
    );
}

function PanelTwo({ mode, selectedChatId }: { mode: AppMode; selectedChatId: string | null }) {
    if (mode === "agents") {
        return <AgentsView />;
    }
    if (mode === "chat") {
        return selectedChatId ? <ChatView /> : <View />;
    }
    return <SettingsView />;
}

function PanelThree({ mode, selectedChatId }: { mode: AppMode; selectedChatId: string | null }) {
    if (mode === "chat" && selectedChatId) {
        return <RightPlaceholder />;
    }
    return undefined;
}

export default function DaycareHomeScreen() {
    const { theme } = useUnistyles();
    const [mode, setMode] = React.useState<AppMode>("chat");
    const [selectedChatId, setSelectedChatId] = React.useState<string | null>("c1");

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            <AppHeader selectedMode={mode} onModeChange={setMode} />
            <TreePanelLayout
                panel1={<PanelOne mode={mode} selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} />}
                panel2={<PanelTwo mode={mode} selectedChatId={selectedChatId} />}
                panel3={PanelThree({ mode, selectedChatId })}
                panel3Placeholder={<RightPlaceholder />}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8
    },
    centerTitle: {
        fontSize: 18,
        fontWeight: "600"
    },
    centerSubtitle: {
        fontSize: 14
    }
});
