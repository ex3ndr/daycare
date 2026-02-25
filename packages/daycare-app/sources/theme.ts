import { Platform } from "react-native";
import sourceTheme from "./themes/bg_2.json";

// Determine if this is a mobile layout (Android or iPhone) vs desktop (iPad or Web)
// Mobile: Android OR (iOS AND NOT iPad)
// Desktop: iPad OR Web
const isMobileLayout = Platform.OS === "android" || (Platform.OS === "ios" && !Platform.isPad);

const common = {
    layout: {
        maxWidth: 1100,
        isMobileLayout
    }
};

// Material Design 3 elevation levels for light theme
// Usage: boxShadow: theme.elevation.level1
// level0: No shadow
// level1: Subtle shadow for cards and containers
// level2: Medium shadow for raised buttons and FABs
// level3: Higher shadow for floating elements
// level4: Strong shadow for dialogs and sheets
// level5: Maximum shadow for modals and menus
const lightElevation = {
    level0: "none",
    level1: `0px 1px 2px ${sourceTheme.light.shadow}1A, 0px 1px 3px ${sourceTheme.light.shadow}26`,
    level2: `0px 1px 5px ${sourceTheme.light.shadow}1A, 0px 2px 4px ${sourceTheme.light.shadow}26`,
    level3: `0px 4px 8px ${sourceTheme.light.shadow}1A, 0px 1px 3px ${sourceTheme.light.shadow}26`,
    level4: `0px 6px 10px ${sourceTheme.light.shadow}1A, 0px 1px 18px ${sourceTheme.light.shadow}26`,
    level5: `0px 8px 12px ${sourceTheme.light.shadow}1A, 0px 4px 16px ${sourceTheme.light.shadow}26`
};

// Material Design 3 elevation levels for dark theme
const darkElevation = {
    level0: "none",
    level1: `0px 1px 2px ${sourceTheme.dark.shadow}33, 0px 1px 3px ${sourceTheme.dark.shadow}4D`,
    level2: `0px 1px 5px ${sourceTheme.dark.shadow}33, 0px 2px 4px ${sourceTheme.dark.shadow}4D`,
    level3: `0px 4px 8px ${sourceTheme.dark.shadow}33, 0px 1px 3px ${sourceTheme.dark.shadow}4D`,
    level4: `0px 6px 10px ${sourceTheme.dark.shadow}33, 0px 1px 18px ${sourceTheme.dark.shadow}4D`,
    level5: `0px 8px 12px ${sourceTheme.dark.shadow}33, 0px 4px 16px ${sourceTheme.dark.shadow}4D`
};

export const lightTheme = {
    ...common,
    dark: false,
    colors: sourceTheme.light,
    elevation: lightElevation
};

export const darkTheme = {
    ...common,
    dark: true,
    colors: sourceTheme.dark,
    elevation: darkElevation
} satisfies typeof lightTheme;

export type Theme = typeof lightTheme;
