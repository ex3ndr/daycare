import { createId } from "@paralleldrive/cuid2";
import { useRouter } from "expo-router";
import * as React from "react";
import type { AppMode } from "@/components/AppHeader";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";
import { TreePanelLayout } from "@/components/layout/TreePanelLayout";
import { useAuthStore } from "@/modules/auth/authContext";
import { documentRootIdResolve } from "@/modules/documents/documentRootIdResolve";
import { useDocumentsStore } from "@/modules/documents/documentsContext";
import { AgentsView } from "@/views/AgentsView";
import { CostsView } from "@/views/CostsView";
import { DevView } from "@/views/DevView";
import { DocumentCreateDialog } from "@/views/documents/DocumentCreateDialog";
import { DocumentMetadataPanel } from "@/views/documents/DocumentMetadataPanel";
import { DocumentsView } from "@/views/documents/DocumentsView";
import { DocumentTreePanel } from "@/views/documents/DocumentTreePanel";
import { FragmentsView } from "@/views/FragmentsView";
import { HomeView } from "@/views/HomeView";
import { RoutinesView } from "@/views/RoutinesView";
import { SettingsView } from "@/views/SettingsView";
import { SkillsView } from "@/views/SkillsView";
import { TodosView } from "@/views/TodosView";
import { ToolsView } from "@/views/ToolsView";

const leftItems: Record<
    Exclude<AppMode, "documents" | "home" | "settings">,
    Array<{ id: string; title: string; subtitle: string }>
> = {
    agents: [
        { id: "a1", title: "Scout", subtitle: "General helper" },
        { id: "a2", title: "Builder", subtitle: "Code specialist" },
        { id: "a3", title: "Operator", subtitle: "Runtime ops" }
    ],
    todos: [
        { id: "t1", title: "Today", subtitle: "3 tasks" },
        { id: "t2", title: "This Week", subtitle: "2 tasks" },
        { id: "t3", title: "Completed", subtitle: "3 done" }
    ],
    fragments: [],
    routines: [
        { id: "r1", title: "Active", subtitle: "4 routines" },
        { id: "r2", title: "Disabled", subtitle: "2 routines" }
    ],
    costs: [
        { id: "co1", title: "This Month", subtitle: "$142.50" },
        { id: "co2", title: "Last Month", subtitle: "$161.80" }
    ],
    skills: [],
    tools: [],
    dev: [
        { id: "components", title: "Components", subtitle: "Component catalog" },
        { id: "examples", title: "Examples", subtitle: "Todo app demo" },
        { id: "lottie", title: "Lottie", subtitle: "Animations" },
        { id: "monty", title: "Monty", subtitle: "Runtime smoke checks" }
    ]
};

const viewComponents: Record<AppMode, React.ComponentType> = {
    home: HomeView,
    agents: AgentsView,
    fragments: FragmentsView,
    todos: TodosView,
    routines: RoutinesView,
    costs: CostsView,
    documents: DocumentsView,
    skills: SkillsView,
    tools: ToolsView,
    dev: DevView,
    settings: SettingsView
};

type ModeViewProps = {
    mode: AppMode;
    selectedItem?: string;
};

/**
 * Renders the TreePanelLayout for a given mode with the appropriate panels.
 * Handles both generic modes (with static panel1 items) and documents mode (with DocumentTreePanel).
 */
export function ModeView({ mode, selectedItem }: ModeViewProps) {
    const router = useRouter();
    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const documentItems = useDocumentsStore((s) => s.items);
    const selectedId = useDocumentsStore((s) => s.selectedId);
    const fetchDocuments = useDocumentsStore((s) => s.fetch);
    const createDocument = useDocumentsStore((s) => s.createDocument);
    const [createDialogVisible, setCreateDialogVisible] = React.useState(false);
    const [createParentId, setCreateParentId] = React.useState<string | null>(null);
    const documentRootId = React.useMemo(() => documentRootIdResolve(documentItems), [documentItems]);

    const isDocuments = mode === "documents";

    React.useEffect(() => {
        if (isDocuments && baseUrl && token) {
            void fetchDocuments(baseUrl, token);
        }
    }, [isDocuments, baseUrl, token, fetchDocuments]);

    const handleCreatePress = React.useCallback((parentId?: string | null) => {
        setCreateParentId(parentId ?? null);
        setCreateDialogVisible(true);
    }, []);

    const handleCreate = React.useCallback(
        (input: { title: string; slug: string; parentId: string | null }) => {
            if (!baseUrl || !token) return;
            const parentId = input.parentId ?? documentRootId;
            if (!parentId) return;
            void createDocument(baseUrl, token, { id: createId(), title: input.title, slug: input.slug, parentId });
        },
        [baseUrl, token, createDocument, documentRootId]
    );

    const handleItemPress = React.useCallback(
        (itemId: string) => {
            router.replace(`/${mode}/${itemId}` as `/${string}`);
        },
        [mode, router]
    );

    const ViewComponent = viewComponents[mode];

    const items = mode in leftItems ? leftItems[mode as keyof typeof leftItems] : [];

    const panel1 = isDocuments ? (
        <DocumentTreePanel onCreatePress={handleCreatePress} />
    ) : (
        <ItemListStatic>
            <ItemGroup>
                {items.map((item) => (
                    <Item
                        key={item.id}
                        title={item.title}
                        subtitle={item.subtitle}
                        showChevron={false}
                        onPress={() => handleItemPress(item.id)}
                        selected={selectedItem === item.id}
                    />
                ))}
            </ItemGroup>
        </ItemListStatic>
    );

    return (
        <>
            <TreePanelLayout
                panel1={panel1}
                panel2={<ViewComponent />}
                panel3={isDocuments && selectedId ? <DocumentMetadataPanel /> : undefined}
                panel3Placeholder={undefined}
                keepPanel1={isDocuments}
            />
            {isDocuments && (
                <DocumentCreateDialog
                    visible={createDialogVisible}
                    parentId={createParentId ?? documentRootId}
                    onClose={() => setCreateDialogVisible(false)}
                    onCreate={handleCreate}
                />
            )}
        </>
    );
}
