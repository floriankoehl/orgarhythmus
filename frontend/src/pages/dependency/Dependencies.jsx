import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  getTaskHeight as getTaskHeightBase, 
  getRawTeamHeight as getRawTeamHeightBase, 
  getTeamYOffset as getTeamYOffsetBase, 
  getTaskYOffset as getTaskYOffsetBase,
  getTeamHeightBase,
  getVisibleTasks as getVisibleTasksBase,
  getVisibleTeamIndex as getVisibleTeamIndexBase,
  isTeamVisibleBase,
  getTaskDropIndicatorY as getTaskDropIndicatorYBase,
  calculateContentHeight,
  isTaskVisible,
  // Constants
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  TASKWIDTH as DEFAULT_TASKWIDTH_CONSTANT,
  TEAMWIDTH as DEFAULT_TEAMWIDTH_CONSTANT,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  DEFAULT_DAYWIDTH,
  HEADER_HEIGHT,
  TEAM_COLLAPSED_HEIGHT,
  TEAM_PHASE_ROW_HEIGHT,
  MIN_TEAMWIDTH,
  MAX_TEAMWIDTH,
  MIN_TASKWIDTH,
  MAX_TASKWIDTH,
} from './layoutMath';
import {
  DEFAULT_DEP_SETTINGS,
  getDefaultViewState,
  DEFAULT_HIDE_GLOBAL_PHASES,
  DEFAULT_TOOLBAR_COLLAPSED,
} from './viewDefaults';
import { useDependencyInteraction } from './useDependencyInteraction';
import { useDependencyData } from './useDependencyData';
import { useDependencyUIState } from './useDependencyUIState';
import { useDependencyActions } from './useDependencyActions';
import { set_task_deadline, update_start_index, change_duration, update_dependency, create_dependency, delete_dependency_api, create_phase, update_phase, delete_phase, get_all_views, create_view, update_view, delete_view, set_default_view, list_snapshots, create_snapshot, restore_snapshot as restore_snapshot_api, delete_snapshot, rename_snapshot, get_user_shortcuts, save_user_shortcuts, move_milestone_task } from '../../api/dependencies_api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import DependencyToolbar from '../../components/dependencies/DependencyToolbar';
import DependencyModals from '../../components/dependencies/DependencyModals';
import DependencyCanvas from '../../components/dependencies/DependencyCanvas';
import DependencyWarningToast from '../../components/dependencies/DependencyWarningToast';
import { DependencyProvider, useDependency } from './DependencyContext.jsx';
import { playSound, preloadSounds, startLoopSound, stopLoopSound, setMuted } from '../../assets/sound_registry';

export default function Dependencies() {
  return (
    <DependencyProvider>
      <DependenciesContent />
    </DependencyProvider>
  );
}

function DependenciesContent() {

  const { projectId, teamContainerRef, pushAction } = useDependency();

  // ________Data Hook___________
  // ________________________________________
  const {
    days,
    projectStartDate,
    projectDays,
    setProjectDays,
    phases,
    setPhases,
    milestones,
    setMilestones,
    teamOrder,
    setTeamOrder,
    teams,
    setTeams,
    tasks,
    setTasks,
    connections,
    setConnections,
    taskDisplaySettings,
    setTaskDisplaySettings,
    teamDisplaySettings,
    setTeamDisplaySettings,
    setReloadData,
  } = useDependencyData(projectId);

  // Listen for IdeaBin refresh events (idea dropped → task/milestone created)
  useEffect(() => {
    const handleRefresh = () => setReloadData(true);
    window.addEventListener("ideabin-dep-refresh", handleRefresh);
    return () => window.removeEventListener("ideabin-dep-refresh", handleRefresh);
  }, [setReloadData]);

  // UI state from custom hook
  const {
    hoveredMilestone,
    setHoveredMilestone,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnections,
    setSelectedConnections,
    viewMode,
    setViewMode,
    baseViewModeRef,
    autoSelectBlocking,
    setAutoSelectBlocking,
    warningDuration,
    setWarningDuration,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  } = useDependencyUIState();

  // Team settings dropdown
  const [openTeamSettings, setOpenTeamSettings] = useState(null);

  // Filter dropdown visibility
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Day cell hover state for milestone creation
  const [hoveredDayCell, setHoveredDayCell] = useState(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false); // { taskId, dayIndex }
  
  // Milestone creation confirmation modal
  const [milestoneCreateModal, setMilestoneCreateModal] = useState(null); // { taskId, dayIndex }

  // Milestone delete confirmation modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { milestoneId, milestoneName }

  // Create modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#facc15");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTeamId, setNewTaskTeamId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Advanced settings
  const [hideCollapsedDependencies, setHideCollapsedDependencies] = useState(false);
  const [hideCollapsedMilestones, setHideCollapsedMilestones] = useState(false);
  const [customDayWidth, setCustomDayWidth] = useState(DEFAULT_DAYWIDTH);
  const [customTaskHeightNormal, setCustomTaskHeightNormal] = useState(DEFAULT_TASKHEIGHT_NORMAL);
  const [customTaskHeightSmall, setCustomTaskHeightSmall] = useState(DEFAULT_TASKHEIGHT_SMALL);
  const [hideAllDependencies, setHideAllDependencies] = useState(false);
  const [showEmptyTeams, setShowEmptyTeams] = useState(true);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // Expanded task view (Gantt-like: show task time span across milestones)
  const [expandedTaskView, setExpandedTaskView] = useState(false);

  // Phase color in grid (tint day cells within phases)
  const [showPhaseColorsInGrid, setShowPhaseColorsInGrid] = useState(true);

  // Dependency display settings (defaults from viewDefaults.js)
  const [depSettings, setDepSettings] = useState({ ...DEFAULT_DEP_SETTINGS });

  // Connection edit modal (for editing weight/reason of a selected connection)
  const [connectionEditModal, setConnectionEditModal] = useState(null); // { source, target, weight, reason }

  // Suggestion offer modal (when creating a dep that violates timing, offer to create as suggestion)
  const [suggestionOfferModal, setSuggestionOfferModal] = useState(null); // { sourceId, targetId }


  // Day purpose modal
  const [dayPurposeModal, setDayPurposeModal] = useState(null); // { dayIndex, currentPurpose, currentPurposeTeams }
  const [newDayPurpose, setNewDayPurpose] = useState("");
  const [newDayPurposeTeams, setNewDayPurposeTeams] = useState(null); // null = all, array of IDs = specific

  // ── Day Selection & Collapsing ──
  const [selectedDays, setSelectedDays] = useState(new Set());       // Set of selected day indices
  const [collapsedDays, setCollapsedDays] = useState(new Set());     // Set of collapsed (hidden) day indices
  const lastSelectedDayRef = useRef(null);                           // for shift-click range selection

  // ── Phase edit modal ──
  const [phaseEditModal, setPhaseEditModal] = useState(null); // null | { id?, name, start_index, duration, color }

  // ── Team phase row collapse state ──
  // collapsedTeamPhaseRows: Set of team IDs whose phase rows are collapsed
  // collapseAllTeamPhases: boolean to collapse all team phase rows at once
  const [collapsedTeamPhaseRows, setCollapsedTeamPhaseRows] = useState(new Set());
  const [collapseAllTeamPhases, setCollapseAllTeamPhases] = useState(false);

  // Column widths (resizable)
  const [teamColumnWidth, setTeamColumnWidth] = useState(DEFAULT_TEAMWIDTH_CONSTANT);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASKWIDTH_CONSTANT);

  // ── Layout visibility (collapsible sections) ──
  const [hideGlobalPhases, setHideGlobalPhases] = useState(DEFAULT_HIDE_GLOBAL_PHASES);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(DEFAULT_TOOLBAR_COLLAPSED);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hideDayHeader, setHideDayHeader] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  // ── User shortcuts ──
  const [userShortcuts, setUserShortcuts] = useState({});
  useEffect(() => {
    get_user_shortcuts().then(data => setUserShortcuts(data.shortcuts || {})).catch(() => {});
  }, []);
  const handleSaveShortcuts = useCallback((shortcuts) => {
    setUserShortcuts(shortcuts);
    save_user_shortcuts(shortcuts).catch(() => {});
  }, []);

  // ── Fullscreen sync ──
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── Header collapse DOM effect (hides both ProjectHeader + OrgaLayout header) ──
  useEffect(() => {
    const projectHeaderEl = document.querySelector('[data-project-header]');
    const orgaHeaderEl = document.querySelector('[data-orga-header]');
    const projectMainEl = projectHeaderEl?.closest('.min-h-screen')?.querySelector('main');
    const orgaMainEl = document.querySelector('[data-orga-main]');
    if (projectHeaderEl) {
      projectHeaderEl.style.transition = 'transform 0.3s ease';
      projectHeaderEl.style.transform = headerCollapsed ? 'translateY(-100%)' : '';
    }
    if (orgaHeaderEl) {
      orgaHeaderEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      orgaHeaderEl.style.transform = headerCollapsed ? 'translateY(-100%)' : '';
      orgaHeaderEl.style.opacity = headerCollapsed ? '0' : '';
      orgaHeaderEl.style.pointerEvents = headerCollapsed ? 'none' : '';
    }
    if (orgaMainEl) {
      orgaMainEl.style.transition = 'margin-top 0.3s ease';
      orgaMainEl.style.marginTop = headerCollapsed ? '0' : '';
    }
    if (projectMainEl) {
      projectMainEl.style.transition = 'margin-top 0.3s ease';
      projectMainEl.style.marginTop = headerCollapsed ? '0' : '';
    }
    return () => {
      if (projectHeaderEl) { projectHeaderEl.style.transform = ''; projectHeaderEl.style.transition = ''; }
      if (orgaHeaderEl) { orgaHeaderEl.style.transform = ''; orgaHeaderEl.style.transition = ''; orgaHeaderEl.style.opacity = ''; orgaHeaderEl.style.pointerEvents = ''; }
      if (orgaMainEl) { orgaMainEl.style.marginTop = ''; orgaMainEl.style.transition = ''; }
      if (projectMainEl) { projectMainEl.style.marginTop = ''; projectMainEl.style.transition = ''; }
    };
  }, [headerCollapsed]);

  // ── Sync sound mute state ──
  useEffect(() => { setMuted(!soundEnabled); }, [soundEnabled]);

  // ── Popup close signal (incremented on canvas click to close toolbar dropdowns) ──
  const [popupCloseSignal, setPopupCloseSignal] = useState(0);

  // ── View transition animation ──
  const [viewTransition, setViewTransition] = useState(null); // 'out' | 'in-start' | 'in' | null
  const viewTransitionRef = useRef(null);
  const [viewFlashName, setViewFlashName] = useState(null);
  const viewFlashTimerRef = useRef(null);
  const viewFlashCounterRef = useRef(0);

  // ── Views (saveable frontend state snapshots) ──
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null); // null = Default view
  const [activeViewName, setActiveViewName] = useState("Default");

  // ── Project Snapshots (full data + view state backups) ──
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Keep a ref to phases so drag handlers always see fresh data
  const phasesRef = useRef(phases);
  phasesRef.current = phases;

  // Dynamic constants based on settings
  const DAYWIDTH = customDayWidth;
  const TEAMWIDTH = teamColumnWidth;
  const TASKWIDTH = taskColumnWidth;
  const TASKHEIGHT_NORMAL = customTaskHeightNormal;
  const TASKHEIGHT_SMALL = customTaskHeightSmall;
  const COLLAPSED_DAY_WIDTH = 6; // thin indicator for collapsed days

  // ── Day column layout: maps logical day indices to visual X offsets ──
  // Accounts for collapsed days having a thin width instead of full DAYWIDTH
  const dayColumnLayout = useMemo(() => {
    if (!days) return { dayXOffset: () => 0, dayWidth: () => DAYWIDTH, totalDaysWidth: 0, visibleDayIndices: [], collapsedRanges: [] };

    const offsets = new Array(days);
    const widths = new Array(days);
    const visibleDayIndices = [];
    let x = 0;

    // Detect collapsed ranges for the collapse indicator
    const collapsedRanges = [];
    let rangeStart = null;
    for (let i = 0; i < days; i++) {
      const isCollapsed = collapsedDays.has(i);
      if (isCollapsed && rangeStart === null) rangeStart = i;
      if (!isCollapsed && rangeStart !== null) {
        collapsedRanges.push({ start: rangeStart, end: i - 1 });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) collapsedRanges.push({ start: rangeStart, end: days - 1 });

    for (let i = 0; i < days; i++) {
      offsets[i] = x;
      const w = collapsedDays.has(i) ? COLLAPSED_DAY_WIDTH : DAYWIDTH;
      widths[i] = w;
      if (!collapsedDays.has(i)) visibleDayIndices.push(i);
      x += w;
    }
    const totalDaysWidth = x;

    return {
      dayXOffset: (dayIndex) => offsets[dayIndex] ?? 0,
      dayWidth: (dayIndex) => widths[dayIndex] ?? DAYWIDTH,
      totalDaysWidth,
      visibleDayIndices,
      collapsedRanges,
      offsets,
      widths,
    };
  }, [days, collapsedDays, DAYWIDTH, COLLAPSED_DAY_WIDTH]);

  // Column resize handler
  const handleColumnResize = (column, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = column === 'team' ? TEAMWIDTH : TASKWIDTH;
    const minW = column === 'team' ? MIN_TEAMWIDTH : MIN_TASKWIDTH;
    const maxW = column === 'team' ? MAX_TEAMWIDTH : MAX_TASKWIDTH;
    const setter = column === 'team' ? setTeamColumnWidth : setTaskColumnWidth;

    const onMouseMove = (moveE) => {
      const delta = moveE.clientX - startX;
      setter(Math.min(maxW, Math.max(minW, startWidth + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Helper to get task height (using current settings)
  const getTaskHeight = (taskId, taskDisplaySettings) => 
    getTaskHeightBase(taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);


  // ________Global Event Listener___________
  // ________________________________________

  const [mode, setMode] = useState("drag")

  // safeMode is derived from viewMode - inspection mode is safe
  const safeMode = viewMode === "inspection";

  // ── Refactor mode: drag teams/tasks/milestones → IdeaBin ──
  const [refactorMode, setRefactorMode] = useState(false);
  const [refactorGhost, setRefactorGhost] = useState(null); // { type, id, name, color, x, y, overIdeaBin }
  const refactorDragging = useRef(false);

  const handleDayHeaderClick = (dayIndex) => {
    const dayData = projectDays[dayIndex] || {};
    setDayPurposeModal({
      dayIndex,
      currentPurpose: dayData.purpose || "",
      currentPurposeTeams: dayData.purpose_teams || null
    });
    setNewDayPurpose(dayData.purpose || "");
    setNewDayPurposeTeams(dayData.purpose_teams || null);
  };

  // ── Day selection handlers ──
  const handleDaySelect = useCallback((dayIndex, event) => {
    playSound('uiClick');
    if (event?.shiftKey && lastSelectedDayRef.current !== null) {
      // Shift+click: range select from last selected day to this one
      const start = Math.min(lastSelectedDayRef.current, dayIndex);
      const end = Math.max(lastSelectedDayRef.current, dayIndex);
      setSelectedDays(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (event?.ctrlKey || event?.metaKey) {
      // Ctrl/Cmd+click: toggle single day
      setSelectedDays(prev => {
        const next = new Set(prev);
        if (next.has(dayIndex)) next.delete(dayIndex);
        else next.add(dayIndex);
        return next;
      });
    } else {
      // Plain click: select only this day (or deselect if already sole selection)
      setSelectedDays(prev => {
        if (prev.size === 1 && prev.has(dayIndex)) return new Set();
        return new Set([dayIndex]);
      });
    }
    lastSelectedDayRef.current = dayIndex;
  }, []);

  const clearDaySelection = useCallback(() => {
    setSelectedDays(new Set());
    lastSelectedDayRef.current = null;
  }, []);

  // ── Day collapse/uncollapse handlers ──
  const collapseSelectedDays = useCallback(() => {
    if (selectedDays.size === 0) return;
    playSound('collapse');
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of selectedDays) next.add(d);
      return next;
    });
    setSelectedDays(new Set());
  }, [selectedDays]);

  const uncollapseDays = useCallback((dayIndices) => {
    playSound('collapse');
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of dayIndices) next.delete(d);
      return next;
    });
  }, []);

  const uncollapseAll = useCallback(() => {
    playSound('collapse');
    setCollapsedDays(new Set());
  }, []);

  // ── Phase range collapse (collapse/uncollapse all days covered by a phase) ──
  const collapsePhaseRange = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedDays(prev => {
      const next = new Set(prev);
      // Check if the range is already fully collapsed → uncollapse it
      let allCollapsed = true;
      for (let d = start; d < end; d++) {
        if (!prev.has(d)) { allCollapsed = false; break; }
      }
      if (allCollapsed) {
        for (let d = start; d < end; d++) next.delete(d);
      } else {
        for (let d = start; d < end; d++) next.add(d);
      }
      return next;
    });
  }, []);

  // ── Focus on phase: collapse ALL days EXCEPT the phase's range ──
  const focusOnPhase = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedDays(prev => {
      // Check if we're already focused on this phase (all outside collapsed, all inside expanded)
      let alreadyFocused = true;
      for (let d = 0; d < days; d++) {
        if (d >= start && d < end) {
          if (prev.has(d)) { alreadyFocused = false; break; }
        } else {
          if (!prev.has(d)) { alreadyFocused = false; break; }
        }
      }
      if (alreadyFocused) {
        // Un-focus: uncollapse everything
        return new Set();
      }
      // Focus: collapse everything outside the phase range
      const next = new Set();
      for (let d = 0; d < days; d++) {
        if (d < start || d >= end) next.add(d);
      }
      return next;
    });
  }, [days]);

  // ── Show all team phase rows ──
  const showAllTeamPhases = useCallback(() => {
    playSound('collapse');
    setCollapsedTeamPhaseRows(new Set());
    setCollapseAllTeamPhases(false);
  }, []);

  // ── Hide all team phase rows ──
  const hideAllTeamPhases = useCallback(() => {
    playSound('collapse');
    setCollapseAllTeamPhases(true);
  }, []);

  // ═══════════════ Views (saveable state snapshots) ═══════════════

  // Collect all saveable frontend state into a JSON-serializable object
  const collectViewState = useCallback(() => ({
    taskDisplaySettings,
    teamDisplaySettings,
    viewMode,
    mode,
    collapsedDays: [...collapsedDays],
    selectedDays: [...selectedDays],
    depSettings,
    showPhaseColorsInGrid,
    expandedTaskView,
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    showEmptyTeams,
    customDayWidth,
    customTaskHeightNormal,
    customTaskHeightSmall,
    collapsedTeamPhaseRows: [...collapsedTeamPhaseRows],
    collapseAllTeamPhases,
    teamColumnWidth,
    taskColumnWidth,
    autoSelectBlocking,
    warningDuration,
    refactorMode,
    hideGlobalPhases,
    toolbarCollapsed,
    headerCollapsed,
    soundEnabled,
    hideDayHeader,
    isFullscreen,
  }), [
    taskDisplaySettings, teamDisplaySettings, viewMode, mode,
    collapsedDays, selectedDays, depSettings, showPhaseColorsInGrid,
    expandedTaskView, hideAllDependencies, hideCollapsedDependencies,
    hideCollapsedMilestones, showEmptyTeams, customDayWidth,
    customTaskHeightNormal, customTaskHeightSmall, collapsedTeamPhaseRows,
    collapseAllTeamPhases, teamColumnWidth, taskColumnWidth,
    autoSelectBlocking, warningDuration, refactorMode,
    hideGlobalPhases, toolbarCollapsed, headerCollapsed,
    soundEnabled, hideDayHeader, isFullscreen,
  ]);

  // Apply a saved view state, restoring all settings.
  // Always sets every setting — uses sensible defaults for any missing keys so
  // older saved views still work correctly after new settings are introduced.
  const applyViewState = useCallback((state) => {
    if (!state) return;
    const d = getDefaultViewState();
    // Per-item display settings: merge with current so new teams/tasks keep their defaults
    if (state.taskDisplaySettings) {
      setTaskDisplaySettings(prev => ({ ...prev, ...state.taskDisplaySettings }));
    }
    if (state.teamDisplaySettings) {
      setTeamDisplaySettings(prev => ({ ...prev, ...state.teamDisplaySettings }));
    }
    // View & interaction modes
    const vm = state.viewMode ?? d.viewMode;
    setViewMode(vm);
    baseViewModeRef.current = vm;
    setMode(state.mode ?? d.mode);
    // Day states
    setCollapsedDays(new Set(state.collapsedDays ?? d.collapsedDays));
    setSelectedDays(new Set(state.selectedDays ?? d.selectedDays));
    // Dependency display — merge with defaults so new keys always have values
    setDepSettings({ ...d.depSettings, ...(state.depSettings ?? {}) });
    // Boolean / scalar toggles
    setShowPhaseColorsInGrid(state.showPhaseColorsInGrid ?? d.showPhaseColorsInGrid);
    setExpandedTaskView(state.expandedTaskView ?? d.expandedTaskView);
    setHideAllDependencies(state.hideAllDependencies ?? d.hideAllDependencies);
    setHideCollapsedDependencies(state.hideCollapsedDependencies ?? d.hideCollapsedDependencies);
    setHideCollapsedMilestones(state.hideCollapsedMilestones ?? d.hideCollapsedMilestones);
    setShowEmptyTeams(state.showEmptyTeams ?? d.showEmptyTeams);
    // Dimensions
    setCustomDayWidth(state.customDayWidth ?? d.customDayWidth);
    setCustomTaskHeightNormal(state.customTaskHeightNormal ?? d.customTaskHeightNormal);
    setCustomTaskHeightSmall(state.customTaskHeightSmall ?? d.customTaskHeightSmall);
    setTeamColumnWidth(state.teamColumnWidth ?? d.teamColumnWidth);
    setTaskColumnWidth(state.taskColumnWidth ?? d.taskColumnWidth);
    // Team phase rows
    setCollapsedTeamPhaseRows(new Set(state.collapsedTeamPhaseRows ?? d.collapsedTeamPhaseRows));
    setCollapseAllTeamPhases(state.collapseAllTeamPhases ?? d.collapseAllTeamPhases);
    // Advanced toggles
    setAutoSelectBlocking(state.autoSelectBlocking ?? d.autoSelectBlocking);
    setWarningDuration(state.warningDuration ?? d.warningDuration);
    setRefactorMode(state.refactorMode ?? d.refactorMode);
    // Layout visibility
    setHideGlobalPhases(state.hideGlobalPhases ?? d.hideGlobalPhases);
    setToolbarCollapsed(state.toolbarCollapsed ?? d.toolbarCollapsed);
    setHeaderCollapsed(state.headerCollapsed ?? d.headerCollapsed);
    setSoundEnabled(state.soundEnabled ?? d.soundEnabled);
    setHideDayHeader(state.hideDayHeader ?? d.hideDayHeader);
    // Fullscreen: toggle to match saved state
    const wantFs = state.isFullscreen ?? d.isFullscreen;
    if (wantFs && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!wantFs && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Fetch saved views on mount & auto-load default view
  useEffect(() => {
    if (!projectId) return;
    get_all_views(projectId)
      .then(data => {
        const views = data || [];
        setSavedViews(views);
        // Auto-load the default view if one exists
        const defaultView = views.find(v => v.is_default);
        if (defaultView) {
          applyViewState(defaultView.state);
          setActiveViewId(defaultView.id);
          setActiveViewName(defaultView.name);
        }
      })
      .catch(err => console.error("Failed to load views:", err));
  }, [projectId]);

  // Load a view (switch to it)
  const handleLoadView = useCallback((view) => {
    // Trigger slide-out animation, then apply state and slide in
    setViewTransition('out');
    if (viewTransitionRef.current) clearTimeout(viewTransitionRef.current);
    viewTransitionRef.current = setTimeout(() => {
      const viewName = view ? view.name : 'Default';
      if (!view) {
        applyViewState(getDefaultViewState());
        setActiveViewId(null);
        setActiveViewName("Default");
      } else {
        applyViewState(view.state);
        setActiveViewId(view.id);
        setActiveViewName(view.name);
      }
      // Flash the view name overlay
      if (viewFlashTimerRef.current) clearTimeout(viewFlashTimerRef.current);
      viewFlashCounterRef.current += 1;
      setViewFlashName({ name: viewName, key: viewFlashCounterRef.current });
      viewFlashTimerRef.current = setTimeout(() => {
        setViewFlashName(null);
      }, 1200);
      // Position off-screen right (no transition), then animate in
      setViewTransition('in-start');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setViewTransition('in');
          viewTransitionRef.current = setTimeout(() => {
            setViewTransition(null);
          }, 280);
        });
      });
      playSound('viewLoad');
    }, 220);
  }, [applyViewState]);

  // Cycle to next/prev view
  const handleNextView = useCallback(() => {
    // Build ordered list: Default (null) + saved views
    const allViews = [null, ...savedViews];
    const currentIdx = activeViewId
      ? allViews.findIndex(v => v && v.id === activeViewId)
      : 0;
    const nextIdx = (currentIdx + 1) % allViews.length;
    handleLoadView(allViews[nextIdx]);
  }, [savedViews, activeViewId, handleLoadView]);

  const handlePrevView = useCallback(() => {
    const allViews = [null, ...savedViews];
    const currentIdx = activeViewId
      ? allViews.findIndex(v => v && v.id === activeViewId)
      : 0;
    const prevIdx = (currentIdx - 1 + allViews.length) % allViews.length;
    handleLoadView(allViews[prevIdx]);
  }, [savedViews, activeViewId, handleLoadView]);

  // Save current state to active view
  const handleSaveView = useCallback(async () => {
    if (!activeViewId) return; // can't save the default view
    try {
      const state = collectViewState();
      const updated = await update_view(projectId, activeViewId, { state });
      setSavedViews(prev => prev.map(v => v.id === activeViewId ? { ...v, ...updated } : v));
      playSound('viewSave');
    } catch (err) {
      console.error("Failed to save view:", err);
      alert("Failed to save view: " + (err.message || err));
    }
  }, [projectId, activeViewId, collectViewState]);

  // Create a new view from current state
  const handleCreateView = useCallback(async (name) => {
    if (!name?.trim()) return;
    try {
      const state = collectViewState();
      const created = await create_view(projectId, { name: name.trim(), state });
      setSavedViews(prev => [...prev, created]);
      setActiveViewId(created.id);
      setActiveViewName(created.name);
      playSound('viewSave');
    } catch (err) {
      console.error("Failed to create view:", err);
      alert("Failed to create view: " + (err.message || err));
    }
  }, [projectId, collectViewState]);

  // Rename a view
  const handleRenameView = useCallback(async (viewId, newName) => {
    if (!newName?.trim()) return;
    try {
      const updated = await update_view(projectId, viewId, { name: newName.trim() });
      setSavedViews(prev => prev.map(v => v.id === viewId ? { ...v, ...updated } : v));
      if (viewId === activeViewId) setActiveViewName(newName.trim());
    } catch (err) {
      console.error("Failed to rename view:", err);
      alert("Failed to rename view: " + (err.message || err));
    }
  }, [projectId, activeViewId]);

  // Delete a view
  const handleDeleteView = useCallback(async (viewId) => {
    try {
      await delete_view(projectId, viewId);
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
      if (viewId === activeViewId) {
        setActiveViewId(null);
        setActiveViewName("Default");
      }
    } catch (err) {
      console.error("Failed to delete view:", err);
      alert("Failed to delete view: " + (err.message || err));
    }
  }, [projectId, activeViewId]);

  // Set / clear the default view for this project
  const handleSetDefaultView = useCallback(async (viewId) => {
    try {
      const updatedViews = await set_default_view(projectId, viewId);
      setSavedViews(updatedViews || []);
    } catch (err) {
      console.error("Failed to set default view:", err);
      alert("Failed to set default view: " + (err.message || err));
    }
  }, [projectId]);

  // Update the shortcut key for a view (stored in the view's state.viewShortcutKey)
  const handleUpdateViewShortcut = useCallback(async (viewId, key) => {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;
    try {
      const newState = { ...(view.state || {}), viewShortcutKey: key || null };
      const updated = await update_view(projectId, viewId, { state: newState });
      setSavedViews(prev => prev.map(v => v.id === viewId ? { ...v, ...updated } : v));
      playSound('uiClick');
    } catch (err) {
      console.error("Failed to update view shortcut:", err);
    }
  }, [projectId, savedViews]);

  // ═══════════════ End Views ═══════════════

  // ═══════════════ Project Snapshots ═══════════════

  // Fetch snapshots on mount
  useEffect(() => {
    if (!projectId) return;
    list_snapshots(projectId)
      .then(data => setSnapshots(data.snapshots || []))
      .catch(err => console.error("Failed to load snapshots:", err));
  }, [projectId]);

  const handleCreateSnapshot = useCallback(async (name, description) => {
    if (!name?.trim()) return;
    setSnapshotsLoading(true);
    try {
      const data = await create_snapshot(projectId, { name: name.trim(), description: description || "" });
      const created = data.snapshot || data;
      setSnapshots(prev => [created, ...prev]);
      playSound('snapshotSave');
    } catch (err) {
      console.error("Failed to create snapshot:", err);
      alert("Failed to create snapshot: " + (err.message || err));
    } finally {
      setSnapshotsLoading(false);
    }
  }, [projectId]);

  // Quick-save snapshot: overwrite the most recent snapshot, or create a new one
  const handleQuickSaveSnapshot = useCallback(async () => {
    if (snapshots.length > 0) {
      // Overwrite the most recent snapshot (re-create with same name)
      const latest = snapshots[0];
      setSnapshotsLoading(true);
      try {
        const data = await create_snapshot(projectId, { name: latest.name, description: latest.description || '' });
        const created = data.snapshot || data;
        setSnapshots(prev => [created, ...prev]);
        playSound('snapshotSave');
      } catch (err) {
        console.error("Quick-save snapshot failed:", err);
      } finally {
        setSnapshotsLoading(false);
      }
    } else {
      // No snapshots yet — create one with a default name
      await handleCreateSnapshot('Quick Save', '');
      playSound('snapshotSave');
    }
  }, [projectId, snapshots, handleCreateSnapshot]);

  const handleRestoreSnapshot = useCallback(async (snapshotId) => {
    setSnapshotsLoading(true);
    try {
      await restore_snapshot_api(projectId, snapshotId);
      playSound('snapshotRestore');
      // Re-fetch all data from backend after restore
      setReloadData(true);
      // Also reload views since they were restored too
      const viewData = await get_all_views(projectId);
      const views = viewData || [];
      setSavedViews(views);
      setActiveViewId(null);
      setActiveViewName("Default");
      const defaultView = views.find(v => v.is_default);
      if (defaultView) {
        applyViewState(defaultView.state);
        setActiveViewId(defaultView.id);
        setActiveViewName(defaultView.name);
      }
    } catch (err) {
      console.error("Failed to restore snapshot:", err);
      alert("Failed to restore snapshot: " + (err.message || err));
    } finally {
      setSnapshotsLoading(false);
    }
  }, [projectId, setReloadData, applyViewState]);

  const handleDeleteSnapshot = useCallback(async (snapshotId) => {
    try {
      await delete_snapshot(projectId, snapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    } catch (err) {
      console.error("Failed to delete snapshot:", err);
      alert("Failed to delete snapshot: " + (err.message || err));
    }
  }, [projectId]);

  const handleRenameSnapshot = useCallback(async (snapshotId, name, description) => {
    try {
      const data = await rename_snapshot(projectId, snapshotId, { name, description });
      const updated = data.snapshot || data;
      setSnapshots(prev => prev.map(s => s.id === snapshotId ? { ...s, ...updated } : s));
    } catch (err) {
      console.error("Failed to rename snapshot:", err);
      alert("Failed to rename snapshot: " + (err.message || err));
    }
  }, [projectId]);

  // ═══════════════ End Project Snapshots ═══════════════

  // ── Phase CRUD handlers ──
  const handleCreatePhase = useCallback(async (phaseData) => {
    try {
      const res = await create_phase(projectId, phaseData);
      const created = res.phase || res;
      setPhases(prev => [...prev, created]);
      setPhaseEditModal(null);
      playSound('phaseCreate');
    } catch (err) {
      console.error("Failed to create phase:", err);
      alert("Failed to create phase: " + (err.message || err));
    }
  }, [projectId]);

  const handleUpdatePhase = useCallback(async (phaseId, phaseData) => {
    try {
      const res = await update_phase(projectId, phaseId, phaseData);
      const updated = res.phase || res;
      setPhases(prev => prev.map(p => p.id === phaseId ? { ...p, ...updated } : p));
      setPhaseEditModal(null);
      playSound('phaseUpdate');
    } catch (err) {
      console.error("Failed to update phase:", err);
      alert("Failed to update phase: " + (err.message || err));
    }
  }, [projectId]);

  const handleDeletePhase = useCallback(async (phaseId) => {
    try {
      await delete_phase(projectId, phaseId);
      setPhases(prev => prev.filter(p => p.id !== phaseId));
      setPhaseEditModal(null);
      playSound('phaseDelete');
    } catch (err) {
      console.error("Failed to delete phase:", err);
    }
  }, [projectId]);

  // ── Phase overlap detection helper ──
  // Returns true if a phase at (startIdx, dur) would overlap any other phase in the same scope
  // Uses phasesRef to always check against the latest phases (avoids stale closures during drag)
  const wouldPhaseOverlap = useCallback((phaseId, startIdx, dur, teamId) => {
    for (const p of phasesRef.current) {
      if (p.id === phaseId) continue;
      // Same scope check: both global (team==null) or both same team
      const sameScope = (teamId == null && p.team == null) ||
                        (teamId != null && p.team != null && String(p.team) === String(teamId));
      if (!sameScope) continue;
      // Overlap check: intervals [startIdx, startIdx+dur) and [p.start_index, p.start_index+p.duration)
      if (startIdx < p.start_index + p.duration && startIdx + dur > p.start_index) {
        return true;
      }
    }
    return false;
  }, []);

  // ── Phase edge resize (drag left/right edges to resize) ──
  const handlePhaseEdgeResize = useCallback((e, phaseId, edge) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phasesRef.current.find(p => p.id === phaseId);
    if (!phase) return;

    const startX = e.clientX;
    const initialStartIndex = phase.start_index;
    const initialDuration = phase.duration || 1;
    const teamId = phase.team;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / DAYWIDTH);

      setPhases(prev => prev.map(p => {
        if (p.id !== phaseId) return p;
        let newStart = p.start_index;
        let newDur = p.duration;
        if (edge === 'right') {
          newDur = Math.max(1, initialDuration + indexDelta);
          newStart = initialStartIndex;
        } else if (edge === 'left') {
          newStart = Math.max(0, initialStartIndex + indexDelta);
          const durationChange = initialStartIndex - newStart;
          newDur = Math.max(1, initialDuration + durationChange);
        }
        // Collision check within same scope
        if (wouldPhaseOverlap(phaseId, newStart, newDur, teamId)) return p;
        return { ...p, start_index: newStart, duration: newDur };
      }));
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      playSound('phaseUpdate');
      setPhases(prev => {
        const current = prev.find(p => p.id === phaseId);
        if (current) {
          update_phase(projectId, phaseId, {
            start_index: current.start_index,
            duration: current.duration,
          }).catch(err => console.error("Failed to persist phase resize:", err));
        }
        return prev;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  }, [DAYWIDTH, projectId, wouldPhaseOverlap]);

  // ── Phase drag to move (mousedown on phase bar body) ──
  const handlePhaseDrag = useCallback((e, phaseId) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phasesRef.current.find(p => p.id === phaseId);
    if (!phase) return;

    const startX = e.clientX;
    const initialStartIndex = phase.start_index;
    const duration = phase.duration || 1;
    const teamId = phase.team;
    let moved = false;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / DAYWIDTH);
      if (indexDelta === 0 && !moved) return;
      moved = true;

      setPhases(prev => prev.map(p => {
        if (p.id !== phaseId) return p;
        const newStartIndex = Math.max(0, initialStartIndex + indexDelta);
        // Collision check within same scope
        if (wouldPhaseOverlap(phaseId, newStartIndex, duration, teamId)) return p;
        return { ...p, start_index: newStartIndex };
      }));
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!moved) return;

      playSound('phaseUpdate');
      setPhases(prev => {
        const current = prev.find(p => p.id === phaseId);
        if (current) {
          update_phase(projectId, phaseId, {
            start_index: current.start_index,
          }).catch(err => {
            console.error("Failed to persist phase move:", err);
            alert("Failed to move phase: " + (err?.message || "Unknown error"));
          });
        }
        return prev;
      });
    };

    document.body.style.cursor = 'grab';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  }, [DAYWIDTH, projectId, wouldPhaseOverlap]);

  // ── Refactor drag: defined after useDependencyInteraction hook below ──


  // ... (keep all other existing functions like getTeamHeight, handleTeamDrag, etc.)


  // ___________DAY LABELS WITH ENHANCED INFO______________
  // ________________________________________

  const dayLabels = useMemo(() => {
    if (!projectStartDate || !days) return [];
    const labels = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(projectStartDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const isSunday = dayOfWeek === 0;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayNameShort = dayNames[dayOfWeek];
      
      // Get purpose from projectDays if available
      const dayData = projectDays[i] || {};
      
      labels.push({
        index: i,
        dateStr: `${day}.${month}`,
        dayNameShort: dayData.day_name_short || dayNameShort,
        isSunday: dayData.is_sunday ?? isSunday,
        isWeekend: dayData.is_weekend ?? isWeekend,
        purpose: dayData.purpose || null,
        purposeTeams: dayData.purpose_teams || null,
        isBlocked: dayData.is_blocked || false,
      });
    }
    return labels;
  }, [projectStartDate, days, projectDays]);


  // Calculate team height based on visible tasks and their sizes (with minimum)
  const TEAM_MIN_HEIGHT = TASKHEIGHT_NORMAL;

  // Compute which teams have team-specific phases
  const globalPhases = useMemo(() => phases.filter(p => p.team == null), [phases]);
  const teamPhasesMap = useMemo(() => {
    const m = {};
    for (const p of phases) {
      if (p.team != null) {
        if (!m[p.team]) m[p.team] = [];
        m[p.team].push(p);
      }
    }
    return m;
  }, [phases]);

  // Compute per-team phase row height (0 if no team phases or collapsed)
  const getTeamPhaseRowHeight = useCallback((teamId) => {
    const teamIdNum = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
    if (!teamPhasesMap[teamIdNum] || teamPhasesMap[teamIdNum].length === 0) return 0;
    if (collapseAllTeamPhases || collapsedTeamPhaseRows.has(teamIdNum)) return 0;
    return TEAM_PHASE_ROW_HEIGHT;
  }, [teamPhasesMap, collapseAllTeamPhases, collapsedTeamPhaseRows]);

  const getTeamHeight = (teamId) => 
    getTeamHeightBase(teams[teamId], teamDisplaySettings, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL, TEAM_MIN_HEIGHT, TEAM_COLLAPSED_HEIGHT, getTeamPhaseRowHeight(teamId));

  const getRawTeamHeight = (teamId) => 
    getRawTeamHeightBase(teams[teamId], taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);

  const isTeamVisible = (teamId) => 
    isTeamVisibleBase(teamId, teamDisplaySettings, teams, taskDisplaySettings, showEmptyTeams, milestones);

  const isTeamCollapsed = (teamId) => {
    return teamDisplaySettings[teamId]?.collapsed ?? false;
  };

  const getVisibleTasks = (teamId) => 
    getVisibleTasksBase(teams[teamId], taskDisplaySettings);

  const getHiddenTeamCount = () => {
    return teamOrder.filter(tid => !isTeamVisible(tid)).length;
  };

  const visibleTeamCount = teamOrder.filter(tid => isTeamVisible(tid)).length;
  const hiddenTeamCount = getHiddenTeamCount();

  // Calculate content height — include phase header in HEADER_HEIGHT so all Y offsets
  // (milestones, connections, drag hit-testing) account for the extra row.
  const PHASE_HEADER_HEIGHT = 26;
  const hasGlobalPhases = globalPhases.length > 0;
  const hasPhases = phases.length > 0;
  const effectiveHeaderHeight = (hideDayHeader ? 0 : HEADER_HEIGHT) + (hasGlobalPhases && !hideGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const layoutConstants = { HEADER_HEIGHT: effectiveHeaderHeight, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP };
  
  const contentHeight = useMemo(() => {
    return calculateContentHeight(teamOrder, isTeamVisible, getTeamHeight, layoutConstants);
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, TASKHEIGHT_NORMAL, TASKHEIGHT_SMALL, hasGlobalPhases, hideGlobalPhases, hideDayHeader, phases, collapseAllTeamPhases, collapsedTeamPhaseRows, showEmptyTeams, milestones]);

  // Get visible team index (accounting for hidden teams)
  const getVisibleTeamIndex = (teamId) => 
    getVisibleTeamIndexBase(teamId, teamOrder, isTeamVisible);

  // Get Y offset for a team
  const getTeamYOffset = (teamId) => 
    getTeamYOffsetBase(teamId, teamOrder, isTeamVisible, getTeamHeight, layoutConstants);

  // Get Y offset for a task within its team
  const getTaskYOffset = (taskId, teamId) => 
    getTaskYOffsetBase(taskId, teams[teamId], isTaskVisible, getTaskHeight, taskDisplaySettings);

  // Get task drop indicator Y position
  const getTaskDropIndicatorY = () => 
    getTaskDropIndicatorYBase(taskDropTarget, getTeamYOffset, getVisibleTasks, getTaskHeight, taskDisplaySettings, layoutConstants, getTeamPhaseRowHeight);

  // ________Interaction Hook___________
  // ________________________________________
  const {
    handleTeamDrag,
    handleTaskDrag,
    handleMileStoneMouseDown,
    handleMilestoneEdgeResize,
    handleMilestoneClick,
    handleConnectionClick,
    handleMilestoneDelete,
    handleMilestoneDoubleClick,
    handleMilestoneRenameSubmit,
    handleDayCellClick,
    handleConnectionDragStart,
    handleDeleteConnection,
    handleUpdateConnection,
    validateMilestoneMove,
    validateMultiMilestoneMove,
    checkMilestoneOverlap,
    findMilestoneAtPosition,
    getMilestoneHandlePosition,
    showBlockingFeedback,
    addWarning,
    // Warning messages for toast
    warningMessages,
    // Transient interaction state
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    taskGhost,
    setTaskGhost,
    taskDropTarget,
    setTaskDropTarget,
    isDraggingConnection,
    setIsDraggingConnection,
    connectionStart,
    setConnectionStart,
    connectionEnd,
    setConnectionEnd,
    justDraggedRef,
    moveModal,
    setMoveModal,
    blockedMoveHighlight,
    setBlockedMoveHighlight,
    marqueeRect,
    handleMarqueeStart,
    weakDepModal,
    setWeakDepModal,
  } = useDependencyInteraction({
    milestones,
    teams,
    tasks,
    teamOrder,
    connections,
    openTeamSettings,
    showFilterDropdown,
    taskDisplaySettings,
    teamDisplaySettings,
    setMode,
    setMilestones,
    setTeams,
    setTeamOrder,
    setConnections,
    setDeleteConfirmModal,
    setOpenTeamSettings,
    setShowFilterDropdown,
    setTaskDisplaySettings,
    setTeamDisplaySettings,
    setMilestoneCreateModal,
    setIsAddingMilestone,
    setTasks,
    DAYWIDTH,
    TEAMWIDTH,
    TASKWIDTH,
    getTaskHeight,
    getTeamHeight,
    isTeamVisible,
    getVisibleTeamIndex,
    getTeamYOffset,
    getTaskYOffset,
    getVisibleTasks,
    safeMode,
    onSuggestionOffer: setSuggestionOfferModal,
    defaultDepWeight: depSettings.defaultDepWeight || 'strong',
    dayColumnLayout,
    collapsedDays,
    getTeamPhaseRowHeight,
    layoutConstants,
    savedViews,
    onLoadView: handleLoadView,
    onSaveView: handleSaveView,
    onNextView: handleNextView,
    onPrevView: handlePrevView,
    refactorMode,
    setRefactorMode,
    // Toggle shortcuts
    setToolbarCollapsed,
    setHeaderCollapsed,
    toggleFullscreen,
    // User shortcuts
    userShortcuts,
    // Q+W shortcut action setters
    setCustomDayWidth,
    setCustomTaskHeightNormal,
    setCustomTaskHeightSmall,
    setHideDayHeader,
    setSoundEnabled,
    setShowEmptyTeams,
    setShowPhaseColorsInGrid,
    setHideAllDependencies,
    setHideCollapsedDependencies,
    setHideCollapsedMilestones,
    setExpandedTaskView,
    setHideGlobalPhases,
    uncollapseAll,
    setAutoSelectBlocking,
    // Visibility state values (for select-visible shortcuts)
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    isTeamCollapsed,
    // Quick snapshot save
    snapshots,
    onQuickSaveSnapshot: handleQuickSaveSnapshot,
    // Create modals for shortcuts
    setShowCreateTeamModal,
    setShowCreateTaskModal,
    setPhaseEditModal,
    // Default view
    onLoadDefaultView: () => handleLoadView(null),
  });

  // ── Refactor drag: pick up a team / task / milestone and drop on IdeaBin or grid cell ──
  const handleRefactorDrag = useCallback((e, type, payload) => {
    if (!refactorMode) return;
    e.preventDefault();
    e.stopPropagation();
    refactorDragging.current = true;

    let ghost = { type, ...payload, x: e.clientX, y: e.clientY, overIdeaBin: false, overCell: null };
    setRefactorGhost(ghost);

    const onMove = (ev) => {
      const ideaBinEl = document.querySelector("[data-ideabin-window]");
      let overIdeaBin = false;
      if (ideaBinEl) {
        const r = ideaBinEl.getBoundingClientRect();
        overIdeaBin = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      }

      // Detect hovering over a day grid cell
      let overCell = null;
      if (!overIdeaBin && type === 'milestone') {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (el) {
          const cell = el.closest('[data-dep-day-index]');
          if (cell) {
            overCell = {
              dayIndex: parseInt(cell.dataset.depDayIndex, 10),
              taskId: cell.dataset.depDayTaskId,
              teamId: cell.dataset.depDayTeamId,
            };
          }
        }
      }

      ghost = { ...ghost, x: ev.clientX, y: ev.clientY, overIdeaBin, overCell };
      setRefactorGhost(ghost);
    };

    const onUp = async () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      refactorDragging.current = false;

      if (ghost.overIdeaBin) {
        // Dispatch event so IdeaBin can handle the drop
        window.dispatchEvent(new CustomEvent("dep-refactor-drop", {
          detail: { type, ...payload },
        }));
        setRefactorGhost(null);
        return;
      }

      // Drop milestone on a grid cell
      if (type === 'milestone' && ghost.overCell) {
        const { dayIndex, taskId: targetTaskKey } = ghost.overCell;
        const mId = payload.id;
        const m = milestones[mId];

        if (m && targetTaskKey) {
          const oldTaskKey = m.task;
          const oldStartIndex = m.start_index;
          const duration = m.duration || 1;
          const taskChanged = String(targetTaskKey) !== String(oldTaskKey);

          // Check overlap on target task
          const targetTask = tasks[targetTaskKey];
          if (targetTask) {
            const targetMilestones = targetTask.milestones || [];
            for (const mRef of targetMilestones) {
              const other = milestones[mRef.id];
              if (!other || String(mRef.id) === String(mId)) continue;
              const otherEnd = other.start_index + (other.duration || 1) - 1;
              const mEnd = dayIndex + duration - 1;
              if (dayIndex <= otherEnd && mEnd >= other.start_index) {
                playSound('error');
                addWarning('Overlap', 'Cannot move — milestone would overlap on target task');
                setRefactorGhost(null);
                return;
              }
            }
          }

          // Check dependency constraints (predecessor/successor rule)
          const depResult = validateMilestoneMove(mId, dayIndex);
          if (depResult && !depResult.valid) {
            const strongBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'strong');
            const weakBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'weak');
            const suggestionBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'suggestion');

            // Hard block: strong dependencies
            if (strongBlockers.length > 0) {
              addWarning('Blocked', 'Move violates a dependency constraint');
              for (const b of strongBlockers) {
                showBlockingFeedback(b.blockingMilestoneId, b.blockingConnection);
              }
              if (autoSelectBlocking) {
                const blockingIds = new Set([mId, ...strongBlockers.map(b => b.blockingMilestoneId)]);
                setSelectedMilestones(blockingIds);
                setSelectedConnections([]);
              }
              playSound('blocked');
              setRefactorGhost(null);
              return;
            }

            // Weak dependency conflict — show modal (or auto-block if prompt disabled)
            if (weakBlockers.length > 0) {
              setWeakDepModal({
                weakConnections: weakBlockers.map(b => b.blockingConnection),
                blockingMilestoneIds: weakBlockers.map(b => b.blockingMilestoneId),
                milestonesToMove: [mId],
                initialPositions: { [mId]: { startIndex: oldStartIndex } },
                currentDeltaIndex: dayIndex - oldStartIndex,
                suggestionBlocking: suggestionBlockers.map(b => b.blockingConnection),
                taskChanges: taskChanged ? { [mId]: { from: oldTaskKey, to: targetTaskKey } } : null,
              });
              playSound('blocked');
              setRefactorGhost(null);
              return;
            }

            // Only suggestion blocking — allow but warn
            if (suggestionBlockers.length > 0) {
              addWarning('Suggestion dependency violated', 'This move violates a suggestion dependency, but it is allowed.');
              for (const b of suggestionBlockers) {
                showBlockingFeedback(b.blockingMilestoneId, b.blockingConnection);
              }
              // Fall through to allow the move
            }
          }

          // Apply move
          playSound('milestoneMove');

          // Update milestone state
          setMilestones(prev => ({
            ...prev,
            [mId]: { ...prev[mId], task: targetTaskKey, start_index: dayIndex },
          }));

          // Update task arrays if task changed
          if (taskChanged) {
            setTasks(prev => {
              const updated = { ...prev };
              if (updated[oldTaskKey]) {
                updated[oldTaskKey] = {
                  ...updated[oldTaskKey],
                  milestones: (updated[oldTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                };
              }
              if (updated[targetTaskKey]) {
                updated[targetTaskKey] = {
                  ...updated[targetTaskKey],
                  milestones: [...(updated[targetTaskKey].milestones || []), { id: mId }],
                };
              }
              return updated;
            });
          }

          // Persist to backend
          try {
            if (taskChanged) {
              await move_milestone_task(projectId, mId, targetTaskKey);
            }
            if (dayIndex !== oldStartIndex) {
              await update_start_index(projectId, mId, dayIndex);
            }
          } catch (err) {
            console.error("Refactor drag move failed:", err);
            // Revert on failure
            setMilestones(prev => ({
              ...prev,
              [mId]: { ...prev[mId], task: oldTaskKey, start_index: oldStartIndex },
            }));
            if (taskChanged) {
              setTasks(prev => {
                const updated = { ...prev };
                if (updated[targetTaskKey]) {
                  updated[targetTaskKey] = {
                    ...updated[targetTaskKey],
                    milestones: (updated[targetTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                  };
                }
                if (updated[oldTaskKey]) {
                  updated[oldTaskKey] = {
                    ...updated[oldTaskKey],
                    milestones: [...(updated[oldTaskKey].milestones || []), { id: mId }],
                  };
                }
                return updated;
              });
            }
            playSound('error');
            setRefactorGhost(null);
            return;
          }

          // Push undo/redo action
          pushAction({
            description: `Refactor drag milestone to ${taskChanged ? 'different task' : 'new position'}`,
            undo: async () => {
              setMilestones(prev => ({
                ...prev,
                [mId]: { ...prev[mId], task: oldTaskKey, start_index: oldStartIndex },
              }));
              if (taskChanged) {
                setTasks(prev => {
                  const updated = { ...prev };
                  if (updated[targetTaskKey]) {
                    updated[targetTaskKey] = {
                      ...updated[targetTaskKey],
                      milestones: (updated[targetTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                    };
                  }
                  if (updated[oldTaskKey]) {
                    updated[oldTaskKey] = {
                      ...updated[oldTaskKey],
                      milestones: [...(updated[oldTaskKey].milestones || []), { id: mId }],
                    };
                  }
                  return updated;
                });
                await move_milestone_task(projectId, mId, oldTaskKey);
              }
              if (dayIndex !== oldStartIndex) {
                await update_start_index(projectId, mId, oldStartIndex);
              }
            },
            redo: async () => {
              setMilestones(prev => ({
                ...prev,
                [mId]: { ...prev[mId], task: targetTaskKey, start_index: dayIndex },
              }));
              if (taskChanged) {
                setTasks(prev => {
                  const updated = { ...prev };
                  if (updated[oldTaskKey]) {
                    updated[oldTaskKey] = {
                      ...updated[oldTaskKey],
                      milestones: (updated[oldTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                    };
                  }
                  if (updated[targetTaskKey]) {
                    updated[targetTaskKey] = {
                      ...updated[targetTaskKey],
                      milestones: [...(updated[targetTaskKey].milestones || []), { id: mId }],
                    };
                  }
                  return updated;
                });
                await move_milestone_task(projectId, mId, targetTaskKey);
              }
              if (dayIndex !== oldStartIndex) {
                await update_start_index(projectId, mId, dayIndex);
              }
            },
          });
        }
      }

      setRefactorGhost(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [refactorMode, milestones, tasks, connections, projectId, setMilestones, setTasks, pushAction, validateMilestoneMove, showBlockingFeedback, addWarning, autoSelectBlocking, setSelectedMilestones, setSelectedConnections, setWeakDepModal]);

  // ________Actions Hook___________
  // ________________________________________
  const {
    handleSaveDayPurpose,
    handleClearDayPurpose,
    addMilestoneLocal,
    confirmMilestoneCreate,
    handleConfirmMove,
    handleConfirmDelete,
    handleDeleteSelected,
    handleCreateTeam,
    handleCreateTask,
  } = useDependencyActions({
    // Data state
    teams,
    taskDisplaySettings,
    // Modal state values
    dayPurposeModal,
    milestoneCreateModal,
    moveModal,
    deleteConfirmModal,
    // Form state values
    newDayPurpose,
    newDayPurposeTeams,
    newTeamName,
    newTeamColor,
    newTaskName,
    newTaskTeamId,
    // Data state setters
    setProjectDays,
    setMilestones,
    setTasks,
    setTeams,
    setReloadData,
    // Modal state setters
    setDayPurposeModal,
    setMilestoneCreateModal,
    setMoveModal,
    setDeleteConfirmModal,
    setIsAddingMilestone,
    // Form state setters
    setNewDayPurpose,
    setNewDayPurposeTeams,
    setNewTeamName,
    setNewTeamColor,
    setNewTaskName,
    setNewTaskTeamId,
    setShowCreateTeamModal,
    setShowCreateTaskModal,
    setIsCreating,
    // Layout helpers
    getVisibleTasks,
    // Interaction handlers
    handleDeleteConnection,
    handleMilestoneDelete,
    // Computed
    safeMode,
  });

  // Handle suggestion offer: user accepted creating a timing-violated dep as suggestion
  const handleSuggestionOfferAccept = useCallback(async () => {
    if (!suggestionOfferModal) return;
    const { sourceId, targetId } = suggestionOfferModal;
    setSuggestionOfferModal(null);
    try {
      const defaultReason = 'could be before';
      await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
      setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason }]);
      pushAction({
        description: 'Create dependency (suggestion)',
        undo: async () => {
          await delete_dependency_api(projectId, sourceId, targetId);
          setConnections(prev => prev.filter(c => !(c.source === sourceId && c.target === targetId)));
        },
        redo: async () => {
          await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
          setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason }]);
        },
      });
    } catch (err) {
      console.error("Failed to create suggestion dependency:", err);
    }
  }, [suggestionOfferModal, projectId, setConnections, pushAction]);

  // Handle weak dependency conflict: convert weak deps to suggestions, then allow the move/resize
  const handleWeakDepConvert = useCallback(async (conflictData) => {
    if (!conflictData) return;
    const { weakConnections } = conflictData;
    const convertedConnWeights = weakConnections.map(c => ({ ...c, oldWeight: c.weight || 'weak' }));

    // Convert each weak connection to suggestion
    for (const conn of weakConnections) {
      await handleUpdateConnection(conn, { weight: 'suggestion' }, { skipHistory: true });
    }

    if (conflictData.type === 'resize') {
      // ──── Resize path ────
      const { milestonesToResize, initialStates, edge, currentIndexDelta } = conflictData;

      const resizeBefore = {};
      const resizeAfter = {};

      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        let newStart, newDuration;
        if (edge === "right") {
          newStart = initial.startIndex;
          newDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          newStart = Math.max(0, initial.startIndex + currentIndexDelta);
          const durationChange = initial.startIndex - newStart;
          newDuration = Math.max(1, initial.duration + durationChange);
        }

        resizeBefore[mId] = { startIndex: initial.startIndex, duration: initial.duration };
        resizeAfter[mId] = { startIndex: newStart, duration: newDuration };

        setMilestones(prev => ({
          ...prev,
          [mId]: { ...prev[mId], start_index: newStart, duration: newDuration },
        }));

        const durationChange = newDuration - initial.duration;
        if (durationChange !== 0) {
          try { await change_duration(projectId, mId, durationChange); } catch (err) { console.error("Failed to change duration:", err); }
        }
        if (edge === "left" && newStart !== initial.startIndex) {
          try { await update_start_index(projectId, mId, newStart); } catch (err) { console.error("Failed to update start index:", err); }
        }
      }

      pushAction({
        description: 'Weak dep convert + resize',
        undo: async () => {
          for (const mId of milestonesToResize) {
            const before = resizeBefore[mId];
            const after = resizeAfter[mId];
            if (!before || !after) continue;
            const durationDelta = before.duration - after.duration;
            if (durationDelta !== 0) await change_duration(projectId, mId, durationDelta);
            if (before.startIndex !== after.startIndex) await update_start_index(projectId, mId, before.startIndex);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: before.startIndex, duration: before.duration } }));
          }
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: c.oldWeight });
            setConnections(prev => prev.map(conn => conn.source === c.source && conn.target === c.target ? { ...conn, weight: c.oldWeight } : conn));
          }
        },
        redo: async () => {
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: 'suggestion' });
            setConnections(prev => prev.map(conn => conn.source === c.source && conn.target === c.target ? { ...conn, weight: 'suggestion' } : conn));
          }
          for (const mId of milestonesToResize) {
            const before = resizeBefore[mId];
            const after = resizeAfter[mId];
            if (!before || !after) continue;
            const durationDelta = after.duration - before.duration;
            if (durationDelta !== 0) await change_duration(projectId, mId, durationDelta);
            if (before.startIndex !== after.startIndex) await update_start_index(projectId, mId, after.startIndex);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: after.startIndex, duration: after.duration } }));
          }
        },
      });
    } else {
      // ──── Move path (original) ────
      const { milestonesToMove, initialPositions, currentDeltaIndex, taskChanges } = conflictData;

      const beforePositions = {};
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (initial) beforePositions[mId] = initial.startIndex;
      }

      const afterPositions = {};
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (!initial) continue;
        const newStart = initial.startIndex + currentDeltaIndex;
        afterPositions[mId] = newStart;
        setMilestones(prev => {
          const { x, ...rest } = prev[mId];
          return { ...prev, [mId]: { ...rest, start_index: newStart } };
        });
        try {
          await update_start_index(projectId, mId, newStart);
        } catch (err) {
          console.error("Failed to update start index after weak dep conversion:", err);
        }
      }

      // Apply task changes if present (from refactor drag)
      if (taskChanges) {
        for (const [mId, change] of Object.entries(taskChanges)) {
          setMilestones(prev => ({
            ...prev,
            [mId]: { ...prev[mId], task: change.to },
          }));
          setTasks(prev => {
            const updated = { ...prev };
            if (updated[change.from]) {
              updated[change.from] = {
                ...updated[change.from],
                milestones: (updated[change.from].milestones || []).filter(ref => String(ref.id) !== String(mId)),
              };
            }
            if (updated[change.to]) {
              updated[change.to] = {
                ...updated[change.to],
                milestones: [...(updated[change.to].milestones || []), { id: parseInt(mId) || mId }],
              };
            }
            return updated;
          });
          try {
            await move_milestone_task(projectId, mId, change.to);
          } catch (err) {
            console.error("Failed to move milestone task after weak dep conversion:", err);
          }
        }
      }

      pushAction({
        description: 'Weak dep convert + move',
        undo: async () => {
          for (const mId of milestonesToMove) {
            const oldStart = beforePositions[mId];
            if (oldStart === undefined) continue;
            await update_start_index(projectId, mId, oldStart);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: oldStart } }));
          }
          if (taskChanges) {
            for (const [mId, change] of Object.entries(taskChanges)) {
              setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], task: change.from } }));
              setTasks(prev => {
                const updated = { ...prev };
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    milestones: (updated[change.to].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                  };
                }
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    milestones: [...(updated[change.from].milestones || []), { id: parseInt(mId) || mId }],
                  };
                }
                return updated;
              });
              await move_milestone_task(projectId, mId, change.from);
            }
          }
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: c.oldWeight });
            setConnections(prev => prev.map(conn => conn.source === c.source && conn.target === c.target ? { ...conn, weight: c.oldWeight } : conn));
          }
        },
        redo: async () => {
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: 'suggestion' });
            setConnections(prev => prev.map(conn => conn.source === c.source && conn.target === c.target ? { ...conn, weight: 'suggestion' } : conn));
          }
          for (const mId of milestonesToMove) {
            const newStart = afterPositions[mId];
            if (newStart === undefined) continue;
            await update_start_index(projectId, mId, newStart);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: newStart } }));
          }
          if (taskChanges) {
            for (const [mId, change] of Object.entries(taskChanges)) {
              setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], task: change.to } }));
              setTasks(prev => {
                const updated = { ...prev };
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    milestones: (updated[change.from].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                  };
                }
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    milestones: [...(updated[change.to].milestones || []), { id: parseInt(mId) || mId }],
                  };
                }
                return updated;
              });
              await move_milestone_task(projectId, mId, change.to);
            }
          }
        },
      });
    }
  }, [handleUpdateConnection, setMilestones, setTasks, setConnections, projectId, pushAction]);

  // Bulk update multiple connections (weight/reason change)
  const handleBulkUpdateConnections = async (conns, updates) => {
    if (!conns || conns.length === 0) return;
    playSound('settingToggle');
    const oldValues = conns.map(c => ({ source: c.source, target: c.target, weight: c.weight, reason: c.reason }));
    for (const conn of conns) {
      await handleUpdateConnection(conn, updates, { skipHistory: true });
    }
    pushAction({
      description: `Bulk update ${conns.length} dependencies`,
      undo: async () => {
        for (const old of oldValues) {
          await handleUpdateConnection(old, { weight: old.weight, reason: old.reason }, { skipHistory: true });
        }
      },
      redo: async () => {
        for (const conn of conns) {
          await handleUpdateConnection(conn, updates, { skipHistory: true });
        }
      },
    });
  };

  // Auto-block weak dep conflicts when the prompt setting is disabled
  useEffect(() => {
    if (weakDepModal && !depSettings.weakDepPrompt) {
      const modalData = weakDepModal;
      // Auto-block: close modal first
      setWeakDepModal(null);

      // Auto-select blocking milestones
      if (autoSelectBlocking) {
        const blockIds = modalData.blockingMilestoneIds || [];
        const moveOrResizeIds = modalData.milestonesToMove || modalData.milestonesToResize || [];
        setSelectedMilestones(prev => {
          const newSet = new Set(prev);
          for (const mId of moveOrResizeIds) newSet.add(mId);
          for (const bId of blockIds) newSet.add(bId);
          return newSet;
        });
      }

      // Show blocking feedback (reveal hidden/collapsed items + red blink)
      const blockIds = modalData.blockingMilestoneIds || [];
      const weakConns = modalData.weakConnections || [];
      setTimeout(() => {
        for (let i = 0; i < blockIds.length; i++) {
          showBlockingFeedback(blockIds[i], weakConns[i]);
        }
      }, 50);
    }
  }, [weakDepModal, depSettings.weakDepPrompt, autoSelectBlocking, setSelectedMilestones, setWeakDepModal, showBlockingFeedback]);

  // Toggle task size
  const toggleTaskSize = (taskId) => {
    playSound('collapse');
    setTaskDisplaySettings(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        size: prev[taskId]?.size === 'small' ? 'normal' : 'small'
      }
    }));
  };

  // Toggle task visibility
  // Auto-collapse team when all tasks hidden, un-collapse when a task is shown
  const toggleTaskVisibility = (taskId) => {
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          hidden: !prev[taskId]?.hidden
        }
      };

      // Find which team this task belongs to and check if all tasks are now hidden
      for (const tid of teamOrder) {
        const team = teams[tid];
        if (!team || !team.tasks.includes(taskId)) continue;

        const allHidden = team.tasks.every(t => updated[t]?.hidden);
        setTeamDisplaySettings(prev2 => ({
          ...prev2,
          [tid]: { ...prev2[tid], collapsed: allHidden }
        }));
        break;
      }

      return updated;
    });
  };

  // Toggle team visibility
  const toggleTeamVisibility = (teamId) => {
    playSound('teamFilter');
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        hidden: !prev[teamId]?.hidden
      }
    }));
  };

  // Set all tasks in a team to small
  const setTeamTasksSmall = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], size: 'small' };
      }
      return updated;
    });
  };

  // Set all tasks in a team to normal
  const setTeamTasksNormal = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], size: 'normal' };
      }
      return updated;
    });
  };

  // Check if all visible tasks in a team are small
  const allVisibleTasksSmall = (teamId) => {
    const team = teams[teamId];
    if (!team) return false;
    const visibleTasks = team.tasks.filter(tid => isTaskVisible(tid, taskDisplaySettings));
    if (visibleTasks.length === 0) return false;
    return visibleTasks.every(tid => taskDisplaySettings[tid]?.size === 'small');
  };

  // Check if team has hidden tasks
  const teamHasHiddenTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return false;
    return team.tasks.some(tid => taskDisplaySettings[tid]?.hidden);
  };

  // Toggle team collapsed state — un-hide all tasks when expanding
  const toggleTeamCollapsed = (teamId) => {
    const wasCollapsed = teamDisplaySettings[teamId]?.collapsed;
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        collapsed: !prev[teamId]?.collapsed
      }
    }));
    playSound('collapse');
    // When expanding, show all tasks so the user always sees every task
    if (wasCollapsed) {
      const team = teams[teamId];
      if (team) {
        setTaskDisplaySettings(prev => {
          const updated = { ...prev };
          for (const taskId of team.tasks) {
            updated[taskId] = { ...updated[taskId], hidden: false };
          }
          return updated;
        });
      }
    }
  };

  // Set or clear a task's hard deadline
  const handleSetDeadline = useCallback(async (taskId, deadlineDayIndex) => {
    // Capture old value for undo
    let oldDeadline = null;
    setTasks(prev => {
      oldDeadline = prev[taskId]?.hard_deadline ?? null;
      return prev; // no change, just reading
    });

    try {
      await set_task_deadline(projectId, taskId, deadlineDayIndex);
      // Update local tasks state
      setTasks(prev => ({
        ...prev,
        [taskId]: {
          ...prev[taskId],
          hard_deadline: deadlineDayIndex,
        }
      }));
      playSound('milestoneMove');

      pushAction({
        description: 'Set deadline',
        undo: async () => {
          await set_task_deadline(projectId, taskId, oldDeadline);
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], hard_deadline: oldDeadline } }));
        },
        redo: async () => {
          await set_task_deadline(projectId, taskId, deadlineDayIndex);
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], hard_deadline: deadlineDayIndex } }));
        },
      });
    } catch (err) {
      console.error("Failed to set deadline:", err);
    }
  }, [projectId, setTasks, pushAction]);

  // Collapse all teams
  const collapseAllTeams = useCallback(() => {
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], collapsed: true };
      }
      return updated;
    });
    playSound('collapse');
  }, [teamOrder, setTeamDisplaySettings]);

  // Expand all teams
  const expandAllTeams = useCallback(() => {
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], collapsed: false };
      }
      return updated;
    });
    // Also un-hide all tasks in all teams
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        const team = teams[teamId];
        if (team) {
          for (const taskId of team.tasks) {
            updated[taskId] = { ...updated[taskId], hidden: false };
          }
        }
      }
      return updated;
    });
    playSound('collapse');
  }, [teamOrder, teams, setTeamDisplaySettings, setTaskDisplaySettings]);

  // Show all tasks in a team
  const showAllTeamTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], hidden: false };
      }
      return updated;
    });
    // Un-collapse team since tasks are visible again
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], collapsed: false }
    }));
  };

  // Show all hidden teams
  const showAllHiddenTeams = () => {
    playSound('collapse');
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], hidden: false };
      }
      return updated;
    });
    // Also show all hidden tasks
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of Object.keys(prev)) {
        updated[taskId] = { ...updated[taskId], hidden: false };
      }
      return updated;
    });
  };

  return (
    <>
      <DependencyModals
        // Day Purpose Modal
        dayPurposeModal={dayPurposeModal}
        setDayPurposeModal={setDayPurposeModal}
        dayLabels={dayLabels}
        newDayPurpose={newDayPurpose}
        setNewDayPurpose={setNewDayPurpose}
        newDayPurposeTeams={newDayPurposeTeams}
        setNewDayPurposeTeams={setNewDayPurposeTeams}
        handleSaveDayPurpose={handleSaveDayPurpose}
        handleClearDayPurpose={handleClearDayPurpose}
        teamOrder={teamOrder}
        allTeams={teams}
        // Create Team Modal
        showCreateTeamModal={showCreateTeamModal}
        setShowCreateTeamModal={setShowCreateTeamModal}
        newTeamName={newTeamName}
        setNewTeamName={setNewTeamName}
        newTeamColor={newTeamColor}
        setNewTeamColor={setNewTeamColor}
        isCreating={isCreating}
        handleCreateTeam={handleCreateTeam}
        // Create Task Modal
        showCreateTaskModal={showCreateTaskModal}
        setShowCreateTaskModal={setShowCreateTaskModal}
        newTaskName={newTaskName}
        setNewTaskName={setNewTaskName}
        newTaskTeamId={newTaskTeamId}
        setNewTaskTeamId={setNewTaskTeamId}
        teams={teams}
        handleCreateTask={handleCreateTask}
        // Move Modal
        moveModal={moveModal}
        setMoveModal={setMoveModal}
        handleConfirmMove={handleConfirmMove}
        // Milestone Create Modal
        milestoneCreateModal={milestoneCreateModal}
        setMilestoneCreateModal={setMilestoneCreateModal}
        tasks={tasks}
        confirmMilestoneCreate={confirmMilestoneCreate}
        // Delete Confirm Modal
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        handleConfirmDelete={handleConfirmDelete}
        // Weak dep conflict modal
        weakDepModal={weakDepModal}
        setWeakDepModal={setWeakDepModal}
        handleWeakDepConvert={handleWeakDepConvert}
        handleWeakDepBlock={(modalData) => {
          // Close modal first so visual feedback is visible
          setWeakDepModal(null);

          // Auto-select blocking milestones (same as strong dep behavior)
          if (autoSelectBlocking && modalData) {
            const blockIds = modalData.blockingMilestoneIds || [];
            const moveOrResizeIds = modalData.milestonesToMove || modalData.milestonesToResize || [];
            setSelectedMilestones(prev => {
              const newSet = new Set(prev);
              for (const mId of moveOrResizeIds) newSet.add(mId);
              for (const bId of blockIds) newSet.add(bId);
              return newSet;
            });
          }

          // Show blocking feedback after modal closes (delay so modal is visually gone)
          if (modalData) {
            const blockIds = modalData.blockingMilestoneIds || [];
            const weakConns = modalData.weakConnections || [];
            setTimeout(() => {
              for (let i = 0; i < blockIds.length; i++) {
                showBlockingFeedback(blockIds[i], weakConns[i]);
              }
            }, 50);
          }
        }}
        // Connection edit modal
        connectionEditModal={connectionEditModal}
        setConnectionEditModal={setConnectionEditModal}
        handleUpdateConnection={handleUpdateConnection}
        // Suggestion offer modal
        suggestionOfferModal={suggestionOfferModal}
        setSuggestionOfferModal={setSuggestionOfferModal}
        handleSuggestionOfferAccept={handleSuggestionOfferAccept}
        // Phase modal
        phaseEditModal={phaseEditModal}
        setPhaseEditModal={setPhaseEditModal}
        handleCreatePhase={handleCreatePhase}
        handleUpdatePhase={handleUpdatePhase}
        handleDeletePhase={handleDeletePhase}
        days={days}
        // Phase extra context
        projectStartDate={projectStartDate}
        phases={phases}
      />

      {/* Team Settings Dropdown - Rendered outside the transformed container */}
      {openTeamSettings && teams[openTeamSettings] && (() => {
        const btn = document.getElementById(`team-settings-btn-${openTeamSettings}`);
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const team_key = openTeamSettings;
        
        return (
          <div 
            className="fixed w-48 rounded-lg border border-slate-200 bg-white shadow-xl"
            style={{
              top: `${rect.bottom + 4}px`,
              left: `${rect.left}px`,
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 space-y-1">
              {/* Collapse/Expand all tasks (only when team is not collapsed) */}
              {!isTeamCollapsed(team_key) && (
                <button
                  onClick={() => {
                    allVisibleTasksSmall(team_key) ? setTeamTasksNormal(team_key) : setTeamTasksSmall(team_key);
                    setOpenTeamSettings(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
                >
                  {allVisibleTasksSmall(team_key) ? (
                    <>
                      <UnfoldMoreIcon style={{ fontSize: 14 }} />
                      <span>Expand all tasks</span>
                    </>
                  ) : (
                    <>
                      <UnfoldLessIcon style={{ fontSize: 14 }} />
                      <span>Collapse all tasks</span>
                    </>
                  )}
                </button>
              )}
              
              {/* Show hidden tasks - only when not collapsed */}
              {!isTeamCollapsed(team_key) && teamHasHiddenTasks(team_key) && (
                <button
                  onClick={() => {
                    showAllTeamTasks(team_key);
                    setOpenTeamSettings(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left text-blue-700"
                >
                  <VisibilityIcon style={{ fontSize: 14 }} />
                  <span>Show hidden tasks</span>
                </button>
              )}

              {/* Toggle team phase row */}
              {!isTeamCollapsed(team_key) && teamPhasesMap[team_key]?.length > 0 && (
                <button
                  onClick={() => {
                    // If globally hidden, un-hide globally and add all OTHER teams to collapsed set
                    if (collapseAllTeamPhases) {
                      const allTeamIds = Object.keys(teamPhasesMap).filter(k => teamPhasesMap[k]?.length > 0).map(Number);
                      const newSet = new Set(allTeamIds.filter(id => id !== (typeof team_key === 'string' ? parseInt(team_key, 10) : team_key)));
                      setCollapsedTeamPhaseRows(newSet);
                      setCollapseAllTeamPhases(false);
                    } else {
                      setCollapsedTeamPhaseRows(prev => {
                        const next = new Set(prev);
                        if (next.has(team_key)) next.delete(team_key);
                        else next.add(team_key);
                        return next;
                      });
                    }
                    setOpenTeamSettings(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
                >
                  {(collapseAllTeamPhases || collapsedTeamPhaseRows.has(team_key)) ? (
                    <>
                      <VisibilityIcon style={{ fontSize: 14 }} />
                      <span>Show team phases</span>
                    </>
                  ) : (
                    <>
                      <VisibilityOffIcon style={{ fontSize: 14 }} />
                      <span>Hide team phases</span>
                    </>
                  )}
                </button>
              )}
              
              <div className="border-t border-slate-100 my-1" />
              
              {/* Hide Team */}
              <button
                onClick={() => {
                  toggleTeamVisibility(team_key);
                  setOpenTeamSettings(null);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-red-50 transition text-left text-red-700"
              >
                <VisibilityOffIcon style={{ fontSize: 14 }} />
                <span>Hide team</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Warning Toast */}
      <DependencyWarningToast
        warningMessages={warningMessages}
      />

      {/* Page wrapper */}
      <div 
        className="p-10 w-full min-w-0 select-none"
        style={{
          background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
          ...(viewTransition === 'out' ? {
            transition: 'transform 0.2s ease-in, opacity 0.2s ease-in',
            transform: 'translateX(-50px)',
            opacity: 0,
          } : viewTransition === 'in-start' ? {
            // Positioned off-screen right, no transition yet
            transform: 'translateX(50px)',
            opacity: 0,
          } : viewTransition === 'in' ? {
            transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
            transform: 'translateX(0)',
            opacity: 1,
          } : {}),
        }}
        onClick={() => {
          if (justDraggedRef.current) return;
          setSelectedConnections([]);
          setOpenTeamSettings(null);
          setShowSettingsDropdown(false);
          setShowFilterDropdown(false);
          setSelectedMilestones(new Set());
          setIsAddingMilestone(false);
          setPopupCloseSignal(c => c + 1);
        }}
      >
        {/* Tab buttons sitting above toolbar */}
        <div className="mb-4">
          <div className="flex items-end gap-0.5 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); setToolbarCollapsed(!toolbarCollapsed); playSound('uiClick'); }}
              className="px-3 py-1 flex items-center gap-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-xs transition"
              title={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
            >
              {toolbarCollapsed ? <UnfoldMoreIcon style={{ fontSize: 14 }} /> : <UnfoldLessIcon style={{ fontSize: 14 }} />}
              <span className="text-[10px]">{toolbarCollapsed ? 'Show' : 'Hide'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setHeaderCollapsed(!headerCollapsed); playSound('uiClick'); }}
              className={`px-3 py-1 flex items-center gap-1 rounded-t-md border border-b-0 text-xs transition ${
                headerCollapsed
                  ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title={headerCollapsed ? 'Show header' : 'Hide header'}
            >
              <VerticalAlignTopIcon style={{ fontSize: 14 }} />
              <span className="text-[10px]">Header</span>
            </button>
            {toolbarCollapsed && (
              <span className="ml-2 text-[11px] text-slate-400 pb-0.5">{activeViewName}</span>
            )}
          </div>

          {!toolbarCollapsed && (
        <DependencyToolbar
          // Data
          teamOrder={teamOrder}
          teams={teams}
          // Filter state
          teamDisplaySettings={teamDisplaySettings}
          setTeamDisplaySettings={setTeamDisplaySettings}
          showFilterDropdown={showFilterDropdown}
          setShowFilterDropdown={setShowFilterDropdown}
          // View mode
          viewMode={viewMode}
          setViewMode={setViewMode}
          mode={mode}
          baseViewModeRef={baseViewModeRef}
          // Auto-select
          autoSelectBlocking={autoSelectBlocking}
          setAutoSelectBlocking={setAutoSelectBlocking}
          // Warning settings
          warningDuration={warningDuration}
          setWarningDuration={setWarningDuration}
          // Settings dropdown
          showSettingsDropdown={showSettingsDropdown}
          setShowSettingsDropdown={setShowSettingsDropdown}
          // Visibility settings
          hideAllDependencies={hideAllDependencies}
          setHideAllDependencies={setHideAllDependencies}
          hideCollapsedDependencies={hideCollapsedDependencies}
          setHideCollapsedDependencies={setHideCollapsedDependencies}
          hideCollapsedMilestones={hideCollapsedMilestones}
          setHideCollapsedMilestones={setHideCollapsedMilestones}
          showEmptyTeams={showEmptyTeams}
          setShowEmptyTeams={setShowEmptyTeams}
          // Dimension settings
          customDayWidth={customDayWidth}
          setCustomDayWidth={setCustomDayWidth}
          customTaskHeightNormal={customTaskHeightNormal}
          setCustomTaskHeightNormal={setCustomTaskHeightNormal}
          customTaskHeightSmall={customTaskHeightSmall}
          setCustomTaskHeightSmall={setCustomTaskHeightSmall}
          setShowCreateTeamModal={setShowCreateTeamModal}
          setShowCreateTaskModal={setShowCreateTaskModal}
          setNewTaskTeamId={setNewTaskTeamId}
          isAddingMilestone={isAddingMilestone}
          setIsAddingMilestone={setIsAddingMilestone}
          safeMode={safeMode}
          hiddenTeamCount={hiddenTeamCount}
          isTeamVisible={isTeamVisible}
          setTeamTasksSmall={setTeamTasksSmall}
          setTeamTasksNormal={setTeamTasksNormal}
          showAllHiddenTeams={showAllHiddenTeams}
          // Selection state for delete
          selectedMilestones={selectedMilestones}
          selectedConnections={selectedConnections}

          onDeleteSelected={handleDeleteSelected}
          onBulkUpdateConnections={handleBulkUpdateConnections}
          // Refactor mode
          refactorMode={refactorMode}
          setRefactorMode={setRefactorMode}
          // Expanded task view (Gantt)
          expandedTaskView={expandedTaskView}
          setExpandedTaskView={setExpandedTaskView}
          // Collapse/expand all teams
          collapseAllTeams={collapseAllTeams}
          expandAllTeams={expandAllTeams}
          // Dependency display settings
          depSettings={depSettings}
          setDepSettings={setDepSettings}
          // Connection edit
          connections={connections}
          handleUpdateConnection={handleUpdateConnection}
          setConnectionEditModal={setConnectionEditModal}
          // Day selection & collapse
          selectedDays={selectedDays}
          collapsedDays={collapsedDays}
          collapseSelectedDays={collapseSelectedDays}
          uncollapseAll={uncollapseAll}
          clearDaySelection={clearDaySelection}
          // Phases
          phases={phases}
          setPhaseEditModal={setPhaseEditModal}
          showPhaseColorsInGrid={showPhaseColorsInGrid}
          setShowPhaseColorsInGrid={setShowPhaseColorsInGrid}
          // Team phase row controls
          collapsedTeamPhaseRows={collapsedTeamPhaseRows}
          collapseAllTeamPhases={collapseAllTeamPhases}
          showAllTeamPhases={showAllTeamPhases}
          hideAllTeamPhases={hideAllTeamPhases}
          teamPhasesMap={teamPhasesMap}
          // Views
          savedViews={savedViews}
          activeViewId={activeViewId}
          activeViewName={activeViewName}
          onLoadView={handleLoadView}
          onSaveView={handleSaveView}
          onCreateView={handleCreateView}
          onRenameView={handleRenameView}
          onDeleteView={handleDeleteView}
          onSetDefaultView={handleSetDefaultView}
          onUpdateViewShortcut={handleUpdateViewShortcut}
          // Snapshots
          snapshots={snapshots}
          snapshotsLoading={snapshotsLoading}
          onCreateSnapshot={handleCreateSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
          onRenameSnapshot={handleRenameSnapshot}
          // Layout visibility
          hideGlobalPhases={hideGlobalPhases}
          setHideGlobalPhases={setHideGlobalPhases}
          // Sound toggle
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          // Day header toggle
          hideDayHeader={hideDayHeader}
          setHideDayHeader={setHideDayHeader}
          // Fullscreen
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          // State indicators
          allTasksSmall={teamOrder.every(tid => {
            if (!isTeamVisible(tid)) return true;
            const team = teams[tid];
            if (!team) return true;
            const visible = team.tasks.filter(t => isTaskVisible(t, taskDisplaySettings));
            return visible.length === 0 || visible.every(t => taskDisplaySettings[t]?.size === 'small');
          })}
          allTeamsCollapsed={teamOrder.every(tid => !isTeamVisible(tid) || teamDisplaySettings[tid]?.collapsed)}
          // Popup close signal
          popupCloseSignal={popupCloseSignal}
          // User shortcuts
          userShortcuts={userShortcuts}
          onSaveShortcuts={handleSaveShortcuts}
        />
          )}
        </div>

        <DependencyCanvas
          // Refs
          teamContainerRef={teamContainerRef}
          // Data
          teamOrder={teamOrder}
          teams={teams}
          tasks={tasks}
          milestones={milestones}
          connections={connections}
          dayLabels={dayLabels}
          phases={phases}
          // Layout helpers
          isTeamVisible={isTeamVisible}
          isTeamCollapsed={isTeamCollapsed}
          getVisibleTeamIndex={getVisibleTeamIndex}
          getTeamHeight={getTeamHeight}
          getRawTeamHeight={getRawTeamHeight}
          getVisibleTasks={getVisibleTasks}
          getTaskHeight={getTaskHeight}
          getTeamYOffset={getTeamYOffset}
          getTaskYOffset={getTaskYOffset}
          getTaskDropIndicatorY={getTaskDropIndicatorY}
          getMilestoneHandlePosition={getMilestoneHandlePosition}
          // Constants
          TEAMWIDTH={TEAMWIDTH}
          TASKWIDTH={TASKWIDTH}
          DAYWIDTH={DAYWIDTH}
          COLLAPSED_DAY_WIDTH={COLLAPSED_DAY_WIDTH}
          TEAM_DRAG_HIGHLIGHT_HEIGHT={TEAM_DRAG_HIGHLIGHT_HEIGHT}
          MARIGN_BETWEEN_DRAG_HIGHLIGHT={MARIGN_BETWEEN_DRAG_HIGHLIGHT}
          TEAM_HEADER_LINE_HEIGHT={TEAM_HEADER_LINE_HEIGHT}
          TEAM_HEADER_GAP={TEAM_HEADER_GAP}
          // Day column layout
          dayColumnLayout={dayColumnLayout}
          // Dimensions
          days={days}
          contentHeight={contentHeight}
          // Display settings
          taskDisplaySettings={taskDisplaySettings}
          teamDisplaySettings={teamDisplaySettings}
          hideAllDependencies={hideAllDependencies}
          hideCollapsedDependencies={hideCollapsedDependencies}
          hideCollapsedMilestones={hideCollapsedMilestones}
          // Day selection / collapse
          selectedDays={selectedDays}
          collapsedDays={collapsedDays}
          onDaySelect={handleDaySelect}
          onUncollapseDays={uncollapseDays}
          // UI state
          hoveredMilestone={hoveredMilestone}
          selectedMilestones={selectedMilestones}
          selectedConnections={selectedConnections}
          editingMilestoneId={editingMilestoneId}
          editingMilestoneName={editingMilestoneName}
          blockedMoveHighlight={blockedMoveHighlight}
          viewMode={viewMode}
          mode={mode}
          safeMode={safeMode}
          // Transient state
          ghost={ghost}
          dropIndex={dropIndex}
          taskGhost={taskGhost}
          taskDropTarget={taskDropTarget}
          isDraggingConnection={isDraggingConnection}
          connectionStart={connectionStart}
          connectionEnd={connectionEnd}
          openTeamSettings={openTeamSettings}
          isAddingMilestone={isAddingMilestone}
          hoveredDayCell={hoveredDayCell}
          visibleTeamCount={visibleTeamCount}
          hiddenTeamCount={hiddenTeamCount}
          // Handlers
          handleDayHeaderClick={handleDayHeaderClick}
          handleTeamDrag={handleTeamDrag}
          handleTaskDrag={handleTaskDrag}
          handleConnectionClick={handleConnectionClick}
          handleMileStoneMouseDown={handleMileStoneMouseDown}
          handleMilestoneClick={handleMilestoneClick}
          handleMilestoneEdgeResize={handleMilestoneEdgeResize}
          handleConnectionDragStart={handleConnectionDragStart}
          handleMilestoneRenameSubmit={handleMilestoneRenameSubmit}
          handleDayCellClick={handleDayCellClick}
          toggleTaskSize={toggleTaskSize}
          toggleTaskVisibility={toggleTaskVisibility}
          toggleTeamCollapsed={toggleTeamCollapsed}
          addMilestoneLocal={addMilestoneLocal}
          showAllHiddenTeams={showAllHiddenTeams}
          toggleTeamVisibility={toggleTeamVisibility}
          handleColumnResize={handleColumnResize}
          // Setters
          setHoveredMilestone={setHoveredMilestone}
          setEditingMilestoneName={setEditingMilestoneName}
          setEditingMilestoneId={setEditingMilestoneId}
          setDeleteConfirmModal={setDeleteConfirmModal}
          setOpenTeamSettings={setOpenTeamSettings}
          setHoveredDayCell={setHoveredDayCell}
          marqueeRect={marqueeRect}
          handleMarqueeStart={handleMarqueeStart}
          // Refactor mode
          refactorMode={refactorMode}
          handleRefactorDrag={handleRefactorDrag}
          // Expanded task view (Gantt)
          expandedTaskView={expandedTaskView}
          // Deadline
          onSetDeadline={handleSetDeadline}
          // Dependency display settings
          depSettings={depSettings}
          setConnectionEditModal={setConnectionEditModal}
          // Phase
          setPhaseEditModal={setPhaseEditModal}
          handlePhaseEdgeResize={handlePhaseEdgeResize}
          handlePhaseDrag={handlePhaseDrag}
          // Phase colors in grid
          showPhaseColorsInGrid={showPhaseColorsInGrid}
          // Team phase rows
          teamPhasesMap={teamPhasesMap}
          getTeamPhaseRowHeight={getTeamPhaseRowHeight}
          collapsedTeamPhaseRows={collapsedTeamPhaseRows}
          setCollapsedTeamPhaseRows={setCollapsedTeamPhaseRows}
          collapsePhaseRange={collapsePhaseRange}
          focusOnPhase={focusOnPhase}
          // Layout visibility
          hideGlobalPhases={hideGlobalPhases}
          hideDayHeader={hideDayHeader}
        />
      </div>

      {/* Refactor mode: floating ghost card follows cursor */}
      {refactorGhost && (
        <div
          id="refactor-ghost"
          style={{
            position: "fixed",
            left: refactorGhost.x + 14,
            top: refactorGhost.y - 10,
            zIndex: 99999,
            pointerEvents: "none",
            transition: "background-color 0.15s, border-color 0.15s",
          }}
          className={`px-3 py-2 rounded-lg shadow-lg border-2 text-xs font-semibold max-w-[200px] truncate ${
            refactorGhost.overIdeaBin
              ? "bg-yellow-100 border-yellow-500 text-yellow-800"
              : refactorGhost.overCell
              ? "bg-blue-100 border-blue-500 text-blue-800"
              : "bg-white border-slate-300 text-slate-700"
          }`}
        >
          {refactorGhost.overIdeaBin ? "💡 " : ""}
          {refactorGhost.type === "team" && `🏢 ${refactorGhost.name}`}
          {refactorGhost.type === "task" && `📋 ${refactorGhost.name}`}
          {refactorGhost.type === "milestone" && `🏁 ${refactorGhost.name}`}
          {refactorGhost.overIdeaBin && (
            <div className="text-[10px] font-normal text-yellow-600 mt-0.5">Drop to create idea</div>
          )}
          {refactorGhost.overCell && refactorGhost.type === "milestone" && (
            <div className="text-[10px] font-normal text-blue-600 mt-0.5">Drop to move here</div>
          )}
        </div>
      )}

      {/* Refactor mode active: pulsing banner */}
      {refactorMode && (
        <div
          style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 99998 }}
          className="px-4 py-2 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg animate-pulse flex items-center gap-2"
        >
          <span>🔧 Refactor Mode</span>
          <span className="font-normal opacity-80">— drag items to IdeaBin or cells</span>
          <button
            onClick={() => { setRefactorMode(false); playSound('refactorToggle'); }}
            className="ml-2 px-2 py-0.5 rounded bg-orange-700 hover:bg-orange-800 text-white text-[10px] font-semibold"
          >
            Exit
          </button>
        </div>
      )}

      {/* View name flash overlay */}
      {viewFlashName && (
        <div
          key={viewFlashName.key}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99999,
            pointerEvents: 'none',
            animation: 'viewFlashFade 1.2s ease-out forwards',
          }}
          className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-sm text-white text-2xl font-bold tracking-wide shadow-2xl"
        >
          {viewFlashName.name}
        </div>
      )}
    </>
  );
}
