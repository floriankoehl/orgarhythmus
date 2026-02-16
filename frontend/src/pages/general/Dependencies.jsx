import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetch_project_details,
  fetch_project_teams,
  safe_team_order,
  fetch_project_tasks,
  get_all_milestones,
  add_milestone,
  update_start_index,
  delete_milestone,
  change_duration,
  rename_milestone,
  get_all_dependencies,
  create_dependency,
  delete_dependency_api,
  reorder_team_tasks,
  get_project_days,
  set_day_purpose,
} from '../../api/dependencies_api.js';
import {
  createTeamForProject,
  createTaskForProject,
} from '../../api/org_API.js';
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
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';

// Height constants (defaults)
const DEFAULT_TASKHEIGHT_NORMAL = 32;
const DEFAULT_TASKHEIGHT_SMALL = 22;
const TASKWIDTH = 200;

const TEAMWIDTH = 150;

const TEAM_DRAG_HIGHLIGHT_HEIGHT = 5;
const MARIGN_BETWEEN_DRAG_HIGHLIGHT = 5;

const DEFAULT_DAYWIDTH = 60;
const HEADER_HEIGHT = 48;
const TASK_DROP_INDICATOR_HEIGHT = 3;

// Connection constants
const CONNECTION_RADIUS = 20;

// Threshold for showing day name abbreviation
const DAY_NAME_WIDTH_THRESHOLD = 45;

function daysBetween(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const diffMs = endDate - startDate
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return diffDays
}

// Helper to check if task is visible
const isTaskVisible = (taskId, taskDisplaySettings) => {
  const settings = taskDisplaySettings[taskId];
  return settings ? !settings.hidden : true;
};

export default function Dependencies() {
    
  const { projectId } = useParams();

  const [days, setDays] = useState(null)
  const [projectStartDate, setProjectStartDate] = useState(null)
  const [milestones, setMilestones] = useState({})
  const [hoveredMilestone, setHoveredMilestone] = useState(null)
  const [selectedMilestone, setSelectedMilestone] = useState(null)

  const [teamOrder, setTeamOrder] = useState([]);
  const [teams, setTeams] = useState({});
  const [ghost, setGhost] = useState(null);
  const teamContainerRef = useRef(null);
  const [dropIndex, setDropIndex] = useState(null);

  const [tasks, setTasks] = useState({});

  const [reloadData, setReloadData] = useState(false)

  // Connection state
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);

  // Task drag state
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, setTaskDropTarget] = useState(null);

  // Cross-team move confirmation modal
  const [moveModal, setMoveModal] = useState(null);

  // Display settings for tasks: { [taskId]: { size: 'normal' | 'small', hidden: boolean } }
  const [taskDisplaySettings, setTaskDisplaySettings] = useState({});

  // Display settings for teams: { [teamId]: { hidden: boolean, collapsed: boolean } }
  const [teamDisplaySettings, setTeamDisplaySettings] = useState({});

  // Team settings dropdown
  const [openTeamSettings, setOpenTeamSettings] = useState(null);

  // Team filter - empty array means show all teams
  const [teamFilter, setTeamFilter] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // View mode: "dependency" or "milestone"
  const [viewMode, setViewMode] = useState("dependency");

  // Milestone editing state
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

  // Day cell hover state for milestone creation
  const [hoveredDayCell, setHoveredDayCell] = useState(null); // { taskId, dayIndex }
  
  // Milestone creation confirmation modal
  const [milestoneCreateModal, setMilestoneCreateModal] = useState(null); // { taskId, dayIndex }

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

  // Days data from backend
  const [projectDays, setProjectDays] = useState({}); // { dayIndex: { purpose, is_sunday, day_name_short, ... } }
  
  // Day purpose modal
  const [dayPurposeModal, setDayPurposeModal] = useState(null); // { dayIndex, currentPurpose }
  const [newDayPurpose, setNewDayPurpose] = useState("");

  // Dynamic constants based on settings
  const DAYWIDTH = customDayWidth;
  const TASKHEIGHT_NORMAL = customTaskHeightNormal;
  const TASKHEIGHT_SMALL = customTaskHeightSmall;

  // Helper to get task height (using current settings)
  const getTaskHeight = (taskId, taskDisplaySettings) => {
    const settings = taskDisplaySettings[taskId];
    if (!settings || settings.hidden) return 0;
    return settings.size === 'small' ? TASKHEIGHT_SMALL : TASKHEIGHT_NORMAL;
  };


  // ________Global Event Listener___________
  // ________________________________________

  const [mode, setMode] = useState("drag")

  // Safe mode - prevents any data changes, only appearance changes allowed
  const [safeMode, setSafeMode] = useState(false);

  // Store previous viewMode when shift is pressed
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey) setMode("delete")
      else if (e.shiftKey) {
        setMode("duration")
        // Switch to milestone mode when shift is held
        prevViewModeRef.current = viewMode;
        setViewMode("milestone");
      }
      else if (e.altKey) setMode("connect")
    }

    const up = (e) => {
      setMode("drag")
      // Restore previous view mode when shift is released
      if (!e.shiftKey && prevViewModeRef.current !== viewMode) {
        setViewMode(prevViewModeRef.current);
      }
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [viewMode])

  // Close team settings when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenTeamSettings(null);
    };
    if (openTeamSettings !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openTeamSettings]);


  // ________________Loading_________________
  // ________________________________________

  useEffect(() => {
    const load_all = async () => {
        const resProjcet = await fetch_project_details(projectId);
        const project = resProjcet.project
        const start_date = project.start_date
        const end_date = project.end_date

        const num_days = daysBetween(start_date, end_date)
        setDays(num_days)
        setProjectStartDate(new Date(start_date))

      const resTeams = await fetch_project_teams(projectId);
      const fetched_teams = resTeams.teams;

      const newTeamOrder = [];
      const teamObject = {};
      const initialTeamDisplaySettings = {};

      for (const team of fetched_teams) {
        newTeamOrder.push(team.id);
        teamObject[team.id] = {
          ...team,
          tasks: [],
        };
        initialTeamDisplaySettings[team.id] = { hidden: false };
      }

      const resTasks = await fetch_project_tasks(projectId);
      const initialTaskDisplaySettings = {};

      for (const team_id in teamObject) {
        const teamTasks = resTasks.taskOrder?.[String(team_id)] || [];
        teamObject[team_id].tasks = teamTasks;
        
        // Initialize display settings for each task
        for (const taskId of teamTasks) {
          initialTaskDisplaySettings[taskId] = { size: 'normal', hidden: false };
        }
      }

      const resMilestones = await get_all_milestones(projectId);
      const fetched_Milestones = resMilestones.milestones;

      const updated_milestones = {}
      if (Array.isArray(fetched_Milestones)) {
        for (let i = 0; i < fetched_Milestones.length; i++) {
          const milestone = fetched_Milestones[i]
          updated_milestones[milestone.id] = {
            ...milestone, 
            display: "default"
          }
        }
      }

      // Load project days
      try {
        const resDays = await get_project_days(projectId);
        setProjectDays(resDays.days || {});
      } catch (err) {
        console.error("Failed to load project days:", err);
        setProjectDays({});
      }

      setTeamOrder(newTeamOrder);
      setTeams(teamObject);
      setTasks(resTasks.tasks);
      setMilestones(updated_milestones);
      setTaskDisplaySettings(initialTaskDisplaySettings);
      setTeamDisplaySettings(initialTeamDisplaySettings);

      try {
        const resDeps = await get_all_dependencies(projectId);
        const fetched_deps = resDeps.dependencies;
        if (Array.isArray(fetched_deps)) {
          setConnections(fetched_deps.map(d => ({ source: d.source, target: d.target })));
        }
      } catch (err) {
        console.error("Failed to load dependencies:", err);
        setConnections([]);
      }
    };

    load_all();
    setReloadData(false)
  }, [reloadData, projectId]);


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
  
  const getTeamHeight = (teamId) => {
    const team = teams[teamId];
    if (!team) return TEAM_MIN_HEIGHT;
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings);
    }
    return Math.max(height, TEAM_MIN_HEIGHT);
  };

  const getRawTeamHeight = (teamId) => {
    const team = teams[teamId];
    if (!team) return 0;
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings);
    }
    return height;
  };

  const isTeamVisible = (teamId) => {
    // Check teamFilter first - if filter is active and this team isn't in it, hide it
    if (teamFilter.length > 0 && !teamFilter.includes(teamId)) return false;
    
    const settings = teamDisplaySettings[teamId];
    if (settings?.hidden) return false;
    
    const team = teams[teamId];
    if (!team || team.tasks.length === 0) return true;
    
    const hasVisibleTask = team.tasks.some(taskId => isTaskVisible(taskId, taskDisplaySettings));
    return hasVisibleTask;
  };

  const getVisibleTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return [];
    return team.tasks.filter(taskId => isTaskVisible(taskId, taskDisplaySettings));
  };

  const getHiddenTeamCount = () => {
    return teamOrder.filter(tid => !isTeamVisible(tid)).length;
  };

  const visibleTeamCount = teamOrder.filter(tid => isTeamVisible(tid)).length;
  const hiddenTeamCount = getHiddenTeamCount();

  // Calculate content height
  const contentHeight = useMemo(() => {
    let height = HEADER_HEIGHT;
    for (const teamId of teamOrder) {
      if (!isTeamVisible(teamId)) continue;
      height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      height += getTeamHeight(teamId);
    }
    height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    return height;
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, TASKHEIGHT_NORMAL, TASKHEIGHT_SMALL]);

  // Get visible team index (accounting for hidden teams)
  const getVisibleTeamIndex = (teamId) => {
    let index = 0;
    for (const tid of teamOrder) {
      if (tid === teamId) return index;
      if (isTeamVisible(tid)) index++;
    }
    return index;
  };

  // Get Y offset for a team
  const getTeamYOffset = (teamId) => {
    let offset = HEADER_HEIGHT;
    for (const tid of teamOrder) {
      if (tid === teamId) break;
      if (!isTeamVisible(tid)) continue;
      offset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      offset += getTeamHeight(tid);
    }
    return offset;
  };

  // Get Y offset for a task within its team
  const getTaskYOffset = (taskId, teamId) => {
    const team = teams[teamId];
    if (!team) return 0;
    let offset = 0;
    for (const tid of team.tasks) {
      if (tid === taskId) break;
      if (!isTaskVisible(tid, taskDisplaySettings)) continue;
      offset += getTaskHeight(tid, taskDisplaySettings);
    }
    return offset;
  };

  // Get task drop indicator Y position
  const getTaskDropIndicatorY = () => {
    if (!taskDropTarget) return 0;
    const { teamId, insertIndex } = taskDropTarget;
    const teamYOffset = getTeamYOffset(teamId);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    
    const visibleTasks = getVisibleTasks(teamId);
    let taskOffset = 0;
    for (let i = 0; i < insertIndex && i < visibleTasks.length; i++) {
      taskOffset += getTaskHeight(visibleTasks[i], taskDisplaySettings);
    }
    
    return teamYOffset + dropHighlightOffset + taskOffset;
  };

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

  // Handle team drag
  const handleTeamDrag = (e, teamId, orderIndex) => {
    if (safeMode) return;
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const team = teams[teamId];
    const teamHeight = getTeamHeight(teamId);
    const startY = e.clientY;

    // Track current drop index in closure variable
    let currentDropIndex = null;

    setGhost({
      id: teamId,
      name: team.name,
      color: team.color,
      height: teamHeight,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const y = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y } : null);

      // Calculate drop index
      let accumulatedHeight = HEADER_HEIGHT;
      let newDropIndex = 0;
      
      for (let i = 0; i < teamOrder.length; i++) {
        const tid = teamOrder[i];
        if (!isTeamVisible(tid)) continue;
        
        const dropHighlightHeight = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        const tHeight = getTeamHeight(tid);
        const midPoint = accumulatedHeight + dropHighlightHeight + tHeight / 2;
        
        if (y < midPoint) {
          currentDropIndex = newDropIndex;
          setDropIndex(newDropIndex);
          return;
        }
        
        accumulatedHeight += dropHighlightHeight + tHeight;
        newDropIndex++;
      }
      currentDropIndex = newDropIndex;
      setDropIndex(newDropIndex);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Get visible index for the dragged team
      const visibleOrderIndex = getVisibleTeamIndex(teamId);

      if (currentDropIndex !== null && currentDropIndex !== visibleOrderIndex) {
        // Build new order based on visible teams
        const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
        const hiddenTeams = teamOrder.filter(tid => !isTeamVisible(tid));
        
        // Remove the dragged team from visible teams
        const draggedTeamIdx = visibleTeams.indexOf(teamId);
        visibleTeams.splice(draggedTeamIdx, 1);
        
        // Insert at new position
        const insertAt = currentDropIndex > draggedTeamIdx ? currentDropIndex - 1 : currentDropIndex;
        visibleTeams.splice(insertAt, 0, teamId);
        
        // Reconstruct full order: visible teams first, then hidden
        const newOrder = [...visibleTeams, ...hiddenTeams];
        
        setTeamOrder(newOrder);
        try {
          await safe_team_order(projectId, newOrder);
        } catch (err) {
          console.error("Failed to save team order:", err);
        }
      }

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle task drag
  const handleTaskDrag = (e, taskId, teamId, taskIndex) => {
    if (safeMode) return;
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const task = tasks[taskId];
    const taskHeight = getTaskHeight(taskId, taskDisplaySettings);

    // Track current drop target in closure variable
    let currentDropTarget = null;

    setTaskGhost({
      taskKey: taskId,
      fromTeamId: teamId,
      name: task?.name || 'Task',
      height: taskHeight,
      width: TASKWIDTH,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setTaskGhost(prev => prev ? { ...prev, x, y } : null);

      // Find which team we're over
      let accumulatedHeight = HEADER_HEIGHT;
      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        
        const dropHighlightHeight = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        const tHeight = getTeamHeight(tid);
        const teamTop = accumulatedHeight + dropHighlightHeight;
        const teamBottom = teamTop + tHeight;
        
        if (y >= teamTop && y < teamBottom) {
          // We're over this team, find insert index
          const visibleTasks = getVisibleTasks(tid);
          let insertIndex = 0;
          let taskAccHeight = 0;
          const relativeY = y - teamTop;
          
          for (let i = 0; i < visibleTasks.length; i++) {
            const tHeight = getTaskHeight(visibleTasks[i], taskDisplaySettings);
            if (relativeY < taskAccHeight + tHeight / 2) {
              break;
            }
            taskAccHeight += tHeight;
            insertIndex = i + 1;
          }
          
          currentDropTarget = { teamId: tid, insertIndex };
          setTaskDropTarget({ teamId: tid, insertIndex });
          return;
        }
        
        accumulatedHeight += dropHighlightHeight + tHeight;
      }
      currentDropTarget = null;
      setTaskDropTarget(null);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (currentDropTarget) {
        const { teamId: targetTeamId, insertIndex } = currentDropTarget;
        const sourceTeamId = teamId; // Use the closure variable, not state
        
        if (targetTeamId !== sourceTeamId) {
          // Cross-team move - show confirmation modal
          setMoveModal({
            taskId,
            taskName: task?.name,
            sourceTeamId,
            sourceTeamName: teams[sourceTeamId]?.name,
            targetTeamId,
            targetTeamName: teams[targetTeamId]?.name,
            insertIndex,
          });
        } else {
          // Same team reorder
          const team = teams[targetTeamId];
          const visibleTasks = getVisibleTasks(targetTeamId);
          const currentIndex = visibleTasks.indexOf(taskId);
          
          if (currentIndex !== insertIndex && currentIndex !== insertIndex - 1) {
            const newOrder = [...team.tasks];
            const taskCurrentIndex = newOrder.indexOf(taskId);
            newOrder.splice(taskCurrentIndex, 1);
            
            // Calculate actual insert position
            let actualInsertIndex = 0;
            let visibleCount = 0;
            for (let i = 0; i < team.tasks.length; i++) {
              if (team.tasks[i] === taskId) continue;
              if (isTaskVisible(team.tasks[i], taskDisplaySettings)) {
                if (visibleCount === insertIndex) {
                  actualInsertIndex = i;
                  break;
                }
                visibleCount++;
              }
              actualInsertIndex = i + 1;
            }
            
            newOrder.splice(actualInsertIndex, 0, taskId);
            
            setTeams(prev => ({
              ...prev,
              [targetTeamId]: { ...prev[targetTeamId], tasks: newOrder }
            }));
            
            try {
              await reorder_team_tasks(projectId, taskId, targetTeamId, newOrder);
            } catch (err) {
              console.error("Failed to reorder tasks:", err);
            }
          }
        }
      }

      setTaskGhost(null);
      setTaskDropTarget(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle milestone mouse down (drag)
  const handleMileStoneMouseDown = (e, milestoneId) => {
    if (safeMode) return;
    
    if (mode === "delete") {
      handleMilestoneDelete(milestoneId);
      return;
    }

    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    const startX = e.clientX;
    const startIndex = milestone.start_index;
    const startVisualX = startIndex * DAYWIDTH;

    // Track the visual X position (smooth) and snapped index
    let currentVisualX = startVisualX;
    let currentIndex = startIndex;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Update visual position smoothly (no snapping during drag)
      currentVisualX = Math.max(0, startVisualX + deltaX);
      // Calculate what the snapped index would be (for mouseUp)
      currentIndex = Math.max(0, Math.round(currentVisualX / DAYWIDTH));

      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          x: currentVisualX, // Use visual X position during drag
        }
      }));
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Snap to final index
      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          start_index: currentIndex,
          x: undefined, // Clear visual X so it uses start_index * DAYWIDTH
        }
      }));

      // Only save if position actually changed
      if (currentIndex !== startIndex) {
        try {
          await update_start_index(projectId, milestoneId, currentIndex);
        } catch (err) {
          console.error("Failed to update milestone position:", err);
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle milestone delete
  const handleMilestoneDelete = async (milestoneId) => {
    try {
      await delete_milestone(projectId, milestoneId);
      
      // Remove from milestones state
      setMilestones(prev => {
        const updated = { ...prev };
        delete updated[milestoneId];
        return updated;
      });

      // Remove from tasks
      setTasks(prev => {
        const updated = { ...prev };
        for (const taskId of Object.keys(updated)) {
          if (updated[taskId]?.milestones) {
            updated[taskId] = {
              ...updated[taskId],
              milestones: updated[taskId].milestones.filter(m => m.id !== milestoneId)
            };
          }
        }
        return updated;
      });

      // Remove connections involving this milestone
      setConnections(prev => prev.filter(c => c.source !== milestoneId && c.target !== milestoneId));
    } catch (err) {
      console.error("Failed to delete milestone:", err);
    }
  };

  // Handle milestone click (selection)
  const handleMilestoneClick = (e, milestoneId) => {
    e.stopPropagation();
    setSelectedMilestone(prev => prev === milestoneId ? null : milestoneId);
  };

  // Handle milestone double click (rename)
  const handleMilestoneDoubleClick = (e, milestone) => {
    e.stopPropagation();
    setEditingMilestoneId(milestone.id);
    setEditingMilestoneName(milestone.name);
  };

  // Handle milestone rename submit
  const handleMilestoneRenameSubmit = async (milestoneId) => {
    if (!editingMilestoneName.trim()) {
      setEditingMilestoneId(null);
      setEditingMilestoneName("");
      return;
    }

    try {
      await rename_milestone(projectId, milestoneId, editingMilestoneName.trim());
      
      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          name: editingMilestoneName.trim()
        }
      }));
    } catch (err) {
      console.error("Failed to rename milestone:", err);
    }

    setEditingMilestoneId(null);
    setEditingMilestoneName("");
  };

  // Handle milestone edge resize
  const handleMilestoneEdgeResize = (e, milestoneId, edge) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    const startX = e.clientX;
    const startDuration = milestone.duration;
    const startIndex = milestone.start_index;

    // Track current values in closure variables
    let currentDuration = startDuration;
    let currentStartIndex = startIndex;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / DAYWIDTH);

      if (edge === "right") {
        currentDuration = Math.max(1, startDuration + indexDelta);
        setMilestones(prev => ({
          ...prev,
          [milestoneId]: { ...prev[milestoneId], duration: currentDuration }
        }));
      } else if (edge === "left") {
        currentStartIndex = Math.max(0, startIndex + indexDelta);
        const durationChange = startIndex - currentStartIndex;
        currentDuration = Math.max(1, startDuration + durationChange);
        setMilestones(prev => ({
          ...prev,
          [milestoneId]: { 
            ...prev[milestoneId], 
            start_index: currentStartIndex,
            duration: currentDuration 
          }
        }));
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save duration change if it changed
      const durationChange = currentDuration - startDuration;
      if (durationChange !== 0) {
        try {
          await change_duration(projectId, milestoneId, durationChange);
        } catch (err) {
          console.error("Failed to change duration:", err);
        }
      }

      // Save start index change if it changed (only for left edge)
      if (edge === "left" && currentStartIndex !== startIndex) {
        try {
          await update_start_index(projectId, milestoneId, currentStartIndex);
        } catch (err) {
          console.error("Failed to update start index:", err);
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle day cell click (create milestone in milestone mode)
  const handleDayCellClick = (taskId, dayIndex) => {
    if (safeMode) return;
    // Show confirmation modal instead of creating directly
    setMilestoneCreateModal({ taskId, dayIndex });
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
  };

  // Connection handling
  const handleConnectionDragStart = (e, milestoneId, handleType) => {
    if (safeMode) return;
    e.stopPropagation();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setIsDraggingConnection(true);
    setConnectionStart({
      milestoneId,
      handleType,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });

    // Use requestAnimationFrame for smoother updates
    let rafId = null;
    let lastX = e.clientX - containerRect.left;
    let lastY = e.clientY - containerRect.top;

    const onMouseMove = (moveEvent) => {
      lastX = moveEvent.clientX - containerRect.left;
      lastY = moveEvent.clientY - containerRect.top;
      
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setConnectionEnd({ x: lastX, y: lastY });
          rafId = null;
        });
      }
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Find if we're over a milestone handle
      const targetMilestone = findMilestoneAtPosition(
        upEvent.clientX - containerRect.left,
        upEvent.clientY - containerRect.top
      );

      if (targetMilestone && targetMilestone.id !== milestoneId) {
        const sourceId = handleType === "source" ? milestoneId : targetMilestone.id;
        const targetId = handleType === "source" ? targetMilestone.id : milestoneId;

        // Check if connection already exists
        const exists = connections.some(c => c.source === sourceId && c.target === targetId);
        if (!exists) {
          try {
            await create_dependency(projectId, sourceId, targetId);
            setConnections(prev => [...prev, { source: sourceId, target: targetId }]);
          } catch (err) {
            console.error("Failed to create dependency:", err);
          }
        }
      }

      setIsDraggingConnection(false);
      setConnectionStart(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Find milestone at position
  const findMilestoneAtPosition = (x, y) => {
    for (const [id, milestone] of Object.entries(milestones)) {
      const task = tasks[milestone.task];
      if (!task) continue;
      
      const team = teams[task.team];
      if (!team || !isTeamVisible(task.team)) continue;
      if (!isTaskVisible(milestone.task, taskDisplaySettings)) continue;

      const taskHeight = getTaskHeight(milestone.task, taskDisplaySettings);
      const teamYOffset = getTeamYOffset(task.team);
      const taskYOffset = getTaskYOffset(milestone.task, task.team);
      const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;

      const milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
      const milestoneY = teamYOffset + dropHighlightOffset + taskYOffset + taskHeight / 2;
      const milestoneWidth = DAYWIDTH * milestone.duration;

      if (
        x >= milestoneX - 10 &&
        x <= milestoneX + milestoneWidth + 10 &&
        y >= milestoneY &&
        y <= milestoneY + taskHeight
      ) {
        return { id: parseInt(id), ...milestone };
      }
    }
    return null;
  };

  // Get milestone handle position
  const getMilestoneHandlePosition = (milestoneId, handleType) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return null;

    const task = tasks[milestone.task];
    if (!task) return null;

    const team = teams[task.team];
    if (!team || !isTeamVisible(task.team)) return null;
    if (!isTaskVisible(milestone.task, taskDisplaySettings)) return null;

    const taskHeight = getTaskHeight(milestone.task, taskDisplaySettings);
    const teamYOffset = getTeamYOffset(task.team);
    const taskYOffset = getTaskYOffset(milestone.task, task.team);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;

    const milestoneX = TEAMWIDTH + TASKWIDTH + (milestone.x ?? milestone.start_index * DAYWIDTH);
    const milestoneY = teamYOffset + dropHighlightOffset + taskYOffset + taskHeight / 2;
    const milestoneWidth = DAYWIDTH * milestone.duration;

    if (handleType === "source") {
      return { x: milestoneX + milestoneWidth, y: milestoneY };
    } else {
      return { x: milestoneX, y: milestoneY };
    }
  };

  // Get connection path
  const getConnectionPath = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  };

  // Get straight path (for dragging)
  const getStraightPath = (x1, y1, x2, y2) => {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  };

  // Handle connection click
  const handleConnectionClick = (e, connection) => {
    e.stopPropagation();
    if (mode === "delete") {
      handleDeleteConnection(connection);
    } else {
      setSelectedConnection(connection);
    }
  };

  // Handle delete connection
  const handleDeleteConnection = async (connection) => {
    try {
      await delete_dependency_api(projectId, connection.source, connection.target);
      setConnections(prev => prev.filter(c => !(c.source === connection.source && c.target === connection.target)));
      setSelectedConnection(null);
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    }
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
          setSelectedMilestone(null);
        }}
      >
        {/* Control Board Toolbar */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-4 divide-x divide-slate-200">
            
            {/* Section 1: Settings */}
            <div className="p-3">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Settings
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* Safe Mode Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSafeMode(!safeMode);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                    safeMode 
                      ? 'border-amber-400 bg-amber-50 text-amber-700' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={safeMode ? "Safe mode is ON - data changes are prevented" : "Enable safe mode to prevent accidental changes"}
                >
                  <LockIcon style={{ fontSize: 14 }} />
                  <span>{safeMode ? 'Safe' : 'Edit'}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Collapse all visible teams
                    teamOrder.forEach(tid => {
                      if (isTeamVisible(tid)) setTeamTasksSmall(tid);
                    });
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  <UnfoldLessIcon style={{ fontSize: 14 }} />
                  <span>Collapse All</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Expand all visible teams
                    teamOrder.forEach(tid => {
                      if (isTeamVisible(tid)) setTeamTasksNormal(tid);
                    });
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  <UnfoldMoreIcon style={{ fontSize: 14 }} />
                  <span>Expand All</span>
                </button>
                {hiddenTeamCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showAllHiddenTeams();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                  >
                    <VisibilityIcon style={{ fontSize: 14 }} />
                    <span>Show {hiddenTeamCount} Hidden</span>
                  </button>
                )}
                
                {/* Advanced Settings Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsDropdown(!showSettingsDropdown);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                      showSettingsDropdown 
                        ? 'border-blue-300 bg-blue-50 text-blue-700' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <SettingsIcon style={{ fontSize: 14 }} />
                    <span>More</span>
                  </button>
                  
                  {showSettingsDropdown && (
                    <div 
                      className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-[1000]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-3">
                        {/* Visibility options */}
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Visibility</h4>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hideAllDependencies}
                                onChange={(e) => setHideAllDependencies(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span>Hide all dependencies</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hideCollapsedDependencies}
                                onChange={(e) => setHideCollapsedDependencies(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span>Hide dependencies for collapsed tasks</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hideCollapsedMilestones}
                                onChange={(e) => setHideCollapsedMilestones(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span>Hide milestones for collapsed tasks</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showEmptyTeams}
                                onChange={(e) => setShowEmptyTeams(e.target.checked)}
                                className="rounded border-slate-300"
                              />
                              <span>Show empty teams</span>
                            </label>
                          </div>
                        </div>
                        
                        <div className="border-t border-slate-100 pt-3">
                          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dimensions</h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-600">Day width</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="30"
                                  max="120"
                                  value={customDayWidth}
                                  onChange={(e) => setCustomDayWidth(Math.max(30, Math.min(120, parseInt(e.target.value) || DEFAULT_DAYWIDTH)))}
                                  className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                                />
                                <span className="text-xs text-slate-400">px</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-600">Task height (normal)</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="20"
                                  max="60"
                                  value={customTaskHeightNormal}
                                  onChange={(e) => setCustomTaskHeightNormal(Math.max(20, Math.min(60, parseInt(e.target.value) || DEFAULT_TASKHEIGHT_NORMAL)))}
                                  className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                                />
                                <span className="text-xs text-slate-400">px</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-600">Task height (collapsed)</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="14"
                                  max="40"
                                  value={customTaskHeightSmall}
                                  onChange={(e) => setCustomTaskHeightSmall(Math.max(14, Math.min(40, parseInt(e.target.value) || DEFAULT_TASKHEIGHT_SMALL)))}
                                  className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                                />
                                <span className="text-xs text-slate-400">px</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setCustomDayWidth(DEFAULT_DAYWIDTH);
                                setCustomTaskHeightNormal(DEFAULT_TASKHEIGHT_NORMAL);
                                setCustomTaskHeightSmall(DEFAULT_TASKHEIGHT_SMALL);
                              }}
                              className="w-full mt-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition"
                            >
                              Reset to defaults
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Mode Toggle */}
            <div className="p-3">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                View Mode {mode === "duration" && <span className="text-blue-500">(Shift)</span>}
              </h3>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode("dependency");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    viewMode === "dependency"
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <AccountTreeIcon style={{ fontSize: 14 }} />
                  <span>Dependencies</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode("milestone");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    viewMode === "milestone"
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FlagIcon style={{ fontSize: 14 }} />
                  <span>Milestones</span>
                </button>
              </div>
            </div>

            {/* Section 3: Filter */}
            <div className="p-3">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Team Filter
              </h3>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterDropdown(!showFilterDropdown);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                    teamFilter.length > 0
                      ? 'border-blue-300 bg-blue-50 text-blue-700' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FilterListIcon style={{ fontSize: 14 }} />
                  <span className="flex-1 text-left">
                    {teamFilter.length === 0 
                      ? 'All Teams' 
                      : `${teamFilter.length} team${teamFilter.length > 1 ? 's' : ''} selected`}
                  </span>
                  {teamFilter.length > 0 && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeamFilter([]);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      ✕
                    </span>
                  )}
                </button>
                
                {/* Team Filter Dropdown */}
                {showFilterDropdown && (
                  <div 
                    className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-[1000]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        Select Teams
                      </span>
                      {teamFilter.length > 0 && (
                        <button
                          onClick={() => setTeamFilter([])}
                          className="text-[10px] text-blue-600 hover:text-blue-800"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {teamOrder.map((teamId) => {
                        const team = teams[teamId];
                        if (!team) return null;
                        const isInFilter = teamFilter.includes(teamId);
                        const isVisible = teamFilter.length === 0 || isInFilter;
                        
                        return (
                          <button
                            key={teamId}
                            onClick={() => {
                              if (teamFilter.length === 0) {
                                setTeamFilter([teamId]);
                              } else if (isInFilter) {
                                const newFilter = teamFilter.filter(id => id !== teamId);
                                setTeamFilter(newFilter);
                              } else {
                                setTeamFilter([...teamFilter, teamId]);
                              }
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition text-left ${
                              isVisible 
                                ? 'bg-slate-50 text-slate-900' 
                                : 'text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="truncate flex-1">{team.name}</span>
                            {isInFilter && (
                              <span className="text-blue-600 text-[10px]">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    {teamOrder.length === 0 && (
                      <p className="text-xs text-slate-400 italic px-2 py-1">No teams</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Create */}
            <div className="p-3">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Create
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateTeamModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                >
                  <GroupAddIcon style={{ fontSize: 14 }} />
                  <span>New Team</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (teamOrder.length > 0) {
                      setNewTaskTeamId(teamOrder[0]);
                    }
                    setShowCreateTaskModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  disabled={teamOrder.length === 0}
                  title={teamOrder.length === 0 ? "Create a team first" : "Create a new task"}
                >
                  <PlaylistAddIcon style={{ fontSize: 14 }} />
                  <span>New Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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

                  {/* Team Row */}
                  <div className="flex">
                    {/* STICKY LEFT: Team + Tasks */}
                    <div
                      style={{
                        height: teamHeight,
                        width: `${TEAMWIDTH + TASKWIDTH}px`,
                        backgroundColor: isTargetTeam ? '#dbeafe' : `${team.color}40`,
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
                        className="flex flex-col bg-white/60"
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

                      {/* Tasks Column - only show when not collapsed */}
                      {!isTeamCollapsed(team_key) && (
                        <div className="flex flex-col bg-white/40">
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
                              {/* Day rendering - interactive in milestone mode */}
                              {[...Array(days)].map((_, i) => {
                                const isHovered = viewMode === "milestone" && 
                                  hoveredDayCell?.taskId === task_key && 
                                  hoveredDayCell?.dayIndex === i;
                                
                                return (
                                  <div
                                    className={`border-r border-slate-100 transition-colors ${
                                      viewMode === "milestone" ? 'cursor-pointer hover:bg-blue-50' : ''
                                    } ${isHovered ? 'bg-blue-100' : ''}`}
                                    style={{
                                      height: `${taskHeight}px`,
                                      width: `${DAYWIDTH}px`,
                                      opacity: ghost?.id === team_key ? 0.2 : 1,
                                      pointerEvents: viewMode === "milestone" ? 'auto' : 'none',
                                    }}
                                    key={i}
                                  onMouseEnter={() => viewMode === "milestone" && setHoveredDayCell({ taskId: task_key, dayIndex: i })}
                                  onMouseLeave={() => setHoveredDayCell(null)}
                                  onClick={() => viewMode === "milestone" && handleDayCellClick(task_key, i)}
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
                
                // Determine if this connection is related to the selected milestone
                const isOutgoing = selectedMilestone && conn.source === selectedMilestone;
                const isIncoming = selectedMilestone && conn.target === selectedMilestone;
                
                // Determine stroke color based on selection state
                let strokeColor = "#374151"; // default gray
                if (isSelected) {
                  strokeColor = "#6366f1"; // indigo when connection is selected
                } else if (isOutgoing) {
                  strokeColor = "#22c55e"; // green for outgoing edges
                } else if (isIncoming) {
                  strokeColor = "#ef4444"; // red for incoming edges
                }
                
                const isHighlighted = isSelected || isOutgoing || isIncoming;

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
                      strokeWidth={isHighlighted ? "3.5" : "2.5"}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray="8, 4"
                      style={{
                        animation: "flowAnimation 3s linear infinite",
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

                const visibleTasks = getVisibleTasks(team_key);

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
                  const taskY = teamYOffset + dropHighlightOffset + taskYOffset;

                  return tasks[task_key]?.milestones?.map((milestone_from_task) => {
                    const milestone = milestones[milestone_from_task.id];
                    if (!milestone) return null;

                    const showDelete = hoveredMilestone === milestone.id && mode === "delete";
                    const showDurationPlus = hoveredMilestone === milestone.id && mode === "duration";
                    const showDurationMinus = hoveredMilestone === milestone.id && mode === "duration" && milestone.duration > 1;
                    const showConnect = mode === "connect";
                    const isSelected = selectedMilestone === milestone.id;
                    const isEditing = editingMilestoneId === milestone.id;
                    const showEdgeResize = viewMode === "dependency" && hoveredMilestone === milestone.id;

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
                          isSelected 
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
                          backgroundColor: isSelected ? '#3b82f6' : team.color,
                          boxShadow: isSelected 
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

                        {/* Delete icon */}
                        {showDelete && (
                          <div 
                            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 shadow-md"
                            style={{ pointerEvents: 'auto' }}
                          >
                            <DeleteForeverIcon style={{ fontSize: 16, color: 'white' }} />
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
