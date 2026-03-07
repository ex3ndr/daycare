import { apiUrl } from "../../modules/api/apiUrl";
import { databaseQuery } from "../../modules/databases/databaseQuery";

const FIXTURE_DATABASE_NAME = "Monty Fragment Fixtures";

type DatabaseListItem = {
    id: string;
    name: string;
};

export type MontyDevFixtures = {
    databaseId: string;
    created: boolean;
    seeded: boolean;
};

type MontyDevFixturesEnsureInput = {
    baseUrl: string;
    token: string;
    workspaceId: string | null;
};

/**
 * Ensures the Monty dev page has a seeded database fixture for server-backed fragment queries.
 * Expects: baseUrl/token belong to an authenticated app session.
 */
export async function montyDevFixturesEnsure(input: MontyDevFixturesEnsureInput): Promise<MontyDevFixtures> {
    const databases = await montyDevDatabasesList(input);
    let database = databases.find((item) => item.name === FIXTURE_DATABASE_NAME) ?? null;
    let created = false;

    if (!database) {
        database = await montyDevDatabaseCreate(input);
        created = true;
    }

    await montyDevDatabaseSchemaApply(input, database.id);

    const countRows = await databaseQuery(
        input.baseUrl,
        input.token,
        input.workspaceId,
        database.id,
        'SELECT COUNT(*) AS "count" FROM "inventory" WHERE "valid_to" IS NULL'
    );
    const seeded = Number(countRows[0]?.count ?? 0) === 0;

    if (seeded) {
        for (const row of montyDevFixtureRows()) {
            await montyDevDatabaseRowAdd(input, database.id, row);
        }
    }

    return {
        databaseId: database.id,
        created,
        seeded
    };
}

async function montyDevDatabasesList(input: MontyDevFixturesEnsureInput): Promise<DatabaseListItem[]> {
    const response = await fetch(apiUrl(input.baseUrl, "/databases", input.workspaceId), {
        headers: {
            authorization: `Bearer ${input.token}`
        }
    });
    const data = (await response.json()) as {
        ok?: boolean;
        databases?: Array<{ id?: string; name?: string }>;
        error?: string;
    };

    if (data.ok !== true || !Array.isArray(data.databases)) {
        throw new Error(data.error ?? "Failed to list fixture databases.");
    }

    return data.databases
        .filter((item) => typeof item.id === "string" && typeof item.name === "string")
        .map((item) => ({
            id: item.id as string,
            name: item.name as string
        }));
}

async function montyDevDatabaseCreate(input: MontyDevFixturesEnsureInput): Promise<DatabaseListItem> {
    const data = await montyDevApiPost(input, "/databases/create", {
        name: FIXTURE_DATABASE_NAME
    });
    const database = montyDevDatabaseRead(data.database);

    return database;
}

async function montyDevDatabaseSchemaApply(input: MontyDevFixturesEnsureInput, databaseId: string): Promise<void> {
    const data = await montyDevApiPost(input, `/databases/${encodeURIComponent(databaseId)}/schema`, {
        table: "inventory",
        comment: "Inventory rows for Monty fragment dev examples",
        fields: [
            {
                name: "label",
                type: "text",
                comment: "Inventory label"
            },
            {
                name: "category",
                type: "text",
                comment: "Inventory category"
            },
            {
                name: "stock",
                type: "integer",
                comment: "Units in stock"
            },
            {
                name: "featured",
                type: "boolean",
                nullable: true,
                comment: "Featured inventory flag"
            }
        ]
    });

    if (data.ok !== true) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to apply fixture schema.");
    }
}

async function montyDevDatabaseRowAdd(
    input: MontyDevFixturesEnsureInput,
    databaseId: string,
    data: Record<string, unknown>
): Promise<void> {
    await montyDevApiPost(input, `/databases/${encodeURIComponent(databaseId)}/add`, {
        table: "inventory",
        data
    });
}

async function montyDevApiPost(
    input: MontyDevFixturesEnsureInput,
    path: string,
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await fetch(apiUrl(input.baseUrl, path, input.workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${input.token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(body)
    });
    return (await response.json()) as Record<string, unknown>;
}

function montyDevDatabaseRead(value: unknown): DatabaseListItem {
    if (typeof value !== "object" || value === null) {
        throw new Error("Fixture database create response is invalid.");
    }
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
        throw new Error("Fixture database create response is invalid.");
    }
    return {
        id: candidate.id,
        name: candidate.name
    };
}

function montyDevFixtureRows(): Array<Record<string, unknown>> {
    return [
        {
            label: "Bananas",
            category: "fruit",
            stock: 7,
            featured: true
        },
        {
            label: "Carrots",
            category: "vegetable",
            stock: 11,
            featured: false
        },
        {
            label: "Strawberries",
            category: "fruit",
            stock: 4,
            featured: true
        }
    ];
}
