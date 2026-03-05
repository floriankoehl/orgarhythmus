# Prompt Engine — Architecture & Reuse Guide

> **Last updated:** 2026-03-05 (Dependencies domain — Phase 3)

## Overview

The Prompt Engine is a centralised system for building AI-ready clipboard text from
project data. It powers the **I/O button** in each window's title bar, assembling
structured JSON payloads with surrounding prompt instructions.

Two consumption modes:
1. **Manual clipboard** — user copies a prompt, pastes it into ChatGPT / Claude, then
   pastes the AI response back into the Import tab.
2. **Direct generate** — one-click "Generate" button in the toolbar sends the prompt to
   the backend OpenAI proxy (`POST /api/ai/generate/`) and auto-applies the response
   through the `ControlledApplyPanel`.

---

## Directory Structure

```
frontend/src/components/shared/promptEngine/
├── index.js                          # Public API re-exports
├── registry.js                       # Scenario lookup + grid metadata + domain filtering
├── assembler.js                      # assemblePrompt() — builds clipboard text
├── responseApplier.js                # IdeaBin: parses AI responses, detects, previews & applies
├── changeBuilder.js                  # IdeaBin: converts detected items into granular change-ops
├── taskResponseApplier.js            # Task Structure: detects, previews & applies task/team changes
├── taskChangeBuilder.js              # Task Structure: granular change-ops for tasks/teams
├── depResponseApplier.js             # Dependencies: detects, previews & applies milestone/dep changes
├── depChangeBuilder.js               # Dependencies: granular change-ops with conflict detection
├── ControlledApplyPanel.jsx          # Human-in-the-loop review modal (shared by all domains)
├── PROMPT_ENGINE.md                  # This documentation
└── scenarios/
    ├── ideabinScenarios.js           # All IdeaBin scenarios (24) + IDEABIN_GRID
    ├── taskScenarios.js              # Task Structure scenarios (15) + TASK_GRID
    └── depScenarios.js               # Dependency scenarios (8) + DEP_GRID

frontend/src/components/ideas/
├── IdeaBinIOPopup.jsx                # Grid-based export/import popup UI (IdeaBin)
├── IdeaBinTitleBar.jsx               # Title bar with I/O + Generate buttons
└── IdeaBin.jsx                       # Main IdeaBin — wires ctx, applyCtx, AI generate

frontend/src/components/tasks_classification/
├── TaskStructureIOPopup.jsx          # Grid-based export/import popup UI (Task Structure)
├── TaskStructureTitleBar.jsx         # Title bar with I/O button
└── TaskStructure.jsx                 # Main TaskStructure — wires ioCtx, applyCtx

frontend/src/grid_board/
├── DependencyIOPopup.jsx             # Grid-based export/import popup UI (Dependencies)
├── ScheduleTitleBar.jsx              # Title bar with I/O button + view selector
├── MilestoneScheduleAdapter.jsx      # Adapter — wires ioCtx, applyCtx to DependencyGrid
└── DependencyGrid.jsx                # Generic grid — passes IO props via viewBarRef
```

---

## Architecture

### 1. Scenario Definition

Each scenario is a plain object:

```js
{
  id:             "ideas_add",                // unique key (backend scenario_prompts key)
  domain:         "ideabin",                  // domain filter ("ideabin" | "tasks" | "dependencies")
  grid:           { row: "ideas", col: "add" }, // position in the UI grid
  group:          "Ideas — Add",              // legacy group label (kept for registry)
  action:         "add",                      // "add" | "assign" | "finetune" | "special" (icon)
  label:          "New ideas",                // short display name
  description:    "Generate brand-new ideas…", // tooltip / subtitle
  unavailableMsg: (ctx) => string | null,     // null = available; string = grayed-out msg
  defaultPrompt:  "Generate 10-15 ideas…",    // default scenario prompt (user can override)
  expectedFormat: "{ ideas: [...] }",          // JSON format shown to the AI
  buildPayload:   (ctx) => object,             // builds the JSON data from current state
}
```

Optional flags:
- `needsLegendPicker: true` — scenario requires the legend dropdown in the UI

### 2. Context Object (ctx)

The context is built by `IdeaBin.jsx` (`ioCtx` memo) and passed to scenarios:

```js
{
  // IdeaBin data
  ideas,                    // { [placementId]: { title, description, legend_types, ... } }
  categories,               // { [catId]: { id, name, ... } }
  categoryOrders,           // { [catId]: [placementId, ...] }
  unassignedOrder,          // [placementId, ...]
  dims,                     // { legends: [...], legendTypes: { [id]: { name, color, ... } } }
  selectedIdeaIds,          // Set
  selectedCategoryIds,      // Set

  // Filters
  legendFilters,            // [{legendId, typeIds, mode}]
  filterCombineMode,        // "and" | "or"
  stackedFilters,           // [{name, rules, combineMode}]
  stackCombineMode,         // "or" | "and"
  globalTypeFilter,         // [typeId, ...]
  filterPresets,            // [{name, ...}]

  // Context scoping
  activeContext,             // { id, name, color, category_ids, ... } | null
  contextIdeaOrders,         // { [contextId]: [ideaId, ...] }

  // Cross-window data
  projectTeams,              // [{ name, tasks: [...] }]
  projectDescription,        // string

  // ── Injected by IdeaBinIOPopup (modCtx memo) ──
  _withContext,              // boolean — context toggle (default true)
  _selectedLegendId,         // number | null — for needsLegendPicker scenarios
}
```

**Context toggle (`_withContext`):** When `true`, payloads include existing
ideas/categories/legends for reference. When `false`, payloads are minimal
(blank-slate generation). Scenarios use the `wCtx(ctx)` helper to check this.

**Context scoping:** When `activeContext` is set, helper functions
(`ctxCategories`, `ctxCategoryOrders`, `ctxUnassigned`, `ctxAllIdeas`)
automatically narrow data to only items linked to the active context.

### 3. Assembly Pipeline

`assemblePrompt(scenarioId, ctx, settings)` produces:

```
1. System prompt            (if toggle ON + text exists)
2. Project description      (if toggle ON + description exists)
3. Expected JSON format     (if toggle ON + format defined)
4. Scenario prompt          (user-custom or default; if toggle ON)
5. JSON payload             (always — from buildPayload)
6. End prompt               (if toggle ON + text exists)
```

Returns `{ text, json, jsonString }`.

### 4. Registry

```js
import { getScenario, getGroup, getScenariosForDomain, IDEABIN_GRID } from './promptEngine';

getScenario("ideas_add")            // single scenario by id
getGroup("Ideas — Add")             // all scenarios in that group
getScenariosForDomain("ideabin")    // all 24 IdeaBin scenarios
IDEABIN_GRID                        // { rows, columns, cells, specials } for grid UI
```

### 5. Grid Layout Metadata

The `IDEABIN_GRID` object drives the popup's CSS grid rendering:

```js
{
  rows: [
    { key: "ideas",      label: "Ideas" },
    { key: "categories", label: "Categories" },
    { key: "legends",    label: "Legends & Filters" },
  ],
  columns: [
    { key: "add",      label: "Add" },
    { key: "assign",   label: "Assign" },
    { key: "finetune", label: "Finetune" },
  ],
  cells: {
    "ideas:add":           ["ideas_add", "ideas_add_for_teams"],
    "ideas:assign":        ["assign_unassigned_existing", "assign_unassigned_new",
                            "assign_selected_existing", "assign_selected_new"],
    "ideas:finetune":      ["ideas_finetune_selected", "ideas_finetune_all"],
    "categories:add":      ["categories_add", "categories_add_for_ideas"],
    "categories:assign":   null,  // merged — assign column spans Ideas + Categories rows
    "categories:finetune": ["categories_finetune_selected", "categories_finetune_all"],
    "legends:add":         ["legends_add", "filters_add"],
    "legends:assign":      ["legends_assign_one_selected", "legends_assign_one_all",
                            "legends_assign_all_selected", "legends_assign_all_all"],
    "legends:finetune":    ["legends_finetune_all", "legends_finetune_single"],
  },
  specials: ["special_context_add", "special_context_suggestions",
             "special_gap_analysis", "special_dedup_merge"],
}
```

The Assign column for Ideas spans two rows (Ideas + Categories) via CSS
`gridRow`, and `categories:assign` is set to `null` (no DOM element emitted
for that cell).

---

## Adding a New Domain

Three domains are currently implemented: **IdeaBin** (Phase 1), **Task Structure** (Phase 2), and **Dependencies** (Phase 3). To add a fourth domain, follow these steps:

### Step 1: Create scenario definitions

Create `scenarios/myDomainScenarios.js`:

```js
export const MY_SCENARIOS = [
  {
    id: "my_items_add",
    domain: "mydomain",
    grid: { row: "items", col: "add" },
    group: "Items — Add",
    action: "add",
    label: "New items",
    description: "...",
    unavailableMsg: (ctx) => null,
    defaultPrompt: "...",
    expectedFormat: "...",
    buildPayload: (ctx) => ({}),
  },
  // ... more scenarios
];

export const MY_GRID = { rows: [...], columns: [...], cells: {...}, specials: [...] };
export const MY_GROUPS = ["Items — Add", "Items — Finetune"];
```

### Step 1b: Create response applier + change builder

Create `myResponseApplier.js` (detect/preview/apply) and `myChangeBuilder.js`
(granular change-op decomposition). See `depResponseApplier.js` and `depChangeBuilder.js`
for the most recent reference implementation, including conflict detection patterns.

### Step 2: Register in registry.js

```js
import { MY_SCENARIOS, MY_GROUPS, MY_GRID } from './scenarios/myDomainScenarios';

export const ALL_SCENARIOS = [
  ...IDEABIN_SCENARIOS,
  ...TASK_SCENARIOS,
  ...DEP_SCENARIOS,
  ...MY_SCENARIOS,       // ← add
];

export const ALL_GROUPS = [
  ...IDEABIN_GROUPS,
  ...TASK_GROUPS,
  ...DEP_GROUPS,
  ...MY_GROUPS,          // ← add
];

export { MY_GRID };
```

### Step 3: Re-export in index.js

```js
export { MY_SCENARIOS, MY_GROUPS, MY_GRID } from './scenarios/myDomainScenarios';
export { detectMyResponseContent, applyMyDetected } from './myResponseApplier';
export { buildMyChangeItems, recomposeMyDetected, MY_CHANGE_TYPE_META } from './myChangeBuilder';
```

### Step 4: Update backend valid keys

In `backend/api/views/prompt_settings.py`, add the new scenario IDs to
`VALID_SCENARIO_KEYS`.

### Step 5: Create UI popup

Copy `IdeaBinIOPopup.jsx` or `DependencyIOPopup.jsx` as template.
Wire it the same way: build a `ctx` object from the window's state,
and pass `scenarios`, `grid`, `ctx`, `settings`, `assemblePrompt`, `applyCtx`.

For domains that need conflict detection (like Dependencies), add a
`buildChangeItemsWithCtx` wrapper that passes additional context (e.g., `nodes`)
to the change builder for real-time validation.

### Step 6: Add I/O button to title bar

Same pattern as IdeaBinTitleBar — add a `<Sparkles>` button that toggles
the popup.

---

## Current IdeaBin Scenario Inventory (v2 — Grid Layout)

### Ideas — Add (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `ideas_add` | New ideas | ✓ with/without existing | — |
| `ideas_add_for_teams` | Ideas for teams | ✓ | Teams (from Task Structure) |

### Ideas — Finetune (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `ideas_finetune_selected` | Finetune selected | — (always sends selected) | Selected ideas |
| `ideas_finetune_all` | Finetune all | — (always sends all) | Any ideas |

### Assign — Ideas ↔ Categories (4 scenarios, spans 2 rows)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `assign_unassigned_existing` | Unassigned → existing cats | — | Unassigned ideas + categories |
| `assign_unassigned_new` | Unassigned → new cats | — | Unassigned ideas |
| `assign_selected_existing` | Selected → existing cats | — | Selected ideas + categories |
| `assign_selected_new` | Selected → new cats | — | Selected ideas |

### Categories — Add (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `categories_add` | New categories | ✓ | — |
| `categories_add_for_ideas` | Categories for ideas | ✓ | Ideas |

### Categories — Finetune (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `categories_finetune_selected` | Finetune selected | — | Selected categories |
| `categories_finetune_all` | Finetune all | — | Categories |

### Legends & Filters — Add (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `legends_add` | New legends + types | ✓ | — |
| `filters_add` | New filter presets | — | Legend types |

### Legends & Filters — Assign (4 scenarios)
| ID | Label | Legend picker | Requires |
|---|---|---|---|
| `legends_assign_one_selected` | Assign 1 legend → selected | ✓ | Selected ideas + legend selected |
| `legends_assign_one_all` | Assign 1 legend → all | ✓ | Ideas + legend selected |
| `legends_assign_all_selected` | Assign all legends → selected | — | Selected ideas + legends |
| `legends_assign_all_all` | Assign all legends → all | — | Ideas + legends |

### Legends & Filters — Finetune (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `legends_finetune_all` | Finetune all legends | — | Legends |
| `legends_finetune_single` | Finetune single legend | ✓ (legend picker) | Legend selected |

### Specials (4 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `special_context_add` | Add to context | ✓ | Content |
| `special_context_suggestions` | Suggestions | ✓ | Content |
| `special_gap_analysis` | Gap analysis | ✓ | Content |
| `special_dedup_merge` | Deduplicate & merge | — | 3+ ideas |

**Total: 24 IdeaBin scenarios**

---

## Task Structure Scenario Inventory (Phase 2)

> File: `scenarios/taskScenarios.js` — Response handling: `taskResponseApplier.js` + `taskChangeBuilder.js`

### Tasks — Add (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `tasks_add` | New tasks | ✓ with/without existing | — |
| `tasks_add_for_teams` | Tasks for teams | ✓ | Teams |

### Tasks — Assign (4 scenarios, spans 2 rows)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `tasks_assign_unassigned_existing` | Unassigned → existing teams | — | Unassigned tasks + teams |
| `tasks_assign_unassigned_new` | Unassigned → new teams | — | Unassigned tasks |
| `tasks_assign_selected_existing` | Selected → existing teams | — | Selected tasks + teams |
| `tasks_assign_selected_new` | Selected → new teams | — | Selected tasks |

### Tasks — Finetune (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `tasks_finetune_selected` | Finetune selected | — | Selected tasks |
| `tasks_finetune_all` | Finetune all | — | Tasks |

### Teams — Add (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `teams_add` | New teams | ✓ | — |
| `teams_add_for_tasks` | Teams for tasks | ✓ | Tasks |

### Teams — Finetune (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `teams_finetune_selected` | Finetune selected | — | Selected teams |
| `teams_finetune_all` | Finetune all | — | Teams |

### Specials (3 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `special_acceptance_criteria_selected` | Acceptance criteria (selected) | — | Selected tasks |
| `special_acceptance_criteria_all` | Acceptance criteria (all) | — | Tasks |
| `special_task_suggestions` | Task suggestions | ✓ | Content |

**Total: 15 Task Structure scenarios**

### Task Structure — Wiring

- `TaskStructure.jsx` builds `ioCtx` (tasks, teams, taskOrder, teamOrder, selections, projectDescription) and `applyCtx` (createTask, createTeam, updateTask, updateTeam, assignTaskToTeam, refreshAll).
- `TaskStructureIOPopup.jsx` renders a 3×3 grid (Tasks / Teams × Add / Assign / Finetune) + Specials row.
- The Sparkles button lives in `TaskStructureTitleBar.jsx` rightContent.
- `taskResponseApplier.js` detects: `tasks`, `teams`, `update_tasks`, `update_teams`, `assign_tasks`, `suggestions`.
- `taskChangeBuilder.js` produces `TASK_CHANGE_TYPE_META` with types: `create_task` (green), `create_team` (blue), `update_task` (amber), `update_team` (amber), `assign_task` (cyan).

---

## Dependency Scenario Inventory (Phase 3)

> File: `scenarios/depScenarios.js` — Response handling: `depResponseApplier.js` + `depChangeBuilder.js`

The Dependency domain operates on the **DependencyGrid** (milestones, edges, schedule positions). Its unique feature is **conflict detection**: when an AI-suggested dependency violates the scheduling rule (`source.start_index + source.duration <= target.start_index`), the import previews it as a conflict rather than silently applying it.

### Grid Layout (3×2)

```
              Add              Finetune
            ┌──────────────┬──────────────┐
  Tasks     │ Generate      │ Refine       │
            │ milestones    │ milestones   │
            ├──────────────┼──────────────┤
  Milestones│ Generate      │ Refine       │
            │ dependencies  │ dependencies │
            ├──────────────┼──────────────┤
  Deps      │ Generate      │ Optimise     │
            │ schedule      │ schedule     │
            └──────────────┴──────────────┘
  Specials: [Full dependency graph] [Suggest missing]
```

### Tasks row — Milestones (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `dep_milestones_add` | Generate milestones | ✓ includes existing milestones | Tasks in project |
| `dep_milestones_finetune` | Refine milestones | — (always sends all) | Existing milestones |

### Milestones row — Connections (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `dep_connections_add` | Generate dependencies | ✓ includes existing deps | ≥ 2 milestones |
| `dep_connections_finetune` | Refine dependencies | — (always sends all) | Existing dependencies |

### Dependencies row — Schedule (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `dep_schedule_add` | Generate schedule | — | ≥ 2 milestones |
| `dep_schedule_finetune` | Optimise schedule | — | Existing milestones |

### Specials (2 scenarios)
| ID | Label | Context toggle | Requires |
|---|---|---|---|
| `special_full_dependency_graph` | Full dependency graph | ✓ | ≥ 2 tasks |
| `special_dep_suggestions` | Suggest missing deps | — | ≥ 2 milestones |

**Total: 8 Dependency scenarios**

### Detected Response Types

`detectDepResponseContent(json)` inspects parsed AI JSON and returns detected items:

| Type | Keys detected | Action |
|---|---|---|
| `dep_milestones` | `milestones: [...]` | Create new milestones |
| `dep_dependencies` | `dependencies: [...]` or `new_dependencies: [...]` | Create dependency edges |
| `dep_schedule` | `schedule: [...]` | Reposition milestones (start_index/duration) |
| `update_milestones` | `updated_milestones: [...]` | Update existing milestone name/desc/position |
| `update_dependencies` | `updated_dependencies: [...]` | Update existing edge weight/reason |
| `remove_dependencies` | `remove_dependencies: [...]` | Delete dependency edges |
| `suggestions` | `suggestions: "..."` | Display text (read-only) |

### Conflict Detection

The scheduling rule for dependencies is:

```
source.start_index + source.duration <= target.start_index
```

When a new or updated dependency would violate this rule, the import system:

1. **Flags it as a conflict** — `checkDepConflict(sourceNode, targetNode)` returns `{ conflict: true, sourceEnd, targetStart }`.
2. **Shows it in the ChangeBuilder** — conflict dependencies get the `conflict_dependency` change type (orange) with a message explaining that the predecessor ends at day X but the successor starts at day Y.
3. **Allows it anyway** — conflicts are not auto-blocked. The user can still accept them in the `ControlledApplyPanel` review.
4. **Displays a conflict summary** — after applying, the result screen shows an orange warning section listing all scheduling conflicts with instructions to manually adjust milestone positions in the grid.

This design mirrors a **git merge conflict** analogy: the system flags the problem, applies the change, and trusts the user to resolve the conflict by adjusting milestone positions in the visual grid.

### Dependency Change Types

`DEP_CHANGE_TYPE_META` defines 7 change types:

| Type | Color | Icon | Description |
|---|---|---|---|
| `create_milestone` | green | `Plus` | New milestone creation |
| `create_dependency` | blue | `ArrowRightLeft` | New dependency edge |
| `update_milestone` | amber | `Pencil` | Update milestone name/desc/position |
| `update_dependency` | amber | `Pencil` | Update dependency weight/reason |
| `remove_dependency` | red | `Trash2` | Remove dependency edge |
| `move_milestone` | teal | `Move` | Reposition milestone (schedule) |
| `conflict_dependency` | orange | `AlertTriangle` | Dependency that violates scheduling rule |

### Parent-Child Hierarchy

When a new milestone is created, dependency edges connected to it become **children** of that milestone in the change list. Declining a milestone creation automatically disables its child edges (they cannot exist without their endpoint milestone). This is tracked via `milestoneChangeIds` in `buildDepChangeItems()`.

### Dependency Context Object (`ioCtx`)

Built in `MilestoneScheduleAdapter.jsx`:

```js
{
  nodes,              // { [id]: { name, description, task, start_index, duration, ... } }
  edges,              // [{ source, target, weight, reason, description }]
  rows,               // { [id]: { name, team, description, ... } }
  lanes,              // { [id]: { name, color, tasks: [...] } }
  laneOrder,          // [teamId, ...]
  totalColumns,       // number (project day count)
  projectDescription, // string
}
```

### Dependency Apply Context (`applyCtx`)

```js
{
  addMilestone,       // (taskId, opts) → milestone object
  createDependency,   // (sourceId, targetId, opts) → dependency object
  updateMilestone,    // (nodeId, { name?, start_index?, duration?, task? }) → void
  updateDependency,   // (sourceId, targetId, updates) → result
  deleteDependency,   // (sourceId, targetId) → void
  moveMilestone,      // (nodeId, newStartIndex) → void
  refreshAll,         // () → triggers full data reload
  nodes,              // current milestone state (for name-based resolution)
  edges,              // current dependency state
  rows,               // current task state (for name-based resolution)
}
```

### Dependency Wiring Architecture

The Dependencies IO system follows a different wiring pattern than IdeaBin/TaskStructure because the grid uses a **floating window** architecture:

```
MilestoneScheduleAdapter
  ├── usePromptSettings() → { buildClipboardText, settings, projectDescRef }
  ├── ioCtx useMemo (data context)
  ├── applyCtx useMemo (API functions)
  ├── ioPopupOpen / setIoPopupOpen state
  └── Passes to DependencyGrid:
        ├── ioPopupOpen, setIoPopupOpen, ioPopupContent
        └── viewBarRef (exposes IO props to floating title bar)

DependencyGrid
  └── viewBarRef.current = {
        ...viewState,
        ioPopupOpen, setIoPopupOpen, ioPopupContent  ← IO props added
      }

ScheduleWindow
  └── <ScheduleTitleBar viewBar={viewBarRef.current} />

ScheduleTitleBar
  └── Destructures ioPopupOpen, setIoPopupOpen, ioPopupContent from viewBar
  └── Renders Sparkles button + ioPopupContent (DependencyIOPopup)
```

Unlike IdeaBin/TaskStructure where the title bar is rendered inside the same component tree, the Schedule's floating window architecture requires the IO props to flow through the `viewBarRef` (a mutable ref) from `DependencyGrid` to `ScheduleWindow` → `ScheduleTitleBar`.

---

## UI Components

### IdeaBinIOPopup (Grid Layout v2)
- Location: `frontend/src/components/ideas/IdeaBinIOPopup.jsx`
- Triggered by: Sparkles icon in IdeaBinTitleBar
- Two-mode popup: **Export** (grid) and **Import** (paste & apply)
- **Export mode:**
  - 3×3 CSS grid (80px label column + 3 equal data columns)
  - Column headers: Add (green) / Assign (blue) / Finetune (amber)
  - Row labels: Ideas / Categories / Legends & Filters
  - Assign column spans Ideas + Categories rows (merged cell)
  - Specials row below the grid
  - **Context toggle** — checkbox to include/exclude existing data in payloads
  - **Legend picker** — dropdown for scenarios that need `needsLegendPicker`
  - Click scenario = copy prompt to clipboard + auto-switch to Import tab
  - Download icon for file save
- **Import mode:**
  - Paste AI response JSON into textarea
  - "Parse & Preview" button — runs `detectResponseContent()`
  - Green/gray dots for actionable/read-only items
  - "Apply to IdeaBin" — runs `applyDetected()` through the API layer
  - Alternatively opens `ControlledApplyPanel` for human-in-the-loop review
- Props: `scenarios`, `grid`, `ctx`, `settings`, `assemblePrompt`, `applyCtx`, `onClose`, `iconColor`

### TaskStructureIOPopup (Grid Layout v2 — Phase 2)
- Location: `frontend/src/components/tasks_classification/TaskStructureIOPopup.jsx`
- Triggered by: Sparkles icon in TaskStructureTitleBar
- Two-mode popup: **Export** (grid) and **Import** (paste & apply)
- Grid layout: 3×3 (Tasks / Teams × Add / Assign / Finetune) + Specials row
- Assign column spans Tasks + Teams rows (same merged-cell pattern as IdeaBin)
- Context toggle, copy-to-clipboard with auto-switch, ControlledApplyPanel integration
- Props: same as IdeaBinIOPopup

### DependencyIOPopup (Grid Layout v2 — Phase 3)
- Location: `frontend/src/grid_board/DependencyIOPopup.jsx`
- Triggered by: Sparkles icon in ScheduleTitleBar
- Two-mode popup: **Export** (grid) and **Import** (paste & apply with conflict detection)
- Grid layout: 3×2 (Tasks / Milestones / Dependencies × Add / Finetune) + Specials row
- **Export mode:**
  - CSS grid with 3 rows × 2 columns, sky-blue theme
  - Context toggle controls whether existing milestones/dependencies are included
  - Click scenario = copy prompt to clipboard + auto-switch to Import tab
- **Import mode:**
  - Paste AI response JSON into textarea (supports code-fenced JSON)
  - "Parse & Preview" — runs `detectDepResponseContent()`
  - Opens `ControlledApplyPanel` with dependency-specific overrides
  - `buildChangeItemsWithCtx` passes live `nodes` to the change builder for real-time conflict checking
  - After apply, result screen includes an **orange conflict section** (with `AlertTriangle` icon) listing scheduling violations and instructions to manually adjust milestones in the grid
- Props: same as IdeaBinIOPopup

### ControlledApplyPanel (Human-in-the-loop)
- Location: `frontend/src/components/shared/promptEngine/ControlledApplyPanel.jsx`
- Modal overlay showing detected changes as a reviewable list
- Each change can be individually accepted/rejected before applying
- Used by both the Import tab and the direct Generate flow

### AISettingsPopup
- Location: `frontend/src/components/shared/AISettingsPopup.jsx`
- Triggered by: AI button in InventoryBar
- Three tabs: Toggles, Prompts (system/end), Per-Scenario
- Edits saved per user via `PATCH /api/user/prompt-settings/update/`

### Direct Generate (one-click AI)
- "Generate" button in `IdeaBinTitleBar`
- Calls `handleAiGenerate()` in `IdeaBin.jsx`:
  1. Assembles prompt for `ideas_add` scenario with `_withContext: true`
  2. POSTs to `POST /api/ai/generate/` (backend OpenAI proxy)
  3. Parses response JSON (strips markdown code fences if present)
  4. Runs `detectResponseContent()` on parsed JSON
  5. Opens `ControlledApplyPanel` with detected changes for review

### Backend
- Model: `PromptSettings` (OneToOne per user)
- Valid keys: `VALID_SCENARIO_KEYS` in `backend/api/views/prompt_settings.py`
  - Contains all 24 IdeaBin + 15 Task Structure + 8 Dependency scenario keys + legacy v1 keys
- No migration needed (scenario_prompts is a JSONField)
- OpenAI proxy: `POST /api/ai/generate/` — accepts `{ prompt }`, returns `{ content }`

---

## Response Applier (Import Flow)

### Overview

The **response applier** completes the round-trip: after copying a prompt out and getting
an AI response, the user pastes the JSON response back and it gets applied to the IdeaBin.

### Detection

`detectResponseContent(json)` inspects the parsed JSON and returns an array of detected
content items. Detection is **format-driven** (inspects keys like `ideas`, `categories`,
`legends`) rather than scenario-driven, so it handles format variations gracefully.

Detected types:
| Type | Keys detected | Action |
|---|---|---|
| `ideas` | `ideas: [...]` or bare array | Create unassigned ideas |
| `categories` | `categories: [...]` / `new_categories` | Import via `importCategoryApi` |
| `teams` | `teams: [...]` | Convert to categories |
| `insert_into_existing` | `new_ideas_for_existing: [...]` | Insert into matching categories |
| `legends` | `legends: [...]` | Create legends + types |
| `new_legend_types` | `new_legend_types: [...]` | Add types to existing legends |
| `filter_presets` | `filter_presets: [...]` | Append filter presets |
| `analysis_*` | `duplicate_groups`, `tiers`, `gaps`, etc. | Display only (read-only) |
| `suggestions` | `suggestions: "..."` | Display text |

### Change Builder

`changeBuilder.js` converts detected items into granular, reviewable change operations
for the `ControlledApplyPanel`. Each detected type maps to specific change-op builders
that produce fine-grained items (e.g., individual idea creation, category renaming,
legend type assignment).

### Apply Context (`applyCtx`)

Built in `IdeaBin.jsx` and passed to the popup. Contains:

```js
{
  createIdea,            // createIdeaApi
  importCategories,      // importCategoryApi
  insertIdeas,           // insertIdeasIntoCategoryApi
  createCategory,        // createCategoryApi
  createLegend,          // dims.create_legend
  createTypeOnLegend,    // direct API call bypassing active legend
  setFilterPresets,      // React setState
  refreshAll,            // () => refresh categories + ideas + legends
  activeContextId,       // number | null
  categories,            // current categories map
  dims,                  // { legends, legendTypes, ... }
}
```

### UI Flow (IdeaBinIOPopup)

1. **Export tab** — Grid of scenarios, click to copy prompt to clipboard
2. Auto-switches to **Import tab** after copy (with 800ms "Copied" flash)
3. User pastes AI response JSON into textarea
4. "Parse & Preview" — detects content, shows green/gray dots for actionable/read-only
5. "Apply to IdeaBin" — calls `applyDetected()` which uses the appropriate APIs
6. Success screen shows what was created; errors shown if any

### UI Flow (Direct Generate)

1. User clicks "Generate" button in toolbar
2. Loading spinner while backend proxies to OpenAI
3. `ControlledApplyPanel` modal opens with detected changes
4. User reviews and accepts/rejects individual changes
5. Accepted changes applied to IdeaBin
