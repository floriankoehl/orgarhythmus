# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Orgarhythmus** is a full-stack project management SPA combining structured planning (Gantt-style milestones/dependencies), free-form ideation (IdeaBin canvas), and 3D visualization (CSS 3D assignment sandbox). Deployed at orgarhythmus.org.

## Development Commands

### Docker (recommended for full-stack)
```bash
docker compose up --build
# Frontend: http://localhost:8081
# Backend API: http://localhost:9000/api/
```

### Manual (split terminals)
```bash
# Backend
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver  # http://127.0.0.1:8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173, proxies /api → http://127.0.0.1:8000
```

### Frontend scripts
```bash
npm run build   # Production bundle
npm run lint    # ESLint
npm run preview # Preview production build
```

### Backend
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## Architecture

### Tech Stack
- **Backend**: Django 5.0.7 + Django REST Framework, SimpleJWT, SQLite, Gunicorn
- **Frontend**: React 19 + Vite, Tailwind CSS 4, MUI 7, React Flow 11
- **3D**: Three.js, React Three Fiber, CSS 3D transforms
- **Graph layout**: Dagre

### Request Flow
```
Dev:  Browser → Vite proxy (/api → :8000) → Django
Prod: Browser → Nginx (:8081) → [static SPA | /api/ → Gunicorn (:8000)]
```

API base URL is configured in `frontend/src/config/api.js` (empty string locally, `https://api.orgarhythmus.org` in production).

### Backend Structure
- `backend/config/` — Django settings, root `urls.py` (mounts `api.urls` at `/api/`)
- `backend/api/` — All models, views, serializers, and URL routes in a single Django app
- `backend/api/migrations/` — Database migrations
- Authentication is JWT via `/api/token/` (obtain) and `/api/token/refresh/`

### Frontend Structure
- `frontend/src/config/api.js` — API base URL
- `frontend/src/context/` — React Context providers: `AuthProvider`, `NotificationProvider`, `DemoDateProvider`, `DependencyContext`
- `frontend/src/components/` — Feature components organized by domain
- `frontend/src/pages/` — Page-level components
- State management is React Context API only (no Redux/Zustand)

### Domain Model
**Project Planning**: Project → Team → Task → Milestone → Dependency
Supporting: Day, Phase, DependencyView, ProjectSnapshot

**IdeaBin**: Context → Category → Idea
Supporting: Legend, IdeaLegendType, Formation, Adoption

**Task Legend System**: Project → TaskLegend → TaskLegendType; Task ↔ TaskLegendAssignment
Supporting: TaskLegendAssignment (unique_together: task + legend)

## Prompt Engine

The Prompt Engine is a centralized AI-prompt system that assembles structured payloads from live project data and sends them to an AI. It operates in two modes and is implemented across three domains (IdeaBin, Task Structure, Dependencies).

### Two Consumption Modes

**Manual (copy/paste)**: User clicks a scenario button in any I/O popup → `assemblePrompt()` builds the full prompt text and copies it to the clipboard → UI auto-switches to the Import tab → user pastes the AI response JSON into the textarea → "Parse & Preview" detects what changed → green/gray dots show actionable vs read-only items → "Apply" writes the changes via the domain API.

**Direct AI (automatic)**: When Direct Mode is enabled (toggle in `AISettingsPopup`, stored in `localStorage.ai_direct_mode`), clicking a scenario instead calls `aiGenerate(text)` which POSTs to `POST /api/ai/generate/`. The backend proxies the request to OpenAI (`gpt-4o-mini`, `temperature=0.7`, `max_tokens=4096`) using `OPENAI_API_KEY` from the server's `.env`. The response is parsed and opens `ControlledApplyPanel` for human review before applying.

**Configuring the API key**: Add `OPENAI_API_KEY="sk-..."` to `backend/.env`. The backend reads it with `os.getenv("OPENAI_API_KEY", "")` (handles quoted values). Returns HTTP 500 if missing.

### File Map

```
frontend/src/components/shared/promptEngine/
├── index.js                  # Public API — import everything from here
├── assembler.js              # Builds clipboard text from context + settings
├── registry.js               # Scenario lookup (getScenario, getScenariosForDomain)
├── ControlledApplyPanel.jsx  # Human-in-the-loop review modal (slide + overview views)
├── responseApplier.js        # IdeaBin: detect + apply
├── taskResponseApplier.js    # Task Structure: detect + apply
├── depResponseApplier.js     # Dependencies: detect + apply (+ conflict detection)
└── scenarios/
    ├── ideabinScenarios.js   # 24 scenarios + IDEABIN_GRID metadata
    ├── taskScenarios.js      # 15 scenarios + TASK_GRID metadata
    └── depScenarios.js       # 8 scenarios + DEP_GRID metadata

frontend/src/api/aiGenerateApi.js          # POSTs to /api/ai/generate/, getDirectMode/setDirectMode
frontend/src/components/shared/AISettingsPopup.jsx  # Direct AI toggle + prompt customization UI
frontend/src/components/ideas/IdeaBinIOPopup.jsx    # IdeaBin I/O popup (3×3 grid)
frontend/src/components/tasks_classification/TaskStructureIOPopup.jsx
frontend/src/grid_board/DependencyIOPopup.jsx

backend/api/views/ai_generate.py           # OpenAI proxy endpoint
backend/api/views/prompt_settings.py       # GET /api/user/prompt-settings/, PATCH .../update/
```

### Assembly Pipeline

`assemblePrompt(scenarioId, ctx, settings)` returns `{ text, json, jsonString }`. The sections included in `text` are controlled by per-user toggles stored in the `PromptSettings` DB model (one row per user):

1. System prompt — if `auto_add_system_prompt` and text is set
2. Project description — if `auto_add_project_description`
3. Expected JSON format — if `auto_add_json_format` (from `scenario.format`)
4. Scenario prompt — if `auto_add_scenario_prompt` (custom per-scenario text or default)
5. JSON payload — **always included** (from `scenario.buildPayload(ctx)`)
6. End prompt — if `auto_add_end_prompt` and text is set

Sections joined with `\n\n`. Per-scenario prompt overrides live in `PromptSettings.scenario_prompts` (a JSON field keyed by scenario ID).

### Domains and Scenario Grids

| Domain | Scenarios | Grid | Unique feature |
|---|---|---|---|
| IdeaBin | 24 + 4 specials | 3×3 (Add/Assign/Finetune × Ideas/Categories/Legends) | Context toggle (include/exclude existing data) |
| Task Structure | 15 + 3 specials | 3×3 (Add/Assign/Finetune × Tasks/Teams) | Acceptance criteria generation |
| Dependencies | 8 + 2 specials | 3×2 (Add/Finetune × Milestones/Connections/Schedule) | Scheduling conflict detection |

### In-Grid Preview for Dependency Changes

When the AI proposes milestone or dependency changes, they are previewed **directly inside the live Gantt grid** as ghost overlays — not in a separate modal. The `ControlledApplyPanel` slide/overview modal sits alongside the grid; navigating slides updates what ghost is shown in the grid in real time.

**State home — `MilestoneScheduleAdapter.jsx`**:
All preview state lives here (not in the grid itself):
- `reviewState` — holds `{ items, currentIdx, sessionEdgeIds, sessionMilestoneIds, detected, showInspect, focusMode }`. `items` is the array of accepted/declined changes from the AI response. `sessionEdgeIds`/`sessionMilestoneIds` track what has already been accepted (so accepted items disappear from the ghost layer and appear as real data).
- `ghostNodes` — `useMemo` derived from `reviewState.items[currentIdx]` — the one proposed milestone for the current slide.
- `ghostEdges` — `useMemo` derived from the same — the one proposed dependency edge for the current slide.

Both are passed down as props to `DependencyGrid` → `GridNodeLayer` (nodes) and `GridCanvas` (edges).

**Ghost node rendering — `GridNodeLayer.jsx`**:
Ghost milestones are absolutely positioned over the grid at the exact column/row coordinates of the proposal. They are styled with:
- Dashed 2px border: green (`rgba(34,197,94,0.7)`) for CREATE, amber for UPDATE, cyan for MOVE
- Semi-transparent fill (`rgba(..., 0.22)`)
- CSS pulse animation
- `pointerEvents: none` so they don't interfere with interaction

**Ghost edge rendering — `GridCanvas.jsx`**:
Ghost dependency arrows are drawn in an SVG overlay (z-index 100, `pointerEvents: none`):
- Dashed stroke (6,8 pattern) with animated dashFlow for conflict, solid for resolved
- Orange (`#f97316`) = scheduling conflict; green (`#22c55e`) = valid
- A checkmark circle renders at the midpoint for resolved edges

**Accept/decline flow**:
1. User accepts a change in `ControlledApplyPanel` → `toggleItem()` flips the item's `accepted` flag.
2. The panel calls `onSlideSync(newIdx)` → `MilestoneScheduleAdapter.handleInspectSlideSync()` updates `reviewState.currentIdx`.
3. `ghostEdges`/`ghostNodes` memos recompute → grid re-renders with the new ghost for the next slide.
4. For accepted CREATE_DEPENDENCY: the edge is added **optimistically** to `edges` state with `_session: true`, and its key is added to `sessionEdgeIds` so it no longer appears as a ghost.
5. For accepted CREATE_MILESTONE: the milestone is created via API and added optimistically to `nodes` state.

**View state snapshot**:
Before entering review mode, `MilestoneScheduleAdapter` captures the current grid view via `gridControlRef.current.collectViewState()` and stores it in `preReviewStateRef`. The view state includes row visibility, row/lane sizes, lane collapse state, column collapse state, selected nodes/edges, and phase visibility. The grid is then set to a default "everything visible" state so proposed changes are never hidden by collapsed rows or lanes. On review end (or cancel), `applyViewState(preReviewStateRef.current)` restores the exact view the user had before.

**Key files**:
```
frontend/src/grid_board/MilestoneScheduleAdapter.jsx  # reviewState, ghostEdges, ghostNodes, view snapshot
frontend/src/grid_board/DependencyGrid.jsx            # collectViewState / applyViewState on gridControlRef
frontend/src/grid_board/GridNodeLayer.jsx             # Ghost milestone rendering
frontend/src/grid_board/GridCanvas.jsx                # Ghost edge SVG overlay
```

## ⚠️ Critical Scheduling Rule (Dependencies)

**A predecessor must fully finish before a successor can start.**

```
source.start_index + source.duration <= target.start_index
```

This rule must hold at all times. It applies to:
- Creating new dependencies
- Moving milestones (changing `start_index`)
- Changing milestone durations (`change_duration` API takes a **delta**, not an absolute value)

When AI-suggested changes violate this rule, they are flagged as `conflict_dependency` or `conflict` items (shown in orange in `ControlledApplyPanel`). The user can still accept them — the engine applies the change and lists remaining conflicts with manual adjustment instructions. Analogous to a git merge conflict: flag it, apply anyway, let the user resolve.

### Conflict Detection (Dependencies)

`buildDepChangeItems` in `depChangeBuilder.js` checks outgoing edges when a milestone's duration changes — if `start_index + newDuration > successor.start_index`, the item is flagged with a `conflict` field. The function accepts `edgesCtx` as its 5th parameter for this purpose.

### PromptSettings Model

`backend/api/models.py` — `PromptSettings` (one-to-one with `User`):
- `auto_add_*` — five boolean toggles for which sections to include
- `system_prompt`, `end_prompt` — free-text fields
- `scenario_prompts` — `JSONField` keyed by scenario ID (47 valid keys across all domains)

Fetched via `usePromptSettings` hook in `frontend/src/components/usePromptSettings.js`.

## Task Legend System

The Task Legend System is a project-scoped labelling mechanism parallel to the IdeaBin Legend system. It allows any task to be classified along multiple independent dimensions simultaneously (e.g. Priority, Status, Risk Level), where each dimension is a **Legend** and each classification option within it is a **Legend Type**.

### Data Model

| Model | Key Fields |
|---|---|
| `TaskLegend` | `project` (FK), `owner` (FK), `name` |
| `TaskLegendType` | `legend` (FK, related: `types`), `name`, `color`, `icon`, `order_index` |
| `TaskLegendAssignment` | `task` (FK), `legend` (FK), `legend_type` (FK); `unique_together: [task, legend]` |

**One type per legend per task** — assigning a new type for the same legend replaces the previous one. `legend_type_id = null` removes the assignment.

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/projects/<id>/task-legends/` | List all legends |
| POST | `/api/projects/<id>/task-legends/create/` | Create legend |
| POST | `/api/projects/<id>/task-legends/<id>/` | Update legend name |
| DELETE | `/api/projects/<id>/task-legends/<id>/delete/` | Delete legend + types |
| GET | `/api/projects/<id>/task-legends/<id>/types/` | List types for legend |
| POST | `/api/projects/<id>/task-legends/<id>/types/create/` | Create type |
| POST | `/api/projects/<id>/task-legends/<id>/types/<id>/` | Update type |
| DELETE | `/api/projects/<id>/task-legends/<id>/types/<id>/delete/` | Delete type |
| POST | `/api/projects/<id>/tasks/assign_legend_type/` | Assign `{task_id, legend_id, legend_type_id}` |
| POST | `/api/projects/<id>/tasks/batch_assign_legend_type/` | Batch assign `{task_ids, legend_id, legend_type_id}` |
| POST | `/api/projects/<id>/tasks/batch_remove_legend_type/` | Batch remove `{task_ids, legend_id}` |
| POST | `/api/projects/<id>/tasks/remove_all_legend_types/` | Remove all labels from task |

### Serialized Task Format

Every task serializer (TaskSerializer_Deps, TaskExpandedSerializer, TaskSerializer_TeamView) returns a `legend_types` field:
```json
{ "legend_id": { "legend_type_id": 3, "name": "High", "color": "#ef4444", "icon": "Flag" } }
```
Lookup: `task.legend_types[String(legendId)]` → current type for that legend.

### Frontend Files

```
frontend/src/components/tasks_classification/
├── api/taskLegendApi.js         # All legend API calls
├── hooks/useTaskLegends.js      # Legend state: legends[], activeLegendId, legendTypes{}
├── TaskLegendPanel.jsx          # Sidebar panel: legend selector, type list, paint-mode assignment
└── TaskCard.jsx                 # Renders legend badge via task.legend_types[activeLegendId]
```

**Paint Mode** (canvas-view only): Click a type in `TaskLegendPanel` to enter paint mode → click tasks to assign that type. Ctrl+Click type → batch-assign to all selected tasks.

**Icons**: Stored as string keys (e.g. `"Flag"`, `"Star"`, `"Lightbulb"`) in `TaskLegendType.icon`. Rendered via `renderLegendTypeIcon(iconKey)` from `frontend/src/components/ideas/legendTypeIcons.jsx`.

## Branching System

Git-inspired project branching. Each project has a **main** branch (the source of truth) plus any number of user-created branches. Changes made while on a non-main branch do not affect main. Designed for multi-user projects where only admins/owners merge branches into main.

### Core Concepts

- **Branch**: A named, independent copy of all substantive project data at the point the branch was created. Not owned by a user — anyone can view or edit any branch.
- **Main branch**: Auto-created for every project. Always exists, cannot be deleted. Serves as the canonical version.
- **Branch isolation**: Every write operation (create/update/delete) for branch-aware data targets the current active branch only.
- **Branch switching**: Per-user, per-project preference stored in `localStorage` (`branch_<projectId>`). No server-side session for active branch.
- **Future work** (not yet implemented): branch diff, merge, PR-style review.

### What IS Branch-Aware (captured in a branch)

| Model | Why |
|---|---|
| `Team` | teams + ordering define project structure |
| `Task` | all task fields, team assignment, ordering |
| `AcceptanceCriterion` | criterion text + done state |
| `Milestone` | name, start_index, duration, scheduling |
| `MilestoneTodo` | todo text + done state |
| `Dependency` | scheduling connections between milestones |
| `Phase` | named timeline spans |
| `TaskLegend` | classification system definitions |
| `TaskLegendType` | category definitions within a legend |
| `TaskLegendAssignment` | which task is assigned which category |
| `Day` | purpose, is_blocked, color overrides on timeline days |

### What is NOT Branch-Aware

- `Project` metadata (name, description, start_date, end_date) — shared across all branches
- `DependencyView` — frontend display state only
- `ProjectSnapshot` — separate backup mechanism
- `PromptSettings` — user AI settings
- `UserShortcuts` / `filter_presets` — user preferences
- `Formation` — IdeaBin visual layout
- All IdeaBin models (Context, Category, Idea, etc.) — separate brainstorming tool, not branched
- `ProtoPersona` — deferred; complex M2M relationships across branched models

### Data Model

```python
class Branch(Model):
    project = FK(Project, related_name="branches")
    name = CharField(max_length=200)
    description = TextField(blank=True)
    created_by = FK(User, null=True, SET_NULL)
    created_at = DateTimeField(auto_now_add=True)
    is_main = BooleanField(default=False)
    source_branch = FK("self", null=True, blank=True, SET_NULL)  # which branch this was forked from

    class Meta:
        unique_together = [("project", "name")]
```

All branch-aware models get a `branch` FK:
```python
branch = FK(Branch, on_delete=CASCADE, related_name="<model_plural>")
```

**AcceptanceCriterion, MilestoneTodo, TaskLegendType, TaskLegendAssignment, Dependency** do NOT get a direct branch FK — they cascade naturally from their parents (Task, Milestone, TaskLegend) which are branch-aware.

### Deep Copy on Branch Creation

When a new branch is created from a source branch, a service function `copy_branch_data(source_branch, new_branch)` performs:

1. Copy `Team` rows → map `old_id → new_id`
2. Copy `Task` rows (with new team FK from map) → map `old_id → new_id`
3. Copy `AcceptanceCriterion` rows (with new task FK)
4. Copy `Milestone` rows (with new task FK) → map `old_id → new_id`
5. Copy `MilestoneTodo` rows (with new milestone FK)
6. Copy `Dependency` rows (with new source/target FK from milestone map)
7. Copy `Phase` rows (with new team FK if team-specific)
8. Copy `TaskLegend` rows → map `old_id → new_id`
9. Copy `TaskLegendType` rows (with new legend FK) → map `old_id → new_id`
10. Copy `TaskLegendAssignment` rows (new task/legend/type FKs from maps)
11. Copy `Day` rows (with new branch FK)

All copy steps use `bulk_create` for performance.

### Migration Strategy

The migration for adding `branch` FK to existing data:
1. Create `Branch` table
2. For each existing `Project`, create one `Branch(is_main=True, name="main")`
3. For each branch-aware model, set `branch_id` to the corresponding project's main branch
4. Make `branch` FK non-nullable (after backfill)

### API Endpoints

```
GET    /api/projects/<pid>/branches/                   List all branches
POST   /api/projects/<pid>/branches/create/            Create new branch {name, description, source_branch_id}
GET    /api/projects/<pid>/branches/<bid>/             Branch detail
DELETE /api/projects/<pid>/branches/<bid>/delete/      Delete (not main)
```

All branch-aware endpoints accept a `?branch=<bid>` query parameter. If omitted, defaults to the project's main branch (looked up via `Branch.objects.get(project=pid, is_main=True)`).

Affected endpoints (add `?branch` filtering):
- `/api/projects/<pid>/teams/`
- `/api/projects/<pid>/tasks/`
- `/api/projects/<pid>/milestones/` (and milestone-related routes)
- `/api/projects/<pid>/dependencies/` (and dependency-related routes)
- `/api/projects/<pid>/phases/`
- `/api/projects/<pid>/task-legends/` (and type/assignment routes)
- `/api/projects/<pid>/days/`

### Frontend Integration

**Branch context**: A `BranchContext` provider (or included in existing project context) holds:
```js
{
  branches,          // all branches for current project
  activeBranchId,    // currently selected branch id
  mainBranchId,      // the main branch id
  setActiveBranchId, // switch branch (also writes localStorage)
  isMainBranch,      // activeBranchId === mainBranchId
  createBranch,      // (name, description) => Promise
  deleteBranch,      // (branchId) => Promise
}
```

Storage key: `branch_${projectId}` in `localStorage`.

**Branch switcher UI**: Added to the project inventory/navigation header — a dropdown showing all branches with a "New branch" option. Shows current branch name. Main branch has a special indicator (e.g., a crown icon).

**API calls**: All branch-aware API utility functions accept an optional `branchId` param, appended as `?branch=<id>`. The frontend reads `activeBranchId` from context and passes it automatically.

### Key Files

**Backend:**
```
backend/api/models.py                                         # Branch model + branch FK on all branch-aware models
backend/api/migrations/0056_alter_promptsettings_*.py         # Migration with backfill logic
backend/api/views/branches.py                                 # Branch CRUD + _copy_branch_data service
backend/api/views/helpers.py                                  # resolve_branch() helper
backend/api/views/projects.py                                 # create_project auto-creates main branch
backend/api/views/teams.py                                    # branch-filtered
backend/api/views/tasks.py                                    # branch-filtered
backend/api/views/milestones.py                               # branch-filtered
backend/api/views/dependencies.py                             # branch-filtered
backend/api/views/phases.py                                   # branch-filtered
backend/api/views/task_legends.py                             # branch-filtered
backend/api/views/days.py                                     # branch-filtered
backend/api/urls.py                                           # Branch endpoints registered
```

**Frontend:**
```
frontend/src/auth/BranchContext.jsx                  # Branch state provider
frontend/src/api/branchApi.js                        # Branch API calls
frontend/src/api/activeBranch.js                     # Module singleton for non-React API modules
frontend/src/components/shared/BranchSwitcher.jsx    # Dropdown UI in InventoryBar
frontend/src/api/org_API.js                          # branchParam() added to team/task calls
frontend/src/api/dependencies_api.js                 # branchParam() added to all calls
frontend/src/components/tasks_classification/api/taskLegendApi.js  # branchParam() added
```

### Implementation Status

- [x] Backend: `Branch` model + migration with backfill (migration 0056)
- [x] Backend: Branch CRUD views (`views/branches.py`) + `_copy_branch_data` service
- [x] Backend: `BranchSerializer` in `serializers.py`; routes in `urls.py`
- [x] Backend: `?branch=<id>` filtering in all branch-aware view files (teams, tasks, milestones, dependencies, phases, task-legends, days)
- [x] Backend: `resolve_branch` helper in `views/helpers.py` — reads `?branch=<id>`, defaults to main, auto-creates main branch if missing
- [x] Backend: `create_project` auto-creates a main branch for every new project
- [x] Frontend: `BranchContext` provider (`auth/BranchContext.jsx`)
- [x] Frontend: `branchApi.js` (`api/branchApi.js`)
- [x] Frontend: `BranchSwitcher` dropdown in InventoryBar (`components/shared/BranchSwitcher.jsx`)
- [x] Frontend: `BranchProvider` wraps `ProjectLayout`
- [x] Frontend: `activeBranch.js` module singleton — keeps active branch ID in sync for non-React API modules
- [x] Frontend: `branchParam()` threaded through all branch-aware API calls (`org_API.js`, `dependencies_api.js`, `taskLegendApi.js`)

### Known Gotcha: New Projects Must Get a Main Branch

`create_project` (`views/projects.py`) now creates a `Branch(is_main=True, name="main")` automatically. `resolve_branch` also auto-creates the main branch if one is missing (safety net for projects created before this was wired up). Any project without a main branch will have it created on the first branch-aware API call.

## Demo Mode

### Core Goal

Allow users to move a "current time cursor" forward and backward along a project's timeline to crash-test schedules — seeing which milestones would be late, which are on track, and simulating future/past states. Each demo session is its own branch so it is fully isolated, resumable, and never corrupts real data.

### Design Principle: Index-First, Metric-Aware

The system stores a raw **integer index** (`demo_index`) and translates it to a human-readable value in the frontend based on the project's `metric` field. This makes the low-level data metric-agnostic.

```
demo_index = 5, metric = 'days',   start_date = 2026-01-01  →  "6. Jan 2026"
demo_index = 5, metric = 'hours',  start_date = 2026-01-01  →  "01.01 14:00"
demo_index = 5, metric = 'months', start_date = 2026-01-01  →  "Jun 2026"
```

This aligns naturally with how milestones/phases already work (`start_index`, `duration` are already metric-agnostic integers). The `demo_index` is just a cursor on that same axis.

### What "current time" means

- **Main/regular branch**: current time = `todayToIndex(metric, project.start_date)` — computed from real wall-clock date, not stored
- **Demo branch** (`is_demo=True`): current time = `branch.demo_index` — manually controlled by the user

The warning/overdue system always reads one consistent "current index" value from whichever source applies.

### Backend Changes

**`Project` model — new field:**
```python
metric = CharField(max_length=20, choices=['days', 'hours', 'months'], default='days')
```

**`Branch` model — two new fields:**
```python
is_demo    = BooleanField(default=False)
demo_index = IntegerField(null=True, blank=True)  # only meaningful when is_demo=True
```

**New endpoint:** `POST /api/projects/<pid>/branches/enter-demo/`
- Body: `{ source_branch_id }` — which branch to fork from
- Deep-copies all branch data (same `_copy_branch_data` service as regular branch creation)
- Sets `is_demo=True`, `demo_index` = today's position relative to `project.start_date`
- Auto-generates branch name: `"demo-YYYY-MM-DD-HHmm"` (unique, no user input)
- Returns the new branch

**Existing `PATCH /api/projects/<pid>/branches/<bid>/`** — add `demo_index` to the serializer so the frontend can step it.

**`DemoDate` model** — deprecated and removed. It was app-global and is fully replaced by this per-branch approach.

### Frontend Changes

**New utility file: `src/utils/projectMetric.js`**
```js
indexToDisplay(index, metric, startDate)  // → human-readable string
todayToIndex(metric, startDate)            // → integer for today's real position
```
This is the ONLY place that knows about metric→unit translation.

**`BranchContext` grows demo-aware properties:**
```js
isDemoMode         // activeBranch.is_demo
demoIndex          // activeBranch.demo_index
enterDemoMode()    // POST enter-demo → switches to new demo branch
stepDemoIndex(±1)  // PATCH demo_index on current branch
exitDemoMode()     // switch back to source_branch (branch is kept, NOT deleted)
```

**InventoryBar** — gets a Demo Mode section (replaces the old `DemoDateDisplay` in the org/project headers):
- Not in demo mode: single "Demo" button to enter
- In demo mode: `← [translated index display] →` + exit button

**Removed:** `DemoDateContext`, `DemoDateDisplay`, `getDemoDate`/`setDemoDate` in `org_API.js`, all references in `App.jsx`, `OrgaHeader`, `ProjectHeader`.

### Demo Branch Lifecycle

1. User clicks "Enter Demo" in InventoryBar → `enterDemoMode()` is called
2. Backend forks the active branch → returns demo branch → frontend switches to it
3. User navigates forward/backward → `stepDemoIndex(±1)` PATCHes `demo_index` on the backend
4. User clicks exit → `exitDemoMode()` switches back to source branch — **demo branch is kept**
5. On a future visit, the demo branch appears in the BranchSwitcher — user can re-select it to resume

### Key Files (planned)

```
backend/api/models.py                                   # metric on Project; is_demo + demo_index on Branch
backend/api/migrations/XXXX_demo_mode.py                # migration for new fields
backend/api/views/branches.py                           # enter_demo_view added
backend/api/urls.py                                     # enter-demo route

frontend/src/utils/projectMetric.js                     # indexToDisplay, todayToIndex
frontend/src/auth/BranchContext.jsx                     # isDemoMode, demoIndex, enterDemoMode, stepDemoIndex, exitDemoMode
frontend/src/api/branchApi.js                           # enterDemoMode API call
frontend/src/components/shared/InventoryBar.jsx         # Demo Mode section
```

### Implementation Status

- [x] Backend: `metric` field on `Project`
- [x] Backend: `is_demo` + `demo_index` fields on `Branch`
- [x] Backend: migration `0057_demo_mode_fields`
- [x] Backend: `enter_demo` view + `patch_branch` view in `views/branches.py`
- [x] Backend: `enter-demo` + `<bid>/update/` routes in `urls.py`
- [x] Backend: `is_demo`, `demo_index` added to `BranchSerializer`; `metric` to `ProjectSerializer`
- [x] Frontend: `projectMetric.js` utility (`indexToDisplay`, `indexToShortDisplay`, `todayToIndex`, `metricStepLabel`)
- [x] Frontend: `BranchContext` — `isDemoMode`, `demoIndex`, `projectMetric`, `projectStartDate`, `enterDemoMode`, `exitDemoMode`, `stepDemoIndex`
- [x] Frontend: `branchApi.js` — `enterDemoBranch()`, `patchBranch()` calls
- [x] Frontend: `InventoryBar` — Demo Mode section (enter button / nav controls)
- [x] Frontend: Removed `DemoDateContext`, `DemoDateDisplay`, old header references, `getDemoDate`/`setDemoDate` from `org_API.js`

## Key Conventions

- All API routes are prefixed with `/api/`
- Frontend uses Tailwind for layout/spacing and MUI for interactive components
- The Dependency page (Gantt grid) is the most complex component — it handles drag/drop milestones, dependency arrows, phases, and a safety check system
- IdeaBin uses floating windows with canvas-style free positioning
- The 3D sandbox uses CSS 3D perspective transforms (not WebGL)
