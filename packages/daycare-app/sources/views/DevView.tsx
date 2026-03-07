import { usePathname } from "expo-router";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { ComponentsShowcaseView } from "@/views/dev/ComponentsShowcaseView";
import { DevTreePanel } from "@/views/dev/DevTreePanel";
import { devPathSegmentResolve } from "@/views/dev/devPathSegmentResolve";
import { ExamplesView } from "@/views/dev/ExamplesView";
import { LottieShowcaseView } from "@/views/dev/LottieShowcaseView";
import { MontyDevView } from "@/views/dev/MontyDevView";
import { showcasePagesMap } from "@/views/dev/showcase/_showcasePages";
import { ShowcaseListView } from "@/views/dev/showcase/ShowcaseListView";
import { ShowcasePageView } from "@/views/dev/showcase/ShowcasePageView";

type DevPage = "components" | "examples" | "showcase" | "lottie" | "monty";

const pageTitles: Record<DevPage, string> = {
    components: "Components",
    examples: "Examples",
    showcase: "Showcase",
    lottie: "Lottie",
    monty: "Monty"
};

const pageComponents: Record<DevPage, React.ComponentType> = {
    components: ComponentsShowcaseView,
    examples: ExamplesView,
    showcase: ShowcaseListView,
    lottie: LottieShowcaseView,
    monty: MontyDevView
};

/**
 * Dev screen that routes sub-pages based on pathname.
 * /dev → components (default), /dev/components, /dev/examples, /dev/showcase, /dev/lottie, /dev/monty, /dev/<showcase-id>.
 */
export function DevView() {
    const pathname = usePathname();
    const { theme } = useUnistyles();
    const segment = devPathSegmentResolve(pathname);

    // Check if it's an individual showcase page
    const showcasePage = segment ? showcasePagesMap.get(segment) : undefined;
    if (showcasePage) {
        return (
            <View style={styles.container}>
                <View
                    style={{
                        width: 280,
                        borderRightWidth: 1,
                        borderRightColor: theme.colors.outlineVariant,
                        backgroundColor: theme.colors.surface
                    }}
                >
                    <DevTreePanel />
                </View>
                <View style={styles.content}>
                    <PageHeader title={showcasePage.title} icon="beaker" />
                    <ShowcasePageView />
                </View>
            </View>
        );
    }

    // Standard dev pages
    const page = segment && segment in pageComponents ? (segment as DevPage) : "components";
    const PageComponent = pageComponents[page];

    return (
        <View style={styles.container}>
            <View
                style={{
                    width: 280,
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surface
                }}
            >
                <DevTreePanel />
            </View>
            <View style={styles.content}>
                <PageHeader title={pageTitles[page]} icon="beaker" />
                <PageComponent />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: "row"
    },
    content: {
        flex: 1
    }
});
