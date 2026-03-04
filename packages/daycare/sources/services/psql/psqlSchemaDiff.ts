import type { PsqlColumnDef, PsqlSchemaDiffResult, PsqlTableSchema } from "./psqlTypes.js";

/**
 * Computes additive field-level schema changes for a single table.
 * Expects: desired/current table declarations use normalized names.
 */
export function psqlSchemaDiff(desired: PsqlTableSchema, current: PsqlTableSchema | null): PsqlSchemaDiffResult {
    const errors: string[] = [];
    const changes: PsqlSchemaDiffResult["changes"] = [];

    const desiredTable = tableNormalize(desired, "desired", errors);
    if (!desiredTable) {
        return { changes, errors };
    }

    const currentTable = current ? tableNormalize(current, "current", errors) : null;
    if (!currentTable) {
        changes.push({ kind: "table_add", table: desiredTable });
        return { changes, errors };
    }

    if (desiredTable.name !== currentTable.name) {
        errors.push(`Table name mismatch is not allowed: ${currentTable.name} -> ${desiredTable.name}`);
        return { changes, errors };
    }

    if (desiredTable.comment !== currentTable.comment) {
        changes.push({
            kind: "table_comment_set",
            table: desiredTable.name,
            comment: desiredTable.comment
        });
    }

    const desiredColumns = columnMapBuild(desiredTable, "desired", errors);
    const currentColumns = columnMapBuild(currentTable, "current", errors);

    const removedColumns: string[] = [];
    for (const currentColumnName of currentColumns.keys()) {
        if (!desiredColumns.has(currentColumnName)) {
            removedColumns.push(currentColumnName);
            errors.push(`Column removal is not allowed: ${desiredTable.name}.${currentColumnName}`);
        }
    }

    const addedColumns: string[] = [];
    for (const [columnName, desiredColumn] of desiredColumns.entries()) {
        const currentColumn = currentColumns.get(columnName);
        if (!currentColumn) {
            addedColumns.push(columnName);
            changes.push({ kind: "column_add", table: desiredTable.name, column: desiredColumn });
            continue;
        }
        if (desiredColumn.comment !== currentColumn.comment) {
            changes.push({
                kind: "column_comment_set",
                table: desiredTable.name,
                column: columnName,
                comment: desiredColumn.comment
            });
        }

        if (currentColumn.type !== desiredColumn.type) {
            errors.push(
                `Column type change is not allowed: ${desiredTable.name}.${columnName} ${currentColumn.type} -> ${desiredColumn.type}`
            );
        }

        const currentNullable = currentColumn.nullable ?? false;
        const desiredNullable = desiredColumn.nullable ?? false;
        if (currentNullable !== desiredNullable) {
            errors.push(
                `Column nullability change is not allowed: ${desiredTable.name}.${columnName} ${currentNullable} -> ${desiredNullable}`
            );
        }
    }

    if (removedColumns.length > 0 && addedColumns.length > 0) {
        errors.push(
            `Column rename is not allowed on ${desiredTable.name}: removed [${removedColumns.join(", ")}], added [${addedColumns.join(", ")}]`
        );
    }

    return { changes, errors };
}

function tableNormalize(
    table: PsqlTableSchema,
    source: "desired" | "current",
    errors: string[]
): PsqlTableSchema | null {
    const name = table.name.trim();
    if (!name) {
        errors.push(`${source} schema contains a table with empty name.`);
        return null;
    }
    const comment = table.comment.trim();
    if (source === "desired" && comment.length === 0) {
        errors.push(`${source} schema table ${name} requires a non-empty comment.`);
    }
    return {
        name,
        comment,
        columns: table.columns.map((column) => ({
            name: column.name.trim(),
            type: column.type,
            comment: column.comment.trim(),
            nullable: column.nullable ?? false
        }))
    };
}

function columnMapBuild(
    table: PsqlTableSchema,
    source: "desired" | "current",
    errors: string[]
): Map<string, PsqlColumnDef> {
    const map = new Map<string, PsqlColumnDef>();

    for (const column of table.columns) {
        const name = column.name.trim();
        if (!name) {
            errors.push(`${source} schema table ${table.name} has a column with empty name.`);
            continue;
        }
        if (map.has(name)) {
            errors.push(`${source} schema table ${table.name} has duplicate column: ${name}`);
            continue;
        }
        const comment = column.comment.trim();
        if (source === "desired" && comment.length === 0) {
            errors.push(`${source} schema table ${table.name} column ${name} requires a non-empty comment.`);
        }
        map.set(name, {
            name,
            type: column.type,
            comment,
            nullable: column.nullable ?? false
        });
    }

    return map;
}
