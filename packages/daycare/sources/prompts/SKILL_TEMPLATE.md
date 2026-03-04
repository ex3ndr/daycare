---
name: create-fragment
description: Create or update UI fragments using the json-render widget catalog. Use when users ask to build a widget, card, panel, modal, or any reusable UI component.
sandbox: true
---

# Fragment Creation

Build UI fragments as json-render specs. Fragments are self-contained, versioned UI definitions
that can be embedded anywhere in the app.

## Core Rules

1. Every fragment must have a `title`, `kitVersion`, and valid `spec`.
2. The `spec` is a json-render component tree using the widget catalog below.
3. Use semantic tokens only (colorRole, spacingScale, surfaceLevel) - never raw hex values or pixel sizes.
4. Keep specs focused - one clear UI purpose per fragment.
5. Always set `kitVersion` to "1" (current catalog version).

## Workflow

1. Understand what UI the user wants.
2. Design the component tree using available widgets.
3. Call `fragment_create` with the spec.
4. If updating an existing fragment, call `fragment_update` with the `fragmentId`.

## Available Tools

- `fragment_create` - create a new fragment with `title`, `kitVersion`, `spec`, and optional `description`
- `fragment_update` - update an existing fragment by `fragmentId` (partial fields: title, description, spec, kitVersion)
- `fragment_archive` - archive a fragment by `fragmentId` (hides from listings, still renderable by direct reference)

## Design Guidelines

1. **Layout first**: start with `Column` or `Row` as root, then nest content.
2. **Consistent spacing**: use the same `gap` scale within a container.
3. **Surface hierarchy**: use `surfaceLevel` to create visual depth (lowest -> highest).
4. **Readable text**: pair `textSize` with appropriate `textWeight`.
5. **Accessible controls**: always set `label` on buttons, `title` on list items.
6. **Sections**: use `ScrollArea` > `Section` pattern for grouped content with titles.

## Completion Checklist

Before finishing:

1. Spec uses only components from the widget catalog.
2. All props use semantic tokens (no raw values).
3. `kitVersion` is set to "1".
4. `fragment_create` or `fragment_update` was called successfully.
5. Fragment has a clear, descriptive `title`.

## Widget Catalog Reference
