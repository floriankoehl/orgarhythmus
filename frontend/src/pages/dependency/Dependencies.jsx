import { useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  add_milestone,
  update_start_index,
  set_day_purpose,
} from '../../api/dependencies_api.js';
import {
  createTeamForProject,
  createTaskForProject,
} from '../../api/org_API.js';
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
  getConnectionPath,
  getStraightPath,
  lightenColor,
  isTaskVisible,
  // Constants
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  TASKWIDTH,
  TEAMWIDTH,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  DEFAULT_DAYWIDTH,
  HEADER_HEIGHT,
  TASK_DROP_INDICATOR_HEIGHT,
  CONNECTION_RADIUS,
  DAY_NAME_WIDTH_THRESHOLD,
  TEAM_COLLAPSED_HEIGHT,
} from './layoutMath';
import { useDependencyInteraction } from './useDependencyInteraction';
import { useDependencyData } from './useDependencyData';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import DependencyToolbar from '../../components/dependencies/DependencyToolbar';

export default function Dependencies() {
    
  const { projectId } = useParams();

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

  // UI state
  const [hoveredMilestone, setHoveredMilestone] = useState(null)
  const [selectedMilestones, setSelectedMilestones] = useState(new Set())
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true) // Auto-select blocking milestone on failed move
  const justDraggedRef = useRef(false); // Prevents click handler from firing after drag ends

  // // Store the base viewMode for when no modifier keys are held
  // const baseViewModeRef = useRef(viewMode);

  const [ghost, setGhost] = useState(null);
  const teamContainerRef = useRef(null);
  const [dropIndex, setDropIndex] = useState(null);

  // Connection state
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [selectedConnection, setSelectedConnection] = useState(null);

  // Task drag state
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, setTaskDropTarget] = useState(null);

  // Cross-team move confirmation modal
  const [moveModal, setMoveModal] = useState(null);

  // Team settings dropdown
  const [openTeamSettings, setOpenTeamSettings] = useState(null);

  // Team filter - empty array means show all teams
  const [teamFilter, setTeamFilter] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // View mode: "inspection" (default, view only), "schedule" (move milestones), "dependency" (edit connections), or "milestone" (edit milestones)
  const [viewMode, setViewMode] = useState("inspection");

  // Store the base viewMode for when no modifier keys are held
  const baseViewModeRef = useRef(viewMode);

  // Milestone editing state
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

  // Day cell hover state for milestone creation
  const [hoveredDayCell, setHoveredDayCell] = useState(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false); // { taskId, dayIndex }
  
  // Milestone creation confirmation modal
  const [milestoneCreateModal, setMilestoneCreateModal] = useState(null); // { taskId, dayIndex }

  // Milestone delete confirmation modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { milestoneId, milestoneName }

  // Move validation feedback state
  const [blockedMoveHighlight, setBlockedMoveHighlight] = useState(null); // { milestoneId, connectionId, originalState }

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

  // Dynamic constants based on settings
  const DAYWIDTH = customDayWidth;
  const TASKHEIGHT_NORMAL = customTaskHeightNormal;
  const TASKHEIGHT_SMALL = customTaskHeightSmall;

  // Helper to get task height (using current settings)
  const getTaskHeight = (taskId, taskDisplaySettings) => 
    getTaskHeightBase(taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);


  // ________Global Event Listener___________
  // ________________________________________

  const [mode, setMode] = useState("drag")

  // safeMode is derived from viewMode - inspection mode is safe
  const safeMode = viewMode === "inspection";


  // ________DAY PURPOSE HANDLERS________
  // ________________________________________

  const handleDayHeaderClick = (dayIndex) => {
    const dayData = projectDays[dayIndex] || {};
    setDayPurposeModal({
      dayIndex,
      currentPurpose: dayData.purpose || ""
    });
    setNewDayPurpose(dayData.purpose || "");
  };

  const handleSaveDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    try {
      const result = await set_day_purpose(projectId, dayPurposeModal.dayIndex, newDayPurpose);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayPurposeModal.dayIndex]: result.day
        }));
      }
    } catch (err) {
      console.error("Failed to save day purpose:", err);
    }
    
    setDayPurposeModal(null);
    setNewDayPurpose("");
  };

  const handleClearDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    try {
      const result = await set_day_purpose(projectId, dayPurposeModal.dayIndex, null);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayPurposeModal.dayIndex]: result.day
        }));
      }
    } catch (err) {
      console.error("Failed to clear day purpose:", err);
    }
    
    setDayPurposeModal(null);
    setNewDayPurpose("");
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
    isTeamVisibleBase(teamId, teamFilter, teamDisplaySettings, teams, taskDisplaySettings);

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
  } = useDependencyInteraction({
    projectId,
    milestones,
    teams,
    tasks,
    teamOrder,
    connections,
    viewMode,
    selectedConnection,
    selectedMilestones,
    autoSelectBlocking,
    openTeamSettings,
    showFilterDropdown,
    teamFilter,
    taskDisplaySettings,
    teamDisplaySettings,
    setMode,
    setViewMode,
    setMilestones,
    setTeams,
    setTeamOrder,
    setConnections,
    setSelectedMilestones,
    setSelectedConnection,
    setDeleteConfirmModal,
    setOpenTeamSettings,
    setShowFilterDropdown,
    setTeamFilter,
    setTaskDisplaySettings,
    setTeamDisplaySettings,
    setGhost,
    setDropIndex,
    setTaskGhost,
    setTaskDropTarget,
    setMoveModal,
    setBlockedMoveHighlight,
    setEditingMilestoneId,
    setEditingMilestoneName,
    setMilestoneCreateModal,
    setIsAddingMilestone,
    setIsDraggingConnection,
    setConnectionStart,
    setConnectionEnd,
    setTasks,
    teamContainerRef,
    justDraggedRef,
    DAYWIDTH,
    getTaskHeight,
    getTeamHeight,
    isTeamVisible,
    getVisibleTeamIndex,
    getTeamYOffset,
    getTaskYOffset,
    getVisibleTasks,
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
  const toggleTaskVisibility = (taskId) => {
    setTaskDisplaySettings(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        hidden: !prev[taskId]?.hidden
      }
    }));
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

  // Toggle team collapsed state
  const toggleTeamCollapsed = (teamId) => {
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        collapsed: !prev[teamId]?.collapsed
      }
    }));
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
  };

  // Show all hidden teams
  const showAllHiddenTeams = () => {
    // Clear the team filter first
    setTeamFilter([]);
    
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

  // Add milestone locally
  const add_milestone_local = async (taskId) => {
    if (safeMode) return;
    try {
      const result = await add_milestone(projectId, taskId);
      if (result.added_milestone) {
        setMilestones(prev => ({
          ...prev,
          [result.added_milestone.id]: { ...result.added_milestone, display: "default" }
        }));
        // Update tasks to include the new milestone
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), result.added_milestone]
          }
        }));
      }
    } catch (err) {
      console.error("Failed to add milestone:", err);
    }
  };

  // Confirm milestone creation
  const confirmMilestoneCreate = async () => {
    if (!milestoneCreateModal) return;
    
    const { taskId, dayIndex } = milestoneCreateModal;
    
    try {
      const result = await add_milestone(projectId, taskId);
      if (result.added_milestone) {
        // Update the milestone with the correct start index
        await update_start_index(projectId, result.added_milestone.id, dayIndex);
        
        const newMilestone = { ...result.added_milestone, start_index: dayIndex, display: "default" };
        
        setMilestones(prev => ({
          ...prev,
          [result.added_milestone.id]: newMilestone
        }));
        
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), newMilestone]
          }
        }));
      }
    } catch (err) {
      console.error("Failed to create milestone:", err);
    }
    
    setMilestoneCreateModal(null);
    setIsAddingMilestone(false);
  };

  // Handle create team
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createTeamForProject(projectId, {
        name: newTeamName.trim(),
        color: newTeamColor,
      });
      if (result) {
        setReloadData(true);
        setShowCreateTeamModal(false);
        setNewTeamName("");
        setNewTeamColor("#facc15");
      }
    } catch (err) {
      console.error("Failed to create team:", err);
    }
    setIsCreating(false);
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!newTaskName.trim() || !newTaskTeamId) return;
    setIsCreating(true);
    try {
      const result = await createTaskForProject(projectId, {
        name: newTaskName.trim(),
        team_id: newTaskTeamId,
      });
      if (result) {
        setReloadData(true);
        setShowCreateTaskModal(false);
        setNewTaskName("");
        setNewTaskTeamId(null);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
    setIsCreating(false);
  };

  return (
    <>
      {/* Day Purpose Modal */}
      {dayPurposeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Set Day Purpose
              </h2>
              <button
                onClick={() => setDayPurposeModal(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              Day {dayPurposeModal.dayIndex + 1} - {dayLabels[dayPurposeModal.dayIndex]?.dateStr}
              {dayLabels[dayPurposeModal.dayIndex]?.isSunday && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Sunday</span>
              )}
            </p>
            
            <input
              type="text"
              value={newDayPurpose}
              onChange={(e) => setNewDayPurpose(e.target.value)}
              placeholder="e.g., Meeting, Sprint Review, Holiday..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveDayPurpose();
                if (e.key === 'Escape') setDayPurposeModal(null);
              }}
            />
            
            <div className="flex justify-between gap-3">
              <button
                onClick={handleClearDayPurpose}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                disabled={!dayPurposeModal.currentPurpose}
              >
                Clear Purpose
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setDayPurposeModal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDayPurpose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Team</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-slate-200"
                  />
                  <span className="text-sm text-slate-500">{newTeamColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTeamModal(false);
                  setNewTeamName("");
                  setNewTeamColor("#facc15");
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="Enter task name..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Team</label>
                <select
                  value={newTaskTeamId || ""}
                  onChange={(e) => setNewTaskTeamId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a team...</option>
                  {Object.entries(teams).map(([teamId, team]) => (
                    <option key={teamId} value={teamId}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTaskModal(false);
                  setNewTaskName("");
                  setNewTaskTeamId(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTaskName.trim() || !newTaskTeamId || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Team Move Confirmation Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Move Task to Different Team?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to move <strong>"{moveModal.taskName}"</strong> from{" "}
              <span className="font-medium text-slate-800">{moveModal.sourceTeamName}</span> to{" "}
              <span className="font-medium text-slate-800">{moveModal.targetTeamName}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMoveModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { taskId, sourceTeamId, targetTeamId, insertIndex } = moveModal;
                  
                  // Remove task from source team
                  const sourceTeam = teams[sourceTeamId];
                  const newSourceTasks = sourceTeam.tasks.filter(id => id !== taskId);
                  
                  // Add task to target team at the specified index
                  const targetTeam = teams[targetTeamId];
                  const visibleTasks = getVisibleTasks(targetTeamId);
                  
                  // Calculate actual insert position
                  let actualInsertIndex = 0;
                  let visibleCount = 0;
                  for (let i = 0; i < targetTeam.tasks.length; i++) {
                    if (isTaskVisible(targetTeam.tasks[i], taskDisplaySettings)) {
                      if (visibleCount === insertIndex) {
                        actualInsertIndex = i;
                        break;
                      }
                      visibleCount++;
                    }
                    actualInsertIndex = i + 1;
                  }
                  
                  const newTargetTasks = [...targetTeam.tasks];
                  newTargetTasks.splice(actualInsertIndex, 0, taskId);
                  
                  // Update local state
                  setTeams(prev => ({
                    ...prev,
                    [sourceTeamId]: { ...prev[sourceTeamId], tasks: newSourceTasks },
                    [targetTeamId]: { ...prev[targetTeamId], tasks: newTargetTasks }
                  }));
                  
                  // Update tasks state - update the task's team reference
                  setTasks(prev => ({
                    ...prev,
                    [taskId]: { ...prev[taskId], team: targetTeamId }
                  }));
                  
                  // Save to backend
                  try {
                    await reorder_team_tasks(projectId, taskId, targetTeamId, newTargetTasks);
                  } catch (err) {
                    console.error("Failed to move task:", err);
                  }
                  
                  setMoveModal(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Move Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Creation Confirmation Modal */}
      {milestoneCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Milestone?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Create a new milestone on <strong>Day {milestoneCreateModal.dayIndex + 1}</strong> for task{" "}
              <span className="font-medium text-slate-800">
                "{tasks[milestoneCreateModal.taskId]?.name || 'Unknown'}"
              </span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMilestoneCreateModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMilestoneCreate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Create Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone/Connection Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Delete {deleteConfirmModal.connectionId ? 'Connection' : deleteConfirmModal.milestoneIds ? 'Milestones' : 'Milestone'}?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-800">
                {deleteConfirmModal.connectionId
                  ? deleteConfirmModal.connectionName
                  : deleteConfirmModal.milestoneIds 
                    ? `${deleteConfirmModal.milestoneIds.length} milestones`
                    : `"${deleteConfirmModal.milestoneName}"`
                }
              </span>?{!deleteConfirmModal.connectionId && ` This will also remove any dependencies connected to ${deleteConfirmModal.milestoneIds ? 'them' : 'it'}.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmModal.connectionId) {
                    // Delete connection
                    handleDeleteConnection(selectedConnection);
                    setSelectedConnection(null);
                  } else if (deleteConfirmModal.milestoneIds) {
                    // Delete multiple milestones
                    for (const mId of deleteConfirmModal.milestoneIds) {
                      await handleMilestoneDelete(mId);
                    }
                    setSelectedMilestones(new Set());
                  } else {
                    // Delete single milestone
                    await handleMilestoneDelete(deleteConfirmModal.milestoneId);
                  }
                  setDeleteConfirmModal(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
              {/* Collapse/Expand Team (entire team) */}
              <button
                onClick={() => {
                  toggleTeamCollapsed(team_key);
                  setOpenTeamSettings(null);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left"
              >
                {isTeamCollapsed(team_key) ? (
                  <>
                    <UnfoldMoreIcon style={{ fontSize: 14 }} />
                    <span>Expand team</span>
                  </>
                ) : (
                  <>
                    <UnfoldLessIcon style={{ fontSize: 14 }} />
                    <span>Collapse team</span>
                  </>
                )}
              </button>
              
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

      {/* Page wrapper */}
      <div 
        className="p-10 w-full min-w-0 select-none"
        onClick={() => {
          setSelectedConnection(null);
          setOpenTeamSettings(null);
          setShowSettingsDropdown(false);
          setSelectedMilestones(new Set());
          setIsAddingMilestone(false);
        }}
      >
        {/* Control Board Toolbar */}
        <DependencyToolbar
          teamOrder={teamOrder}
          teams={teams}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          showFilterDropdown={showFilterDropdown}
          setShowFilterDropdown={setShowFilterDropdown}
          viewMode={viewMode}
          setViewMode={setViewMode}
          mode={mode}
          baseViewModeRef={baseViewModeRef}
          autoSelectBlocking={autoSelectBlocking}
          setAutoSelectBlocking={setAutoSelectBlocking}
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
        />

        {/* Scroll container - wrapper to flip scrollbar to top */}
        <div
          style={{ height: `${contentHeight + 16}px`, transform: 'scaleY(-1)' }}
          className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 shadow-sm"
        >
          {/* Inner container - flip back to normal */}
          <div
            ref={teamContainerRef}
            style={{
              width: `${TEAMWIDTH + TASKWIDTH + (days || 0) * DAYWIDTH}px`,
              height: `${contentHeight}px`,
              transform: 'scaleY(-1)',
            }}
            className="relative"
          >
            {/* Sticky overlay for team ghost and task drop indicator */}
            <div
              style={{
                position: 'sticky',
                left: 0,
                top: 0,
                width: `${TEAMWIDTH + TASKWIDTH}px`,
                height: 0,
                zIndex: 150,
                pointerEvents: 'none',
              }}
            >
              {/* Task drop indicator line */}
              {taskGhost && taskDropTarget && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    top: `${getTaskDropIndicatorY()}px`,
                    left: `${TEAMWIDTH}px`,
                    width: `${TASKWIDTH}px`,
                    height: `${TASK_DROP_INDICATOR_HEIGHT}px`,
                    backgroundColor: '#1d4ed8',
                    borderRadius: '2px',
                    zIndex: 200,
                    boxShadow: '0 0 8px rgba(29, 78, 216, 0.6)',
                  }}
                />
              )}

              {/* Team Ghost */}
              {ghost && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    top: `${ghost.y}px`,
                    left: 0,
                    height: `${ghost.height}px`,
                    width: `${TEAMWIDTH + TASKWIDTH}px`,
                    backgroundColor: `${ghost.color}`,
                    zIndex: 100,
                    opacity: 0.8,
                    border: '2px dashed #374151',
                    borderRadius: '4px',
                  }}
                >
                  <div className="p-2 text-sm font-medium">{ghost.name}</div>
                </div>
              )}
            </div>

            {/* Header Row */}
            <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 50 }}>
              <div
                className="flex border-b bg-slate-100 text-sm font-semibold text-slate-700"
                style={{
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  height: `${HEADER_HEIGHT}px`,
                  position: 'sticky',
                  left: 0,
                  zIndex: 50,
                }}
              >
                <div
                  className="flex items-center justify-center border-r"
                  style={{ width: `${TEAMWIDTH}px` }}
                >
                  Team
                </div>
                <div
                  className="flex items-center justify-center"
                  style={{ width: `${TASKWIDTH}px` }}
                >
                  Tasks
                </div>
              </div>
              
              {/* Day Headers - Enhanced */}
              <div className="flex border-b">
                {dayLabels.map((dayInfo, i) => {
                  const hasPurpose = !!dayInfo.purpose;
                  const isSunday = dayInfo.isSunday;
                  const showDayName = DAYWIDTH >= DAY_NAME_WIDTH_THRESHOLD;
                  
                  return (
                    <div
                      key={i}
                      onClick={() => handleDayHeaderClick(i)}
                      className={`flex flex-col items-center justify-center text-xs border-r cursor-pointer transition-colors ${
                        hasPurpose 
                          ? 'bg-slate-800 text-white hover:bg-slate-700' 
                          : isSunday 
                            ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                      style={{ 
                        width: `${DAYWIDTH}px`,
                        height: `${HEADER_HEIGHT}px`,
                      }}
                      title={hasPurpose ? `${dayInfo.purpose} - Click to edit` : 'Click to set purpose'}
                    >
                      {showDayName && (
                        <span className={`text-[10px] font-medium ${hasPurpose ? 'text-slate-300' : isSunday ? 'text-purple-600' : 'text-slate-400'}`}>
                          {dayInfo.dayNameShort}
                        </span>
                      )}
                      <span className={`font-medium ${hasPurpose ? 'text-white' : ''}`}>
                        {dayInfo.dateStr}
                      </span>
                      {hasPurpose && DAYWIDTH >= 50 && (
                        <span className="text-[9px] truncate max-w-full px-1 text-slate-300">
                          {dayInfo.purpose}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teams List */}
            {teamOrder.map((team_key, orderIndex) => {
              const team = teams[team_key];
              if (!team) return null;
              
              // Skip hidden teams
              if (!isTeamVisible(team_key)) return null;
              
              const visibleIndex = getVisibleTeamIndex(team_key);
              const teamHeight = getTeamHeight(team_key);
              const rawHeight = getRawTeamHeight(team_key);
              const visibleTasks = getVisibleTasks(team_key);
              const isTargetTeam = taskGhost && taskDropTarget?.teamId === team_key && taskDropTarget?.teamId !== taskGhost.fromTeamId;
              const isSettingsOpen = openTeamSettings === team_key;
              
              return (
                <div key={`${team_key}_container`} style={{ position: 'relative' }}>
                  {/* Drop Highlighter */}
                  <div className="flex" style={{ backgroundColor: 'white' }}>
                    <div
                      style={{
                        marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                        marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                        height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                        width: `${TEAMWIDTH + TASKWIDTH}px`,
                        opacity: dropIndex === visibleIndex ? 1 : 0,
                        position: 'sticky',
                        left: 0,
                        zIndex: 40,
                        backgroundColor: dropIndex === visibleIndex ? 'black' : 'white',
                      }}
                      className="rounded-l-full"
                    />
                    <div
                      style={{
                        marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                        marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                        height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                        opacity: dropIndex === visibleIndex ? 1 : 0,
                        backgroundColor: dropIndex === visibleIndex ? 'black' : 'white',
                      }}
                      className="rounded-r-full flex-1"
                    />
                  </div>

                  {/* Team Color Header Line - spans full width */}
                  <div 
                    className="flex"
                    style={{ 
                      height: `${TEAM_HEADER_LINE_HEIGHT}px`,
                      backgroundColor: team.color,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div 
                      style={{ 
                        width: `${TEAMWIDTH + TASKWIDTH}px`,
                        position: 'sticky',
                        left: 0,
                        zIndex: 41,
                        backgroundColor: team.color,
                      }}
                    />
                    <div style={{ flex: 1 }} />
                  </div>
                  
                  {/* Gap after header line */}
                  <div style={{ height: `${TEAM_HEADER_GAP}px` }} />

                  {/* Team Row */}
                  <div className="flex">
                    {/* STICKY LEFT: Team + Tasks */}
                    <div
                      style={{
                        height: teamHeight,
                        width: `${TEAMWIDTH + TASKWIDTH}px`,
                        backgroundColor: isTargetTeam ? '#dbeafe' : lightenColor(team.color, 0.9),
                        opacity: ghost?.id === team_key ? 0.2 : 1,
                        position: 'sticky',
                        left: 0,
                        zIndex: 40,
                        transition: 'all 0.15s ease',
                        boxShadow: isTargetTeam ? 'inset 0 0 0 2px #3b82f6' : '2px 0 4px rgba(0,0,0,0.05)',
                        borderLeft: `3px solid ${team.color}`,
                      }}
                      className="flex border-y border-r border-slate-200 flex-shrink-0"
                    >
                      {/* Team Column */}
                      <div
                        style={{ width: isTeamCollapsed(team_key) ? `${TEAMWIDTH + TASKWIDTH}px` : `${TEAMWIDTH}px` }}
                        className="flex flex-col"
                      >
                        {/* Team Name Row - Draggable + Settings */}
                        <div className={`${isTeamCollapsed(team_key) ? '' : 'border-b border-slate-200'} h-8 px-3 flex items-center justify-between`}>
                          <div 
                            onMouseDown={(e) => handleTeamDrag(e, team_key, orderIndex)}
                            className="flex-1 flex items-center gap-2 cursor-grab active:cursor-grabbing overflow-hidden"
                          >
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="truncate text-sm font-semibold text-slate-700">{team.name}</span>
                            {isTeamCollapsed(team_key) && (
                              <span className="text-xs text-slate-400 ml-1">
                                ({team.tasks.length} task{team.tasks.length !== 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                          
                          {/* Expand button for collapsed teams */}
                          {isTeamCollapsed(team_key) && (
                            <button
                              onClick={() => toggleTeamCollapsed(team_key)}
                              className="flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition mr-1"
                              title="Expand team"
                            >
                              <UnfoldMoreIcon style={{ fontSize: 16 }} className="text-slate-500" />
                            </button>
                          )}
                          
                          {/* Team Settings Button */}
                          <div className="relative">
                            <button
                              id={`team-settings-btn-${team_key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTeamSettings(isSettingsOpen ? null : team_key);
                              }}
                              className={`flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition ${isSettingsOpen ? 'bg-slate-100' : ''}`}
                              title="Team settings"
                            >
                              <MoreVertIcon style={{ fontSize: 16 }} className="text-slate-500" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Empty space indicator when all tasks hidden but team shown due to min height */}
                        {!isTeamCollapsed(team_key) && rawHeight === 0 && teamHeight > 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-xs text-slate-400 italic">All tasks hidden</span>
                          </div>
                        )}
                      </div>

                      {/* Tasks Column - only show when not collapsed AND has visible tasks */}
                      {!isTeamCollapsed(team_key) && visibleTasks.length > 0 && (
                        <div className="flex flex-col bg-white">
                          {team.tasks.map((task_key, taskIndex) => {
                            if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                            
                            const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                            const isSmall = taskDisplaySettings[task_key]?.size === 'small';
                            const visibleTaskIndex = visibleTasks.indexOf(task_key);
                            const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                            
                            return (
                              <div
                                className="border-l border-slate-200 flex justify-between w-full items-center hover:bg-slate-50/50 transition-colors"
                                style={{
                                  height: `${taskHeight}px`,
                                  width: `${TASKWIDTH}px`,
                                  borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                                  opacity: taskGhost?.taskKey === task_key ? 0.3 : 1,
                                }}
                                key={`${task_key}_container`}
                              >
                                {/* Task Name */}
                                <div
                                  onMouseDown={(e) => {
                                    if (mode === "drag") {
                                      handleTaskDrag(e, task_key, team_key, visibleTaskIndex);
                                    }
                                  }}
                                  className={`flex-1 h-full flex items-center px-2 cursor-grab active:cursor-grabbing truncate text-slate-600 ${isSmall ? 'text-xs' : 'text-sm'}`}
                                >
                                  {tasks[task_key]?.name}
                                </div>

                                {/* Task Controls */}
                                <div className="flex items-center gap-0.5 pr-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                  {/* Size Toggle */}
                                  <button
                                    onClick={() => toggleTaskSize(task_key)}
                                    className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                                    title={isSmall ? "Expand task" : "Collapse task"}
                                  >
                                    {isSmall ? (
                                      <UnfoldMoreIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                                    ) : (
                                      <UnfoldLessIcon style={{ fontSize: 14 }} className="text-slate-500" />
                                    )}
                                  </button>
                                  
                                  {/* Hide Task */}
                                  <button
                                    onClick={() => toggleTaskVisibility(task_key)}
                                    className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                                    title="Hide task"
                                  >
                                    <VisibilityOffIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                                  </button>
                                  
                                  {/* Add Milestone */}
                                  {!isSmall && (
                                    <button 
                                      onClick={() => add_milestone_local(task_key)}
                                      className="h-6 w-6 flex justify-center items-center rounded hover:bg-slate-200 transition cursor-pointer"
                                    >
                                      <AddIcon style={{ fontSize: 14 }} className="text-slate-500" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SCROLLABLE RIGHT: Milestones/Days - day grid with interactive cells in milestone mode */}
                    {!isTeamCollapsed(team_key) && (
                      <div
                        className="border-y border-slate-200 bg-white"
                        style={{ height: `${teamHeight}px` }}
                      >
                        {team.tasks.map((task_key, taskIndex) => {
                          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                          
                          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                          const visibleTaskIndex = visibleTasks.indexOf(task_key);
                          const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                          
                          return (
                            <div
                              className="flex relative"
                              style={{
                                height: `${taskHeight}px`,
                                borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                              }}
                              key={`${task_key}_milestone`}
                            >
                              {/* Day rendering - interactive when adding milestone */}
                              {[...Array(days)].map((_, i) => {
                                const isHovered = isAddingMilestone && 
                                  hoveredDayCell?.taskId === task_key && 
                                  hoveredDayCell?.dayIndex === i;
                                
                                return (
                                  <div
                                    className={`border-r border-slate-100 transition-colors ${
                                      isAddingMilestone ? 'cursor-pointer hover:bg-blue-50' : ''
                                    } ${isHovered ? 'bg-blue-100' : ''}`}
                                    style={{
                                      height: `${taskHeight}px`,
                                      width: `${DAYWIDTH}px`,
                                      opacity: ghost?.id === team_key ? 0.2 : 1,
                                      pointerEvents: isAddingMilestone ? 'auto' : 'none',
                                    }}
                                    key={i}
                                  onMouseEnter={() => isAddingMilestone && setHoveredDayCell({ taskId: task_key, dayIndex: i })}
                                  onMouseLeave={() => setHoveredDayCell(null)}
                                  onClick={(e) => {
                                    if (isAddingMilestone) {
                                      e.stopPropagation();
                                      handleDayCellClick(task_key, i);
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                      
                      {/* Empty placeholder when all tasks hidden */}
                      {rawHeight === 0 && teamHeight > 0 && (
                        <div
                          className="flex"
                          style={{ height: `${teamHeight}px` }}
                        >
                          {[...Array(days)].map((_, i) => (
                            <div
                              className="border-r"
                              style={{
                                height: `${teamHeight}px`,
                                width: `${DAYWIDTH}px`,
                                opacity: 0.3,
                              }}
                              key={i}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                    
                    {/* Empty day grid placeholder for collapsed teams */}
                    {isTeamCollapsed(team_key) && (
                      <div
                        className="border-y border-slate-200 bg-slate-50"
                        style={{ height: `${teamHeight}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* LAST DROP HIGHLIGHT */}
            <div className="flex" style={{ position: 'relative', backgroundColor: 'white' }}>
              <div
                style={{
                  marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  opacity: dropIndex === visibleTeamCount ? 1 : 0,
                  backgroundColor: dropIndex === visibleTeamCount ? 'black' : 'white',
                  position: 'sticky',
                  left: 0,
                  zIndex: 40,
                }}
                className="rounded-l-full"
              />
              <div
                style={{
                  marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                  opacity: dropIndex === visibleTeamCount ? 1 : 0,
                  backgroundColor: dropIndex === visibleTeamCount ? 'black' : 'white',
                }}
                className="rounded-r-full flex-1"
              />
            </div>

            {/* Hidden Teams Indicator */}
            {hiddenTeamCount > 0 && (
              <div 
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 border-t"
                style={{ position: 'sticky', left: 0, width: `${TEAMWIDTH + TASKWIDTH}px`, zIndex: 45 }}
              >
                <VisibilityOffIcon style={{ fontSize: 16 }} className="text-slate-500" />
                <span className="text-xs text-slate-600">
                  {hiddenTeamCount} hidden team(s)
                </span>
                <button
                  onClick={() => showAllHiddenTeams()}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Show all
                </button>
              </div>
            )}

            {/* SVG Layer for Connections - ABOVE day grid */}
            <svg
              className="absolute top-0 left-0 w-full h-full"
              style={{ zIndex: 10, pointerEvents: 'none' }}
            >
              <defs>
                <style>
                  {`
                    @keyframes flowAnimation {
                      from { stroke-dashoffset: 24; }
                      to { stroke-dashoffset: 0; }
                    }
                    @keyframes blockedPulse {
                      0%, 100% { opacity: 1; stroke-width: 5; }
                      50% { opacity: 0.5; stroke-width: 3; }
                    }
                  `}
                </style>
              </defs>

              {!hideAllDependencies && connections.map((conn) => {
                const sourcePos = getMilestoneHandlePosition(conn.source, "source");
                const targetPos = getMilestoneHandlePosition(conn.target, "target");

                if (!sourcePos || !targetPos) return null;

                // Check if we should hide dependencies for collapsed tasks
                if (hideCollapsedDependencies) {
                  const sourceMilestone = milestones[conn.source];
                  const targetMilestone = milestones[conn.target];
                  if (sourceMilestone && targetMilestone) {
                    const sourceTaskId = sourceMilestone.task;
                    const targetTaskId = targetMilestone.task;
                    const sourceTaskCollapsed = taskDisplaySettings[sourceTaskId]?.size === 'small';
                    const targetTaskCollapsed = taskDisplaySettings[targetTaskId]?.size === 'small';
                    if (sourceTaskCollapsed || targetTaskCollapsed) return null;
                  }
                }

                const isSelected = selectedConnection?.source === conn.source && 
                                   selectedConnection?.target === conn.target;
                
                // Determine if this connection is related to any selected milestone
                const isOutgoing = selectedMilestones.size > 0 && selectedMilestones.has(conn.source);
                const isIncoming = selectedMilestones.size > 0 && selectedMilestones.has(conn.target);
                
                // Check if this connection is being highlighted as blocked
                const isBlockedHighlight = blockedMoveHighlight && 
                  blockedMoveHighlight.connectionSource === conn.source &&
                  blockedMoveHighlight.connectionTarget === conn.target;
                
                // Determine stroke color based on selection state
                let strokeColor = "#374151"; // default gray
                if (isBlockedHighlight) {
                  strokeColor = "#dc2626"; // red for blocked
                } else if (isSelected) {
                  strokeColor = "#6366f1"; // indigo when connection is selected
                } else if (isOutgoing) {
                  strokeColor = "#22c55e"; // green for outgoing edges
                } else if (isIncoming) {
                  strokeColor = "#ef4444"; // red for incoming edges
                }
                
                const isHighlighted = isSelected || isOutgoing || isIncoming || isBlockedHighlight;

                return (
                  <g key={`${conn.source}-${conn.target}`} style={{ pointerEvents: 'auto' }}>
                    {/* Invisible wider path for easier clicking */}
                    <path
                      d={getConnectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                      stroke="transparent"
                      strokeWidth="20"
                      fill="none"
                      style={{ cursor: "pointer" }}
                      onClick={(e) => handleConnectionClick(e, conn)}
                    />
                    {/* Visible animated path */}
                    <path
                      d={getConnectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                      stroke={strokeColor}
                      strokeWidth={isBlockedHighlight ? "5" : isHighlighted ? "3.5" : "2.5"}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray="8, 4"
                      style={{
                        animation: isBlockedHighlight 
                          ? "flowAnimation 3s linear infinite, blockedPulse 0.5s ease-in-out infinite"
                          : "flowAnimation 3s linear infinite",
                        pointerEvents: "none",
                        filter: isHighlighted ? `drop-shadow(0 0 3px ${strokeColor}80)` : "none",
                      }}
                    />
                  </g>
                );
              })}

              {isDraggingConnection && connectionStart && (
                <path
                  d={getStraightPath(connectionStart.x, connectionStart.y, connectionEnd.x, connectionEnd.y)}
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.7"
                  style={{ pointerEvents: "none" }}
                />
              )}
            </svg>

            {/* Milestones Layer - ABOVE connections */}
            <div
              className="absolute top-0 left-0 w-full h-full"
              style={{ zIndex: 15, pointerEvents: 'none' }}
            >
              {teamOrder.map((team_key) => {
                const team = teams[team_key];
                if (!team || !isTeamVisible(team_key)) return null;
                
                // Don't render milestones for collapsed teams
                if (isTeamCollapsed(team_key)) return null;

                const visibleTasks = getVisibleTasks(team_key);
                
                // Don't render milestones if all tasks are hidden
                if (visibleTasks.length === 0) return null;

                return team.tasks.map((task_key) => {
                  if (!isTaskVisible(task_key, taskDisplaySettings)) return null;

                  const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                  const isSmall = taskDisplaySettings[task_key]?.size === 'small';

                  // Hide milestones for collapsed tasks if setting is enabled
                  if (hideCollapsedMilestones && isSmall) return null;

                  // Calculate Y position for this task
                  const teamYOffset = getTeamYOffset(team_key);
                  const taskYOffset = getTaskYOffset(task_key, team_key);
                  const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
                  const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
                  const taskY = teamYOffset + dropHighlightOffset + headerOffset + taskYOffset;

                  return tasks[task_key]?.milestones?.map((milestone_from_task) => {
                    const milestone = milestones[milestone_from_task.id];
                    if (!milestone) return null;

                    const showDelete = hoveredMilestone === milestone.id && viewMode === "milestone";
                    const showDurationPlus = hoveredMilestone === milestone.id && mode === "duration";
                    const showDurationMinus = hoveredMilestone === milestone.id && mode === "duration" && milestone.duration > 1;
                    const showConnect = mode === "connect";
                    const isSelected = selectedMilestones.has(milestone.id);
                    const isEditing = editingMilestoneId === milestone.id;
                    const showEdgeResize = viewMode === "dependency" && hoveredMilestone === milestone.id;
                    const isBlockedHighlight = blockedMoveHighlight?.milestoneId === milestone.id;

                    return (
                      <div
                        onMouseDown={(e) => {
                          if (mode !== "connect" && !isEditing) {
                            handleMileStoneMouseDown(e, milestone_from_task.id);
                          }
                        }}
                        onClick={(e) => {
                          if (mode === "drag" && !isEditing) {
                            handleMilestoneClick(e, milestone.id);
                          }
                        }}
                        onDoubleClick={(e) => handleMilestoneDoubleClick(e, milestone)}
                        onMouseEnter={() => setHoveredMilestone(milestone.id)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                        className={`absolute rounded cursor-pointer ${
                          isBlockedHighlight 
                            ? 'ring-2 ring-red-500 ring-offset-1 shadow-lg animate-pulse'
                            : isSelected 
                              ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg' 
                              : 'hover:brightness-95'
                        }`}
                        style={{
                          pointerEvents: 'auto',
                          overflow: 'visible',
                          left: `${TEAMWIDTH + TASKWIDTH + (milestone.x ?? (milestone.start_index * DAYWIDTH))}px`,
                          top: `${taskY}px`,
                          width: `${DAYWIDTH * milestone.duration}px`,
                          height: `${taskHeight}px`,
                          backgroundColor: isBlockedHighlight ? '#dc2626' : isSelected ? '#3b82f6' : team.color,
                          boxShadow: isBlockedHighlight
                            ? '0 4px 12px rgba(220, 38, 38, 0.5)'
                            : isSelected 
                              ? '0 4px 12px rgba(59, 130, 246, 0.4)' 
                              : '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                        key={milestone.id}
                      >
                        {/* Milestone name / edit input */}
                        {isEditing ? (
                          <div className="h-full flex items-center justify-center px-1">
                            <input
                              autoFocus
                              type="text"
                              value={editingMilestoneName}
                              onChange={(e) => setEditingMilestoneName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleMilestoneRenameSubmit(milestone.id);
                                } else if (e.key === 'Escape') {
                                  setEditingMilestoneId(null);
                                  setEditingMilestoneName("");
                                }
                              }}
                              onBlur={() => handleMilestoneRenameSubmit(milestone.id)}
                              className={`w-full bg-white/90 rounded px-1 text-slate-900 outline-none ${isSmall ? 'text-[9px]' : 'text-[11px]'}`}
                              style={{ pointerEvents: 'auto' }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        ) : (
                          <div className={`h-full flex items-center justify-center overflow-hidden px-1 ${isSmall ? 'text-[9px]' : 'text-[11px]'}`}>
                            <span className={`truncate font-medium ${isSelected ? 'text-white' : ''}`}>
                              {milestone.name}
                            </span>
                          </div>
                        )}

                        {/* Delete icon - only in milestone mode, tiny and top-right */}
                        {showDelete && (
                          <div 
                            className="absolute -top-1 -right-1 bg-slate-400/60 rounded-full cursor-pointer hover:bg-red-500 transition-all"
                            style={{ pointerEvents: 'auto', padding: '1px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmModal({ milestoneId: milestone.id, milestoneName: milestone.name });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Delete milestone"
                          >
                            <CloseIcon style={{ fontSize: 8, color: 'white' }} />
                          </div>
                        )}

                        {/* Edge resize handles - only in milestone mode */}
                        {viewMode === "milestone" && (
                          <>
                            {/* Left edge resize handle */}
                            <div
                              className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                              style={{ pointerEvents: 'auto', zIndex: 5 }}
                              onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "left")}
                            />
                            {/* Right edge resize handle */}
                            <div
                              className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                              style={{ pointerEvents: 'auto', zIndex: 5 }}
                              onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "right")}
                            />
                          </>
                        )}

                        {/* Connection handles - only in dependency mode */}
                        {viewMode === "dependency" && !safeMode && (
                          <>
                            {/* Target handle (left) */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                                showConnect 
                                  ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                                  : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                              }`}
                              style={{ pointerEvents: 'auto', zIndex: 10 }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleConnectionDragStart(e, milestone.id, "target");
                              }}
                            />
                            {/* Source handle (right) */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                                showConnect 
                                  ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                                  : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                              }`}
                              style={{ pointerEvents: 'auto', zIndex: 10 }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleConnectionDragStart(e, milestone.id, "source");
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  });
                });
              })}
            </div>

            {/* Task Ghost */}
            {taskGhost && (
              <div
                className="absolute rounded border border-blue-400 bg-blue-100/90 shadow-lg flex items-center px-2 text-sm font-medium text-blue-900 pointer-events-none"
                style={{
                  height: `${taskGhost.height}px`,
                  width: `${taskGhost.width}px`,
                  left: `${taskGhost.x}px`,
                  top: `${taskGhost.y}px`,
                  zIndex: 100,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {taskGhost.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
