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
3. Use semantic color tokens whenever possible — never raw values for spacing or surfaces.
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

## Colors

Color props follow the **Material Design 3** color system. Every `color` prop accepts a string
that is resolved at render time in two steps:

1. **Theme role lookup**: if the string matches a known MD3 color role, the corresponding
   theme color is used. This ensures the fragment adapts to light/dark themes automatically.
2. **Raw color fallback**: if no theme role matches, the string is passed through as a
   standard CSS color (e.g. `#FF0000`, `rgb(0,128,255)`, `rgba(0,0,0,0.5)`, `red`).

**Always prefer Material Design 3 color roles** over raw colors. Theme roles guarantee
consistency with the app's palette and automatic dark mode support. Only use raw colors
when a specific brand color or custom value is truly required.

Available MD3 color roles:

| Role | Typical use |
|------|-------------|
| `primary` | Main actions, active states |
| `onPrimary` | Text/icons on primary surfaces |
| `primaryContainer` | Filled containers, tonal buttons |
| `onPrimaryContainer` | Text/icons on primary containers |
| `secondary`, `onSecondary` | Supporting actions |
| `secondaryContainer`, `onSecondaryContainer` | Tonal surfaces |
| `tertiary`, `onTertiary` | Accent/complementary |
| `tertiaryContainer`, `onTertiaryContainer` | Accent containers |
| `error`, `onError` | Error states |
| `errorContainer`, `onErrorContainer` | Error surfaces |
| `surface`, `onSurface` | Default background and text |
| `surfaceVariant`, `onSurfaceVariant` | Secondary text, icons |
| `surfaceContainer`, `surfaceContainerLow`, `surfaceContainerHigh`, `surfaceContainerHighest` | Layered surfaces |
| `outline`, `outlineVariant` | Borders, dividers |

Examples:
- `"color": "primary"` — uses the theme's primary color (adapts to dark mode)
- `"color": "onSurfaceVariant"` — muted text color from the theme
- `"color": "#E53935"` — raw red, does NOT adapt to dark mode (use sparingly)

## Typography

The `weight` prop on `Text` (and similar text components) accepts a string that is resolved
at render time:

1. **Weight role lookup**: if the string matches a known weight role, the corresponding
   IBM Plex Sans font family is used.
2. **Raw font family fallback**: if no role matches, the string is passed through as a
   literal font family name (e.g. `"Helvetica-Bold"`).

**Always prefer weight roles** over raw font family names. Roles ensure consistent
typography across the app.

Available weight roles:

| Role | Font family | Typical use |
|------|------------|-------------|
| `regular` | IBMPlexSans-Regular | Body text (default when omitted) |
| `medium` | IBMPlexSans-Medium | Emphasized text, labels |
| `semibold` | IBMPlexSans-SemiBold | Headings, strong emphasis |

When `weight` is `null`, `undefined`, or omitted, it defaults to `regular` (IBMPlexSans-Regular).

Examples:
- `"weight": "semibold"` — bold heading style
- `"weight": "regular"` — normal body text (same as omitting)
- `"weight": "Helvetica-Bold"` — raw font family, bypasses role resolution (use sparingly)

## Layout

Fragments use **React Native flexbox**, which differs from web CSS in several defaults:

| Property | RN default | Web default |
|----------|-----------|-------------|
| `flexDirection` | `column` | `row` |
| `flexShrink` | `0` | `1` |
| `alignContent` | `flex-start` | `stretch` |

Key implications:
- Children stack **vertically** by default (use `direction: "row"` on `View` for horizontal).
- Items do **not** shrink by default — set `flexShrink: 1` explicitly if needed.
- `flexGrow: 1` makes an item fill remaining space (equivalent to `flex: 1` in RN shorthand).

The `View` component exposes `flexGrow`, `flexShrink`, and `flexBasis` individually
(not the shorthand `flex`). Use `flexGrow` to expand, `flexShrink` to allow compression,
and `flexBasis` to set the initial size before flex distribution.

## Spacing Scale

Spacing props (`gap`, `padding`, `margin`, etc.) accept a semantic token **or** a raw
number (pixels). Prefer tokens for consistency; use raw numbers only when a specific
pixel value is needed (e.g. fine-tuning alignment).

| Token | Pixels | Typical use |
|-------|--------|-------------|
| `"none"` | 0 | No spacing |
| `"xs"` | 4px | Tight gaps between related items, icon-to-text spacing |
| `"sm"` | 8px | Default inner gaps, compact padding, row gaps |
| `"md"` | 16px | Standard card/section padding, horizontal page inset |
| `"lg"` | 24px | Group separation, generous padding between sections |
| `"xl"` | 32px | Major section separation, large outer margins |
| `12` | 12px | Example raw number — passed through as-is |

Common patterns:
- **Card/section padding**: `"md"` (16px)
- **Gap between items in a list**: `"sm"` (8px) or `"xs"` (4px)
- **Gap between sections**: `"lg"` (24px)
- **Compact row gap**: `"sm"` (8px)
- **Page horizontal inset**: `"md"` (16px)

## Content Alignment

`ScrollView` renders inside a max-width container (1100px, centered). Content placed
directly inside `ScrollView` needs horizontal padding to avoid touching the edges.

- `ItemGroup` handles its own side margins internally (16px on iOS, 12px on Android) —
  do **not** add extra horizontal padding to `ScrollView` when using `ItemGroup` children.
- For free-form content (e.g. `View`, `Text`, `Card` directly inside `ScrollView`),
  add `paddingHorizontal: "md"` to the `ScrollView` to match the `ItemGroup` inset.
- When mixing `ItemGroup` with free-form content, wrap the free-form content in a
  `View` with `paddingHorizontal: "md"` instead of padding the `ScrollView` itself,
  so `ItemGroup` margins are not doubled.

## Border Radius

Components use these border radius values (built into the components, not configurable):

| Component | Radius |
|-----------|--------|
| `Card` | 16px |
| `Button` | 12px |
| `TextInput` | 12px |
| `Checkbox` box | 4px |
| `ItemGroup` content | 10px (iOS) / 16px (Android) |

## Design Guidelines

1. **Layout first**: start with `View` as root, then nest content.
2. **Consistent spacing**: use the same `gap` scale within a container.
3. **Surface hierarchy**: use `surfaceLevel` to create visual depth (lowest -> highest).
4. **Readable text**: pair `size` with appropriate `weight` roles (`regular`, `medium`, `semibold`).
5. **Accessible controls**: always set `label` on buttons, `title` on list items.
6. **Grouped lists**: use `ScrollView` > `ItemGroup` > `ListItem` pattern for grouped settings/navigation.
7. **Colors**: prefer MD3 theme roles for all color props; raw colors only when necessary.

## Completion Checklist

Before finishing:

1. Spec uses only components from the widget catalog.
2. Color props use MD3 theme roles; raw colors only where a specific value is required.
3. Font weight props use weight roles (`regular`, `medium`, `semibold`); raw font families only when necessary.
4. All spacing and surface props use semantic tokens (no raw values).
5. `kitVersion` is set to "1".
6. `fragment_create` or `fragment_update` was called successfully.
7. Fragment has a clear, descriptive `title`.

## Widget Catalog Reference
