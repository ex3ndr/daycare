import { usePathname } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { ExamplesView } from "@/views/dev/ExamplesView";
import { LottieShowcaseView } from "@/views/dev/LottieShowcaseView";
import { showcasePagesMap } from "@/views/dev/showcase/_showcasePages";
import { ShowcaseListView } from "@/views/dev/showcase/ShowcaseListView";
import { ShowcasePageView } from "@/views/dev/showcase/ShowcasePageView";
import { WidgetsShowcaseView } from "@/views/dev/WidgetsShowcaseView";

type DevPage = "widgets" | "examples" | "showcase" | "lottie";

const pageTitles: Record<DevPage, string> = {
    widgets: "Widgets",
    examples: "Examples",
    showcase: "Showcase",
    lottie: "Lottie"
};

const pageComponents: Record<DevPage, React.ComponentType> = {
    widgets: WidgetsShowcaseView,
    examples: ExamplesView,
    showcase: ShowcaseListView,
    lottie: LottieShowcaseView
};

/**
 * Dev screen that routes sub-pages based on pathname.
 * /dev → widgets (default), /dev/widgets, /dev/examples, /dev/showcase, /dev/<showcase-id>.
 */
export function DevView() {
    const pathname = usePathname();
    const segment = pathname.split("/").filter(Boolean)[1] as string | undefined;

    // Check if it's an individual showcase page
    const showcasePage = segment ? showcasePagesMap.get(segment) : undefined;
    if (showcasePage) {
        return (
            <View style={styles.container}>
                <PageHeader title={showcasePage.title} icon="beaker" />
                <ShowcasePageView />
            </View>
        );
    }

    // Standard dev pages
    const page = segment && segment in pageComponents ? (segment as DevPage) : "widgets";
    const PageComponent = pageComponents[page];

    return (
        <View style={styles.container}>
            <PageHeader title={pageTitles[page]} icon="beaker" />
            <PageComponent />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});
