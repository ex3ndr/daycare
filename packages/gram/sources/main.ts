import { Command } from "commander";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { initLogging } from "./log.js";
import { loadPluginCommand, unloadPluginCommand } from "./commands/plugins.js";
import { setAuthCommand } from "./commands/auth.js";
import { addCommand } from "./commands/add.js";

const program = new Command();

initLogging();

program
  .name("gram")
  .description("Personal AI agent")
  .version("0.0.0");

program
  .command("start")
  .description("Launch the gram bot")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    ".scout/settings.json"
  )
  .action(startCommand);

program
  .command("status")
  .description("Show bot status")
  .action(statusCommand);

program
  .command("add")
  .description("Add an inference provider")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    ".scout/settings.json"
  )
  .action(addCommand);

const pluginCommand = program.command("plugins").description("Manage plugins");

pluginCommand
  .command("load")
  .description("Load a plugin")
  .argument("<pluginId>", "Plugin id")
  .argument("[instanceId]", "Instance id (defaults to plugin id)")
  .action(loadPluginCommand);

pluginCommand
  .command("unload")
  .description("Unload a plugin")
  .argument("<instanceId>", "Plugin instance id")
  .action(unloadPluginCommand);

const authCommand = program.command("auth").description("Manage auth credentials");

authCommand
  .command("set")
  .description("Set an auth credential")
  .argument("<id>", "Auth entry id")
  .argument("<key>", "Credential key")
  .argument("<value>", "Credential value")
  .action(setAuthCommand);

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

await program.parseAsync(process.argv);
