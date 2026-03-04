# Daycare PSQL Service Architecture

This document describes the core `PsqlService` flow used by both tools and the App API.

```mermaid
flowchart TD
    LLM[LLM Agent] --> Tools[Core tools: psql_db_create / psql_db_list / psql_schema / psql_data / psql_query]
    App[Daycare App API] --> Routes[/databases/* routes]

    Tools --> Service[PsqlService facade]
    Routes --> Service

    Service --> Meta[Main storage: psql_databases metadata]
    Service --> Open[Open/cached PGlite per user + db]

    Open --> Schema[psqlSchemaIntrospect + psqlSchemaDiff + psqlSchemaApply]
    Open --> Data[psqlDataAdd / psqlDataUpdate / psqlDataDelete]
    Open --> Query[psqlQuery read-only transaction]

    Schema --> DB[(PGlite DB dir per database)]
    Data --> DB
    Query --> DB
```

## Notes

- Databases are user-scoped under `users/<userId>/databases/<dbId>/`.
- Schema changes are additive-only; destructive changes are rejected.
- Data writes are versioned with soft-delete semantics.
- Query mode is strictly read-only.
