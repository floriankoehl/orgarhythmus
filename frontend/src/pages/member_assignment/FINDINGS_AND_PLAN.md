# Findings & Plan — 3D Floor Interaction Preparation

**File location:** `src/pages/member_assignment/FINDINGS_AND_PLAN.md`
**Related:** `src/engine3d/floor3DMapping.js`, `src/engine3d/useFloor3D.js`, `src/engine3d/3dBehaviorSpec.md`

---

## 1. How 2D Selection & Data Access Works Today

### 2D Dependencies page (`src/pages/dependency/`)

The 2D Dependencies page uses a multi-layer system:

#### Selection state (`DependencyContext.jsx`)
```
selectedMilestones: Set<milestoneId>
selectedConnections: Array<{ source, target }>
hoveredMilestone: milestoneId | null
viewMode: 'inspection' | 'edit' | 'deps' | 'refact'
```
All selection state is centralized in `DependencyContext` and consumed via `useDependencyUIState()`.

#### Interaction hooks
- **`useDependencyInteraction`** — orchestrates keyboard, click-outside, drag, copy/paste
- **`useDependencyDrag`** — handles milestone drag-and-drop within the 2D grid
- **`useDependencyMilestones`** — CRUD for milestones (create, delete, resize, move)
- **`useDependencyConnections`** — manages connection drawing and selection

#### Entity access patterns
From a mouse event, the 2D system finds entities by:
1. **Milestones** — each milestone renders as an absolutely-positioned div with `data-milestone-id` attribute; click events bubble up and are captured by the container's `onClick` handler.
2. **Teams** — each team row has a `data-team-id` attribute on its outer div.
3. **Tasks** — each task row has a `data-task-id` attribute.
4. **Day columns** — the day index is computed from `Math.floor((clientX - boardLeft - TEAMWIDTH - TASKWIDTH - scrollLeft) / DAYWIDTH)`.

#### Layout math (`layoutMath.js`)
The single source of truth for milestone pixel positions is `computeMilestonePixelPositions(...)`.
It walks `teamOrder`, accumulating Y offsets for every team row and task row, and returns:
```
{ id, x, y, w, h, teamColor, ...milestone }
```
where `x/y` are absolute pixel positions in the board's content space.

---

## 2. What Needs to Be Exposed for 3D Interaction

To make the 3D floor interactive in the same way as the 2D Dependencies page, the 3D system needs:

### Entity registry (now done — `useFloor3D`)
Each visible entity needs **world-space bounding boxes**:
- **Team slab** — `{ teamId, worldXStart, worldXEnd, worldZStart, worldZEnd }`
- **Task slab** — `{ taskId, teamId, worldXStart, worldXEnd, worldZStart, worldZEnd }`
- **Milestone pedestal** — already in `milestone3D` array from `usePersonas`

### Coordinate mapping (now done — `floor3DMapping.js`)
- `boardPixelToWorld(boardPixelX, boardPixelY, boardDims)` — board pixel → world (X, Z)
- `worldToBoardPixel(worldX, worldZ, boardDims)` — world (X, Z) → board pixel
- `boardPixelYToTeamId(...)` — find team from board Y pixel
- `boardPixelToTaskId(...)` — find task from board X/Y pixel
- `boardPixelXToDayIndex(...)` — find day column from board X pixel

### Hit-testing (now done — `useFloor3D`)
`hitTest(worldX, worldZ)` returns `{ teamId, taskId, dayIndex }` for any world-space floor point.
This can be wired to mouse events on the 3D scene via `screenToFloor(clientX, clientY)`.

### Selection state
The 3D system currently has **no selection state**. To add interaction, we will need:
```js
const [selectedTeamId, setSelectedTeamId] = useState(null);
const [selectedTaskId, setSelectedTaskId] = useState(null);
const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
const [selectedDayIndex, setSelectedDayIndex] = useState(null);
```
These should be added to `Assignment_Second.jsx` and passed down as props.

### Event routing
The 3D scene's `onMouseMove` / `onClick` handlers need to:
1. Call `screenToFloor(e.clientX, e.clientY)` — from `useCamera3D`
2. Pass the result to `hitTest(worldX, worldZ)` — from `useFloor3D`
3. Use the returned `{ teamId, taskId, dayIndex }` to update selection state

---

## 3. Refactors Done in This Step

### New files created
| File | Purpose |
|------|---------|
| `engine3d/floor3DMapping.js` | Pure coordinate transform and entity-lookup functions |
| `engine3d/useFloor3D.js` | React hook exposing entity registry and `hitTest` |

### Existing files updated
| File | Change |
|------|--------|
| `pages/dependency/layoutMath.js` | Added `getContrastTextColor` + `computeMilestonePixelPositions` |
| `api/dependencies_api.js` | Added protopersona CRUD API functions |
| `App.jsx` | Added `/assignment` route |
| `engine3d/constants.js` | Added `TEAM_3D_HEIGHT`, `TASK_3D_HEIGHT` constants |
| `engine3d/3dBehaviorSpec.md` | Updated with floor entity registry + team/task height docs |

### New engine3d files (from PR #7 baseline)
| File | Purpose |
|------|---------|
| `engine3d/constants.js` | All 3D numeric constants and layout helpers |
| `engine3d/useCamera3D.js` | Camera orbit/pan/zoom + mouse/keyboard input |
| `engine3d/usePersonas.js` | Protopersona CRUD, drag, snap, milestone 3D projection |
| `engine3d/components.jsx` | ViewsPanel, ToolbarPlaceholder, DayGrid, MilestoneLayer |
| `engine3d/connectionGeometry.js` | Bezier ribbon geometry for dependency connections |

### Team/Task height (experimental visual feature)
- `useFloor3D` computes world-space bounding boxes for each team row and task row.
- `Assignment_Second.jsx` now renders **team slabs** (TEAM_3D_HEIGHT = 20 px) and **task slabs** (TASK_3D_HEIGHT = 10 px) as 3D boxes rising from the floor.
- Each slab has a semi-transparent top face (in team color) and front/back side walls.
- These are display-only for now — no click events attached.

---

## 4. Concrete Next-Step Plan for Interaction

### Step A — Wire mouse events (mouse tracking + hover)
1. Add `onMouseMove` handler to the camera layer in `Assignment_Second.jsx`.
2. On each move: `screenToFloor(e.clientX, e.clientY)` → `hitTest(worldX, worldZ)`.
3. Store `hoveredEntity: { teamId, taskId, dayIndex }` in state.
4. Pass `hoveredEntity` to team/task slabs so they can highlight on hover.

### Step B — Add click selection
1. Add `onClick` handler to the camera layer.
2. On click: same flow as hover, but set `selectedEntity` state.
3. Highlight selected team slab (border color, opacity change).
4. Show a details panel (floating HUD) with the selected entity's info.

### Step C — Connect to domain data
- **Team selection** → show team name, task list, milestone count, team color.
- **Task selection** → show task name, milestone list, task settings.
- **Day selection** → show date, purpose label, any special day flags.
- **Milestone selection** → show milestone name, dates, dependencies; could sync to 2D selectedMilestones.

### Step D — Sync with 2D Dependencies page
- When a user selects a milestone in 3D, push its ID to a shared context/URL state.
- When navigating back to 2D, the 2D page restores the selection.
- Consider using `DependencyContext` (or a sibling context) to share selection state.

### Step E — Elevated entity info display
- Teams and tasks now have physical height in 3D (slabs).
- Future: display info labels on the slab faces (team name on the side wall, task name on top face).
- Future: display aggregate statistics (number of milestones, total duration) as 3D text overlays.

---

## 5. Coordinate System Reference

```
3D World space (XZ floor plane, Y = up):
  +X = rightward in the scene (← board's vertical/team axis)
  +Z = into screen (← board's horizontal/time axis, inverted)
  Y = 0 = floor plane

Board pixel space:
  boardPixelX = 0 at left edge, increases rightward (→ world -Z)
  boardPixelY = 0 at top edge, increases downward    (→ world +X)

Formulas:
  worldX = (boardPixelY + boardDims.offsetY + SCROLL_Y_PAD) - boardDims.h / 2
  worldZ = boardDims.w / 2 - (boardPixelX + boardDims.offsetX)

Entity positions (board pixels):
  Day column X: TEAMWIDTH + TASKWIDTH + dayIndex * DAYWIDTH
  Team row Y:   effectiveHeaderH + Σ(team heights above) + drag_highlight + header_line + phase_row
  Task row Y:   teamRowY + phaseRowH + Σ(task heights above within team)
```
