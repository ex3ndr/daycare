import type { Spec } from "@json-render/react-native";

const ERROR_TEMPLATE = `\${/error}`;
const STATS_TEMPLATE = `Total \${/stats/total} · Open \${/stats/open} · Done \${/stats/completed}`;

type ExperimentsSqlQueryMode = "rows" | "row";

export type ExperimentsSqlQueryDefinition = {
    id: string;
    mode: ExperimentsSqlQueryMode;
    statePath: string;
    sql: string;
};

export type ExperimentsSqlActionDefinition = {
    id: string;
    sql: string;
    refreshQueries: string[];
};

export type ExperimentsTodoDefinition = {
    initialState: Record<string, unknown>;
    spec: Spec;
    bootstrapSql: string[];
    queries: ExperimentsSqlQueryDefinition[];
    actions: ExperimentsSqlActionDefinition[];
};

export const experimentsTodoDefinition: ExperimentsTodoDefinition = {
    initialState: {
        loading: true,
        ready: false,
        error: null,
        draft: {
            title: ""
        },
        todos: [],
        stats: {
            total: 0,
            completed: 0,
            open: 0
        }
    },
    bootstrapSql: [
        `
            CREATE TABLE IF NOT EXISTS experiments_todos (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE,
                created_at BIGINT NOT NULL
            );
        `,
        `
            CREATE INDEX IF NOT EXISTS idx_experiments_todos_created_at
            ON experiments_todos (created_at DESC);
        `,
        `
            INSERT INTO experiments_todos (id, title, done, created_at)
            SELECT 'seed-1', 'Wire json-render state to PGlite rows', FALSE, 1709251200001
            WHERE NOT EXISTS (SELECT 1 FROM experiments_todos WHERE id = 'seed-1');
        `,
        `
            INSERT INTO experiments_todos (id, title, done, created_at)
            SELECT 'seed-2', 'Drive rendering through SQL query snapshots', FALSE, 1709251200002
            WHERE NOT EXISTS (SELECT 1 FROM experiments_todos WHERE id = 'seed-2');
        `,
        `
            INSERT INTO experiments_todos (id, title, done, created_at)
            SELECT 'seed-3', 'Template every action with Handlebars from state', FALSE, 1709251200003
            WHERE NOT EXISTS (SELECT 1 FROM experiments_todos WHERE id = 'seed-3');
        `
    ],
    queries: [
        {
            id: "todos",
            mode: "rows",
            statePath: "/todos",
            sql: `
                SELECT
                    id,
                    title,
                    done,
                    created_at AS "createdAt"
                FROM experiments_todos
                ORDER BY done ASC, created_at DESC;
            `
        },
        {
            id: "stats",
            mode: "row",
            statePath: "/stats",
            sql: `
                SELECT
                    COUNT(*)::int AS total,
                    COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0)::int AS completed,
                    (COUNT(*) - COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0))::int AS open
                FROM experiments_todos;
            `
        }
    ],
    actions: [
        {
            id: "todoCreate",
            sql: `
                INSERT INTO experiments_todos (id, title, done, created_at)
                SELECT
                    {{sql runtime.generatedId}},
                    TRIM({{sql params.title}}),
                    FALSE,
                    {{sql runtime.now}}
                WHERE LENGTH(TRIM({{sql params.title}})) > 0;
            `,
            refreshQueries: ["todos", "stats"]
        },
        {
            id: "todoToggle",
            sql: `
                UPDATE experiments_todos
                SET done = NOT done
                WHERE id = {{sql params.todoId}};
            `,
            refreshQueries: ["todos", "stats"]
        },
        {
            id: "todoDelete",
            sql: `
                DELETE FROM experiments_todos
                WHERE id = {{sql params.todoId}};
            `,
            refreshQueries: ["todos", "stats"]
        }
    ],
    spec: {
        root: "screen",
        elements: {
            screen: {
                type: "ScrollArea",
                props: { padding: "md" },
                children: ["screenColumn"]
            },
            screenColumn: {
                type: "Column",
                props: { gap: "md" },
                children: ["headerSection", "loadingSection", "errorSection", "mainColumn"]
            },
            headerSection: {
                type: "Section",
                props: {
                    title: "Experiments",
                    subtitle: "Custom catalog + SQL-backed todo lab",
                    padding: "md"
                },
                children: ["headerText"]
            },
            headerText: {
                type: "Text",
                props: {
                    text: "UI is static JSON. State is filled by SQL query snapshots and actions are SQL templates.",
                    color: "onSurfaceVariant",
                    size: "sm"
                }
            },
            loadingSection: {
                type: "Section",
                visible: { $state: "/loading" },
                props: { padding: "md" },
                children: ["loadingBanner"]
            },
            loadingBanner: {
                type: "Banner",
                props: { text: "Running SQL sync...", variant: "warning" }
            },
            errorSection: {
                type: "Section",
                visible: { $state: "/error" },
                props: { padding: "md" },
                children: ["errorBanner"]
            },
            errorBanner: {
                type: "Banner",
                props: { text: { $template: ERROR_TEMPLATE }, variant: "error" }
            },
            mainColumn: {
                type: "Column",
                visible: { $state: "/ready" },
                props: { gap: "md" },
                children: ["composerSection", "todosSection"]
            },
            composerSection: {
                type: "Section",
                props: {
                    title: "Create Todo",
                    subtitle: "Button action compiles SQL from bound state",
                    padding: "md"
                },
                children: ["composerRow"]
            },
            composerRow: {
                type: "Row",
                props: { gap: "sm", alignItems: "center", justifyContent: "between" },
                children: ["titleInput", "createButton"]
            },
            titleInput: {
                type: "TextInput",
                props: {
                    label: "Task",
                    placeholder: "Add a task and press Add",
                    value: { $bindState: "/draft/title" },
                    flex: 1
                }
            },
            createButton: {
                type: "Button",
                props: { label: "Add", variant: "filled", size: "md" },
                on: {
                    press: {
                        action: "todoCreate",
                        params: { title: { $state: "/draft/title" } }
                    }
                }
            },
            todosSection: {
                type: "Section",
                props: { title: "Todos", padding: "md" },
                children: ["statsBanner", "emptyState", "todosRepeat"]
            },
            statsBanner: {
                type: "Banner",
                props: {
                    text: { $template: STATS_TEMPLATE },
                    variant: "info"
                }
            },
            emptyState: {
                type: "EmptyState",
                visible: { $state: "/stats/total", eq: 0 },
                props: {
                    title: "No todos yet",
                    subtitle: "Create one from the bound input and it will round-trip through SQL.",
                    icon: "clipboard-outline"
                }
            },
            todosRepeat: {
                type: "Column",
                visible: { $state: "/stats/total", gt: 0 },
                props: { gap: "sm" },
                repeat: { statePath: "/todos", key: "id" },
                children: ["todoCard"]
            },
            todoCard: {
                type: "Card",
                props: { surface: "low", elevation: "low", padding: "md" },
                children: ["todoRow"]
            },
            todoRow: {
                type: "Row",
                props: { justifyContent: "between", alignItems: "center", gap: "sm" },
                children: ["todoLeftColumn", "todoActionsRow"]
            },
            todoLeftColumn: {
                type: "Column",
                props: { flex: 1, gap: "xs" },
                children: ["todoTitle", "todoStatus"]
            },
            todoTitle: {
                type: "Text",
                props: {
                    text: { $item: "title" },
                    color: {
                        $cond: { $item: "done", eq: true },
                        $then: "onSurfaceVariant",
                        $else: "onSurface"
                    },
                    weight: "medium",
                    strikethrough: { $item: "done" }
                }
            },
            todoStatus: {
                type: "Text",
                props: {
                    text: {
                        $cond: { $item: "done", eq: true },
                        $then: "Completed",
                        $else: "Open"
                    },
                    size: "sm",
                    color: "onSurfaceVariant"
                }
            },
            todoActionsRow: {
                type: "Row",
                props: { gap: "xs", alignItems: "center" },
                children: ["toggleButton", "deleteButton"]
            },
            toggleButton: {
                type: "Button",
                props: {
                    label: {
                        $cond: { $item: "done", eq: true },
                        $then: "Reopen",
                        $else: "Done"
                    },
                    variant: "outlined",
                    size: "sm"
                },
                on: {
                    press: {
                        action: "todoToggle",
                        params: { index: { $index: true } }
                    }
                }
            },
            deleteButton: {
                type: "Button",
                props: { label: "Delete", variant: "outlined", size: "sm" },
                on: {
                    press: {
                        action: "todoDelete",
                        params: { index: { $index: true } }
                    }
                }
            }
        }
    }
};
