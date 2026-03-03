import type { Spec } from "@json-render/react-native";

const ERROR_TEMPLATE = `\${/error}`;
const STATS_TEMPLATE = `Total \${/stats/total} · Open \${/stats/open} · Done \${/stats/completed}`;

/**
 * Builds the json-render spec for the experiments todo UI.
 * Expects: runtime state includes /loading, /ready, /error, /draft/title, /stats/* and /todos.
 */
export function experimentsTodoSpecBuild(): Spec {
    return {
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
                    text: "UI is rendered from JSON. Actions mutate PGlite, then store state refreshes automatically.",
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
                    text: "Syncing with PGlite...",
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
                    subtitle: "Input value is bound to /draft/title",
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
                    text: "No todos yet. Create one from the JSON-bound input.",
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
                            index: { $index: true }
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
                            index: { $index: true }
                        }
                    }
                }
            }
        }
    };
}
