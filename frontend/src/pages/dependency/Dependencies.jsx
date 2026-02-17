import { useState, useMemo } from 'react';
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
  MIN_TEAMWIDTH,
  MAX_TEAMWIDTH,
  MIN_TASKWIDTH,
  MAX_TASKWIDTH,
} from './layoutMath';
import { useDependencyInteraction } from './useDependencyInteraction';
import { useDependencyData } from './useDependencyData';
import { useDependencyUIState } from './useDependencyUIState';
import { useDependencyActions } from './useDependencyActions';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import DependencyToolbar from '../../components/dependencies/DependencyToolbar';
import DependencyModals from '../../components/dependencies/DependencyModals';
import DependencyCanvas from '../../components/dependencies/DependencyCanvas';
import DependencyWarningToast from '../../components/dependencies/DependencyWarningToast';
import { DependencyProvider, useDependency } from './DependencyContext.jsx';

export default function Dependencies() {
  return (
    <DependencyProvider>
      <DependenciesContent />
    </DependencyProvider>
  );
}

function DependenciesContent() {

  const { projectId, teamContainerRef } = useDependency();

  // ________Data Hook___________
  // ________________________________________
  const {
    days,
    projectStartDate,
    projectDays,
    setProjectDays,
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

  // Day purpose modal
  const [dayPurposeModal, setDayPurposeModal] = useState(null); // { dayIndex, currentPurpose }
  const [newDayPurpose, setNewDayPurpose] = useState("");

  // Column widths (resizable)
  const [teamColumnWidth, setTeamColumnWidth] = useState(DEFAULT_TEAMWIDTH_CONSTANT);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASKWIDTH_CONSTANT);

  // Dynamic constants based on settings
  const DAYWIDTH = customDayWidth;
  const TEAMWIDTH = teamColumnWidth;
  const TASKWIDTH = taskColumnWidth;
  const TASKHEIGHT_NORMAL = customTaskHeightNormal;
  const TASKHEIGHT_SMALL = customTaskHeightSmall;

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

  const handleDayHeaderClick = (dayIndex) => {
    const dayData = projectDays[dayIndex] || {};
    setDayPurposeModal({
      dayIndex,
      currentPurpose: dayData.purpose || ""
    });
    setNewDayPurpose(dayData.purpose || "");
  };


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
        isBlocked: dayData.is_blocked || false,
      });
    }
    return labels;
  }, [projectStartDate, days, projectDays]);


  // Calculate team height based on visible tasks and their sizes (with minimum)
  const TEAM_MIN_HEIGHT = TASKHEIGHT_NORMAL;
  
  const getTeamHeight = (teamId) => 
    getTeamHeightBase(teams[teamId], teamDisplaySettings, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL, TEAM_MIN_HEIGHT, TEAM_COLLAPSED_HEIGHT);

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

  // Calculate content height
  const layoutConstants = { HEADER_HEIGHT, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP };
  
  const contentHeight = useMemo(() => {
    return calculateContentHeight(teamOrder, isTeamVisible, getTeamHeight, layoutConstants);
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, TASKHEIGHT_NORMAL, TASKHEIGHT_SMALL]);

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
    getTaskDropIndicatorYBase(taskDropTarget, getTeamYOffset, getVisibleTasks, getTaskHeight, taskDisplaySettings, layoutConstants);

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
        handleSaveDayPurpose={handleSaveDayPurpose}
        handleClearDayPurpose={handleClearDayPurpose}
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
          TEAM_DRAG_HIGHLIGHT_HEIGHT={TEAM_DRAG_HIGHLIGHT_HEIGHT}
          MARIGN_BETWEEN_DRAG_HIGHLIGHT={MARIGN_BETWEEN_DRAG_HIGHLIGHT}
          TEAM_HEADER_LINE_HEIGHT={TEAM_HEADER_LINE_HEIGHT}
          TEAM_HEADER_GAP={TEAM_HEADER_GAP}
          // Dimensions
          days={days}
          contentHeight={contentHeight}
          // Display settings
          taskDisplaySettings={taskDisplaySettings}
          teamDisplaySettings={teamDisplaySettings}
          hideAllDependencies={hideAllDependencies}
          hideCollapsedDependencies={hideCollapsedDependencies}
          hideCollapsedMilestones={hideCollapsedMilestones}
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
        />
      </div>
    </>
  );
}
