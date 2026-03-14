#!/usr/bin/env node

if (!process.env.DAYCARE_LOG_LEVEL && !process.env.LOG_LEVEL) {
    process.env.DAYCARE_LOG_LEVEL = "silent";
}

const scenarioPath = process.argv[2];
const outputPath = process.argv[3];
const cwd = process.env.INIT_CWD || process.cwd();

if (!scenarioPath) {
    console.error("Usage: yarn eval <scenario.json> [output.trace.md]");
    process.exit(1);
}

const { evalCli } = await import("../sources/eval/evalCli.ts");

await evalCli(scenarioPath, outputPath, { cwd });
