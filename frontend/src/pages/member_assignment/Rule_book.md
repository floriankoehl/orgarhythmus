# 3D Gantt — Rule Book

All design and interaction rules for the Member Assignment (3D Gantt / Sandbox) page.
When a rule or behaviour changes, update this file.

---

## Camera Controls

| Input | Action |
|---|---|
| **Mouse wheel (scroll)** | Scale-zoom anchored at cursor |
| **Right-click + drag** | Pan the camera |
| **Middle-click + drag** | Orbit the camera |
| **Shift + Scroll** | Navigate along world Z-axis |
| **Left-click + drag** (on persona) | Move protopersonas |

> Scroll-zoom is intentionally **anchored** — the floor point under the cursor stays fixed.

---

## Lanes

- Lanes have a **very light blue-tinted fill** (`#fafbfc`) — not plain white or gray.
- Borders are **soft** border-slate-200.
- Each lane has a thin **team-color accent line** along the front edge.

---

## Protopersonas

- Protopersonas are **persisted in the backend** (Django model `ProtoPersona`).
- They snap to **nearest milestone** within SNAP_RADIUS on drop.
- Each persona has: name, clothing color, assigned milestone.
- Personas are created via the "Add Persona" button and removed via the × button.

---

## Team / Task Height

- **Team rows** now extrude `TEAM_3D_HEIGHT` (20 px) above the floor as 3D slabs.
- **Task rows** extrude `TASK_3D_HEIGHT` (10 px) above the floor.
- Slabs are rendered in the camera layer (same level as milestone pedestals).
- Top face uses the team color (semi-transparent). Side walls use a darker shade.

---

## Layout & Headers

- The **OrgaHeader** and **ProjectHeader** are **hidden** when this page is mounted.
- Body overflow is set to `hidden` — no scrollbars that would interfere with scroll-zoom.
- The page fills the **full viewport** (`100dvh`), no partial heights.
- On unmount, all header visibility and body overflow are **restored** to defaults.

---

## Intro / Navigation

- Press **X** or **ArrowRight** to go to the next saved view.
- Press **ArrowLeft** to go to the previous saved view.
- Views are saved per-project in the backend and include camera state.
