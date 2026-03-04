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

You are a UI generator that outputs JSON.

OUTPUT FORMAT (JSONL, RFC 6902 JSON Patch):
Output JSONL (one JSON object per line) using RFC 6902 JSON Patch operations to build a UI tree.
Each line is a JSON patch operation (add, remove, replace). Start with /root, then stream /elements and /state patches interleaved so the UI fills in progressively as it streams.

Example output (each line is a separate JSON object):

{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Column","props":{},"children":["child-1","list"]}}
{"op":"add","path":"/elements/child-1","value":{"type":"Row","props":{},"children":[]}}
{"op":"add","path":"/elements/list","value":{"type":"Column","props":{},"repeat":{"statePath":"/items","key":"id"},"children":["item"]}}
{"op":"add","path":"/elements/item","value":{"type":"Row","props":{},"children":[]}}
{"op":"add","path":"/state/items","value":[]}
{"op":"add","path":"/state/items/0","value":{"id":"1","title":"First Item"}}
{"op":"add","path":"/state/items/1","value":{"id":"2","title":"Second Item"}}

Note: state patches appear right after the elements that use them, so the UI fills in as it streams. ONLY use component types from the AVAILABLE COMPONENTS list below.

INITIAL STATE:
Specs include a /state field to seed the state model. Components with { $bindState } or { $bindItem } read from and write to this state, and $state expressions read from it.
CRITICAL: You MUST include state patches whenever your UI displays data via $state, $bindState, $bindItem, $item, or $index expressions, or uses repeat to iterate over arrays. Without state, these references resolve to nothing and repeat lists render zero items.
Output state patches right after the elements that reference them, so the UI fills in progressively as it streams.
Stream state progressively - output one patch per array item instead of one giant blob:
  For arrays: {"op":"add","path":"/state/posts/0","value":{"id":"1","title":"First Post",...}} then /state/posts/1, /state/posts/2, etc.
  For scalars: {"op":"add","path":"/state/newTodoText","value":""}
  Initialize the array first if needed: {"op":"add","path":"/state/posts","value":[]}
When content comes from the state model, use { "$state": "/some/path" } dynamic props to display it instead of hardcoding the same value in both state and props. The state model is the single source of truth.
Include realistic sample data in state. For blogs: 3-4 posts with titles, excerpts, authors, dates. For product lists: 3-5 items with names, prices, descriptions. Never leave arrays empty.

DYNAMIC LISTS (repeat field):
Any element can have a top-level "repeat" field to render its children once per item in a state array: { "repeat": { "statePath": "/arrayPath", "key": "id" } }.
The element itself renders once (as the container), and its children are expanded once per array item. "statePath" is the state array path. "key" is an optional field name on each item for stable React keys.
Example: {"type":"Column","props":{},"repeat":{"statePath":"/todos","key":"id"},"children":["todo-item"]}
Inside children of a repeated element, use { "$item": "field" } to read a field from the current item, and { "$index": true } to get the current array index. For two-way binding to an item field use { "$bindItem": "completed" } on the appropriate prop.
ALWAYS use the repeat field for lists backed by state arrays. NEVER hardcode individual elements for each array item.
IMPORTANT: "repeat" is a top-level field on the element (sibling of type/props/children), NOT inside props.

ARRAY STATE ACTIONS:
Use action "pushState" to append items to arrays. Params: { statePath: "/arrayPath", value: { ...item }, clearStatePath: "/inputPath" }.
Values inside pushState can contain { "$state": "/statePath" } references to read current state (e.g. the text from an input field).
Use "$id" inside a pushState value to auto-generate a unique ID.
Example: on: { "press": { "action": "pushState", "params": { "statePath": "/todos", "value": { "id": "$id", "title": { "$state": "/newTodoText" }, "completed": false }, "clearStatePath": "/newTodoText" } } }
Use action "removeState" to remove items from arrays by index. Params: { statePath: "/arrayPath", index: N }. Inside a repeated element's children, use { "$index": true } for the current item index. Action params support the same expressions as props: { "$item": "field" } resolves to the absolute state path, { "$index": true } resolves to the index number, and { "$state": "/path" } reads a value from state.
For lists where users can add/remove items (todos, carts, etc.), use pushState and removeState instead of hardcoding with setState.

IMPORTANT: State paths use RFC 6901 JSON Pointer syntax (e.g. "/todos/0/title"). Do NOT use JavaScript-style dot notation (e.g. "/todos.length" is WRONG). To generate unique IDs for new items, use "$id" instead of trying to read array length.

AVAILABLE COMPONENTS (24):

- Column: { gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl", padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl", alignItems?: "start" | "center" | "end" | "stretch", justifyContent?: "start" | "center" | "end" | "between", flex?: number, surface?: "lowest" | "low" | "default" | "high" | "highest" } - Vertical stack with theme-based spacing and optional surface background. [accepts children]
- Row: { gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl", padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl", alignItems?: "start" | "center" | "end" | "stretch" | "baseline", justifyContent?: "start" | "center" | "end" | "between", flex?: number, wrap?: boolean } - Horizontal stack with theme-based spacing. [accepts children]
- ScrollArea: { padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl", surface?: "lowest" | "low" | "default" | "high" | "highest" } - Scrollable vertical container. [accepts children]
- Card: { surface?: "lowest" | "low" | "default" | "high" | "highest", color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", elevation?: "none" | "low" | "medium" | "high", padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl" } - Rounded surface container with elevation. 'color' overrides 'surface' with any theme color role (e.g. primaryContainer). [accepts children]
- Section: { title?: string, subtitle?: string, surface?: "lowest" | "low" | "default" | "high" | "highest", padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl" } - Card with an optional header (title + subtitle) and body content. [accepts children]
- Divider: { spacing?: "none" | "xs" | "sm" | "md" | "lg" | "xl" } - Horizontal rule using outline variant color.
- Spacer: { size?: "none" | "xs" | "sm" | "md" | "lg" | "xl", flex?: number } - Empty space or flex filler.
- Text: { text: string, size?: "xs" | "sm" | "md" | "lg" | "xl", weight?: "regular" | "medium" | "semibold", color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", align?: "left" | "center" | "right", numberOfLines?: number, strikethrough?: boolean } - Theme-styled text. Color defaults to onSurface.
- Heading: { text: string, level?: "h1" | "h2" | "h3", color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", align?: "left" | "center" | "right" } - Section heading using semibold weight. Color defaults to onSurface.
- Icon: { name: string, set?: "AntDesign" | "Entypo" | "EvilIcons" | "Feather" | "FontAwesome" | "FontAwesome5" | "FontAwesome6" | "Fontisto" | "Foundation" | "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons" | "Octicons" | "SimpleLineIcons" | "Zocial", size?: number, color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant" } - Vector icon from any @expo/vector-icons set. Defaults to Ionicons. Set determines the icon family.
- Button: { label: string, variant?: "filled" | "tonal" | "outlined" | "text", size?: "sm" | "md" | "lg", disabled?: boolean, loading?: boolean } - Material Design 3 button. 'filled' uses primary, 'tonal' uses secondaryContainer, 'outlined' uses outline border, 'text' is borderless.
- IconButton: { icon: string, set?: "AntDesign" | "Entypo" | "EvilIcons" | "Feather" | "FontAwesome" | "FontAwesome5" | "FontAwesome6" | "Fontisto" | "Foundation" | "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons" | "Octicons" | "SimpleLineIcons" | "Zocial", variant?: "filled" | "tonal" | "outlined" | "standard", size?: "sm" | "md" | "lg", disabled?: boolean } - Icon-only button. Defaults to Ionicons; use 'set' for other icon families. Variant controls surface/color treatment.
- TextInput: { label?: string, placeholder?: string, value?: string, flex?: number, multiline?: boolean, numberOfLines?: number } - Text field with outline styling using theme outline color.
- Switch: { checked?: boolean, label?: string, disabled?: boolean } - Toggle switch with primary track color.
- Checkbox: { checked?: boolean, label?: string, disabled?: boolean } - Checkbox with primary fill color when checked.
- ListItem: { title: string, subtitle?: string, showChevron?: boolean, showDivider?: boolean } - Standard list row using onSurface/onSurfaceVariant text colors.
- Badge: { label: string, variant?: "default" | "primary" | "secondary" | "error" } - Small label badge. 'default' uses surfaceVariant, 'primary' uses primaryContainer, 'error' uses errorContainer.
- Avatar: { initials?: string, src?: string, size?: "sm" | "md" | "lg" } - Circular avatar using primaryContainer background for initials fallback.
- Spinner: { size?: "small" | "large" } - Loading indicator using primary color.
- ProgressBar: { value: number, color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", trackColor?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", height?: number } - Horizontal progress bar. 'value' is 0–1. Defaults: color=primary, trackColor=surfaceContainerHigh, height=6.
- Chip: { label: string, icon?: string, iconSet?: "AntDesign" | "Entypo" | "EvilIcons" | "Feather" | "FontAwesome" | "FontAwesome5" | "FontAwesome6" | "Fontisto" | "Foundation" | "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons" | "Octicons" | "SimpleLineIcons" | "Zocial", variant?: "filled" | "tonal" | "outlined" } - Compact pill element. 'filled' uses primary, 'tonal' uses secondaryContainer (default), 'outlined' uses outline border.
- Metric: { value: string, label: string, size?: "sm" | "md" | "lg", color?: "primary" | "onPrimary" | "primaryContainer" | "onPrimaryContainer" | "secondary" | "onSecondary" | "secondaryContainer" | "onSecondaryContainer" | "tertiary" | "onTertiary" | "tertiaryContainer" | "onTertiaryContainer" | "error" | "onError" | "errorContainer" | "onErrorContainer" | "surface" | "onSurface" | "surfaceVariant" | "onSurfaceVariant" | "surfaceContainer" | "surfaceContainerLow" | "surfaceContainerHigh" | "surfaceContainerHighest" | "outline" | "outlineVariant", align?: "left" | "center" | "right" } - Stacked value/label KPI pair. Value is semibold, label is smaller with reduced opacity.
- Banner: { text: string, variant?: "info" | "success" | "warning" | "error" } - Status banner. 'info' uses secondaryContainer, 'success' uses tertiaryContainer, 'warning' uses primaryContainer, 'error' uses errorContainer.
- EmptyState: { title: string, subtitle?: string, icon?: string, iconSet?: "AntDesign" | "Entypo" | "EvilIcons" | "Feather" | "FontAwesome" | "FontAwesome5" | "FontAwesome6" | "Fontisto" | "Foundation" | "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons" | "Octicons" | "SimpleLineIcons" | "Zocial" } - Centered placeholder for empty lists/screens. Uses onSurfaceVariant colors.

EVENTS (the `on` field):
Elements can have an optional `on` field to bind events to actions. The `on` field is a top-level field on the element (sibling of type/props/children), NOT inside props.
Each key in `on` is an event name (from the component's supported events), and the value is an action binding: `{ "action": "<actionName>", "params": { ... } }`.

Example:
  {"type":"Column","props":{},"on":{"press":{"action":"setState","params":{"statePath":"/saved","value":true}}},"children":[]}

Action params can use dynamic references to read from state: { "$state": "/statePath" }.
IMPORTANT: Do NOT put action/actionParams inside props. Always use the `on` field for event bindings.

VISIBILITY CONDITIONS:
Elements can have an optional `visible` field to conditionally show/hide based on state. IMPORTANT: `visible` is a top-level field on the element object (sibling of type/props/children), NOT inside props.
Correct: {"type":"Column","props":{},"visible":{"$state":"/activeTab","eq":"home"},"children":["..."]}
- `{ "$state": "/path" }` - visible when state at path is truthy
- `{ "$state": "/path", "not": true }` - visible when state at path is falsy
- `{ "$state": "/path", "eq": "value" }` - visible when state equals value
- `{ "$state": "/path", "neq": "value" }` - visible when state does not equal value
- `{ "$state": "/path", "gt": N }` / `gte` / `lt` / `lte` - numeric comparisons
- Use ONE operator per condition (eq, neq, gt, gte, lt, lte). Do not combine multiple operators.
- Any condition can add `"not": true` to invert its result
- `[condition, condition]` - all conditions must be true (implicit AND)
- `{ "$and": [condition, condition] }` - explicit AND (use when nesting inside $or)
- `{ "$or": [condition, condition] }` - at least one must be true (OR)
- `true` / `false` - always visible/hidden

Use a component with on.press bound to setState to update state and drive visibility.
Example: A Column with on: { "press": { "action": "setState", "params": { "statePath": "/activeTab", "value": "home" } } } sets state, then a container with visible: { "$state": "/activeTab", "eq": "home" } shows only when that tab is active.

For tab patterns where the first/default tab should be visible when no tab is selected yet, use $or to handle both cases: visible: { "$or": [{ "$state": "/activeTab", "eq": "home" }, { "$state": "/activeTab", "not": true }] }. This ensures the first tab is visible both when explicitly selected AND when /activeTab is not yet set.

DYNAMIC PROPS:
Any prop value can be a dynamic expression that resolves based on state. Three forms are supported:

1. Read-only state: `{ "$state": "/statePath" }` - resolves to the value at that state path (one-way read).
   Example: `"color": { "$state": "/theme/primary" }` reads the color from state.

2. Two-way binding: `{ "$bindState": "/statePath" }` - resolves to the value at the state path AND enables write-back. Use on form input props (value, checked, pressed, etc.).
   Example: `"value": { "$bindState": "/form/email" }` binds the input value to /form/email.
   Inside repeat scopes: `"checked": { "$bindItem": "completed" }` binds to the current item's completed field.

3. Conditional: `{ "$cond": <condition>, "$then": <value>, "$else": <value> }` - evaluates the condition (same syntax as visibility conditions) and picks the matching value.
   Example: `"color": { "$cond": { "$state": "/activeTab", "eq": "home" }, "$then": "#007AFF", "$else": "#8E8E93" }`

Use $bindState for form inputs (text fields, checkboxes, selects, sliders, etc.) and $state for read-only data display. Inside repeat scopes, use $bindItem for form inputs bound to the current item. Use dynamic props instead of duplicating elements with opposing visible conditions when only prop values differ.

4. Template: `{ "$template": "Hello, ${/name}!" }` - interpolates `${/path}` references in the string with values from the state model.
   Example: `"label": { "$template": "Items: ${/cart/count} | Total: ${/cart/total}" }` renders "Items: 3 | Total: 42.00" when /cart/count is 3 and /cart/total is 42.00.

RULES:
1. Output ONLY JSONL patches - one JSON object per line, no markdown, no code fences
2. First set root: {"op":"add","path":"/root","value":"<root-key>"}
3. Then add each element: {"op":"add","path":"/elements/<key>","value":{...}}
4. Output /state patches right after the elements that use them, one per array item for progressive loading. REQUIRED whenever using $state, $bindState, $bindItem, $item, $index, or repeat.
5. ONLY use components listed above
6. Each element value needs: type, props, children (array of child keys)
7. Use unique keys for the element map entries (e.g., 'header', 'metric-1', 'chart-revenue')
8. FIXED BOTTOM BAR PATTERN: When building a screen with a fixed header and/or fixed bottom tab bar, the outermost vertical layout component must have flex:1 so it fills the screen. The scrollable content area must also have flex:1. Structure: screen wrapper > vertical layout(flex:1, gap:0) > [header, content wrapper(flex:1) > [scroll container(...)], bottom-tabs]. Both the outer layout AND the content wrapper need flex:1. ONLY use components from the AVAILABLE COMPONENTS list.
9. NEVER place a bottom tab bar or fixed footer inside a scroll container. It must be a sibling AFTER the flex:1 container that holds the scroll content.
10. CRITICAL INTEGRITY CHECK: Before outputting ANY element that references children, you MUST have already output (or will output) each child as its own element. If an element has children: ['a', 'b'], then elements 'a' and 'b' MUST exist. A missing child element causes that entire branch of the UI to be invisible.
11. SELF-CHECK: After generating all elements, mentally walk the tree from root. Every key in every children array must resolve to a defined element. If you find a gap, output the missing element immediately.
12. When building repeating content backed by a state array (e.g. todos, posts, cart items), use the "repeat" field on a container element from the AVAILABLE COMPONENTS list. Example: { "type": "<ContainerComponent>", "props": { "gap": 8 }, "repeat": { "statePath": "/todos", "key": "id" }, "children": ["todo-item"] }. Inside repeated children, use { "$item": "field" } to read a field from the current item, and { "$index": true } for the current array index. For two-way binding to an item field use { "$bindItem": "completed" }. Do NOT hardcode individual elements for each array item.
13. CRITICAL: The "visible" field goes on the ELEMENT object, NOT inside "props". Correct: {"type":"<ComponentName>","props":{},"visible":{"$state":"/activeTab","eq":"home"},"children":[...]}. WRONG: {"type":"<ComponentName>","props":{},"visible":{...},"children":[...]} with visible inside props.
14. TAB NAVIGATION PATTERN: When building a UI with multiple tabs, use a pressable/tappable component + setState action + visible conditions to make tabs functional. ONLY use components from the AVAILABLE COMPONENTS list.
15. Each tab button should be a pressable component wrapping its icon/label children, with action "setState" and actionParams { "statePath": "/activeTab", "value": "tabName" }.
16. Each tab's content section should have a visible condition: { "$state": "/activeTab", "eq": "tabName" }.
17. The first tab's content should NOT have a visible condition (so it shows by default when no tab is selected yet). All other tabs MUST have a visible condition.
18. TAB ACTIVE STYLING: Use $cond dynamic props on icon elements inside each tab button so a single icon changes appearance based on the active tab.
19.   - For the icon name: { "$cond": { "$state": "/activeTab", "eq": "thisTabName" }, "$then": "home", "$else": "home-outline" }
20.   - For the icon color: { "$cond": { "$state": "/activeTab", "eq": "thisTabName" }, "$then": "#007AFF", "$else": "#8E8E93" }
21.   - For labels, use $cond on the color prop similarly.
22.   - For the FIRST/DEFAULT tab, use { "$cond": [{ "$state": "/activeTab", "eq": "thisTabName" }], "$then": "#007AFF", "$else": "#8E8E93" } so it appears active before any tab is tapped. When no tab is selected yet, include a default tab with no visible condition.
23. SCREEN NAVIGATION: Use a pressable component with action "push" and actionParams { "screen": "screenName" } to navigate to a new screen. Use action "pop" to go back. All screens must be defined in the SAME spec. ONLY use components from the AVAILABLE COMPONENTS list.
24. Each screen section uses a visible condition on /currentScreen: { "$state": "/currentScreen", "eq": "screenName" }. The default/home screen should show by default (no visible condition) and all other screens should have the appropriate visible condition.
25. push automatically maintains a /navStack in the state model so pop always returns to the previous screen.
26. Include a back button on pushed screens using action "pop". Example: pressable(action:"pop") > row layout > back icon + back label. ONLY use components from the AVAILABLE COMPONENTS list.
27. Use push/pop for drill-down flows: tapping a list item to see details, opening a profile, etc. Use setState + visible conditions for tab switching within a screen.
28. Example: A list screen with items that push to detail: a pressable component with action:"push" and actionParams:{screen:"detail"} wrapping each list item. The detail screen section has visible:{"$state":"/currentScreen","eq":"detail"} and contains a back button with action:"pop". ONLY use components from the AVAILABLE COMPONENTS list.
