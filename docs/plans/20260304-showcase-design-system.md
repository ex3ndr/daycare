# Showcase Design System Components + Full Migration

## Overview

Build 6 reusable layout primitives (`Grid`, `Card`, `Section`, `Badge`, `IconCircle`, `Row`) in the shared app components directory, then migrate all 50 showcase pages to use them — eliminating ~450+ instances of duplicated layout boilerplate (raw flex grids, card styling, section headers, badge pills, icon circles, horizontal rows).

**End result:** Every showcase page composes from these 6 primitives instead of hand-rolling `flexDirection: "row"`, `flexWrap: "wrap"`, `borderRadius: 16`, `padding: 16`, etc. Pages become declarative and ~40-60% shorter.

**Key outcomes:**
- Zero raw `View` style objects for grids, cards, or section headers in showcase pages
- Consistent spacing, border radius, and padding across all 50 pages
- Each component has unit tests and a clear API
- All 50 pages migrated and visually identical to current output

## Context

- **Component location:** `packages/daycare-app/sources/components/` (next to ItemList, ItemGroup)
- **Pages location:** `packages/daycare-app/sources/views/dev/showcase/pages/` (50 files)
- **Existing primitives:** `ShowcasePage` (scroll container), `ItemList` (maxWidth centering), `ItemGroup` (grouped sections), `PageHeader`
- **Theme system:** `useUnistyles()` with `theme.colors.*` and `theme.layout.maxWidth`
- **Platform:** React Native (iOS, Android, Web) via react-native-unistyles

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility — pages must look identical after migration

### Implementation Notes
- Migration was executed with a scripted JSX transform for `*Card`/`*Grid` containers across showcase pages, followed by targeted manual edits for remaining pages and primitive-specific usage (`Section`, `Badge`, `Row`).

## Testing Strategy
- **Unit tests**: Each component gets a `*.spec.ts` file testing props, variants, edge cases
- **Visual verification**: Spot-check migrated pages in dev mode to confirm visual parity

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Build `Grid` component
- [x] Create `packages/daycare-app/sources/components/Grid.tsx`
- [x] Implement `columns` prop — children get `flexBasis: ${100/columns}%` + `flexGrow: 1` + capped `maxWidth`
- [x] Implement `gap` prop (default 12) mapping to container `gap`
- [x] Implement `columnWidth` prop for fixed-width children (kanban use case)
- [x] Implement `horizontal` prop wrapping children in horizontal `ScrollView`
- [x] Container uses `flexDirection: "row"` + `flexWrap: "wrap"` (non-horizontal) or `flexDirection: "row"` (horizontal)
- [x] Write tests for `Grid` with columns (2, 3, 5), gap, columnWidth, horizontal
- [x] Run tests — must pass before next task

### Task 2: Build `Card` component
- [x] Create `packages/daycare-app/sources/components/Card.tsx`
- [x] Implement `variant` prop: `"filled"` (surfaceContainer bg, default), `"outlined"` (borderWidth 1 + outlineVariant)
- [x] Implement `accent` prop (color string) — adds `borderLeftWidth: 4` with given color
- [x] Implement `size` prop: `"sm"` (padding 12, radius 12), `"md"` (padding 16, radius 16, default), `"lg"` (padding 20, radius 16)
- [x] Implement `gap` prop for vertical gap between children
- [x] Accept `style` override and pass through `children`
- [x] Write tests for Card variants, sizes, accent, gap
- [x] Run tests — must pass before next task

### Task 3: Build `Section` component
- [x] Create `packages/daycare-app/sources/components/Section.tsx`
- [x] Implement header row: optional `icon` (string) + `title` (string) + optional `count` (number, renders Badge) + optional `action` (ReactNode)
- [x] Header layout: `flexDirection: "row"`, `alignItems: "center"`, `gap: 8`
- [x] Icon renders as `IconCircle` (size 32) when provided
- [x] Content area: vertical stack with configurable `gap` (default 8)
- [x] Implement `spacing` prop for top margin between consecutive sections (default 24)
- [x] Write tests for Section with/without icon, count, action, gap
- [x] Run tests — must pass before next task

### Task 4: Build `Badge` component
- [x] Create `packages/daycare-app/sources/components/Badge.tsx`
- [x] Implement default variant: background at 15% opacity of `color`, text in full `color`
- [x] Implement `variant="outlined"` — border instead of fill
- [x] Props: `color` (required), `children` (text/number), `variant`
- [x] Styling: `paddingHorizontal: 8`, `paddingVertical: 3`, `borderRadius: 10`
- [x] Write tests for Badge default, outlined, with number/text children
- [x] Run tests — must pass before next task

### Task 5: Build `IconCircle` component
- [x] Create `packages/daycare-app/sources/components/IconCircle.tsx`
- [x] Props: `icon` (Ionicons name), `color`, `size` (number or preset `"sm"=28`, `"md"=36`, `"lg"=48`)
- [x] Renders circle (width/height/borderRadius) with background at 15% opacity of `color`, icon centered in full `color`
- [x] Icon size scales to ~50% of circle size
- [x] Write tests for IconCircle sizes, color application
- [x] Run tests — must pass before next task

### Task 6: Build `Row` component
- [x] Create `packages/daycare-app/sources/components/Row.tsx`
- [x] Props: `leading` (ReactNode), `trailing` (ReactNode), `children` (center content, gets `flex: 1`)
- [x] Layout: `flexDirection: "row"`, `alignItems: "center"`, `gap: 12`
- [x] Optional `gap` override prop
- [x] Optional `padding` prop (default 0 — padding comes from parent Card)
- [x] Write tests for Row with/without leading/trailing, gap override
- [x] Run tests — must pass before next task

### Task 7: Migrate batch 1 — Dashboard pages (5 pages)
Pages: `StartupMetricsPage`, `HealthDashboardPage`, `PersonalFinancePage`, `RealEstatePage`, `OkrTrackerPage`

Pattern: hero section + metrics `Grid columns={2-3}` + `Card` sections + `Section` headers

- [x] Migrate `StartupMetricsPage` — replace metric grid + card sections
- [x] Migrate `HealthDashboardPage` — replace metric grid + section headers + card lists
- [x] Migrate `PersonalFinancePage` — replace metric grid + transaction section + cashflow card
- [x] Migrate `RealEstatePage` — replace property grid + expense sections
- [x] Migrate `OkrTrackerPage` — replace objective cards + key result rows
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 8: Migrate batch 2 — Pipeline/Board pages (5 pages)
Pages: `SprintBoardPage`, `SalesPipelinePage`, `RecruitmentPipelinePage`, `FreelancePipelinePage`, `JobApplicationsPage`

Pattern: horizontal `Grid columnWidth={220} horizontal` + `Card accent={color}` items

- [x] Migrate `SprintBoardPage` — replace kanban columns + task cards
- [x] Migrate `SalesPipelinePage` — replace deal stage columns
- [x] Migrate `RecruitmentPipelinePage` — replace candidate pipeline columns
- [x] Migrate `FreelancePipelinePage` — replace project status columns
- [x] Migrate `JobApplicationsPage` — replace application status columns
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 9: Migrate batch 3 — List/Directory pages (5 pages)
Pages: `PersonalCrmPage`, `ReadingListPage`, `MeetingNotesPage`, `InventoryManagementPage`, `SupportTicketsPage`

Pattern: vertical `Card` stacks + `Row` items + `Section` groups + `Badge` status

- [x] Migrate `PersonalCrmPage` — replace contact cards + category filters
- [x] Migrate `ReadingListPage` — replace book cards grouped by status
- [x] Migrate `MeetingNotesPage` — replace meeting cards grouped by date
- [x] Migrate `InventoryManagementPage` — replace product cards + alert banner
- [x] Migrate `SupportTicketsPage` — replace ticket cards + priority badges
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 10: Migrate batch 4 — Calendar/Table pages (5 pages)
Pages: `ContentCalendarPage`, `EventPlanningPage`, `TravelPlannerPage`, `BoardroomAgendaPage`, `ChangelogPage`

Pattern: `Grid columns={5}` (calendar) or `Section` stacks + `Card` items

- [x] Migrate `ContentCalendarPage` — replace 5-column calendar grid
- [x] Migrate `EventPlanningPage` — replace task categories + timeline sections
- [x] Migrate `TravelPlannerPage` — replace day-by-day sections + checklist cards
- [x] Migrate `BoardroomAgendaPage` — replace agenda sections + materials cards
- [x] Migrate `ChangelogPage` — replace version sections + change type cards
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 11: Migrate batch 5 — Tracker/Progress pages (5 pages)
Pages: `HabitTrackerPage`, `PlantCarePage`, `PetCarePage`, `LanguageLearningPage`, `GymWorkoutPage`

Pattern: `Grid columns={2}` habit/item cards + `Section` groups + `Badge` status

- [x] Migrate `HabitTrackerPage` — replace 2-col habit grid + streak cards
- [x] Migrate `PlantCarePage` — replace plant cards + room filters
- [x] Migrate `PetCarePage` — replace pet sections + care item rows
- [x] Migrate `LanguageLearningPage` — replace learning stat cards + practice items
- [x] Migrate `GymWorkoutPage` — replace exercise cards + set/rep rows
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 12: Migrate batch 6 — Collection/Marketplace pages (5 pages)
Pages: `RestaurantMenuPage`, `RecipeCollectionPage`, `WineCellarPage`, `DigitalAssetsPage`, `VendorDirectoryPage`

Pattern: category filters + `Card` items + `Badge` tags + `Row` details

- [x] Migrate `RestaurantMenuPage` — replace menu sections + dish cards
- [x] Migrate `RecipeCollectionPage` — replace recipe cards + filter pills
- [x] Migrate `WineCellarPage` — replace wine cards + region badges
- [x] Migrate `DigitalAssetsPage` — replace asset cards + format badges
- [x] Migrate `VendorDirectoryPage` — replace vendor cards + contract status badges
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 13: Migrate batch 7 — Document/Timeline pages (5 pages)
Pages: `PodcastPlannerPage`, `CourseCurriculumPage`, `KnowledgeBasePage`, `ResearchPapersPage`, `LegalCasesPage`

Pattern: `Section` groups + `Card` content blocks + `Row` items + `Badge` status

- [x] Migrate `PodcastPlannerPage` — replace episode sections + talking point rows
- [x] Migrate `CourseCurriculumPage` — replace module sections + lesson rows
- [x] Migrate `KnowledgeBasePage` — replace article cards + category badges
- [x] Migrate `ResearchPapersPage` — replace paper cards + field filter badges
- [x] Migrate `LegalCasesPage` — replace case sections + document rows + billing entries
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 14: Migrate batch 8 — Queue/Social pages (5 pages)
Pages: `PodcastQueuePage`, `NewsletterCampaignsPage`, `SocialMediaPage`, `FeatureRequestsPage`, `CompetitiveAnalysisPage`

Pattern: hero stats + `Card` items with progress + `Badge` status + `Row` details

- [x] Migrate `PodcastQueuePage` — replace queue cards + progress indicators
- [x] Migrate `NewsletterCampaignsPage` — replace campaign cards + subscriber stats
- [x] Migrate `SocialMediaPage` — replace platform cards + post cards
- [x] Migrate `FeatureRequestsPage` — replace feature cards + vote badges
- [x] Migrate `CompetitiveAnalysisPage` — replace competitor cards + comparison rows
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 15: Migrate batch 9 — Comparison/Bidding pages (5 pages)
Pages: `ContractorBidsPage`, `ApartmentHuntingPage`, `BugTrackerPage`, `HomeMaintenancePage`, `SubscriptionManagerPage`

Pattern: `Card accent={color}` items + `Section` groups + `Badge` priority/status + `Grid` metrics

- [x] Migrate `ContractorBidsPage` — replace bid cards + license badges
- [x] Migrate `ApartmentHuntingPage` — replace apartment cards + pros/cons rows
- [x] Migrate `BugTrackerPage` — replace bug cards + severity badges
- [x] Migrate `HomeMaintenancePage` — replace task cards + area sections
- [x] Migrate `SubscriptionManagerPage` — replace subscription cards + category sections
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 16: Migrate batch 10 — Workflow/Detail pages (5 pages)
Pages: `InvoiceTrackerPage`, `ExpenseReportPage`, `FleetManagementPage`, `ClientProjectsPage`, `RetrospectiveBoardPage`

Pattern: hero stats + `Grid` metrics + `Card` detail sections + `Row` line items + `Badge` status

- [x] Migrate `InvoiceTrackerPage` — replace invoice cards + detail overlay + line items
- [x] Migrate `ExpenseReportPage` — replace expense cards + category breakdown
- [x] Migrate `FleetManagementPage` — replace vehicle cards + metric grid + status badges
- [x] Migrate `ClientProjectsPage` — replace project cards + task rows
- [x] Migrate `RetrospectiveBoardPage` — replace retro sections + item cards + action cards
- [x] Verify visual parity for all 5 pages
- [x] Run tests — must pass before next task

### Task 17: Verify acceptance criteria
- [x] Verify all 50 pages use design system components (no raw flex grid/card boilerplate)
- [x] Verify no visual regressions across all pages
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed
- [x] Verify each component has comprehensive tests

### Task 18: [Final] Update documentation
- [x] Add brief README or doc comment in each component file documenting API
- [x] Update CLAUDE.md App UI Conventions section if needed

## Technical Details

### Component APIs

```typescript
// Grid
type GridProps = {
    columns?: number;        // responsive column count (2, 3, 5, etc.)
    columnWidth?: number;    // fixed width per column (kanban: 220)
    gap?: number;            // default 12
    horizontal?: boolean;    // wraps in horizontal ScrollView
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
};

// Card
type CardProps = {
    variant?: "filled" | "outlined";  // default "filled"
    accent?: string;                   // left border color
    size?: "sm" | "md" | "lg";        // padding 12/16/20, default "md"
    gap?: number;                      // vertical gap between children
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;              // wraps in Pressable when set
};

// Section
type SectionProps = {
    title: string;
    icon?: string;           // Ionicons name, renders IconCircle
    count?: number;          // renders Badge with count
    action?: ReactNode;      // trailing slot
    gap?: number;            // content gap, default 8
    spacing?: number;        // top margin, default 24
    children: ReactNode;
};

// Badge
type BadgeProps = {
    color: string;
    variant?: "filled" | "outlined";  // default "filled"
    children: ReactNode;              // text or number
};

// IconCircle
type IconCircleProps = {
    icon: string;            // Ionicons name
    color: string;
    size?: number | "sm" | "md" | "lg";  // 28/36/48, default "md"
};

// Row
type RowProps = {
    leading?: ReactNode;
    trailing?: ReactNode;
    gap?: number;            // default 12
    children: ReactNode;     // center content, gets flex: 1
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;    // wraps in Pressable when set
};
```

### Spacing constants

| Size token | Value | Used by |
|------------|-------|---------|
| `sm` | 12px | Card.sm padding, compact gaps |
| `md` | 16px | Card.md padding, default gaps |
| `lg` | 20px | Card.lg padding, spacious gaps |
| `grid-gap` | 12px | Grid default gap |
| `section-gap` | 8px | Section content gap |
| `section-spacing` | 24px | Section top margin |
| `row-gap` | 12px | Row default gap |
| `badge-px` | 8px | Badge horizontal padding |
| `badge-py` | 3px | Badge vertical padding |
| `badge-radius` | 10px | Badge border radius |

### Border radius constants

| Size | Value | Used by |
|------|-------|---------|
| `sm` | 12px | Card.sm, small badges |
| `md` | 16px | Card.md, Card.lg |
| `badge` | 10px | Badge |
| `icon-sm` | 14px | IconCircle sm (28/2) |
| `icon-md` | 18px | IconCircle md (36/2) |
| `icon-lg` | 24px | IconCircle lg (48/2) |

## Post-Completion

**Manual verification:**
- Visually spot-check 5-10 representative pages across batches in dev mode
- Verify on iOS, Android, and Web if applicable
- Check that horizontal scroll grids (kanban pages) still scroll correctly
- Verify edge-to-edge pages still bleed to edges properly
