# Task Structure Page — Consolidated Requirements Specification

---

## 1. Purpose

The **Task Structure Page** is the primary workspace for organizing and managing the structural properties of tasks within a project.

It provides a **single source of truth for task structure**, including:

- Team ownership
- Multi-dimensional classification
- Status
- Priority
- Difficulty
- Acceptance criteria
- Milestone visibility (non-scheduling only)

This page is focused on **structural organization**, not execution planning or scheduling logic.

If any contradiction exists in interpretation, the most specific behavioral rule defined below shall prevail.

---

# 2. Conceptual Model

## 2.1 Core Structural Principle

Tasks are the central work units of the project.

Their structure follows a **Primary + Secondary Classification Model**.

---

## 2.2 Primary Classification — Team

- Teams represent the primary structural grouping.
- A task may belong to **zero or one team**.
- A task must never belong to more than one team simultaneously.
- If no team is assigned, the task is considered **Unassigned**.
- The UI must visualize Unassigned as a **pseudo-team group**.
- The pseudo-team:
  - Is always visible.
  - Cannot be deleted.
  - Behaves visually like a normal team.

Reassignment replaces the previous team association.

Team deletion:
- Must not delete tasks.
- Must set affected tasks to Unassigned.
- Must keep tasks fully editable.

Team color:
- Is a structural identity attribute.
- Must propagate everywhere in the system where teams are represented.

---

## 2.3 Secondary Classification — Legends

Legends represent independent structural dimensions.

Each legend:
- Represents one classification dimension.
- Contains multiple LegendTypes.

Each task:
- May have zero or more legends assigned.
- May have at most one LegendType per Legend.
- May not have multiple types from the same legend.

Legend classification:
- Is orthogonal to Team.
- Does not affect Team membership.
- Does not constrain which LegendTypes can be selected.

This mirrors IdeaBin’s legend system, with the difference that tasks have single-team ownership.

---

# 3. Scope Definition

## 3.1 In Scope

The Task Structure Page manages:

- Task team assignment
- Team creation, deletion, renaming, recoloring
- Multi-dimensional legend assignment
- Status
- Priority
- Difficulty
- Acceptance criteria
- Milestone visibility and limited editing
- Structural grouping views
- Drag & drop structural interactions
- Saved view configurations
- Floating window behavior

## 3.2 Explicitly Out of Scope

- Role assignments
- Milestone todos
- Scheduling logic (start index, duration, dependencies)
- Deep execution workflows
- Audit-level tracking of acceptance criteria (MVP)

---

# 4. Task-Level Functional Requirements

For each task, the user must be able to define and modify:

- Team assignment
- Legend assignments
- Priority
- Difficulty
- Status
- Acceptance criteria
- Milestone names and non-scheduling attributes

---

## 4.1 Acceptance Criteria

- Stored and displayed as an ordered bullet list of plain text entries.
- No per-entry audit metadata required in MVP.
- Must be easily editable with low friction.

---

## 4.2 Milestones

The page shall:

- Display all milestones belonging to a task.
- Allow editing of non-scheduling milestone attributes (e.g., name, description).
- Not allow modification of scheduling properties.
- Not display or edit milestone todos.

Milestones are visible for structural understanding, not for execution planning.

---

# 5. View System

The page shall support grouping tasks by:

- Team
- Any defined Legend

Changing the active view:
- Shall affect visualization only.
- Shall not modify task data.

Saved views:
- Must persist per project.
- Must survive reload.
- Must restore grouping and filters.

Terminology:  
The UI must use **“View”**, not “Perspective”.

---

# 6. UI & Visual Architecture

## 6.1 Reference Principle

**The IdeaBin UI is the mandatory visual reference model.**

When UI questions arise, the system must:

- Default to IdeaBin interaction patterns.
- Match its fluidity.
- Match its structural clarity.
- Reuse its visual semantics where possible.

If a design decision conflicts with IdeaBin consistency, the design must be reconsidered.

---

## 6.2 Window Model

The Task Structure component shall:

- Exist as a floating tool mounted at ProjectLayout level.
- Be available across all project subpages.
- Support:
  - Collapsed (icon)
  - Expanded (draggable, resizable window)

Collapse behavior must preserve:

- Selected tasks
- Active view
- Filters
- Panel states
- Window geometry

---

## 6.3 Layout Model (IdeaBin Parity)

Expanded layout shall follow IdeaBin structure:

Left Panel:
- Task list
- Task editing controls
- Legend panel
- Filters

Right Canvas:
- Team containers
- Visual grouping of tasks
- Spatial positioning of teams

When width is small:
- Graceful degradation to left-panel-only layout.

Resizable:
- Window
- Left sidebar
- Panels

---

# 7. Interaction Model

## 7.1 Drag & Drop

Must mirror IdeaBin behavior:

- Drag tasks within list to reorder.
- Drag tasks onto team containers to assign.
- Drag teams on canvas to reposition.

Single-Team rule must always be enforced.

Dragging a task out of a team:
- Moves it to Unassigned pseudo-team.

---

## 7.2 Legend Assignment Interaction

If IdeaBin supports brush/paint mode:
- Task Structure must support equivalent legend assignment interaction.
- Interaction patterns must remain consistent.

---

# 8. Structural Integrity Constraints

- Deleting a team must not delete tasks.
- Reassigning tasks must replace prior team.
- Legend constraints must prevent multiple types per legend.
- Team color must propagate system-wide.

---

# 9. Visual Consistency Requirements

Team color must be consistently used across:

- Task list accents
- Team containers
- Labels
- Any other team representation
- All other project views

Visual semantics must remain coherent across:

- Dependency view
- Task Structure view
- Any grouping-based visualization

---

# 10. Design Philosophy

The Task Structure Page must:

- Feel fluid, not static.
- Behave like a desktop workspace, not a form page.
- Enable fast structural editing.
- Avoid duplication of tasks.
- Preserve a single structural truth viewed from multiple angles.

IdeaBin is the primary UX benchmark.

All structural decisions must align with:

- Clarity
- Orthogonality of classification
- Non-destructive editing
- Visual consistency