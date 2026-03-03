# Prompt Engine — Architecture & Reuse Guide

## Overview

The Prompt Engine is a centralised system for building AI-ready clipboard text from
project data. It powers the **I/O button** in each window's title bar, assembling
structured JSON payloads with surrounding prompt instructions.

---

## Directory Structure

```
frontend/src/components/shared/promptEngine/
├── index.js                          # Public API re-exports
├── registry.js                       # Scenario lookup + domain filtering
├── assembler.js                      # assemblePrompt() — builds clipboard text
├── responseApplier.js                # Parses AI responses, detects, previews & applies
└── scenarios/
    ├── ideabinScenarios.js           # All IdeaBin scenarios
    └── taskScenarios.js              # (Phase 2) Task Structure scenarios
```

## Architecture

### 1. Scenario Definition

Each scenario is a plain object:

```js
{
  id:             "ideas_add_blank",          // unique key (backend scenario_prompts key)
  domain:         "ideabin",                  // domain filter ("ideabin" | "tasks" | "deps")
  group:          "Ideas — Add",              // display group in I/O popup
  action:         "add",                      // "add" | "overwork" | "analyse" (determines icon)
  label:          "New ideas (blank slate)",   // display label
  description:    "Generate brand-new ideas…", // tooltip / subtitle
  unavailableMsg: (ctx) => string | null,     // null = available; string = grayed-out msg
  defaultPrompt:  "Generate 10-15 ideas…",    // default scenario prompt (user can override)
  expectedFormat: "{ ideas: [...] }",          // JSON format shown to the AI
  buildPayload:   (ctx) => object,             // builds the JSON data from current state
}
```

### 2. Context Object (ctx)

The context is built by each window and passed to `unavailableMsg` and `buildPayload`:

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

  // Context
  activeContext,             // { id, name, color, ... } | null

  // Cross-window data
  projectTeams,              // [{ name, tasks: [...] }]
  projectDescription,        // string
}
```

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
import { getScenario, getGroup, getScenariosForDomain } from './promptEngine';

getScenario("ideas_add_blank")       // single scenario
getGroup("Ideas — Add")              // all scenarios in that group
getScenariosForDomain("ideabin")     // all IdeaBin scenarios
```

---

## Adding a New Domain (e.g., Task Structure)

### Step 1: Create scenario definitions

Create `scenarios/taskScenarios.js`:

```js
export const TASK_SCENARIOS = [
  {
    id: "tasks_add_blank",
    domain: "tasks",
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

export const TASK_GROUPS = [
  "Tasks — Add",
  "Tasks — Overwork",
];
```

### Step 2: Register in registry.js

```js
import { TASK_SCENARIOS, TASK_GROUPS } from './scenarios/taskScenarios';

export const ALL_SCENARIOS = [
  ...IDEABIN_SCENARIOS,
  ...TASK_SCENARIOS,      // ← add
];

export const ALL_GROUPS = [
  ...IDEABIN_GROUPS,
  ...TASK_GROUPS,          // ← add
];
```

### Step 3: Re-export in index.js

```js
export { TASK_SCENARIOS, TASK_GROUPS } from './scenarios/taskScenarios';
```

### Step 4: Update backend valid keys

In `backend/api/views/prompt_settings.py`, add the new scenario IDs to
`VALID_SCENARIO_KEYS`.

### Step 5: Create UI popup

Copy `IdeaBinIOPopup.jsx` as template → `TaskStructureIOPopup.jsx`.
Wire it the same way: build a `ctx` object from the task window's state,
and pass it along with `TASK_SCENARIOS` and `TASK_GROUPS`.

### Step 6: Add I/O button to title bar

Same pattern as IdeaBinTitleBar — add a `<Sparkles>` button that toggles
the popup.

---

## Current IdeaBin Scenario Inventory

### Ideas — Add (5 scenarios)
| ID | Label | Requires |
|---|---|---|
| `ideas_add_blank` | New ideas (blank slate) | — |
| `ideas_add_with_context` | New ideas (with context) | Ideas or categories |
| `ideas_add_to_categories` | New ideas for categories | Categories |
| `ideas_add_for_teams` | New ideas for teams | Teams (from Task Structure) |
| `ideas_add_with_new_teams` | New ideas + suggest teams | Ideas |

### Ideas — Overwork (4 scenarios)
| ID | Label | Requires |
|---|---|---|
| `ideas_overwork_selected` | Improve selected ideas | Selected ideas |
| `ideas_overwork_with_teams` | Improve + assign teams | Selected ideas + teams |
| `ideas_overwork_assign_legends` | Assign legend types | Selected ideas + legend types |
| `ideas_overwork_all` | Improve all ideas | Any ideas |

### Categories — Add (2 scenarios)
| ID | Label | Requires |
|---|---|---|
| `categories_add_blank` | New categories (blank) | — |
| `categories_add_with_ideas` | New categories with ideas | — |

### Categories — Overwork (2 scenarios)
| ID | Label | Requires |
|---|---|---|
| `categories_overwork_structure` | Improve category structure | Categories |
| `categories_overwork_with_ideas` | Improve categories + ideas | Categories |

### Categories & Ideas (3 scenarios)
| ID | Label | Requires |
|---|---|---|
| `combined_overwork_all` | Overwork all | Categories or ideas |
| `combined_add_ideas_only` | Add ideas to existing | Categories |
| `combined_add_ideas_and_categories` | Add categories + ideas | Categories |

### Legends & Filters (5 scenarios)
| ID | Label | Requires |
|---|---|---|
| `legends_add_new` | Create legends + types | — |
| `legends_overwork_all` | Improve legends | Legends |
| `filters_add_for_existing` | Suggest filters | Legend types |
| `filters_add_with_legends` | Create legends + filters | — |
| `filters_overwork_all` | Improve filters | Active filters |

### Entire Context (2 scenarios)
| ID | Label | Requires |
|---|---|---|
| `context_add_to_existing` | Add to context | Content |
| `context_overwork_all` | Overwork context | Content |

### Analysis (5 scenarios)
| ID | Label | Requires |
|---|---|---|
| `ideas_deduplicate` | Find duplicates | 3+ ideas |
| `ideas_prioritize` | Prioritise ideas | Ideas |
| `ideas_auto_categorize` | Auto-categorise | Categories + uncategorised ideas |
| `ideas_gap_analysis` | Gap analysis | Content |
| `context_summarize` | Summarise context | Content |

**Total: 28 IdeaBin scenarios**

---

## UI Components

### IdeaBinIOPopup
- Location: `frontend/src/components/ideas/IdeaBinIOPopup.jsx`
- Triggered by: Sparkles icon in IdeaBinTitleBar
- Shows all scenarios grouped, grays out unavailable with tooltip
- Click = copy to clipboard, small download icon for file save
- Search bar at top for filtering

### AISettingsPopup
- Location: `frontend/src/components/shared/AISettingsPopup.jsx`
- Triggered by: AI button in InventoryBar
- Three tabs: Toggles, Prompts (system/end), Per-Scenario
- Edits saved per user via PATCH /api/user/prompt-settings/update/

### Backend
- Model: `PromptSettings` (OneToOne per user)
- Valid keys: `VALID_SCENARIO_KEYS` in `backend/api/views/prompt_settings.py`
- No migration needed (scenario_prompts is a JSONField)

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

1. **Export tab** — Scenario list, click to copy prompt to clipboard
2. Auto-switches to **Import tab** after copy (with 800ms "Copied" flash)
3. User pastes AI response JSON into textarea
4. "Parse & Preview" — detects content, shows green/gray dots for actionable/read-only
5. "Apply to IdeaBin" — calls `applyDetected()` which uses the appropriate APIs
6. Success screen shows what was created; errors shown if any
