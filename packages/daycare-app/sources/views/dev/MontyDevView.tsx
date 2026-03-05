import * as React from "react";
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
        </ItemList>
    );
}
