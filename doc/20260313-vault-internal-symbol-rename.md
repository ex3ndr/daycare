# Vault Internal Symbol Rename

Daycare now uses `vault` and `vaults` for the remaining internal vault-domain file names, exported symbols, helpers, and tests that still used `document` and `documents`.

## Scope

- Renamed vault-domain helpers in app modules, app views, API route handlers, engine tools, storage helpers, and ensure flows.
- Renamed the bundled root prompt asset from `document/DOCUMENT_ROOT.md` to `vault/VAULT_ROOT.md`.
- Left the runtime filesystem folder name as `documents/`.
- Left database table names and row storage compatibility as `documents` and `document_references`.

```mermaid
flowchart LR
    A[Old internal symbols] --> B[vault* / vaults* rename pass]
    B --> C[App modules and views]
    B --> D[API route handlers]
    B --> E[Engine tools and ensure flows]
    B --> F[Storage helpers and repository facade]
    F --> G[(documents)]
    F --> H[(document_references)]
    G --> I[Table names unchanged]
    H --> I
    E --> J[/documents runtime folder unchanged/]
```

## Result

- Internal vault-domain code now follows the public `vault` naming more closely.
- Compatibility exceptions remain where storage and filesystem layout must stay stable.
