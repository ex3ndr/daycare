import { Command } from "commander";
import { readFileSync } from "node:fs";
import { factoryBuildCommand } from "./commands/factoryBuildCommand.js";
import type { FactoryBuildCliOptions } from "./types.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
) as { version: string };

const program = new Command();

program.name("daycare-factory").version(pkg.version);

program
  .command("build")
  .description(
    "Run daycare-factory inside a Docker container with mounted TASK.md and out"
  )
  .argument("<taskDirectory>", "Folder containing TASK.md and daycare-factory.yaml")
  .option("-c, --config <path>", "Config file path", "daycare-factory.yaml")
  .option("-o, --out <path>", "Output directory path", "out")
  .option("--keep-out", "Do not delete the output directory before building")
  .option("--container-name <name>", "Override container name")
  .option("--keep-container", "Do not remove container after build")
  .option(
    "--no-remove-existing",
    "Do not remove an existing container with the same name"
  )
  .action(async (taskDirectory: string, options: FactoryBuildCliOptions) => {
    await factoryBuildCommand(taskDirectory, options);
  });

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const details =
    error instanceof Error && error.message ? error.message : "unknown error";
  console.error(`daycare-factory failed: ${details}`);
  process.exit(1);
}
