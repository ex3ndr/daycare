import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react-native/schema";
import { z } from "zod";

// Semantic color roles mapped to Material Design 3 theme tokens.
// No raw hex colors allowed — all colors resolve through the theme at render time.
const colorRole = z.enum([
    "primary",
    "onPrimary",
    "primaryContainer",
    "onPrimaryContainer",
    "secondary",
    "onSecondary",
    "secondaryContainer",
    "onSecondaryContainer",
    "tertiary",
    "onTertiary",
    "tertiaryContainer",
    "onTertiaryContainer",
    "error",
    "onError",
    "errorContainer",
    "onErrorContainer",
    "surface",
    "onSurface",
    "surfaceVariant",
    "onSurfaceVariant",
    "surfaceContainer",
    "surfaceContainerLow",
    "surfaceContainerHigh",
    "surfaceContainerHighest",
    "outline",
    "outlineVariant"
]);

// Semantic surface levels that map to Material Design 3 surface container hierarchy.
const surfaceLevel = z.enum(["lowest", "low", "default", "high", "highest"]);

// Typography scale following Material Design 3 type scale.
const textSize = z.enum(["xs", "sm", "md", "lg", "xl"]);
const textWeight = z.enum(["regular", "medium", "semibold"]);

// Spacing scale: 4px increments for consistent density.
const spacingScale = z.enum(["none", "xs", "sm", "md", "lg", "xl"]);

// Elevation levels matching theme.elevation.
const elevationLevel = z.enum(["none", "low", "medium", "high"]);

// Icon set families available via @expo/vector-icons.
const iconSet = z.enum([
    "AntDesign",
    "Entypo",
    "EvilIcons",
    "Feather",
    "FontAwesome",
    "FontAwesome5",
    "FontAwesome6",
    "Fontisto",
    "Foundation",
    "Ionicons",
    "MaterialCommunityIcons",
    "MaterialIcons",
    "Octicons",
    "SimpleLineIcons",
    "Zocial"
]);

/**
 * Widgets catalog — theme-constrained components for json-render.
 *
 * Every visual property uses semantic tokens (color roles, spacing scale,
 * typography scale) instead of raw values. The rendering layer maps these
 * tokens to the active Material Design 3 theme.
 */
export const widgetsCatalog = defineCatalog(schema, {
    components: {
        // -- Layout --

        Column: {
            props: z.object({
                gap: spacingScale.nullable(),
                padding: spacingScale.nullable(),
                alignItems: z.enum(["start", "center", "end", "stretch"]).nullable(),
                justifyContent: z.enum(["start", "center", "end", "between"]).nullable(),
                flex: z.number().nullable(),
                surface: surfaceLevel.nullable()
            }),
            slots: ["default"],
            description: "Vertical stack with theme-based spacing and optional surface background."
        },

        Row: {
            props: z.object({
                gap: spacingScale.nullable(),
                padding: spacingScale.nullable(),
                alignItems: z.enum(["start", "center", "end", "stretch", "baseline"]).nullable(),
                justifyContent: z.enum(["start", "center", "end", "between"]).nullable(),
                flex: z.number().nullable(),
                wrap: z.boolean().nullable()
            }),
            slots: ["default"],
            description: "Horizontal stack with theme-based spacing."
        },

        ScrollArea: {
            props: z.object({
                padding: spacingScale.nullable(),
                surface: surfaceLevel.nullable()
            }),
            slots: ["default"],
            description: "Scrollable vertical container."
        },

        // -- Surfaces --

        Card: {
            props: z.object({
                surface: surfaceLevel.nullable(),
                color: colorRole.nullable(),
                elevation: elevationLevel.nullable(),
                padding: spacingScale.nullable()
            }),
            slots: ["default"],
            description:
                "Rounded surface container with elevation. 'color' overrides 'surface' with any theme color role (e.g. primaryContainer).",
            example: { surface: "default", elevation: "low", padding: "md" }
        },

        Section: {
            props: z.object({
                title: z.string().nullable(),
                subtitle: z.string().nullable(),
                surface: surfaceLevel.nullable(),
                padding: spacingScale.nullable()
            }),
            slots: ["default"],
            description: "Card with an optional header (title + subtitle) and body content.",
            example: { title: "Settings", padding: "md" }
        },

        Divider: {
            props: z.object({
                spacing: spacingScale.nullable()
            }),
            slots: [],
            description: "Horizontal rule using outline variant color."
        },

        Spacer: {
            props: z.object({
                size: spacingScale.nullable(),
                flex: z.number().nullable()
            }),
            slots: [],
            description: "Empty space or flex filler."
        },

        // -- Typography --

        Text: {
            props: z.object({
                text: z.string(),
                size: textSize.nullable(),
                weight: textWeight.nullable(),
                color: colorRole.nullable(),
                align: z.enum(["left", "center", "right"]).nullable(),
                numberOfLines: z.number().nullable(),
                strikethrough: z.boolean().nullable()
            }),
            slots: [],
            description: "Theme-styled text. Color defaults to onSurface.",
            example: { text: "Hello", size: "md" }
        },

        Heading: {
            props: z.object({
                text: z.string(),
                level: z.enum(["h1", "h2", "h3"]).nullable(),
                color: colorRole.nullable(),
                align: z.enum(["left", "center", "right"]).nullable()
            }),
            slots: [],
            description: "Section heading using semibold weight. Color defaults to onSurface.",
            example: { text: "Title", level: "h2" }
        },

        // -- Icons --

        Icon: {
            props: z.object({
                name: z.string(),
                set: iconSet.nullable(),
                size: z.number().nullable(),
                color: colorRole.nullable()
            }),
            slots: [],
            description:
                "Vector icon from any @expo/vector-icons set. Defaults to Ionicons. Set determines the icon family.",
            example: { name: "heart", set: "Ionicons", size: 24 }
        },

        // -- Controls --

        Button: {
            props: z.object({
                label: z.string(),
                variant: z.enum(["filled", "tonal", "outlined", "text"]).nullable(),
                size: z.enum(["sm", "md", "lg"]).nullable(),
                disabled: z.boolean().nullable(),
                loading: z.boolean().nullable()
            }),
            slots: [],
            description:
                "Material Design 3 button. 'filled' uses primary, 'tonal' uses secondaryContainer, 'outlined' uses outline border, 'text' is borderless.",
            example: { label: "Save", variant: "filled" }
        },

        IconButton: {
            props: z.object({
                icon: z.string(),
                set: iconSet.nullable(),
                variant: z.enum(["filled", "tonal", "outlined", "standard"]).nullable(),
                size: z.enum(["sm", "md", "lg"]).nullable(),
                disabled: z.boolean().nullable()
            }),
            slots: [],
            description:
                "Icon-only button. Defaults to Ionicons; use 'set' for other icon families. Variant controls surface/color treatment.",
            example: { icon: "trash-outline", variant: "standard" }
        },

        TextInput: {
            props: z.object({
                label: z.string().nullable(),
                placeholder: z.string().nullable(),
                value: z.string().nullable(),
                flex: z.number().nullable(),
                multiline: z.boolean().nullable(),
                numberOfLines: z.number().nullable()
            }),
            slots: [],
            description: "Text field with outline styling using theme outline color.",
            example: { label: "Name", placeholder: "Enter name" }
        },

        Switch: {
            props: z.object({
                checked: z.boolean().nullable(),
                label: z.string().nullable(),
                disabled: z.boolean().nullable()
            }),
            slots: [],
            description: "Toggle switch with primary track color."
        },

        Checkbox: {
            props: z.object({
                checked: z.boolean().nullable(),
                label: z.string().nullable(),
                disabled: z.boolean().nullable()
            }),
            slots: [],
            description: "Checkbox with primary fill color when checked."
        },

        // -- Data Display --

        ListItem: {
            props: z.object({
                title: z.string(),
                subtitle: z.string().nullable(),
                showChevron: z.boolean().nullable(),
                showDivider: z.boolean().nullable()
            }),
            slots: [],
            description: "Standard list row using onSurface/onSurfaceVariant text colors.",
            example: { title: "Wi-Fi", subtitle: "Connected", showChevron: true }
        },

        Badge: {
            props: z.object({
                label: z.string(),
                variant: z.enum(["default", "primary", "secondary", "error"]).nullable()
            }),
            slots: [],
            description:
                "Small label badge. 'default' uses surfaceVariant, 'primary' uses primaryContainer, 'error' uses errorContainer.",
            example: { label: "New", variant: "primary" }
        },

        Avatar: {
            props: z.object({
                initials: z.string().nullable(),
                src: z.string().nullable(),
                size: z.enum(["sm", "md", "lg"]).nullable()
            }),
            slots: [],
            description: "Circular avatar using primaryContainer background for initials fallback.",
            example: { initials: "AB", size: "md" }
        },

        Spinner: {
            props: z.object({
                size: z.enum(["small", "large"]).nullable()
            }),
            slots: [],
            description: "Loading indicator using primary color."
        },

        ProgressBar: {
            props: z.object({
                value: z.number(),
                color: colorRole.nullable(),
                trackColor: colorRole.nullable(),
                height: z.number().nullable()
            }),
            slots: [],
            description:
                "Horizontal progress bar. 'value' is 0–1. Defaults: color=primary, trackColor=surfaceContainerHigh, height=6.",
            example: { value: 0.6 }
        },

        Chip: {
            props: z.object({
                label: z.string(),
                icon: z.string().nullable(),
                iconSet: iconSet.nullable(),
                variant: z.enum(["filled", "tonal", "outlined"]).nullable()
            }),
            slots: [],
            description:
                "Compact pill element. 'filled' uses primary, 'tonal' uses secondaryContainer (default), 'outlined' uses outline border.",
            example: { label: "Active", variant: "tonal" }
        },

        Metric: {
            props: z.object({
                value: z.string(),
                label: z.string(),
                size: z.enum(["sm", "md", "lg"]).nullable(),
                color: colorRole.nullable(),
                align: z.enum(["left", "center", "right"]).nullable()
            }),
            slots: [],
            description: "Stacked value/label KPI pair. Value is semibold, label is smaller with reduced opacity.",
            example: { value: "$12.8K", label: "Revenue", size: "md" }
        },

        // -- Feedback --

        Banner: {
            props: z.object({
                text: z.string(),
                variant: z.enum(["info", "success", "warning", "error"]).nullable()
            }),
            slots: [],
            description:
                "Status banner. 'info' uses secondaryContainer, 'success' uses tertiaryContainer, 'warning' uses primaryContainer, 'error' uses errorContainer.",
            example: { text: "Changes saved", variant: "success" }
        },

        EmptyState: {
            props: z.object({
                title: z.string(),
                subtitle: z.string().nullable(),
                icon: z.string().nullable(),
                iconSet: iconSet.nullable()
            }),
            slots: [],
            description: "Centered placeholder for empty lists/screens. Uses onSurfaceVariant colors.",
            example: { title: "No items", subtitle: "Create one to get started" }
        }
    },

    actions: {}
});

export type WidgetsCatalog = typeof widgetsCatalog;
