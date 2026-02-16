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

const TASKHEIGHT = 50;
const TASKWIDTH = 200;

const TEAMHEIGHT = 50;
const TEAMWIDTH = 150;

const TEAM_DRAG_HIGHLIGHT_HEIGHT = 5;
const MARIGN_BETWEEN_DRAG_HIGHLIGHT = 5;
const ROW =
  TEAMHEIGHT +
  MARIGN_BETWEEN_DRAG_HIGHLIGHT +
  2 * MARIGN_BETWEEN_DRAG_HIGHLIGHT;

const DAYWIDTH = TASKHEIGHT
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
  const [connections, setConnections] = useState([]); // Array of {source: id, target: id}
  const [selectedConnection, setSelectedConnection] = useState(null); // {source: id, target: id}

  // Task drag state
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, setTaskDropTarget] = useState(null); // { teamId, index }

  // Cross-team move confirmation modal
  const [moveModal, setMoveModal] = useState(null); // { taskId, fromTeamId, toTeamId, newOrder }


  // ________Global Event Listener___________
  // ________________________________________
  // ________________________________________
  // ________________________________________
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













  // ________________Layout_________________
  // ________________________________________
  // ________________________________________
  // ________________________________________
  // ________________________________________

  //   Define height
  // useEffect(() => {
  //   if (!teamContainerRef.current) return;
  //   setHeight(teamContainerRef.current.getBoundingClientRect().height);
  // }, []);

  // ________________Loading_________________
  // ________________________________________
  // ________________________________________
  // ________________________________________
  // ________________________________________

//   Fetch Project, Teams and Tasks
  useEffect(() => {
    const load_all = async () => {
        // Fetch Project
        const resProjcet = await fetch_project_details(projectId);
        const project = resProjcet.project
        const start_date = project.start_date
        const end_date = project.end_date

        const num_days = daysBetween(start_date, end_date)
        setDays(num_days)
        setProjectStartDate(new Date(start_date))

      // 1️⃣ fetch teams
      const resTeams = await fetch_project_teams(projectId);
      const fetched_teams = resTeams.teams;

      const teamOrder = [];
      const teamObject = {};

      for (const team of fetched_teams) {
        teamOrder.push(team.id);
        teamObject[team.id] = {
          ...team,
          height: TEAMHEIGHT,
          tasks: [],
        };
      }

      // 2️⃣ fetch tasks AFTER teams exist
      const resTasks = await fetch_project_tasks(projectId);

      for (const team_id in teamObject) {
        const teamTasks = resTasks.taskOrder?.[String(team_id)] || [];
        teamObject[team_id].tasks = teamTasks;
        teamObject[team_id].height = teamTasks.length * TASKHEIGHT;
      }






      // Update Milestones to also have x coordinates for dragging
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




      // 3️⃣ commit state once
      setTeamOrder(teamOrder);
      setTeams(teamObject);
      setTasks(resTasks.tasks);
      setMilestones(updated_milestones)

      // 4️⃣ fetch dependencies
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

  // ________________TEAMS___________________
  // ________________________________________
  // ________________________________________
  // ________________________________________
  // ________________________________________

  const safe_team_order_local = async (new_order) => {
    const res = await safe_team_order(projectId, new_order);
  };

  const handleTeamDrag = (event, team_key, order_index) => {
    const team = teams[team_key];
    const from_index = order_index;
    let to_index = order_index;

    const parent = teamContainerRef.current;
    const parent_rect = parent.getBoundingClientRect();

    const children = [...parent.children];

    const startX = event.clientX - parent_rect.x;
    const startY = event.clientY - parent_rect.y;

    // Calculate the offset from the mouse to the top-left of the team row
    // We need to account for: header height + drop highlights before this team + team heights before this team
    let teamTopOffset = HEADER_HEIGHT;
    for (let i = 0; i < order_index; i++) {
      teamTopOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      teamTopOffset += teams[teamOrder[i]]?.height || 0;
    }
    teamTopOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2; // drop highlight before current team
    
    const mouseOffsetY = startY - teamTopOffset;

    setGhost({
      ...team,
      x: startX,
      y: startY - mouseOffsetY, // Start at the actual team position
      offsetY: mouseOffsetY,
    });

    const onMouseMove = (e) => {
      const new_x = e.clientX - parent_rect.x;
      const new_y = e.clientY - parent_rect.y;

      const mouseY = e.clientY - parent_rect.top;

      // Calculate drop index based on accumulated heights
      let accumulatedY = HEADER_HEIGHT;
      let index = teamOrder.length; // default: drop at end
      
      for (let i = 0; i < teamOrder.length; i++) {
        const tid = teamOrder[i];
        const team = teams[tid];
        if (!team) continue;
        
        // Add drop highlight height before this team
        accumulatedY += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        
        const teamTop = accumulatedY;
        const teamHeight = team.height;
        const teamMid = teamTop + teamHeight / 2;
        
        if (mouseY < teamMid) {
          index = i;
          break;
        }
        
        accumulatedY += teamHeight;
      }

      // If hovering just after the original item, treat it as the same gap
      if (index === order_index + 1) {
        index = order_index;
      }

      const clamped = Math.max(0, Math.min(index, teamOrder.length));
      to_index = clamped;
      setDropIndex(clamped);

      setGhost((prev) => {
        return {
          ...prev,
          x: new_x,
          y: new_y - (prev.offsetY || 0),
        };
      });
    };

    const onMouseUp = () => {
      // Reorder team
      let copy = [...teamOrder];
      const [moved] = copy.splice(from_index, 1);
      let targetIndex = to_index;
      if (from_index < to_index) {
        targetIndex -= 1;
      }

      copy.splice(targetIndex, 0, moved);
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
  // ________________________________________
  // ________________________________________
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

    setTaskGhost({
      taskKey,
      name: tasks[taskKey]?.name || 'Task',
      x: startX,
      y: startY,
      width: TASKWIDTH,
      height: TASKHEIGHT,
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

      // Determine which team and task index the mouse is over
      const mouseY = e.clientY - parentRect.top;
      let accumulatedY = HEADER_HEIGHT; // Account for header
      let foundTeamId = null;
      let foundTaskIndex = 0;

      for (const tid of teamOrder) {
        const team = teams[tid];
        if (!team) continue;

        // Drop highlight before team
        accumulatedY += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;

        const teamTop = accumulatedY;
        const teamBottom = teamTop + team.height;

        if (mouseY >= teamTop && mouseY < teamBottom) {
          foundTeamId = tid;
          // Find task index within this team
          const relY = mouseY - teamTop;
          foundTaskIndex = Math.floor(relY / TASKHEIGHT);
          foundTaskIndex = Math.max(0, Math.min(foundTaskIndex, team.tasks.length));
          break;
        }

        accumulatedY += team.height;
      }

      // If mouse is below all teams, target last team's end
      if (foundTeamId === null && teamOrder.length > 0) {
        const lastTeamId = teamOrder[teamOrder.length - 1];
        foundTeamId = lastTeamId;
        foundTaskIndex = teams[lastTeamId]?.tasks?.length || 0;
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

      if (currentTargetTeamId === fromTeamId) {
        // Same team reorder
        const teamTasks = [...teams[fromTeamId].tasks];
        const [moved] = teamTasks.splice(fromIndex, 1);
        let insertAt = currentTargetIndex;
        if (fromIndex < currentTargetIndex) {
          insertAt = Math.max(0, insertAt - 1);
        }
        teamTasks.splice(insertAt, 0, moved);

        // Update local state
        setTeams(prev => ({
          ...prev,
          [fromTeamId]: {
            ...prev[fromTeamId],
            tasks: teamTasks,
          },
        }));

        // Persist
        reorder_team_tasks(projectId, taskKey, fromTeamId, teamTasks).catch(err =>
          console.error("Failed to reorder tasks:", err)
        );
      } else {
        // Cross-team move — show confirmation modal
        const sourceTeamTasks = [...teams[fromTeamId].tasks].filter(t => t !== taskKey);
        const targetTeamTasks = [...teams[currentTargetTeamId].tasks];
        let insertAt = Math.min(currentTargetIndex, targetTeamTasks.length);
        targetTeamTasks.splice(insertAt, 0, taskKey);

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

    // Update local state
    setTeams(prev => ({
      ...prev,
      [fromTeamId]: {
        ...prev[fromTeamId],
        tasks: newSourceOrder,
        height: newSourceOrder.length * TASKHEIGHT,
      },
      [toTeamId]: {
        ...prev[toTeamId],
        tasks: newTargetOrder,
        height: newTargetOrder.length * TASKHEIGHT,
      },
    }));

    // Update task's team reference locally
    setTasks(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        team: toTeamId,
      },
    }));

    // Persist to backend
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
  // ________________________________________
  // ________________________________________
  // ________________________________________

  const add_milestone_local = async (task_id) => {
    const res = await add_milestone(projectId, task_id)
    const milestone = res.added_milestone
    setReloadData(true)
  }




  

const handleMileStoneDrag = (event, milestone_key) => {
  event.preventDefault() 

  const startX = event.clientX - milestones[milestone_key].x
  let new_x = milestones[milestone_key].x

  const onMouseMove = (e) => {
    // If Ctrl is pressed, stop dragging and snap to position
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
    // In duration mode, don't do anything here - icons have their own handlers
  }

  const handleDurationChange = (e, id, amount) => {
    e.stopPropagation() // Prevent parent mousedown from firing
    setReloadData(true)
    change_duration(projectId, id, amount)
  }


  // _____________CONNECTIONS________________
  // ________________________________________
  // ________________________________________
  // ________________________________________
  // ________________________________________

  // Calculate the accumulated Y offset for a team based on teamOrder
  const getTeamYOffset = (teamId) => {
    let offset = HEADER_HEIGHT; // Account for header
    for (const id of teamOrder) {
      if (id === teamId) break;
      offset += teams[id]?.height || 0;
      // Drop highlighter: marginTop + height + marginBottom = 5 + 5 + 5 = 15
      offset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    }
    return offset;
  }

  // Get the task's Y position within its team
  const getTaskYOffset = (taskId, teamId) => {
    const team = teams[teamId];
    if (!team) return 0;
    const taskIndex = team.tasks.indexOf(taskId);
    return taskIndex * TASKHEIGHT;
  }

  // Get absolute position of a milestone's handle in the container
  const getMilestoneHandlePosition = (milestoneId, handleType) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return null;

    const task = tasks[milestone.task];
    if (!task) return null;

    const teamId = task.team;
    
    // Calculate X position
    // Left side of milestone area starts after TEAMWIDTH + TASKWIDTH
    const milestoneAreaStart = TEAMWIDTH + TASKWIDTH;
    const milestoneX = milestone.x || (milestone.start_index * DAYWIDTH);
    const milestoneWidth = DAYWIDTH * milestone.duration;
    
    // Account for p-1 (4px) padding on milestone container
    const handleX = handleType === "source"
      ? milestoneAreaStart + milestoneX + milestoneWidth - 4  // right edge of visible milestone
      : milestoneAreaStart + milestoneX + 4;  // left edge of visible milestone

    // Calculate Y position
    const teamYOffset = getTeamYOffset(teamId);
    const taskYOffset = getTaskYOffset(milestone.task, teamId);
    // Drop highlighter: marginTop + height + marginBottom = 5 + 5 + 5 = 15
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    
    const handleY = teamYOffset + dropHighlightOffset + taskYOffset + (TASKHEIGHT / 2);

    return { x: handleX, y: handleY };
  }

  // Handle connection drag start
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

      // Check if we're near any other milestone's handle
      for (let key in milestones) {
        if (String(key) === String(milestoneId)) continue;

        // Check both source and target handles
        for (let targetHandleType of ["source", "target"]) {
          const handlePos = getMilestoneHandlePosition(key, targetHandleType);
          if (!handlePos) continue;

          const distance = Math.sqrt(
            Math.pow(mouseX - handlePos.x, 2) +
            Math.pow(mouseY - handlePos.y, 2)
          );

          if (distance < CONNECTION_RADIUS) {
            // Create connection
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

  // Create a connection between two milestones
  const createConnection = (fromId, fromHandle, toId, toHandle) => {
    // Determine source and target based on handle types
    let sourceId, targetId;
    if (fromHandle === "source") {
      sourceId = fromId;
      targetId = toId;
    } else {
      sourceId = toId;
      targetId = fromId;
    }

    // Check if connection already exists
    const exists = connections.some(
      conn => conn.source === sourceId && conn.target === targetId
    );
    if (exists) return;

    setConnections(prev => [...prev, { source: sourceId, target: targetId }]);

    // Persist to backend
    create_dependency(projectId, sourceId, targetId).catch(err =>
      console.error("Failed to save dependency:", err)
    );
  };

  // Generate SVG path for a connection (bezier curve)
  const getConnectionPath = (startX, startY, endX, endY) => {
    const controlPointOffset = Math.abs(endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;
  };

  // Generate straight line path for dragging
  const getStraightPath = (startX, startY, endX, endY) => {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  };

  // Delete a connection
  const deleteConnection = (sourceId, targetId) => {
    setConnections(prev => 
      prev.filter(conn => !(conn.source === sourceId && conn.target === targetId))
    );
    // Clear selection if deleted connection was selected
    if (selectedConnection?.source === sourceId && selectedConnection?.target === targetId) {
      setSelectedConnection(null);
    }

    // Persist to backend
    delete_dependency_api(projectId, sourceId, targetId).catch(err =>
      console.error("Failed to delete dependency:", err)
    );
  };

  // Select a connection
  const handleConnectionClick = (e, conn) => {
    e.stopPropagation();
    if (mode === "delete") {
      deleteConnection(conn.source, conn.target);
    } else {
      // Toggle selection
      if (selectedConnection?.source === conn.source && selectedConnection?.target === conn.target) {
        setSelectedConnection(null);
      } else {
        setSelectedConnection({ source: conn.source, target: conn.target });
      }
    }
  };


  // ___________DYNAMIC HEIGHT______________
  // ________________________________________
  // Calculate content height so the scroll container has
  // exactly the height it needs (no Y overflow).
  const contentHeight = useMemo(() => {
    let height = HEADER_HEIGHT; // Header row
    for (const teamId of teamOrder) {
      const team = teams[teamId];
      if (!team) continue;
      // Drop highlight before each team: marginTop + height + marginBottom
      height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      // Team row height
      height += team.height;
    }
    // Last drop highlight
    height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    return height;
  }, [teamOrder, teams]);

  // Generate day labels from project start date
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


  // Helper: compute the Y pixel position of a task drop indicator
  const getTaskDropIndicatorY = () => {
    if (!taskDropTarget) return 0;
    const { teamId, index } = taskDropTarget;
    let y = HEADER_HEIGHT; // Account for header
    for (const tid of teamOrder) {
      // drop highlight before team
      y += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      if (tid === teamId) {
        y += index * TASKHEIGHT;
        return y;
      }
      y += teams[tid]?.height || 0;
    }
    return y;
  };


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

      {/* Page wrapper – natural flow, page-level Y scroll */}
      <div 
        className="p-10 w-full min-w-0 select-none"
        onClick={() => setSelectedConnection(null)}
      >
        {/* Scroll container – exact height, horizontal scroll only */}
        <div
          style={{ height: `${contentHeight}px` }}
          className="overflow-x-auto overflow-y-hidden"
        >
          {/* Inner container with full width for horizontal scroll */}
          <div
            ref={teamContainerRef}
            style={{
              width: `${TEAMWIDTH + TASKWIDTH + (days || 0) * DAYWIDTH}px`,
              height: `${contentHeight}px`,
            }}
            className="relative"
          >
          {/* SVG Layer for Connections — BEHIND teams/tasks */}
          <svg
            className="absolute top-0 left-0 w-full h-full"
            style={{ zIndex: 5, pointerEvents: 'none' }}
          >
            <defs>
              <style>
                {`
                  @keyframes flowAnimation {
                    from { stroke-dashoffset: 24; }
                    to { stroke-dashoffset: 0; }
                  }
                  @keyframes flowAnimationSelected {
                    from { stroke-dashoffset: 24; }
                    to { stroke-dashoffset: 0; }
                  }
                `}
              </style>
            </defs>

            {/* Render existing connections */}
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
                    d={getConnectionPath(
                      sourcePos.x,
                      sourcePos.y,
                      targetPos.x,
                      targetPos.y
                    )}
                    stroke="transparent"
                    strokeWidth="15"
                    fill="none"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => handleConnectionClick(e, conn)}
                  />
                  {/* Visible animated path */}
                  <path
                    d={getConnectionPath(
                      sourcePos.x,
                      sourcePos.y,
                      targetPos.x,
                      targetPos.y
                    )}
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

            {/* Render dragging connection - straight line */}
            {isDraggingConnection && connectionStart && (
              <path
                d={getStraightPath(
                  connectionStart.x,
                  connectionStart.y,
                  connectionEnd.x,
                  connectionEnd.y
                )}
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
                zIndex: 100,
                boxShadow: '0 0 8px rgba(29, 78, 216, 0.6)',
              }}
            />
          )}

          {/* Header Row */}
          <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 15 }}>
            {/* Sticky header left */}
            <div
              className="flex border-b bg-slate-100 text-sm font-semibold text-slate-700"
              style={{
                width: `${TEAMWIDTH + TASKWIDTH}px`,
                height: `${HEADER_HEIGHT}px`,
                position: 'sticky',
                left: 0,
                zIndex: 15,
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
            {/* Day labels */}
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
          {teamOrder.map((team_key, index) => {
            const team = teams[team_key];
            const isTargetTeam = taskGhost && taskDropTarget?.teamId === team_key && taskDropTarget?.teamId !== taskGhost.fromTeamId;
            return (
              <div key={`${team_key}_container`} style={{ position: 'relative', zIndex: 10 }}>
                {/* Redrag Highlighter */}
                <div className="flex">
                  <div
                    style={{
                      marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                      marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                      height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                      width: `${TEAMWIDTH + TASKWIDTH}px`,
                      opacity: dropIndex === index ? 1 : 0,
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'black',
                    }}
                    className="rounded-l-full"
                  ></div>
                  <div
                    style={{
                      marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                      marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                      height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                      opacity: dropIndex === index ? 1 : 0,
                      backgroundColor: 'black',
                    }}
                    className="rounded-r-full flex-1"
                  ></div>
                </div>

                {/* Team Row - contains sticky left part + scrollable right part */}
                <div className="flex">
                  {/* STICKY LEFT: Team + Tasks */}
                  <div
                    
                    style={{
                      height: team.height,
                      width: `${TEAMWIDTH + TASKWIDTH}px`,
                      backgroundColor: isTargetTeam ? '#bfdbfe' : `${team.color}`,
                      opacity: ghost?.id === team_key ? 0.2 : 1,
                      position: 'sticky',
                      left: 0,
                      zIndex: 20,
                      transition: 'background-color 0.15s ease',
                      boxShadow: isTargetTeam ? 'inset 0 0 0 2px #3b82f6' : 'none',
                    }}
                    className="flex border flex-shrink-0"
                  >
                    <div
                      style={{
                        width: `${TEAMWIDTH}px`,
                      }}
                    >
                      <div 
                      onMouseDown={(e) => {
                      handleTeamDrag(e, team_key, index);
                    }}
                      className="border h-full w-full cursor-pointer">
                        {teams[team_key].name}
                      </div>
                      
                    </div>

                    <div>
                      {team.tasks.map((task_key, taskIndex) => {
                        return (
                          <div
                            className="border-b border-l flex justify-between w-full items-center"
                            style={{
                              height: `${TASKHEIGHT}px`,
                              width: `${TASKWIDTH}px`,
                              borderBottom:
                                team.tasks.length - 1 === taskIndex
                                  ? "none"
                                  : "1px solid black",
                              opacity: taskGhost?.taskKey === task_key ? 0.3 : 1,
                            }}
                            key={`${task_key}_container`}
                          >
                            <div
                              onMouseDown={(e) => {
                                if (mode === "drag") {
                                  handleTaskDrag(e, task_key, team_key, taskIndex);
                                }
                              }}
                              className="flex-1 h-full flex items-center px-1 cursor-grab active:cursor-grabbing truncate"
                            >
                                {tasks[task_key]?.name}
                            </div>



                            {/* Add Milestone Button */}
                            <div 
                            onClick={()=>{add_milestone_local(task_key)}}
                            className="bg-white h-7 w-7 m-1 flex justify-center items-center rounded hover:bg-gray-100 active:bg-gray-200">
                              <AddIcon/>
                            </div>
                          
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SCROLLABLE RIGHT: Milestones/Days */}
                  <div
                    className="border-t border-b"
                    style={{ height: `${team.height}px` }}
                  >
                    {team.tasks.map((task_key, taskIndex) => {
                      return (
                        <div
                          className="flex relative"
                          style={{
                            height: `${TASKHEIGHT}px`,
                            borderBottom:
                              team.tasks.length - 1 === taskIndex
                                ? "none"
                                : "1px solid black",
                          }}
                          key={`${task_key}_milestone`}
                        >


                          {/* Milestone Rendering */}
                          {tasks[task_key]?.milestones?.map((milestone_from_task)=>{
                            const milestone = milestones[milestone_from_task.id]
                            if (!milestone) return null;
                            
                            const showDelete = hoveredMilestone === milestone.id && mode === "delete"
                            const showDurationPlus = hoveredMilestone === milestone.id && mode === "duration"
                            const showDurationMinus = hoveredMilestone === milestone.id && mode === "duration" && milestone.duration > 1
                            const showConnect = mode === "connect"
                            


                            return (
                               <div
                                  onMouseDown={(e)=>{
                                    if (mode !== "connect") {
                                      handleMileStoneMouseDown(e, milestone_from_task.id)
                                    }
                                  }}

                                  onMouseEnter={() => setHoveredMilestone(milestone.id)}
                                  onMouseLeave={() => setHoveredMilestone(null)}



                                  className="absolute p-1 group"
                                  style={{
                                      height: `${TASKHEIGHT}px`,
                                      width: `${DAYWIDTH * milestone.duration}px`,
                                      left: `${milestone.x}px`,
                                      opacity: ghost?.id === team_key ? 0.2 : 1,
                                      zIndex: 10,
                                  }}
                                  key={milestone.id}>
                                    <div className="h-full w-full rounded bg-slate-200 shadow-xl border border-gray-500 text-black flex justify-center items-center relative">
                                    {!showDelete && !showDurationPlus && !showDurationMinus && !showConnect && "M"}

                                    {showDelete && (
                                      <DeleteForeverIcon
                                        style={{ color: "#fa2020" }}
                                        className="animate-pulse"
                                      />
                                    )}

                                    <div 
                                    style={{
                                      display: showDurationMinus || showDurationPlus ? "flex" : "none"
                                    }}
                                    className="w-full flex justify-between px-1">
                                      {showDurationPlus && (
                                      <AddCircleOutlineIcon
                                        onClick={(e) => handleDurationChange(e, milestone.id, 1)}
                                        style={{}}
                                        className="cursor-pointer ml-1"
                                      />
                                    )}


                                      {showDurationMinus && (
                                      <RemoveCircleOutlineIcon
                                        onClick={(e) => handleDurationChange(e, milestone.id, -1)}
                                        style={{}}
                                        className="hover:text-blue-200 cursor-pointer"
                                      />
                                    )}

                                    
                                    </div>

                                    {/* Connection Handles - always visible in connect mode, hover otherwise */}
                                    {/* Target Handle (Left) */}
                                    <div
                                      className={`absolute w-3 h-3 bg-blue-500 rounded-full 
                                                 transition-all cursor-crosshair
                                                 border-2 border-white shadow
                                                 ${showConnect ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}
                                                 hover:scale-150 hover:bg-blue-400`}
                                      style={{
                                        left: "-6px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        zIndex: 200,
                                      }}
                                      onMouseDown={(e) => handleConnectionDragStart(e, milestone.id, "target")}
                                    />

                                    {/* Source Handle (Right) */}
                                    <div
                                      className={`absolute w-3 h-3 bg-green-500 rounded-full 
                                                 transition-all cursor-crosshair
                                                 border-2 border-white shadow
                                                 ${showConnect ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}
                                                 hover:scale-150 hover:bg-green-400`}
                                      style={{
                                        right: "-6px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        zIndex: 200,
                                      }}
                                      onMouseDown={(e) => handleConnectionDragStart(e, milestone.id, "source")}
                                    />
                                    
                                    
                                  </div>

                                
                                </div>
                            )
                          })}


                          {/* Day rendering */}
                          {[...Array(days)].map((_, i) => {
                            return (
                              <div
                                className="border-r "
                                style={{
                                  height: `${TASKHEIGHT}px`,
                                  width: `${DAYWIDTH}px`,
                                  opacity: ghost?.id === team_key ? 0.2 : 1,
                                }}
                                key={i}
                              >
                              </div>
                            );
                          })}






                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* LAST DROP HIGHLIGHT */}
          <div className="flex" style={{ position: 'relative', zIndex: 10 }}>
            <div
              style={{
                marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                width: `${TEAMWIDTH + TASKWIDTH}px`,
                opacity: dropIndex === teamOrder.length ? 1 : 0,
                backgroundColor: 'black',
                position: 'sticky',
                left: 0,
              }}
              className="rounded-l-full"
            ></div>
            <div
              style={{
                marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                opacity: dropIndex === teamOrder.length ? 1 : 0,
                backgroundColor: 'black',
              }}
              className="rounded-r-full flex-1"
            ></div>
          </div>

          {/* Team Ghost */}
          {ghost && (
            <div
              className="bg-blue-200 absolute"
              style={{
                height: `${ghost.height}px`,
                width: `${TEAMWIDTH + TASKWIDTH}px`,
                left: `${ghost.x}px`,
                top: `${ghost.y}px`,
                backgroundColor: `${ghost.color}`,
                zIndex: 20,
              }}
            >
              {ghost.name}
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
                zIndex: 50,
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
