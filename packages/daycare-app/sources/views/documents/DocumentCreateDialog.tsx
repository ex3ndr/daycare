import * as React from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { documentSlugGenerate } from "@/modules/documents/documentSlugGenerate";

type DocumentCreateDialogProps = {
    visible: boolean;
    parentId: string | null;
    onClose: () => void;
    onCreate: (input: { title: string; slug: string; parentId: string | null }) => void;
};

/**
 * Modal dialog for creating a new document.
 * Auto-generates slug from title.
 */
export const DocumentCreateDialog = React.memo<DocumentCreateDialogProps>((props) => {
    const { visible, parentId, onClose, onCreate } = props;
    const { theme } = useUnistyles();
    const [title, setTitle] = React.useState("");
    const [slug, setSlug] = React.useState("");
    const [slugManual, setSlugManual] = React.useState(false);

    React.useEffect(() => {
        if (visible) {
            setTitle("");
            setSlug("");
            setSlugManual(false);
        }
    }, [visible]);

    const handleTitleChange = React.useCallback(
        (text: string) => {
            setTitle(text);
            if (!slugManual) {
                setSlug(documentSlugGenerate(text));
            }
        },
        [slugManual]
    );

    const handleSlugChange = React.useCallback((text: string) => {
        setSlugManual(true);
        setSlug(text);
    }, []);

    const handleCreate = React.useCallback(() => {
        const trimmedTitle = title.trim();
        const trimmedSlug = slug.trim() || documentSlugGenerate(trimmedTitle);
        if (!trimmedTitle || !trimmedSlug) return;
        onCreate({ title: trimmedTitle, slug: trimmedSlug, parentId });
        onClose();
    }, [title, slug, parentId, onCreate, onClose]);

    const labelStyle = {
        fontSize: 13,
        fontWeight: "600" as const,
        color: theme.colors.onSurfaceVariant,
        marginBottom: 6
    };

    const inputStyle = {
        fontSize: 14,
        color: theme.colors.onSurface,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderRadius: 8,
        padding: 10,
        marginBottom: 16
    };

    const content = (
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Platform.OS === "web" ? "rgba(0,0,0,0.4)" : undefined
            }}
        >
            <View
                style={{
                    width: 400,
                    maxWidth: "90%",
                    backgroundColor: theme.colors.surface,
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: theme.elevation.level3
                }}
            >
                <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.onSurface, marginBottom: 20 }}>
                    New Document
                </Text>

                <Text style={labelStyle}>Title</Text>
                <TextInput
                    value={title}
                    onChangeText={handleTitleChange}
                    placeholder="Document title"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    style={inputStyle}
                    autoFocus
                />

                <Text style={labelStyle}>Slug</Text>
                <TextInput
                    value={slug}
                    onChangeText={handleSlugChange}
                    placeholder="auto-generated-slug"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    style={inputStyle}
                />

                {parentId && (
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                        Creating under parent: {parentId}
                    </Text>
                )}

                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                    <Pressable
                        onPress={onClose}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8
                        }}
                    >
                        <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleCreate}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8,
                            backgroundColor: theme.colors.primary
                        }}
                    >
                        <Text style={{ fontSize: 14, color: theme.colors.onPrimary, fontWeight: "600" }}>Create</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            {content}
        </Modal>
    );
});
