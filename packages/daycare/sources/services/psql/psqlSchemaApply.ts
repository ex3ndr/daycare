import { psqlColumnTypeToPg } from "./psqlColumnTypeToPg.js";
import { psqlIdentifierQuote } from "./psqlIdentifierQuote.js";
import {
    PSQL_SYSTEM_COLUMNS,
    type PsqlClient,
    type PsqlColumnDef,
    type PsqlSchemaApplyResult,
    type PsqlSchemaDiffResult
} from "./psqlTypes.js";

/**
 * Applies additive schema changes to a target database.
 * Expects: diff.errors is empty and change list comes from psqlSchemaDiff.
 */
export async function psqlSchemaApply(db: PsqlClient, diff: PsqlSchemaDiffResult): Promise<PsqlSchemaApplyResult> {
    if (diff.errors.length > 0) {
        throw new Error(`Schema diff has blocking errors: ${diff.errors.join("; ")}`);
    }

    const executedSql: string[] = [];
    for (const change of diff.changes) {
        if (change.kind === "table_add") {
            const createTableSql = tableCreateSqlBuild(change.table.name, change.table.columns);
            const createIndexSql = tableCurrentIndexSqlBuild(change.table.name);
            const tableCommentSql = tableCommentSqlBuild(change.table.name, change.table.comment);
            await db.exec(createTableSql);
            await db.exec(createIndexSql);
            await db.exec(tableCommentSql);
            executedSql.push(createTableSql, createIndexSql, tableCommentSql);
            for (const column of change.table.columns) {
                const columnCommentSql = columnCommentSqlBuild(change.table.name, column.name, column.comment);
                await db.exec(columnCommentSql);
                executedSql.push(columnCommentSql);
            }
            continue;
        }

        if (change.kind === "column_add") {
            const alterSql = columnAddSqlBuild(change.table, change.column);
            const columnCommentSql = columnCommentSqlBuild(change.table, change.column.name, change.column.comment);
            await db.exec(alterSql);
            await db.exec(columnCommentSql);
            executedSql.push(alterSql, columnCommentSql);
            continue;
        }

        if (change.kind === "table_comment_set") {
            const tableCommentSql = tableCommentSqlBuild(change.table, change.comment);
            await db.exec(tableCommentSql);
            executedSql.push(tableCommentSql);
            continue;
        }

        const columnCommentSql = columnCommentSqlBuild(change.table, change.column, change.comment);
        await db.exec(columnCommentSql);
        executedSql.push(columnCommentSql);
    }

    return {
        sql: executedSql
    };
}

function tableCreateSqlBuild(tableName: string, businessColumns: PsqlColumnDef[]): string {
    const quotedTable = psqlIdentifierQuote(tableName);
    const systemColumns = [
        '"id" text NOT NULL',
        '"version" integer NOT NULL',
        '"valid_from" bigint NOT NULL',
        '"valid_to" bigint',
        '"created_at" bigint NOT NULL',
        '"updated_at" bigint NOT NULL'
    ];
    const business = businessColumns.map((column) => columnSqlBuild(column));

    return `CREATE TABLE ${quotedTable} (${[...systemColumns, ...business, 'PRIMARY KEY ("id", "version")'].join(", ")})`;
}

function tableCurrentIndexSqlBuild(tableName: string): string {
    const quotedTable = psqlIdentifierQuote(tableName);
    const quotedIndex = psqlIdentifierQuote(`idx_${tableName}_current_id`);
    return `CREATE UNIQUE INDEX ${quotedIndex} ON ${quotedTable} ("id") WHERE "valid_to" IS NULL`;
}

function columnAddSqlBuild(tableName: string, column: PsqlColumnDef): string {
    const quotedTable = psqlIdentifierQuote(tableName);
    return `ALTER TABLE ${quotedTable} ADD COLUMN ${columnSqlBuild(column)}`;
}

function tableCommentSqlBuild(tableName: string, comment: string): string {
    const quotedTable = psqlIdentifierQuote(tableName);
    return `COMMENT ON TABLE ${quotedTable} IS ${psqlStringLiteralQuote(comment)}`;
}

function columnCommentSqlBuild(tableName: string, columnName: string, comment: string): string {
    const quotedTable = psqlIdentifierQuote(tableName);
    const quotedColumn = psqlIdentifierQuote(columnName);
    return `COMMENT ON COLUMN ${quotedTable}.${quotedColumn} IS ${psqlStringLiteralQuote(comment)}`;
}

function columnSqlBuild(column: PsqlColumnDef): string {
    const quotedColumn = psqlIdentifierQuote(column.name);
    const typeSql = psqlColumnTypeToPg(column.type);

    if (column.nullable) {
        return `${quotedColumn} ${typeSql}`;
    }

    return `${quotedColumn} ${typeSql} NOT NULL`;
}

function psqlStringLiteralQuote(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
}

export function psqlSystemColumnNameIs(columnName: string): boolean {
    return PSQL_SYSTEM_COLUMNS.some((column) => column.name === columnName);
}
