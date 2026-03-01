import { create } from "zustand";
import { documentCreate } from "./documentCreate";
import { documentDelete } from "./documentDelete";
import { documentsFetch } from "./documentsFetch";
import type { DocumentItem, DocumentTreeNode } from "./documentsTypes";
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

    fetch: (baseUrl: string, token: string) => Promise<void>;
    select: (id: string | null) => void;
    toggle: (id: string) => void;
    createDocument: (
        baseUrl: string,
        token: string,
        input: { id: string; slug: string; title: string; parentId?: string | null }
    ) => Promise<void>;
    updateDocument: (
        baseUrl: string,
        token: string,
        id: string,
        input: { slug?: string; title?: string; description?: string; body?: string; parentId?: string | null }
    ) => Promise<void>;
    deleteDocument: (baseUrl: string, token: string, id: string) => Promise<void>;
    move: (baseUrl: string, token: string, id: string, newParentId: string | null) => Promise<void>;
    setDraftBody: (body: string) => void;
    setDraftTitle: (title: string) => void;
    setDraftDescription: (description: string) => void;
    saveDraft: (baseUrl: string, token: string) => Promise<void>;
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

        fetch: async (baseUrl, token) => {
            set({ loading: true, error: null });
            try {
                const items = await documentsFetch(baseUrl, token);
                const tree = documentTreeBuild(items);
                set({ items, tree, loading: false });
            } catch (err) {
                set({ loading: false, error: err instanceof Error ? err.message : "Failed to fetch documents." });
            }
        },

        select: (id) => {
            const { items } = get();
            const doc = id ? items.find((d) => d.id === id) : null;
            set({
                selectedId: id,
                draftBody: doc?.body ?? null,
                draftTitle: doc?.title ?? null,
                draftDescription: doc?.description ?? null
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

        createDocument: async (baseUrl, token, input) => {
            set({ saving: true, error: null });
            try {
                await documentCreate(baseUrl, token, input);
                await get().fetch(baseUrl, token);
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to create document." });
            }
        },

        updateDocument: async (baseUrl, token, id, input) => {
            set({ saving: true, error: null });
            try {
                const updated = await documentUpdate(baseUrl, token, id, input);
                const { items } = get();
                const nextItems = items.map((d) => (d.id === id ? updated : d));
                const tree = documentTreeBuild(nextItems);
                set({ items: nextItems, tree, saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to update document." });
            }
        },

        deleteDocument: async (baseUrl, token, id) => {
            set({ saving: true, error: null });
            try {
                await documentDelete(baseUrl, token, id);
                const { selectedId } = get();
                await get().fetch(baseUrl, token);
                if (selectedId === id) {
                    set({ selectedId: null, draftBody: null, draftTitle: null, draftDescription: null });
                }
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to delete document." });
            }
        },

        move: async (baseUrl, token, id, newParentId) => {
            set({ saving: true, error: null });
            try {
                await documentUpdate(baseUrl, token, id, { parentId: newParentId });
                await get().fetch(baseUrl, token);
                set({ saving: false });
            } catch (err) {
                set({ saving: false, error: err instanceof Error ? err.message : "Failed to move document." });
            }
        },

        setDraftBody: (body) => set({ draftBody: body }),
        setDraftTitle: (title) => set({ draftTitle: title }),
        setDraftDescription: (description) => set({ draftDescription: description }),

        saveDraft: async (baseUrl, token) => {
            const { selectedId, draftBody, draftTitle, draftDescription } = get();
            if (!selectedId) return;

            const input: Record<string, string> = {};
            if (draftBody !== null) input.body = draftBody;
            if (draftTitle !== null) input.title = draftTitle;
            if (draftDescription !== null) input.description = draftDescription;

            if (Object.keys(input).length === 0) return;

            await get().updateDocument(baseUrl, token, selectedId, input);
        },

        setDragSource: (id) => set({ dragSourceId: id }),
        setDropTarget: (id) => set({ dropTargetId: id })
    }));
}
