import { create } from "zustand";
import { documentCreate } from "./documentCreate";
import { documentDelete } from "./documentDelete";
import { documentHistoryFetch } from "./documentHistoryFetch";
import { documentsFetch } from "./documentsFetch";
import type { DocumentItem, DocumentTreeNode, DocumentVersion } from "./documentsTypes";
import { documentTreeBuild } from "./documentTreeBuild";
import { documentUpdate } from "./documentUpdate";

export type DocumentsStore = {
    items: DocumentItem[];
    tree: DocumentTreeNode[];
    selectedId: string | null;
    expandedIds: Set<string>;
    loading: boolean;
    saving: boolean;
    error: string | null;
    draftBody: string | null;
    draftTitle: string | null;
    draftDescription: string | null;
    dragSourceId: string | null;
    dropTargetId: string | null;
    history: DocumentVersion[];
    historyLoading: boolean;

    fetch: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
    fetchHistory: (baseUrl: string, token: string, workspaceId: string | null, id: string) => Promise<void>;
    select: (id: string | null) => void;
    toggle: (id: string) => void;
    createDocument: (
        baseUrl: string,
        token: string,
        workspaceId: string | null,
        input: { id: string; slug: string; title: string; parentId: string }
    ) => Promise<void>;
    updateDocument: (
        baseUrl: string,
        token: string,
        workspaceId: string | null,
        id: string,
        input: { slug?: string; title?: string; description?: string; body?: string; parentId?: string | null }
    ) => Promise<void>;
    deleteDocument: (baseUrl: string, token: string, workspaceId: string | null, id: string) => Promise<void>;
    move: (
        baseUrl: string,
        token: string,
        workspaceId: string | null,
        id: string,
        newParentId: string | null
    ) => Promise<void>;
    setDraftBody: (body: string) => void;
    setDraftTitle: (title: string) => void;
    setDraftDescription: (description: string) => void;
    saveDraft: (baseUrl: string, token: string, workspaceId: string | null) => Promise<void>;
    setDragSource: (id: string | null) => void;
    setDropTarget: (id: string | null) => void;
};

/**
 * Creates a zustand store for document tree state.
 * Manages fetching, selection, expand/collapse, drafts, and CRUD operations.
 */
export function documentsStoreCreate() {
    return create<DocumentsStore>((set, get) => ({
        items: [],
        tree: [],
        selectedId: null,
        expandedIds: new Set<string>(),
        loading: false,
        saving: false,
        error: null,
        draftBody: null,
        draftTitle: null,
        draftDescription: null,
        dragSourceId: null,
        dropTargetId: null,
        history: [],
        historyLoading: false,

        fetch: async (baseUrl, token, workspaceId) => {
            set({ loading: true, error: null });
            try {
                const items = await documentsFetch(baseUrl, token, workspaceId);
                const tree = documentTreeBuild(items);
                set({ items, tree, loading: false });
            } catch (err) {
                set({ loading: false, error: err instanceof Error ? err.message : "Failed to fetch vault entries." });
            }
        },

        fetchHistory: async (baseUrl, token, workspaceId, id) => {
            set({ historyLoading: true });
            try {
                const history = await documentHistoryFetch(baseUrl, token, workspaceId, id);
                set({ history, historyLoading: false });
            } catch {
                set({ history: [], historyLoading: false });
            }
        },

        select: (id) => {
            const { items } = get();
            const doc = id ? items.find((d) => d.id === id) : null;
            set({
                selectedId: id,
                draftBody: doc?.body ?? null,
                draftTitle: doc?.title ?? null,
                draftDescription: doc?.description ?? null,
                history: [],
                historyLoading: false
            });
        },

        toggle: (id) => {
            const { expandedIds } = get();
            const next = new Set(expandedIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            set({ expandedIds: next });
        },

        createDocument: async (baseUrl, token, workspaceId, input) => {
            set({ saving: true, error: null });
            try {
                await documentCreate(baseUrl, token, workspaceId, input);
                await get().fetch(baseUrl, token, workspaceId);
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to create vault entry." });
            }
        },

        updateDocument: async (baseUrl, token, workspaceId, id, input) => {
            set({ saving: true, error: null });
            try {
                const updated = await documentUpdate(baseUrl, token, workspaceId, id, input);
                const { items } = get();
                const nextItems = items.map((d) => (d.id === id ? updated : d));
                const tree = documentTreeBuild(nextItems);
                set({ items: nextItems, tree, saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to update vault entry." });
            }
        },

        deleteDocument: async (baseUrl, token, workspaceId, id) => {
            set({ saving: true, error: null });
            try {
                await documentDelete(baseUrl, token, workspaceId, id);
                const { selectedId } = get();
                await get().fetch(baseUrl, token, workspaceId);
                if (selectedId === id) {
                    set({ selectedId: null, draftBody: null, draftTitle: null, draftDescription: null });
                }
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to delete vault entry." });
            }
        },

        move: async (baseUrl, token, workspaceId, id, newParentId) => {
            set({ saving: true, error: null });
            try {
                await documentUpdate(baseUrl, token, workspaceId, id, { parentId: newParentId });
                await get().fetch(baseUrl, token, workspaceId);
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to move vault entry." });
            }
        },

        setDraftBody: (body) => set({ draftBody: body }),
        setDraftTitle: (title) => set({ draftTitle: title }),
        setDraftDescription: (description) => set({ draftDescription: description }),

        saveDraft: async (baseUrl, token, workspaceId) => {
            const { selectedId, draftBody, draftTitle, draftDescription } = get();
            if (!selectedId) return;

            const input: Record<string, string> = {};
            if (draftBody !== null) input.body = draftBody;
            if (draftTitle !== null) input.title = draftTitle;
            if (draftDescription !== null) input.description = draftDescription;

            if (Object.keys(input).length === 0) return;

            await get().updateDocument(baseUrl, token, workspaceId, selectedId, input);
        },

        setDragSource: (id) => set({ dragSourceId: id }),
        setDropTarget: (id) => set({ dropTargetId: id })
    }));
}
