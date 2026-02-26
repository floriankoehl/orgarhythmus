import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useDayManagement } from './useDayManagement';
import { useDisplaySettings } from './useDisplaySettings';
import { usePhaseManagement } from './usePhaseManagement';
import { useViewManagement } from './useViewManagement';
import { useSnapshotManagement } from './useSnapshotManagement';
import { update_start_index, get_user_shortcuts, save_user_shortcuts, move_milestone_task } from '../../api/dependencies_api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import DependencyToolbar from '../../components/dependencies/DependencyToolbar';
import DependencyModals from '../../components/dependencies/DependencyModals';
import DependencyCanvas from '../../components/dependencies/DependencyCanvas';
import DependencyWarningToast from '../../components/dependencies/DependencyWarningToast';
import SafetyCheckPanel from '../../components/dependencies/SafetyCheckPanel';
import DependencyTaskSelectionBar from '../../components/dependencies/DependencyTaskSelectionBar';
import { useSafetyCheck } from './useSafetyCheck';
import { DependencyProvider, useDependency } from './DependencyContext.jsx';
import { playSound, setMuted } from '../../assets/sound_registry';
import { bulk_import_dependencies } from '../../api/dependencies_api';

export default function Dependencies() {
  return (
    <DependencyProvider>
      <DependenciesContent />
    </DependencyProvider>
  );
}

function DependenciesContent() {

  const { projectId, teamContainerRef, pushAction, selectedTasks, setSelectedTasks } = useDependency();
  const navigate = useNavigate();

  // Secret shortcut: press 0 + 9 together to open 3D view
  const heldRef = useRef(new Set());
  useEffect(() => {
    const down = (e) => {
      if (e.key === '0' || e.key === '9') heldRef.current.add(e.key);
      if (heldRef.current.has('0') && heldRef.current.has('9')) {
        navigate(`/projects/${projectId}/assignment`);
      }
    };
    const up = (e) => heldRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [projectId, navigate]);

  // ________Data Hook___________
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

  // Listen for IdeaBin refresh events
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
    resizeAllSelected,
    setResizeAllSelected,
    warningDuration,
    setWarningDuration,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  } = useDependencyUIState();

  // Team settings dropdown
  const [openTeamSettings, setOpenTeamSettings] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [hoveredDayCell, setHoveredDayCell] = useState(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [milestoneCreateModal, setMilestoneCreateModal] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#facc15");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTeamId, setNewTaskTeamId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [hideCollapsedDependencies, setHideCollapsedDependencies] = useState(false);
  const [hideCollapsedMilestones, setHideCollapsedMilestones] = useState(false);
  const [customDayWidth, setCustomDayWidth] = useState(DEFAULT_DAYWIDTH);
  const [customTaskHeightNormal, setCustomTaskHeightNormal] = useState(DEFAULT_TASKHEIGHT_NORMAL);
  const [customTaskHeightSmall, setCustomTaskHeightSmall] = useState(DEFAULT_TASKHEIGHT_SMALL);
  const [hideAllDependencies, setHideAllDependencies] = useState(false);
  const [showEmptyTeams, setShowEmptyTeams] = useState(true);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [expandedTaskView, setExpandedTaskView] = useState(false);
  const [showPhaseColorsInGrid, setShowPhaseColorsInGrid] = useState(true);
  const [depSettings, setDepSettings] = useState({ ...DEFAULT_DEP_SETTINGS });
  const [connectionEditModal, setConnectionEditModal] = useState(null);
  const [suggestionOfferModal, setSuggestionOfferModal] = useState(null);
  const [dayPurposeModal, setDayPurposeModal] = useState(null);
  const [newDayPurpose, setNewDayPurpose] = useState("");
  const [newDayPurposeTeams, setNewDayPurposeTeams] = useState(null);
  const [phaseEditModal, setPhaseEditModal] = useState(null);
  const [collapsedTeamPhaseRows, setCollapsedTeamPhaseRows] = useState(new Set());
  const [collapseAllTeamPhases, setCollapseAllTeamPhases] = useState(false);
  const [teamColumnWidth, setTeamColumnWidth] = useState(DEFAULT_TEAMWIDTH_CONSTANT);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASKWIDTH_CONSTANT);
  const [hideGlobalPhases, setHideGlobalPhases] = useState(DEFAULT_HIDE_GLOBAL_PHASES);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(DEFAULT_TOOLBAR_COLLAPSED);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hideDayHeader, setHideDayHeader] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [popupCloseSignal, setPopupCloseSignal] = useState(0);
  const [mode, setMode] = useState("drag");
  const safeMode = viewMode === "inspection";
  const [refactorMode, setRefactorMode] = useState(false);
  const [refactorGhost, setRefactorGhost] = useState(null);
  const refactorDragging = useRef(false);

  // __ User shortcuts __
  const [userShortcuts, setUserShortcuts] = useState({});
  useEffect(() => {
    get_user_shortcuts().then(data => setUserShortcuts(data.shortcuts || {})).catch(() => {});
  }, []);
  const handleSaveShortcuts = useCallback((shortcuts) => {
    setUserShortcuts(shortcuts);
    save_user_shortcuts(shortcuts).catch(() => {});
  }, []);

  // __ Fullscreen sync __
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

  // __ Header collapse DOM effect __
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

  // __ Sync sound mute state __
  useEffect(() => { setMuted(!soundEnabled); }, [soundEnabled]);

  // Dynamic constants
  const DAYWIDTH = customDayWidth;
  const TEAMWIDTH = teamColumnWidth;
  const TASKWIDTH = taskColumnWidth;
  const TASKHEIGHT_NORMAL = customTaskHeightNormal;
  const TASKHEIGHT_SMALL = customTaskHeightSmall;
  const COLLAPSED_DAY_WIDTH = 6;

  // __ Day Management __
  const {
    selectedDays,
    setSelectedDays,
    collapsedDays,
    setCollapsedDays,
    handleDaySelect,
    clearDaySelection,
    collapseSelectedDays,
    uncollapseDays,
    uncollapseAll,
    collapsePhaseRange,
    focusOnPhase,
  } = useDayManagement(days);

  // __ Display Settings __
  const {
    toggleTaskSize,
    setTeamTasksSmall,
    setTeamTasksNormal,
    toggleTaskVisibility,
    showAllTeamTasks,
    toggleTeamVisibility,
    showAllHiddenTeams,
    toggleTeamCollapsed,
    collapseAllTeams,
    expandAllTeams,
    allVisibleTasksSmall,
    teamHasHiddenTasks,
  } = useDisplaySettings({
    teams,
    teamOrder,
    taskDisplaySettings,
    setTaskDisplaySettings,
    teamDisplaySettings,
    setTeamDisplaySettings,
  });

  // __ collectViewState & applyViewState (must access all local state) __
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
    resizeAllSelected,
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
    autoSelectBlocking, warningDuration, resizeAllSelected, refactorMode,
    hideGlobalPhases, toolbarCollapsed, headerCollapsed,
    soundEnabled, hideDayHeader, isFullscreen,
  ]);

  const applyViewState = useCallback((state) => {
    if (!state) return;
    const d = getDefaultViewState();

    // Clear transient UI state so view switch starts clean
    setSelectedMilestones(new Set());
    setSelectedConnections([]);
    setIsAddingMilestone(false);
    setShowFilterDropdown(false);
    setShowSettingsDropdown(false);
    setOpenTeamSettings(null);
    setPopupCloseSignal(c => c + 1);

    // Replace (not merge) display settings so that loading a view fully
    // restores the filter/collapse state it was saved with.
    // Teams/tasks that exist now but weren't in the saved view default to
    // visible & uncollapsed / normal-size so nothing is accidentally hidden.
    const savedTask = state.taskDisplaySettings || {};
    setTaskDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) {
        next[id] = savedTask[id]
          ? { ...savedTask[id] }
          : { size: 'normal', hidden: false };
      }
      // Also include entries in the saved state that aren't in prev
      // (e.g. task existed when view was saved but was since re-created with same id)
      for (const id of Object.keys(savedTask)) {
        if (!(id in next)) next[id] = { ...savedTask[id] };
      }
      return next;
    });
    const savedTeam = state.teamDisplaySettings || {};
    setTeamDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) {
        next[id] = savedTeam[id]
          ? { ...savedTeam[id] }
          : { hidden: false, collapsed: false };
      }
      for (const id of Object.keys(savedTeam)) {
        if (!(id in next)) next[id] = { ...savedTeam[id] };
      }
      return next;
    });
    const vm = state.viewMode ?? d.viewMode;
    setViewMode(vm);
    baseViewModeRef.current = vm;
    setMode(state.mode ?? d.mode);
    setCollapsedDays(new Set(state.collapsedDays ?? d.collapsedDays));
    setSelectedDays(new Set(state.selectedDays ?? d.selectedDays));
    setDepSettings({ ...d.depSettings, ...(state.depSettings ?? {}) });
    setShowPhaseColorsInGrid(state.showPhaseColorsInGrid ?? d.showPhaseColorsInGrid);
    setExpandedTaskView(state.expandedTaskView ?? d.expandedTaskView);
    setHideAllDependencies(state.hideAllDependencies ?? d.hideAllDependencies);
    setHideCollapsedDependencies(state.hideCollapsedDependencies ?? d.hideCollapsedDependencies);
    setHideCollapsedMilestones(state.hideCollapsedMilestones ?? d.hideCollapsedMilestones);
    setShowEmptyTeams(state.showEmptyTeams ?? d.showEmptyTeams);
    setCustomDayWidth(state.customDayWidth ?? d.customDayWidth);
    setCustomTaskHeightNormal(state.customTaskHeightNormal ?? d.customTaskHeightNormal);
    setCustomTaskHeightSmall(state.customTaskHeightSmall ?? d.customTaskHeightSmall);
    setTeamColumnWidth(state.teamColumnWidth ?? d.teamColumnWidth);
    setTaskColumnWidth(state.taskColumnWidth ?? d.taskColumnWidth);
    setCollapsedTeamPhaseRows(new Set(state.collapsedTeamPhaseRows ?? d.collapsedTeamPhaseRows));
    setCollapseAllTeamPhases(state.collapseAllTeamPhases ?? d.collapseAllTeamPhases);
    setAutoSelectBlocking(state.autoSelectBlocking ?? d.autoSelectBlocking);
    setResizeAllSelected(state.resizeAllSelected ?? d.resizeAllSelected);
    setWarningDuration(state.warningDuration ?? d.warningDuration);
    setRefactorMode(state.refactorMode ?? d.refactorMode);
    setHideGlobalPhases(state.hideGlobalPhases ?? d.hideGlobalPhases);
    setToolbarCollapsed(state.toolbarCollapsed ?? d.toolbarCollapsed);
    setHeaderCollapsed(state.headerCollapsed ?? d.headerCollapsed);
    setSoundEnabled(state.soundEnabled ?? d.soundEnabled);
    setHideDayHeader(state.hideDayHeader ?? d.hideDayHeader);
    const wantFs = state.isFullscreen ?? d.isFullscreen;
    if (wantFs && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!wantFs && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // All dependencies are stable React state setters (setSelectedMilestones,
  // setSelectedConnections, setIsAddingMilestone, setShowFilterDropdown,
  // setShowSettingsDropdown, setOpenTeamSettings, setPopupCloseSignal,
  // setTaskDisplaySettings, setTeamDisplaySettings, setViewMode, setMode,
  // setCollapsedDays, setSelectedDays, setDepSettings, setShowPhaseColorsInGrid,
  // setExpandedTaskView, setHideAllDependencies, setHideCollapsedDependencies,
  // setHideCollapsedMilestones, setShowEmptyTeams, setCustomDayWidth,
  // setCustomTaskHeightNormal, setCustomTaskHeightSmall, setTeamColumnWidth,
  // setTaskColumnWidth, setCollapsedTeamPhaseRows, setCollapseAllTeamPhases,
  // setAutoSelectBlocking, setResizeAllSelected, setWarningDuration,
  // setRefactorMode, setHideGlobalPhases, setToolbarCollapsed, setHeaderCollapsed,
  // setSoundEnabled, setHideDayHeader) — guaranteed not to change between renders.

  // __ View Management __
  const {
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    activeViewName,
    setActiveViewName,
    viewTransition,
    viewFlashName,
    handleLoadView,
    handleNextView,
    handlePrevView,
    handleSaveView,
    handleCreateView,
    handleRenameView,
    handleDeleteView,
    handleSetDefaultView,
  } = useViewManagement({ projectId, collectViewState, applyViewState });

  // __ Per-user view shortcuts (derived from userShortcuts._viewShortcuts) __
  const viewShortcuts = useMemo(() => {
    return userShortcuts?._viewShortcuts?.[projectId] || {};
  }, [userShortcuts, projectId]);

  const handleUpdateViewShortcut = useCallback((viewId, keys) => {
    // keys = null (remove), ["a"] (one key), or ["a", "b"] (two keys)
    setUserShortcuts(prev => {
      const next = { ...prev };
      const projectMap = { ...(next._viewShortcuts || {}) };
      const viewMap = { ...(projectMap[projectId] || {}) };
      if (!keys || keys.length === 0) {
        delete viewMap[viewId];
      } else {
        viewMap[viewId] = keys;
      }
      projectMap[projectId] = viewMap;
      next._viewShortcuts = projectMap;
      save_user_shortcuts(next).catch(() => {});
      return next;
    });
    playSound('uiClick');
  }, [projectId]);

  // __ Snapshot Management __
  const {
    snapshots,
    setSnapshots,
    snapshotsLoading,
    handleCreateSnapshot,
    handleQuickSaveSnapshot,
    handleRestoreSnapshot,
    handleDeleteSnapshot,
    handleRenameSnapshot,
  } = useSnapshotManagement({
    projectId,
    setReloadData,
    applyViewState,
    setActiveViewId,
    setActiveViewName,
    setSavedViews,
  });

  // __ Safety Check __
  const {
    isRunning: safetyCheckRunning,
    results: safetyCheckResults,
    showPanel: showSafetyPanel,
    setShowPanel: setShowSafetyPanel,
    runCheck: runSafetyCheck,
  } = useSafetyCheck(projectId);

  // __ Phase Management __
  const {
    phasesRef,
    handleCreatePhase,
    handleUpdatePhase,
    handleDeletePhase,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    wouldPhaseOverlap,
  } = usePhaseManagement({ projectId, phases, setPhases, DAYWIDTH });

  // ___________DAY LABELS______________
  const dayLabels = useMemo(() => {
    if (!projectStartDate || !days) return [];
    const labels = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(projectStartDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const dayOfWeek = date.getDay();
      const isSunday = dayOfWeek === 0;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayNameShort = dayNames[dayOfWeek];
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

  // Layout helpers
  const TEAM_MIN_HEIGHT = TASKHEIGHT_NORMAL;

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

  const getTeamPhaseRowHeight = useCallback((teamId) => {
    const teamIdNum = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
    if (!teamPhasesMap[teamIdNum] || teamPhasesMap[teamIdNum].length === 0) return 0;
    if (collapseAllTeamPhases || collapsedTeamPhaseRows.has(teamIdNum)) return 0;
    return TEAM_PHASE_ROW_HEIGHT;
  }, [teamPhasesMap, collapseAllTeamPhases, collapsedTeamPhaseRows]);

  const getTaskHeight = (taskId, taskDisplaySettings) =>
    getTaskHeightBase(taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);

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

  const visibleTeamCount = teamOrder.filter(tid => isTeamVisible(tid)).length;
  const hiddenTeamCount = teamOrder.filter(tid => !isTeamVisible(tid)).length;

  const PHASE_HEADER_HEIGHT = 26;
  const hasGlobalPhases = globalPhases.length > 0;
  const effectiveHeaderHeight = (hideDayHeader ? 0 : HEADER_HEIGHT) + (hasGlobalPhases && !hideGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const layoutConstants = { HEADER_HEIGHT: effectiveHeaderHeight, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP };

  const contentHeight = useMemo(() => {
    return calculateContentHeight(teamOrder, isTeamVisible, getTeamHeight, layoutConstants);
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, TASKHEIGHT_NORMAL, TASKHEIGHT_SMALL, hasGlobalPhases, hideGlobalPhases, hideDayHeader, phases, collapseAllTeamPhases, collapsedTeamPhaseRows, showEmptyTeams, milestones]);

  const getVisibleTeamIndex = (teamId) =>
    getVisibleTeamIndexBase(teamId, teamOrder, isTeamVisible);

  const getTeamYOffset = (teamId) =>
    getTeamYOffsetBase(teamId, teamOrder, isTeamVisible, getTeamHeight, layoutConstants);

  const getTaskYOffset = (taskId, teamId) =>
    getTaskYOffsetBase(taskId, teams[teamId], isTaskVisible, getTaskHeight, taskDisplaySettings);

  // __ Day column layout __
  const dayColumnLayout = useMemo(() => {
    if (!days) return { dayXOffset: () => 0, dayWidth: () => DAYWIDTH, totalDaysWidth: 0, visibleDayIndices: [], collapsedRanges: [] };
    const offsets = new Array(days);
    const widths = new Array(days);
    const visibleDayIndices = [];
    let x = 0;
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
    return {
      dayXOffset: (dayIndex) => offsets[dayIndex] ?? 0,
      dayWidth: (dayIndex) => widths[dayIndex] ?? DAYWIDTH,
      totalDaysWidth: x,
      visibleDayIndices,
      collapsedRanges,
      offsets,
      widths,
    };
  }, [days, collapsedDays, DAYWIDTH, COLLAPSED_DAY_WIDTH]);

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

  const showAllTeamPhases = useCallback(() => {
    playSound('collapse');
    setCollapsedTeamPhaseRows(new Set());
    setCollapseAllTeamPhases(false);
  }, []);

  const hideAllTeamPhases = useCallback(() => {
    playSound('collapse');
    setCollapseAllTeamPhases(true);
  }, []);

  // ________Interaction Hook___________
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
    warningMessages,
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
    viewShortcuts,
    onLoadView: handleLoadView,
    onSaveView: handleSaveView,
    onNextView: handleNextView,
    onPrevView: handlePrevView,
    refactorMode,
    setRefactorMode,
    setToolbarCollapsed,
    setHeaderCollapsed,
    toggleFullscreen,
    userShortcuts,
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
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    isTeamCollapsed,
    snapshots,
    onQuickSaveSnapshot: handleQuickSaveSnapshot,
    setShowCreateTeamModal,
    setShowCreateTaskModal,
    setPhaseEditModal,
    onLoadDefaultView: () => handleLoadView(null),
  });

  const getTaskDropIndicatorY = () =>
    getTaskDropIndicatorYBase(taskDropTarget, getTeamYOffset, getVisibleTasks, getTaskHeight, taskDisplaySettings, layoutConstants, getTeamPhaseRowHeight);

  // __ Actions Hook (with new params) __
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
    handleSetDeadline,
    handleSuggestionOfferAccept,
    handleBulkUpdateConnections,
    handleWeakDepConvert,
  } = useDependencyActions({
    teams,
    taskDisplaySettings,
    dayPurposeModal,
    milestoneCreateModal,
    moveModal,
    deleteConfirmModal,
    newDayPurpose,
    newDayPurposeTeams,
    newTeamName,
    newTeamColor,
    newTaskName,
    newTaskTeamId,
    setProjectDays,
    setMilestones,
    setTasks,
    setTeams,
    setReloadData,
    setDayPurposeModal,
    setMilestoneCreateModal,
    setMoveModal,
    setDeleteConfirmModal,
    setIsAddingMilestone,
    setNewDayPurpose,
    setNewDayPurposeTeams,
    setNewTeamName,
    setNewTeamColor,
    setNewTaskName,
    setNewTaskTeamId,
    setShowCreateTeamModal,
    setShowCreateTaskModal,
    setIsCreating,
    getVisibleTasks,
    handleDeleteConnection,
    handleMilestoneDelete,
    handleUpdateConnection,
    suggestionOfferModal,
    setSuggestionOfferModal,
    setConnections,
    safeMode,
  });

  // Auto-block weak dep conflicts when prompt disabled
  useEffect(() => {
    if (weakDepModal && !depSettings.weakDepPrompt) {
      const modalData = weakDepModal;
      setWeakDepModal(null);
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
      const blockIds = modalData.blockingMilestoneIds || [];
      const weakConns = modalData.weakConnections || [];
      setTimeout(() => {
        for (let i = 0; i < blockIds.length; i++) {
          showBlockingFeedback(blockIds[i], weakConns[i]);
        }
      }, 50);
    }
  }, [weakDepModal, depSettings.weakDepPrompt, autoSelectBlocking, setSelectedMilestones, setWeakDepModal, showBlockingFeedback]);

  // __ Refactor drag __
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
        window.dispatchEvent(new CustomEvent("dep-refactor-drop", {
          detail: { type, ...payload },
        }));
        setRefactorGhost(null);
        return;
      }

      if (type === 'milestone' && ghost.overCell) {
        const { dayIndex, taskId: targetTaskKey } = ghost.overCell;
        const mId = payload.id;
        const m = milestones[mId];

        if (m && targetTaskKey) {
          const oldTaskKey = m.task;
          const oldStartIndex = m.start_index;
          const duration = m.duration || 1;
          const taskChanged = String(targetTaskKey) !== String(oldTaskKey);

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

          const depResult = validateMilestoneMove(mId, dayIndex);
          if (depResult && !depResult.valid) {
            const strongBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'strong');
            const weakBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'weak');
            const suggestionBlockers = (depResult.allBlocking || []).filter(b => b.weight === 'suggestion');

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

            if (suggestionBlockers.length > 0) {
              addWarning('Suggestion dependency violated', 'This move violates a suggestion dependency, but it is allowed.');
              for (const b of suggestionBlockers) {
                showBlockingFeedback(b.blockingMilestoneId, b.blockingConnection);
              }
            }
          }

          playSound('milestoneMove');
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
          }

          try {
            if (taskChanged) {
              await move_milestone_task(projectId, mId, targetTaskKey);
            }
            if (dayIndex !== oldStartIndex) {
              await update_start_index(projectId, mId, dayIndex);
            }
          } catch (err) {
            console.error("Refactor drag move failed:", err);
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

  // __ Bulk import dependencies handler __
  const handleBulkImportDependencies = useCallback(async (jsonString) => {
    const result = await bulk_import_dependencies(projectId, jsonString);
    // Refresh all data after import
    setReloadData(true);
    setSelectedTasks(new Set());
    return result;
  }, [projectId, setReloadData, setSelectedTasks]);

  // __ Build structured props for DependencyCanvas __
  const layout = {
    isTeamVisible,
    isTeamCollapsed,
    getVisibleTeamIndex,
    getTeamHeight,
    getRawTeamHeight,
    getVisibleTasks,
    getTaskHeight,
    getTeamYOffset,
    getTaskYOffset,
    getTaskDropIndicatorY,
    getMilestoneHandlePosition,
    getTeamPhaseRowHeight,
    TEAMWIDTH,
    TASKWIDTH,
    DAYWIDTH,
    COLLAPSED_DAY_WIDTH,
    TEAM_DRAG_HIGHLIGHT_HEIGHT,
    MARIGN_BETWEEN_DRAG_HIGHLIGHT,
    TEAM_HEADER_LINE_HEIGHT,
    TEAM_HEADER_GAP,
    dayColumnLayout,
  };

  const data = {
    teamOrder,
    teams,
    tasks,
    milestones,
    connections,
    dayLabels,
    phases,
    teamPhasesMap,
  };

  const displayState = {
    taskDisplaySettings,
    teamDisplaySettings,
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    selectedDays,
    collapsedDays,
    hoveredMilestone,
    selectedMilestones,
    selectedConnections,
    editingMilestoneId,
    editingMilestoneName,
    blockedMoveHighlight,
    viewMode,
    mode,
    safeMode,
    ghost,
    dropIndex,
    taskGhost,
    taskDropTarget,
    isDraggingConnection,
    connectionStart,
    connectionEnd,
    openTeamSettings,
    isAddingMilestone,
    hoveredDayCell,
    visibleTeamCount,
    hiddenTeamCount,
    refactorMode,
    expandedTaskView,
    depSettings,
    showPhaseColorsInGrid,
    collapsedTeamPhaseRows,
    hideGlobalPhases,
    hideDayHeader,
    marqueeRect,
  };

  const handlers = {
    handleDayHeaderClick,
    handleTeamDrag,
    handleTaskDrag,
    handleConnectionClick,
    handleMileStoneMouseDown,
    handleMilestoneClick,
    handleMilestoneEdgeResize,
    handleConnectionDragStart,
    handleMilestoneRenameSubmit,
    handleDayCellClick,
    toggleTaskSize,
    toggleTaskVisibility,
    toggleTeamCollapsed,
    addMilestoneLocal,
    showAllHiddenTeams,
    toggleTeamVisibility,
    handleColumnResize,
    setHoveredMilestone,
    setEditingMilestoneName,
    setEditingMilestoneId,
    setDeleteConfirmModal,
    setOpenTeamSettings,
    setHoveredDayCell,
    handleMarqueeStart,
    handleRefactorDrag,
    onSetDeadline: handleSetDeadline,
    setConnectionEditModal,
    setPhaseEditModal,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    setCollapsedTeamPhaseRows,
    collapsePhaseRange,
    focusOnPhase,
    onDaySelect: handleDaySelect,
    onUncollapseDays: uncollapseDays,
  };

  return (
    <>
      <DependencyModals
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
        showCreateTeamModal={showCreateTeamModal}
        setShowCreateTeamModal={setShowCreateTeamModal}
        newTeamName={newTeamName}
        setNewTeamName={setNewTeamName}
        newTeamColor={newTeamColor}
        setNewTeamColor={setNewTeamColor}
        isCreating={isCreating}
        handleCreateTeam={handleCreateTeam}
        showCreateTaskModal={showCreateTaskModal}
        setShowCreateTaskModal={setShowCreateTaskModal}
        newTaskName={newTaskName}
        setNewTaskName={setNewTaskName}
        newTaskTeamId={newTaskTeamId}
        setNewTaskTeamId={setNewTaskTeamId}
        teams={teams}
        handleCreateTask={handleCreateTask}
        moveModal={moveModal}
        setMoveModal={setMoveModal}
        handleConfirmMove={handleConfirmMove}
        milestoneCreateModal={milestoneCreateModal}
        setMilestoneCreateModal={setMilestoneCreateModal}
        tasks={tasks}
        confirmMilestoneCreate={confirmMilestoneCreate}
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        handleConfirmDelete={handleConfirmDelete}
        weakDepModal={weakDepModal}
        setWeakDepModal={setWeakDepModal}
        handleWeakDepConvert={handleWeakDepConvert}
        handleWeakDepBlock={(modalData) => {
          setWeakDepModal(null);
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
        connectionEditModal={connectionEditModal}
        setConnectionEditModal={setConnectionEditModal}
        handleUpdateConnection={handleUpdateConnection}
        suggestionOfferModal={suggestionOfferModal}
        setSuggestionOfferModal={setSuggestionOfferModal}
        handleSuggestionOfferAccept={handleSuggestionOfferAccept}
        phaseEditModal={phaseEditModal}
        setPhaseEditModal={setPhaseEditModal}
        handleCreatePhase={handleCreatePhase}
        handleUpdatePhase={handleUpdatePhase}
        handleDeletePhase={handleDeletePhase}
        days={days}
        projectStartDate={projectStartDate}
        phases={phases}
      />

      {/* Team Settings Dropdown */}
      {openTeamSettings && teams[openTeamSettings] && (() => {
        const btn = document.getElementById(`team-settings-btn-${openTeamSettings}`);
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        const team_key = openTeamSettings;
        return (
          <div
            className="fixed w-48 rounded-lg border border-slate-200 bg-white shadow-xl"
            style={{ top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 9999 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 space-y-1">
              {!isTeamCollapsed(team_key) && (
                <button
                  onClick={() => {
                    allVisibleTasksSmall(team_key) ? setTeamTasksNormal(team_key) : setTeamTasksSmall(team_key);
                    setOpenTeamSettings(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
                >
                  {allVisibleTasksSmall(team_key) ? (
                    <><UnfoldMoreIcon style={{ fontSize: 14 }} /><span>Expand all tasks</span></>
                  ) : (
                    <><UnfoldLessIcon style={{ fontSize: 14 }} /><span>Collapse all tasks</span></>
                  )}
                </button>
              )}
              {!isTeamCollapsed(team_key) && teamHasHiddenTasks(team_key) && (
                <button
                  onClick={() => { showAllTeamTasks(team_key); setOpenTeamSettings(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left text-blue-700"
                >
                  <VisibilityIcon style={{ fontSize: 14 }} />
                  <span>Show hidden tasks</span>
                </button>
              )}
              {!isTeamCollapsed(team_key) && teamPhasesMap[team_key]?.length > 0 && (
                <button
                  onClick={() => {
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
                    <><VisibilityIcon style={{ fontSize: 14 }} /><span>Show team phases</span></>
                  ) : (
                    <><VisibilityOffIcon style={{ fontSize: 14 }} /><span>Hide team phases</span></>
                  )}
                </button>
              )}
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { toggleTeamVisibility(team_key); setOpenTeamSettings(null); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-red-50 transition text-left text-red-700"
              >
                <VisibilityOffIcon style={{ fontSize: 14 }} />
                <span>Hide team</span>
              </button>
            </div>
          </div>
        );
      })()}

      <DependencyWarningToast warningMessages={warningMessages} />

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
              teamOrder={teamOrder}
              teams={teams}
              teamDisplaySettings={teamDisplaySettings}
              setTeamDisplaySettings={setTeamDisplaySettings}
              showFilterDropdown={showFilterDropdown}
              setShowFilterDropdown={setShowFilterDropdown}
              viewMode={viewMode}
              setViewMode={setViewMode}
              mode={mode}
              baseViewModeRef={baseViewModeRef}
              autoSelectBlocking={autoSelectBlocking}
              setAutoSelectBlocking={setAutoSelectBlocking}
              resizeAllSelected={resizeAllSelected}
              setResizeAllSelected={setResizeAllSelected}
              warningDuration={warningDuration}
              setWarningDuration={setWarningDuration}
              showSettingsDropdown={showSettingsDropdown}
              setShowSettingsDropdown={setShowSettingsDropdown}
              hideAllDependencies={hideAllDependencies}
              setHideAllDependencies={setHideAllDependencies}
              hideCollapsedDependencies={hideCollapsedDependencies}
              setHideCollapsedDependencies={setHideCollapsedDependencies}
              hideCollapsedMilestones={hideCollapsedMilestones}
              setHideCollapsedMilestones={setHideCollapsedMilestones}
              showEmptyTeams={showEmptyTeams}
              setShowEmptyTeams={setShowEmptyTeams}
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
              selectedMilestones={selectedMilestones}
              selectedConnections={selectedConnections}
              onDeleteSelected={handleDeleteSelected}
              onBulkUpdateConnections={handleBulkUpdateConnections}
              refactorMode={refactorMode}
              setRefactorMode={setRefactorMode}
              expandedTaskView={expandedTaskView}
              setExpandedTaskView={setExpandedTaskView}
              collapseAllTeams={collapseAllTeams}
              expandAllTeams={expandAllTeams}
              depSettings={depSettings}
              setDepSettings={setDepSettings}
              connections={connections}
              handleUpdateConnection={handleUpdateConnection}
              setConnectionEditModal={setConnectionEditModal}
              selectedDays={selectedDays}
              collapsedDays={collapsedDays}
              collapseSelectedDays={collapseSelectedDays}
              uncollapseAll={uncollapseAll}
              clearDaySelection={clearDaySelection}
              phases={phases}
              setPhaseEditModal={setPhaseEditModal}
              showPhaseColorsInGrid={showPhaseColorsInGrid}
              setShowPhaseColorsInGrid={setShowPhaseColorsInGrid}
              collapsedTeamPhaseRows={collapsedTeamPhaseRows}
              collapseAllTeamPhases={collapseAllTeamPhases}
              showAllTeamPhases={showAllTeamPhases}
              hideAllTeamPhases={hideAllTeamPhases}
              teamPhasesMap={teamPhasesMap}
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
              viewShortcuts={viewShortcuts}
              snapshots={snapshots}
              snapshotsLoading={snapshotsLoading}
              onCreateSnapshot={handleCreateSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onRenameSnapshot={handleRenameSnapshot}
              hideGlobalPhases={hideGlobalPhases}
              setHideGlobalPhases={setHideGlobalPhases}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              hideDayHeader={hideDayHeader}
              setHideDayHeader={setHideDayHeader}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              allTasksSmall={teamOrder.every(tid => {
                if (!isTeamVisible(tid)) return true;
                const team = teams[tid];
                if (!team) return true;
                const visible = team.tasks.filter(t => isTaskVisible(t, taskDisplaySettings));
                return visible.length === 0 || visible.every(t => taskDisplaySettings[t]?.size === 'small');
              })}
              allTeamsCollapsed={teamOrder.every(tid => !isTeamVisible(tid) || teamDisplaySettings[tid]?.collapsed)}
              popupCloseSignal={popupCloseSignal}
              userShortcuts={userShortcuts}
              onSaveShortcuts={handleSaveShortcuts}
              onRunSafetyCheck={runSafetyCheck}
              safetyCheckRunning={safetyCheckRunning}
            />
          )}
        </div>

        <DependencyCanvas
          teamContainerRef={teamContainerRef}
          days={days}
          contentHeight={contentHeight}
          layout={layout}
          data={data}
          displayState={displayState}
          handlers={handlers}
        />
      </div>

      {/* Task multi-select action bar */}
      <DependencyTaskSelectionBar
        selectedTasks={selectedTasks}
        setSelectedTasks={setSelectedTasks}
        tasks={tasks}
        onImport={handleBulkImportDependencies}
      />

      {/* Refactor mode: floating ghost card */}
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
          {refactorGhost.overIdeaBin ? "\uD83D\uDCA1 " : ""}
          {refactorGhost.type === "team" && `\uD83C\uDFE2 ${refactorGhost.name}`}
          {refactorGhost.type === "task" && `\uD83D\uDCCB ${refactorGhost.name}`}
          {refactorGhost.type === "milestone" && `\uD83C\uDFC1 ${refactorGhost.name}`}
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

      {/* Safety Check Panel */}
      {showSafetyPanel && (
        <SafetyCheckPanel
          results={safetyCheckResults}
          isRunning={safetyCheckRunning}
          onClose={() => setShowSafetyPanel(false)}
          onLocateIssue={(issue) => {
            handleLoadView(null);
            setTimeout(() => {
              if (issue.milestoneIds?.length) {
                setSelectedMilestones(new Set(issue.milestoneIds));
                issue.milestoneIds.forEach(id => showBlockingFeedback(id));
              }
            }, 300);
            setShowSafetyPanel(false);
          }}
        />
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
