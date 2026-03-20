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
source venv/bin/activate
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

## Key Conventions

- All API routes are prefixed with `/api/`
- Frontend uses Tailwind for layout/spacing and MUI for interactive components
- The Dependency page (Gantt grid) is the most complex component — it handles drag/drop milestones, dependency arrows, phases, and a safety check system
- IdeaBin uses floating windows with canvas-style free positioning
- The 3D sandbox uses CSS 3D perspective transforms (not WebGL)
