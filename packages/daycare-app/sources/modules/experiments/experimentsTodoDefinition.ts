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
                ORDER BY created_at DESC;
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
                type: "ScrollContainer",
                props: {
                    padding: 20,
                    backgroundColor: "#f8fafc"
                },
                children: ["headerCard", "loadingCard", "errorCard", "mainColumn"]
            },
            headerCard: {
                type: "Card",
                props: {
                    title: "Experiments",
                    subtitle: "JSON-render + PGlite todo lab",
                    padding: 16,
                    elevated: false,
                    backgroundColor: "#e0ecff"
                },
                children: ["headerText"]
            },
            headerText: {
                type: "Paragraph",
                props: {
                    text: "UI is static JSON. State is filled by SQL query snapshots and actions are SQL templates.",
                    color: "#1e293b"
                }
            },
            loadingCard: {
                type: "Card",
                visible: { $state: "/loading" },
                props: {
                    padding: 12,
                    elevated: false,
                    backgroundColor: "#fef3c7"
                },
                children: ["loadingText"]
            },
            loadingText: {
                type: "Paragraph",
                props: {
                    text: "Running SQL sync...",
                    color: "#92400e"
                }
            },
            errorCard: {
                type: "Card",
                visible: { $state: "/error" },
                props: {
                    padding: 12,
                    elevated: false,
                    backgroundColor: "#fee2e2"
                },
                children: ["errorText"]
            },
            errorText: {
                type: "Paragraph",
                props: {
                    text: { $template: ERROR_TEMPLATE },
                    color: "#991b1b"
                }
            },
            mainColumn: {
                type: "Column",
                visible: { $state: "/ready" },
                props: {
                    gap: 12
                },
                children: ["composerCard", "statsCard", "emptyCard", "todosRepeat"]
            },
            composerCard: {
                type: "Card",
                props: {
                    title: "Create Todo",
                    subtitle: "Button action compiles SQL from bound state",
                    padding: 16,
                    elevated: false
                },
                children: ["composerRow"]
            },
            composerRow: {
                type: "Row",
                props: {
                    gap: 8,
                    alignItems: "center"
                },
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
                props: {
                    label: "Add",
                    variant: "primary"
                },
                on: {
                    press: {
                        action: "todoCreate",
                        params: {
                            title: { $state: "/draft/title" }
                        }
                    }
                }
            },
            statsCard: {
                type: "Card",
                props: {
                    padding: 12,
                    elevated: false,
                    backgroundColor: "#ecfccb"
                },
                children: ["statsText"]
            },
            statsText: {
                type: "Paragraph",
                props: {
                    text: { $template: STATS_TEMPLATE },
                    color: "#365314"
                }
            },
            emptyCard: {
                type: "Card",
                visible: { $state: "/stats/total", eq: 0 },
                props: {
                    padding: 12,
                    elevated: false,
                    backgroundColor: "#e2e8f0"
                },
                children: ["emptyText"]
            },
            emptyText: {
                type: "Paragraph",
                props: {
                    text: "No todos yet. Create one from the bound input and it will round-trip through SQL.",
                    color: "#334155"
                }
            },
            todosRepeat: {
                type: "Column",
                visible: { $state: "/stats/total", gt: 0 },
                props: {
                    gap: 8
                },
                repeat: {
                    statePath: "/todos",
                    key: "id"
                },
                children: ["todoCard"]
            },
            todoCard: {
                type: "Card",
                props: {
                    padding: 12,
                    elevated: false,
                    backgroundColor: {
                        $cond: { $item: "done", eq: true },
                        $then: "#dcfce7",
                        $else: "#ffffff"
                    }
                },
                children: ["todoRow"]
            },
            todoRow: {
                type: "Row",
                props: {
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8
                },
                children: ["todoLeftColumn", "todoActionsRow"]
            },
            todoLeftColumn: {
                type: "Column",
                props: {
                    flex: 1,
                    gap: 4
                },
                children: ["todoTitle", "todoStatus"]
            },
            todoTitle: {
                type: "Paragraph",
                props: {
                    text: { $item: "title" },
                    color: {
                        $cond: { $item: "done", eq: true },
                        $then: "#166534",
                        $else: "#0f172a"
                    }
                }
            },
            todoStatus: {
                type: "Label",
                props: {
                    text: {
                        $cond: { $item: "done", eq: true },
                        $then: "Completed",
                        $else: "Open"
                    },
                    size: "sm",
                    color: "#64748b"
                }
            },
            todoActionsRow: {
                type: "Row",
                props: {
                    gap: 8,
                    alignItems: "center"
                },
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
                    variant: "secondary",
                    size: "sm"
                },
                on: {
                    press: {
                        action: "todoToggle",
                        params: {
                            todoId: { $item: "id" }
                        }
                    }
                }
            },
            deleteButton: {
                type: "Button",
                props: {
                    label: "Delete",
                    variant: "danger",
                    size: "sm"
                },
                on: {
                    press: {
                        action: "todoDelete",
                        params: {
                            todoId: { $item: "id" }
                        }
                    }
                }
            }
        }
    }
};
