import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { widgetsRegistry } from "@/widgets/widgetsComponents";

/**
 * Static spec that exercises every widget component with representative props.
 * No actions are wired — this is a visual showcase only.
 */
const showcaseSpec: Spec = {
    root: "root",
    elements: {
        root: {
            type: "ScrollArea",
            props: {},
            children: ["main"]
        },
        main: {
            type: "Column",
            props: { gap: "lg" },
            children: [
                "sectionTypography",
                "sectionIcons",
                "sectionButtons",
                "sectionIconButtons",
                "sectionInputs",
                "sectionToggles",
                "sectionBadges",
                "sectionListItems",
                "sectionAvatars",
                "sectionBanners",
                "sectionCards",
                "sectionProgress",
                "sectionChips",
                "sectionMetrics",
                "sectionEmpty",
                "sectionSpinner"
            ]
        },

        // -- Typography --

        sectionTypography: {
            type: "Section",
            props: { title: "Typography", padding: "md" },
            children: ["typoCol"]
        },
        typoCol: {
            type: "Column",
            props: { gap: "sm" },
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
            type: "Section",
            props: { title: "Icons", padding: "md" },
            children: ["iconSetsCol"]
        },
        iconSetsCol: {
            type: "Column",
            props: { gap: "md" },
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
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelIonicons", "iconIoniconsRow"]
        },
        iconLabelIonicons: {
            type: "Text",
            props: { text: "Ionicons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconIoniconsRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icIon1", "icIon2", "icIon3", "icIon4", "icIon5"]
        },
        icIon1: { type: "Icon", props: { name: "home", set: "Ionicons" }, children: [] },
        icIon2: { type: "Icon", props: { name: "heart", set: "Ionicons", color: "error" }, children: [] },
        icIon3: { type: "Icon", props: { name: "settings-outline", set: "Ionicons" }, children: [] },
        icIon4: { type: "Icon", props: { name: "search", set: "Ionicons" }, children: [] },
        icIon5: { type: "Icon", props: { name: "star", set: "Ionicons", color: "primary" }, children: [] },

        iconRowMaterial: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelMaterial", "iconMaterialRow"]
        },
        iconLabelMaterial: {
            type: "Text",
            props: { text: "MaterialIcons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconMaterialRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icMat1", "icMat2", "icMat3", "icMat4", "icMat5"]
        },
        icMat1: { type: "Icon", props: { name: "dashboard", set: "MaterialIcons" }, children: [] },
        icMat2: { type: "Icon", props: { name: "delete", set: "MaterialIcons", color: "error" }, children: [] },
        icMat3: { type: "Icon", props: { name: "email", set: "MaterialIcons" }, children: [] },
        icMat4: { type: "Icon", props: { name: "edit", set: "MaterialIcons" }, children: [] },
        icMat5: { type: "Icon", props: { name: "folder", set: "MaterialIcons", color: "primary" }, children: [] },

        iconRowMaterialCommunity: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelMaterialCommunity", "iconMaterialCommunityRow"]
        },
        iconLabelMaterialCommunity: {
            type: "Text",
            props: { text: "MaterialCommunityIcons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconMaterialCommunityRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
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
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelFeather", "iconFeatherRow"]
        },
        iconLabelFeather: {
            type: "Text",
            props: { text: "Feather", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconFeatherRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icFea1", "icFea2", "icFea3", "icFea4", "icFea5"]
        },
        icFea1: { type: "Icon", props: { name: "activity", set: "Feather" }, children: [] },
        icFea2: { type: "Icon", props: { name: "camera", set: "Feather" }, children: [] },
        icFea3: { type: "Icon", props: { name: "globe", set: "Feather", color: "primary" }, children: [] },
        icFea4: { type: "Icon", props: { name: "lock", set: "Feather" }, children: [] },
        icFea5: { type: "Icon", props: { name: "zap", set: "Feather", color: "tertiary" }, children: [] },

        iconRowFontAwesome: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelFontAwesome", "iconFontAwesomeRow"]
        },
        iconLabelFontAwesome: {
            type: "Text",
            props: { text: "FontAwesome", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconFontAwesomeRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icFa1", "icFa2", "icFa3", "icFa4", "icFa5"]
        },
        icFa1: { type: "Icon", props: { name: "rocket", set: "FontAwesome" }, children: [] },
        icFa2: { type: "Icon", props: { name: "flag", set: "FontAwesome", color: "error" }, children: [] },
        icFa3: { type: "Icon", props: { name: "trophy", set: "FontAwesome", color: "primary" }, children: [] },
        icFa4: { type: "Icon", props: { name: "users", set: "FontAwesome" }, children: [] },
        icFa5: { type: "Icon", props: { name: "bolt", set: "FontAwesome" }, children: [] },

        iconRowOcticons: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelOcticons", "iconOcticonsRow"]
        },
        iconLabelOcticons: {
            type: "Text",
            props: { text: "Octicons", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconOcticonsRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icOct1", "icOct2", "icOct3", "icOct4", "icOct5"]
        },
        icOct1: { type: "Icon", props: { name: "repo", set: "Octicons" }, children: [] },
        icOct2: { type: "Icon", props: { name: "git-branch", set: "Octicons", color: "primary" }, children: [] },
        icOct3: { type: "Icon", props: { name: "issue-opened", set: "Octicons", color: "tertiary" }, children: [] },
        icOct4: { type: "Icon", props: { name: "star", set: "Octicons" }, children: [] },
        icOct5: { type: "Icon", props: { name: "code", set: "Octicons" }, children: [] },

        iconRowAntDesign: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelAntDesign", "iconAntDesignRow"]
        },
        iconLabelAntDesign: {
            type: "Text",
            props: { text: "AntDesign", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconAntDesignRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icAnt1", "icAnt2", "icAnt3", "icAnt4", "icAnt5"]
        },
        icAnt1: { type: "Icon", props: { name: "home", set: "AntDesign" }, children: [] },
        icAnt2: { type: "Icon", props: { name: "setting", set: "AntDesign" }, children: [] },
        icAnt3: { type: "Icon", props: { name: "heart", set: "AntDesign", color: "primary" }, children: [] },
        icAnt4: { type: "Icon", props: { name: "notification", set: "AntDesign" }, children: [] },
        icAnt5: { type: "Icon", props: { name: "Safety", set: "AntDesign", color: "tertiary" }, children: [] },

        iconRowEntypo: {
            type: "Column",
            props: { gap: "xs" },
            children: ["iconLabelEntypo", "iconEntypoRow"]
        },
        iconLabelEntypo: {
            type: "Text",
            props: { text: "Entypo", size: "sm", weight: "semibold", color: "onSurfaceVariant" },
            children: []
        },
        iconEntypoRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center", wrap: true },
            children: ["icEnt1", "icEnt2", "icEnt3", "icEnt4", "icEnt5"]
        },
        icEnt1: { type: "Icon", props: { name: "air", set: "Entypo" }, children: [] },
        icEnt2: { type: "Icon", props: { name: "emoji-happy", set: "Entypo", color: "primary" }, children: [] },
        icEnt3: { type: "Icon", props: { name: "flash", set: "Entypo", color: "tertiary" }, children: [] },
        icEnt4: { type: "Icon", props: { name: "map", set: "Entypo" }, children: [] },
        icEnt5: { type: "Icon", props: { name: "palette", set: "Entypo" }, children: [] },

        // -- Buttons --

        sectionButtons: {
            type: "Section",
            props: { title: "Buttons", padding: "md" },
            children: ["btnCol"]
        },
        btnCol: {
            type: "Column",
            props: { gap: "sm" },
            children: ["btnRow1", "btnRow2"]
        },
        btnRow1: {
            type: "Row",
            props: { gap: "sm", wrap: true },
            children: ["btnFilled", "btnTonal", "btnOutlined", "btnText"]
        },
        btnFilled: { type: "Button", props: { label: "Filled", variant: "filled" }, children: [] },
        btnTonal: { type: "Button", props: { label: "Tonal", variant: "tonal" }, children: [] },
        btnOutlined: { type: "Button", props: { label: "Outlined", variant: "outlined" }, children: [] },
        btnText: { type: "Button", props: { label: "Text", variant: "text" }, children: [] },
        btnRow2: {
            type: "Row",
            props: { gap: "sm", wrap: true },
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
            type: "Section",
            props: { title: "Icon Buttons", padding: "md" },
            children: ["iconBtnRow"]
        },
        iconBtnRow: {
            type: "Row",
            props: { gap: "sm", alignItems: "center" },
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
            type: "Section",
            props: { title: "Text Inputs", padding: "md" },
            children: ["inputCol"]
        },
        inputCol: {
            type: "Column",
            props: { gap: "sm" },
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
            type: "Section",
            props: { title: "Toggles", padding: "md" },
            children: ["toggleCol"]
        },
        toggleCol: {
            type: "Column",
            props: { gap: "md" },
            children: ["switchOn", "switchOff", "checkOn", "checkOff"]
        },
        switchOn: { type: "Switch", props: { label: "Notifications", checked: true }, children: [] },
        switchOff: { type: "Switch", props: { label: "Dark mode", checked: false }, children: [] },
        checkOn: { type: "Checkbox", props: { label: "Accept terms", checked: true }, children: [] },
        checkOff: { type: "Checkbox", props: { label: "Subscribe to newsletter", checked: false }, children: [] },

        // -- Badges --

        sectionBadges: {
            type: "Section",
            props: { title: "Badges", padding: "md" },
            children: ["badgeRow"]
        },
        badgeRow: {
            type: "Row",
            props: { gap: "sm", wrap: true },
            children: ["badgeDefault", "badgePrimary", "badgeSecondary", "badgeError"]
        },
        badgeDefault: { type: "Badge", props: { label: "Default", variant: "default" }, children: [] },
        badgePrimary: { type: "Badge", props: { label: "Primary", variant: "primary" }, children: [] },
        badgeSecondary: { type: "Badge", props: { label: "Secondary", variant: "secondary" }, children: [] },
        badgeError: { type: "Badge", props: { label: "Error", variant: "error" }, children: [] },

        // -- List Items --

        sectionListItems: {
            type: "Section",
            props: { title: "List Items" },
            children: ["listItem1", "listItem2", "listItem3"]
        },
        listItem1: {
            type: "ListItem",
            props: { title: "Wi-Fi", subtitle: "Connected", showChevron: true, showDivider: true },
            children: []
        },
        listItem2: {
            type: "ListItem",
            props: { title: "Bluetooth", subtitle: "Off", showChevron: true, showDivider: true },
            children: []
        },
        listItem3: {
            type: "ListItem",
            props: { title: "Airplane Mode", showChevron: false, showDivider: false },
            children: []
        },

        // -- Avatars --

        sectionAvatars: {
            type: "Section",
            props: { title: "Avatars", padding: "md" },
            children: ["avatarRow"]
        },
        avatarRow: {
            type: "Row",
            props: { gap: "md", alignItems: "center" },
            children: ["avatarSm", "avatarMd", "avatarLg"]
        },
        avatarSm: { type: "Avatar", props: { initials: "SM", size: "sm" }, children: [] },
        avatarMd: { type: "Avatar", props: { initials: "MD", size: "md" }, children: [] },
        avatarLg: { type: "Avatar", props: { initials: "LG", size: "lg" }, children: [] },

        // -- Banners --

        sectionBanners: {
            type: "Section",
            props: { title: "Banners", padding: "md" },
            children: ["bannerCol"]
        },
        bannerCol: {
            type: "Column",
            props: { gap: "sm" },
            children: ["bannerInfo", "bannerSuccess", "bannerWarning", "bannerError"]
        },
        bannerInfo: { type: "Banner", props: { text: "Info: New update available", variant: "info" }, children: [] },
        bannerSuccess: {
            type: "Banner",
            props: { text: "Success: Changes saved", variant: "success" },
            children: []
        },
        bannerWarning: {
            type: "Banner",
            props: { text: "Warning: Low storage", variant: "warning" },
            children: []
        },
        bannerError: {
            type: "Banner",
            props: { text: "Error: Connection failed", variant: "error" },
            children: []
        },

        // -- Cards --

        sectionCards: {
            type: "Section",
            props: { title: "Cards & Surfaces", padding: "md" },
            children: ["cardsCol"]
        },
        cardsCol: {
            type: "Column",
            props: { gap: "sm" },
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
            type: "Section",
            props: { title: "Progress Bars", padding: "md" },
            children: ["progressCol"]
        },
        progressCol: {
            type: "Column",
            props: { gap: "md" },
            children: ["progress25", "progress60", "progress100"]
        },
        progress25: {
            type: "Column",
            props: { gap: "xs" },
            children: ["progress25Label", "progress25Bar"]
        },
        progress25Label: {
            type: "Text",
            props: { text: "25% — primary", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress25Bar: { type: "ProgressBar", props: { value: 0.25 }, children: [] },
        progress60: {
            type: "Column",
            props: { gap: "xs" },
            children: ["progress60Label", "progress60Bar"]
        },
        progress60Label: {
            type: "Text",
            props: { text: "60% — tertiary", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress60Bar: { type: "ProgressBar", props: { value: 0.6, color: "tertiary" }, children: [] },
        progress100: {
            type: "Column",
            props: { gap: "xs" },
            children: ["progress100Label", "progress100Bar"]
        },
        progress100Label: {
            type: "Text",
            props: { text: "100% — tertiary, tall", size: "sm", color: "onSurfaceVariant" },
            children: []
        },
        progress100Bar: { type: "ProgressBar", props: { value: 1, color: "tertiary", height: 10 }, children: [] },

        // -- Chips --

        sectionChips: {
            type: "Section",
            props: { title: "Chips", padding: "md" },
            children: ["chipsRow"]
        },
        chipsRow: {
            type: "Row",
            props: { gap: "sm", wrap: true },
            children: ["chipTonal", "chipFilled", "chipOutlined", "chipIcon"]
        },
        chipTonal: { type: "Chip", props: { label: "Tonal" }, children: [] },
        chipFilled: { type: "Chip", props: { label: "Filled", variant: "filled" }, children: [] },
        chipOutlined: { type: "Chip", props: { label: "Outlined", variant: "outlined" }, children: [] },
        chipIcon: {
            type: "Chip",
            props: { label: "12", icon: "flame", iconSet: "Octicons", variant: "tonal" },
            children: []
        },

        // -- Metrics --

        sectionMetrics: {
            type: "Section",
            props: { title: "Metrics", padding: "md" },
            children: ["metricsRow"]
        },
        metricsRow: {
            type: "Row",
            props: { gap: "lg" },
            children: ["metricSm", "metricMd", "metricLg"]
        },
        metricSm: { type: "Metric", props: { value: "$2.6K", label: "Ad Spend", size: "sm" }, children: [] },
        metricMd: { type: "Metric", props: { value: "4.9x", label: "ROAS", size: "md" }, children: [] },
        metricLg: {
            type: "Metric",
            props: { value: "$12,840", label: "Revenue", size: "lg", color: "primary" },
            children: []
        },

        // -- Empty State --

        sectionEmpty: {
            type: "Section",
            props: { title: "Empty State", padding: "md" },
            children: ["emptyDemo"]
        },
        emptyDemo: {
            type: "EmptyState",
            props: { title: "No items yet", subtitle: "Create one to get started", icon: "file-tray-outline" },
            children: []
        },

        // -- Spinner --

        sectionSpinner: {
            type: "Section",
            props: { title: "Spinner", padding: "md" },
            children: ["spinnerRow"]
        },
        spinnerRow: {
            type: "Row",
            props: { gap: "lg", alignItems: "center", justifyContent: "center" },
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
export function WidgetsShowcaseView() {
    return (
        <View style={styles.container}>
            <JSONUIProvider registry={widgetsRegistry}>
                <Renderer spec={showcaseSpec} registry={widgetsRegistry} includeStandard={false} />
            </JSONUIProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
