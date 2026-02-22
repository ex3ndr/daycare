import { migration20260219ImportFiles } from "./20260219_import_files.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220ImportTasks } from "./20260220_import_tasks.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";
import { migration20260221AddInbox } from "./20260221_add_inbox.js";
import { migration20260221BackfillCronUsers } from "./20260221_backfill_cron_users.js";
import { migration20260221DropGateColumns } from "./20260221_drop_gate_columns.js";
import { migration20260222AddChannels } from "./20260222_add_channels.js";
import { migration20260222AddExpose } from "./20260222_add_expose.js";
import { migration20260222AddProcesses } from "./20260222_add_processes.js";
import { migration20260222AddSignals } from "./20260222_add_signals.js";
import { migration20260222ImportChannels } from "./20260222_import_channels.js";
import { migration20260222ImportExpose } from "./20260222_import_expose.js";
import { migration20260222ImportProcesses } from "./20260222_import_processes.js";
import { migration20260222ImportSignals } from "./20260222_import_signals.js";
import { migration20260223AddHeartbeatUsers } from "./20260223_add_heartbeat_users.js";
import { migration20260222SessionEndedAt } from "./20260222_session_ended_at.js";
import { migration20260224AddMemoryColumns } from "./20260224_add_memory_columns.js";
import type { Migration } from "./migrationTypes.js";

export const migrations: Migration[] = [
    migration20260219Initial,
    migration20260219ImportFiles,
    migration20260220AddUsers,
    migration20260220UsersBootstrap,
    migration20260220AddTasks,
    migration20260220ImportTasks,
    migration20260221DropGateColumns,
    migration20260221BackfillCronUsers,
    migration20260221AddInbox,
    migration20260222AddSignals,
    migration20260222ImportSignals,
    migration20260222AddChannels,
    migration20260222ImportChannels,
    migration20260222AddExpose,
    migration20260222ImportExpose,
    migration20260222AddProcesses,
    migration20260222ImportProcesses,
    migration20260223AddHeartbeatUsers,
    migration20260224AddMemoryColumns,
    migration20260222SessionEndedAt
];
