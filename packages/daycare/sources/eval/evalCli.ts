import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evalHarnessCreate } from "./evalHarness.js";
import { type EvalTrace, evalRun } from "./evalRun.js";
import { type EvalScenario, evalScenarioParse } from "./evalScenario.js";
import { evalTraceRender } from "./evalTraceRender.js";

export type EvalCliResult = {
    scenario: EvalScenario;
    trace: EvalTrace;
    outputPath: string;
};

type EvalCliOptions = {
    cwd?: string;
};

/**
 * Runs a scenario file end-to-end and writes a markdown trace report.
 * Expects: scenarioPath points to a valid JSON file; outputPath defaults next to it as <scenario-name>.trace.md.
 */
export async function evalCli(
    scenarioPath: string,
    outputPath?: string,
    options: EvalCliOptions = {}
): Promise<EvalCliResult> {
    const baseDir = options.cwd ?? process.cwd();
    const resolvedScenarioPath = path.resolve(baseDir, scenarioPath);
    const scenarioJson = await readFile(resolvedScenarioPath, "utf8");
    const scenario = evalScenarioParse(evalJsonParse(scenarioJson, resolvedScenarioPath));
    const resolvedOutputPath = path.resolve(
        baseDir,
        outputPath ?? path.join(path.dirname(resolvedScenarioPath), `${scenario.name}.trace.md`)
    );
    const harness = await evalHarnessCreate();

    try {
        const trace = await evalRun(scenario, harness);
        const markdown = evalTraceRender(trace);

        await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
        await writeFile(resolvedOutputPath, markdown, "utf8");

        console.log(`Scenario: ${scenario.name}`);
        console.log(`Turns: ${scenario.turns.length}`);
        console.log(`Duration: ${trace.endedAt - trace.startedAt} ms`);
        console.log(`Output: ${resolvedOutputPath}`);

        return {
            scenario,
            trace,
            outputPath: resolvedOutputPath
        };
    } finally {
        await harness.cleanup();
    }
}

function evalJsonParse(content: string, scenarioPath: string): unknown {
    try {
        return JSON.parse(content);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Invalid JSON in ${scenarioPath}: ${message}`);
    }
}
