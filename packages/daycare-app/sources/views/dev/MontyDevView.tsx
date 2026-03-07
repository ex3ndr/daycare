import { JSONUIProvider, Renderer, type Spec } from "@json-render/react-native";
import * as React from "react";
import { Text, View } from "react-native";
import {
    loadMonty,
    Monty,
    MontyRuntimeError,
    montyExpoNativeRuntimeLinked,
    montyExpoVersion
} from "react-native-monty";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemList } from "@/components/ItemList";
import { FragmentBusyIndicator } from "@/fragments/FragmentBusyIndicator";
import { fragmentsRegistry } from "@/fragments/registry";
import { useFragmentPython } from "@/fragments/useFragmentPython";
import { useAuthStore } from "@/modules/auth/authContext";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";
import { type MontyDevFixtures, montyDevFixturesEnsure } from "./montyDevFixturesEnsure";

const counterExampleSpec: Spec & { code: string } = {
    root: "root",
    state: {
        count: 0
    },
    code: [
        "def init():",
        '    apply({"count": 2})',
        "",
        "def increment(params):",
        '    apply(lambda state: {"count": state.get("count", 0) + params.get("delta", 1)})',
        "",
        "def decrement(params):",
        '    apply(lambda state: {"count": state.get("count", 0) - params.get("delta", 1)})',
        "",
        "def reset(params):",
        '    apply({"count": params.get("value", 0)})'
    ].join("\n"),
    elements: {
        root: {
            type: "View",
            props: { direction: "column", gap: "md", padding: "md" },
            children: ["title", "value", "buttons"]
        },
        title: {
            type: "Text",
            props: {
                text: "Counter from init()",
                size: "sm",
                color: "onSurfaceVariant"
            },
            children: []
        },
        value: {
            type: "Heading",
            props: {
                text: { $template: `Count: \${/count}` },
                level: "h3"
            },
            children: []
        },
        buttons: {
            type: "View",
            props: { direction: "row", gap: "sm" },
            children: ["minus", "plus", "reset"]
        },
        minus: {
            type: "Button",
            props: { label: "-1", variant: "outlined", size: "sm" },
            on: {
                press: {
                    action: "decrement",
                    params: { delta: 1 }
                }
            },
            children: []
        },
        plus: {
            type: "Button",
            props: { label: "+1", variant: "filled", size: "sm" },
            on: {
                press: {
                    action: "increment",
                    params: { delta: 1 }
                }
            },
            children: []
        },
        reset: {
            type: "Button",
            props: { label: "Reset", variant: "text", size: "sm" },
            on: {
                press: {
                    action: "reset",
                    params: { value: 0 }
                }
            },
            children: []
        }
    }
};

const modeExampleSpec: Spec & { code: string } = {
    root: "root",
    state: {
        mode: "Focus",
        accent: "primary",
        message: "Heads down and ship."
    },
    code: [
        "def init():",
        '    apply({"mode": "Focus", "accent": "primary", "message": "Heads down and ship."})',
        "",
        "def choose_mode(params):",
        '    mode = params.get("mode", "Focus")',
        '    if mode == "Review":',
        '        apply({"mode": "Review", "accent": "tertiary", "message": "Slow down and inspect edge cases."})',
        "        return",
        '    if mode == "Ship":',
        '        apply({"mode": "Ship", "accent": "secondary", "message": "Everything ready. Push the release."})',
        "        return",
        '    apply({"mode": "Focus", "accent": "primary", "message": "Heads down and ship."})'
    ].join("\n"),
    elements: {
        root: {
            type: "View",
            props: { direction: "column", gap: "md", padding: "md" },
            children: ["title", "mode", "message", "buttons"]
        },
        title: {
            type: "Text",
            props: {
                text: "Mode switch with params",
                size: "sm",
                color: "onSurfaceVariant"
            },
            children: []
        },
        mode: {
            type: "Heading",
            props: {
                text: { $template: `Mode: \${/mode}` },
                level: "h3",
                color: { $state: "/accent" }
            },
            children: []
        },
        message: {
            type: "Text",
            props: {
                text: { $state: "/message" }
            },
            children: []
        },
        buttons: {
            type: "View",
            props: { direction: "row", gap: "sm", wrap: true },
            children: ["focus", "review", "ship"]
        },
        focus: {
            type: "Button",
            props: { label: "Focus", variant: "outlined", size: "sm" },
            on: {
                press: {
                    action: "choose_mode",
                    params: { mode: "Focus" }
                }
            },
            children: []
        },
        review: {
            type: "Button",
            props: { label: "Review", variant: "outlined", size: "sm" },
            on: {
                press: {
                    action: "choose_mode",
                    params: { mode: "Review" }
                }
            },
            children: []
        },
        ship: {
            type: "Button",
            props: { label: "Ship", variant: "filled", size: "sm" },
            on: {
                press: {
                    action: "choose_mode",
                    params: { mode: "Ship" }
                }
            },
            children: []
        }
    }
};

type ProbeResult =
    | {
          ok: true;
          output: unknown;
      }
    | {
          ok: false;
          error: string;
      };

type FragmentExample = {
    title: string;
    footer: string;
    spec: Spec & { code?: string };
};

type FixtureState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; fixture: MontyDevFixtures }
    | { status: "error"; error: string };

function montyFormatError(error: unknown): string {
    if (error instanceof MontyRuntimeError) {
        return error.display("type-msg");
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function montyFormatOutput(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function montyRunBasicProbe(): ProbeResult {
    try {
        const monty = new Monty("def add(a, b):\n    return a + b\n\nadd(x, y)", {
            scriptName: "basic-probe.py",
            inputs: ["x", "y"]
        });
        const output = monty.run({
            inputs: {
                x: 2,
                y: 5
            }
        });
        return {
            ok: true,
            output
        };
    } catch (error) {
        return {
            ok: false,
            error: montyFormatError(error)
        };
    }
}

function montyRunExternalFunctionProbe(): ProbeResult {
    try {
        const monty = new Monty("def run(value):\n    return multiply_and_add(value, 10)\n\nrun(input_value)", {
            scriptName: "external-probe.py",
            inputs: ["input_value"]
        });
        const output = monty.run({
            inputs: {
                input_value: 2
            },
            externalFunctions: {
                multiply_and_add: (value: unknown, factor: unknown) => Number(value) * Number(factor) + 7
            }
        });
        return {
            ok: true,
            output
        };
    } catch (error) {
        return {
            ok: false,
            error: montyFormatError(error)
        };
    }
}

function montyProbeSubtitle(result: ProbeResult | null): string {
    if (!result) {
        return "Pending";
    }
    if (!result.ok) {
        return result.error;
    }
    return montyFormatOutput(result.output);
}

function FragmentPythonExample(props: { spec: Spec & { code?: string } }) {
    const fragmentPython = useFragmentPython(props.spec);

    if (fragmentPython.status === "error") {
        return (
            <View style={{ padding: 16 }}>
                <Text>{fragmentPython.error}</Text>
            </View>
        );
    }

    return (
        <View style={{ paddingVertical: 4, position: "relative" }}>
            <JSONUIProvider
                registry={fragmentsRegistry}
                store={fragmentPython.store}
                handlers={fragmentPython.handlers}
            >
                <Renderer spec={props.spec} registry={fragmentsRegistry} includeStandard={false} />
            </JSONUIProvider>
            {fragmentPython.busy ? <FragmentBusyIndicator /> : null}
        </View>
    );
}

function montyDevServerExamplesCreate(databaseId: string): FragmentExample[] {
    return [
        {
            title: "Fragment Python: Server Query Init",
            footer: "Runs an async query during init() and renders top inventory rows returned by the backend.",
            spec: {
                root: "root",
                state: {
                    databaseId,
                    status: "Waiting for init()...",
                    line1: "Loading...",
                    line2: "Loading..."
                },
                code: [
                    "def describe_row(rows, index):",
                    "    if len(rows) <= index:",
                    '        return "No row"',
                    '    return rows[index]["label"] + " | stock " + str(rows[index]["stock"])',
                    "",
                    "def init():",
                    '    db_id = get_state().get("databaseId")',
                    '    rows = query_database(db_id, \'SELECT label, stock FROM "inventory" WHERE "valid_to" IS NULL ORDER BY stock DESC LIMIT 2\')',
                    '    apply({"status": "Fetched " + str(len(rows)) + " rows from server", "line1": describe_row(rows, 0), "line2": describe_row(rows, 1)})'
                ].join("\n"),
                elements: {
                    root: {
                        type: "View",
                        props: { direction: "column", gap: "sm", padding: "md" },
                        children: ["title", "status", "line1", "line2"]
                    },
                    title: {
                        type: "Text",
                        props: {
                            text: "Async init() -> query_database()",
                            size: "sm",
                            color: "onSurfaceVariant"
                        },
                        children: []
                    },
                    status: {
                        type: "Heading",
                        props: {
                            text: { $state: "/status" },
                            level: "h3"
                        },
                        children: []
                    },
                    line1: {
                        type: "Text",
                        props: {
                            text: { $state: "/line1" }
                        },
                        children: []
                    },
                    line2: {
                        type: "Text",
                        props: {
                            text: { $state: "/line2" }
                        },
                        children: []
                    }
                }
            }
        },
        {
            title: "Fragment Python: Server Query Filters",
            footer: "Exercises async actions that hit the server with different SQL filters and update multiple state keys.",
            spec: {
                root: "root",
                state: {
                    databaseId,
                    filter: "all",
                    summary: "Waiting for init()...",
                    line1: "Loading...",
                    line2: "Loading..."
                },
                code: [
                    "def describe_row(rows, index):",
                    "    if len(rows) <= index:",
                    '        return "No row"',
                    '    return rows[index]["label"] + " | stock " + str(rows[index]["stock"])',
                    "",
                    "def load_filter(params):",
                    '    mode = params.get("mode", "all")',
                    '    db_id = get_state().get("databaseId")',
                    '    sql = \'SELECT label, stock FROM "inventory" WHERE "valid_to" IS NULL ORDER BY label\'',
                    '    if mode == "featured":',
                    '        sql = \'SELECT label, stock FROM "inventory" WHERE "valid_to" IS NULL AND "featured" = TRUE ORDER BY label\'',
                    '    if mode == "fruit":',
                    '        sql = \'SELECT label, stock FROM "inventory" WHERE "valid_to" IS NULL AND "category" = $1 ORDER BY label\'',
                    '        rows = query_database(db_id, sql, ["fruit"])',
                    "    else:",
                    "        rows = query_database(db_id, sql)",
                    '    apply({"filter": mode, "summary": mode + " -> " + str(len(rows)) + " rows from server", "line1": describe_row(rows, 0), "line2": describe_row(rows, 1)})',
                    "",
                    "def init():",
                    '    load_filter({"mode": "all"})'
                ].join("\n"),
                elements: {
                    root: {
                        type: "View",
                        props: { direction: "column", gap: "md", padding: "md" },
                        children: ["title", "summary", "line1", "line2", "buttons"]
                    },
                    title: {
                        type: "Text",
                        props: {
                            text: "Action params -> filtered query",
                            size: "sm",
                            color: "onSurfaceVariant"
                        },
                        children: []
                    },
                    summary: {
                        type: "Heading",
                        props: {
                            text: { $template: `\${/summary}` },
                            level: "h3"
                        },
                        children: []
                    },
                    line1: {
                        type: "Text",
                        props: {
                            text: { $state: "/line1" }
                        },
                        children: []
                    },
                    line2: {
                        type: "Text",
                        props: {
                            text: { $state: "/line2" }
                        },
                        children: []
                    },
                    buttons: {
                        type: "View",
                        props: { direction: "row", gap: "sm", wrap: true },
                        children: ["all", "featured", "fruit"]
                    },
                    all: {
                        type: "Button",
                        props: { label: "All", variant: "outlined", size: "sm" },
                        on: {
                            press: {
                                action: "load_filter",
                                params: { mode: "all" }
                            }
                        },
                        children: []
                    },
                    featured: {
                        type: "Button",
                        props: { label: "Featured", variant: "outlined", size: "sm" },
                        on: {
                            press: {
                                action: "load_filter",
                                params: { mode: "featured" }
                            }
                        },
                        children: []
                    },
                    fruit: {
                        type: "Button",
                        props: { label: "Fruit", variant: "filled", size: "sm" },
                        on: {
                            press: {
                                action: "load_filter",
                                params: { mode: "fruit" }
                            }
                        },
                        children: []
                    }
                }
            }
        },
        {
            title: "Fragment Python: Server Query Summary",
            footer: "Runs an aggregate query from init() and on demand to confirm the fragment reads fresh backend state.",
            spec: {
                root: "root",
                state: {
                    databaseId,
                    totalItems: 0,
                    totalStock: 0,
                    status: "Waiting for refresh..."
                },
                code: [
                    "def refresh(params):",
                    '    db_id = get_state().get("databaseId")',
                    '    rows = query_database(db_id, \'SELECT COUNT(*) AS total_items, COALESCE(SUM(stock), 0) AS total_stock FROM "inventory" WHERE "valid_to" IS NULL\')',
                    "    row = rows[0] if len(rows) > 0 else {}",
                    '    apply({"totalItems": row.get("total_items", 0), "totalStock": row.get("total_stock", 0), "status": "Aggregate refreshed from server"})',
                    "",
                    "def init():",
                    "    refresh({})"
                ].join("\n"),
                elements: {
                    root: {
                        type: "View",
                        props: { direction: "column", gap: "md", padding: "md" },
                        children: ["title", "items", "stock", "status", "button"]
                    },
                    title: {
                        type: "Text",
                        props: {
                            text: "Aggregate query and refresh action",
                            size: "sm",
                            color: "onSurfaceVariant"
                        },
                        children: []
                    },
                    items: {
                        type: "Heading",
                        props: {
                            text: { $template: `Items: \${/totalItems}` },
                            level: "h3"
                        },
                        children: []
                    },
                    stock: {
                        type: "Text",
                        props: {
                            text: { $template: `Total stock: \${/totalStock}` }
                        },
                        children: []
                    },
                    status: {
                        type: "Text",
                        props: {
                            text: { $state: "/status" }
                        },
                        children: []
                    },
                    button: {
                        type: "Button",
                        props: { label: "Refresh Totals", variant: "filled", size: "sm" },
                        on: {
                            press: {
                                action: "refresh",
                                params: {}
                            }
                        },
                        children: []
                    }
                }
            }
        }
    ];
}

/**
 * Lightweight smoke-test page for react-native-monty integration.
 */
export function MontyDevView() {
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const { workspaceId } = useWorkspace();
    const [running, setRunning] = React.useState(false);
    const [runtimeStatus, setRuntimeStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
    const [runtimeError, setRuntimeError] = React.useState<string | null>(null);
    const [basicProbe, setBasicProbe] = React.useState<ProbeResult | null>(null);
    const [externalProbe, setExternalProbe] = React.useState<ProbeResult | null>(null);
    const [fixtureState, setFixtureState] = React.useState<FixtureState>({ status: "idle" });

    const runChecks = React.useCallback(async () => {
        if (running) {
            return;
        }

        setRunning(true);
        setRuntimeStatus("loading");
        setRuntimeError(null);
        setBasicProbe(null);
        setExternalProbe(null);

        try {
            await loadMonty();
            setRuntimeStatus("ready");
            setBasicProbe(montyRunBasicProbe());
            setExternalProbe(montyRunExternalFunctionProbe());
        } catch (error) {
            setRuntimeStatus("error");
            setRuntimeError(montyFormatError(error));
        } finally {
            setRunning(false);
        }
    }, [running]);

    React.useEffect(() => {
        void runChecks();
    }, [runChecks]);

    React.useEffect(() => {
        if (!baseUrl || !token) {
            setFixtureState({ status: "idle" });
            return;
        }

        let active = true;
        setFixtureState({ status: "loading" });

        void (async () => {
            try {
                const fixture = await montyDevFixturesEnsure({
                    baseUrl,
                    token,
                    workspaceId
                });
                if (active) {
                    setFixtureState({ status: "ready", fixture });
                }
            } catch (error) {
                if (active) {
                    setFixtureState({
                        status: "error",
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [workspaceId, baseUrl, token]);

    const runtimeSubtitle = runtimeError ?? (runtimeStatus === "loading" ? "Loading runtime..." : undefined);
    const fragmentExamples = React.useMemo(() => {
        const examples: FragmentExample[] = [
            {
                title: "Fragment Python: Counter",
                footer: "Exercises init() plus increment, decrement, and reset actions through the fragment runtime.",
                spec: counterExampleSpec
            },
            {
                title: "Fragment Python: Mode Switch",
                footer: "Exercises action params and multi-key state updates through fragment Python handlers.",
                spec: modeExampleSpec
            }
        ];

        if (fixtureState.status === "ready") {
            examples.push(...montyDevServerExamplesCreate(fixtureState.fixture.databaseId));
        }

        return examples;
    }, [fixtureState]);

    const fixtureSubtitle = fixtureStateResolveSubtitle(fixtureState);

    return (
        <ItemList>
            <ItemGroup title="Runtime">
                <Item
                    title="Native runtime linked"
                    detail={String(montyExpoNativeRuntimeLinked())}
                    showChevron={false}
                />
                <Item title="Module version" detail={montyExpoVersion()} showChevron={false} />
                <Item
                    title="Runtime status"
                    detail={runtimeStatus}
                    subtitle={runtimeSubtitle}
                    subtitleLines={0}
                    showChevron={false}
                    destructive={runtimeStatus === "error"}
                />
                <Item
                    title="Run checks"
                    subtitle="Reload runtime and re-run probes"
                    detail={running ? "Running..." : "Tap"}
                    onPress={() => {
                        void runChecks();
                    }}
                    showDivider={false}
                />
            </ItemGroup>
            <ItemGroup title="Probes">
                <Item
                    title="Basic script (2 + 5)"
                    subtitle={montyProbeSubtitle(basicProbe)}
                    subtitleLines={0}
                    destructive={basicProbe?.ok === false}
                    showChevron={false}
                />
                <Item
                    title="External function call"
                    subtitle={montyProbeSubtitle(externalProbe)}
                    subtitleLines={0}
                    destructive={externalProbe?.ok === false}
                    showChevron={false}
                    showDivider={false}
                />
            </ItemGroup>
            <ItemGroup title="Server Fixtures">
                <Item
                    title="Fixture status"
                    detail={fixtureState.status}
                    subtitle={fixtureSubtitle}
                    subtitleLines={0}
                    destructive={fixtureState.status === "error"}
                    showChevron={false}
                />
                {fixtureState.status === "ready" ? (
                    <Item
                        title="Fixture database"
                        detail={fixtureState.fixture.databaseId}
                        subtitle="Server-backed rows for fragment query examples"
                        subtitleLines={0}
                        showChevron={false}
                        showDivider={false}
                    />
                ) : null}
            </ItemGroup>
            {fragmentExamples.map((example, index) => (
                <ItemGroup key={`${example.title}-${index}`} title={example.title} footer={example.footer}>
                    <FragmentPythonExample spec={example.spec} />
                </ItemGroup>
            ))}
        </ItemList>
    );
}

function fixtureStateResolveSubtitle(state: FixtureState): string {
    if (state.status === "idle") {
        return "Waiting for an authenticated session before creating the fixture database.";
    }
    if (state.status === "loading") {
        return "Creating or reusing the Monty fixture database and seeding example rows.";
    }
    if (state.status === "error") {
        return state.error;
    }
    return `database=${state.fixture.databaseId} created=${String(state.fixture.created)} seeded=${String(
        state.fixture.seeded
    )}`;
}
