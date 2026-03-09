# Routines to Automations

## Summary

The app-facing "Routines" workspace section is now labeled and routed as "Automations".
This change is limited to the app shell, navigation, and task detail views. The backend task domain remains unchanged.

## Route Mapping

```mermaid
flowchart LR
    A[Sidebar mode: routines] --> B[Sidebar mode: automations]
    C[/workspace/routines] --> D[/workspace/automations]
    E[/workspace/routine/:id] --> F[/workspace/automation/:id]
    G[RoutinesView] --> H[AutomationsView]
    I[RoutineDetailPanel] --> J[AutomationDetailPanel]
```

## Notes

- App mode key changed from `routines` to `automations`.
- Modal task detail route changed from `routine` to `automation`.
- User-facing copy now says "Automations".
