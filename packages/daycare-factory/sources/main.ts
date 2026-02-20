import { readFileSync } from "node:fs";
import { Command } from "commander";
import { factoryBuildCommand } from "./commands/factoryBuildCommand.js";
import { factoryContainerBuildCommand } from "./commands/factoryContainerBuildCommand.js";
import { FACTORY_INTERNAL_COMMAND } from "./constants.js";
import type { FactoryBuildCliOptions, FactoryContainerBuildCliOptions } from "./types.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as { version: string };

const program = new Command();

program.name("daycare-factory").version(pkg.version);

program
    .command("build")
    .description("Run daycare-factory inside Docker using a separate environment and task")
    .argument("<taskDirectory>", "Folder containing TASK.md")
    .requiredOption("-e, --environment <path>", "Environment directory containing daycare-factory.yaml and template/")
    .option("-c, --config <path>", "Config file path", "daycare-factory.yaml")
    .option("-o, --out <path>", "Output directory path", "out")
    .option("--keep-out", "Do not delete the output directory before building")
    .option("--container-name <name>", "Override container name")
    .option("--keep-container", "Do not remove container after build")
    .option("--no-remove-existing", "Do not remove an existing container with the same name")
    .action(async (taskDirectory: string, options: FactoryBuildCliOptions) => {
        await factoryBuildCommand(taskDirectory, options);
    });

program
    .command(FACTORY_INTERNAL_COMMAND, { hidden: true })
    .requiredOption("--task <path>")
    .requiredOption("--out <path>")
    .requiredOption("--template <path>")
    .action(async (options: FactoryContainerBuildCliOptions) => {
        await factoryContainerBuildCommand(options.task, options.out, options.template);
    });

if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
}

try {
    await program.parseAsync(process.argv);
} catch (error) {
    const details = error instanceof Error && error.message ? error.message : "unknown error";
    console.error(`daycare-factory failed: ${details}`);
    process.exit(1);
}
