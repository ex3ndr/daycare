import { readFileSync } from "node:fs";
import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { appLinkCommand } from "./commands/appLink.js";
import { setAuthCommand } from "./commands/auth.js";
import { channelAddMemberCommand } from "./commands/channelAddMember.js";
import { channelCreateCommand } from "./commands/channelCreate.js";
import { channelListCommand } from "./commands/channelList.js";
import { channelRemoveMemberCommand } from "./commands/channelRemoveMember.js";
import { channelSendCommand } from "./commands/channelSend.js";
import { doctorCommand } from "./commands/doctor.js";
import { eventCommand } from "./commands/event.js";
import { modelsCommand } from "./commands/models.js";
import { loadPluginCommand, unloadPluginCommand } from "./commands/plugins.js";
import { setDefaultProviderCommand } from "./commands/providers.js";
import { removeCommand } from "./commands/remove.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { initLogging } from "./log.js";
import { DEFAULT_SETTINGS_PATH } from "./settings.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const program = new Command();

initLogging();

program.name("daycare").description("Personal AI agent").version(pkg.version);

program
    .command("start")
    .description("Launch the daycare")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .option("-f, --force", "Stop any running engine server before starting")
    .option("-v, --verbose", "Show tool calls and responses in channel")
    .action(startCommand);

program.command("status").description("Show bot status").action(statusCommand);

program
    .command("app-link")
    .description("Generate a Daycare app auth link URL for a user")
    .argument("<userId>", "User id to embed in the token")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .option("--instance <instanceId>", "daycare-app-server plugin instance id")
    .option("--host <host>", "Override host in the generated URL")
    .option("--port <port>", "Override port in the generated URL")
    .option("--app-domain <endpoint>", "Override app endpoint URL where the auth link opens")
    .option("--server-domain <endpoint>", "Override backend endpoint URL embedded in the auth hash payload")
    .option("--expires-in-seconds <seconds>", "Token expiration in seconds")
    .option("--json", "Print full json payload instead of plain URL")
    .action(appLinkCommand);

program
    .command("add")
    .description("Add a provider or plugin")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .action(addCommand);

program
    .command("remove")
    .description("Remove a provider or plugin")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
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
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .action(setDefaultProviderCommand);

program
    .command("models")
    .description("View and configure role model assignments and selector mappings")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .option("-l, --list", "List current model assignments without prompting")
    .action(modelsCommand);

program
    .command("doctor")
    .description("Run basic inference checks for configured providers")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .action(doctorCommand);

program
    .command("upgrade")
    .description("Run storage migrations")
    .option("-s, --settings <path>", "Path to settings file", DEFAULT_SETTINGS_PATH)
    .action(upgradeCommand);

program
    .command("event")
    .description("Generate a signal event over the local socket")
    .argument("<type>", "Event type")
    .argument("[payload]", "JSON payload")
    .action(eventCommand);

const channelCommand = program.command("channel").description("Manage group channels");

channelCommand
    .command("create")
    .description("Create a channel with a leader agent")
    .argument("<name>", "Channel name")
    .requiredOption("--leader <agentId>", "Leader agent id")
    .action(channelCreateCommand);

channelCommand.command("list").description("List channels").action(channelListCommand);

channelCommand
    .command("add-member")
    .description("Add a member to a channel")
    .argument("<channelName>", "Channel name")
    .argument("<agentId>", "Agent id")
    .argument("<username>", "Member username")
    .action(channelAddMemberCommand);

channelCommand
    .command("remove-member")
    .description("Remove a member from a channel")
    .argument("<channelName>", "Channel name")
    .argument("<agentId>", "Agent id")
    .action(channelRemoveMemberCommand);

channelCommand
    .command("send")
    .description("Send a message to a channel")
    .argument("<channelName>", "Channel name")
    .argument("<text>", "Message text")
    .action(channelSendCommand);

if (process.argv.length <= 2) {
    program.outputHelp();
    process.exit(0);
}

await program.parseAsync(process.argv);
