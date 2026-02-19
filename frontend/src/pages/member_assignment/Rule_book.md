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












