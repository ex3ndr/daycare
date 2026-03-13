// @generated — do not edit manually. Run: yarn workspace daycare-app export:fragment-skill

export const fragmentSchema = {
    View: {
        props: [
            "direction",
            "gap",
            "padding",
            "paddingHorizontal",
            "paddingVertical",
            "paddingTop",
            "paddingBottom",
            "paddingLeft",
            "paddingRight",
            "margin",
            "marginHorizontal",
            "marginVertical",
            "marginTop",
            "marginBottom",
            "marginLeft",
            "marginRight",
            "alignItems",
            "justifyContent",
            "flexGrow",
            "flexShrink",
            "flexBasis",
            "wrap",
            "position",
            "top",
            "right",
            "bottom",
            "left",
            "color",
            "pressedColor",
            "hoverColor",
            "pressable"
        ],
        slots: ["default"]
    },
    ScrollView: {
        props: [
            "gap",
            "padding",
            "paddingHorizontal",
            "paddingVertical",
            "paddingTop",
            "paddingBottom",
            "paddingLeft",
            "paddingRight",
            "margin",
            "marginHorizontal",
            "marginVertical",
            "marginTop",
            "marginBottom",
            "marginLeft",
            "marginRight",
            "alignItems",
            "justifyContent",
            "flexGrow",
            "flexShrink",
            "flexBasis",
            "color",
            "surface"
        ],
        slots: ["default"]
    },
    Card: {
        props: ["surface", "color", "elevation", "padding"],
        slots: ["default"]
    },
    ItemGroup: {
        props: ["title", "subtitle", "surface", "padding"],
        slots: ["default"]
    },
    Section: {
        props: ["title", "subtitle", "padding", "gap"],
        slots: ["default"]
    },
    Divider: {
        props: ["spacing"],
        slots: []
    },
    Spacer: {
        props: ["size", "flex"],
        slots: []
    },
    Text: {
        props: [
            "text",
            "size",
            "weight",
            "color",
            "align",
            "numberOfLines",
            "strikethrough",
            "underline",
            "italic",
            "lineHeight",
            "letterSpacing",
            "opacity",
            "flexGrow",
            "flexShrink"
        ],
        slots: []
    },
    Heading: {
        props: ["text", "level", "color", "align"],
        slots: []
    },
    Icon: {
        props: ["name", "set", "size", "color"],
        slots: []
    },
    Button: {
        props: ["label", "variant", "size", "disabled", "loading"],
        slots: []
    },
    IconButton: {
        props: ["icon", "set", "variant", "size", "disabled"],
        slots: []
    },
    TextInput: {
        props: ["label", "placeholder", "value", "flex", "multiline", "numberOfLines"],
        slots: []
    },
    Switch: {
        props: ["checked", "label", "disabled"],
        slots: []
    },
    Checkbox: {
        props: ["checked", "label", "disabled"],
        slots: []
    },
    Item: {
        props: ["title", "subtitle", "showChevron", "showDivider"],
        slots: []
    },
    Spinner: {
        props: ["size"],
        slots: []
    },
    ProgressBar: {
        props: ["value", "color", "trackColor", "height"],
        slots: []
    }
} as const;
