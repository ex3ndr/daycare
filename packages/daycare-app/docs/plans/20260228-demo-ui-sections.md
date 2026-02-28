# Demo UI Sections

## Overview
Replace the placeholder views with demo UI screens showing static/hardcoded data for 5 sections: Agents, People, Email, Crons, and Costs. Settings remains as-is. The segmented control in AppHeader expands from 3 to 6 items (icons + short labels), made horizontally scrollable to fit.

**End result**: A visually complete demo app where each section displays realistic-looking lists using the existing Item/ItemGroup/ItemList components. No API calls — all data is hardcoded. The user can switch between sections via the segmented control and see populated list views.

## Context
- **Files involved**: `AppHeader.tsx`, `(app)/index.tsx`, views (`AgentsView`, `ChatView`, `SettingsView`), new view files
- **Patterns**: Item/ItemGroup/ItemListStatic for lists, useUnistyles for theming, Octicons for icons
- **Current state**: 3 modes (agents/chat/settings) with placeholder "select an item" views

## Development Approach
- Complete each task fully before moving to the next
- No tests needed — this is pure demo UI with no logic to test
- Run lint + typecheck after each task

## Implementation Steps

### Task 1: Expand AppMode and update AppHeader segmented control
- [ ] Update `AppMode` type in `AppHeader.tsx` to: `"agents" | "people" | "email" | "crons" | "costs" | "settings"`
- [ ] Make the segmented control a horizontal `ScrollView` (scrollable, no scrollbar) to fit 6 items
- [ ] Add segment buttons for all 6 modes with Octicons: `device-desktop` (Agents), `people` (People), `mail` (Email), `clock` (Crons), `credit-card` (Costs), `gear` (Settings)
- [ ] Reduce `paddingHorizontal` on segment buttons from 16 to 12 to be more compact
- [ ] Run lint + typecheck

### Task 2: Create AgentsView with demo agent list
- [ ] Replace placeholder in `AgentsView.tsx` with a list of 5-6 hardcoded agents
- [ ] Each agent shows: name (title), role (subtitle), status badge as rightElement (colored dot + "Running"/"Idle"/"Error"/"Paused")
- [ ] Use `ItemGroup` sections: "Active" (running agents) and "Inactive" (idle/paused agents)
- [ ] Use `ItemListStatic` wrapper with `ItemGroup` sections
- [ ] Run lint + typecheck

### Task 3: Create PeopleView with demo contacts list
- [ ] Create `sources/views/PeopleView.tsx`
- [ ] Show 6-8 hardcoded contacts with: name (title), email (subtitle), Avatar leftElement
- [ ] Group by section: "Team" and "External"
- [ ] Run lint + typecheck

### Task 4: Create EmailView with demo inbox
- [ ] Create `sources/views/EmailView.tsx`
- [ ] Show 8-10 hardcoded emails: sender (title), subject (subtitle), date as detail
- [ ] Group into "Unread" and "Earlier" sections
- [ ] Unread items use `IBMPlexSans-SemiBold` titleStyle to look bold
- [ ] Run lint + typecheck

### Task 5: Create CronsView with demo scheduled jobs
- [ ] Create `sources/views/CronsView.tsx`
- [ ] Show 5-6 hardcoded cron jobs: name (title), schedule expression (subtitle), status + next run as detail/rightElement
- [ ] Group into "Active" and "Disabled" sections
- [ ] Status shown as colored dot similar to agents
- [ ] Run lint + typecheck

### Task 6: Create CostsView with demo cost breakdown
- [ ] Create `sources/views/CostsView.tsx`
- [ ] Show a summary header section with total cost (e.g., "$142.50 this month")
- [ ] Item list with per-agent/service cost breakdown: name (title), usage note (subtitle), cost as detail (e.g., "$45.20")
- [ ] Group into "By Agent" and "By Service" sections
- [ ] Run lint + typecheck

### Task 7: Wire up index.tsx to new modes and views
- [ ] Update `leftItems` record in `index.tsx` to have entries for all 6 modes
- [ ] Update `PanelTwo` to render the correct view for each mode
- [ ] Update `PanelThree` as needed (can remain undefined for new modes)
- [ ] Set default mode to `"agents"`
- [ ] Remove old `ChatView` file (replaced by `EmailView`)
- [ ] Run lint + typecheck

### Task 8: Final verification
- [ ] Run `yarn lint` — fix all issues
- [ ] Run `yarn typecheck` — fix all issues
- [ ] Verify all 6 segments render in the header
- [ ] Verify each mode shows its populated list view

## Technical Details
- All demo data is inline in each view file (no separate data files)
- Status badges use small View with backgroundColor + Text for colored dots
- Font references: `IBMPlexSans-Regular` (body), `IBMPlexSans-SemiBold` (emphasis)
- Icons: Octicons throughout for consistency
- No new dependencies required

## Post-Completion
- Manual verification: open in web browser, switch between all 6 tabs
- Check responsive behavior with TreePanelLayout
