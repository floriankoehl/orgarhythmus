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
import SettingsIcon from '@mui/icons-material/Settings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

// Height constants (defaults)
const DEFAULT_TASKHEIGHT_NORMAL = 32;
const DEFAULT_TASKHEIGHT_SMALL = 22;
const TASKWIDTH = 200;

const TEAMWIDTH = 150;

const TEAM_DRAG_HIGHLIGHT_HEIGHT = 5;
const MARIGN_BETWEEN_DRAG_HIGHLIGHT = 5;

const DEFAULT_DAYWIDTH = 60;
const HEADER_HEIGHT = 40;
const TASK_DROP_INDICATOR_HEIGHT = 3;

// Connection constants
const CONNECTION_RADIUS = 20;

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

  // Display settings for teams: { [teamId]: { hidden: boolean } }
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

  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey) setMode("delete")
      else if (e.shiftKey) {
        setMode("duration")
        setViewMode("milestone")
      }
      else if (e.altKey) setMode("connect")
    }

    const up = (e) => {
      setMode("drag")
      if (!e.shiftKey) {
        setViewMode("dependency")
      }
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

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
            // Don't pre-calculate x - it will be calculated dynamically based on current DAYWIDTH
            display: "default"
          }
        }
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


  // ________DISPLAY SETTINGS HELPERS________
  // ________________________________________

  // Calculate team height based on visible tasks and their sizes (with minimum)
  const getTeamHeight = (teamId) => {
    const team = teams[teamId];
    if (!team) return TASKHEIGHT_NORMAL; // Use dynamic minimum
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings);
    }
    // Ensure minimum height (use dynamic task height)
    return Math.max(height, TASKHEIGHT_NORMAL);
  };

  // Get raw team height (without minimum, for calculations)
  const getRawTeamHeight = (teamId) => {
    const team = teams[teamId];
    if (!team) return 0;
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings);
    }
    return height;
  };

  // Check if team is visible (hidden if manually hidden OR all tasks are hidden OR not in filter)
  const isTeamVisible = (teamId) => {
    // Check team filter first - if filter is active and team not in filter, hide it
    if (teamFilter.length > 0 && !teamFilter.includes(teamId)) return false;
    
    const settings = teamDisplaySettings[teamId];
    if (settings?.hidden) return false;
    
    // Check for empty teams
    const team = teams[teamId];
    if (!team) return false;
    if (team.tasks.length === 0) return showEmptyTeams; // Respect showEmptyTeams setting
    
    const hasVisibleTask = team.tasks.some(taskId => isTaskVisible(taskId, taskDisplaySettings));
    return hasVisibleTask;
  };

  // Check if team is manually hidden (not auto-hidden due to all tasks hidden)
  const isTeamManuallyHidden = (teamId) => {
    const settings = teamDisplaySettings[teamId];
    return settings?.hidden || false;
  };

  // Get visible tasks for a team
  const getVisibleTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return [];
    return team.tasks.filter(taskId => isTaskVisible(taskId, taskDisplaySettings));
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

  // Set all visible tasks in a team to small
  const setTeamTasksSmall = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        if (!updated[taskId]?.hidden) {
          updated[taskId] = { ...updated[taskId], size: 'small' };
        }
      }
      return updated;
    });
  };

  // Set all visible tasks in a team to normal
  const setTeamTasksNormal = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        if (!updated[taskId]?.hidden) {
          updated[taskId] = { ...updated[taskId], size: 'normal' };
        }
      }
      return updated;
    });
  };

  // Show all hidden tasks in a team
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

  // Hide all tasks in a team
  const hideAllTeamTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return;
    
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], hidden: true };
      }
      return updated;
    });
  };

  // Check if team has any hidden tasks
  const teamHasHiddenTasks = (teamId) => {
    const team = teams[teamId];
    if (!team) return false;
    return team.tasks.some(taskId => taskDisplaySettings[taskId]?.hidden);
  };

  // Check if all visible tasks in team are small
  const allVisibleTasksSmall = (teamId) => {
    const visibleTasks = getVisibleTasks(teamId);
    if (visibleTasks.length === 0) return false;
    return visibleTasks.every(taskId => taskDisplaySettings[taskId]?.size === 'small');
  };

  // Show all hidden teams
  const showAllHiddenTeams = () => {
    // First, unhide all manually hidden teams
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const tid of teamOrder) {
        updated[tid] = { ...updated[tid], hidden: false };
      }
      return updated;
    });
    
    // Then, show all tasks in teams that were auto-hidden
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const tid of teamOrder) {
        const team = teams[tid];
        if (!team) continue;
        for (const taskId of team.tasks) {
          updated[taskId] = { ...updated[taskId], hidden: false };
        }
      }
      return updated;
    });
  };

  // Count hidden teams (only teams that pass filter but are manually hidden or have all tasks hidden)
  const getHiddenTeamCount = () => {
    return teamOrder.filter(tid => {
      // If filter is active and team isn't in filter, don't count it as "hidden"
      if (teamFilter.length > 0 && !teamFilter.includes(tid)) return false;
      // Count as hidden if it would be hidden for other reasons
      return !isTeamVisible(tid);
    }).length;
  };


  // ________________TEAMS___________________
  // ________________________________________

  const safe_team_order_local = async (new_order) => {
    await safe_team_order(projectId, new_order);
  };

  const handleTeamDrag = (event, team_key, order_index) => {
    const team = teams[team_key];
    const from_index = order_index;
    let to_index = order_index;

    const parent = teamContainerRef.current;
    const parent_rect = parent.getBoundingClientRect();

    const startX = event.clientX - parent_rect.x;
    const startY = event.clientY - parent_rect.y;

    // Calculate the offset from the mouse to the top-left of the team row
    let teamTopOffset = HEADER_HEIGHT;
    
    // Get visible teams up to this one
    const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
    const visibleIndex = visibleTeams.indexOf(team_key);
    
    for (let i = 0; i < visibleIndex; i++) {
      const tid = visibleTeams[i];
      teamTopOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      teamTopOffset += getTeamHeight(tid);
    }
    teamTopOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    
    const mouseOffsetY = startY - teamTopOffset;
    const currentTeamHeight = getTeamHeight(team_key);

    // Track if we've started dragging (only show ghost after movement threshold)
    let isDragging = false;
    const DRAG_THRESHOLD = 5;

    const onMouseMove = (e) => {
      const new_y = e.clientY - parent_rect.y;

      // Check if we've moved enough to start dragging
      if (!isDragging) {
        const deltaX = Math.abs(e.clientX - parent_rect.x - startX);
        const deltaY = Math.abs(new_y - startY);
        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          isDragging = true;
          setGhost({
            id: team_key,
            name: team.name,
            color: team.color,
            height: currentTeamHeight,
            y: new_y - mouseOffsetY,
            offsetY: mouseOffsetY,
          });
        } else {
          return; // Don't do anything until threshold is met
        }
      } else {
        setGhost((prev) => ({
          ...prev,
          y: new_y - prev.offsetY,
        }));
      }

      const mouseY = e.clientY - parent_rect.top;

      // Calculate drop index based on accumulated heights (only visible teams)
      let accumulatedY = HEADER_HEIGHT;
      let index = visibleTeams.length;
      
      for (let i = 0; i < visibleTeams.length; i++) {
        const tid = visibleTeams[i];
        
        accumulatedY += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        
        const teamTop = accumulatedY;
        const teamHeight = getTeamHeight(tid);
        const teamMid = teamTop + teamHeight / 2;
        
        if (mouseY < teamMid) {
          index = i;
          break;
        }
        
        accumulatedY += teamHeight;
      }

      if (index === visibleIndex + 1) {
        index = visibleIndex;
      }

      const clamped = Math.max(0, Math.min(index, visibleTeams.length));
      to_index = clamped;
      if (isDragging) {
        setDropIndex(clamped);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Only reorder if we actually dragged
      if (!isDragging) {
        setGhost(null);
        setDropIndex(null);
        return;
      }

      // Convert visible index back to full teamOrder index
      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      
      let copy = [...teamOrder];
      const [moved] = copy.splice(order_index, 1);
      
      // Map visible index to actual index
      if (to_index >= visibleTeams.length) {
        // Insert at end
        copy.push(moved);
      } else {
        const targetTeamId = visibleTeams[to_index];
        const actualTargetIndex = copy.indexOf(targetTeamId);
        copy.splice(actualTargetIndex, 0, moved);
      }
      
      setTeamOrder(copy);
      safe_team_order_local(copy);

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };


  // ________________TASKS___________________
  // ________________________________________

  const handleTaskDrag = (event, taskKey, teamId, taskIndex) => {
    event.preventDefault();
    event.stopPropagation();

    const parent = teamContainerRef.current;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    const startX = event.clientX - parentRect.x;
    const startY = event.clientY - parentRect.y;

    const fromTeamId = teamId;
    const fromIndex = taskIndex;
    let currentTargetTeamId = teamId;
    let currentTargetIndex = taskIndex;

    const taskHeight = getTaskHeight(taskKey, taskDisplaySettings);

    setTaskGhost({
      taskKey,
      name: tasks[taskKey]?.name || 'Task',
      x: startX,
      y: startY,
      width: TASKWIDTH,
      height: taskHeight || TASKHEIGHT_NORMAL,
      fromTeamId: teamId,
    });
    setTaskDropTarget({ teamId, index: taskIndex });

    const onMouseMove = (e) => {
      const newX = e.clientX - parentRect.x;
      const newY = e.clientY - parentRect.y;

      setTaskGhost(prev => ({
        ...prev,
        x: newX,
        y: newY,
      }));

      const mouseY = e.clientY - parentRect.top;
      let accumulatedY = HEADER_HEIGHT;
      let foundTeamId = null;
      let foundTaskIndex = 0;

      // Only iterate visible teams
      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        
        const team = teams[tid];
        if (!team) continue;

        accumulatedY += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;

        const teamTop = accumulatedY;
        const teamHeight = getTeamHeight(tid);
        const teamBottom = teamTop + teamHeight;

        if (mouseY >= teamTop && mouseY < teamBottom) {
          foundTeamId = tid;
          
          // Find task index within this team (only visible tasks)
          const relY = mouseY - teamTop;
          let taskAccumulatedY = 0;
          const visibleTasks = getVisibleTasks(tid);
          
          foundTaskIndex = visibleTasks.length; // default to end
          for (let i = 0; i < visibleTasks.length; i++) {
            const tHeight = getTaskHeight(visibleTasks[i], taskDisplaySettings);
            if (relY < taskAccumulatedY + tHeight / 2) {
              foundTaskIndex = i;
              break;
            }
            taskAccumulatedY += tHeight;
          }
          break;
        }

        accumulatedY += teamHeight;
      }

      if (foundTeamId === null && teamOrder.length > 0) {
        const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
        if (visibleTeams.length > 0) {
          const lastTeamId = visibleTeams[visibleTeams.length - 1];
          foundTeamId = lastTeamId;
          foundTaskIndex = getVisibleTasks(lastTeamId).length;
        }
      }

      if (foundTeamId !== null) {
        currentTargetTeamId = foundTeamId;
        currentTargetIndex = foundTaskIndex;
        setTaskDropTarget({ teamId: foundTeamId, index: foundTaskIndex });
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      setTaskGhost(null);
      setTaskDropTarget(null);

      // Convert visible index to actual index in tasks array
      const getActualIndex = (tid, visibleIndex) => {
        const team = teams[tid];
        if (!team) return 0;
        
        const visibleTasks = getVisibleTasks(tid);
        if (visibleIndex >= visibleTasks.length) {
          // Insert at end of all tasks
          return team.tasks.length;
        }
        
        const targetTaskId = visibleTasks[visibleIndex];
        return team.tasks.indexOf(targetTaskId);
      };

      if (currentTargetTeamId === fromTeamId) {
        const teamTasks = [...teams[fromTeamId].tasks];
        const actualFromIndex = teamTasks.indexOf(taskKey);
        const [moved] = teamTasks.splice(actualFromIndex, 1);
        
        let actualTargetIndex = getActualIndex(fromTeamId, currentTargetIndex);
        if (actualFromIndex < actualTargetIndex) {
          actualTargetIndex = Math.max(0, actualTargetIndex - 1);
        }
        teamTasks.splice(actualTargetIndex, 0, moved);

        setTeams(prev => ({
          ...prev,
          [fromTeamId]: {
            ...prev[fromTeamId],
            tasks: teamTasks,
          },
        }));

        reorder_team_tasks(projectId, taskKey, fromTeamId, teamTasks).catch(err =>
          console.error("Failed to reorder tasks:", err)
        );
      } else {
        const sourceTeamTasks = [...teams[fromTeamId].tasks].filter(t => t !== taskKey);
        const targetTeamTasks = [...teams[currentTargetTeamId].tasks];
        
        const actualTargetIndex = getActualIndex(currentTargetTeamId, currentTargetIndex);
        targetTeamTasks.splice(actualTargetIndex, 0, taskKey);

        setMoveModal({
          taskId: taskKey,
          taskName: tasks[taskKey]?.name || 'Task',
          fromTeamId,
          fromTeamName: teams[fromTeamId]?.name || 'Unknown',
          toTeamId: currentTargetTeamId,
          toTeamName: teams[currentTargetTeamId]?.name || 'Unknown',
          newSourceOrder: sourceTeamTasks,
          newTargetOrder: targetTeamTasks,
        });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const confirmMoveTask = async () => {
    if (!moveModal) return;
    const { taskId, fromTeamId, toTeamId, newSourceOrder, newTargetOrder } = moveModal;

    setTeams(prev => ({
      ...prev,
      [fromTeamId]: {
        ...prev[fromTeamId],
        tasks: newSourceOrder,
      },
      [toTeamId]: {
        ...prev[toTeamId],
        tasks: newTargetOrder,
      },
    }));

    setTasks(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        team: toTeamId,
      },
    }));

    try {
      await reorder_team_tasks(projectId, taskId, toTeamId, newTargetOrder);
    } catch (err) {
      console.error("Failed to move task:", err);
      setReloadData(true);
    }

    setMoveModal(null);
  };

  const cancelMoveTask = () => {
    setMoveModal(null);
  };


  // _____________MILESTONES________________
  // ________________________________________

  const add_milestone_local = async (task_id) => {
    await add_milestone(projectId, task_id)
    setReloadData(true)
  }

  const handleMileStoneDrag = (event, milestone_key) => {
    event.preventDefault() 

    const currentX = milestones[milestone_key].x ?? (milestones[milestone_key].start_index * DAYWIDTH);
    const startX = event.clientX - currentX
    let new_x = currentX

    const onMouseMove = (e) => {
      if (e.ctrlKey) {
        onMouseUp()
        return 
      }

      new_x = e.clientX - startX

      if (new_x < 0) {
        new_x = 0
      }
      if (new_x + DAYWIDTH > days * DAYWIDTH) {
        new_x = days * DAYWIDTH - DAYWIDTH
      }

      setMilestones(prev => ({
        ...prev,
        [milestone_key]: {
          ...prev[milestone_key],
          x: new_x
        }
      }))
    }

    const onMouseUp = () => {
      const new_index = Math.round(new_x / DAYWIDTH)

      setMilestones(prev => ({
        ...prev,
        [milestone_key]: {
          ...prev[milestone_key],
          x: undefined, // Clear x so position is calculated from start_index
          start_index: new_index
        }
      }))

      update_start_index(projectId, milestone_key, new_index)

      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const handleMileStoneMouseDown = (e, id) => {
    if (mode === "drag") {
      return handleMileStoneDrag(e, id)
    }
    else if (mode === "delete") {
      setReloadData(true)
      // Deselect if deleting the selected milestone
      if (selectedMilestone === id) {
        setSelectedMilestone(null);
      }
      return delete_milestone(projectId, id)
    }
  }

  const handleMilestoneClick = (e, id) => {
    e.stopPropagation();
    // Toggle selection
    if (selectedMilestone === id) {
      setSelectedMilestone(null);
    } else {
      setSelectedMilestone(id);
    }
  }

  const handleDurationChange = (e, id, amount) => {
    e.stopPropagation()
    setReloadData(true)
    change_duration(projectId, id, amount)
  }

  // Handle milestone double-click for renaming
  const handleMilestoneDoubleClick = (e, milestone) => {
    e.stopPropagation();
    if (viewMode === "milestone") {
      setEditingMilestoneId(milestone.id);
      setEditingMilestoneName(milestone.name);
    }
  }

  // Submit milestone rename
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
  }

  // Handle edge resize for milestones (in dependency mode)
  const handleMilestoneEdgeResize = (e, milestoneId, edge) => {
    e.preventDefault();
    e.stopPropagation();

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    const startX = e.clientX;
    const startDuration = milestone.duration;
    const startMilestoneX = milestone.x ?? (milestone.start_index * DAYWIDTH);
    const startIndex = milestone.start_index;
    
    // Track final values via closure variables (like handleMileStoneDrag does)
    let finalDuration = startDuration;
    let finalIndex = startIndex;

    const onMouseMove = (moveE) => {
      const deltaX = moveE.clientX - startX;
      const daysDelta = Math.round(deltaX / DAYWIDTH);

      if (edge === "right") {
        // Resize from right edge - change duration
        const newDuration = Math.max(1, startDuration + daysDelta);
        finalDuration = newDuration;
        setMilestones(prev => ({
          ...prev,
          [milestoneId]: {
            ...prev[milestoneId],
            duration: newDuration
          }
        }));
      } else if (edge === "left") {
        // Resize from left edge - change start position and duration
        const maxDeltaDays = startDuration - 1; // Can't shrink below 1
        const clampedDaysDelta = Math.max(-startIndex, Math.min(maxDeltaDays, daysDelta));
        const newDuration = startDuration - clampedDaysDelta;
        const newIndex = startIndex + clampedDaysDelta;
        
        if (newDuration >= 1 && newIndex >= 0) {
          finalDuration = newDuration;
          finalIndex = newIndex;
          setMilestones(prev => ({
            ...prev,
            [milestoneId]: {
              ...prev[milestoneId],
              duration: newDuration,
              start_index: newIndex,
              x: newIndex * DAYWIDTH // Temporary x for visual feedback during drag
            }
          }));
        }
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      
      // Clear x so position is always calculated from start_index
      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          x: undefined
        }
      }));
      
      // Save the changes to backend using tracked final values
      // Update start index if left edge was dragged and position changed
      if (edge === "left" && finalIndex !== startIndex) {
        update_start_index(projectId, milestoneId, finalIndex).catch(err => 
          console.error("Failed to update start index:", err)
        );
      }
      
      // Update duration if it changed
      const durationChange = finalDuration - startDuration;
      if (durationChange !== 0) {
        change_duration(projectId, milestoneId, durationChange).catch(err =>
          console.error("Failed to update duration:", err)
        );
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Handle day cell click to create milestone (in milestone mode)
  const handleDayCellClick = async (taskId, dayIndex) => {
    if (viewMode !== "milestone") return;
    
    try {
      const result = await add_milestone(projectId, taskId);
      // After creating, update the start_index to the clicked day position
      if (result && result.added_milestone && result.added_milestone.id) {
        await update_start_index(projectId, result.added_milestone.id, dayIndex);
      }
      setReloadData(true);
    } catch (err) {
      console.error("Failed to create milestone:", err);
    }
  };

  // Create team handler
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    
    setIsCreating(true);
    try {
      await createTeamForProject(projectId, {
        name: newTeamName.trim(),
        color: newTeamColor
      });
      setNewTeamName("");
      setNewTeamColor("#facc15");
      setShowCreateTeamModal(false);
      setReloadData(true);
    } catch (err) {
      console.error("Failed to create team:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // Create task handler
  const handleCreateTask = async () => {
    if (!newTaskName.trim() || !newTaskTeamId) return;
    
    setIsCreating(true);
    try {
      await createTaskForProject(projectId, {
        name: newTaskName.trim(),
        team_id: newTaskTeamId
      });
      setNewTaskName("");
      setNewTaskTeamId(null);
      setShowCreateTaskModal(false);
      setReloadData(true);
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsCreating(false);
    }
  };


  // _____________CONNECTIONS________________
  // ________________________________________

  // Calculate the accumulated Y offset for a team based on teamOrder (only visible teams)
  const getTeamYOffset = (teamId) => {
    let offset = HEADER_HEIGHT;
    for (const id of teamOrder) {
      if (!isTeamVisible(id)) continue;
      if (id === teamId) break;
      offset += getTeamHeight(id);
      offset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    }
    return offset;
  }

  // Get the task's Y position within its team (accounting for hidden and small tasks)
  const getTaskYOffset = (taskId, teamId) => {
    const team = teams[teamId];
    if (!team) return 0;
    
    let offset = 0;
    for (const tid of team.tasks) {
      if (tid === taskId) break;
      offset += getTaskHeight(tid, taskDisplaySettings);
    }
    return offset;
  }

  // Get absolute position of a milestone's handle in the container
  const getMilestoneHandlePosition = (milestoneId, handleType) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return null;

    const task = tasks[milestone.task];
    if (!task) return null;

    const teamId = task.team;
    
    // Check if team or task is hidden
    if (!isTeamVisible(teamId)) return null;
    if (!isTaskVisible(milestone.task, taskDisplaySettings)) return null;
    
    const taskHeight = getTaskHeight(milestone.task, taskDisplaySettings);
    
    const milestoneAreaStart = TEAMWIDTH + TASKWIDTH;
    const milestoneX = milestone.x ?? (milestone.start_index * DAYWIDTH);
    const milestoneWidth = DAYWIDTH * milestone.duration;
    
    const handleX = handleType === "source"
      ? milestoneAreaStart + milestoneX + milestoneWidth
      : milestoneAreaStart + milestoneX;

    const teamYOffset = getTeamYOffset(teamId);
    const taskYOffset = getTaskYOffset(milestone.task, teamId);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    
    const handleY = teamYOffset + dropHighlightOffset + taskYOffset + (taskHeight / 2);

    return { x: handleX, y: handleY };
  }

  const handleConnectionDragStart = (event, milestoneId, handleType) => {
    event.stopPropagation();
    event.preventDefault();

    const handlePos = getMilestoneHandlePosition(milestoneId, handleType);
    if (!handlePos) return;

    setIsDraggingConnection(true);
    setConnectionStart({ milestoneId, handleType, ...handlePos });
    setConnectionEnd(handlePos);

    const containerRect = teamContainerRef.current?.getBoundingClientRect();

    const handleMouseMove = (e) => {
      if (!containerRect) return;
      setConnectionEnd({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      });
    };

    const handleMouseUp = (e) => {
      if (!containerRect) return;
      
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      for (let key in milestones) {
        if (String(key) === String(milestoneId)) continue;

        for (let targetHandleType of ["source", "target"]) {
          const targetPos = getMilestoneHandlePosition(key, targetHandleType);
          if (!targetPos) continue;

          const dist = Math.sqrt((mouseX - targetPos.x) ** 2 + (mouseY - targetPos.y) ** 2);
          if (dist < CONNECTION_RADIUS) {
            createConnection(milestoneId, handleType, parseInt(key), targetHandleType);
            break;
          }
        }
      }

      setIsDraggingConnection(false);
      setConnectionStart(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const createConnection = (fromId, fromHandle, toId, toHandle) => {
    let sourceId, targetId;
    if (fromHandle === "source") {
      sourceId = fromId;
      targetId = toId;
    } else {
      sourceId = toId;
      targetId = fromId;
    }

    const exists = connections.some(
      conn => conn.source === sourceId && conn.target === targetId
    );
    if (exists) return;

    setConnections(prev => [...prev, { source: sourceId, target: targetId }]);

    create_dependency(projectId, sourceId, targetId).catch(err =>
      console.error("Failed to save dependency:", err)
    );
  };

  const getConnectionPath = (startX, startY, endX, endY) => {
    const controlPointOffset = Math.abs(endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;
  };

  const getStraightPath = (startX, startY, endX, endY) => {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  };

  const deleteConnection = (sourceId, targetId) => {
    setConnections(prev => 
      prev.filter(conn => !(conn.source === sourceId && conn.target === targetId))
    );
    if (selectedConnection?.source === sourceId && selectedConnection?.target === targetId) {
      setSelectedConnection(null);
    }

    delete_dependency_api(projectId, sourceId, targetId).catch(err =>
      console.error("Failed to delete dependency:", err)
    );
  };

  const handleConnectionClick = (e, conn) => {
    e.stopPropagation();
    if (mode === "delete") {
      deleteConnection(conn.source, conn.target);
    } else {
      if (selectedConnection?.source === conn.source && selectedConnection?.target === conn.target) {
        setSelectedConnection(null);
      } else {
        setSelectedConnection({ source: conn.source, target: conn.target });
      }
    }
  };


  // ___________DYNAMIC HEIGHT______________
  // ________________________________________

  const contentHeight = useMemo(() => {
    let height = HEADER_HEIGHT;
    for (const teamId of teamOrder) {
      if (!isTeamVisible(teamId)) continue;
      height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      height += getTeamHeight(teamId);
    }
    height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    return height;
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings]);

  const dayLabels = useMemo(() => {
    if (!projectStartDate || !days) return [];
    const labels = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(projectStartDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      labels.push(`${day}.${month}`);
    }
    return labels;
  }, [projectStartDate, days]);

  const getTaskDropIndicatorY = () => {
    if (!taskDropTarget) return 0;
    const { teamId, index } = taskDropTarget;
    let y = HEADER_HEIGHT;
    
    for (const tid of teamOrder) {
      if (!isTeamVisible(tid)) continue;
      
      y += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      
      if (tid === teamId) {
        const visibleTasks = getVisibleTasks(tid);
        for (let i = 0; i < index && i < visibleTasks.length; i++) {
          y += getTaskHeight(visibleTasks[i], taskDisplaySettings);
        }
        return y;
      }
      
      y += getTeamHeight(tid);
    }
    return y;
  };

  // Get visible team index for drop highlighting
  const getVisibleTeamIndex = (teamId) => {
    let index = 0;
    for (const tid of teamOrder) {
      if (!isTeamVisible(tid)) continue;
      if (tid === teamId) return index;
      index++;
    }
    return -1;
  };

  const visibleTeamCount = teamOrder.filter(tid => isTeamVisible(tid)).length;
  const hiddenTeamCount = getHiddenTeamCount();


  return (
    <>
      {/* Cross-team move confirmation modal */}
      {moveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Move Task to Another Team?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to move <span className="font-semibold text-slate-900">"{moveModal.taskName}"</span> from{' '}
              <span className="font-semibold" style={{ color: teams[moveModal.fromTeamId]?.color || '#64748b' }}>
                {moveModal.fromTeamName}
              </span>{' '}
              to{' '}
              <span className="font-semibold" style={{ color: teams[moveModal.toTeamId]?.color || '#64748b' }}>
                {moveModal.toTeamName}
              </span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelMoveTask}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveTask}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Move Task
              </button>
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
              {/* Collapse/Expand all */}
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
              
              {/* Show hidden tasks */}
              {teamHasHiddenTasks(team_key) && (
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
        className="p-10 pt-4 w-full min-w-0 select-none"
        onClick={() => {
          setSelectedConnection(null);
          setOpenTeamSettings(null);
          setShowFilterDropdown(false);
          setSelectedMilestone(null);
          setShowSettingsDropdown(false);
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
              <div className="flex flex-col gap-2">
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
                  className="absolute pointer-events-none"
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
                  className="absolute pointer-events-none"
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
              <div className="flex border-b bg-slate-50">
                {dayLabels.map((label, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center text-xs text-slate-500 border-r"
                    style={{ width: `${DAYWIDTH}px`, height: `${HEADER_HEIGHT}px` }}
                  >
                    {label}
                  </div>
                ))}
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
                        backgroundColor: isTargetTeam ? '#bfdbfe' : `${team.color}`,
                        opacity: ghost?.id === team_key ? 0.2 : 1,
                        position: 'sticky',
                        left: 0,
                        zIndex: 40,
                        transition: 'background-color 0.15s ease',
                        boxShadow: isTargetTeam ? 'inset 0 0 0 2px #3b82f6' : 'none',
                      }}
                      className="flex border flex-shrink-0"
                    >
                      {/* Team Column */}
                      <div
                        style={{ width: `${TEAMWIDTH}px` }}
                        className="flex flex-col"
                      >
                        {/* Team Name Row - Draggable + Settings */}
                        <div className="border-b h-8 px-2 flex items-center justify-between">
                          <div 
                            onMouseDown={(e) => handleTeamDrag(e, team_key, orderIndex)}
                            className="flex-1 flex items-center cursor-grab active:cursor-grabbing overflow-hidden"
                          >
                            <span className="truncate text-sm font-medium">{team.name}</span>
                          </div>
                          
                          {/* Team Settings Button */}
                          <div className="relative">
                            <button
                              id={`team-settings-btn-${team_key}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTeamSettings(isSettingsOpen ? null : team_key);
                              }}
                              className={`flex items-center justify-center h-6 w-6 rounded hover:bg-white/50 transition ${isSettingsOpen ? 'bg-white/50' : ''}`}
                              title="Team settings"
                            >
                              <MoreVertIcon style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Empty space indicator when all tasks hidden but team shown due to min height */}
                        {rawHeight === 0 && teamHeight > 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <span className="text-xs text-slate-500 italic">All tasks hidden</span>
                          </div>
                        )}
                      </div>

                      {/* Tasks Column */}
                      <div className="flex flex-col">
                        {team.tasks.map((task_key, taskIndex) => {
                          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                          
                          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                          const isSmall = taskDisplaySettings[task_key]?.size === 'small';
                          const visibleTaskIndex = visibleTasks.indexOf(task_key);
                          const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                          
                          return (
                            <div
                              className="border-b border-l flex justify-between w-full items-center"
                              style={{
                                height: `${taskHeight}px`,
                                width: `${TASKWIDTH}px`,
                                borderBottom: isLastVisible ? "none" : "1px solid black",
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
                                className={`flex-1 h-full flex items-center px-1 cursor-grab active:cursor-grabbing truncate ${isSmall ? 'text-xs' : 'text-sm'}`}
                              >
                                {tasks[task_key]?.name}
                              </div>

                              {/* Task Controls */}
                              <div className="flex items-center gap-0.5 pr-1">
                                {/* Size Toggle */}
                                <button
                                  onClick={() => toggleTaskSize(task_key)}
                                  className={`flex items-center justify-center rounded hover:bg-white/70 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                                  title={isSmall ? "Expand task" : "Collapse task"}
                                >
                                  {isSmall ? (
                                    <UnfoldMoreIcon style={{ fontSize: isSmall ? 12 : 16 }} />
                                  ) : (
                                    <UnfoldLessIcon style={{ fontSize: 16 }} />
                                  )}
                                </button>
                                
                                {/* Hide Task */}
                                <button
                                  onClick={() => toggleTaskVisibility(task_key)}
                                  className={`flex items-center justify-center rounded hover:bg-white/70 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                                  title="Hide task"
                                >
                                  <VisibilityOffIcon style={{ fontSize: isSmall ? 12 : 16 }} />
                                </button>
                                
                                {/* Add Milestone */}
                                {!isSmall && (
                                  <div 
                                    onClick={() => add_milestone_local(task_key)}
                                    className="bg-white h-6 w-6 flex justify-center items-center rounded hover:bg-gray-100 active:bg-gray-200 cursor-pointer"
                                  >
                                    <AddIcon style={{ fontSize: 16 }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SCROLLABLE RIGHT: Milestones/Days - day grid with interactive cells in milestone mode */}
                    <div
                      className="border-t border-b bg-white"
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
                              borderBottom: isLastVisible ? "none" : "1px solid black",
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
                                  className={`border-r transition-colors ${
                                    viewMode === "milestone" ? 'cursor-pointer hover:bg-blue-100' : ''
                                  } ${isHovered ? 'bg-blue-200' : ''}`}
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
                        {viewMode === "dependency" && (
                          <>
                            {/* Target handle (left) */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                                showConnect 
                                  ? 'w-4 h-4 bg-indigo-500 hover:scale-125' 
                                  : 'w-3 h-3 bg-slate-400 hover:bg-indigo-500 hover:w-4 hover:h-4'
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
                                  ? 'w-4 h-4 bg-indigo-500 hover:scale-125' 
                                  : 'w-3 h-3 bg-slate-400 hover:bg-indigo-500 hover:w-4 hover:h-4'
                              }`}
                              style={{ pointerEvents: 'auto', zIndex: 10 }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleConnectionDragStart(e, milestone.id, "source");
                              }}
                            />
                          </>
                        )}

                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full border border-white" />
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
