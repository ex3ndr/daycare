import { usePathname } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { ComponentsShowcaseView } from "@/views/dev/ComponentsShowcaseView";
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
    const page = segment && segment in pageComponents ? (segment as DevPage) : "components";
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
