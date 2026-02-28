import { Octicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

type StepStatus = "done" | "running" | "pending" | "failed";

const stepColors: Record<StepStatus, string> = {
    done: "#1565c0",
    running: "#4caf50",
    pending: "#37474f",
    failed: "#ef5350"
};

const stepIcons: Record<StepStatus, React.ComponentProps<typeof Octicons>["name"]> = {
    done: "check-circle-fill",
    running: "dot-fill",
    pending: "circle",
    failed: "x-circle-fill"
};

type Step = { name: string; status: StepStatus };

function WorkflowSteps({ steps }: { steps: Step[] }) {
    const { theme } = useUnistyles();
    return (
        <View style={stepStyles.container}>
            {steps.map((step, i) => (
                <View key={step.name} style={stepStyles.stepRow}>
                    <View style={stepStyles.iconCol}>
                        <Octicons name={stepIcons[step.status]} size={14} color={stepColors[step.status]} />
                        {i < steps.length - 1 && (
                            <View style={[stepStyles.line, { backgroundColor: theme.colors.outlineVariant }]} />
                        )}
                    </View>
                    <Text
                        style={[
                            stepStyles.stepName,
                            {
                                color:
                                    step.status === "pending"
                                        ? theme.colors.onSurfaceVariant
                                        : theme.colors.onSurface
                            }
                        ]}
                    >
                        {step.name}
                    </Text>
                </View>
            ))}
        </View>
    );
}

const stepStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 12
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10
    },
    iconCol: {
        alignItems: "center",
        width: 14
    },
    line: {
        width: 1.5,
        height: 14,
        marginVertical: 2
    },
    stepName: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular",
        lineHeight: 18
    }
});

const workflows = [
    {
        name: "Deploy to Production",
        trigger: "On push to main",
        status: "running" as const,
        lastRun: "2m ago",
        steps: [
            { name: "Checkout code", status: "done" as StepStatus },
            { name: "Install dependencies", status: "done" as StepStatus },
            { name: "Run tests", status: "done" as StepStatus },
            { name: "Build artifacts", status: "running" as StepStatus },
            { name: "Deploy to Vercel", status: "pending" as StepStatus },
            { name: "Notify Slack", status: "pending" as StepStatus }
        ]
    },
    {
        name: "Nightly Agent Health Check",
        trigger: "Cron · 0 3 * * *",
        status: "done" as const,
        lastRun: "5h ago",
        steps: [
            { name: "Ping all agents", status: "done" as StepStatus },
            { name: "Collect metrics", status: "done" as StepStatus },
            { name: "Generate report", status: "done" as StepStatus },
            { name: "Send digest email", status: "done" as StepStatus }
        ]
    },
    {
        name: "Onboard New User",
        trigger: "On user.created event",
        status: "failed" as const,
        lastRun: "1h ago",
        steps: [
            { name: "Create workspace", status: "done" as StepStatus },
            { name: "Provision agents", status: "done" as StepStatus },
            { name: "Send welcome email", status: "failed" as StepStatus },
            { name: "Assign default permissions", status: "pending" as StepStatus }
        ]
    }
];

const completedWorkflows = [
    {
        name: "Weekly Cost Report",
        trigger: "Cron · 0 8 * * 1",
        status: "done" as const,
        lastRun: "2d ago",
        steps: [
            { name: "Aggregate costs", status: "done" as StepStatus },
            { name: "Generate charts", status: "done" as StepStatus },
            { name: "Email to team", status: "done" as StepStatus }
        ]
    },
    {
        name: "PR Review Pipeline",
        trigger: "On pull_request.opened",
        status: "done" as const,
        lastRun: "3d ago",
        steps: [
            { name: "Lint & typecheck", status: "done" as StepStatus },
            { name: "Run tests", status: "done" as StepStatus },
            { name: "AI code review", status: "done" as StepStatus },
            { name: "Post summary comment", status: "done" as StepStatus }
        ]
    }
];

function WorkflowStatus({ status }: { status: "running" | "done" | "failed" }) {
    const labels: Record<string, string> = { running: "Running", done: "Done", failed: "Failed" };
    const colors: Record<string, string> = { running: "#4caf50", done: "#1565c0", failed: "#ef5350" };
    return (
        <View style={wfStyles.badge}>
            <View style={[wfStyles.badgeDot, { backgroundColor: colors[status] }]} />
            <Text style={[wfStyles.badgeText, { color: colors[status] }]}>{labels[status]}</Text>
        </View>
    );
}

const wfStyles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    badgeText: {
        fontSize: 13,
        fontFamily: "IBMPlexSans-Regular"
    }
});

export function WorkflowsView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Recent">
                {workflows.map((wf) => (
                    <View key={wf.name}>
                        <Item
                            title={wf.name}
                            subtitle={`${wf.trigger} · ${wf.lastRun}`}
                            rightElement={<WorkflowStatus status={wf.status} />}
                            showChevron={false}
                            showDivider={false}
                        />
                        <WorkflowSteps steps={wf.steps} />
                    </View>
                ))}
            </ItemGroup>
            <ItemGroup title="Completed">
                {completedWorkflows.map((wf) => (
                    <View key={wf.name}>
                        <Item
                            title={wf.name}
                            subtitle={`${wf.trigger} · ${wf.lastRun}`}
                            rightElement={<WorkflowStatus status={wf.status} />}
                            showChevron={false}
                            showDivider={false}
                        />
                        <WorkflowSteps steps={wf.steps} />
                    </View>
                ))}
            </ItemGroup>
        </ItemListStatic>
    );
}
