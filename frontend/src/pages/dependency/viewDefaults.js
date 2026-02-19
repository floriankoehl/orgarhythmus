// ==========================================
// Dependency Page — Default Settings Registry
// ==========================================
//
// This file defines the default value for EVERY setting that is
// saved inside a view.  Change any value here and the "Default"
// view (which always exists) will use it, and any view that was
// saved before a new setting was introduced will fall back to it.
//
// The keys match the property names stored in the view JSON blob
// (see collectViewState / applyViewState in Dependencies.jsx).
// ==========================================

import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  TASKWIDTH  as DEFAULT_TASKWIDTH_CONSTANT,
  TEAMWIDTH  as DEFAULT_TEAMWIDTH_CONSTANT,
  DEFAULT_DAYWIDTH,
} from './layoutMath';

// ── Dependency display settings ──────────────────────────────
// Shown in the "Advanced → Dependencies" panel of the toolbar.
export const DEFAULT_DEP_SETTINGS = {
  showReasons:             true,      // show reason text on dependency paths
  hideSuggestions:          false,     // hide suggestion-weight dependencies
  uniformVisuals:          false,     // all deps same thickness (ignore weight)
  filterWeights:           [],        // empty = show all; or ['strong','weak','suggestion']
  defaultDepWeight:        'strong',  // default weight when creating new deps
  weakDepPrompt:           true,      // show prompt on weak dep conflict
  colorDirectionHighlight: true,      // color incoming (red) and outgoing (green) deps on select
};

// ── View mode / interaction mode ─────────────────────────────
export const DEFAULT_VIEW_MODE       = 'inspection'; // 'inspection' | 'schedule' | 'dependency'
export const DEFAULT_INTERACTION_MODE = 'drag';       // 'drag' (legacy, always 'drag')

// ── Boolean toggles ──────────────────────────────────────────
export const DEFAULT_SHOW_PHASE_COLORS_IN_GRID = true;   // tint day cells inside phases
export const DEFAULT_EXPANDED_TASK_VIEW        = false;  // Gantt-like task time spans
export const DEFAULT_HIDE_ALL_DEPENDENCIES     = false;  // hide every dependency line
export const DEFAULT_HIDE_COLLAPSED_DEPS       = false;  // hide deps for collapsed tasks
export const DEFAULT_HIDE_COLLAPSED_MILESTONES = false;  // hide deps+milestones for collapsed tasks
export const DEFAULT_SHOW_EMPTY_TEAMS          = true;   // show teams with no tasks
export const DEFAULT_AUTO_SELECT_BLOCKING      = true;   // auto-select blocking milestones on warning
export const DEFAULT_RESIZE_ALL_SELECTED        = true;   // resize all selected milestones when one is resized
export const DEFAULT_REFACTOR_MODE             = false;  // refactor mode off by default
export const DEFAULT_COLLAPSE_ALL_TEAM_PHASES  = false;  // don't hide team phase rows
export const DEFAULT_HIDE_GLOBAL_PHASES        = false;  // show global phase header row
export const DEFAULT_TOOLBAR_COLLAPSED         = false;  // show the control-board toolbar
export const DEFAULT_HEADER_COLLAPSED          = false;  // show the app/project header
export const DEFAULT_SOUND_ENABLED             = true;   // play UI sounds
export const DEFAULT_HIDE_DAY_HEADER           = false;  // show the day column header row
export const DEFAULT_IS_FULLSCREEN             = false;  // not fullscreen by default

// ── Numeric settings ─────────────────────────────────────────
export const DEFAULT_WARNING_DURATION          = 2000;   // ms — how long warning toast shows
export const DEFAULT_CUSTOM_DAY_WIDTH          = DEFAULT_DAYWIDTH;           // px
export const DEFAULT_CUSTOM_TASK_HEIGHT_NORMAL = DEFAULT_TASKHEIGHT_NORMAL;  // px
export const DEFAULT_CUSTOM_TASK_HEIGHT_SMALL  = DEFAULT_TASKHEIGHT_SMALL;   // px
export const DEFAULT_TEAM_COLUMN_WIDTH         = DEFAULT_TEAMWIDTH_CONSTANT; // px
export const DEFAULT_TASK_COLUMN_WIDTH         = DEFAULT_TASKWIDTH_CONSTANT; // px

// ══════════════════════════════════════════════════════════════
// Convenience: build a full default-view state object.
// Used by "Default" view and to fill in missing keys.
// ══════════════════════════════════════════════════════════════
export function getDefaultViewState() {
  return {
    // Per-item display — empty objects mean "use data defaults"
    taskDisplaySettings: {},
    teamDisplaySettings: {},
    // Modes
    viewMode:                DEFAULT_VIEW_MODE,
    mode:                    DEFAULT_INTERACTION_MODE,
    // Day states
    collapsedDays:           [],
    selectedDays:            [],
    // Dependency display
    depSettings:             { ...DEFAULT_DEP_SETTINGS },
    // Boolean toggles
    showPhaseColorsInGrid:   DEFAULT_SHOW_PHASE_COLORS_IN_GRID,
    expandedTaskView:        DEFAULT_EXPANDED_TASK_VIEW,
    hideAllDependencies:     DEFAULT_HIDE_ALL_DEPENDENCIES,
    hideCollapsedDependencies: DEFAULT_HIDE_COLLAPSED_DEPS,
    hideCollapsedMilestones: DEFAULT_HIDE_COLLAPSED_MILESTONES,
    showEmptyTeams:          DEFAULT_SHOW_EMPTY_TEAMS,
    // Dimensions
    customDayWidth:          DEFAULT_CUSTOM_DAY_WIDTH,
    customTaskHeightNormal:  DEFAULT_CUSTOM_TASK_HEIGHT_NORMAL,
    customTaskHeightSmall:   DEFAULT_CUSTOM_TASK_HEIGHT_SMALL,
    teamColumnWidth:         DEFAULT_TEAM_COLUMN_WIDTH,
    taskColumnWidth:         DEFAULT_TASK_COLUMN_WIDTH,
    // Team phase rows
    collapsedTeamPhaseRows:  [],
    collapseAllTeamPhases:   DEFAULT_COLLAPSE_ALL_TEAM_PHASES,
    // Advanced
    autoSelectBlocking:      DEFAULT_AUTO_SELECT_BLOCKING,
    resizeAllSelected:        DEFAULT_RESIZE_ALL_SELECTED,
    warningDuration:         DEFAULT_WARNING_DURATION,
    refactorMode:            DEFAULT_REFACTOR_MODE,
    // Layout visibility
    hideGlobalPhases:        DEFAULT_HIDE_GLOBAL_PHASES,
    toolbarCollapsed:        DEFAULT_TOOLBAR_COLLAPSED,
    headerCollapsed:         DEFAULT_HEADER_COLLAPSED,
    soundEnabled:            DEFAULT_SOUND_ENABLED,
    hideDayHeader:           DEFAULT_HIDE_DAY_HEADER,
    isFullscreen:            DEFAULT_IS_FULLSCREEN,
  };
}
