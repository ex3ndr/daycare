import { usePathname } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { showcasePagesMap } from "@/views/dev/showcase/_showcasePages";
import { ApartmentHuntingPage } from "@/views/dev/showcase/pages/ApartmentHuntingPage";
import { BugTrackerPage } from "@/views/dev/showcase/pages/BugTrackerPage";
import { ClientProjectsPage } from "@/views/dev/showcase/pages/ClientProjectsPage";
import { CompetitiveAnalysisPage } from "@/views/dev/showcase/pages/CompetitiveAnalysisPage";
import { ContentCalendarPage } from "@/views/dev/showcase/pages/ContentCalendarPage";
import { CourseCurriculumPage } from "@/views/dev/showcase/pages/CourseCurriculumPage";
import { EventPlanningPage } from "@/views/dev/showcase/pages/EventPlanningPage";
import { ExpenseReportPage } from "@/views/dev/showcase/pages/ExpenseReportPage";
import { FeatureRequestsPage } from "@/views/dev/showcase/pages/FeatureRequestsPage";
import { GymWorkoutPage } from "@/views/dev/showcase/pages/GymWorkoutPage";
import { HabitTrackerPage } from "@/views/dev/showcase/pages/HabitTrackerPage";
import { HomeMaintenancePage } from "@/views/dev/showcase/pages/HomeMaintenancePage";
import { InventoryManagementPage } from "@/views/dev/showcase/pages/InventoryManagementPage";
import { InvoiceTrackerPage } from "@/views/dev/showcase/pages/InvoiceTrackerPage";
import { JobApplicationsPage } from "@/views/dev/showcase/pages/JobApplicationsPage";
import { KnowledgeBasePage } from "@/views/dev/showcase/pages/KnowledgeBasePage";
import { MeetingNotesPage } from "@/views/dev/showcase/pages/MeetingNotesPage";
import { OkrTrackerPage } from "@/views/dev/showcase/pages/OkrTrackerPage";
import { PersonalCrmPage } from "@/views/dev/showcase/pages/PersonalCrmPage";
import { PersonalFinancePage } from "@/views/dev/showcase/pages/PersonalFinancePage";
import { PodcastPlannerPage } from "@/views/dev/showcase/pages/PodcastPlannerPage";
import { ReadingListPage } from "@/views/dev/showcase/pages/ReadingListPage";
import { RecipeCollectionPage } from "@/views/dev/showcase/pages/RecipeCollectionPage";
import { RecruitmentPipelinePage } from "@/views/dev/showcase/pages/RecruitmentPipelinePage";
import { ResearchPapersPage } from "@/views/dev/showcase/pages/ResearchPapersPage";
import { SalesPipelinePage } from "@/views/dev/showcase/pages/SalesPipelinePage";
import { SprintBoardPage } from "@/views/dev/showcase/pages/SprintBoardPage";
import { StartupMetricsPage } from "@/views/dev/showcase/pages/StartupMetricsPage";
import { SupportTicketsPage } from "@/views/dev/showcase/pages/SupportTicketsPage";
import { TravelPlannerPage } from "@/views/dev/showcase/pages/TravelPlannerPage";

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
    "meeting-notes": MeetingNotesPage,
    "feature-requests": FeatureRequestsPage,
    "personal-finance": PersonalFinancePage,
    "gym-workout": GymWorkoutPage,
    "sales-pipeline": SalesPipelinePage,
    "recipe-collection": RecipeCollectionPage,
    "okr-tracker": OkrTrackerPage,
    "support-tickets": SupportTicketsPage,
    "travel-planner": TravelPlannerPage,
    "apartment-hunting": ApartmentHuntingPage,
    "competitive-analysis": CompetitiveAnalysisPage,
    "podcast-planner": PodcastPlannerPage,
    "inventory-management": InventoryManagementPage,
    "research-papers": ResearchPapersPage,
    "home-maintenance": HomeMaintenancePage,
    "course-curriculum": CourseCurriculumPage,
    "startup-metrics": StartupMetricsPage,
    "event-planning": EventPlanningPage,
    "job-applications": JobApplicationsPage,
    "client-projects": ClientProjectsPage,
    "knowledge-base": KnowledgeBasePage
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
