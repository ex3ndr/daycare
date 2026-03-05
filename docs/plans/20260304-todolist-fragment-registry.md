# TodoList Fragment Registry Component

## Overview
Add a `TodoList` fragment component to the json-render catalog and registry. The component wraps `ReorderingList` for drag-and-drop reordering, reads items from bound state, and renders customizable fixed-height todo rows internally.

**What the user gets:**
- A `TodoList` component usable in fragment JSON specs
- State-bound: reads items array from state path, renders rows automatically
- Each item supports: checkbox, title (inline-editable), icons, counter, two-state toggle icon, pill badge, hint text
- Special `separator` item type renders as a category header within the same collection
- Full drag-and-drop reordering via existing `ReorderingList`/`ReorderingList2`
- All four events: `move`, `press`, `toggle`, `toggleIcon`, plus `change` for edits
- Theme-aware via existing token resolvers

**Key outcomes:**
- AI agents can generate fragment specs with interactive todo lists
- Items are fixed-height (48px web / 56px mobile, matching existing `TODO_HEIGHT`)
- Drag-and-drop works identically to the existing todos view

## Context
- Fragment catalog: `packages/daycare-app/sources/fragments/catalog.ts`
- Fragment registry: `packages/daycare-app/sources/fragments/registry.tsx`
- Existing TodoView: `packages/daycare-app/sources/views/todos/TodoView.tsx` (reference, not reused)
- ReorderingList: `packages/daycare-app/sources/components/ReorderingList.tsx` (web)
- ReorderingList2: `packages/daycare-app/sources/components/ReorderingList2.tsx` (mobile)
- Token resolvers already in registry: `colorResolve`, `spacingResolve`, `iconSets`, `renderIcon`

## Development Approach
- **Testing approach**: Code first, then tests
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add TodoList component schema to catalog
- [x] Add `TodoList` component to `fragmentsCatalog` in `catalog.ts` with props:
  - `items`: bound state path (the array comes via `$bindState`)
  - `itemHeight`: number (nullable, defaults to platform-aware 48/56)
  - `gap`: spacing schema (nullable, defaults to 4/8)
  - `showCheckbox`: boolean (nullable, default true)
  - `toggleIcon`: object (nullable) — `{ icon: string, activeIcon: string, set?: string, color?: string, activeColor?: string }`
  - `editable`: boolean (nullable, default false)
  - `pillColor`: color schema (nullable) — pill background color
  - `pillTextColor`: color schema (nullable) — pill text color
- [x] Define item data shape in a JSDoc/description so AI knows the expected state structure:
  ```
  Regular: { id, title, done, type?: "item", icons?: [{name, set?, color?}], counter?: {current, total},
    toggleIcon?: {active}, pill?: string, hint?: string }
  Separator: { id, title, type: "separator" }
  ```
- [x] Slots: none (items rendered from state, not children)
- [x] Write tests for catalog schema validation (valid/invalid props)
- [x] Run tests — must pass before next task

### Task 2: Implement TodoItem and TodoSeparator internal components
- [x] Create `packages/daycare-app/sources/fragments/TodoItem.tsx`
- [x] Implement `TodoItem` as a React.memo component (NOT registered in catalog)
- [x] Props: `id`, `title`, `done`, `icons`, `counter`, `toggleIcon` (with config from parent), `pill`, `hint`, `editable`, `showCheckbox`, `pillColor`, `pillTextColor`
- [x] Fixed height matching `TODO_HEIGHT` (48 web / 56 mobile)
- [ ] Layout (left to right):
  1. Checkbox (optional, circular, matches existing style)
  2. Title text (inline-editable when `editable=true`, with TextInput)
  3. Icons array (any number of small icons)
  4. Counter badge ("2/5" style)
  5. Pill badge (colored background, text)
  6. Hint text (small, truncated)
  7. Toggle icon (two states: active/inactive icons+colors)
- [x] Use `renderIcon` from registry for all icons
- [x] Use `useUnistyles` for theme access
- [x] Platform-aware: GestureDetector on web, Pressable on mobile (matching existing pattern)
- [x] Callbacks: `onToggle`, `onToggleIcon`, `onPress`, `onValueChange`
- [x] Create `packages/daycare-app/sources/fragments/TodoSeparator.tsx`
- [x] Implement `TodoSeparator` as a React.memo component — same fixed height, renders category label with divider line (matching `TaskHeaderView` style: uppercase text + thin rule)
- [x] Separator is draggable like any other item (part of same collection), pressable with `onPress` callback
- [x] Write tests for TodoItem rendering (checkbox states, icon rendering, pill display)
- [x] Write tests for TodoSeparator rendering
- [x] Run tests — must pass before next task

### Task 3: Implement TodoList in the registry
- [x] Add `TodoList` to the `components` object in `registry.tsx`
- [x] Read items from bound state via `useBoundProp` or `useStateValue`
- [x] Use `ReorderingList` (web) / `ReorderingList2` (mobile) for drag-and-drop
- [x] Render each item based on `type` field: `TodoSeparator` for `type: "separator"`, `TodoItem` for everything else
- [x] Emit events with item id:
  - `move` — `emit("move")` when dragged (pass id + new index via state update)
  - `press` — `emit("press")` when item tapped
  - `toggle` — `emit("toggle")` when checkbox toggled
  - `toggleIcon` — `emit("toggleIcon")` when toggle icon tapped
  - `change` — `emit("change")` when title edited
- [x] Handle state updates for toggle/toggleIcon/change directly (update items array in state)
- [x] Write tests for TodoList integration (items rendering, event emission)
- [x] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [x] Verify all item features work: checkbox, icons, counter, toggleIcon, pill, hint, editable title
- [x] Verify fixed height constraint (all items same height)
- [ ] Verify drag-and-drop reordering works (web + mobile paths)
- [ ] Verify theme tokens resolve correctly (colors, spacing)
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed
- [x] Run typecheck — must pass

### Task 5: [Final] Update documentation
- [x] Add component usage examples to catalog description/JSDoc
- [x] Update any relevant fragment docs if they exist

⚠️ Full workspace `yarn test` currently has unrelated existing failures in `packages/daycare`:
- `sources/plugins/telegram/connector.spec.ts` (2 failing tests)
- `sources/sandbox/runtime.spec.ts` (1 failing integration test)

## Technical Details

### Item State Shape
```typescript
// Regular todo item
interface TodoListItem {
    id: string;
    type?: "item";          // default, can be omitted
    title: string;
    done: boolean;
    icons?: Array<{ name: string; set?: string; color?: string }>;
    counter?: { current: number; total: number };
    toggleIcon?: { active: boolean };
    pill?: string;
    hint?: string;
}

// Separator item — rendered as a category header divider
interface TodoListSeparator {
    id: string;
    type: "separator";
    title: string;           // section label (e.g. "Work", "Personal")
}
```

### Event Flow
- `toggle`: TodoItem checkbox tap → update `done` in state → emit "toggle"
- `toggleIcon`: TodoItem icon tap → update `toggleIcon.active` in state → emit "toggleIcon"
- `change`: TodoItem title edit → update `title` in state → emit "change"
- `move`: ReorderingList drag → reorder items array in state → emit "move"
- `press`: TodoItem tap → emit "press"

### Example Fragment Spec Usage
```json
{
    "state": {
        "todos": [
            { "id": "s1", "type": "separator", "title": "Work" },
            { "id": "1", "title": "Review PR", "done": true, "counter": { "current": 3, "total": 5 } },
            { "id": "2", "title": "Deploy staging", "done": false, "pill": "Today" },
            { "id": "s2", "type": "separator", "title": "Personal" },
            { "id": "3", "title": "Buy groceries", "done": false }
        ]
    },
    "root": {
        "type": "TodoList",
        "props": {
            "items": { "$bindState": "/todos" },
            "showCheckbox": true,
            "editable": true,
            "toggleIcon": {
                "icon": "star",
                "activeIcon": "star-fill",
                "set": "Octicons",
                "color": "onSurfaceVariant",
                "activeColor": "tertiary"
            }
        }
    }
}
```

## Post-Completion

**Manual verification:**
- Test drag-and-drop on web browser
- Test on mobile device if available
- Verify AI can generate valid specs using the new component
