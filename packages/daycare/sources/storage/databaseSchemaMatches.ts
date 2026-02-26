import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "../schema.js";
import type { StorageDatabase } from "./databaseOpen.js";

type DatabaseSchemaExpectedColumn = {
    primary: boolean;
};

type DatabaseSchemaActualColumn = {
    primary: boolean;
};

type DatabaseSchemaExpectedIndex = {
    unique: boolean;
    columns: string[];
};

type DatabaseSchemaActualIndex = {
    unique: boolean;
    columns: string[];
};

export type DatabaseSchemaTableIssue = {
    table: string;
    missingColumns: string[];
    unexpectedColumns: string[];
    columnMismatches: Array<{
        column: string;
        expected: DatabaseSchemaExpectedColumn;
        actual: DatabaseSchemaActualColumn;
    }>;
    missingIndexes: string[];
    unexpectedIndexes: string[];
    indexMismatches: Array<{
        index: string;
        expected: DatabaseSchemaExpectedIndex;
        actual: DatabaseSchemaActualIndex;
    }>;
};

export type DatabaseSchemaMatchesResult = {
    matches: boolean;
    missingTables: string[];
    unexpectedTables: string[];
    tableIssues: DatabaseSchemaTableIssue[];
};

/**
 * Checks whether a database matches the current Drizzle schema shape.
 * Expects: db is an open PostgreSQL-compatible connection for the target Daycare database.
 */
export async function databaseSchemaMatches(db: StorageDatabase): Promise<DatabaseSchemaMatchesResult> {
    const expected = schemaExpectedBuild();
    const actualTables = await postgresTableNamesRead(db);

    const expectedTableNames = new Set(Object.keys(expected));
    const actualTableNames = new Set(actualTables);

    const missingTables = [...expectedTableNames].filter((name) => !actualTableNames.has(name)).sort();
    const unexpectedTables = [...actualTableNames].filter((name) => !expectedTableNames.has(name)).sort();

    const tableIssues: DatabaseSchemaTableIssue[] = [];
    for (const tableName of [...expectedTableNames].sort()) {
        if (!actualTableNames.has(tableName)) {
            continue;
        }
        const expectedTable = expected[tableName];
        if (!expectedTable) {
            continue;
        }
        const issue = await tableIssueBuild(db, tableName, expectedTable);
        if (tableIssueHas(issue)) {
            tableIssues.push(issue);
        }
    }

    return {
        matches: missingTables.length === 0 && unexpectedTables.length === 0 && tableIssues.length === 0,
        missingTables,
        unexpectedTables,
        tableIssues
    };
}

type DatabaseSchemaTableExpected = {
    columns: Record<string, DatabaseSchemaExpectedColumn>;
    indexes: Record<string, DatabaseSchemaExpectedIndex>;
};

function schemaExpectedBuild(): Record<string, DatabaseSchemaTableExpected> {
    const result: Record<string, DatabaseSchemaTableExpected> = {};

    for (const table of Object.values(schema)) {
        const config = getTableConfig(table);
        const primaryColumns = new Set(
            config.primaryKeys.flatMap((primaryKey) => primaryKey.columns.map((column) => column.name))
        );

        const columns: Record<string, DatabaseSchemaExpectedColumn> = {};
        for (const column of config.columns) {
            columns[column.name] = {
                primary: column.primary || primaryColumns.has(column.name)
            };
        }

        const indexes: Record<string, DatabaseSchemaExpectedIndex> = {};
        for (const index of config.indexes) {
            const name = index.config.name?.trim();
            if (!name) {
                continue;
            }
            indexes[name] = {
                unique: !!index.config.unique,
                columns: index.config.columns
                    .map((column) => ("name" in column && typeof column.name === "string" ? column.name : ""))
                    .filter((name) => name.length > 0)
            };
        }

        for (const column of config.columns) {
            if (!column.isUnique) {
                continue;
            }
            const uniqueName = column.uniqueName?.trim();
            if (!uniqueName) {
                continue;
            }
            indexes[uniqueName] = {
                unique: true,
                columns: [column.name]
            };
        }

        result[config.name] = { columns, indexes };
    }

    return result;
}

async function postgresTableNamesRead(db: StorageDatabase): Promise<string[]> {
    const rows = await db
        .prepare(
            `
            SELECT table_name AS name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name ASC
            `
        )
        .all<{ name: string }>();
    return rows.map((row) => row.name);
}

async function postgresColumnsRead(
    db: StorageDatabase,
    tableName: string
): Promise<Record<string, DatabaseSchemaActualColumn>> {
    const rows = await db
        .prepare(
            `
            SELECT
                att.attname AS name,
                EXISTS (
                    SELECT 1
                    FROM pg_index idx
                    WHERE idx.indrelid = tbl.oid
                      AND idx.indisprimary
                      AND att.attnum = ANY(idx.indkey)
                ) AS is_primary
            FROM pg_class tbl
            JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            JOIN pg_attribute att ON att.attrelid = tbl.oid
            WHERE ns.nspname = 'public'
              AND tbl.relname = ?
              AND att.attnum > 0
              AND NOT att.attisdropped
            ORDER BY att.attnum ASC
            `
        )
        .all<{ name: string; is_primary: boolean | number | string }>(tableName);

    const result: Record<string, DatabaseSchemaActualColumn> = {};
    for (const row of rows) {
        result[row.name] = {
            primary: booleanLikeParse(row.is_primary)
        };
    }
    return result;
}

async function postgresIndexesRead(
    db: StorageDatabase,
    tableName: string
): Promise<Record<string, DatabaseSchemaActualIndex>> {
    const rows = await db
        .prepare(
            `
            SELECT
                idx_class.relname AS name,
                idx.indisunique AS is_unique,
                COALESCE(string_agg(att.attname, ',' ORDER BY ord.ordinality), '') AS columns_csv
            FROM pg_class tbl
            JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            JOIN pg_index idx ON idx.indrelid = tbl.oid
            JOIN pg_class idx_class ON idx_class.oid = idx.indexrelid
            LEFT JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
            LEFT JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = ord.attnum
            WHERE ns.nspname = 'public'
              AND tbl.relname = ?
              AND NOT idx.indisprimary
            GROUP BY idx_class.relname, idx.indisunique
            ORDER BY idx_class.relname ASC
            `
        )
        .all<{ name: string; is_unique: boolean | number | string; columns_csv: string }>(tableName);

    const result: Record<string, DatabaseSchemaActualIndex> = {};
    for (const row of rows) {
        result[row.name] = {
            unique: booleanLikeParse(row.is_unique),
            columns: row.columns_csv
                .split(",")
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
        };
    }
    return result;
}

async function tableIssueBuild(
    db: StorageDatabase,
    tableName: string,
    expected: DatabaseSchemaTableExpected
): Promise<DatabaseSchemaTableIssue> {
    const [actualColumns, actualIndexes] = await Promise.all([
        postgresColumnsRead(db, tableName),
        postgresIndexesRead(db, tableName)
    ]);

    const expectedColumnNames = Object.keys(expected.columns);
    const actualColumnNames = Object.keys(actualColumns);

    const missingColumns = expectedColumnNames.filter((name) => !(name in actualColumns)).sort();
    const unexpectedColumns = actualColumnNames.filter((name) => !(name in expected.columns)).sort();

    const columnMismatches: DatabaseSchemaTableIssue["columnMismatches"] = [];
    for (const columnName of expectedColumnNames) {
        const expectedColumn = expected.columns[columnName];
        const actualColumn = actualColumns[columnName];
        if (!expectedColumn || !actualColumn) {
            continue;
        }
        if (expectedColumn.primary !== actualColumn.primary) {
            columnMismatches.push({
                column: columnName,
                expected: expectedColumn,
                actual: actualColumn
            });
        }
    }

    const unmatchedActualIndexNames = new Set(Object.keys(actualIndexes));
    const missingIndexes: string[] = [];
    const indexMismatches: DatabaseSchemaTableIssue["indexMismatches"] = [];
    for (const indexName of Object.keys(expected.indexes)) {
        const expectedIndex = expected.indexes[indexName];
        if (!expectedIndex) {
            continue;
        }

        const namedActualIndex = actualIndexes[indexName];
        if (namedActualIndex) {
            unmatchedActualIndexNames.delete(indexName);
            if (indexSignatureBuild(expectedIndex) !== indexSignatureBuild(namedActualIndex)) {
                indexMismatches.push({
                    index: indexName,
                    expected: expectedIndex,
                    actual: namedActualIndex
                });
            }
            continue;
        }

        const matchedByShapeName = [...unmatchedActualIndexNames].find((actualIndexName) => {
            const candidate = actualIndexes[actualIndexName];
            if (!candidate) {
                return false;
            }
            return indexSignatureBuild(candidate) === indexSignatureBuild(expectedIndex);
        });

        if (matchedByShapeName) {
            unmatchedActualIndexNames.delete(matchedByShapeName);
            continue;
        }

        missingIndexes.push(indexName);
    }

    const unexpectedIndexes = [...unmatchedActualIndexNames].sort();

    return {
        table: tableName,
        missingColumns,
        unexpectedColumns,
        columnMismatches,
        missingIndexes,
        unexpectedIndexes,
        indexMismatches
    };
}

function tableIssueHas(issue: DatabaseSchemaTableIssue): boolean {
    return (
        issue.missingColumns.length > 0 ||
        issue.unexpectedColumns.length > 0 ||
        issue.columnMismatches.length > 0 ||
        issue.missingIndexes.length > 0 ||
        issue.unexpectedIndexes.length > 0 ||
        issue.indexMismatches.length > 0
    );
}

function indexSignatureBuild(index: DatabaseSchemaExpectedIndex | DatabaseSchemaActualIndex): string {
    return `${index.unique ? "1" : "0"}:${index.columns.join("\0")}`;
}

function booleanLikeParse(value: boolean | number | string): boolean {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value === 1;
    }
    return value === "true" || value === "t" || value === "1";
}
