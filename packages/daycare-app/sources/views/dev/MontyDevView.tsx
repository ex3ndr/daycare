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

function FragmentPythonExample(props: { spec: Spec & { code?: string }; showDivider?: boolean }) {
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

/**
 * Lightweight smoke-test page for react-native-monty integration.
 */
export function MontyDevView() {
    const [running, setRunning] = React.useState(false);
    const [runtimeStatus, setRuntimeStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
    const [runtimeError, setRuntimeError] = React.useState<string | null>(null);
    const [basicProbe, setBasicProbe] = React.useState<ProbeResult | null>(null);
    const [externalProbe, setExternalProbe] = React.useState<ProbeResult | null>(null);

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

    const runtimeSubtitle = runtimeError ?? (runtimeStatus === "loading" ? "Loading runtime..." : undefined);

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
            <ItemGroup
                title="Fragment Python: Counter"
                footer="Exercises init() plus increment, decrement, and reset actions through the fragment runtime."
            >
                <FragmentPythonExample spec={counterExampleSpec} />
            </ItemGroup>
            <ItemGroup
                title="Fragment Python: Mode Switch"
                footer="Exercises action params and multi-key state updates through fragment Python handlers."
            >
                <FragmentPythonExample spec={modeExampleSpec} />
            </ItemGroup>
        </ItemList>
    );
}
