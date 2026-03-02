# DependencyGrid

A fully-featured, generic **grid board component** for React.
Think of it as a domain-agnostic scheduling / dependency visualization tool — like ReactFlow, but for **time-based grids** with lanes, rows, nodes, edges and columns.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Terminology](#terminology)
4. [Quick Start](#quick-start)
5. [Data Types](#data-types)
6. [Props Reference](#props-reference)
7. [The Adapter Pattern](#the-adapter-pattern)
8. [Writing Your Own Adapter](#writing-your-own-adapter)
9. [File Reference](#file-reference)
10. [Features](#features)
11. [Views & Snapshots](#views--snapshots)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Validation & Safety](#validation--safety)
14. [Field Name Contract](#field-name-contract)
15. [Customization](#customization)
16. [FAQ](#faq)

---

## Overview

`DependencyGrid` renders a two-dimensional grid where:

- **Columns** represent discrete time slots (e.g. days, sprints, weeks).
- **Lanes** are top-level groupings (e.g. teams, departments, categories).
- **Rows** live inside lanes (e.g. tasks, people, workstreams).
- **Nodes** are positioned blocks that span one or more columns inside a row (e.g. milestones, tasks, deliverables).
- **Edges** are directional relationships between nodes (e.g. dependencies).
- **Phases** are named column spans (e.g. "Sprint 1", "Design Phase") displayed as colored bars.

The component handles all interaction logic internally:
- Drag-to-move and resize nodes
- Drag-to-create edges between nodes
- Drag-to-reorder lanes and rows
- Multi-select, copy/paste, undo/redo
- Column collapsing, view saving/loading, safety checks
- Full keyboard shortcut system

**All backend I/O is injected** via callback props. The grid never calls any API directly — it performs optimistic local state updates and then calls your persist callbacks.

```
┌──────────────────────────────────────────────────────┐
│                  Your Adapter                        │
│  (owns state, talks to backend, transforms data)     │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │           <DependencyGrid />                 │   │
│   │  (pure UI + interaction logic, no API calls) │   │
│   └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Architecture

```
grid_board/
├── index.js                    # Barrel export
│
├── DependencyGrid.jsx          # Composition root (≈1400 lines)
│                                 Wires all hooks + renders all sub-components
│
├── MilestoneScheduleAdapter.jsx # Reference adapter for the Django backend
│                                 (Team→Lane, Task→Row, Milestone→Node, etc.)
│
├── GridBoardContext.jsx         # React context for transient UI state
│                                 (selection, undo/redo, clipboard, hover)
│
│  ─── Foundation ───
├── types.js                    # JSDoc type definitions (the API contract)
├── layoutMath.js               # Pure layout calculation functions + constants
├── gridValidation.js           # Pure scheduling validation (overlap, edges, deadlines)
├── viewDefaults.js             # Default values for every view setting
│
│  ─── Hooks (state & logic) ───
├── useColumnManagement.js      # Column collapse/expand, column layout offsets
├── useDisplaySettings.js       # Row/lane visibility, sizing, lane colors
├── useGridUIState.js           # Modals, toolbar state, fullscreen
├── useGridWarnings.js          # Warning toast with auto-dismiss
├── useDragInteractions.js      # Lane and row drag-to-reorder
├── useNodeInteractions.js      # Node move, resize, delete, rename, click
├── useEdgeInteractions.js      # Edge create (drag-to-connect), delete, update
├── usePhaseManagement.js       # Phase CRUD, drag-move, edge-resize
├── useViewManagement.js        # Save/load/switch named views
├── useSafetyCheck.js           # Run all scheduling rules against fresh data
├── useGridInteraction.js       # Orchestrator — composes the above + keyboard
├── useGridActions.js           # CRUD actions (create node, lane, row, etc.)
│
│  ─── UI Components ───
├── GridToolbar.jsx             # Control panel (modes, views, settings, etc.)
├── GridCanvas.jsx              # Main SVG+HTML render (lanes, rows, edges, phases)
├── GridNodeLayer.jsx           # Node blocks with drag handles, labels, resize
├── GridLaneList.jsx            # Lane headers + per-lane phase bars
├── GridColumnGrid.jsx          # Column header row (labels, collapse buttons)
├── GridRowSelectionBar.jsx     # Row label sidebar (name, deadline, multi-select)
├── GridModals.jsx              # All modal dialogs (create, rename, move, etc.)
├── GridWarningToast.jsx        # Toast notification overlay
└── SafetyCheckPanel.jsx        # Safety check results panel
```

### Data Flow

```
Adapter (state owner)
  │
  ├── nodes, edges, rows, lanes, phases, columns ──→  DependencyGrid (props)
  │                                                           │
  ├── setNodes, setEdges, setRows, ... ──→     (optimistic local updates)
  │                                                           │
  └── persistNodeMove, persistEdgeCreate, ... ──→  (async backend sync)
                                                              │
                                        useNodeInteractions ──┤
                                        useEdgeInteractions ──┤
                                        useDragInteractions ──┤
                                        useGridActions ────────┘
```

The grid performs **optimistic updates** — it updates local state immediately via the `setX` functions, then calls your `persistX` callbacks asynchronously. If a persist callback throws, the undo history can revert the change.

---

## Terminology

The component uses generic names internally. When building an adapter, you map your domain language:

| Generic (grid_board) | Milestone Schedule | Kanban Board | Sprint Planner |
|---|---|---|---|
| **Lane** | Team | Board Column | Team |
| **Row** | Task | Card Category | Sprint |
| **Node** | Milestone | Card | User Story |
| **Edge** | Dependency | Blocked-by | Depends-on |
| **Column** | Day | Priority Level | Day |
| **Phase** | Phase | — | Iteration |

You can customize all user-facing labels via props:

```jsx
<DependencyGrid
  laneLabel="Team"
  rowLabel="Task"
  nodeLabel="Milestone"
  edgeLabel="Dependency"
  columnLabel="Day"
/>
```

---

## Quick Start

### Using the built-in Milestone adapter

```jsx
import { MilestoneScheduleAdapter } from './grid_board';

// In your route:
<Route path="/projects/:projectId/dependencies" element={<MilestoneScheduleAdapter />} />
```

The adapter reads `projectId` from the URL, fetches all data from the Django backend, and renders the grid. No additional wiring needed.

### Using DependencyGrid directly (custom adapter)

```jsx
import { DependencyGrid } from './grid_board';

function MyCustomGrid() {
  const [nodes, setNodes] = useState({});
  const [edges, setEdges] = useState([]);
  const [rows, setRows] = useState({});
  const [lanes, setLanes] = useState({});
  const [laneOrder, setLaneOrder] = useState([]);
  const [phases, setPhases] = useState([]);

  // ... fetch and transform your data ...

  return (
    <DependencyGrid
      totalColumns={30}
      columnLabels={myColumnLabels}
      nodes={nodes}     setNodes={setNodes}
      edges={edges}     setEdges={setEdges}
      rows={rows}       setRows={setRows}
      lanes={lanes}     setLanes={setLanes}
      laneOrder={laneOrder}  setLaneOrder={setLaneOrder}
      phases={phases}   setPhases={setPhases}

      // Persist callbacks
      persistNodeMove={async (nodeId, newCol) => { /* your API call */ }}
      persistNodeResize={async (nodeId, durationChange) => { /* ... */ }}
      persistEdgeCreate={async (srcId, tgtId, opts) => { /* ... */ }}
      // ... etc

      laneLabel="Department"
      rowLabel="Project"
      nodeLabel="Deliverable"
      edgeLabel="Dependency"
      columnLabel="Week"
    />
  );
}
```

---

## Data Types

### GridNode

```js
{
  id: 1,                    // Unique identifier (number or string)
  name: "Design Review",    // Display name
  description: "...",       // Optional description
  row: 42,                  // ID of the parent row
  startColumn: 5,           // 0-based column index where this node starts
  duration: 3,              // How many columns this node spans
  display: "default",       // Optional display hint
  color: "#ff0000",         // Optional color override
}
```

### GridEdge

```js
{
  source: 1,                // Source node ID
  target: 2,                // Target node ID
  weight: "strong",         // "strong" | "weak" | "suggestion"
  reason: "is required for",// Human-readable reason
  description: "...",       // Additional context
}
```

### GridRow

```js
{
  id: 42,
  name: "Backend API",
  description: "...",
  lane: 10,                 // ID of the parent lane
  nodes: [{ id: 1 }, ...],  // References to nodes in this row
  hardDeadline: 25,         // Optional — column index after which nodes are "late"
}
```

### GridLane

```js
{
  id: 10,
  name: "Engineering",
  color: "#3b82f6",
  rows: [42, 43, 44],       // Ordered list of row IDs
  _virtual: false,           // true for auto-generated lanes like "Unassigned"
}
```

### GridColumn (label metadata)

```js
{
  index: 0,
  label: "1.3",             // Primary label (e.g. date)
  sublabel: "Mo",           // Secondary label (e.g. day name)
  isHighlighted: false,     // Primary highlight (e.g. Sunday)
  isSecondaryHighlight: true,// Secondary highlight (e.g. weekend)
  purpose: "Sprint Review", // Overlay text
  purposeLanes: null,       // null = all lanes, or [laneId, ...] for specific lanes
  isBlocked: false,          // Visual blocked indicator
}
```

### GridPhase

```js
{
  id: 100,
  name: "Sprint 1",
  start_index: 0,           // Column start (backend field name; aliased as startColumn internally)
  duration: 10,
  color: "#facc15",
  lane: null,               // null = global phase; lane ID = per-lane phase
  team: null,               // Backend alias kept for compatibility
}
```

---

## Props Reference

### Core Data (all required for a functional grid)

| Prop | Type | Description |
|------|------|-------------|
| `totalColumns` | `number` | Total number of columns |
| `columnLabels` | `GridColumn[]` | Metadata for each column |
| `lanes` | `Object<id, GridLane>` | All lanes keyed by ID |
| `laneOrder` | `Array<id>` | Display order of lane IDs |
| `rows` | `Object<id, GridRow>` | All rows keyed by ID |
| `nodes` | `Object<id, GridNode>` | All nodes keyed by ID |
| `edges` | `GridEdge[]` | All edges (directional) |
| `phases` | `GridPhase[]` | Phase spans |

### Data Setters (all required)

| Prop | Type | Description |
|------|------|-------------|
| `setLanes` | `Function` | React state setter for lanes |
| `setLaneOrder` | `Function` | React state setter for lane order |
| `setRows` | `Function` | React state setter for rows |
| `setNodes` | `Function` | React state setter for nodes |
| `setEdges` | `Function` | React state setter for edges |
| `setPhases` | `Function` | React state setter for phases |
| `setColumnLabels` | `Function` | `(colIdx, fields) => void` — updates column metadata |
| `onReloadData` | `Function` | Trigger a full data reload in the adapter |

### Persist Callbacks (async, all optional but recommended)

| Callback | Signature | Description |
|----------|-----------|-------------|
| `persistNodeMove` | `(nodeId, newStartColumn) → Promise` | Move a node to a new column |
| `persistNodeResize` | `(nodeId, durationChange) → Promise` | Change node duration (delta) |
| `persistNodeCreate` | `(rowId, opts?) → Promise<node>` | Create a new node |
| `persistNodeDelete` | `(nodeId) → Promise` | Delete a node |
| `persistNodeRename` | `(nodeId, newName) → Promise` | Rename a node |
| `persistNodeTaskChange` | `(nodeId, newRowId) → Promise` | Move node to different row |
| `persistEdgeCreate` | `(sourceId, targetId, opts?) → Promise` | Create a new edge |
| `persistEdgeDelete` | `(sourceId, targetId) → Promise` | Delete an edge |
| `persistEdgeUpdate` | `(sourceId, targetId, updates) → Promise` | Update edge weight/reason |
| `persistLaneOrder` | `(newOrder) → Promise` | Save new lane display order |
| `persistLaneCreate` | `(name, color) → Promise` | Create a new lane |
| `persistLaneColor` | `(laneId, color) → Promise` | Change lane color |
| `persistRowOrder` | `(rowId, laneId, order) → Promise` | Reorder rows within a lane |
| `persistRowCreate` | `(name, laneId) → Promise` | Create a new row |
| `persistRowDeadline` | `(rowId, colIndex) → Promise` | Set/clear row deadline |
| `persistColumnPurpose` | `(colIndex, purpose, lanes) → Promise` | Set column purpose text |
| `persistPhaseCreate` | `(phaseData) → Promise<phase>` | Create a phase |
| `persistPhaseUpdate` | `(phaseId, updates) → Promise<phase>` | Update a phase |
| `persistPhaseDelete` | `(phaseId) → Promise` | Delete a phase |

### View & Snapshot API (optional)

| Prop | Signature | Description |
|------|-----------|-------------|
| `fetchViews` | `() → Promise<views[]>` | Load saved views |
| `createViewApi` | `(name, state) → Promise<view>` | Create a new view |
| `updateViewApi` | `(viewId, updates) → Promise<view>` | Update a view |
| `deleteViewApi` | `(viewId) → Promise` | Delete a view |
| `setDefaultViewApi` | `(viewId) → Promise` | Set the default view |
| `fetchSnapshots` | `() → Promise<{snapshots}>` | Load snapshots |
| `createSnapshotApi` | `(name, desc, state) → Promise` | Create a snapshot |
| `restoreSnapshotApi` | `(snapId) → Promise` | Restore a snapshot |
| `deleteSnapshotApi` | `(snapId) → Promise` | Delete a snapshot |
| `renameSnapshotApi` | `(snapId, name) → Promise` | Rename a snapshot |

### Safety Check

| Prop | Signature | Description |
|------|-----------|-------------|
| `fetchSafetyCheckData` | `() → Promise<{nodes, edges, rows, totalColumns}>` | Fetch fresh data for safety validation |

### Labels & Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `laneLabel` | `string` | `"Lane"` | User-facing name for lanes |
| `rowLabel` | `string` | `"Row"` | User-facing name for rows |
| `nodeLabel` | `string` | `"Node"` | User-facing name for nodes |
| `edgeLabel` | `string` | `"Edge"` | User-facing name for edges |
| `columnLabel` | `string` | `"Column"` | User-facing name for columns |
| `laneColors` | `string[]` | 12 preset colors | Color palette for new lanes |
| `userShortcuts` | `Object` | `{}` | Saved keyboard shortcut preferences |
| `onSaveShortcuts` | `Function` | — | Persist shortcut changes |
| `onLaneNavigate` | `(laneId) → void` | — | Navigate to a lane detail page |
| `onRowNavigate` | `(rowId) → void` | — | Navigate to a row detail page |
| `buildClipboardText` | `Function` | — | Build clipboard text for copy |
| `onBulkImport` | `(jsonString) → Promise` | — | Handle bulk JSON import |
| `children` | `ReactNode` | — | Extra content rendered inside the grid container |

---

## The Adapter Pattern

The grid is **completely agnostic** about your data source. It never imports any API module or knows about your backend. Instead, you write an **adapter** that:

1. **Owns the data state** (`useState` for nodes, edges, rows, lanes, etc.)
2. **Fetches data** on mount and transforms it to the generic shapes
3. **Provides persist callbacks** that map generic operations to your backend API
4. **Renders `<DependencyGrid />`** passing everything as props

### Why this pattern?

- **Reusability**: The same grid can display milestones, kanban cards, sprint stories, resource allocation — anything that fits the lane/row/node/column model.
- **Testability**: The grid can be rendered with mock data and no-op callbacks.
- **Separation of concerns**: Backend API changes only affect the adapter, never the grid internals.

---

## Writing Your Own Adapter

Here's a minimal adapter skeleton:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { DependencyGrid } from '../grid_board';

export default function MyAdapter() {
  // 1. Own the data state
  const [nodes, setNodes] = useState({});
  const [edges, setEdges] = useState([]);
  const [rows, setRows] = useState({});
  const [lanes, setLanes] = useState({});
  const [laneOrder, setLaneOrder] = useState([]);
  const [phases, setPhases] = useState([]);
  const [totalColumns, setTotalColumns] = useState(0);
  const [columnLabels, setColumnLabels] = useState([]);

  // 2. Fetch and transform data on mount
  useEffect(() => {
    async function load() {
      const data = await fetch('/api/my-data');

      // Transform to generic shapes
      const laneObj = {};
      for (const dept of data.departments) {
        laneObj[dept.id] = {
          id: dept.id,
          name: dept.name,
          color: dept.color,
          rows: dept.project_ids,
        };
      }
      setLanes(laneObj);
      setLaneOrder(data.departments.map(d => d.id));

      const rowObj = {};
      for (const proj of data.projects) {
        rowObj[proj.id] = {
          id: proj.id,
          name: proj.name,
          lane: proj.department_id,   // ← map your FK to "lane"
          nodes: proj.deliverable_ids.map(id => ({ id })),
        };
      }
      setRows(rowObj);

      const nodeObj = {};
      for (const d of data.deliverables) {
        nodeObj[d.id] = {
          id: d.id,
          name: d.name,
          row: d.project_id,          // ← map your FK to "row"
          startColumn: d.week_start,  // ← map your field to "startColumn"
          duration: d.week_count,
        };
      }
      setNodes(nodeObj);

      // ... edges, phases, columns similarly
    }
    load();
  }, []);

  // 3. Provide persist callbacks
  const persistNodeMove = useCallback(async (nodeId, newStartCol) => {
    await fetch(`/api/deliverables/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ week_start: newStartCol }),
    });
  }, []);

  const persistNodeResize = useCallback(async (nodeId, durationChange) => {
    await fetch(`/api/deliverables/${nodeId}/resize`, {
      method: 'POST',
      body: JSON.stringify({ delta: durationChange }),
    });
  }, []);

  // ... more persist callbacks as needed

  // 4. Render
  return (
    <DependencyGrid
      totalColumns={totalColumns}
      columnLabels={columnLabels}
      nodes={nodes}     setNodes={setNodes}
      edges={edges}     setEdges={setEdges}
      rows={rows}       setRows={setRows}
      lanes={lanes}     setLanes={setLanes}
      laneOrder={laneOrder}  setLaneOrder={setLaneOrder}
      phases={phases}   setPhases={setPhases}

      persistNodeMove={persistNodeMove}
      persistNodeResize={persistNodeResize}
      // ... etc

      laneLabel="Department"
      rowLabel="Project"
      nodeLabel="Deliverable"
      edgeLabel="Dependency"
      columnLabel="Week"
    />
  );
}
```

### Important: Field Name Contract

When your adapter transforms data into the generic shapes, nodes **must** use the generic field names:

| Your backend field | Generic field (required) |
|----|-----|
| `task`, `project_id`, `category` | → `row` |
| `start_index`, `week_start`, `begin_col` | → `startColumn` |
| `team`, `department_id`, `group` | → `lane` (on rows) |

The grid reads `node.row`, `node.startColumn`, `row.lane` internally. If your backend uses different names, add aliases in the adapter:

```js
nodeObj[m.id] = { ...m, row: m.task, startColumn: m.start_index };
```

Similarly, the `persistNodeCreate` callback should return the created node with generic field aliases so the grid can use it immediately:

```js
const persistNodeCreate = async (rowId, opts) => {
  const { startColumn, ...rest } = opts;
  const result = await api.create({ ...rest, start_index: startColumn });
  return { ...result, row: result.task, startColumn: result.start_index };
};
```

### Phase Field Names

Phases use `start_index` (backend name) throughout the codebase for historical reasons. The grid reads `phase.start_index`, `phase.duration`, `phase.lane` (or `phase.team`). Your adapter should provide `lane` if your backend uses a different name:

```js
setPhases(backendPhases.map(p => ({ ...p, lane: p.team })));
```

---

## File Reference

### Foundation Files

| File | Purpose |
|------|---------|
| `types.js` | JSDoc type definitions — the canonical API contract. Read this first. |
| `layoutMath.js` | Pure functions: row heights, lane heights, Y-offsets, column offsets, content height. Also exports all layout constants (default row height, lane width, etc.). |
| `gridValidation.js` | Pure validation: `checkNodeOverlap`, `validateNodeMove`, `computeCascadePush`, `checkDeadlineViolation`. No React — usable standalone. |
| `viewDefaults.js` | Every default setting value. Change a value here → the "Default" view uses it. New settings get automatic fallback. |

### Context

| File | Purpose |
|------|---------|
| `GridBoardContext.jsx` | Provides transient UI state: selection, hover, clipboard, undo/redo history (10 actions max), editing state. Mounted automatically by `<DependencyGrid>`. |

### Hooks

| Hook | Responsibility |
|------|---------------|
| `useColumnManagement` | Column collapse/expand sets, pixel offset calculations, variable-width column support |
| `useDisplaySettings` | Row/lane visibility, sizing (normal/small/hidden), lane collapsing, show-empty-lanes |
| `useGridUIState` | Modal state (create node, move, delete confirm, phase edit, etc.), toolbar state, fullscreen |
| `useGridWarnings` | Warning queue with auto-dismiss, blocking-node highlight, feedback flash |
| `useDragInteractions` | Lane drag-to-reorder, row drag-to-reorder, ghost rendering during drag |
| `useNodeInteractions` | Node mousedown/move/resize, multi-select drag, edge-resize, click, double-click rename, column cell click |
| `useEdgeInteractions` | Edge drag-to-create from handles, click-select, delete, update weight/reason, position helpers for SVG paths |
| `usePhaseManagement` | Phase CRUD, edge-resize phases, drag-move phases, overlap detection |
| `useViewManagement` | Named views: save, load, switch, delete, set-default. Collects/applies full view state. |
| `useSafetyCheck` | Fetches fresh data, runs all validation rules, generates categorized issue list |
| `useGridInteraction` | **Orchestrator**: composes all the above + global keyboard shortcuts (100+ bindings) |
| `useGridActions` | CRUD operations: create/delete nodes/lanes/rows, column purpose, deadline, bulk edge updates |

### UI Components

| Component | What it renders |
|-----------|----------------|
| `GridToolbar` | Control panel with mode selector, view switcher, settings panels, create buttons |
| `GridCanvas` | Main grid area: lane backgrounds, row backgrounds, edge SVG paths, phase bars, ghost overlays, edge drawing preview |
| `GridNodeLayer` | Node blocks: name label, resize handles (left/right), selection highlight, multi-node position bar |
| `GridLaneList` | Left sidebar: lane headers with collapse/color/navigate buttons, per-lane phase bar rows |
| `GridColumnGrid` | Top header: column labels (date + day name), collapse/expand buttons, purpose indicators |
| `GridRowSelectionBar` | Row label area: row names, deadline indicators, multi-select checkboxes, row height controls |
| `GridModals` | All dialogs: node create, node rename, move confirmation, delete confirmation, phase edit, lane create, row create, bulk import, etc. |
| `GridWarningToast` | Floating toast notifications for warnings and errors |
| `SafetyCheckPanel` | Expandable panel showing safety check results grouped by category |

---

## Features

### Interaction Modes

The grid supports three view modes, switchable via toolbar or keyboard:

| Mode | Key | Behavior |
|------|-----|----------|
| **Inspection** | `I` | Left-click selects nodes. Drag creates a marquee selection. |
| **Schedule** | `S` | Left-click + drag moves nodes. Edge handles disabled. |
| **Dependency** | `D` | Left-click + drag from node handles creates edges. |

### Node Operations

- **Move**: Drag horizontally in Schedule mode. Multi-select moves all together.
- **Resize**: Drag left/right edge handles. Left-resize changes start + duration. Right-resize changes duration only.
- **Create**: Click empty column cell, or use toolbar, or press `N`.
- **Delete**: Select + press `Delete` / `Backspace`.
- **Rename**: Double-click a node, or select + press `F2`.
- **Copy/Paste**: `Ctrl+C` / `Ctrl+V` — copies nodes + internal edges, offsets to the right.

### Edge Operations

- **Create**: In Dependency mode, drag from a node's handle (small circles on left/right edges) to another node.
- **Delete**: Click an edge to select it, then press `Delete`.
- **Weight**: Three levels — `strong` (hard constraint), `weak` (soft, shown dashed), `suggestion` (very soft, shown lighter). Cycle with `W` when edge is selected.
- **Safe Mode**: When enabled, moving a node past its strong/weak edge constraint shows a warning and blocks the move.

### Column Features

- **Collapse**: Click the collapse button in a column header to hide that column (saves space for long timelines).
- **Purpose**: Right-click a column header to set a purpose label (shown as an overlay).
- **Phase-aware widths**: Collapsed columns show as thin slivers; the grid recalculates all positions.

### Lane & Row Features

- **Lane reorder**: Drag lane headers up/down.
- **Row reorder**: Drag row labels within or between lanes.
- **Lane collapse**: Double-click lane header to collapse (hides all rows, shows summary).
- **Row size**: Toggle between normal and small row height, or hide rows entirely.
- **Lane color**: Click the color swatch in the lane header to change color.

### Undo/Redo

All user actions push to an undo stack (max 10). Each action stores both `undo()` and `redo()` async functions that also call persist callbacks to sync with the backend.

- `Ctrl+Z` — undo
- `Ctrl+Y` / `Ctrl+Shift+Z` — redo

---

## Views & Snapshots

### Views

A **view** saves the complete visual state of the grid — which lanes/rows are visible, column widths, collapsed columns, edge display settings, view mode, etc. Views do NOT save data — just how it's displayed.

- Save: toolbar → "Save View" or press `Ctrl+Shift+S`
- Load: toolbar → click a view name, or press `1-9` with `X` held
- The "Default" view always exists and cannot be deleted.

View state includes (see `viewDefaults.js` for the full list):
- `rowDisplaySettings`, `laneDisplaySettings`
- `viewMode`, `collapsedColumns`, `edgeSettings`
- `customColumnWidth`, `customRowHeightNormal`, `customRowHeightSmall`
- `showPhaseColorsInGrid`, `hideAllEdges`, `hideCollapsedEdges`, etc.

### Snapshots

A **snapshot** saves the actual data state (node positions, edges, etc.) at a point in time. Use for rollback / backup.

---

## Keyboard Shortcuts

The grid has an extensive keyboard shortcut system. Key categories:

| Category | Examples |
|----------|---------|
| **Mode switching** | `I` inspection, `S` schedule, `D` dependency |
| **Selection** | `Ctrl+A` select all, `Escape` deselect, `Tab` cycle |
| **Editing** | `N` new node, `Delete` delete, `F2` rename |
| **History** | `Ctrl+Z` undo, `Ctrl+Y` redo |
| **Views** | `X+1..9` load view, `Ctrl+Shift+S` save |
| **Navigation** | Arrow keys move selection, `Home`/`End` jump |
| **Display** | `H` toggle header, `T` toggle toolbar, `F11` fullscreen |
| **Quick settings** | `Q+W` column width, `Q+R` row height, etc. |

User-customizable shortcuts are stored in `userShortcuts` and persisted via `onSaveShortcuts`.

---

## Validation & Safety

### Inline Validation (gridValidation.js)

During user interactions, the grid runs inline checks:

- **Edge constraint**: Moving node A past a connected node B shows a warning (blocks in safe mode).
- **Overlap**: Two nodes in the same row cannot occupy the same column range.
- **Deadline**: A node cannot extend past its row's `hardDeadline` column.
- **Cascade push**: In permissive mode, downstream nodes auto-push to maintain constraints.

### Safety Check (useSafetyCheck.js)

The safety check fetches fresh data from the backend (via `fetchSafetyCheckData`) and runs all rules:

1. **Edge Breaks** — strong/weak edges where source ends after target starts
2. **Suggestion Breaks** — same but for suggestion-weight edges
3. **Circular Edges** — DFS cycle detection in the edge graph
4. **Before Grid Start** — nodes with negative column indices
5. **After Grid End** — nodes extending past `totalColumns`
6. **After Deadline** — nodes past their row's hard deadline

Results are displayed in the `SafetyCheckPanel` with severity levels and clickable node links.

---

## Field Name Contract

This is the most important section for adapter authors. The grid's internal hooks use these field names on data objects:

### On Nodes
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number\|string` | Unique identifier |
| `name` | `string` | Display name |
| `row` | `number\|string` | FK to parent row — **must be present** |
| `startColumn` | `number` | 0-based column position — **must be present** |
| `duration` | `number` | Column span (default: 1) |
| `display` | `string` | Optional display hint |
| `color` | `string` | Optional color override |

### On Rows
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number\|string` | Unique identifier |
| `name` | `string` | Display name |
| `lane` | `number\|string` | FK to parent lane — **must be present** |
| `nodes` | `Array<{id}>` | Node references in this row |
| `hardDeadline` | `number\|null` | Optional deadline column |

### On Lanes
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number\|string` | Unique identifier |
| `name` | `string` | Display name |
| `color` | `string` | Lane color |
| `rows` | `Array<id>` | Ordered row IDs |

### On Phases
| Field | Type | Description |
|-------|------|-------------|
| `id` | `number\|string` | Unique identifier |
| `name` | `string` | Phase name |
| `start_index` | `number` | Column start position |
| `duration` | `number` | Column span |
| `lane` | `number\|string\|null` | Lane scope (null = global) |
| `team` | `number\|string\|null` | Backend alias for lane (kept for compat) |
| `color` | `string` | Phase color |

---

## Customization

### Layout Constants

Override via props or adjust defaults in `layoutMath.js`:

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_COLUMNWIDTH` | 60px | Column width |
| `DEFAULT_ROWHEIGHT_NORMAL` | 32px | Normal row height |
| `DEFAULT_ROWHEIGHT_SMALL` | 22px | Collapsed row height |
| `LANEWIDTH` | 150px | Lane sidebar width |
| `ROWLABELWIDTH` | 200px | Row label column width |
| `HEADER_HEIGHT` | 48px | Column header row height |

Users can adjust column width, row heights, lane width and row label width live via the toolbar settings panel. These values are saved per-view.

### Sounds

The grid plays UI sounds for interactions (connect, move, delete, etc.) via `sound_registry.js`. Sounds can be disabled per-view (`soundEnabled` setting) or muted globally.

### Children Slot

Pass extra JSX as `children` to render domain-specific overlays inside the grid container:

```jsx
<DependencyGrid {...props}>
  <MyRefactorBanner />
  <MyCustomOverlay />
</DependencyGrid>
```

---

## FAQ

### How do I make a read-only grid?

Don't pass any `persist*` callbacks. The grid will still allow local interactions (selecting, viewing) but won't try to save anything. To fully disable editing, use inspection mode only.

### Can I use this without phases?

Yes — pass `phases={[]}` and omit the phase callbacks. The phase header and per-lane phase rows won't render.

### Can I use this without edges?

Yes — pass `edges={[]}` and omit edge callbacks. Edge handles won't appear on nodes.

### How do I add a new setting to views?

1. Add the default value in `viewDefaults.js`
2. Add it to `getDefaultViewState()`
3. Add collect/apply logic in `DependencyGrid.jsx` (`collectViewState` / `applyViewState`)
4. Existing saved views will automatically fall back to the new default.

### Can I embed multiple grids on one page?

Each `<DependencyGrid>` creates its own `GridBoardProvider` context. Multiple instances are fully independent.

### How do I debug persist issues?

If changes aren't saving, check:
1. Are the persist callbacks being passed all the way through? (See the callback chain: Adapter → DependencyGrid → useGridInteraction → sub-hooks)
2. Open browser DevTools Network tab — are API calls firing?
3. Check the console for errors from the `try/catch` blocks inside the hooks.

### What's the difference between `useGridInteraction` and `useGridActions`?

- **`useGridInteraction`** handles real-time interactions: mouse events, keyboard shortcuts, drag logic, selection. It orchestrates `useNodeInteractions`, `useEdgeInteractions`, and `useDragInteractions`.
- **`useGridActions`** handles explicit CRUD operations triggered by modals: confirm node create, confirm delete, bulk edge updates, create lane/row.

Both receive persist callbacks but for different categories of operations.
