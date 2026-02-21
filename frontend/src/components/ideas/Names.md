
# IdeaBin Component — Naming Reference

## Top-level layout

The **IdeaBin** is a floating window with two main areas side-by-side:

| Area              | Side   | Visible                           |
|-------------------|--------|-----------------------------------|
| **Idea Area**     | Left   | Always (even when window is small)|
| **Category Area** | Right  | Only when the window is wide enough (`> CATEGORY_THRESHOLD`) |

---

## Title Bar (top of the window)

Contains the **meta buttons**:
- **Idea List button** (📋 List icon) — opens the **Idea List Overlay**, a full-overlay panel showing every unique idea object (`source.type === "all"`). Here you can:
  - See all meta data (categories, legend types) — always visible
  - Remove an idea from specific categories (✕)
  - Remove legend type assignments (✕)
  - Delete, edit, copy, spinoff ideas
- Paste button (shown when an idea is copied)
- Maximize / Minimize buttons

---

## Idea Area (left side) — 3 vertically stacked sections

### 1. Idea Form (top)
- Text fields for **Headline** (optional) and **Description / title**
- Create / Update button
- If a category is selected (via the Category Area), new ideas auto-place there
- File references: top of the sidebar `<div>` in `IdeaBin.jsx`

### 2. Idea Overview (middle, scrollable)
- **Filter dropdown**: switch between "All Ideas", "Unassigned", or a specific category
- **Settings button** (⚙ gear icon): opens a dropdown with toggles:
  - *Headlines only / Show full ideas* — collapse/expand all idea cards
  - *Show meta info* — toggle whether categories & legend types are displayed inline on each card (OFF by default)
- Displays idea cards via `renderIdeaItem()`. Each card shows:
  - Headline / title (always)
  - Full description (when expanded)
  - Meta data — categories & legend types (only when "Show meta info" is ON, or when viewing from the Idea List Overlay)
  - Action buttons: copy, spinoff (for foreign ideas), settings menu (edit/delete/make-task)
- The filter can also show ideas grouped by category (same cards, filtered context)

### 3. Legend Area (bottom, collapsible)
- Define and manage **Legends** (e.g. "Priority", "Effort")
- Each legend has **Types** (e.g. "High", "Medium", "Low" with colors)
- Drag types onto idea cards to assign them
- Filter ideas by type
- File reference: `IdeaBinLegendPanel.jsx`

---

## Category Area (right side)

- Canvas of draggable, resizable **Category Cards** (`IdeaBinCategoryCanvas.jsx`)
- Each category card shows ideas placed in it
- Drag ideas between categories or to/from unassigned
- Category header has settings: rename, toggle public/private, archive, delete
- **Adopted categories** (from other users) shown in indigo, with restricted actions (collapse, unadopt only)
- Adopted categories allow placing your own ideas but not removing foreign ideas

---

## Key terms

| Term                    | Meaning |
|-------------------------|---------|
| **Idea** (meta idea)    | The actual idea object (`Idea` model). Has title, headline, description, owner. |
| **Placement**           | A link between an Idea and a Category (`IdeaPlacement` model). One idea can have multiple placements. |
| **Category**            | A named container for ideas. Owned, can be public, can be adopted by others. |
| **Legend**              | A classification axis (e.g. "Priority"). Owned by a user. |
| **Type**                | A value within a legend (e.g. "High" — red). Has name + color. |
| **Adopted category**    | A public category from another user that you follow. You see their ideas + can add your own. |
| **Spinoff**             | Creating a personal copy of someone else's idea (keeps legend types, new owner/timestamp). |
| **Foreign idea**        | An idea in an adopted category that belongs to someone else (read-only except spinoff). |
| **Idea List Overlay**   | The full-panel overlay opened from the title bar List button. Shows all ideas with full meta + edit capabilities. Uses `source.type === "meta"` internally. |
| **Idea Overview**       | The scrollable list in the middle of the Idea Area. Shows ideas based on the active filter. The "All Ideas" filter uses `source.type === "all"` (different from the overlay's `"meta"`). Meta data here is OFF by default, togglable via ⚙ settings. |
| **Idea Form**           | The input section at the top for creating/editing ideas. |

---

## File map

| File                          | What it contains |
|-------------------------------|-----------------|
| `IdeaBin.jsx`                 | Main component: state, API calls, layout, rendering |
| `IdeaBinIdeaCard.jsx`         | Single idea card (used in both Overview and Idea List Overlay) |
| `IdeaBinCategoryCanvas.jsx`   | Right-side category cards canvas |
| `IdeaBinLegendPanel.jsx`      | Bottom legend panel |
| `IdeaBinTransformModal.jsx`   | Modal for transforming idea → task/milestone |
| `IdeaBinConfirmModal.jsx`     | Reusable confirmation dialog |
| `IdeaBinDragGhosts.jsx`       | Floating drag ghost overlays |
| `useIdeaBinWindow.js`         | Window position/size/maximize state hook |
| `useLegends.js`               | Legends + types data hook |













