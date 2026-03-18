# IdeaBin — Comprehensive Technical Documentation

> The IdeaBin is the idea-management subsystem of **orgarhythmus**. It provides a floating, resizable window with a two-panel IDE-like layout where users create, organise, tag, filter, and refine ideas before transforming them into actionable project artefacts (tasks, milestones, teams).

---

## Table of Contents

1. [Core Concept](#1-core-concept)
2. [Mental Model — How the Pieces Fit Together](#2-mental-model--how-the-pieces-fit-together)
3. [Data Architecture (Backend Models)](#3-data-architecture-backend-models)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Component Breakdown](#5-component-breakdown)
6. [Custom Hooks](#6-custom-hooks)
7. [API Layer](#7-api-layer)
8. [Key Interactions & Workflows](#8-key-interactions--workflows)
9. [Backend Endpoints Reference](#9-backend-endpoints-reference)
10. [Architectural Patterns & Design Decisions](#10-architectural-patterns--design-decisions)

-----

## 1. Core Concept

The IdeaBin is designed around a single principle: **ideas are cheap, fluid, and multi-dimensional**. An idea is a raw thought — just a title and a description — that can exist in multiple places simultaneously, be tagged along multiple independent dimensions, be filtered through sophisticated boolean queries, and eventually be refined into concrete deliverables.

### The metaphor

Think of the IdeaBin as a **workshop bench**:

- **Ideas** are sticky notes you scribble on.
- **Categories** are trays on the bench that you drop notes into. A single note can sit in multiple trays at once.
- **Legends** are colour-coded label makers (e.g. "Priority", "Effort", "Domain"). Each legend has several **types** (e.g. Priority → High / Medium / Low). You stick one label per legend per idea.
- **Contexts** are separate workspaces — named, coloured rooms you can walk into. Each context chooses which trays and label makers are on its bench.
- **Formations** are saved photographs of the bench — they snapshot the window layout, filter settings, category positions, and sidebar state so you can instantly switch between different "views" of the same data.

### Lifecycle of an Idea

```
  Idea (raw thought)
    │
    ├─ placed into one or more Categories
    ├─ tagged with LegendTypes across Legends
    ├─ filtered, sorted, grouped
    ├─ discussed (Comments) and voted on (Upvotes)
    │
    └─ eventually → Transform into Task / Milestone / Team
                     (exits IdeaBin, enters Dependency View)
```

---

## 2. Mental Model — How the Pieces Fit Together

```
Context ("Sprint Planning")
├── color: #3b82f6
├── filter_state: { savedFilterConfig }
│
├── Category "UI Bugs"          ◄── CategoryContextPlacement
│   ├── IdeaPlacement → Idea "Fix modal z-index"
│   ├── IdeaPlacement → Idea "Button colour mismatch"
│   └── IdeaPlacement → Idea "RTL layout broken"      ← same Idea can also appear in another Category
│
├── Category "Backend Debt"     ◄── CategoryContextPlacement
│   ├── IdeaPlacement → Idea "Migrate to async views"
│   └── IdeaPlacement → Idea "Fix modal z-index"      ← same meta-idea, different placement
│
├── Legend "Priority"           ◄── LegendContextPlacement
│   ├── LegendType "Critical"  (color: red,   icon: warning)
│   ├── LegendType "High"      (color: orange)
│   └── LegendType "Low"       (color: gray)
│
├── Legend "Effort"             ◄── LegendContextPlacement
│   ├── LegendType "Tiny"      (color: green)
│   ├── LegendType "Medium"    (color: yellow)
│   └── LegendType "Large"     (color: red)
│
├── unassigned Ideas            ◄── IdeaContextPlacement (ideas linked to context but not in any category)
│   └── Idea "Investigate caching"
│
├── Formation "Default View"    ◄── saved window state snapshot
└── Formation "Review Mode"
```

### Key relationships

| Relationship | Type | Through model |
|---|---|---|
| Idea → Category | Many-to-many | `IdeaPlacement` |
| Category → Context | Many-to-many | `CategoryContextPlacement` |
| Legend → Context | Many-to-many | `LegendContextPlacement` |
| Idea → Context (unassigned) | Many-to-many | `IdeaContextPlacement` |
| Idea → LegendType (per Legend) | One-to-one per legend | `IdeaLegendType` |
| Project → Context | Many-to-many | `ProjectContextPlacement` |
| User → Category (adoption) | Many-to-many | `UserCategoryAdoption` |
| User → Legend (adoption) | Many-to-many | `UserLegendAdoption` |
| User → Context (adoption) | Many-to-many | `UserContextAdoption` |

---

## 3. Data Architecture (Backend Models)

All models live in `backend/api/models.py`. Below are the IdeaBin-specific models with every field.

### 3.1 `Idea`

The canonical idea object. Content (title + description) lives here; placements are lightweight references.

| Field | Type | Default / Constraints |
|---|---|---|
| `owner` | FK → User | CASCADE, related: `owned_ideas`, nullable |
| `title` | CharField(500) | blank, default `""` |
| `description` | TextField | blank, default `""` |
| `created_at` | DateTimeField | auto_now_add |
| `archived` | BooleanField | default `False` |

**Ordering:** newest first (`-created_at`).

### 3.2 `Category`

A named, canvas-positioned container for ideas. Absolutely positioned (x, y) with explicit width and height.

| Field | Type | Default / Constraints |
|---|---|---|
| `owner` | FK → User | CASCADE, related: `owned_categories`, nullable |
| `name` | CharField(200) | — |
| `x` | IntegerField | 0 |
| `y` | IntegerField | 0 |
| `width` | IntegerField | 100 |
| `height` | IntegerField | 100 |
| `z_index` | IntegerField | 0 |
| `archived` | BooleanField | False |
| `is_public` | BooleanField | False |
| `filter_config` | JSONField | null — when set, the category auto-populates from a saved filter |

### 3.3 `IdeaPlacement`

The many-to-many through model between Idea and Category. Lightweight — just a reference and an order index.

| Field | Type | Constraints |
|---|---|---|
| `idea` | FK → Idea | CASCADE, related: `placements` |
| `category` | FK → Category | SET_NULL, nullable |
| `order_index` | IntegerField | default 0 |

**Constraint:** One placement per idea per category (unique together, with NULL exclusion).

**Key design decision:** When an idea's last placement is removed from all categories, it becomes "unassigned" — a placement with `category = NULL` is created, or (within a context) an `IdeaContextPlacement` links it directly to the context.

### 3.4 `Legend`

A grouping container for LegendTypes. Scoped to a context. Think of it as a "dimension" — for instance a Legend named "Priority" holds types like High, Medium, Low.

| Field | Type | Constraints |
|---|---|---|
| `owner` | FK → User | CASCADE, related: `legends` |
| `context` | FK → Context | CASCADE, related: `legends`, nullable |
| `name` | CharField(200) | default `"General"` |
| `created_at` | DateTimeField | auto_now_add |

### 3.5 `LegendType`

An individual label within a Legend. Has a colour and an optional icon.

| Field | Type | Default / Constraints |
|---|---|---|
| `legend` | FK → Legend | CASCADE, related: `types`, nullable |
| `name` | CharField(100) | — |
| `color` | CharField(20) | `"#ffffff"` |
| `icon` | CharField(50) | nullable — stores a MUI icon key (e.g. `"BugReport"`, `"Star"`) |
| `order_index` | IntegerField | 0 |

### 3.6 `IdeaLegendType`

Links an Idea to exactly one LegendType per Legend. This allows tagging an idea along multiple dimensions independently — one type from "Priority" *and* one type from "Effort" simultaneously.

| Field | Type | Constraints |
|---|---|---|
| `idea` | FK → Idea | CASCADE, related: `legend_types` |
| `legend` | FK → Legend | CASCADE, related: `idea_type_assignments` |
| `legend_type` | FK → LegendType | CASCADE, related: `idea_assignments` |

**Constraint:** unique_together `(idea, legend)` — one assignment per legend per idea.

### 3.7 `Context`

A named workspace container that groups Categories and Legends. Has position/size for the Contexts view canvas.

| Field | Type | Default / Constraints |
|---|---|---|
| `owner` | FK → User | CASCADE, related: `owned_contexts` |
| `name` | CharField(200) | — |
| `x`, `y` | IntegerField | 0 |
| `width`, `height` | IntegerField | 200 |
| `z_index` | IntegerField | 0 |
| `is_public` | BooleanField | False |
| `is_default` | BooleanField | False |
| `color` | CharField(20) | nullable — tints the IdeaBin chrome when active |
| `filter_state` | JSONField | nullable — persists the context's filter configuration including legend filters, stacked filters, and saved filter presets |
| `created_at` | DateTimeField | auto_now_add |

### 3.8 Placement Through-Models

These are lightweight join tables linking entities into contexts:

| Model | Connects | Unique on |
|---|---|---|
| `CategoryContextPlacement` | Category ↔ Context | `(category, context)` |
| `LegendContextPlacement` | Legend ↔ Context | `(legend, context)` |
| `IdeaContextPlacement` | Idea ↔ Context | `(idea, context)` |
| `ProjectContextPlacement` | Project ↔ Context | `(project, context)` |

All have an `order_index` field (except ProjectContextPlacement).

### 3.9 Adoption Models

Enable sharing — users can "adopt" other users' public categories, legends, or entire contexts to see them in their own IdeaBin (read-only but visible).

| Model | Links | Unique on |
|---|---|---|
| `UserCategoryAdoption` | User ↔ Category | `(user, category)` |
| `UserLegendAdoption` | User ↔ Legend | `(user, legend)` |
| `UserContextAdoption` | User ↔ Context | `(user, context)` |

### 3.10 Social Models

| Model | Purpose | Fields |
|---|---|---|
| `IdeaUpvote` | One upvote per user per idea | `user`, `idea`, `created_at` |
| `IdeaComment` | Threaded discussion on an idea | `user`, `idea`, `text`, `created_at` |

### 3.11 `Formation`

A saved snapshot of the entire IdeaBin UI state, scoped to a context. Allows users to switch between different "views" of the same data instantly.

| Field | Type | Default / Constraints |
|---|---|---|
| `owner` | FK → User | CASCADE, related: `formations` |
| `context` | FK → Context | CASCADE, related: `formations`, nullable |
| `name` | CharField(200) | — |
| `state` | JSONField | default `{}` — see state schema below |
| `is_default` | BooleanField | False |
| `created_at` | DateTimeField | auto_now_add |
| `updated_at` | DateTimeField | auto_now |

**Formation state schema (v1):**

```json
{
  "window_pos": { "x": 100, "y": 50 },
  "window_size": { "width": 1200, "height": 800 },
  "is_maximized": false,
  "view_mode": "ideas",
  "sidebar_width": 350,
  "sidebar_headline_only": false,
  "show_sidebar_meta": false,
  "list_filter": "all",
  "show_archive": false,
  "active_legend_id": 42,
  "legend_panel_collapsed": false,
  "global_type_filter": null,
  "minimized_categories": { "17": true },
  "collapsed_ideas": {},
  "selected_category_id": null,
  "show_meta_list": false,
  "context_sidebar_mode": "categories",
  "minimized_contexts": {},
  "category_positions": {
    "5": { "x": 0, "y": 0, "width": 300, "height": 400, "z_index": 2 }
  },
  "context_positions": {
    "1": { "x": 100, "y": 50, "width": 400, "height": 300 }
  }
}
```

---

## 4. Frontend Architecture

### 4.1 Technology

- **React 19** with hooks (no class components)
- **Vite 7** for dev server & bundaging
- **Tailwind CSS 4** for styling (utility-first)
- **MUI 7** (Material-UI) for icons and some components
- **lucide-react** for additional icons
- No external state management — pure `useState` + prop-drilling + custom hooks

### 4.2 File Map

```
frontend/src/components/ideas/
│
├── IdeaBin.jsx                         Main orchestrator (~2600 lines)
│
├── IdeaBinCategoryCanvas.jsx           Right panel — category canvas (~1250 lines)
├── IdeaBinIdeaCard.jsx                 Individual idea card (~500 lines)
├── IdeaBinLegendPanel.jsx              Legend/filter panel (~1270 lines)
├── IdeaBinToolbar.jsx                  Top toolbar strip (~330 lines)
├── IdeaBinContextView.jsx              Contexts management view (~950 lines)
│
├── IdeaBinConfirmModal.jsx             Generic confirm dialog (~40 lines)
├── IdeaBinMergeModal.jsx               Merge ideas wizard (~130 lines)
├── IdeaBinTransformModal.jsx           Transform idea → Task/Milestone (~190 lines)
├── IdeaBinReformCategoryModal.jsx      Reform category → Team (~220 lines)
├── IdeaBinCategoryExportModal.jsx      Export category as JSON (~100 lines)
├── IdeaBinCategoryImportModal.jsx      Import one or multiple categories from JSON (~260 lines)
├── IdeaBinInsertIdeasModal.jsx          Insert ideas into existing category from JSON (~250 lines)
├── CollectConflictModal.jsx            Collect & Remove conflict resolver (~160 lines)
├── FeedFilterPanel.jsx                 Per-category feed filter (~260 lines)
│
├── IdeaBinDragGhosts.jsx              Drag ghost overlays (~100 lines)
├── legendTypeIcons.jsx                 Icon registry (50+ MUI icons) (~140 lines)
│
├── useIdeaBinWindow.js                 Floating window hook (~200 lines)
├── useLegends.js                       Legend CRUD hook (~160 lines)
│
├── hooks/
│   ├── useIdeaBinIdeas.js              Idea CRUD + undo/redo (~520 lines)
│   ├── useIdeaBinCategories.jsx        Category CRUD + filters (~630 lines)
│   ├── useIdeaBinDrag.jsx              Drag mechanics (~390 lines)
│   ├── useIdeaBinKeyboard.js           Keyboard shortcuts (~320 lines)
│   └── useIdeaBinFormations.js         Formation save/load (~290 lines)
│
└── api/
    ├── authFetch.js                    JWT-injecting fetch wrapper (~12 lines)
    ├── ideaApi.js                      22 idea API functions (~200 lines)
    ├── categoryApi.js                  14 category API functions (~130 lines)
    ├── contextApi.js                   16 context API functions (~130 lines)
    ├── exportApi.js                    4 export/import functions (~80 lines)
    └── formationApi.js                 10 formation API functions (~60 lines)
```

**Total:** ~9,500 lines of IdeaBin-specific frontend code.

### 4.3 State Architecture

`IdeaBin.jsx` owns the entire state tree and passes slices down via props. There are **~60+ `useState` calls** in the main component, organised by concern:

| Group | Key State Variables | Hook |
|---|---|---|
| **Window** | `isOpen`, `windowPos`, `windowSize`, `isMaximized`, `iconPos` | `useIdeaBinWindow` |
| **Ideas** | `ideas` (dict by placement ID), `unassignedOrder`, `categoryOrders`, `contextIdeaOrders`, undo/redo history | `useIdeaBinIdeas` |
| **Categories** | `categories` (dict by ID), `dockedCategories`, `minimizedCategories`, `selectedCategoryIds` | `useIdeaBinCategories` |
| **Legends** | `legends` (array), `activeLegendId`, `legendTypes`, `paintType` | `useLegends` |
| **Filters** | `globalTypeFilter`, `legendFilters[]`, `stackedFilters[]`, `filterCombineMode`, `stackCombineMode`, `filterPresets` (context-scoped) | IdeaBin.jsx directly |
| **View** | `viewMode` ("ideas" / "contexts"), `activeContext`, `contextsList` | IdeaBin.jsx |
| **Sidebar** | `listFilter`, `sidebarWidth`, `leftCollapsed`, `rightCollapsed`, `sidebarFocused` | IdeaBin.jsx |
| **Modals** | `confirmModal`, `showMergeModal`, `transformModal`, `reformCategoryModal`, `categoryExportJson`, `showCategoryImport`, `insertIdeasTarget` | IdeaBin.jsx |
| **Title Builder** | `headlineModeCategoryId`, `headlineModeIdeaId`, `sidebarDraftTitle`, `sidebarTitleOrderMode` | IdeaBin.jsx |
| **Drag** | `dragging`, `dragData`, `ghostPos`, `externalGhost`, `hoverCategory` | `useIdeaBinDrag` |
| **Formations** | `formations` (array), `activeFormation`, `formationState` | `useIdeaBinFormations` |

---

## 5. Component Breakdown

### 5.1 `IdeaBin.jsx` — The Orchestrator

The root component. When collapsed, it renders as a **draggable lightbulb icon** with an unassigned-ideas badge. When expanded, it renders a **floating, resizable window** with:

```
┌──────────────────────────────────────────────────────────┐
│  Title Bar  [💡 Ideas] [Context ▾] [🎨] [3] [Meta] [💾] [□][─] │
├──────────────────────────────────────────────────────────┤
│  Toolbar  [Ideas|Contexts] [+ Category] [📦 Archive] [Export/Import] │
├───────────────────────┬──────────────────────────────────┤
│                       │                                  │
│  Sidebar              │  Category Canvas                 │
│  ┌─────────────────┐  │  ┌──────────┐  ┌──────────┐     │
│  │ + New Idea       │  │  │ UI Bugs  │  │ Backend  │     │
│  │ [title input]    │  │  │ ──────── │  │ ──────── │     │
│  │ [description]    │  │  │ idea 1   │  │ idea 3   │     │
│  ├─────────────────┤  │  │ idea 2   │  │ idea 1   │     │
│  │ Filter: All ▾   │  │  └──────────┘  │ idea 5   │     │
│  │ idea 1          │  │                 └──────────┘     │
│  │ idea 2          │  │                                  │
│  │ idea 3          │  │  ┌──────────┐                    │
│  │ idea 4          │  │  │ Design   │                    │
│  │ idea 5          │  │  │ ──────── │                    │
│  ├─────────────────┤  │  │ idea 4   │                    │
│  │ Legend Panel     │  │  └──────────┘                    │
│  │ [Priority ▾]    │  │                                  │
│  │ 🔴 Critical (2) │  │                                  │
│  │ 🟠 High (3)     │  │                                  │
│  │ ⚪ Low (1)       │  │                                  │
│  └─────────────────┘  │                                  │
└───────────────────────┴──────────────────────────────────┘
```

**What it composes:**
- `<IdeaBinToolbar>` — view mode switch, category creation, archive, merge, export/import
- Left sidebar — idea creation form, idea list, `<IdeaBinLegendPanel>`
- `<IdeaBinCategoryCanvas>` — drag/drop category cards (Ideas view)
- `<IdeaBinContextView>` — context management canvas (Contexts view)
- Modal stack — confirm, merge, transform, reform, export, import, collect-conflict
- `<IdeaBinDragGhosts>` — floating ghost overlays during drag

### 5.2 `IdeaBinCategoryCanvas.jsx` — The Canvas

The right panel: a scrollable, relative-positioned container with absolutely-positioned category cards.

**Key features:**
- **Draw-to-create:** Toggle a mode where clicking and dragging on empty canvas space draws a rectangle → creates a new category at that position and size
- **Docked categories:** Categories can be "docked" to the toolbar as compact chips, freeing canvas space. Click a chip to restore it
- **Archived drawer:** Collapsed archive section at top showing archived categories with restore/delete
- **Category cards:** Each card is absolutely positioned and has:
  - Drag handle (title bar) for repositioning
  - In-place title editing
  - Settings dropdown (rename, public toggle, archive, delete, export/import, dock, reform to team)
  - Resize handle (bottom-right corner)
  - Minimise toggle
  - Feed filter badge ("FEED" indicator when filter_config is set)
  - Idea list (respecting current legend filters)
  - Paint mode integration (batch-paint all ideas in a category)
  - Headline mode (title-builder interface)
- **Selection:** Click to select a category (Ctrl+click for multi-select). Selected categories can be deleted or merged
- **Marquee selection:** Click-drag on empty space (without draw mode) selects all category cards in the rectangle
- **Import button:** Toolbar-level "Import" button for importing a category from JSON

### 5.3 `IdeaBinIdeaCard.jsx` — The Idea Card

Renders a single idea in both the sidebar list and inside category cards.

**Display:**
- Title (bold) or description preview (dimmed) when no title, or "Untitled"
- Left colour border matching the active legend type assignment
- Icon dot if the assigned legend type has an icon
- Upvote count + comment count badges
- Meta info (when enabled): shows which categories the idea is placed in and all legend type assignments

**Interactions:**
- Click to select (Ctrl+click multi-select, Shift+click range-select)
- Drag to reorder within list or move across categories
- In paint mode: clicking an idea assigns the active paint type
- Settings gear opens an actions menu (portal-rendered): Edit, Copy, Spinoff, Transform, Remove from category, Archive, Delete
- Expandable comments section with add/delete
- Brief wiggle animation on paste/highlight

### 5.4 `IdeaBinLegendPanel.jsx` — Legends & Filters

The bottom section of the sidebar. Manages the entire legend/filter system.

**Sections:**

1. **Legend selector:** Tabs or dropdown to switch between legends (e.g., "Priority", "Effort", "Domain")
2. **Type management:** Create, edit, delete types. Each type has a name, colour, and optional icon (from 50+ built-in MUI icons)
3. **Quick filter:** Click a type dot to toggle a simple single-legend filter
4. **Advanced filter builder:**
   - Add filter rows: pick a legend → pick types → set include/exclude mode
   - Combine rows with AND / OR
   - Stack filter groups with their own internal combine mode
   - Filter combine across stacks: AND / OR
5. **Filter presets:** Context-scoped saved filter configurations. Save, load, rename, delete named presets. Each context has its own set of presets (stored in `filter_state.filter_presets`). Activate multiple presets additively (stacked)
6. **Paint mode:** Click the brush icon on a type to enter paint mode — every idea you click gets that type assigned. Paint works on selections too (batch)
7. **Create category from filter:** One-click to generate a new category containing all ideas matching the current filter
8. **Idea counts:** Each type shows a count of matching ideas

### 5.5 `IdeaBinToolbar.jsx` — The Toolbar

Thin horizontal strip between the title bar and the content area.

- **View switcher:** "Ideas" ↔ "Contexts" pill toggle
- **+ Category:** Inline creation form with public/private toggle + draw-to-create icon
- **Order numbers:** Toggle showing order indices on category cards
- **Archived ideas:** Dropdown listing all archived ideas with restore / permanent delete
- **Merge:** Active when 2+ ideas are selected; opens the merge modal
- **Export / Import:** Full IdeaBin backup (JSON download / JSON file upload)

### 5.6 `IdeaBinContextView.jsx` — Contexts Management

A separate view mode with its own canvas. Manages Contexts as draggable/resizable windows.

**Layout:**
- Left sidebar: list of all categories (draggable) + list of all legends (draggable) + category creation form
- Right canvas: context windows as absolutely-positioned cards

**Each context card shows:**
- Header with name, colour indicator, settings gear
- Placed categories (drag from sidebar to add, × to remove)
- Placed legends
- Settings: rename, set colour, add project, enter context, toggle public, delete

**Key features:**
- Draw-to-create mode for contexts
- Drag categories/legends from the sidebar onto context cards to assign them
- Double-click or "Enter" button to switch into a context → the Ideas view filters to only data within that context
- `useImperativeHandle` exposes `getFormationState()` / `applyFormationState()` for formation integration

### 5.7 Modals

| Modal | Purpose |
|---|---|
| `IdeaBinConfirmModal` | Generic yes/no dialog with customisable message and buttons |
| `IdeaBinMergeModal` | Pick target idea when merging 2+ selected ideas |
| `IdeaBinTransformModal` | Multi-step wizard: Idea → Task or Milestone in the dependency view |
| `IdeaBinReformCategoryModal` | Multi-step wizard: Category → Project Team (optionally takes ideas as tasks) |
| `IdeaBinCategoryExportModal` | Shows category JSON with Copy to Clipboard + Save as File |
| `IdeaBinCategoryImportModal` | Two modes: Paste JSON or Upload File, supports single and multi-category format |
| `IdeaBinInsertIdeasModal` | Paste or upload JSON ideas to insert into an existing category |
| `CollectConflictModal` | Resolve overlapping ideas when enabling Collect & Remove across multiple feed-filtered categories |

### 5.8 Supporting Components

| Component | Purpose |
|---|---|
| `FeedFilterPanel` | Per-category dropdown: assign a saved filter preset, toggle Live mode (auto-refresh every 5 s), enable Collect & Remove |
| `IdeaBinDragGhosts` | Three fixed-position ghost overlays: internal drag, type drag (coloured circle), external ghost (dragging outside the IdeaBin) |
| `legendTypeIcons` | Registry of 50+ MUI icon components mapped by string key, grouped into categories (status, priority, domain, nature, objects, symbols, people, abstract) |

---

## 6. Custom Hooks

### 6.1 `useIdeaBinIdeas` (~520 lines)

Manages the full idea lifecycle and a 20-level undo/redo stack.

**State owned:**
- `ideas` — dict keyed by placement ID → `{ id, idea, title, description, category, order_index, legend_types, ... }`
- `unassignedOrder` — array of placement IDs for the unassigned list
- `categoryOrders` — `{ categoryId: [placementId, ...] }`
- `contextIdeaOrders` — `{ contextId: [placementId, ...] }`
- `undoStack` / `redoStack` — 20-level action history

**Key operations:**
- `fetch_all_ideas()` — GET all placements (owned + adopted + context-inherited)
- `create_idea(title, desc, categoryId, contextId)` — POST + optimistic insert
- `delete_idea(placementId)` — DELETE placement (cascades if last)
- `safe_order(order, categoryId)` — persist new ordering
- `assign_idea_to_category(placementId, categoryId)` — move placement
- `copy_idea(placementId)` / `paste_idea(categoryId)` — duplicate
- `assign_idea_legend_type(ideaId, legendId, typeId)` — tag or untag
- `batch_assign_idea_legend_type(ideaIds, legendId, typeId)` — bulk tag (undoable)
- `toggle_archive_idea(ideaIds)` — archive/unarchive (undoable)
- `merge_ideas(targetId, sourceIds)` — combine ideas (undoable)
- `undo()` / `redo()` — walk the stack

### 6.2 `useIdeaBinCategories` (~630 lines)

Manages category CRUD, filter-based (feed) categories, and the Collect & Remove system.

**State owned:**
- `categories` — dict keyed by category ID
- `dockedCategories` — array of docked category IDs
- `minimizedCategories` — set of minimised category IDs
- `selectedCategoryIds` — set of selected categories
- Live mode state, Collect & Remove conflict data

**Key operations:**
- `fetch_categories()` — GET all categories (owned + adopted + context-inherited)
- `create_category_api(name, isPublic)` — POST + auto-assign to active context
- `create_category_at(name, x, y, w, h)` — draw-to-create variant
- `delete_category(id)` — DELETE (unassigns all placements first)
- `merge_categories_api(sourceId, targetId)` — merge & delete source
- `setCategoryFilterConfig(catId, filterConfig)` — set/clear feed filter
- `refetchCategoryByFilter(catId, ideas)` — re-evaluate filter matches, sync via API
- `toggleLiveCategory(catId)` — start/stop 5-second live polling
- `requestToggleLive(catId)` — toggle with C&R conflict detection
- `detectCRConflicts(catId)` — find overlapping ideas across C&R categories
- `resolveCRConflicts(catId, removals)` — remove legend types to resolve
- `handleCategoryDrag(catId, e)` — reposition on canvas (in refactor mode: merge on overlap)

### 6.3 `useIdeaBinDrag` (~390 lines)

Handles all mouse-driven drag operations across four distinct drag types.

| Drag type | Trigger | Behaviour |
|---|---|---|
| **Internal idea** | mousedown on idea card | Reorder within list or move to different category. Tracks `hoverCategory` for cross-category drops |
| **Multi-select** | drag with multiple ideas selected | Moves all selected ideas together |
| **External** | dragging idea outside IdeaBin boundary | Shows external ghost. On drop, probes DOM for `[data-dep-team-id]`, `[data-dep-task-id]`, `[data-dep-day-index]` to create tasks/milestones |
| **Type drag** | mousedown on legend type badge | Drag coloured circle onto an idea to assign that type |

### 6.4 `useIdeaBinKeyboard` (~320 lines)

Keyboard shortcuts active when the IdeaBin has focus:

| Key | Action |
|---|---|
| `R` | Toggle refactor mode (category drag = merge) |
| `H` | Toggle headline/title-builder mode on focused category or idea |
| `Delete` / `Backspace` | Delete selected ideas/categories |
| `Ctrl+V` | Paste copied idea |
| `Ctrl+A` | Select all visible ideas in current filter |
| `Ctrl+Shift+A` | Select all ideas across all visible categories |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Escape` | Clear selection, exit paint mode, exit headline mode |

### 6.5 `useIdeaBinFormations` (~290 lines)

Captures and restores complete IdeaBin UI snapshots.

**Formation state captures ~25 properties:** window position/size, maximised state, view mode, sidebar width, headline-only mode, list filter, archived visibility, active legend, panel collapse states, filter configurations, minimised categories, collapsed ideas, category positions (with dimensions), context view positions.

**Key operations:**
- `saveFormation(name, state)` — POST new formation in active context
- `updateFormation(id, name, state)` — overwrite existing
- `loadFormation(id)` — GET formation → apply all state properties, persist category positions via API
- `toggleDefaultFormation(id)` — mark as auto-load for context entry
- Auto-load on open: fetch default context → enter it → load its default formation

### 6.6 `useIdeaBinWindow` (~200 lines)

Floating window position, resize, and icon management.

- **Icon drag:** High-performance direct DOM manipulation with click-vs-drag detection (threshold: 5 px)
- **Window drag:** Title bar drag with auto-unmaximise on first move
- **Maximise:** Remembers pre-maximise position, toggles to full viewport
- **Resize:** 8 handles (4 edges + 4 corners) with minimum size enforcement (400 × 300)
- **Sound effects:** Plays `ideaOpen` / `ideaClose` sounds

### 6.7 `useLegends` (~160 lines)

Context-scoped legend management.

- Fetches legends when `contextId` changes
- Auto-selects the first legend (unless user has explicitly deselected)
- CRUD: `create_legend`, `update_legend`, `delete_legend`, `create_type`, `update_type`, `delete_type`
- Returns: `legends` array, `activeLegendId`, `setActiveLegendId`, `legendTypes` for active legend

---

## 7. API Layer

All API functions live in `frontend/src/components/ideas/api/`. They use `authFetch` — a thin wrapper around `fetch()` that injects the JWT `Authorization: Bearer <token>` header and prepends the API base URL.

### 7.1 `ideaApi.js` — 22+ exports

| Function | Method | Endpoint |
|---|---|---|
| `fetchAllIdeas` | GET | `/user/ideas/all/` |
| `createIdeaApi` | POST | `/user/ideas/create/` |
| `deleteIdeaApi` | DELETE | `/user/ideas/delete/` |
| `deleteMetaIdeaApi` | DELETE | `/user/ideas/delete_meta/` |
| `updateIdeaTitleApi` | POST | `/user/ideas/update_title/` |
| `updateIdeaDescriptionApi` | POST | `/user/ideas/update_description/` |
| `safeOrderApi` | POST | `/user/ideas/safe_order/` |
| `assignIdeaToCategoryApi` | POST | `/user/ideas/assign_to_category/` |
| `copyIdeaApi` | POST | `/user/ideas/copy/` |
| `spinoffIdeaApi` | POST | `/user/ideas/spinoff/` |
| `removeIdeaFromCategoryApi` | POST | `/user/ideas/remove_from_category/` |
| `removeAllIdeaCategoriesApi` | POST | `/user/ideas/remove_all_categories/` |
| `removeAllIdeaLegendTypesApi` | POST | `/user/ideas/remove_all_legend_types/` |
| `assignIdeaLegendTypeApi` | POST | `/user/ideas/assign_legend_type/` |
| `batchRemoveLegendTypeApi` | POST | `/user/ideas/batch_remove_legend_type/` |
| `batchAssignLegendTypeApi` | POST | `/user/ideas/batch_assign_legend_type/` |
| `toggleUpvoteApi` | POST | `/user/ideas/<id>/upvote/` |
| `fetchCommentsApi` | GET | `/user/ideas/<id>/comments/` |
| `addCommentApi` | POST | `/user/ideas/<id>/comments/` |
| `deleteCommentApi` | DELETE | `/user/ideas/comments/<id>/delete/` |
| `fetchMetaIdeasApi` | GET | `/user/ideas/meta/` |
| `toggleArchiveIdeaApi` | POST | `/user/ideas/toggle_archive/` |
| `batchSetArchiveApi` | POST | `/user/ideas/batch_set_archive/` |
| `fetchArchivedIdeasApi` | GET | `/user/ideas/archived/` |
| `mergeIdeasApi` | POST | `/user/ideas/merge/` |

### 7.2 `categoryApi.js` — 14 exports

| Function | Method | Endpoint |
|---|---|---|
| `fetchCategories` | GET | `/user/categories/` |
| `createCategoryApi` | POST | `/user/categories/create/` |
| `setPositionCategory` | POST | `/user/categories/set_position/` |
| `setAreaCategory` | POST | `/user/categories/set_area/` |
| `bringToFrontCategory` | POST | `/user/categories/bring_to_front/` |
| `deleteCategoryApi` | DELETE | `/user/categories/delete/` |
| `mergeCategoriesApi` | POST | `/user/categories/merge/` |
| `renameCategoryApi` | POST | `/user/categories/rename/` |
| `toggleArchiveCategory` | POST | `/user/categories/toggle_archive/` |
| `togglePublicCategory` | POST | `/user/categories/toggle_public/` |
| `dropAdoptedCategoryApi` | DELETE | `/categories/<id>/drop/` |
| `createCategoryWithIdeas` | POST | `/user/categories/create_with_ideas/` |
| `syncCategoryIdeas` | POST | `/user/categories/sync_ideas/` |
| `updateCategoryFilterConfig` | POST | `/user/categories/update_filter_config/` |

### 7.3 `contextApi.js` — 14 exports

| Function | Method | Endpoint |
|---|---|---|
| `fetchContextsApi` | GET | `/user/contexts/` |
| `saveContextFilterStateApi` | POST | `/user/contexts/set_filter_state/` |
| `setContextColorApi` | POST | `/user/contexts/set_color/` |
| `assignCategoryToContextApi` | POST | `/user/contexts/assign_category/` |
| `setContextPositionApi` | POST | `/user/contexts/set_position/` |
| `setContextAreaApi` | POST | `/user/contexts/set_area/` |
| `assignIdeaToContextApi` | POST | `/user/contexts/assign_idea/` |
| `removeIdeaFromContextApi` | POST | `/user/contexts/remove_idea/` |
| `saveContextIdeaOrderApi` | POST | `/user/contexts/save_idea_order/` |
| `assignProjectToContextApi` | POST | `/user/contexts/assign_project/` |
| `removeProjectFromContextApi` | POST | `/user/contexts/remove_project/` |
| `fetchContextProjectsApi` | GET | `/user/contexts/<id>/projects/` |
| `fetchAllPublicContextsApi` | GET | `/contexts/public/` |
| `fetchProjectContextsApi` | GET | `/projects/<id>/contexts/` |

### 7.4 `exportApi.js` — 5 exports

| Function | Method | Endpoint |
|---|---|---|
| `exportIdeabinApi` | GET | `/ideabin/export/` |
| `importIdeabinApi` | POST | `/ideabin/import/` |
| `exportCategoryApi` | GET | `/user/categories/<id>/export/` |
| `importCategoryApi` | POST | `/user/categories/import/` |
| `insertIdeasIntoCategoryApi` | POST | `/user/categories/<id>/insert-ideas/` |

### 7.5 `formationApi.js` — 10 exports

| Function | Method | Endpoint |
|---|---|---|
| `fetchFormationsApi` | GET | `/user/contexts/<id>/formations/` |
| `saveFormationApi` | POST | `/user/contexts/<id>/formations/create/` |
| `updateFormationStateApi` | POST | `/user/formations/<id>/update/` |
| `renameFormationApi` | POST | `/user/formations/<id>/update/` |
| `loadFormationApi` | GET | `/user/formations/<id>/` |
| `deleteFormationApi` | DELETE | `/user/formations/<id>/delete/` |
| `toggleDefaultFormationApi` | POST | `/user/formations/<id>/set-default/` |
| `loadDefaultFormationApi` | GET | `/user/contexts/<id>/formations/default/` |
| `getDefaultContextApi` | GET | `/user/contexts/default/` |
| `toggleDefaultContextApi` | POST | `/user/contexts/<id>/set-default/` |

---

## 8. Key Interactions & Workflows

### 8.1 Creating an Idea

1. User types title (optional) and description in the sidebar form
2. `create_idea()` is called with the active `listFilter` (selected category) and `activeContext`
3. Backend creates `Idea`, an `IdeaPlacement` (if a category is selected), and an `IdeaContextPlacement` (if a context is active)
4. Frontend optimistically inserts the idea into `ideas`, `categoryOrders`, and the unassigned list

### 8.2 The Placement System

An Idea's canonical content (title, description) lives on the `Idea` model. The `IdeaPlacement` model is a lightweight pointer that says "this idea appears in this category at this position". One idea can have **many placements** across different categories.

```
Idea "Fix modal z-index"
  ├── IdeaPlacement → Category "UI Bugs" (order: 0)
  ├── IdeaPlacement → Category "Sprint 3" (order: 2)
  └── IdeaPlacement → Category "High Priority" (order: 5)
```

When you "move" an idea, you update the placement's `category` FK. When you "copy" an idea to another category, you create a new `IdeaPlacement` without duplicating the `Idea`.

When an idea's last placement is removed, the system keeps it as "unassigned" — either by creating a NULL-category placement or by linking it via `IdeaContextPlacement` to the current context.

### 8.3 The Legend & Filter System

Legends are independent dimensions. A typical setup might have:

- **Priority**: Critical, High, Medium, Low
- **Effort**: XS, S, M, L, XL
- **Domain**: Frontend, Backend, Infrastructure, Design

Each idea can have **one type assigned per legend**, giving it a multi-dimensional classification.

**Simple filter:** Click a type dot in the legend panel. Only ideas with that type (or no assignment) pass.

**Advanced filter:** Build complex, stackable boolean queries:

```
FilterGroup 1 (AND):
  - Priority: include [Critical, High]
  - Domain:   exclude [Infrastructure]

FilterGroup 2 (OR):
  - Effort:   include [XS, S]

Stack combine: OR
→ Shows ideas that are (Critical OR High) AND (not Infrastructure),
  OR ideas that are (XS OR S effort)
```

**Paint mode:** Select a legend type's brush icon → click ideas to mass-assign. Works with selections too.

### 8.4 Contexts & Context Switching

Contexts are named workspaces. When a user "enters" a context:

1. The current context's filter state (including filter presets) is saved to the backend
2. The IdeaBin title bar tints to the context's colour
3. All lists filter to only show:
   - Categories placed in this context (via `CategoryContextPlacement`)
   - Ideas placed in those categories, plus ideas directly linked (via `IdeaContextPlacement`)
   - Legends placed in this context (via `LegendContextPlacement`)
   - Filter presets belonging to this context (stored in `filter_state.filter_presets`)
4. If the context has a default formation, it auto-loads

### 8.5 Formations

Formations snapshot the entire UI state — window position, sidebar width, which categories are where, which filters are active, which panels are collapsed. They're context-scoped.

**Save:** Capture ~25 properties → POST to `/formations/create/`
**Load:** GET formation → apply all properties in sequence (including API calls to persist category positions)
**Default:** Mark a formation as default → auto-loaded when entering its context

### 8.6 Feed-Filtered Categories

A category can have a `filter_config` — a saved filter preset. When set:
- The category auto-populates with all ideas matching the filter
- A blue "FEED" badge appears on the card
- **Live mode:** Every 5 seconds, the filter is re-evaluated and ideas are synced
- **Collect & Remove:** Matched ideas are "collected" into this category and removed from others. Conflicts (overlapping matches across C&R categories) trigger the `CollectConflictModal`

### 8.7 Title Builder Mode

A specialised mode for constructing idea titles from description text:

1. Press `H` or activate headline mode on a category
2. The category card switches to title-builder UI
3. The idea's description is split into words, displayed as clickable chips
4. Click words in the desired order to build a title
5. Optional "description order" mode auto-sorts by original position
6. The constructed title is saved when the mode is exited

### 8.8 Transform & Reform

**Transform:** Convert an idea into a task or milestone in the dependency view. Multi-step wizard: choose type → pick team/parent task → execute. The idea's title becomes the task/milestone name.

**Reform:** Convert an entire category into a project team. Multi-step wizard: confirm → pick project → optionally create tasks from the category's ideas → optionally archive the ideas and delete the category.

### 8.9 Adoption & Public Sharing

Categories, legends, and contexts can be marked `is_public`. Other users can browse public items and "adopt" them — which makes them visible in their own IdeaBin as read-only content. Adopted items show with visual indicators (indigo tint, user icon).

Users can "spinoff" an idea from an adopted category — this creates a copy they fully own.

### 8.10 Undo / Redo

The undo/redo system tracks actions at the idea level with a 20-entry stack. Supported undoable operations:
- `batch_assign_legend_type` — restore previous type assignments
- `archive_ideas` — toggle back
- `rename_idea` — restore old title
- `merge_ideas` — (captured but complex to undo)
- `remove_from_category` — restore placement

`Ctrl+Z` / `Ctrl+Shift+Z` walk the stack.

### 8.11 Export & Import

**Full backup:** Export the entire IdeaBin (or a single context) as a comprehensive JSON file with IDs, relationships, formations, adoptions, and shortcuts. Import restores everything with full ID-remapping.

**Category-level:** Export a single category as a simple, human-readable JSON:
```json
{
  "category_name": "My Ideas",
  "ideas": [
    { "title": "Idea 1", "description": "...", "legend_types": ["Critical", "Frontend"] },
    { "title": "Idea 2", "description": "..." }
  ]
}
```
Copy to clipboard (primary) or download as file. Import via paste or file upload — creates a new category.

**Multi-category import:** The import modal also accepts a multi-category format:
```json
{
  "categories": [
    { "category_name": "Category A", "ideas": [ { "title": "..." } ] },
    { "category_name": "Category B", "ideas": [ { "title": "..." } ] }
  ]
}
```
All categories are created in a single request. The response includes a `category_ids` array.

**Insert ideas into existing category:** Each category's settings menu has an "Insert ideas (JSON)" button that opens a modal accepting:
```json
{
  "ideas": [
    { "title": "New Idea", "description": "..." }
  ]
}
```
Or a bare array: `[ { "title": "..." } ]`. Ideas are appended after the last existing idea.

### 8.12 Drag & Drop

Four distinct drag subsystems:

1. **Idea drag (internal):** Reorder within a list or move to a different category. Shows drop indicator lines
2. **Idea drag (external):** When an idea is dragged outside the IdeaBin window, a ghost overlay follows the cursor. Dropping onto the dependency view's team/task/day elements creates a task or milestone
3. **Type drag:** Drag a legend type badge (coloured circle ghost) onto an idea to assign it
4. **Category drag:** Reposition categories on the canvas. In refactor mode, dropping one category onto another triggers a merge

---

## 9. Backend Endpoints Reference

All endpoints require JWT authentication (`Authorization: Bearer <token>`) and are prefixed with `/api/`.

### Ideas — 25 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `user/ideas/all/` | GET | All ideas (placements) visible to user |
| `user/ideas/meta/` | GET | Unique ideas (no placement duplicates) |
| `user/ideas/` | GET | All owned non-archived ideas |
| `user/ideas/create/` | POST | Create idea + optional placement |
| `user/ideas/delete/` | DELETE | Delete a single placement |
| `user/ideas/delete_meta/` | DELETE | Delete meta idea + all placements |
| `user/ideas/copy/` | POST | Copy idea to another category |
| `user/ideas/spinoff/` | POST | Copy another user's idea as your own |
| `user/ideas/safe_order/` | POST | Save idea ordering in category |
| `user/ideas/assign_to_category/` | POST | Move placement to new category |
| `user/ideas/update_title/` | POST | Update title |
| `user/ideas/update_description/` | POST | Update description |
| `user/ideas/toggle_archive/` | POST | Toggle archive flag |
| `user/ideas/batch_set_archive/` | POST | Set archive on multiple ideas |
| `user/ideas/archived/` | GET | All archived ideas |
| `user/ideas/assign_legend_type/` | POST | Assign/unassign legend type |
| `user/ideas/remove_from_category/` | POST | Remove from category (keep unassigned) |
| `user/ideas/remove_all_categories/` | POST | Remove all placements |
| `user/ideas/remove_all_legend_types/` | POST | Clear all legend assignments |
| `user/ideas/batch_remove_legend_type/` | POST | Bulk remove legend type |
| `user/ideas/batch_assign_legend_type/` | POST | Bulk assign legend type |
| `user/ideas/merge/` | POST | Merge source ideas into target |
| `user/ideas/<id>/upvote/` | POST | Toggle upvote |
| `user/ideas/<id>/comments/` | GET/POST | List or add comments |
| `user/ideas/comments/<id>/delete/` | DELETE | Delete a comment |

### Categories — 16 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `user/categories/` | GET | All categories visible to user |
| `user/categories/create/` | POST | Create category |
| `user/categories/set_position/` | POST | Update x/y |
| `user/categories/set_area/` | POST | Update width/height |
| `user/categories/bring_to_front/` | POST | Set z_index to max+1 |
| `user/categories/delete/` | DELETE | Delete category |
| `user/categories/merge/` | POST | Merge categories |
| `user/categories/rename/` | POST | Rename |
| `user/categories/toggle_archive/` | POST | Toggle archive |
| `user/categories/toggle_public/` | POST | Toggle public visibility |
| `user/categories/create_with_ideas/` | POST | Create category + populate with ideas |
| `user/categories/sync_ideas/` | POST | Sync category from idea ID list |
| `user/categories/update_filter_config/` | POST | Set/clear feed filter |
| `user/categories/<id>/export/` | GET | Export category as simple JSON |
| `user/categories/import/` | POST | Import category (single or multi) from JSON |
| `user/categories/<id>/insert-ideas/` | POST | Insert ideas into existing category |
| `categories/public/` | GET | Browse public categories |
| `categories/<id>/adopt/` | POST | Adopt a public category |
| `categories/<id>/drop/` | DELETE | Drop adopted category |

### Contexts — 22 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `user/contexts/` | GET | All contexts (owned + adopted) |
| `user/contexts/create/` | POST | Create context |
| `user/contexts/<id>/` | POST | Update context fields |
| `user/contexts/<id>/delete/` | DELETE | Delete context |
| `user/contexts/set_position/` | POST | Update x/y |
| `user/contexts/set_area/` | POST | Update width/height |
| `user/contexts/bring_to_front/` | POST | Set z_index to max+1 |
| `user/contexts/set_color/` | POST | Set context colour |
| `user/contexts/set_filter_state/` | POST | Save filter config |
| `user/contexts/rename/` | POST | Rename |
| `user/contexts/assign_category/` | POST | Place category in context |
| `user/contexts/remove_category/` | POST | Remove category from context |
| `user/contexts/safe_order/` | POST | Save category ordering |
| `user/contexts/toggle_public/` | POST | Toggle public |
| `user/contexts/assign_idea/` | POST | Link idea to context |
| `user/contexts/remove_idea/` | POST | Unlink idea |
| `user/contexts/save_idea_order/` | POST | Save idea ordering |
| `user/contexts/assign_project/` | POST | Link project |
| `user/contexts/remove_project/` | POST | Unlink project |
| `user/contexts/default/` | GET | Get default context |
| `user/contexts/<id>/set-default/` | POST | Toggle default |
| `contexts/public/` | GET | Browse public contexts |
| `contexts/<id>/adopt/` | POST | Adopt |
| `contexts/<id>/drop/` | DELETE | Drop |

### Legends — 8 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `user/contexts/<id>/legends/` | GET | List legends in context |
| `user/contexts/<id>/legends/create/` | POST | Create legend |
| `user/legends/<id>/` | POST | Update legend |
| `user/legends/<id>/delete/` | DELETE | Delete legend |
| `user/legends/<id>/types/` | GET | List types in legend |
| `user/legends/<id>/types/create/` | POST | Create type |
| `user/legends/<id>/types/<id>/` | POST | Update type |
| `user/legends/<id>/types/<id>/delete/` | DELETE | Delete type |

### Formations — 8 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `user/contexts/<id>/formations/` | GET | List formations in context |
| `user/contexts/<id>/formations/create/` | POST | Create formation |
| `user/contexts/<id>/formations/default/` | GET | Get default formation |
| `user/formations/<id>/` | GET | Get formation with state |
| `user/formations/<id>/update/` | POST | Update formation |
| `user/formations/<id>/delete/` | DELETE | Delete formation |
| `user/formations/<id>/set-default/` | POST | Toggle default |

### Backup — 2 endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `ideabin/export/` | GET | Full IdeaBin export (global or context-scoped via `?context_id=`) |
| `ideabin/import/` | POST | Full IdeaBin import/restore (replaces all data or single context) |

---

## 10. Architectural Patterns & Design Decisions

### 10.1 Single-Component State Ownership

All IdeaBin state lives in `IdeaBin.jsx` and is passed down via props. No Redux, Zustand, or Context API. This was a deliberate choice:
- **Simplicity:** One source of truth, no subscription bugs
- **Co-location:** Related state mutations happen in the same file
- **Tradeoff:** The orchestrator is ~2,600 lines; props are drilled through 4+ levels

Five custom hooks (`useIdeaBinIdeas`, `useIdeaBinCategories`, `useIdeaBinDrag`, `useIdeaBinKeyboard`, `useIdeaBinFormations`) extract logic but return state and callbacks to the parent.

### 10.2 Placement-Based Data Model

The key architectural insight is the separation of **content** (Idea) from **placement** (IdeaPlacement). This enables:
- Same idea appearing in multiple categories simultaneously
- Moving an idea between categories without changing its content
- Unassigned ideas existing outside any category
- Counting placements to detect "orphaned" ideas

Frontend state indexes by placement ID, not idea ID.

### 10.3 Context Scoping

When inside a context, the entire data view is filtered. The `get_all_ideas` endpoint returns:
- `data` — all placements (including adopted + context-inherited)
- `order` — unassigned placement order
- `category_orders` — per-category placement order
- `context_idea_orders` — per-context unassigned idea order

The frontend further filters what to display based on the active context's category placements and idea placements.

### 10.4 Optimistic Updates

Most mutations are optimistic — the UI updates immediately and the API call happens in the background. On failure, the state is rolled back (though error handling is minimal — mostly console.error).

### 10.5 Formation State as JSON Blob

Formations don't use related models — they store the entire UI state as a single JSON blob. This makes them:
- Easy to save/load (one read, one write)
- Forward-compatible (new state properties are simply ignored by old formations)
- Self-contained (no schema migrations needed when UI state evolves)

The tradeoff is that ID references in formation state (category positions, legend IDs) can become stale if those entities are deleted. The import system has a `_remap_formation_state` helper that translates old IDs to new ones during backup restore.

### 10.6 Sound Effects

Every major action plays a sound via `playSound()` — a pattern that reinforces the physicality of the workshop metaphor. Create, delete, copy, paste, transform, refactor, open, and close each have distinct audio cues.

### 10.7 Direct DOM Manipulation for Performance

The external drag system (`useIdeaBinDrag`) uses direct DOM queries (`document.querySelectorAll("[data-dep-team-id]")`) rather than React refs to detect drop targets in the dependency view. This avoids tight coupling between the IdeaBin and dependency view components.

Similarly, `useIdeaBinWindow` manipulates the icon position via direct DOM style updates during drag for smooth 60fps animation, only syncing to React state on mouse-up.

### 10.8 Multi-Phase Wizards

Complex operations (transform, reform) use multi-step modals rather than single-action confirms. Each wizard maintains its own local state machine (step tracking, accumulated choices) and only calls the API in the final step.
