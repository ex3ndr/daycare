# Rename Tasks to Functions

## Overview
Rename the "tasks" domain to "functions" across the entire codebase: database tables, Drizzle schema, TypeScript types, repositories, API routes, LLM tools, engine code, topography events, utilities, and the app UI.

### Naming convention summary

| Layer | Old | New |
|-------|-----|-----|
| DB tables | `tasks`, `tasks_cron`, `tasks_webhook` | `func`, `func_cron`, `func_webhook` |
| DB columns | `task_id` | `func_id` |
| DB index prefix | `idx_tasks_*` | `idx_func_*` |
| DB constraint prefix | `tasks_*_pk` | `func_*_pk` |
| Drizzle vars | `tasksTable`, `tasksCronTable`, `tasksWebhookTable` | `funcTable`, `funcCronTable`, `funcWebhookTable` |
| TS types | `TaskDbRecord`, `CronTaskDbRecord`, `WebhookTaskDbRecord` | `FunctionDbRecord`, `CronFunctionDbRecord`, `WebhookFunctionDbRecord` |
| TS types (engine) | `TaskActiveSummary`, `TaskActiveCronTrigger`, `TaskActiveWebhookTrigger`, `TaskSummary`, `TaskListAllResult`, `CronTriggerSummary`, `WebhookTriggerSummary` | `FunctionActiveSummary`, `FunctionActiveCronTrigger`, `FunctionActiveWebhookTrigger`, `FunctionSummary`, `FunctionListAllResult`, `CronTriggerSummary` (keep), `WebhookTriggerSummary` (keep) |
| TS types (app) | `TaskDetail`, `TaskStatus`, `TaskDetailCronTrigger`, `TaskDetailWebhookTrigger` | `FunctionDetail`, `FunctionStatus`, `FunctionDetailCronTrigger`, `FunctionDetailWebhookTrigger` |
| Repositories | `TasksRepository`, `CronTasksRepository`, `WebhookTasksRepository` | `FunctionsRepository`, `CronFunctionsRepository`, `WebhookFunctionsRepository` |
| Repo files | `tasksRepository.ts`, `cronTasksRepository.ts`, `webhookTasksRepository.ts` | `functionsRepository.ts`, `cronFunctionsRepository.ts`, `webhookFunctionsRepository.ts` |
| API routes | `/tasks/*` | `/functions/*` |
| API route dir | `api/routes/tasks/` | `api/routes/functions/` |
| API route files | `tasksCreate.ts`, `tasksRoutes.ts`, etc. | `functionsCreate.ts`, `functionsRoutes.ts`, etc. |
| LLM tool names | `task_create`, `task_read`, `task_update`, `task_delete`, `task_run`, `task_trigger_add`, `task_trigger_remove` | `function_create`, `function_read`, `function_update`, `function_delete`, `function_run`, `function_trigger_add`, `function_trigger_remove` |
| LLM tool file | `tools/task.ts` | `tools/function.ts` |
| Engine dir | `engine/tasks/` | `engine/functions/` |
| Engine files | `taskListActive.ts`, `taskListAll.ts`, `taskExecutions.ts`, `taskDeleteSuccessResolve.ts` | `functionListActive.ts`, `functionListAll.ts`, `functionExecutions.ts`, `functionDeleteSuccessResolve.ts` |
| Engine classes | `TaskExecutions` | `FunctionExecutions` |
| Module dir | `engine/modules/tasks/` | `engine/modules/functions/` |
| Module files | `taskParameter*.ts` | `functionParameter*.ts` |
| Topo events | `TOPO_SOURCE_TASKS`, `TASK_CREATED`, `TASK_UPDATED`, `TASK_DELETED` | `TOPO_SOURCE_FUNCTIONS`, `FUNCTION_CREATED`, `FUNCTION_UPDATED`, `FUNCTION_DELETED` |
| Util file | `taskIdIsSafe.ts` | `functionIdIsSafe.ts` |
| App module dir | `modules/tasks/` | `modules/functions/` |
| App files | `tasksFetch.ts`, `tasksContext.ts`, etc. | `functionsFetch.ts`, `functionsContext.ts`, etc. |
| App types | `tasksTypes.ts` | `functionsTypes.ts` |
| App store | `useTasksStore` | `useFunctionsStore` |
| UI view | `RoutinesView.tsx` → label "Routines" | `FunctionsView.tsx` → label "Functions" |
| UI route | `/routine/:id` | `/function/:id` |
| Cron types | `CronTaskDbRecord`, references to `taskId` | `CronFunctionDbRecord`, `funcId` |

## Context

### Files affected (complete inventory)

**Database & Schema:**
- `sources/storage/migrations/20260302165030_bootstrap.sql` — table definitions
- `sources/schema.ts` — Drizzle ORM table definitions
- `sources/storage/databaseTypes.ts` — DB record types

**Repositories:**
- `sources/storage/tasksRepository.ts` + `.spec.ts`
- `sources/storage/cronTasksRepository.ts` + `.spec.ts`
- `sources/storage/webhookTasksRepository.ts` + `.spec.ts`
- `sources/storage/storage.ts` — repository wiring

**Engine (tasks domain):**
- `sources/engine/tasks/taskListActive.ts` + `.spec.ts`
- `sources/engine/tasks/taskListAll.ts` + `.spec.ts`
- `sources/engine/tasks/taskExecutions.ts` + `.spec.ts`
- `sources/engine/tasks/taskDeleteSuccessResolve.ts` + `.spec.ts`

**Engine (modules/tasks):**
- `sources/engine/modules/tasks/taskParameterTypes.ts`
- `sources/engine/modules/tasks/taskParameterCodegen.ts` + `.spec.ts`
- `sources/engine/modules/tasks/taskParameterValidate.ts` + `.spec.ts`
- `sources/engine/modules/tasks/taskParameterInputsNormalize.ts` + `.spec.ts`

**LLM Tools:**
- `sources/engine/modules/tools/task.ts` + `.spec.ts`

**Topography:**
- `packages/daycore/sources/engine/observations/topographyEvents.ts` + `.spec.ts`

**Utilities:**
- `sources/utils/taskIdIsSafe.ts` + `.spec.ts`

**API Routes:**
- `sources/api/routes/tasks/tasksRoutes.ts`
- `sources/api/routes/tasks/tasksCreate.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksRead.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksUpdate.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksDelete.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksRun.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksTriggerAdd.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksTriggerRemove.ts` + `.spec.ts`
- `sources/api/routes/tasks/tasksParameterParse.ts`
- `sources/api/routes/routes.ts` — route registration
- `sources/api/routes/routeTypes.ts` — shared route types

**Cross-cutting consumers:**
- `sources/types.ts` — re-exports
- `sources/engine/engine.ts` — wiring
- `sources/engine/cron/crons.ts` — cron scheduling
- `sources/engine/cron/cronTypes.ts` — cron types
- `sources/engine/cron/ops/cronScheduler.ts` + `.spec.ts`
- `sources/engine/webhook/webhooks.ts` + `.spec.ts`
- `sources/engine/webhook/webhookTypes.ts`
- `sources/engine/agents/agent.ts`
- `sources/engine/agents/agentSystem.ts`
- `sources/engine/agents/ops/agentTypes.ts`
- `sources/engine/agents/ops/agentLoopStepTypes.ts`
- `sources/engine/agents/ops/agentLoopPendingPhaseResolve.ts`
- `sources/engine/agents/ops/agentLoopRun.ts`
- `sources/engine/modules/rlm/rlmExecute.ts`
- `sources/api/app-server/appServer.ts` + `.spec.ts`

**App (daycare-app):**
- `sources/modules/tasks/tasksTypes.ts`
- `sources/modules/tasks/tasksContext.ts`
- `sources/modules/tasks/tasksStoreCreate.ts`
- `sources/modules/tasks/tasksFetch.ts` + `.spec.ts`
- `sources/modules/tasks/taskDetailFetch.ts`
- `sources/modules/tasks/tasksStatus.ts` + `.spec.ts`
- `sources/modules/tasks/tasksFormatLastRun.ts` + `.spec.ts`
- `sources/modules/tasks/tasksSubtitle.ts` + `.spec.ts`
- `sources/views/RoutinesView.tsx`
- `sources/views/SidebarModeView.tsx`
- `sources/views/ModeView.tsx`
- `sources/views/CoachingView.tsx`
- `sources/app/routine/[id].tsx`
- `sources/components/AppSidebar.tsx`
- `sources/components/AppHeader.tsx`

## Development Approach
- Complete each task fully before moving to the next
- Make small, focused changes by layer
- **CRITICAL: every task MUST include updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility via migration SQL only (no runtime shims)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Database schema — bootstrap migration + migration SQL
- [ ] Rename `tasks` → `func` table in bootstrap SQL (table name, constraints, indexes)
- [ ] Rename `tasks_cron` → `func_cron` table (table name, `task_id` → `func_id`, constraints, indexes)
- [ ] Rename `tasks_webhook` → `func_webhook` table (table name, `task_id` → `func_id`, constraints, indexes)
- [ ] Create standalone migration SQL file at `docs/migrations/rename-tasks-to-func.sql` with ALTER TABLE RENAME, column renames, index drops/recreates
- [ ] Run tests — must pass before next task

### Task 2: Drizzle schema + DB types
- [ ] Update `sources/schema.ts`: rename `tasksTable` → `funcTable`, `tasksCronTable` → `funcCronTable`, `tasksWebhookTable` → `funcWebhookTable`, update table string names, column names (`task_id` → `func_id`), index names
- [ ] Update `sources/storage/databaseTypes.ts`: rename `TaskDbRecord` → `FunctionDbRecord`, `CronTaskDbRecord` → `CronFunctionDbRecord`, `WebhookTaskDbRecord` → `WebhookFunctionDbRecord`, rename `taskId` fields to `funcId`
- [ ] Run tests — must pass before next task

### Task 3: Repositories — rename files + classes
- [ ] Rename file `tasksRepository.ts` → `functionsRepository.ts`, class `TasksRepository` → `FunctionsRepository`, update all internal references
- [ ] Rename file `tasksRepository.spec.ts` → `functionsRepository.spec.ts`, update imports/references
- [ ] Rename file `cronTasksRepository.ts` → `cronFunctionsRepository.ts`, class `CronTasksRepository` → `CronFunctionsRepository`, rename `taskId` → `funcId` in methods/params
- [ ] Rename file `cronTasksRepository.spec.ts` → `cronFunctionsRepository.spec.ts`, update imports/references
- [ ] Rename file `webhookTasksRepository.ts` → `webhookFunctionsRepository.ts`, class `WebhookTasksRepository` → `WebhookFunctionsRepository`, rename `taskId` → `funcId`
- [ ] Rename file `webhookTasksRepository.spec.ts` → `webhookFunctionsRepository.spec.ts`, update imports/references
- [ ] Update `sources/storage/storage.ts` — rename repository properties and imports
- [ ] Run tests — must pass before next task

### Task 4: Topography events + utility
- [ ] Update `packages/daycore/sources/engine/observations/topographyEvents.ts`: `TOPO_SOURCE_TASKS` → `TOPO_SOURCE_FUNCTIONS`, `TASK_CREATED` → `FUNCTION_CREATED`, `TASK_UPDATED` → `FUNCTION_UPDATED`, `TASK_DELETED` → `FUNCTION_DELETED`
- [ ] Update `topographyEvents.spec.ts` to match
- [ ] Rename `sources/utils/taskIdIsSafe.ts` → `functionIdIsSafe.ts`, rename exported function
- [ ] Rename `sources/utils/taskIdIsSafe.spec.ts` → `functionIdIsSafe.spec.ts`, update imports
- [ ] Run tests — must pass before next task

### Task 5: Engine modules — parameter types/codegen/validation
- [ ] Rename directory `sources/engine/modules/tasks/` → `sources/engine/modules/functions/`
- [ ] Rename `taskParameterTypes.ts` → `functionParameterTypes.ts`, update type name `TaskParameter` → `FunctionParameter`
- [ ] Rename `taskParameterCodegen.ts` → `functionParameterCodegen.ts` + `.spec.ts`, update function names and imports
- [ ] Rename `taskParameterValidate.ts` → `functionParameterValidate.ts` + `.spec.ts`, update function names and imports
- [ ] Rename `taskParameterInputsNormalize.ts` → `functionParameterInputsNormalize.ts` + `.spec.ts`, update function names and imports
- [ ] Run tests — must pass before next task

### Task 6: Engine domain — executions + listing
- [ ] Rename directory `sources/engine/tasks/` → `sources/engine/functions/`
- [ ] Rename `taskExecutions.ts` → `functionExecutions.ts`, class `TaskExecutions` → `FunctionExecutions`, `TaskExecutionStats` → `FunctionExecutionStats`
- [ ] Rename `taskExecutions.spec.ts` → `functionExecutions.spec.ts`
- [ ] Rename `taskListActive.ts` → `functionListActive.ts`, update function name `taskListActive` → `functionListActive`, types `TaskActiveSummary` → `FunctionActiveSummary`, `TaskActiveCronTrigger` → `FunctionActiveCronTrigger`, `TaskActiveWebhookTrigger` → `FunctionActiveWebhookTrigger`
- [ ] Rename `taskListActive.spec.ts` → `functionListActive.spec.ts`
- [ ] Rename `taskListAll.ts` → `functionListAll.ts`, update function name `taskListAll` → `functionListAll`, types `TaskListAllResult` → `FunctionListAllResult`, `TaskSummary` → `FunctionSummary`
- [ ] Rename `taskListAll.spec.ts` → `functionListAll.spec.ts`
- [ ] Rename `taskDeleteSuccessResolve.ts` → `functionDeleteSuccessResolve.ts` + `.spec.ts`
- [ ] Run tests — must pass before next task

### Task 7: LLM tools
- [ ] Rename `sources/engine/modules/tools/task.ts` → `function.ts`, rename all builder functions (`buildTaskCreateTool` → `buildFunctionCreateTool`, etc.), tool names (`task_create` → `function_create`, etc.), update all prompt text from "task" to "function"
- [ ] Rename `task.spec.ts` → `function.spec.ts`, update imports/references
- [ ] Run tests — must pass before next task

### Task 8: API routes
- [ ] Rename directory `sources/api/routes/tasks/` → `sources/api/routes/functions/`
- [ ] Rename all route files: `tasksCreate.ts` → `functionsCreate.ts`, `tasksRead.ts` → `functionsRead.ts`, `tasksUpdate.ts` → `functionsUpdate.ts`, `tasksDelete.ts` → `functionsDelete.ts`, `tasksRun.ts` → `functionsRun.ts`, `tasksTriggerAdd.ts` → `functionsTriggerAdd.ts`, `tasksTriggerRemove.ts` → `functionsTriggerRemove.ts`, `tasksParameterParse.ts` → `functionsParameterParse.ts`, `tasksRoutes.ts` → `functionsRoutes.ts`
- [ ] Rename all `.spec.ts` files correspondingly
- [ ] Update route paths from `/tasks` → `/functions` in `functionsRoutes.ts`
- [ ] Update `sources/api/routes/routes.ts` — import path and registration
- [ ] Update `sources/api/routes/routeTypes.ts` — any task-related types
- [ ] Run tests — must pass before next task

### Task 9: Cross-cutting consumers — types.ts, engine.ts, cron, webhook, agents
- [ ] Update `sources/types.ts` — rename re-exports and import paths
- [ ] Update `sources/engine/engine.ts` — repository/execution wiring
- [ ] Update `sources/engine/cron/crons.ts`, `cronTypes.ts`, `ops/cronScheduler.ts` + `.spec.ts` — rename `taskId` → `funcId` in types and logic, update repository references
- [ ] Update `sources/engine/webhook/webhooks.ts` + `.spec.ts`, `webhookTypes.ts` — rename `taskId` → `funcId`, update repository references
- [ ] Update `sources/engine/agents/agent.ts`, `agentSystem.ts`, `ops/agentTypes.ts`, `ops/agentLoopStepTypes.ts`, `ops/agentLoopPendingPhaseResolve.ts`, `ops/agentLoopRun.ts` — rename task references
- [ ] Update `sources/engine/modules/rlm/rlmExecute.ts` — rename task parameter references
- [ ] Update `sources/api/app-server/appServer.ts` + `.spec.ts` — rename imports/references
- [ ] Run tests — must pass before next task

### Task 10: App module — rename files + types + store
- [ ] Rename directory `packages/daycare-app/sources/modules/tasks/` → `modules/functions/`
- [ ] Rename all files: `tasksTypes.ts` → `functionsTypes.ts`, `tasksContext.ts` → `functionsContext.ts`, `tasksStoreCreate.ts` → `functionsStoreCreate.ts`, `tasksFetch.ts` → `functionsFetch.ts`, `taskDetailFetch.ts` → `functionDetailFetch.ts`, `tasksStatus.ts` → `functionsStatus.ts`, `tasksFormatLastRun.ts` → `functionsFormatLastRun.ts`, `tasksSubtitle.ts` → `functionsSubtitle.ts`
- [ ] Rename all `.spec.ts` files correspondingly
- [ ] Update all type names (`TaskDetail` → `FunctionDetail`, `TaskStatus` → `FunctionStatus`, etc.)
- [ ] Update store name `useTasksStore` → `useFunctionsStore`
- [ ] Update API fetch paths from `/tasks` → `/functions`
- [ ] Run tests — must pass before next task

### Task 11: App views — UI rename
- [ ] Rename `RoutinesView.tsx` → `FunctionsView.tsx`, update label "Routines" → "Functions", update internal task references
- [ ] Rename route file `sources/app/routine/[id].tsx` → `sources/app/function/[id].tsx`
- [ ] Update `SidebarModeView.tsx` — route and label references
- [ ] Update `ModeView.tsx` — route and label references
- [ ] Update `CoachingView.tsx` — any task/routine references
- [ ] Update `AppSidebar.tsx` — navigation labels/routes
- [ ] Update `AppHeader.tsx` — navigation labels/routes
- [ ] Run tests — must pass before next task

### Task 12: Verify acceptance criteria
- [ ] Verify no remaining references to old names (`grep` for `tasksTable`, `TaskDbRecord`, `/tasks/`, `task_create`, `RoutinesView`, `useTasksStore`)
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`, fix with `yarn lint:fix` if needed)
- [ ] Run typecheck (`yarn typecheck`)

### Task 13: Update documentation
- [ ] Update CLAUDE.md — legacy compatibility section (remove task PUT/DELETE mention if routes deleted, add `/functions/*` pattern)
- [ ] Update any plugin READMEs that reference tasks
- [ ] Update `sources/engine/cron/README.md` — references to tasks
- [ ] Update `sources/api/app-server/README.md` — references to tasks

## Post-Completion

**Manual verification:**
- Test task/function CRUD via API manually
- Test cron and webhook trigger flows
- Verify app UI shows "Functions" label and navigates correctly
- Run existing env (`yarn env`) and verify no runtime errors

**Migration for existing installs:**
- Apply `docs/migrations/rename-tasks-to-func.sql` to running Postgres instances
