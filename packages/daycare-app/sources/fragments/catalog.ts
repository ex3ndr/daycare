import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react-native/schema";
import { z } from "zod";
import { colorSchema } from "./theme/colors";
import { flexAlignSchema, flexJustifySchema } from "./theme/flex";
import { spacingSchema } from "./theme/size";
import { fontWeightSchema } from "./theme/typography";

// Semantic surface levels that map to Material Design 3 surface container hierarchy.
const surfaceLevel = z.enum(["lowest", "low", "default", "high", "highest"]);

// Typography scale following Material Design 3 type scale.
const textSize = z.enum(["xs", "sm", "md", "lg", "xl"]);

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
 * Fragments catalog — theme-constrained components for json-render.
 *
 * Color props accept either a theme color role (e.g. "primary", "onSurface")
 * or any CSS color string (e.g. "#FF0000"). Theme roles are resolved at
 * render time; raw colors are passed through directly.
 */
export const fragmentsCatalog = defineCatalog(schema, {
    components: {
        // -- Layout --

        View: {
            props: z.object({
                direction: z.enum(["row", "column"]).nullable(),
                gap: spacingSchema.nullable(),
                padding: spacingSchema.nullable(),
                paddingHorizontal: spacingSchema.nullable(),
                paddingVertical: spacingSchema.nullable(),
                paddingTop: spacingSchema.nullable(),
                paddingBottom: spacingSchema.nullable(),
                paddingLeft: spacingSchema.nullable(),
                paddingRight: spacingSchema.nullable(),
                margin: spacingSchema.nullable(),
                marginHorizontal: spacingSchema.nullable(),
                marginVertical: spacingSchema.nullable(),
                marginTop: spacingSchema.nullable(),
                marginBottom: spacingSchema.nullable(),
                marginLeft: spacingSchema.nullable(),
                marginRight: spacingSchema.nullable(),
                alignItems: flexAlignSchema.nullable(),
                justifyContent: flexJustifySchema.nullable(),
                flexGrow: z.number().nullable(),
                flexShrink: z.number().nullable(),
                flexBasis: z.number().nullable(),
                wrap: z.boolean().nullable(),
                color: colorSchema.nullable(),
                pressedColor: colorSchema.nullable(),
                hoverColor: colorSchema.nullable(),
                pressable: z.boolean().nullable()
            }),
            slots: ["default"],
            description:
                "General-purpose container. Optionally pressable with background, pressed, and hover colors. Accepts all flex layout props."
        },

        ScrollView: {
            props: z.object({
                gap: spacingSchema.nullable(),
                padding: spacingSchema.nullable(),
                paddingHorizontal: spacingSchema.nullable(),
                paddingVertical: spacingSchema.nullable(),
                paddingTop: spacingSchema.nullable(),
                paddingBottom: spacingSchema.nullable(),
                paddingLeft: spacingSchema.nullable(),
                paddingRight: spacingSchema.nullable(),
                margin: spacingSchema.nullable(),
                marginHorizontal: spacingSchema.nullable(),
                marginVertical: spacingSchema.nullable(),
                marginTop: spacingSchema.nullable(),
                marginBottom: spacingSchema.nullable(),
                marginLeft: spacingSchema.nullable(),
                marginRight: spacingSchema.nullable(),
                alignItems: flexAlignSchema.nullable(),
                justifyContent: flexJustifySchema.nullable(),
                flexGrow: z.number().nullable(),
                flexShrink: z.number().nullable(),
                flexBasis: z.number().nullable(),
                color: colorSchema.nullable(),
                surface: surfaceLevel.nullable()
            }),
            slots: ["default"],
            description: "Scrollable vertical container with full layout props."
        },

        // -- Surfaces --

        Card: {
            props: z.object({
                surface: surfaceLevel.nullable(),
                color: colorSchema.nullable(),
                elevation: elevationLevel.nullable(),
                padding: spacingSchema.nullable()
            }),
            slots: ["default"],
            description:
                "Rounded surface container with elevation. 'color' overrides 'surface' with any theme color role (e.g. primaryContainer).",
            example: { surface: "default", elevation: "low", padding: "md" }
        },

        ItemGroup: {
            props: z.object({
                title: z.string().nullable(),
                subtitle: z.string().nullable(),
                surface: surfaceLevel.nullable(),
                padding: spacingSchema.nullable()
            }),
            slots: ["default"],
            description:
                "Grouped list section with optional header (title + subtitle). Children must be ListItem components only — do not place arbitrary content inside.",
            example: { title: "Settings", padding: "md" }
        },

        Divider: {
            props: z.object({
                spacing: spacingSchema.nullable()
            }),
            slots: [],
            description: "Horizontal rule using outline variant color."
        },

        Spacer: {
            props: z.object({
                size: spacingSchema.nullable(),
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
                weight: fontWeightSchema.nullable(),
                color: colorSchema.nullable(),
                align: z.enum(["left", "center", "right"]).nullable(),
                numberOfLines: z.number().nullable(),
                strikethrough: z.boolean().nullable(),
                underline: z.boolean().nullable(),
                italic: z.boolean().nullable(),
                lineHeight: z.number().nullable(),
                letterSpacing: z.number().nullable(),
                opacity: z.number().nullable(),
                padding: spacingSchema.nullable(),
                paddingHorizontal: spacingSchema.nullable(),
                paddingVertical: spacingSchema.nullable(),
                paddingTop: spacingSchema.nullable(),
                paddingBottom: spacingSchema.nullable(),
                paddingLeft: spacingSchema.nullable(),
                paddingRight: spacingSchema.nullable(),
                margin: spacingSchema.nullable(),
                marginHorizontal: spacingSchema.nullable(),
                marginVertical: spacingSchema.nullable(),
                marginTop: spacingSchema.nullable(),
                marginBottom: spacingSchema.nullable(),
                marginLeft: spacingSchema.nullable(),
                marginRight: spacingSchema.nullable(),
                flexGrow: z.number().nullable(),
                flexShrink: z.number().nullable()
            }),
            slots: [],
            description: "Theme-styled text. Color defaults to onSurface.",
            example: { text: "Hello", size: "md" }
        },

        Heading: {
            props: z.object({
                text: z.string(),
                level: z.enum(["h1", "h2", "h3"]).nullable(),
                color: colorSchema.nullable(),
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
                color: colorSchema.nullable()
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
                color: colorSchema.nullable(),
                trackColor: colorSchema.nullable(),
                height: z.number().nullable()
            }),
            slots: [],
            description:
                "Horizontal progress bar. 'value' is 0–1. Defaults: color=primary, trackColor=surfaceContainerHigh, height=6.",
            example: { value: 0.6 }
        }
    },

    actions: {}
});

export type FragmentsCatalog = typeof fragmentsCatalog;
