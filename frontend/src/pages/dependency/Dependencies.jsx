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
import { useDependencyInteraction } from './useDependencyInteraction';
import { useDependencyData } from './useDependencyData';
import { useDependencyUIState } from './useDependencyUIState';
import { useDependencyActions } from './useDependencyActions';
import { set_task_deadline, update_start_index, update_dependency, create_dependency, delete_dependency_api, create_phase, update_phase, delete_phase, get_all_views, create_view, update_view, delete_view } from '../../api/dependencies_api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import DependencyToolbar from '../../components/dependencies/DependencyToolbar';
import DependencyModals from '../../components/dependencies/DependencyModals';
import DependencyCanvas from '../../components/dependencies/DependencyCanvas';
import DependencyWarningToast from '../../components/dependencies/DependencyWarningToast';
import { DependencyProvider, useDependency } from './DependencyContext.jsx';
import { playSound, preloadSounds } from '../../assets/sound_registry';

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
    selectedConnection,
    setSelectedConnection,
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

  // Dependency display settings
  const [depSettings, setDepSettings] = useState({
    showReasons: true,          // show reason text on paths
    hideSuggestions: false,      // hide suggestion-weight dependencies
    uniformVisuals: false,       // all deps same thickness (no weight differentiation)
    filterWeights: [],           // empty = show all; otherwise array of 'strong'|'weak'|'suggestion'
    defaultDepWeight: 'strong',  // default weight when creating new dependencies
    weakDepPrompt: true,         // show prompt on weak dep conflict (false = auto-block)
  });

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

  // ── Views (saveable frontend state snapshots) ──
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null); // null = Default view
  const [activeViewName, setActiveViewName] = useState("Default");

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
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of selectedDays) next.add(d);
      return next;
    });
    setSelectedDays(new Set());
  }, [selectedDays]);

  const uncollapseDays = useCallback((dayIndices) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of dayIndices) next.delete(d);
      return next;
    });
  }, []);

  const uncollapseAll = useCallback(() => {
    setCollapsedDays(new Set());
  }, []);

  // ── Phase range collapse (collapse/uncollapse all days covered by a phase) ──
  const collapsePhaseRange = useCallback((phase) => {
    if (!phase) return;
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

  // ── Show all team phase rows ──
  const showAllTeamPhases = useCallback(() => {
    setCollapsedTeamPhaseRows(new Set());
    setCollapseAllTeamPhases(false);
  }, []);

  // ── Hide all team phase rows ──
  const hideAllTeamPhases = useCallback(() => {
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
  }), [
    taskDisplaySettings, teamDisplaySettings, viewMode, mode,
    collapsedDays, selectedDays, depSettings, showPhaseColorsInGrid,
    expandedTaskView, hideAllDependencies, hideCollapsedDependencies,
    hideCollapsedMilestones, showEmptyTeams, customDayWidth,
    customTaskHeightNormal, customTaskHeightSmall, collapsedTeamPhaseRows,
    collapseAllTeamPhases, teamColumnWidth, taskColumnWidth,
    autoSelectBlocking, warningDuration, refactorMode,
  ]);

  // Apply a saved view state, restoring all settings
  const applyViewState = useCallback((state) => {
    if (!state) return;
    if (state.taskDisplaySettings !== undefined) setTaskDisplaySettings(state.taskDisplaySettings);
    if (state.teamDisplaySettings !== undefined) setTeamDisplaySettings(state.teamDisplaySettings);
    if (state.viewMode !== undefined) { setViewMode(state.viewMode); baseViewModeRef.current = state.viewMode; }
    if (state.mode !== undefined) setMode(state.mode);
    if (state.collapsedDays !== undefined) setCollapsedDays(new Set(state.collapsedDays));
    if (state.selectedDays !== undefined) setSelectedDays(new Set(state.selectedDays));
    if (state.depSettings !== undefined) setDepSettings(state.depSettings);
    if (state.showPhaseColorsInGrid !== undefined) setShowPhaseColorsInGrid(state.showPhaseColorsInGrid);
    if (state.expandedTaskView !== undefined) setExpandedTaskView(state.expandedTaskView);
    if (state.hideAllDependencies !== undefined) setHideAllDependencies(state.hideAllDependencies);
    if (state.hideCollapsedDependencies !== undefined) setHideCollapsedDependencies(state.hideCollapsedDependencies);
    if (state.hideCollapsedMilestones !== undefined) setHideCollapsedMilestones(state.hideCollapsedMilestones);
    if (state.showEmptyTeams !== undefined) setShowEmptyTeams(state.showEmptyTeams);
    if (state.customDayWidth !== undefined) setCustomDayWidth(state.customDayWidth);
    if (state.customTaskHeightNormal !== undefined) setCustomTaskHeightNormal(state.customTaskHeightNormal);
    if (state.customTaskHeightSmall !== undefined) setCustomTaskHeightSmall(state.customTaskHeightSmall);
    if (state.collapsedTeamPhaseRows !== undefined) setCollapsedTeamPhaseRows(new Set(state.collapsedTeamPhaseRows));
    if (state.collapseAllTeamPhases !== undefined) setCollapseAllTeamPhases(state.collapseAllTeamPhases);
    if (state.teamColumnWidth !== undefined) setTeamColumnWidth(state.teamColumnWidth);
    if (state.taskColumnWidth !== undefined) setTaskColumnWidth(state.taskColumnWidth);
    if (state.autoSelectBlocking !== undefined) setAutoSelectBlocking(state.autoSelectBlocking);
    if (state.warningDuration !== undefined) setWarningDuration(state.warningDuration);
    if (state.refactorMode !== undefined) setRefactorMode(state.refactorMode);
  }, []);

  // Fetch saved views on mount
  useEffect(() => {
    if (!projectId) return;
    get_all_views(projectId)
      .then(data => setSavedViews(data || []))
      .catch(err => console.error("Failed to load views:", err));
  }, [projectId]);

  // Load a view (switch to it)
  const handleLoadView = useCallback((view) => {
    if (!view) {
      // Reset to default
      setActiveViewId(null);
      setActiveViewName("Default");
      return;
    }
    applyViewState(view.state);
    setActiveViewId(view.id);
    setActiveViewName(view.name);
  }, [applyViewState]);

  // Save current state to active view
  const handleSaveView = useCallback(async () => {
    if (!activeViewId) return; // can't save the default view
    try {
      const state = collectViewState();
      const updated = await update_view(projectId, activeViewId, { state });
      setSavedViews(prev => prev.map(v => v.id === activeViewId ? { ...v, ...updated } : v));
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

  // ═══════════════ End Views ═══════════════

  // ── Phase CRUD handlers ──
  const handleCreatePhase = useCallback(async (phaseData) => {
    try {
      const res = await create_phase(projectId, phaseData);
      const created = res.phase || res;
      setPhases(prev => [...prev, created]);
      setPhaseEditModal(null);
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
    } catch (err) {
      console.error("Failed to delete phase:", err);
    }
  }, [projectId]);

  // ── Phase overlap detection helper ──
  // Returns true if a phase at (startIdx, dur) would overlap any other phase in the same scope
  const wouldPhaseOverlap = useCallback((phaseId, startIdx, dur, teamId) => {
    for (const p of phases) {
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
  }, [phases]);

  // ── Phase edge resize (drag left/right edges to resize) ──
  const handlePhaseEdgeResize = useCallback((e, phaseId, edge) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phases.find(p => p.id === phaseId);
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

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
  }, [phases, DAYWIDTH, projectId, wouldPhaseOverlap]);

  // ── Phase drag to move (mousedown on phase bar body) ──
  const handlePhaseDrag = useCallback((e, phaseId) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phases.find(p => p.id === phaseId);
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!moved) return;

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
  }, [phases, DAYWIDTH, projectId, wouldPhaseOverlap]);

  // ── Refactor drag: pick up a team / task / milestone and drop on IdeaBin ──
  const handleRefactorDrag = useCallback((e, type, payload) => {
    if (!refactorMode) return;
    e.preventDefault();
    e.stopPropagation();
    refactorDragging.current = true;

    let ghost = { type, ...payload, x: e.clientX, y: e.clientY, overIdeaBin: false };
    setRefactorGhost(ghost);

    const onMove = (ev) => {
      const ideaBinEl = document.querySelector("[data-ideabin-window]");
      let overIdeaBin = false;
      if (ideaBinEl) {
        const r = ideaBinEl.getBoundingClientRect();
        overIdeaBin = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      }
      ghost = { ...ghost, x: ev.clientX, y: ev.clientY, overIdeaBin };
      setRefactorGhost(ghost);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      refactorDragging.current = false;

      if (ghost.overIdeaBin) {
        // Dispatch event so IdeaBin can handle the drop
        window.dispatchEvent(new CustomEvent("dep-refactor-drop", {
          detail: { type, ...payload },
        }));
      }
      setRefactorGhost(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [refactorMode]);


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
    isTeamVisibleBase(teamId, teamDisplaySettings, teams, taskDisplaySettings);

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
  const effectiveHeaderHeight = HEADER_HEIGHT + (hasGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const layoutConstants = { HEADER_HEIGHT: effectiveHeaderHeight, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP };
  
  const contentHeight = useMemo(() => {
    return calculateContentHeight(teamOrder, isTeamVisible, getTeamHeight, layoutConstants);
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, TASKHEIGHT_NORMAL, TASKHEIGHT_SMALL, hasGlobalPhases, phases, collapseAllTeamPhases, collapsedTeamPhaseRows]);

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
    findMilestoneAtPosition,
    getMilestoneHandlePosition,
    showBlockingFeedback,
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
  });

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
      await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion' });
      setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: 'suggestion', reason: null }]);
      pushAction({
        description: 'Create dependency (suggestion)',
        undo: async () => {
          await delete_dependency_api(projectId, sourceId, targetId);
          setConnections(prev => prev.filter(c => !(c.source === sourceId && c.target === targetId)));
        },
        redo: async () => {
          await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion' });
          setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: 'suggestion', reason: null }]);
        },
      });
    } catch (err) {
      console.error("Failed to create suggestion dependency:", err);
    }
  }, [suggestionOfferModal, projectId, setConnections, pushAction]);

  // Handle weak dependency conflict: convert weak deps to suggestions, then allow the move
  const handleWeakDepConvert = useCallback(async (conflictData) => {
    if (!conflictData) return;
    const { weakConnections, milestonesToMove, initialPositions, currentDeltaIndex } = conflictData;

    // Capture old positions and weights for undo
    const beforePositions = {};
    for (const mId of milestonesToMove) {
      const initial = initialPositions[mId];
      if (initial) beforePositions[mId] = initial.startIndex;
    }
    const convertedConnWeights = weakConnections.map(c => ({ ...c, oldWeight: c.weight || 'weak' }));

    // Convert each weak connection to suggestion
    for (const conn of weakConnections) {
      await handleUpdateConnection(conn, { weight: 'suggestion' }, { skipHistory: true });
    }

    // Now apply the move
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

    pushAction({
      description: 'Weak dep convert + move',
      undo: async () => {
        // Restore positions
        for (const mId of milestonesToMove) {
          const oldStart = beforePositions[mId];
          if (oldStart === undefined) continue;
          await update_start_index(projectId, mId, oldStart);
          setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: oldStart } }));
        }
        // Restore connection weights
        for (const c of convertedConnWeights) {
          await update_dependency(projectId, c.source, c.target, { weight: c.oldWeight });
          setConnections(prev => prev.map(conn =>
            conn.source === c.source && conn.target === c.target ? { ...conn, weight: c.oldWeight } : conn
          ));
        }
      },
      redo: async () => {
        // Re-convert and re-move
        for (const c of convertedConnWeights) {
          await update_dependency(projectId, c.source, c.target, { weight: 'suggestion' });
          setConnections(prev => prev.map(conn =>
            conn.source === c.source && conn.target === c.target ? { ...conn, weight: 'suggestion' } : conn
          ));
        }
        for (const mId of milestonesToMove) {
          const newStart = afterPositions[mId];
          if (newStart === undefined) continue;
          await update_start_index(projectId, mId, newStart);
          setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: newStart } }));
        }
      },
    });
  }, [handleUpdateConnection, setMilestones, setConnections, projectId, pushAction]);

  // Auto-block weak dep conflicts when the prompt setting is disabled
  useEffect(() => {
    if (weakDepModal && !depSettings.weakDepPrompt) {
      // Auto-block: just close modal and auto-select blocking milestones
      if (autoSelectBlocking) {
        const blockIds = weakDepModal.blockingMilestoneIds || [];
        const moveIds = weakDepModal.milestonesToMove || [];
        setSelectedMilestones(prev => {
          const newSet = new Set(prev);
          for (const mId of moveIds) newSet.add(mId);
          for (const bId of blockIds) newSet.add(bId);
          return newSet;
        });
      }
      setWeakDepModal(null);
    }
  }, [weakDepModal, depSettings.weakDepPrompt, autoSelectBlocking, setSelectedMilestones, setWeakDepModal]);

  // Toggle task size
  const toggleTaskSize = (taskId) => {
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

  // Check if team is collapsed
  const isTeamCollapsed = (teamId) => {
    return teamDisplaySettings[teamId]?.collapsed ?? false;
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
          // Auto-select blocking milestones (same as strong dep behavior)
          if (autoSelectBlocking && modalData) {
            const blockIds = modalData.blockingMilestoneIds || [];
            const moveIds = modalData.milestonesToMove || [];
            setSelectedMilestones(prev => {
              const newSet = new Set(prev);
              for (const mId of moveIds) newSet.add(mId);
              for (const bId of blockIds) newSet.add(bId);
              return newSet;
            });
          }
          setWeakDepModal(null);
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
        style={{ backgroundColor: '#f8f9fb' }}
        onClick={() => {
          if (justDraggedRef.current) return;
          setSelectedConnection(null);
          setOpenTeamSettings(null);
          setShowSettingsDropdown(false);
          setSelectedMilestones(new Set());
          setIsAddingMilestone(false);
        }}
      >
        {/* Control Board Toolbar */}
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
          selectedConnection={selectedConnection}
          // Delete handler
          onDeleteSelected={handleDeleteSelected}
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
        />

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
          selectedConnection={selectedConnection}
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
        </div>
      )}

      {/* Refactor mode active: pulsing banner */}
      {refactorMode && (
        <div
          style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 99998 }}
          className="px-4 py-2 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg animate-pulse flex items-center gap-2"
        >
          <span>🔧 Refactor Mode</span>
          <span className="font-normal opacity-80">— drag items to IdeaBin</span>
          <button
            onClick={() => setRefactorMode(false)}
            className="ml-2 px-2 py-0.5 rounded bg-orange-700 hover:bg-orange-800 text-white text-[10px] font-semibold"
          >
            Exit
          </button>
        </div>
      )}
    </>
  );
}
