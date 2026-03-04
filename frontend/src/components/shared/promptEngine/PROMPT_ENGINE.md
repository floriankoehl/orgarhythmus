# Prompt Engine — Architecture & Reuse Guide

> **Last updated:** 2026-03-04 (Grid Layout v2)

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
├── responseApplier.js                # Parses AI responses, detects, previews & applies
├── changeBuilder.js                  # Converts detected items into granular change-ops
├── ControlledApplyPanel.jsx          # Human-in-the-loop review modal
├── PROMPT_ENGINE.md                  # This documentation
└── scenarios/
    ├── ideabinScenarios.js           # All IdeaBin scenarios (24) + IDEABIN_GRID
    └── taskScenarios.js              # (Phase 2) Task Structure scenarios

frontend/src/components/ideas/
├── IdeaBinIOPopup.jsx                # Grid-based export/import popup UI
├── IdeaBinTitleBar.jsx               # Title bar with I/O + Generate buttons
└── IdeaBin.jsx                       # Main IdeaBin — wires ctx, applyCtx, AI generate
```

---

## Architecture

### 1. Scenario Definition

Each scenario is a plain object:

```js
{
  id:             "ideas_add",                // unique key (backend scenario_prompts key)
  domain:         "ideabin",                  // domain filter ("ideabin" | "tasks" | "deps")
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

## Adding a New Domain (e.g., Task Structure)

### Step 1: Create scenario definitions

Create `scenarios/taskScenarios.js`:

```js
export const TASK_SCENARIOS = [
  {
    id: "tasks_add_blank",
    domain: "tasks",
    grid: { row: "tasks", col: "add" },
    group: "Tasks — Add",
    action: "add",
    label: "New tasks (blank)",
    description: "...",
    unavailableMsg: (ctx) => null,
    defaultPrompt: "...",
    expectedFormat: "...",
    buildPayload: (ctx) => ({}),
  },
  // ... more scenarios
];

export const TASK_GRID = { rows: [...], columns: [...], cells: {...}, specials: [...] };
export const TASK_GROUPS = ["Tasks — Add", "Tasks — Finetune"];
```

### Step 2: Register in registry.js

```js
import { TASK_SCENARIOS, TASK_GROUPS, TASK_GRID } from './scenarios/taskScenarios';

export const ALL_SCENARIOS = [
  ...IDEABIN_SCENARIOS,
  ...TASK_SCENARIOS,      // ← add
];

export const ALL_GROUPS = [
  ...IDEABIN_GROUPS,
  ...TASK_GROUPS,          // ← add
];

export { TASK_GRID };
```

### Step 3: Re-export in index.js

```js
export { TASK_SCENARIOS, TASK_GROUPS, TASK_GRID } from './scenarios/taskScenarios';
```

### Step 4: Update backend valid keys

In `backend/api/views/prompt_settings.py`, add the new scenario IDs to
`VALID_SCENARIO_KEYS`.

### Step 5: Create UI popup

Copy `IdeaBinIOPopup.jsx` as template → `TaskStructureIOPopup.jsx`.
Wire it the same way: build a `ctx` object from the task window's state,
and pass `scenarios`, `grid`, `ctx`, `settings`, `assemblePrompt`, `applyCtx`.

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
  - Contains all 24 v2 scenario keys + legacy v1 keys for backward compatibility
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
