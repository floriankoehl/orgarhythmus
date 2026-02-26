# Orgarhythmus

**A visual project-management and idea-organisation platform**
that combines Gantt-style dependency planning, a free-form "IdeaBin"
canvas for brainstorming, and an experimental 3D sandbox — all in one
web app.

Live at **[orgarhythmus.org](https://orgarhythmus.org)**

---

## What It Does — The Big Picture

Orgarhythmus sits at the intersection of two workflows:

1. **Structured project execution** — teams, tasks, milestones on a
   timeline with dependencies, phases, deadlines, and safety checks.
2. **Unstructured idea management** — a desktop-like canvas where ideas,
   categories, legends (tag dimensions), and contexts can be freely
   created, dragged around, merged, and eventually "reformed" into
   real project tasks/teams.

The connecting tissue is the **Context** concept: a context groups
categories and legends together, and can be linked to a project so that
ideas flow into the planning view when the user is ready.

---

## Tech Stack

| Layer     | Technology                                                                   |
|-----------|------------------------------------------------------------------------------|
| Backend   | **Django 5 + Django REST Framework** · SimpleJWT auth · SQLite               |
| Frontend  | **React 19** (Vite) · Tailwind CSS 4 · MUI 7 · React Flow · Three.js / R3F  |
| 3D Engine | CSS `perspective` + `transform-style: preserve-3d` (pure CSS 3D, no WebGL canvas) |
| Infra     | **Docker Compose** — Gunicorn backend + Nginx frontend, Cloudflare in front  |

---

## Repository Layout

```
├── docker-compose.yml          # two services: backend + frontend
├── .env                        # secrets (not committed)
│
├── backend/
│   ├── config/                 # Django project settings, root URL conf, WSGI
│   ├── api/
│   │   ├── models.py           # all domain models (see below)
│   │   ├── urls.py             # ~180 REST endpoints
│   │   ├── views/              # one module per domain area
│   │   │   ├── projects.py     # CRUD + join/leave
│   │   │   ├── teams.py        # CRUD, reorder, join/leave
│   │   │   ├── tasks.py        # CRUD, reorder, assign members, deadlines
│   │   │   ├── milestones.py   # add/move/resize/delete milestones on the timeline
│   │   │   ├── dependencies.py # create/update/delete dependency edges
│   │   │   ├── days.py         # day grid, purposes, blocked days, sync
│   │   │   ├── phases.py       # named timeframe spans on the timeline
│   │   │   ├── ideas.py        # idea CRUD, placements, archive, legend assignment
│   │   │   ├── contexts.py     # context CRUD, category/legend/idea placement
│   │   │   ├── formations.py   # saved IdeaBin layout snapshots
│   │   │   ├── shortcuts.py    # per-user keyboard shortcut config
│   │   │   ├── snapshots.py    # full project state backup/restore
│   │   │   ├── protopersonas.py# 3D persona tokens (CRUD + position)
│   │   │   ├── dependency_views.py # saved dependency-page display configs
│   │   │   ├── notifications.py# in-app notification feed
│   │   │   ├── export.py       # IdeaBin JSON export
│   │   │   ├── import_backup.py# IdeaBin JSON import
│   │   │   ├── auth.py         # register, login check, current user
│   │   │   ├── serializers.py  # DRF serializers
│   │   │   └── helpers.py      # shared utility functions
│   │   └── migrations/         # 40+ migrations tracking schema evolution
│   ├── Dockerfile              # Python 3.12 slim + Gunicorn
│   └── requirements.txt        # Django, DRF, SimpleJWT, CORS, dotenv
│
└── frontend/
    ├── Dockerfile              # Node 20 build → Nginx serve
    ├── nginx.conf              # SPA fallback + /api/ reverse proxy
    ├── package.json            # React 19, Vite, Tailwind, MUI, R3F, React Flow
    └── src/
        ├── App.jsx             # router + auth/notification providers
        ├── auth.js             # login/logout, authFetch wrapper
        ├── auth/               # AuthContext, DemoDateContext, NotificationContext
        ├── config/api.js       # BASE_URL toggle (dev proxy vs prod domain)
        ├── api/
        │   ├── org_API.js      # projects, teams, tasks, users
        │   └── dependencies_api.js # milestones, dependencies, days, phases, views, snapshots
        ├── layouts/
        │   ├── OrgaLayout.jsx  # global header + floating IdeaBin
        │   └── ProjectLayout.jsx # per-project header + outlet
        ├── pages/
        │   ├── AllProjects.jsx         # project browser (own + public)
        │   ├── general/
        │   │   ├── ProjectMain.jsx     # project dashboard, stats, context linking
        │   │   └── Calender.jsx        # calendar/day-purpose editor
        │   ├── overview/
        │   │   ├── Teams.jsx           # team list
        │   │   └── Tasks.jsx           # task list
        │   ├── detail/
        │   │   ├── TeamDetail.jsx      # single team view
        │   │   └── TaskDetail.jsx      # single task view
        │   ├── dependency/             # ★ THE CORE PAGE ★
        │   │   ├── Dependencies.jsx    # 1700-line orchestrator
        │   │   ├── DependencyContext.jsx# React context for shared state
        │   │   ├── layoutMath.js       # pixel-level grid geometry
        │   │   ├── viewDefaults.js     # default display settings
        │   │   ├── depValidation.js    # constraint validation logic
        │   │   ├── use*.js             # ~15 hooks: data, drag, connections,
        │   │   │                       #   milestones, warnings, phases,
        │   │   │                       #   views, snapshots, safety check …
        │   │   └── hooks/              # additional extracted hooks
        │   ├── member_assignment/
        │   │   └── Assignment_Second.jsx # 3D Gantt sandbox (CSS 3D)
        │   └── user/
        │       ├── Login.jsx / Register.jsx
        │       ├── Profile.jsx
        │       ├── MyIdeas.jsx         # full-page idea view
        │       └── MobileIdeaBin.jsx   # responsive mobile variant
        ├── components/
        │   ├── OrgaHeader.jsx / ProjectHeader.jsx
        │   ├── dependencies/           # canvas, day grid, milestones,
        │   │                           #   toolbar, modals, warning toast,
        │   │                           #   safety-check panel
        │   └── ideas/                  # ★ THE IDEABIN ★
        │       ├── IdeaBin.jsx         # 2700-line floating window
        │       ├── IdeaBinCategoryCanvas.jsx  # draggable category cards
        │       ├── IdeaBinContextView.jsx     # context grouping view
        │       ├── IdeaBinLegendPanel.jsx     # legend/type tag management
        │       ├── IdeaBinToolbar.jsx         # toolbar & quick actions
        │       ├── IdeaBinIdeaCard.jsx        # individual idea card
        │       ├── IdeaBinMergeModal.jsx      # merge duplicate ideas
        │       ├── IdeaBinTransformModal.jsx  # idea → task transform
        │       ├── IdeaBinReformCategoryModal.jsx # category → team reform
        │       ├── hooks/              # categories, ideas, formations, drag, keyboard
        │       ├── api/                # authFetch, contextApi, ideaApi, exportApi
        │       └── useLegends.js       # legend CRUD hook
        └── engine3d/
            ├── constants.js            # 3D layout constants
            ├── useCamera3D.js          # orbit/pan/zoom via CSS transforms
            ├── usePersonas.js          # protopersona CRUD & snap logic
            ├── useFloor3D.js           # entity registry + hit-testing
            ├── floor3DMapping.js       # world ↔ board coordinate mapping
            ├── connectionGeometry.js   # Bézier ribbon geometry
            └── components.jsx          # ViewsPanel, DayGrid, MilestoneLayer
```

---

## Domain Model

The core data model (all in `api/models.py`):

### Project Planning Domain

```
Project ──┬── Team ──── Task
           │              ├── Milestone (positioned on the timeline)
           │              └── assigned_members (M2M → User)
           ├── Day (one per calendar day in the project range)
           ├── Phase (named timeframe span, optionally per-team)
           ├── DependencyView (saved display configuration)
           └── ProjectSnapshot (full JSON backup of all project state)

Milestone ──→ Dependency (source → target, weight: strong/weak/suggestion)
Milestone ←── ProtoPersona (M2M, for 3D assignment view)
```

- **Project**: owner + members, date range, auto-creates Day objects.
- **Team**: belongs to a project, has color, order, members.
- **Task**: belongs to a team, has name, priority, difficulty,
  assigned members, optional hard deadline (day index).
- **Milestone**: a time block on a task's row — `start_index` + `duration`
  on the project day grid.
- **Dependency**: directed edge between two milestones with a weight
  (strong / weak / suggestion) and an optional reason.
- **Day**: each calendar day in the project, with purpose labels,
  blocked/holiday flags, per-team scoping.
- **Phase**: a named colored span across the timeline (e.g. "Sprint 1"),
  optionally scoped to one team.
- **DependencyView**: saves the frontend's display state (collapsed teams,
  hidden items, zoom, scroll position) so users can switch between views.
- **ProjectSnapshot**: serialises the entire project state into JSON for
  backup/restore.
- **ProtoPersona**: a named figure with a color and 3D position; links
  to milestones, teams, and tasks for the 3D sandbox.
- **Notification**: in-app notifications for task assignment, team events, etc.
- **DemoDate**: a global override for "today" — useful for demonstrations.

### IdeaBin Domain

```
Context ──┬── CategoryContextPlacement → Category ──→ IdeaPlacement → Idea
           ├── LegendContextPlacement  → Legend   ──→ LegendType
           ├── IdeaContextPlacement    → Idea
           └── ProjectContextPlacement → Project

Idea ──→ IdeaLegendType (one type per legend per idea)
Idea ──→ IdeaUpvote / IdeaComment
Idea ──→ IdeaPlacement (one per category; same idea in multiple categories)

User ──→ Formation (saved IdeaBin layout snapshot, per context)
User ──→ UserShortcuts (custom keyboard mapping + filter presets)
User ──→ UserCategoryAdoption / UserLegendAdoption / UserContextAdoption
```

- **Idea**: the canonical object — title + description, owned by a user.
- **IdeaPlacement**: lightweight reference placing an idea inside a category.
  One idea can appear in many categories.
- **Category**: a draggable card on the canvas with position (x, y, width,
  height, z_index). Can be public for adoption by other users.
- **Legend**: a tag dimension (e.g. "Priority", "Effort") containing
  multiple **LegendType** entries (e.g. "High" with color red).
- **IdeaLegendType**: assigns exactly one type per legend to an idea.
- **Context**: the highest grouping level — groups categories, legends,
  and loose ideas. Has its own canvas position, optional color, and
  filter state. Can link to projects (bridging ideas → execution).
- **Formation**: a named snapshot of the entire IdeaBin UI layout —
  window position/size, sidebar width, collapsed categories, active
  legend, filter state — so users can save and restore workspaces.
- **Adoption models**: let users "subscribe" to public categories,
  legends, or contexts created by other users.

---

## Key Features

### Dependency Page (the core planning view)
- **Gantt-style grid**: teams as rows, days as columns, milestones as
  draggable/resizable blocks.
- **Dependency arrows**: draw directed edges between milestones with
  weight (strong/weak/suggestion) and reason text.
- **Phases**: named colored spans overlaid on the timeline.
- **Day management**: mark days as blocked, assign purpose labels
  (optionally per-team), color-code days.
- **Validation / Safety Check**: highlights milestones that violate
  dependency constraints (deadline overruns, ordering conflicts).
- **Views**: save/load different display configurations (visible teams,
  collapsed state, zoom, scroll).
- **Snapshots**: back up and restore the full project state.
- **Keyboard shortcuts**: customisable Q+W chord-based shortcuts.

### IdeaBin (the brainstorming tool)
- **Floating window** that persists across all pages — open it anywhere.
- **Category canvas**: drag and resize category cards; ideas are placed
  inside them.
- **Context view**: higher-level grouping of categories and legends.
- **Legends**: create tag dimensions with colored types, assign to ideas,
  filter by type.
- **Merge / Spinoff / Archive**: combine duplicate ideas, fork ideas,
  soft-delete.
- **Transform → Task**: convert an idea into a project task + milestone.
- **Reform → Team**: convert a category into a project team, bulk-creating
  tasks and milestones.
- **Formations**: save/restore the entire IdeaBin layout.
- **Export / Import**: full JSON backup of all idea data.
- **Public sharing & adoption**: make categories/contexts public and let
  other users adopt them.

### 3D Assignment Sandbox
- **CSS 3D** (not WebGL) — the Gantt grid is rendered in perspective with
  orbit, pan, and scale-zoom controlled by mouse/keyboard.
- **Protopersonas**: small blocky figures that snap to milestones on the
  3D board, representing team member allocation.
- **Dependency ribbons**: 3D Bézier connections between milestones.
- Reuses the same view/display-settings system as the 2D dependency page.

### Other
- **JWT authentication** with register/login/refresh.
- **Notifications**: real-time-ish in-app feed for task assignments, team
  events, etc.
- **Project browser**: list own projects, browse public ones, join/leave.
- **Calendar page**: day-purpose editor with a calendar UI.
- **Mobile IdeaBin**: responsive alternative layout for small screens.

---

## Running Locally

### Prerequisites
- **Docker** + **Docker Compose** (recommended), or
- Python 3.12, Node 20+ installed manually.

### With Docker Compose
```bash
# 1. Create a .env file in the repo root
echo "SECRET_KEY=your-secret-key" > .env
echo "DEBUG=True" >> .env

# 2. Build and start
docker compose up --build

# Frontend: http://localhost:8081
# Backend API: http://localhost:9000/api/
```

### Manual (development)
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173  (Vite proxies /api/ to Django)
```

---

## Production Deployment

The app runs on a server behind **Cloudflare**:
- `orgarhythmus.org` → Nginx container (port 8081) serving the React SPA.
- `api.orgarhythmus.org` → Django/Gunicorn container (port 9000).
- Nginx also reverse-proxies `/api/` requests to the backend container
  internally, so the frontend can use relative paths in development.
- SQLite is persisted via a Docker volume (`db-data`).

---

## Current State & Direction

The project is **functional and deployed**, with two substantial feature
surfaces:

1. The **dependency/Gantt planner** is mature — milestone drag-and-drop,
   dependency validation, phases, views, snapshots, and the full safety-check
   pipeline are in place.
2. The **IdeaBin** is equally deep — context/category/legend layering,
   formations, merge/spinoff, transform-to-task, and the public-adoption
   system all work end-to-end.
3. The **3D sandbox** is experimental but functional — CSS 3D rendering,
   camera controls, protopersona snapping, and dependency ribbons are
   implemented.

The overall direction points toward **tighter idea-to-execution flow** —
bridging the creative brainstorming space (IdeaBin) with structured
project execution (dependencies) through contexts and the
reform/transform modals. The adoption system hints at a future where
teams can share and remix each other's category structures and idea pools.

---

## License

Not yet specified.
