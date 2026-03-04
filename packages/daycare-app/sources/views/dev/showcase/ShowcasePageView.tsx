import { usePathname } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { showcasePagesMap } from "@/views/dev/showcase/_showcasePages";
import { BugTrackerPage } from "@/views/dev/showcase/pages/BugTrackerPage";
import { ContentCalendarPage } from "@/views/dev/showcase/pages/ContentCalendarPage";
import { ExpenseReportPage } from "@/views/dev/showcase/pages/ExpenseReportPage";
import { HabitTrackerPage } from "@/views/dev/showcase/pages/HabitTrackerPage";
import { InvoiceTrackerPage } from "@/views/dev/showcase/pages/InvoiceTrackerPage";
import { MeetingNotesPage } from "@/views/dev/showcase/pages/MeetingNotesPage";
import { PersonalCrmPage } from "@/views/dev/showcase/pages/PersonalCrmPage";
import { ReadingListPage } from "@/views/dev/showcase/pages/ReadingListPage";
import { RecruitmentPipelinePage } from "@/views/dev/showcase/pages/RecruitmentPipelinePage";
import { SprintBoardPage } from "@/views/dev/showcase/pages/SprintBoardPage";

/** Maps showcase page IDs to their React component implementations. */
const showcaseComponents: Record<string, React.ComponentType> = {
    "invoice-tracker": InvoiceTrackerPage,
    "habit-tracker": HabitTrackerPage,
    "recruitment-pipeline": RecruitmentPipelinePage,
    "personal-crm": PersonalCrmPage,
    "sprint-board": SprintBoardPage,
    "reading-list": ReadingListPage,
    "expense-report": ExpenseReportPage,
    "content-calendar": ContentCalendarPage,
    "bug-tracker": BugTrackerPage,
    "meeting-notes": MeetingNotesPage
};

/**
 * Renders a showcase page component if available, otherwise shows a placeholder.
 * Resolves the page from the pathname segment and looks up its component.
 */
export function ShowcasePageView() {
    const { theme } = useUnistyles();
    const pathname = usePathname();
    const segment = pathname.split("/").filter(Boolean)[1];
    const page = segment ? showcasePagesMap.get(segment) : undefined;
    const title = page?.title ?? "Showcase";
    const PageComponent = segment ? showcaseComponents[segment] : undefined;

    if (PageComponent) {
        return (
            <View style={styles.container}>
                <PageComponent />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    This page is not yet implemented.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 8
    },
    title: {
        fontSize: 20,
        fontWeight: "600"
    },
    subtitle: {
        fontSize: 14
    }
});
