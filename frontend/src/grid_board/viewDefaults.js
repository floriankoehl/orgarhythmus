// ==========================================
// DependencyGrid — Default Settings Registry
// ==========================================
//
// This file defines the default value for EVERY setting that is
// saved inside a view.  Change any value here and the "Default"
// view (which always exists) will use it, and any view that was
// saved before a new setting was introduced will fall back to it.
//
// The keys match the property names stored in the view JSON blob
// (see collectViewState / applyViewState in DependencyGrid.jsx).
// ==========================================

import {
  DEFAULT_ROWHEIGHT_NORMAL,
  DEFAULT_ROWHEIGHT_SMALL,
  ROWLABELWIDTH  as DEFAULT_ROWLABELWIDTH_CONSTANT,
  LANEWIDTH      as DEFAULT_LANEWIDTH_CONSTANT,
  DEFAULT_COLUMNWIDTH,
} from './layoutMath';

// ── Edge display settings ────────────────────────────────────
// Shown in the "Advanced → Edges" panel of the toolbar.
export const DEFAULT_EDGE_SETTINGS = {
  showReasons:             true,      // show reason text on edge paths
  hideSuggestions:          false,     // hide suggestion-weight edges
  uniformVisuals:          false,     // all edges same thickness (ignore weight)
  filterWeights:           [],        // empty = show all; or ['strong','weak','suggestion']
  defaultEdgeWeight:       'strong',  // default weight when creating new edges
  weakEdgePrompt:          true,      // show prompt on weak edge conflict
  colorDirectionHighlight: true,      // color incoming (red) and outgoing (green) edges on select
  hideInternalDeps:        false,     // hide edges between milestones in the same task
};

// ── View mode / interaction mode ─────────────────────────────
export const DEFAULT_VIEW_MODE        = 'inspection'; // 'inspection' | 'schedule' | 'dependency'
export const DEFAULT_INTERACTION_MODE = 'drag';       // 'drag' (legacy, always 'drag')

// ── Boolean toggles ──────────────────────────────────────────
export const DEFAULT_SHOW_PHASE_COLORS_IN_GRID = true;   // tint column cells inside phases
export const DEFAULT_EXPANDED_ROW_VIEW         = false;  // Gantt-like row time spans
export const DEFAULT_HIDE_ALL_EDGES            = false;  // hide every edge line
export const DEFAULT_HIDE_COLLAPSED_EDGES      = false;  // hide edges for collapsed rows
export const DEFAULT_HIDE_COLLAPSED_NODES      = false;  // hide edges+nodes for collapsed rows
export const DEFAULT_SHOW_EMPTY_LANES          = true;   // show lanes with no rows
export const DEFAULT_AUTO_SELECT_BLOCKING      = true;   // auto-select blocking nodes on warning
export const DEFAULT_RESIZE_ALL_SELECTED       = true;   // resize all selected nodes when one is resized
export const DEFAULT_REFACTOR_MODE             = false;  // refactor mode off by default
export const DEFAULT_COLLAPSE_ALL_LANE_PHASES  = false;  // don't hide lane phase rows
export const DEFAULT_HIDE_GLOBAL_PHASES        = false;  // show global phase header row
export const DEFAULT_TOOLBAR_COLLAPSED         = false;  // show the control-board toolbar
export const DEFAULT_HEADER_COLLAPSED          = false;  // show the app/project header
export const DEFAULT_SOUND_ENABLED             = true;   // play UI sounds
export const DEFAULT_HIDE_COLUMN_HEADER        = false;  // show the column header row
export const DEFAULT_HIDE_LANE_LABELS           = false;  // show lane labels column
export const DEFAULT_HIDE_ROW_LABELS            = false;  // show row labels column
export const DEFAULT_HIDE_ROW_ACTIONS           = false;  // show row action buttons column
export const DEFAULT_IS_FULLSCREEN             = false;  // not fullscreen by default

// ── Numeric settings ─────────────────────────────────────────
export const DEFAULT_WARNING_DURATION           = 2000;                       // ms — how long warning toast shows
export const DEFAULT_CUSTOM_COLUMN_WIDTH        = DEFAULT_COLUMNWIDTH;        // px
export const DEFAULT_CUSTOM_ROW_HEIGHT_NORMAL   = DEFAULT_ROWHEIGHT_NORMAL;   // px
export const DEFAULT_CUSTOM_ROW_HEIGHT_SMALL    = DEFAULT_ROWHEIGHT_SMALL;    // px
export const DEFAULT_LANE_COLUMN_WIDTH          = DEFAULT_LANEWIDTH_CONSTANT; // px
export const DEFAULT_ROW_COLUMN_WIDTH           = DEFAULT_ROWLABELWIDTH_CONSTANT; // px

// ══════════════════════════════════════════════════════════════
// Convenience: build a full default-view state object.
// Used by "Default" view and to fill in missing keys.
// ══════════════════════════════════════════════════════════════
export function getDefaultViewState() {
  return {
    // Per-item display — empty objects mean "use data defaults"
    rowDisplaySettings: {},
    laneDisplaySettings: {},
    // Modes
    viewMode:                DEFAULT_VIEW_MODE,
    mode:                    DEFAULT_INTERACTION_MODE,
    // Column states
    collapsedColumns:        [],
    selectedColumns:         [],
    // Edge display
    edgeSettings:            { ...DEFAULT_EDGE_SETTINGS },
    // Boolean toggles
    showPhaseColorsInGrid:   DEFAULT_SHOW_PHASE_COLORS_IN_GRID,
    expandedRowView:         DEFAULT_EXPANDED_ROW_VIEW,
    hideAllEdges:            DEFAULT_HIDE_ALL_EDGES,
    hideCollapsedEdges:      DEFAULT_HIDE_COLLAPSED_EDGES,
    hideCollapsedNodes:      DEFAULT_HIDE_COLLAPSED_NODES,
    showEmptyLanes:          DEFAULT_SHOW_EMPTY_LANES,
    // Dimensions
    customColumnWidth:       DEFAULT_CUSTOM_COLUMN_WIDTH,
    customRowHeightNormal:   DEFAULT_CUSTOM_ROW_HEIGHT_NORMAL,
    customRowHeightSmall:    DEFAULT_CUSTOM_ROW_HEIGHT_SMALL,
    laneColumnWidth:         DEFAULT_LANE_COLUMN_WIDTH,
    rowColumnWidth:          DEFAULT_ROW_COLUMN_WIDTH,
    // Lane phase rows
    collapsedLanePhaseRows:  [],
    collapseAllLanePhases:   DEFAULT_COLLAPSE_ALL_LANE_PHASES,
    // Advanced
    autoSelectBlocking:      DEFAULT_AUTO_SELECT_BLOCKING,
    resizeAllSelected:       DEFAULT_RESIZE_ALL_SELECTED,
    warningDuration:         DEFAULT_WARNING_DURATION,
    refactorMode:            DEFAULT_REFACTOR_MODE,
    // Layout visibility
    hideGlobalPhases:        DEFAULT_HIDE_GLOBAL_PHASES,
    toolbarCollapsed:        DEFAULT_TOOLBAR_COLLAPSED,
    headerCollapsed:         DEFAULT_HEADER_COLLAPSED,
    soundEnabled:            DEFAULT_SOUND_ENABLED,
    hideColumnHeader:        DEFAULT_HIDE_COLUMN_HEADER,
    hideLaneLabels:          DEFAULT_HIDE_LANE_LABELS,
    hideRowLabels:           DEFAULT_HIDE_ROW_LABELS,
    hideRowActions:          DEFAULT_HIDE_ROW_ACTIONS,
    isFullscreen:            DEFAULT_IS_FULLSCREEN,
  };
}
