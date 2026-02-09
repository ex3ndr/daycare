import { Command } from "commander";
import { readFileSync } from "fs";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { initLogging } from "./log.js";
import { loadPluginCommand, unloadPluginCommand } from "./commands/plugins.js";
import { setAuthCommand } from "./commands/auth.js";
import { addCommand } from "./commands/add.js";
import { removeCommand } from "./commands/remove.js";
import { setDefaultProviderCommand } from "./commands/providers.js";
import { doctorCommand } from "./commands/doctor.js";
import { DEFAULT_SETTINGS_PATH } from "./settings.js";
import { eventCommand } from "./commands/event.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
);

const program = new Command();

initLogging();

program
  .name("daycare")
  .description("Personal AI agent")
  .version(pkg.version);

program
  .command("start")
  .description("Launch the daycare")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    DEFAULT_SETTINGS_PATH
  )
  .option("-f, --force", "Stop any running engine server before starting")
  .option("-v, --verbose", "Show tool calls and responses in channel")
  .action(startCommand);

program
  .command("status")
  .description("Show bot status")
  .action(statusCommand);

program
  .command("add")
  .description("Add a provider or plugin")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    DEFAULT_SETTINGS_PATH
  )
  .action(addCommand);

program
  .command("remove")
  .description("Remove a provider or plugin")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    DEFAULT_SETTINGS_PATH
  )
  .action(removeCommand);

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

program
  .command("providers")
  .description("Select the default provider")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    DEFAULT_SETTINGS_PATH
  )
  .action(setDefaultProviderCommand);

program
  .command("doctor")
  .description("Run basic inference checks for configured providers")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    DEFAULT_SETTINGS_PATH
  )
  .action(doctorCommand);

program
  .command("event")
  .description("Send an engine event over the local socket")
  .argument("<type>", "Event type")
  .argument("[payload]", "JSON payload")
  .action(eventCommand);

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

await program.parseAsync(process.argv);
