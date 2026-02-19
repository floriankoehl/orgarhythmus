# 3D Gantt — Rule Book

All design and interaction rules for the Member Assignment (3D Gantt / Sandbox) page.
When a rule or behaviour changes, update this file.

---

## Camera Controls

| Input | Action |
|---|---|
| **Mouse wheel (scroll)** | Orbit / rotate the camera angle |
| **Right-click + drag** | Pan the camera |
| **Hold Space + left-drag** | Pan the camera |
| **Hold R + left-drag** | Orbit the camera |
| **Left-click + drag** (default) | Move protopersonas |

> Scroll-zoom is intentionally **disabled** — the scroll wheel is reserved for orbiting.

---

## Lanes

- Lanes have a **very light blue-tinted fill** (`#fafbff`) — not plain white or gray.
- Borders are **soft, smooth, and rounded** (radius `0.08`–`0.09`, smoothness `4`).
- Each lane has a thin **team-color accent line** along the front edge.
- On hover (while dragging a persona), the lane tints to a light blue (`#eef4ff`).

---

## Protopersonas

- Protopersonas are **persisted in the backend** (Django model `ProtoPersona`).
- They snap to **day-grid centres** while dragging and on drop.
- They snap to the **nearest lane** (by Z-axis proximity).
- Each persona has: name, clothing color, hair color, assigned task, day index.
- Personas are created via the toolbar "Add Protopersona" button and removed via the chip × button.

---

## Layout & Headers

- The **OrgaHeader** and **ProjectHeader** are **hidden** when this page is mounted.
- Body overflow is set to `hidden` — no scrollbars that would interfere with scroll-orbit.
- The page fills the **full viewport** (`100dvh`), no partial heights.
- A small **hamburger icon** (top-left) toggles the ProjectHeader on/off.
- On unmount, all header visibility and body overflow are **restored** to defaults.

---

## Intro Animation (2D → 3D transition)

- On page load the camera starts in a **bird's-eye view** (directly above, looking straight down).
- At this angle the 3D lanes look like flat 2D Gantt rows — emulating the Dependencies page.
- **No hold phase** — the sweep starts **immediately**; the bird's-eye is visible as the first frame only.
- The camera smoothly sweeps from bird's-eye to the angled 3D perspective over **2.5 s** (`INTRO_DURATION`).
- FOV stays at a constant **45°** throughout — no FOV animation.
- Easing: `easeInOutQuart` — slow start, fast middle, gentle landing.
- OrbitControls are **disabled** during the sweep and re-enabled when it finishes.

### Proportional 2D match

The bird's-eye starting frame is calculated **deterministically** from the 2D Dependency page layout constants:

| 2D constant | Value | Purpose |
|---|---|---|
| `DEP_SIDEBAR_PX` | 350 px | TEAMWIDTH (150) + TASKWIDTH (200) |
| `DEP_DAY_PX` | 60 px | DEFAULT_DAYWIDTH |
| `DEP_ROW_PX` | 32 px | DEFAULT_TASKHEIGHT_NORMAL |
| `DEP_HEADER_PX` | 48 px | HEADER_HEIGHT |

1. Compute the full 2D chart pixel dimensions: `chart2dW × chart2dH`.
2. Clip to the canvas viewport (handle overflow — like scroll position = 0).
3. Calculate `fillX` / `fillY` — what fraction of the viewport the visible chart occupies.
4. Map the 3D board (lanes + labels) to those proportions.
5. Derive camera height with perspective math so the visible frustum matches exactly.
6. If the 2D chart overflows the viewport, offset the camera (X and/or Z) to align with the **top-left** of the board — matching the default scroll=0 position of the 2D chart.
7. During the sweep, the look-at target lerps from the offset position back to the board centre `(0, 0, 0)`.











