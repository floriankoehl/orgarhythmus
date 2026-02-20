# 3D Engine — Behavior Specification
**Single source of truth for the 3D Gantt / Member Assignment system.**
Update this file whenever any 3D behavior changes.

---

## Module Structure

```
src/engine3d/
  constants.js          — All 3D numeric constants and layout helpers
  useCamera3D.js        — Camera state, orbit/pan/zoom, mouse & keyboard input
  usePersonas.js        — Protopersona CRUD, drag, snap, milestone 3D projection
  components.jsx        — Pure display components: ViewsPanel, ToolbarPlaceholder,
                          DayGrid, MilestoneLayer
  connectionGeometry.js — Bezier ribbon geometry for dependency connections
  3dBehaviorSpec.md     — This file
```

---

## Camera Positioning & Distance

| Constant                | Value  | Meaning                                                   |
|-------------------------|--------|-----------------------------------------------------------|
| `CAMERA_BASE_DISTANCE`  | 600 px | Z translation baseline (translateZ reference point)       |
| `CAMERA_DEFAULT_ZOOM`   | 500 px | Initial translateZ value (zoom offset relative to base)   |
| `CAMERA_DEFAULT_TILT`   | 30 °   | Initial pitch (orbitX) — vertical tilt from horizontal    |
| `CAMERA_DEFAULT_YAW`    | 30 °   | Initial yaw (orbitY) — horizontal rotation around Y-axis  |
| `CAMERA_DEFAULT_SCALE`  | 1.0    | Initial world scale factor                                |
| `CAMERA_SCALE_MIN`      | 0.15   | Minimum allowed scale (maximum zoom-out)                  |
| `CAMERA_SCALE_MAX`      | 3.0    | Maximum allowed scale (maximum zoom-in)                   |
| `PERSPECTIVE_DEPTH`     | 1800px | CSS perspective value; controls field-of-view feel        |

The effective camera Z offset applied to the scene is:
`zoom - CAMERA_BASE_DISTANCE + panZ`

---

## Orbit / Pan / Zoom Mechanics

### Mouse Controls

| Input                        | Action                                         |
|------------------------------|------------------------------------------------|
| **Middle-click + drag**      | Orbit (rotate) the camera                      |
| **Middle-click + Shift + drag** | Pan the camera (XY translation)             |
| **Right-click + drag**       | Pan the camera (XY translation)               |
| **Scroll wheel (plain)**     | Scale-zoom anchored at cursor position         |
| **Scroll wheel + Shift**     | Navigate along world Z-axis (depth panning)   |
| **Left-click + drag on persona** | Move a protopersona token in 3D world space |

> **Scroll-wheel orbit is disabled.** The wheel is reserved for scale-zoom (and Z-pan with Shift).

### Orbit Anchor Compensation
When orbiting, the point on the floor under the mouse cursor is locked — the camera
pans automatically to keep that world-point stationary on screen during rotation.

### Scale-Zoom Anchor Compensation
When zooming via scroll wheel, the floor point under the cursor is locked — the camera
pans automatically to keep that world-point stationary during scale change.

### Orbit Tilt Clamp
Vertical orbit (orbitX / pitch) is clamped to **[5°, 90°]** — the camera can never
go below the floor or reach a pure top-down view through mouse drag.

---

## Keyboard Shortcuts

| Key           | Action                                           |
|---------------|--------------------------------------------------|
| `X`           | Advance to the next saved camera view            |
| `ArrowRight`  | Advance to the next saved camera view            |
| `ArrowLeft`   | Go to the previous saved camera view             |

> Shortcuts are suppressed when an `<input>`, `<textarea>`, or `contenteditable` element has focus.

---

## Camera State Persistence

- Camera state is **auto-saved to `localStorage`** (key: `orgarhythmus_camera_<projectId>`) with a **600 ms debounce** after any camera change.
- On page mount the saved state is restored automatically.
- The "Save Camera" button performs an immediate save (no debounce).
- The "Reset Camera" button restores all defaults (`tilt=30°, yaw=30°, pan=0,0,0, zoom=500, scale=1.0`) and removes the saved key.
- Camera state is also embedded in saved **Views** (via `collectViewState`) so that loading a view can optionally restore camera position.

---

## Protopersona Drag & Drop

### Drag Mechanics
1. Left-click on a persona element (`[data-persona-id]`) starts a drag.
2. A **drag plane** is established at height `PERSONA_SIZE * 0.75 + PERSONA_DRAG_LIFT` above the floor.
   This approximates the centre of the persona figure so the figure tracks naturally with the cursor.
3. During drag, the persona position is updated in real-time via ray-plane intersection (`screenToFloor`).
4. The drag offset is kept relative to the initial click-point on the figure (not snapping until drop).

### Snap on Drop

| Constant       | Value | Meaning                                                      |
|----------------|-------|--------------------------------------------------------------|
| `SNAP_RADIUS`  | 40 px | World-space radius within which a persona snaps to a milestone |
| `PERSONA_DRAG_LIFT` | 5 px | Additional height lift during drag (visual float effect) |

- On mouse-up, the persona finds the **nearest milestone** within `SNAP_RADIUS`.
- Distance is computed to the **nearest edge of the milestone rectangle** (not its centre), so the persona snaps when touching the milestone footprint.
- If a milestone is found, the persona is placed at `(milestone.worldX, milestone.worldZ + stackOffset)`.
- Stacking offset: `(PERSONA_SIZE + 4) × stackIndex` — personas queue side by side on the same milestone.
- If no milestone is within range, the persona remains at its drop position (free-floating on the floor).

### Milestone Re-snap
Whenever the board layout changes (day width, task heights, team visibility, etc.), all personas
attached to milestones are **automatically re-snapped** to the updated milestone world positions.

---

## Snapping Logic (Milestone Hitbox)

Each milestone has a **rectangular world-space hitbox** derived from its 2D pixel dimensions:

```
halfZ = max(duration * DAYWIDTH, PERSONA_SIZE + 10) / 2   ← width in Z direction
halfX = (PERSONA_SIZE + 10) / 2                            ← height in X direction
```

Snap distance uses the closest point on the rectangle (Chebyshev-style):
```
dx = max(0, |persona.x - ms.worldX| - halfX)
dz = max(0, |persona.z - ms.worldZ| - halfZ)
dist = sqrt(dx² + dz²)
snap if dist < SNAP_RADIUS
```

---

## Milestone World Coordinates

Milestones are computed from the 2D board pixel layout and mapped to 3D world space:

```
worldX = (pixelY + pixelH/2 + boardOffsetY + SCROLL_Y_PAD) - boardHeight/2
worldZ = boardWidth/2 - (pixelX + pixelW/2 + boardOffsetX)
```

- `worldX` maps the **vertical position** on the 2D board to the **X-axis** of the 3D scene.
- `worldZ` maps the **horizontal (time) position** on the 2D board to the **Z-axis** of the 3D scene.
- The board is centered at `(0, 0, 0)` in world space.

---

## Dependency Connection Geometry

Connections between milestones are rendered as **3D ribbon planks** following a **cubic bezier S-curve**.

### Curve Control Points
```
P0 = (srcMs.worldX, srcMs.worldZ)      ← start
P1 = (srcMs.worldX, midZ)              ← control 1 (same X, midpoint Z)
P2 = (tgtMs.worldX, midZ)              ← control 2 (same X as target, midpoint Z)
P3 = (tgtMs.worldX, tgtMs.worldZ)     ← end
```
`midZ = (P0z + P3z) / 2` — the S-curve bends horizontally in world space.

### Sampling
The curve is sampled at **14 segments** (`BEZIER_SEGMENTS`). Each segment becomes
a 3D plank with a top face, a front wall, and a back wall.

### Weight-Based Dimensions

| Weight    | ribbonW | beamH | Top color                | Side color               |
|-----------|---------|-------|--------------------------|--------------------------|
| `strong`  | 14 px   | 4 px  | `rgba(251,146,60,0.92)`  | `rgba(200,110,30,0.82)`  |
| `weak`    | 10 px   | 3 px  | `rgba(148,163,184,0.78)` | `rgba(110,125,150,0.68)` |
| other     | 8 px    | 2 px  | `rgba(134,239,172,0.68)` | `rgba(90,190,120,0.58)`  |

### Arrowhead
An arrowhead (12 px, CSS border-triangle) is placed at the target end, rotated to
match the final bezier tangent direction.

---

## Milestone Pedestal Rendering

Each milestone is rendered as a **3D box (pedestal)** rising from the floor:

| Constant            | Value  | Meaning                                        |
|---------------------|--------|------------------------------------------------|
| `MILESTONE_3D_HEIGHT` | 8 px | Pedestal extrusion depth (height above floor) |

- Pedestal footprint: `max(duration × DAYWIDTH, PERSONA_SIZE + 10) × (PERSONA_SIZE + 10)`
- Colors derived from milestone color via `color-mix()` with black for side faces.
- When a persona is snapped to a milestone, the pedestal border and top face turn green (`rgba(74,222,128,…)`).

---

## Protopersona Figure Proportions

The persona is a block-figure (Minecraft-style) built from six-face CSS 3D boxes.
All dimensions are proportional to `PERSONA_SIZE` (default: 25 px):

| Part      | Width           | Height          | Depth           |
|-----------|-----------------|-----------------|-----------------|
| Head      | S × 0.44        | S × 0.40        | S × 0.40        |
| Torso     | S × 0.50        | S × 0.44        | S × 0.30        |
| Each Leg  | bodyW × 0.40    | S × 0.34        | bodyD × 0.85    |

- **Total figure height**: `headH + bodyH + legH`
- **Base Y offset** (floor to feet): `totalH + MILESTONE_3D_HEIGHT` when snapped; `totalH + PERSONA_DRAG_LIFT` during drag.
- The torso front face displays the persona's **clothing color** and **name initial**.
- Head skin colors are fixed (`#fcd9b6` front, `#d4a67a` back, `#ecc9a0` sides, `#5c3d2e` top).
- Leg colors are fixed (`#3b4861` / `#2d3a4e` / `#344054`).

---

## Floor & Scene Layout

| Constant          | Value  | Meaning                                               |
|-------------------|--------|-------------------------------------------------------|
| `BOARD_3D_HEIGHT` | 14 px  | Thickness of the board's side faces                   |
| `SCROLL_Y_PAD`    | 16 px  | Extra vertical padding applied to board offset mapping |

- The **floor plane** dimensions mirror the board content: `floorW = boardDims.h`, `floorH = boardW`.
- The floor is a grid-patterned `rotateX(90deg)` plane at `Y = 0`.
- The **Gantt board** is placed on the floor via `rotateY(90deg) rotateX(90deg) translate(-50%, -50%)`.
- The **3D axis gizmo** (X=red, Y=green, Z=blue, each 300 px) is rendered at the world origin.

---

## Camera Reset Rules

Resetting the camera (via the "↺ Reset" button) restores:
```
orbitX (tilt) = CAMERA_DEFAULT_TILT  (30°)
orbitY (yaw)  = CAMERA_DEFAULT_YAW   (30°)
panX = panY = panZ = 0
zoom          = CAMERA_DEFAULT_ZOOM   (500)
cameraScale   = CAMERA_DEFAULT_SCALE  (1.0)
```
The `localStorage` entry for the project is also removed on reset, so a subsequent
page load will also start from defaults.

---

## Page / Layout Conventions

- The **OrgaHeader** (`[data-orga-header]`) and **ProjectHeader** (`[data-project-header]`) are hidden on mount and restored on unmount.
- `document.body.style.overflow = 'hidden'` is set on mount and restored on unmount, preventing browser scroll from interfering with wheel-based camera controls.
- The viewport fills `100dvh` with `overflow: hidden`.
- The board scroll container has `data-board-scroll` — the wheel handler uses this attribute to allow normal scroll inside the board (bypassing camera wheel handler).

---

## Coordinate System

```
         +Y (up, screen)
          │
          │
──────────┼──────────  +X (right in 3D scene, maps to board's vertical / team axis)
          │
          └──────────  +Z (depth / into screen, maps to board's horizontal / time axis)
```

- The Gantt board's **time axis (days)** runs along the **-Z → +Z** direction in world space.
- The Gantt board's **team axis (rows)** runs along the **-X → +X** direction in world space.
- The floor plane is the **XZ plane** at Y = 0.
