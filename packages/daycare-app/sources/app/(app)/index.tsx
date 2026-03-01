import { createId } from "@paralleldrive/cuid2";
import * as React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { AppHeader, type AppMode } from "@/components/AppHeader";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { TreePanelLayout } from "@/components/layout/TreePanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { AgentsView } from "@/views/AgentsView";
import { CoachingView } from "@/views/CoachingView";
import { CostsView } from "@/views/CostsView";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";
import { DocumentMetadataPanel } from "@/views/documents/DocumentMetadataPanel";
import { DocumentsView } from "@/views/documents/DocumentsView";
import { DocumentTreePanel } from "@/views/documents/DocumentTreePanel";
import { EmailView } from "@/views/EmailView";
import { InboxView } from "@/views/InboxView";
import { InventoryView } from "@/views/InventoryView";
import { PeopleView } from "@/views/PeopleView";
import { RoutinesView } from "@/views/RoutinesView";
import { TodosView } from "@/views/TodosView";
import { WorkflowsView } from "@/views/WorkflowsView";

const leftItems: Record<Exclude<AppMode, "documents">, Array<{ id: string; title: string; subtitle: string }>> = {
    agents: [
        { id: "a1", title: "Scout", subtitle: "General helper" },
        { id: "a2", title: "Builder", subtitle: "Code specialist" },
        { id: "a3", title: "Operator", subtitle: "Runtime ops" }
    ],
    people: [
        { id: "p1", title: "Team", subtitle: "4 members" },
        { id: "p2", title: "External", subtitle: "3 contacts" }
    ],
    email: [
        { id: "e1", title: "Inbox", subtitle: "3 unread" },
        { id: "e2", title: "Sent", subtitle: "12 messages" },
        { id: "e3", title: "Archive", subtitle: "Older mail" }
    ],
    inbox: [
        { id: "i1", title: "Action Required", subtitle: "3 items" },
        { id: "i2", title: "Notifications", subtitle: "4 items" }
    ],
    todos: [
        { id: "t1", title: "Today", subtitle: "3 tasks" },
        { id: "t2", title: "This Week", subtitle: "2 tasks" },
        { id: "t3", title: "Completed", subtitle: "3 done" }
    ],
    routines: [
        { id: "r1", title: "Active", subtitle: "4 routines" },
        { id: "r2", title: "Disabled", subtitle: "2 routines" }
    ],
    inventory: [
        { id: "inv1", title: "API Keys", subtitle: "3 keys" },
        { id: "inv2", title: "Compute", subtitle: "3 resources" },
        { id: "inv3", title: "Storage", subtitle: "3 stores" },
        { id: "inv4", title: "Integrations", subtitle: "4 connected" }
    ],
    workflows: [
        { id: "wf1", title: "Recent", subtitle: "3 workflows" },
        { id: "wf2", title: "Completed", subtitle: "2 workflows" }
    ],
    coaching: [
        { id: "ch1", title: "Training", subtitle: "4 active" },
        { id: "ch2", title: "Feedback", subtitle: "3 recent" },
        { id: "ch3", title: "Completed", subtitle: "3 lessons" }
    ],
    costs: [
        { id: "co1", title: "This Month", subtitle: "$142.50" },
        { id: "co2", title: "Last Month", subtitle: "$161.80" }
    ]
};

function PanelOne({ mode }: { mode: AppMode }) {
    if (mode === "documents") {
        return null;
    }
    return (
        <ItemListStatic>
            <ItemGroup>
                {leftItems[mode].map((item) => (
                    <Item key={item.id} title={item.title} subtitle={item.subtitle} showChevron={false} />
                ))}
            </ItemGroup>
        </ItemListStatic>
    );
}

function PanelTwo({ mode }: { mode: AppMode }) {
    switch (mode) {
        case "agents":
            return <AgentsView />;
        case "people":
            return <PeopleView />;
        case "email":
            return <EmailView />;
        case "inbox":
            return <InboxView />;
        case "todos":
            return <TodosView />;
        case "routines":
            return <RoutinesView />;
        case "inventory":
            return <InventoryView />;
        case "workflows":
            return <WorkflowsView />;
        case "coaching":
            return <CoachingView />;
        case "costs":
            return <CostsView />;
        case "documents":
            return <DocumentsView />;
    }
}

export default function DaycareHomeScreen() {
    const { theme } = useUnistyles();
    const [mode, setMode] = React.useState<AppMode>("agents");
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const fetchDocuments = useDocumentsStore((s) => s.fetch);
    const createDocument = useDocumentsStore((s) => s.createDocument);

    // Fetch documents when switching to documents mode
    React.useEffect(() => {
        if (mode === "documents" && baseUrl && token) {
            void fetchDocuments(baseUrl, token);
        }
    }, [mode, baseUrl, token, fetchDocuments]);

    const handleCreatePress = React.useCallback((parentId?: string | null) => {
        setCreateParentId(parentId ?? null);
        setCreateDialogVisible(true);
    }, []);

    const handleCreate = React.useCallback(
        (input: { title: string; slug: string; parentId: string | null }) => {
            if (!baseUrl || !token) return;
            void createDocument(baseUrl, token, { id: createId(), ...input });
        },
        [baseUrl, token, createDocument]
    );

    const isDocuments = mode === "documents";

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}>
            <AppHeader selectedMode={mode} onModeChange={setMode} />
            <TreePanelLayout
                panel1={
                    isDocuments ? <DocumentTreePanel onCreatePress={handleCreatePress} /> : <PanelOne mode={mode} />
                }
                panel2={<PanelTwo mode={mode} />}
                panel3={isDocuments && selectedId ? <DocumentMetadataPanel /> : undefined}
                panel3Placeholder={undefined}
            />
            {isDocuments && (
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={createParentId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreate}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexGrow: 1,
        flexBasis: 0,
        flexDirection: "column"
    }
});
