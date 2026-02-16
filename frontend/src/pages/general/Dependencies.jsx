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
  get_all_dependencies,
  create_dependency,
  delete_dependency_api,
  reorder_team_tasks,
} from '../../api/dependencies_api.js';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import SettingsIcon from '@mui/icons-material/Settings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TuneIcon from '@mui/icons-material/Tune';

// Height constants
const TASKHEIGHT_NORMAL = 50;
const TASKHEIGHT_SMALL = 28;
const TASKWIDTH = 200;

const TEAMWIDTH = 150;
const TEAM_MIN_HEIGHT = TASKHEIGHT_NORMAL; // Minimum team height

const TEAM_DRAG_HIGHLIGHT_HEIGHT = 5;
const MARIGN_BETWEEN_DRAG_HIGHLIGHT = 5;

const DAYWIDTH = TASKHEIGHT_NORMAL;
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

// Helper to get task height based on size
const getTaskHeight = (taskId, taskDisplaySettings) => {
  const settings = taskDisplaySettings[taskId];
  if (!settings || settings.hidden) return 0;
  return settings.size === 'small' ? TASKHEIGHT_SMALL : TASKHEIGHT_NORMAL;
};

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

  // Global settings panel
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);


  // ________Global Event Listener___________
  // ________________________________________

  const [mode, setMode] = useState("drag")

  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey) setMode("delete")
      else if (e.shiftKey) setMode("duration")
      else if (e.altKey) setMode("connect")
    }

    const up = () => setMode("drag")

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
            x: milestone.start_index * DAYWIDTH,
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
    if (!team) return TEAM_MIN_HEIGHT;
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings);
    }
    // Ensure minimum height
    return Math.max(height, TEAM_MIN_HEIGHT);
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

  // Check if team is visible (hidden if manually hidden OR all tasks are hidden)
  const isTeamVisible = (teamId) => {
    const settings = teamDisplaySettings[teamId];
    if (settings?.hidden) return false;
    
    // Also hide if all tasks are hidden
    const team = teams[teamId];
    if (!team || team.tasks.length === 0) return true; // Show empty teams
    
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

  // Count hidden teams (both manual and auto-hidden)
  const getHiddenTeamCount = () => {
    return teamOrder.filter(tid => !isTeamVisible(tid)).length;
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

    setGhost({
      ...team,
      x: 0, // Start at left edge
      y: teamTopOffset, // Start at actual team position
      offsetX: startX, // Store mouse offset
      offsetY: mouseOffsetY,
      height: currentTeamHeight,
    });

    const onMouseMove = (e) => {
      const new_x = e.clientX - parent_rect.x;
      const new_y = e.clientY - parent_rect.y;

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
      setDropIndex(clamped);

      setGhost((prev) => ({
        ...prev,
        x: new_x - prev.offsetX,
        y: new_y - prev.offsetY,
      }));
    };

    const onMouseUp = () => {
      // Convert visible index back to full teamOrder index
      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      
      let copy = [...teamOrder];
      const [moved] = copy.splice(order_index, 1);
      
      // Find the actual target index in the full array
      let targetIndex = to_index;
      if (from_index < order_index) {
        // Need to adjust for the removed item
      }
      
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
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
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

    const startX = event.clientX - milestones[milestone_key].x
    let new_x = milestones[milestone_key].x

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
      const snapped_x = new_index * DAYWIDTH

      setMilestones(prev => ({
        ...prev,
        [milestone_key]: {
          ...prev[milestone_key],
          x: snapped_x,
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
      return delete_milestone(projectId, id)
    }
  }

  const handleDurationChange = (e, id, amount) => {
    e.stopPropagation()
    setReloadData(true)
    change_duration(projectId, id, amount)
  }


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
    const milestoneX = milestone.x || (milestone.start_index * DAYWIDTH);
    const milestoneWidth = DAYWIDTH * milestone.duration;
    
    const handleX = handleType === "source"
      ? milestoneAreaStart + milestoneX + milestoneWidth - 4
      : milestoneAreaStart + milestoneX + 4;

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
          const handlePos = getMilestoneHandlePosition(key, targetHandleType);
          if (!handlePos) continue;

          const distance = Math.sqrt(
            Math.pow(mouseX - handlePos.x, 2) +
            Math.pow(mouseY - handlePos.y, 2)
          );

          if (distance < CONNECTION_RADIUS) {
            createConnection(milestoneId, handleType, key, targetHandleType);
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

      {/* Page wrapper */}
      <div 
        className="p-10 w-full min-w-0 select-none"
        onClick={() => {
          setSelectedConnection(null);
          setOpenTeamSettings(null);
          setShowGlobalSettings(false);
        }}
      >
        {/* Global Settings Button */}
        <div className="fixed top-4 right-4 z-[1000]">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGlobalSettings(!showGlobalSettings);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition ${
                showGlobalSettings 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <TuneIcon style={{ fontSize: 18 }} />
              <span>Settings</span>
              {hiddenTeamCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {hiddenTeamCount}
                </span>
              )}
            </button>
            
            {/* Global Settings Dropdown */}
            {showGlobalSettings && (
              <div 
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  View Settings
                </h3>
                
                {hiddenTeamCount > 0 ? (
                  <button
                    onClick={() => {
                      showAllHiddenTeams();
                      setShowGlobalSettings(false);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
                  >
                    <VisibilityIcon style={{ fontSize: 16 }} />
                    <span>Show all {hiddenTeamCount} hidden team(s)</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 italic px-2">All teams are visible</p>
                )}
                
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 px-2">
                    Tip: Use team settings to collapse or hide individual teams
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scroll container */}
        <div
          style={{ height: `${contentHeight}px` }}
          className="overflow-x-auto overflow-y-hidden"
        >
          {/* Inner container */}
          <div
            ref={teamContainerRef}
            style={{
              width: `${TEAMWIDTH + TASKWIDTH + (days || 0) * DAYWIDTH}px`,
              height: `${contentHeight}px`,
            }}
            className="relative"
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTeamSettings(isSettingsOpen ? null : team_key);
                              }}
                              className={`flex items-center justify-center h-6 w-6 rounded hover:bg-white/50 transition ${isSettingsOpen ? 'bg-white/50' : ''}`}
                              title="Team settings"
                            >
                              <MoreVertIcon style={{ fontSize: 16 }} />
                            </button>
                            
                            {/* Settings Dropdown */}
                            {isSettingsOpen && (
                              <div 
                                className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-xl z-50"
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
                                  
                                  {/* Hide all tasks */}
                                  {visibleTasks.length > 0 && (
                                    <button
                                      onClick={() => {
                                        hideAllTeamTasks(team_key);
                                        setOpenTeamSettings(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition text-left text-orange-700"
                                    >
                                      <VisibilityOffIcon style={{ fontSize: 14 }} />
                                      <span>Hide all tasks</span>
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
                            )}
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

                    {/* SCROLLABLE RIGHT: Milestones/Days - this is the day grid, NO pointer events */}
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
                            {/* Day rendering - these are just visual grid lines */}
                            {[...Array(days)].map((_, i) => (
                              <div
                                className="border-r"
                                style={{
                                  height: `${taskHeight}px`,
                                  width: `${DAYWIDTH}px`,
                                  opacity: ghost?.id === team_key ? 0.2 : 1,
                                }}
                                key={i}
                              />
                            ))}
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

              {connections.map((conn) => {
                const sourcePos = getMilestoneHandlePosition(conn.source, "source");
                const targetPos = getMilestoneHandlePosition(conn.target, "target");

                if (!sourcePos || !targetPos) return null;

                const isSelected = selectedConnection?.source === conn.source && 
                                   selectedConnection?.target === conn.target;

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
                      stroke={isSelected ? "#6366f1" : "#374151"}
                      strokeWidth={isSelected ? "3.5" : "2.5"}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray="8, 4"
                      style={{
                        animation: "flowAnimation 3s linear infinite",
                        pointerEvents: "none",
                        filter: isSelected ? "drop-shadow(0 0 3px rgba(99, 102, 241, 0.5))" : "none",
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

                    return (
                      <div
                        onMouseDown={(e) => {
                          if (mode !== "connect") {
                            handleMileStoneMouseDown(e, milestone_from_task.id);
                          }
                        }}
                        onMouseEnter={() => setHoveredMilestone(milestone.id)}
                        onMouseLeave={() => setHoveredMilestone(null)}
                        className="absolute p-0.5 group"
                        style={{
                          pointerEvents: 'auto',
                          height: `${taskHeight}px`,
                          width: `${DAYWIDTH * milestone.duration}px`,
                          left: `${TEAMWIDTH + TASKWIDTH + milestone.x}px`,
                          top: `${taskY}px`,
                          opacity: ghost?.id === team_key ? 0.2 : 1,
                        }}
                        key={milestone.id}
                      >
                        <div className={`h-full w-full rounded bg-slate-200 shadow-xl border border-gray-500 text-black flex justify-center items-center relative ${isSmall ? 'text-xs' : ''}`}>
                          {!showDelete && !showDurationPlus && !showDurationMinus && !showConnect && (isSmall ? "" : "M")}

                          {showDelete && (
                            <DeleteForeverIcon
                              style={{ color: "#fa2020", fontSize: isSmall ? 16 : 24 }}
                              className="animate-pulse"
                            />
                          )}

                          <div 
                            style={{ display: showDurationMinus || showDurationPlus ? "flex" : "none" }}
                            className="w-full flex justify-between px-0.5"
                          >
                            {showDurationPlus && (
                              <AddCircleOutlineIcon
                                onClick={(e) => handleDurationChange(e, milestone.id, 1)}
                                style={{ fontSize: isSmall ? 14 : 20 }}
                                className="cursor-pointer"
                              />
                            )}
                            {showDurationMinus && (
                              <RemoveCircleOutlineIcon
                                onClick={(e) => handleDurationChange(e, milestone.id, -1)}
                                style={{ fontSize: isSmall ? 14 : 20 }}
                                className="hover:text-blue-200 cursor-pointer"
                              />
                            )}
                          </div>

                          {/* Connection Handles */}
                          <div
                            className={`absolute w-2.5 h-2.5 bg-blue-500 rounded-full 
                                       transition-all cursor-crosshair
                                       border-2 border-white shadow
                                       ${showConnect ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}
                                       hover:scale-150 hover:bg-blue-400`}
                            style={{
                              left: "-5px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              zIndex: 200,
                            }}
                            onMouseDown={(e) => handleConnectionDragStart(e, milestone.id, "target")}
                          />

                          <div
                            className={`absolute w-2.5 h-2.5 bg-green-500 rounded-full 
                                       transition-all cursor-crosshair
                                       border-2 border-white shadow
                                       ${showConnect ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}
                                       hover:scale-150 hover:bg-green-400`}
                            style={{
                              right: "-5px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              zIndex: 200,
                            }}
                            onMouseDown={(e) => handleConnectionDragStart(e, milestone.id, "source")}
                          />
                        </div>
                      </div>
                    );
                  });
                });
              })}
            </div>



            {/* Team Ghost */}
            {ghost && (
              <div
                className="absolute pointer-events-none"
                style={{
                  height: `${ghost.height}px`,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  left: `${ghost.x}px`,
                  top: `${ghost.y}px`,
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
