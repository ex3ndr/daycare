import { getTableConfig } from "drizzle-orm/sqlite-core";
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
    origin?: string;
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
 * Expects: db is an open SQLite connection for the target Daycare database.
 */
export function databaseSchemaMatches(db: StorageDatabase): DatabaseSchemaMatchesResult {
    const expected = schemaExpectedBuild();
    const actualTables = sqliteTableNamesRead(db);

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
        const issue = tableIssueBuild(db, tableName, expectedTable);
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
            indexes[index.config.name] = {
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
            indexes[`__column_unique__${column.name}`] = {
                unique: true,
                columns: [column.name]
            };
        }

        result[config.name] = { columns, indexes };
    }

    return result;
}

function sqliteTableNamesRead(db: StorageDatabase): string[] {
    const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
        .all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
}

function sqliteColumnsRead(db: StorageDatabase, tableName: string): Record<string, DatabaseSchemaActualColumn> {
    const rows = db.prepare(`PRAGMA table_info("${sqliteIdentifierEscape(tableName)}")`).all() as Array<{
        name: string;
        pk: number;
    }>;

    const result: Record<string, DatabaseSchemaActualColumn> = {};
    for (const row of rows) {
        result[row.name] = {
            primary: row.pk > 0
        };
    }
    return result;
}

function sqliteIndexesRead(db: StorageDatabase, tableName: string): Record<string, DatabaseSchemaActualIndex> {
    const listRows = db.prepare(`PRAGMA index_list("${sqliteIdentifierEscape(tableName)}")`).all() as Array<{
        name: string;
        unique: number;
        origin?: string;
    }>;

    const explicitIndexes = listRows.filter((row) => row.origin !== "pk");
    const result: Record<string, DatabaseSchemaActualIndex> = {};

    for (const row of explicitIndexes) {
        const columnRows = db.prepare(`PRAGMA index_info("${sqliteIdentifierEscape(row.name)}")`).all() as Array<{
            name: string | null;
        }>;
        result[row.name] = {
            unique: row.unique === 1,
            columns: columnRows.map((entry) => entry.name).filter((entry): entry is string => entry !== null),
            origin: row.origin
        };
    }

    return result;
}

function tableIssueBuild(
    db: StorageDatabase,
    tableName: string,
    expected: DatabaseSchemaTableExpected
): DatabaseSchemaTableIssue {
    const actualColumns = sqliteColumnsRead(db, tableName);
    const actualIndexes = sqliteIndexesRead(db, tableName);

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

function sqliteIdentifierEscape(value: string): string {
    return value.replaceAll('"', '""');
}

function indexSignatureBuild(index: DatabaseSchemaExpectedIndex | DatabaseSchemaActualIndex): string {
    return `${index.unique ? "1" : "0"}:${index.columns.join("\0")}`;
}
