import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { fragmentsRegistry } from "@/fragments/registry";

/**
 * Static spec that exercises every widget component with representative props.
 * No actions are wired — this is a visual showcase only.
 */
const showcaseSpec: Spec = {
    root: "root",
    elements: {
        root: {
            type: "ScrollView",
            props: {},
            children: ["main"]
        },
        main: {
            type: "View",
            props: { direction: "column", gap: "lg" },
            children: [
                "sectionTypography",
                "sectionIcons",
                "sectionButtons",
                "sectionIconButtons",
                "sectionInputs",
                "sectionToggles",
                "sectionListItems",
                "sectionCards",
                "sectionProgress",
                "sectionSpinner"
            ]
        },

        // -- Typography --

        sectionTypography: {
            type: "ItemGroup",
            props: { title: "Typography", padding: "md" },
            children: ["typoCol"]
        },
        typoCol: {
            type: "View",
            props: { direction: "column", gap: "sm" },
            children: ["typoH1", "typoH2", "typoH3", "typoXs", "typoSm", "typoMd", "typoLg", "typoXl", "typoStrike"]
        },
        typoH1: { type: "Heading", props: { text: "Heading h1", level: "h1" }, children: [] },
        typoH2: { type: "Heading", props: { text: "Heading h2", level: "h2" }, children: [] },
        typoH3: { type: "Heading", props: { text: "Heading h3", level: "h3" }, children: [] },
        typoXs: { type: "Text", props: { text: "Text xs — extra small", size: "xs" }, children: [] },
        typoSm: { type: "Text", props: { text: "Text sm — small caption", size: "sm" }, children: [] },
        typoMd: { type: "Text", props: { text: "Text md — body (default)", size: "md" }, children: [] },
        typoLg: { type: "Text", props: { text: "Text lg — large", size: "lg" }, children: [] },
        typoXl: { type: "Text", props: { text: "Text xl — display", size: "xl" }, children: [] },
        typoStrike: {
            type: "Text",
            props: { text: "Strikethrough text", size: "md", strikethrough: true, color: "onSurfaceVariant" },
            children: []
        },

        // -- Icons --

        sectionIcons: {
            type: "ItemGroup",
            props: { title: "Icons", padding: "md" },
            children: ["iconSetsCol"]
        },
        iconSetsCol: {
            type: "View",
            props: { direction: "column", gap: "md" },
            children: [
                "iconRowIonicons",
                "iconRowMaterial",
                "iconRowMaterialCommunity",
                "iconRowFeather",
                "iconRowFontAwesome",
                "iconRowOcticons",
                "iconRowAntDesign",
                "iconRowEntypo"
            ]
        },
        iconRowIonicons: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelIonicons", "iconIoniconsRow"]
        },
        iconLabelIonicons: {
            type: "Text",
            props: { text: "Ionicons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconIoniconsRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icIon1", "icIon2", "icIon3", "icIon4", "icIon5"]
        },
        icIon1: { type: "Icon", props: { name: "home", set: "Ionicons" }, children: [] },
        icIon2: { type: "Icon", props: { name: "heart", set: "Ionicons", color: "error" }, children: [] },
        icIon3: { type: "Icon", props: { name: "settings-outline", set: "Ionicons" }, children: [] },
        icIon4: { type: "Icon", props: { name: "search", set: "Ionicons" }, children: [] },
        icIon5: { type: "Icon", props: { name: "star", set: "Ionicons", color: "primary" }, children: [] },

        iconRowMaterial: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelMaterial", "iconMaterialRow"]
        },
        iconLabelMaterial: {
            type: "Text",
            props: { text: "MaterialIcons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconMaterialRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icMat1", "icMat2", "icMat3", "icMat4", "icMat5"]
        },
        icMat1: { type: "Icon", props: { name: "dashboard", set: "MaterialIcons" }, children: [] },
        icMat2: { type: "Icon", props: { name: "delete", set: "MaterialIcons", color: "error" }, children: [] },
        icMat3: { type: "Icon", props: { name: "email", set: "MaterialIcons" }, children: [] },
        icMat4: { type: "Icon", props: { name: "edit", set: "MaterialIcons" }, children: [] },
        icMat5: { type: "Icon", props: { name: "folder", set: "MaterialIcons", color: "primary" }, children: [] },

        iconRowMaterialCommunity: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelMaterialCommunity", "iconMaterialCommunityRow"]
        },
        iconLabelMaterialCommunity: {
            type: "Text",
            props: { text: "MaterialCommunityIcons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconMaterialCommunityRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icMci1", "icMci2", "icMci3", "icMci4", "icMci5"]
        },
        icMci1: { type: "Icon", props: { name: "account-circle", set: "MaterialCommunityIcons" }, children: [] },
        icMci2: {
            type: "Icon",
            props: { name: "bell-ring", set: "MaterialCommunityIcons", color: "primary" },
            children: []
        },
        icMci3: { type: "Icon", props: { name: "calendar", set: "MaterialCommunityIcons" }, children: [] },
        icMci4: { type: "Icon", props: { name: "chart-bar", set: "MaterialCommunityIcons" }, children: [] },
        icMci5: {
            type: "Icon",
            props: { name: "lightning-bolt", set: "MaterialCommunityIcons", color: "tertiary" },
            children: []
        },

        iconRowFeather: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelFeather", "iconFeatherRow"]
        },
        iconLabelFeather: {
            type: "Text",
            props: { text: "Feather", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconFeatherRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icFea1", "icFea2", "icFea3", "icFea4", "icFea5"]
        },
        icFea1: { type: "Icon", props: { name: "activity", set: "Feather" }, children: [] },
        icFea2: { type: "Icon", props: { name: "camera", set: "Feather" }, children: [] },
        icFea3: { type: "Icon", props: { name: "globe", set: "Feather", color: "primary" }, children: [] },
        icFea4: { type: "Icon", props: { name: "lock", set: "Feather" }, children: [] },
        icFea5: { type: "Icon", props: { name: "zap", set: "Feather", color: "tertiary" }, children: [] },

        iconRowFontAwesome: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelFontAwesome", "iconFontAwesomeRow"]
        },
        iconLabelFontAwesome: {
            type: "Text",
            props: { text: "FontAwesome", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconFontAwesomeRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icFa1", "icFa2", "icFa3", "icFa4", "icFa5"]
        },
        icFa1: { type: "Icon", props: { name: "rocket", set: "FontAwesome" }, children: [] },
        icFa2: { type: "Icon", props: { name: "flag", set: "FontAwesome", color: "error" }, children: [] },
        icFa3: { type: "Icon", props: { name: "trophy", set: "FontAwesome", color: "primary" }, children: [] },
        icFa4: { type: "Icon", props: { name: "users", set: "FontAwesome" }, children: [] },
        icFa5: { type: "Icon", props: { name: "bolt", set: "FontAwesome" }, children: [] },

        iconRowOcticons: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelOcticons", "iconOcticonsRow"]
        },
        iconLabelOcticons: {
            type: "Text",
            props: { text: "Octicons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconOcticonsRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icOct1", "icOct2", "icOct3", "icOct4", "icOct5"]
        },
        icOct1: { type: "Icon", props: { name: "repo", set: "Octicons" }, children: [] },
        icOct2: { type: "Icon", props: { name: "git-branch", set: "Octicons", color: "primary" }, children: [] },
        icOct3: { type: "Icon", props: { name: "issue-opened", set: "Octicons", color: "tertiary" }, children: [] },
        icOct4: { type: "Icon", props: { name: "star", set: "Octicons" }, children: [] },
        icOct5: { type: "Icon", props: { name: "code", set: "Octicons" }, children: [] },

        iconRowAntDesign: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelAntDesign", "iconAntDesignRow"]
        },
        iconLabelAntDesign: {
            type: "Text",
            props: { text: "AntDesign", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconAntDesignRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icAnt1", "icAnt2", "icAnt3", "icAnt4", "icAnt5"]
        },
        icAnt1: { type: "Icon", props: { name: "home", set: "AntDesign" }, children: [] },
        icAnt2: { type: "Icon", props: { name: "setting", set: "AntDesign" }, children: [] },
        icAnt3: { type: "Icon", props: { name: "heart", set: "AntDesign", color: "primary" }, children: [] },
        icAnt4: { type: "Icon", props: { name: "notification", set: "AntDesign" }, children: [] },
        icAnt5: { type: "Icon", props: { name: "Safety", set: "AntDesign", color: "tertiary" }, children: [] },

        iconRowEntypo: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["iconLabelEntypo", "iconEntypoRow"]
        },
        iconLabelEntypo: {
            type: "Text",
            props: { text: "Entypo", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconEntypoRow: {
            type: "View",
            props: { direction: "row", gap: "md", alignItems: "center", wrap: true },
            children: ["icEnt1", "icEnt2", "icEnt3", "icEnt4", "icEnt5"]
        },
        icEnt1: { type: "Icon", props: { name: "air", set: "Entypo" }, children: [] },
        icEnt2: { type: "Icon", props: { name: "emoji-happy", set: "Entypo", color: "primary" }, children: [] },
        icEnt3: { type: "Icon", props: { name: "flash", set: "Entypo", color: "tertiary" }, children: [] },
        icEnt4: { type: "Icon", props: { name: "map", set: "Entypo" }, children: [] },
        icEnt5: { type: "Icon", props: { name: "palette", set: "Entypo" }, children: [] },

        // -- Buttons --

        sectionButtons: {
            type: "ItemGroup",
            props: { title: "Buttons", padding: "md" },
            children: ["btnCol"]
        },
        btnCol: {
            type: "View",
            props: { direction: "column", gap: "sm" },
            children: ["btnRow1", "btnRow2"]
        },
        btnRow1: {
            type: "View",
            props: { direction: "row", gap: "sm", wrap: true },
            children: ["btnFilled", "btnTonal", "btnOutlined", "btnText"]
        },
        btnFilled: { type: "Button", props: { label: "Filled", variant: "filled" }, children: [] },
        btnTonal: { type: "Button", props: { label: "Tonal", variant: "tonal" }, children: [] },
        btnOutlined: { type: "Button", props: { label: "Outlined", variant: "outlined" }, children: [] },
        btnText: { type: "Button", props: { label: "Text", variant: "text" }, children: [] },
        btnRow2: {
            type: "View",
            props: { direction: "row", gap: "sm", wrap: true },
            children: ["btnSm", "btnMd", "btnLg", "btnDisabled", "btnLoading"]
        },
        btnSm: { type: "Button", props: { label: "Small", variant: "filled", size: "sm" }, children: [] },
        btnMd: { type: "Button", props: { label: "Medium", variant: "filled", size: "md" }, children: [] },
        btnLg: { type: "Button", props: { label: "Large", variant: "filled", size: "lg" }, children: [] },
        btnDisabled: {
            type: "Button",
            props: { label: "Disabled", variant: "filled", disabled: true },
            children: []
        },
        btnLoading: {
            type: "Button",
            props: { label: "Loading", variant: "tonal", loading: true },
            children: []
        },

        // -- Icon Buttons --

        sectionIconButtons: {
            type: "ItemGroup",
            props: { title: "Icon Buttons", padding: "md" },
            children: ["iconBtnRow"]
        },
        iconBtnRow: {
            type: "View",
            props: { direction: "row", gap: "sm", alignItems: "center" },
            children: ["iconFilled", "iconTonal", "iconOutlined", "iconStandard"]
        },
        iconFilled: {
            type: "IconButton",
            props: { icon: "heart", variant: "filled" },
            children: []
        },
        iconTonal: {
            type: "IconButton",
            props: { icon: "bookmark-outline", variant: "tonal" },
            children: []
        },
        iconOutlined: {
            type: "IconButton",
            props: { icon: "share-outline", variant: "outlined" },
            children: []
        },
        iconStandard: {
            type: "IconButton",
            props: { icon: "trash-outline", variant: "standard" },
            children: []
        },

        // -- Inputs --

        sectionInputs: {
            type: "ItemGroup",
            props: { title: "Text Inputs", padding: "md" },
            children: ["inputCol"]
        },
        inputCol: {
            type: "View",
            props: { direction: "column", gap: "sm" },
            children: ["inputBasic", "inputMultiline"]
        },
        inputBasic: {
            type: "TextInput",
            props: { label: "Name", placeholder: "Enter your name" },
            children: []
        },
        inputMultiline: {
            type: "TextInput",
            props: { label: "Notes", placeholder: "Add notes...", multiline: true, numberOfLines: 3 },
            children: []
        },

        // -- Toggles --

        sectionToggles: {
            type: "ItemGroup",
            props: { title: "Toggles", padding: "md" },
            children: ["toggleCol"]
        },
        toggleCol: {
            type: "View",
            props: { direction: "column", gap: "md" },
            children: ["switchOn", "switchOff", "checkOn", "checkOff"]
        },
        switchOn: { type: "Switch", props: { label: "Notifications", checked: true }, children: [] },
        switchOff: { type: "Switch", props: { label: "Dark mode", checked: false }, children: [] },
        checkOn: { type: "Checkbox", props: { label: "Accept terms", checked: true }, children: [] },
        checkOff: { type: "Checkbox", props: { label: "Subscribe to newsletter", checked: false }, children: [] },

        // -- List Items --

        sectionListItems: {
            type: "ItemGroup",
            props: { title: "List Items" },
            children: ["listItem1", "listItem2", "listItem3"]
        },
        listItem1: {
            type: "Item",
            props: { title: "Wi-Fi", subtitle: "Connected", showChevron: true, showDivider: true },
            children: []
        },
        listItem2: {
            type: "Item",
            props: { title: "Bluetooth", subtitle: "Off", showChevron: true, showDivider: true },
            children: []
        },
        listItem3: {
            type: "Item",
            props: { title: "Airplane Mode", showChevron: false, showDivider: false },
            children: []
        },

        // -- Cards --

        sectionCards: {
            type: "ItemGroup",
            props: { title: "Cards & Surfaces", padding: "md" },
            children: ["cardsCol"]
        },
        cardsCol: {
            type: "View",
            props: { direction: "column", gap: "sm" },
            children: ["cardLow", "cardHigh", "cardColored", "dividerExample"]
        },
        cardLow: {
            type: "Card",
            props: { surface: "low", elevation: "low", padding: "md" },
            children: ["cardLowText"]
        },
        cardLowText: {
            type: "Text",
            props: { text: "Card — low surface, low elevation" },
            children: []
        },
        cardHigh: {
            type: "Card",
            props: { surface: "high", elevation: "medium", padding: "md" },
            children: ["cardHighText"]
        },
        cardHighText: {
            type: "Text",
            props: { text: "Card — high surface, medium elevation" },
            children: []
        },
        cardColored: {
            type: "Card",
            props: { color: "primaryContainer", padding: "md" },
            children: ["cardColoredText"]
        },
        cardColoredText: {
            type: "Text",
            props: { text: "Card — primaryContainer color", color: "onPrimaryContainer" },
            children: []
        },
        dividerExample: { type: "Divider", props: { spacing: "sm" }, children: [] },

        // -- Progress Bars --

        sectionProgress: {
            type: "ItemGroup",
            props: { title: "Progress Bars", padding: "md" },
            children: ["progressCol"]
        },
        progressCol: {
            type: "View",
            props: { direction: "column", gap: "md" },
            children: ["progress25", "progress60", "progress100"]
        },
        progress25: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["progress25Label", "progress25Bar"]
        },
        progress25Label: {
            type: "Text",
            props: { text: "25% — primary", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress25Bar: { type: "ProgressBar", props: { value: 0.25 }, children: [] },
        progress60: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["progress60Label", "progress60Bar"]
        },
        progress60Label: {
            type: "Text",
            props: { text: "60% — tertiary", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress60Bar: { type: "ProgressBar", props: { value: 0.6, color: "tertiary" }, children: [] },
        progress100: {
            type: "View",
            props: { direction: "column", gap: "xs" },
            children: ["progress100Label", "progress100Bar"]
        },
        progress100Label: {
            type: "Text",
            props: { text: "100% — tertiary, tall", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress100Bar: { type: "ProgressBar", props: { value: 1, color: "tertiary", height: 10 }, children: [] },

        // -- Spinner --

        sectionSpinner: {
            type: "ItemGroup",
            props: { title: "Spinner", padding: "md" },
            children: ["spinnerRow"]
        },
        spinnerRow: {
            type: "View",
            props: { direction: "row", gap: "lg", alignItems: "center", justifyContent: "center" },
            children: ["spinnerSmall", "spinnerLarge"]
        },
        spinnerSmall: { type: "Spinner", props: { size: "small" }, children: [] },
        spinnerLarge: { type: "Spinner", props: { size: "large" }, children: [] }
    }
};

/**
 * Renders a scrollable showcase of every widget from the catalog.
 * Each component is displayed with representative props and variants.
 */
export function ComponentsShowcaseView() {
    return (
        <View style={styles.container}>
            <JSONUIProvider registry={fragmentsRegistry}>
                <Renderer spec={showcaseSpec} registry={fragmentsRegistry} includeStandard={false} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
