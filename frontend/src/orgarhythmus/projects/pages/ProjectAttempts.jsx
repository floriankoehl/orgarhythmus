import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
} from 'reactflow';
import {
  fetch_all_attempts,
  project_teams_expanded,
  add_attempt_dependency,
  fetch_all_attempt_dependencies,
  update_attempt_slot_index,
  delete_attempt_dependency,
  reorder_project_teams,
  fetch_project_detail,
} from '../../api/org_API';
import snapSoundFile from '../../../assets/snap.mp3';
import whipSoundFile from '../../../assets/whip.mp3';
import clackSoundFile from '../../../assets/clack.mp3';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ChevronsDownUp } from 'lucide-react';
import Button from '@mui/material/Button';
import dayjs from 'dayjs';

// ________________________GLOBALS AND HELPERS________________________

// extractAttemptId
function extractAttemptId(nodeId) {
  if (!nodeId) return null;

  // If it looks like "attempt-19"
  if (nodeId.startsWith('attempt-')) {
    const num = parseInt(nodeId.replace('attempt-', ''), 10);
    return Number.isNaN(num) ? null : num;
  }

  // Fallback: maybe it's already just "19"
  const num = parseInt(nodeId, 10);
  return Number.isNaN(num) ? null : num;
}

// ************** -> ADDED NOW 5: Helper extractTeamId ***************** :
function extractTeamId(teamNodeId) {
  if (!teamNodeId?.startsWith('team-')) return null;
  const num = parseInt(teamNodeId.replace('team-', ''), 10);
  return Number.isNaN(num) ? null : num;
}

// playSnapSound
const snapAudio = new Audio(snapSoundFile);
snapAudio.volume = 0.2; // super subtle

function playSnapSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    snapAudio.currentTime = 0;
    snapAudio.play();
  } catch (e) {
    console.log('Couldnt play snap sound');
  }
}

const whipAudio = new Audio(whipSoundFile);
whipAudio.volume = 0.3; // super subtle

function playWhipSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    whipAudio.currentTime = 0;
    whipAudio.play();
  } catch (e) {
    console.log('Couldnt play whip sound');
  }
}

const clickAudio = new Audio(clackSoundFile);
clickAudio.volume = 0.4; // super subtle

function playClackSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    clickAudio.currentTime = 0;
    clickAudio.play();
  } catch (e) {
    console.log('Couldnt play whip sound');
  }
}

// get_overall_gap
function get_overall_gap(num_tasks, gap, header_gap) {
  return num_tasks * gap + header_gap - 10;
}

// Main Variables
const isMobile = window.innerWidth <= 768;
let TASK_HEIGHT = 60;
let TASK_WIDTH = 60;
let SETTINGS_HEIGHT = 120;
const DEFAULT_ENTRIES = 25; // fallback if no dates

let SIDEBAR_WIDTH = 80;
let TASK_SIDEBAR_WIDTH = 100;

const TEAM_GAP_PADDING_Y = 10;
const TASK_GAP_PADDING_X = 0;
const HEADER_BODY_GAP = 10;

// ************** -> ADDED NOW 2: const TEAM_COLLAPSED_HEIGHT ***************** :
const TASK_COLLAPSED_HEIGHT = 14;
const TEAM_COLLAPSED_HEIGHT = TASK_COLLAPSED_HEIGHT + 15; // slightly larger to fit header/arrow
const ATTEMPT_COLLAPSED_HEIGHT = Math.max(6, TASK_COLLAPSED_HEIGHT - 4);
const COLLAPSED_DAY_WIDTH = 12;

// Mobile Task Adjustment
if (isMobile) {
  TASK_HEIGHT = 45;
  TASK_WIDTH = 45;
  SIDEBAR_WIDTH = 70;
  TASK_SIDEBAR_WIDTH = 70;
}

// TaskHeaderNode
function TaskHeaderNode({ data }) {
  const {
    componentWidth,
    taskWidth,
    sidebarWidth,
    taskSidebarWidth,
    timelineDays = [],
    entryCount,
    collapsedDays = {},
    onToggleDay,
    pixelMap = {},
  } = data || {};

  const columns =
    timelineDays.length > 0 ? timelineDays : Array.from({ length: entryCount }, (_, i) => i + 1);

  return (
    <div
      style={{
        width: componentWidth,
        height: TASK_HEIGHT,
      }}
      className="flex items-center rounded-t-lg border border-slate-300 border-b-slate-300 bg-slate-50 text-slate-700"
    >
      <div
        style={{ width: sidebarWidth }}
        className="flex items-center justify-center border-r border-slate-300 text-xs font-medium"
      >
        Team
      </div>
      <div
        style={{ width: taskSidebarWidth }}
        className="flex items-center justify-center border-r border-slate-300 text-xs font-medium"
      >
        Task
      </div>

      <div className="flex h-full flex-1">
        {columns.map((col, idx) => {
          const dayIndex = idx + 1;
          const isCollapsed = !!collapsedDays[dayIndex];
          const range = pixelMap[dayIndex];
          const cellWidth = range ? range.end - range.beginn : taskWidth;
          return (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleDay?.(dayIndex);
              }}
              key={idx}
              style={{ width: cellWidth, pointerEvents: 'auto' }}
              className={`group flex h-full flex-col items-center justify-center border-l border-slate-200 text-[11px] transition-all ${
                isCollapsed ? 'bg-slate-100/70' : ''
              }`}
            >
              {dayjs.isDayjs(col) ? (
                <div
                  className={`flex flex-col items-center justify-center transition-all ${
                    isCollapsed ? 'scale-75 -rotate-90 text-slate-500' : ''
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-700 group-hover:text-blue-600">
                    {col.format('DD.MM')}
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-500">
                    {col.format('dd')}
                  </span>
                </div>
              ) : (
                <span className="px-2 py-1 text-lg font-bold text-slate-700">{col}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// TeamNode
function TeamNode({ id, data }) {
  // ************** -> ADDED NOW: DEBUG [TeamNode render] ***************** :
  console.log('[TeamNode render]', id, 'data.isCollapsed =', data.isCollapsed);

  const [collapsed, setCollapsed] = useState(false);

  // ************** -> ADDED NOW 2: height calculation inside teamnode ***************** :
  // const [height, setHeight] = useState(data.height);
  const height = data.isCollapsed ? TEAM_COLLAPSED_HEIGHT : data.height;

  // function handleCollapse() {
  //     if (!collapsed) {
  //         console.log("Should collapse now");
  //         setCollapsed(true);
  //         setHeight(30);

  //         data.setTaskNodes((prevTasks) => {
  //             // collect my task ids
  //             const myTaskIds = prevTasks
  //                 .filter((t) => t.parentNode === id)
  //                 .map((t) => t.id);

  //             // hide attempts belonging to my tasks
  //             data.setAttemptNodes((prevAttempts) =>
  //                 prevAttempts.map((a) => {
  //                     if (!myTaskIds.includes(a.parentNode)) return a;
  //                     return { ...a, hidden: true };
  //                 })
  //             );

  //             // hide my tasks
  //             return prevTasks.map((n) => {
  //                 if (n.parentNode !== id) return n;
  //                 return { ...n, hidden: true };
  //             });
  //         });

  //     } else {
  //         setHeight(data.height);

  //         data.setTaskNodes((prevTasks) => {
  //             const myTaskIds = prevTasks
  //                 .filter((t) => t.parentNode === id)
  //                 .map((t) => t.id);

  //             // show attempts again
  //             data.setAttemptNodes((prevAttempts) =>
  //                 prevAttempts.map((a) => {
  //                     if (!myTaskIds.includes(a.parentNode)) return a;
  //                     return { ...a, hidden: false };
  //                 })
  //             );

  //             // show my tasks
  //             return prevTasks.map((n) => {
  //                 if (n.parentNode !== id) return n;
  //                 return { ...n, hidden: false };
  //             });
  //         });

  //         setCollapsed(false);
  //     }

  //     playClackSound();
  // }

  return (
    <div
      style={{ width: data.componentWidth, height: height }}
      className="relative flex h-full overflow-visible rounded-lg border border-slate-300"
    >
      {/* top color strip (sit slightly above content so it doesn't eat into task height) */}
      <div
        style={{
          backgroundColor: data.color,
          height: '3px',
          width: '100%',
          top: '-3px',
          left: 0,
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />

      {/* Left vertical label */}
      <div
        style={{ width: SIDEBAR_WIDTH, backgroundColor: data.color }}
        className="relative flex items-center justify-center text-white"
        // onWheelCapture={(e) => {
        //     // e.preventDefault();
        //     e.stopPropagation();
        // }}
        onDoubleClickCapture={(e) => {
          e.stopPropagation();
        }}
      >
        <span
          className="text-xs font-semibold tracking-wide text-black"
          style={{ textOrientation: 'mixed' }}
        >
          {data.label}
        </span>
        <div
          className={` ${data.isCollapsed ? 'left-1 ' : 'top-1 left-1'} absolute cursor-pointer rounded bg-black/50 hover:bg-black/70`}
          style={{ zIndex: 50, pointerEvents: 'auto' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            // ************** -> ADDED NOW: toggleTeamCollapse call while onclick ***************** :
            // e.stopPropagation();
            // handleCollapse();
            // playClackSound()
            e.stopPropagation();
            console.log('[TeamNode] click collapse:', id, 'isCollapsed(data):', data.isCollapsed);
            data.toggleTeamCollapse(id);
          }}
        >
          <ChevronsDownUp size={14} color="white" />
        </div>
      </div>

      {/* Right area – allow clicking edges through; keep left bar interactive */}
      <div className="relative flex-1 p-2" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

// TaskNode
function TaskNode({ data }) {
  const {
    pixelMap = {},
    componentWidth,
    collapsedDays = {},
    isTeamCollapsed = false,
    isTaskCollapsed = false,
    onToggleTask,
    taskId,
  } = data || {};

  const taskHeight = isTeamCollapsed
    ? TASK_COLLAPSED_HEIGHT
    : isTaskCollapsed
      ? TASK_COLLAPSED_HEIGHT
      : TASK_HEIGHT;

  return (
    <div
      style={{ width: componentWidth - SIDEBAR_WIDTH, height: taskHeight }}
      className="flex h-full w-full border-b border-black/20"
    >
      <div
        style={{ width: TASK_SIDEBAR_WIDTH }}
        className="flex h-full items-center justify-center border-r bg-white/20 text-xs tracking-wide text-black"
      >
        <div
          className="relative flex w-full items-center justify-between px-2"
          style={{ pointerEvents: 'auto' }}
        >
          {!isTeamCollapsed && !isTaskCollapsed && <span>{data.label}</span>}
          {!isTeamCollapsed && isTaskCollapsed && (
            <span className="flex-1 truncate pr-1 text-[7px] text-gray-600">{data.label}</span>
          )}
          {!isTeamCollapsed && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleTask?.(taskId);
              }}
              className={`absolute top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[10px] text-black ${
                isTaskCollapsed ? 'left-0' : 'right-0'
              }`}
              aria-label="Toggle task"
              style={{
                background: 'transparent',
                border: 'none',
              }}
            >
              {isTaskCollapsed ? '▶' : '▼'}
            </button>
          )}
        </div>
      </div>
      <div className="flex h-full flex-1" style={{ pointerEvents: 'none' }}>
        {Object.entries(pixelMap).map(([index, range]) => {
          const isCollapsed = !!collapsedDays[Number(index)];
          return (
            <div
              key={index}
              style={{
                width: range.end - range.beginn,
                height: '100%',
              }}
              className={`border border-black/10 transition-all ${
                isCollapsed ? 'bg-slate-100 opacity-50' : ''
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// AttemptNode
function AttemptNode({ data, selected }) {
  const slotIndex = data.slotIndex || 1;
  const collapsedDays = data.collapsedDays || {};
  const isTeamCollapsed = data.isTeamCollapsed || false;
  const isTaskCollapsed = data.isTaskCollapsed || false;
  const isDayCollapsed = !!collapsedDays[slotIndex];
  const isCollapsed = isDayCollapsed || isTeamCollapsed || isTaskCollapsed;

  const attemptWidth = isDayCollapsed ? COLLAPSED_DAY_WIDTH - 4 : TASK_WIDTH - 15;
  const attemptHeight =
    isTeamCollapsed || isTaskCollapsed
      ? ATTEMPT_COLLAPSED_HEIGHT
      : isDayCollapsed
        ? COLLAPSED_DAY_WIDTH - 4
        : TASK_HEIGHT - 15;
  const collapsedMargin = isTeamCollapsed || isTaskCollapsed ? 'mx-2 my-[1px]' : 'm-2';

  return (
    <div
      className={`${collapsedMargin} flex items-center justify-center rounded-md border bg-gray-100 text-xs !text-[15px] font-bold text-black shadow-sm shadow-xl shadow-black/2 transition-all duration-150 hover:bg-gray-700 hover:text-white ${selected ? 'scale-105 border-sky-500 shadow-md shadow-black/30' : 'border-slate-300'} ${data.shake ? 'animate-pulse' : ''}`}
      style={{
        width: attemptWidth,
        height: attemptHeight,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {!isCollapsed && data.number}

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2"
        style={{
          left: -2,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2"
        style={{
          right: -2,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </div>
  );
}

// __________NODE TYPES

// nodeTypes
const nodeTypes = {
  teamNode: TeamNode,
  taskNode: TaskNode,
  attemptNode: AttemptNode,
  taskHeaderNode: TaskHeaderNode,
};

// headerNode template removed; we’ll build it inside the component with data

// ________________________COMPONENT________________________
export default function OrgAttempts() {
  console.log('________________________________\n');

  // States & Variables
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [all_teams, setAll_Teams] = useState([]);
  const [all_tasks, setAll_Tasks] = useState([]);
  const [all_attempts, setAll_Attempts] = useState([]);
  const [attempt_nodes, setAttemptNodes] = useState([]);
  const [groupNodes, setGroupNodes] = useState([]);
  const [taskNodes, setTaskNodes] = useState([]);
  const [mergedNodes, setMergedNodes] = useState([]);
  const [y_reactflow_size, setY_reactflow_size] = useState(1000);
  const [overallgap, setOverAllGap] = useState(0);

  const [edges, setEdges] = useState([]);
  const [selectedDepId, setSelectedDepId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [inspectSelectedNodeId, setInspectSelectedNodeId] = useState(null);

  const REACTFLOW_HEIGHT = 700;

  const [dep_setting_selected, setDep_setting_selected] = useState(true);
  const [mode, setMode] = useState('dependency'); // 'order', 'dependency', 'inspect'

  // View options
  const [hideCollapsedNodes, setHideCollapsedNodes] = useState(false);
  const [hideEdgesOfCollapsed, setHideEdgesOfCollapsed] = useState(false);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);

  // Collapsed days map: key = day index (1-based), value = true/false
  const [collapsedDays, setCollapsedDays] = useState({});
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Timeline derived from project dates
  const [timelineDays, setTimelineDays] = useState([]);
  const [entryCount, setEntryCount] = useState(DEFAULT_ENTRIES);

  // Compute which days have attempts scheduled
  const daysWithAttempts = useMemo(() => {
    const days = new Set();
    all_attempts.forEach((attempt) => {
      if (attempt.slot_index) {
        days.add(attempt.slot_index);
      }
    });
    return days;
  }, [all_attempts]);

  const componentWidth = useMemo(() => {
    const base = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH;
    let totalWidth = 0;
    for (let i = 1; i <= entryCount; i++) {
      totalWidth += collapsedDays[i] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;
    }
    return base + totalWidth;
  }, [entryCount, collapsedDays]);

  const pixelMap = useMemo(() => {
    const GRID_OFFSET = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH;
    let currentX = GRID_OFFSET;
    return Array.from({ length: entryCount }, (_, idx) => {
      const index = idx + 1;
      const beginn = currentX;
      const width = collapsedDays[index] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;
      const end = currentX + width;
      currentX = end;
      return [index, { beginn, end }];
    }).reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
  }, [entryCount, collapsedDays]);

  const getSlotIndexFromX = useCallback(
    (x) => {
      const relative = x - TASK_SIDEBAR_WIDTH;

      // Iterate through days to find which slot this X position corresponds to
      let accumulatedWidth = 0;
      for (let i = 1; i <= entryCount; i++) {
        const dayWidth = collapsedDays[i] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;

        // Check if x falls within this day's range
        if (relative < accumulatedWidth + dayWidth / 2) {
          return i;
        }

        accumulatedWidth += dayWidth;
      }

      // If we've gone past all days, return the last slot
      return entryCount;
    },
    [entryCount, collapsedDays],
  );

  const getXFromSlotIndex = useCallback(
    (slotIndex) => {
      // Calculate X position by summing up widths of all days before this slot
      let x = TASK_SIDEBAR_WIDTH;
      const targetIndex = slotIndex ?? 1;

      for (let i = 1; i < targetIndex; i++) {
        x += collapsedDays[i] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;
      }

      return x;
    },
    [collapsedDays],
  );

  const headerNode = useMemo(
    () => ({
      id: 'task-header',
      type: 'taskHeaderNode',
      position: { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      data: {
        componentWidth,
        taskWidth: TASK_WIDTH,
        sidebarWidth: SIDEBAR_WIDTH,
        taskSidebarWidth: TASK_SIDEBAR_WIDTH,
        timelineDays,
        entryCount,
        collapsedDays,
        pixelMap,
        onToggleDay: (dayIndex) => {
          // Toggle a single day and only update attempts whose slotIndex is affected
          setCollapsedDays((prev) => {
            const next = { ...prev, [dayIndex]: !prev[dayIndex] };

            // Update collapsedDays on all attempts; adjust X only for attempts after toggled day
            setAttemptNodes((prevAttempts) =>
              prevAttempts.map((attempt) => {
                const slotIndex = attempt.data?.slotIndex || 1;
                if (slotIndex > dayIndex) {
                  // Compute X using the updated collapse map without triggering full rerender
                  let x = TASK_SIDEBAR_WIDTH;
                  for (let i = 1; i < slotIndex; i++) {
                    x += next[i] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;
                  }
                  return {
                    ...attempt,
                    position: { ...attempt.position, x },
                    data: { ...attempt.data, collapsedDays: next },
                  };
                }
                // No position change, but keep render state in sync
                return { ...attempt, data: { ...attempt.data, collapsedDays: next } };
              }),
            );

            return next;
          });
        },
      },
    }),
    [componentWidth, timelineDays, entryCount, collapsedDays, pixelMap],
  );

  // ************** -> ADDED NOW : collapsedByTeamId ***************** :
  const [collapsedByTeamId, setCollapsedByTeamId] = useState({});
  const [collapsedTasks, setCollapsedTasks] = useState({});

  // ************** -> ADDED NOW 4: teamOrder useState ***************** :
  const [teamOrder, setTeamOrder] = useState([]);

  // ************** -> ADDED NOW: toggleTeamCollapse ***************** :
  const toggleTeamCollapse = useCallback(
    (teamNodeId) => {
      // Ensure expanding a team also expands all its tasks
      const tasksInTeam = taskNodes.filter((t) => t.parentNode === teamNodeId).map((t) => t.id);

      setCollapsedByTeamId((prev) => {
        const wasCollapsed = !!prev[teamNodeId];
        const nextCollapsed = !wasCollapsed;

        if (wasCollapsed && !nextCollapsed) {
          // We are expanding the team: expand all tasks inside it
          setCollapsedTasks((prevTasks) => {
            const nextTasks = { ...prevTasks };
            tasksInTeam.forEach((tid) => {
              if (nextTasks[tid]) nextTasks[tid] = false;
            });
            return nextTasks;
          });
        }

        return {
          ...prev,
          [teamNodeId]: nextCollapsed,
        };
      });
    },
    [taskNodes],
  );

  const toggleTaskCollapse = useCallback((taskNodeId) => {
    console.log('[toggleTaskCollapse] called for:', taskNodeId);
    setCollapsedTasks((prev) => ({
      ...prev,
      [taskNodeId]: !prev[taskNodeId],
    }));
  }, []);

  // Bulk controls
  const collapseAllTeams = useCallback(() => {
    setCollapsedByTeamId(() => {
      const next = {};
      groupNodes.forEach((team) => {
        next[team.id] = true;
      });
      return next;
    });
  }, [groupNodes]);

  const expandAllTeams = useCallback(() => {
    setCollapsedByTeamId(() => {
      const next = {};
      groupNodes.forEach((team) => {
        next[team.id] = false;
      });
      return next;
    });

    // Also expand all tasks for consistency
    setCollapsedTasks((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      taskNodes.forEach((t) => {
        if (next[t.id]) next[t.id] = false;
      });
      return next;
    });
  }, [groupNodes, taskNodes]);

  const collapseAllDays = useCallback(() => {
    setCollapsedDays(() => {
      const next = {};
      for (let i = 1; i <= entryCount; i++) {
        next[i] = true;
      }
      return next;
    });
  }, [entryCount]);

  const expandAllDays = useCallback(() => {
    setCollapsedDays({});
  }, []);

  // ************** -> ADDED NOW 3: Helper - getTaskIdsForTeam ***************** :
  function getTaskIdsForTeam(taskNodes, teamId) {
    return taskNodes.filter((t) => t.parentNode === teamId).map((t) => t.id);
  }

  // ************** -> ADDED NOW 3: Sinks hidden flags:  ***************** :
  // useEffect(() => {
  //     if (!groupNodes.length) return;

  //     console.log("==========[HIDE PASS] START==========");
  //     console.log("[HIDE PASS] collapsedByTeamId:", collapsedByTeamId);

  //     // Build a Set of all task ids that belong to collapsed teams
  //     const collapsedTeamIds = Object.keys(collapsedByTeamId).filter((k) => collapsedByTeamId[k]);
  //     console.log("[HIDE PASS] collapsedTeamIds:", collapsedTeamIds);

  //     const collapsedTaskIds = new Set();

  //     // 1) update taskNodes.hidden
  //     setTaskNodes((prevTasks) => {
  //         // collect task ids for collapsed teams
  //         collapsedTeamIds.forEach((teamId) => {
  //             prevTasks.forEach((t) => {
  //                 if (t.parentNode === teamId) collapsedTaskIds.add(t.id);
  //             });
  //         });

  //         console.log("[HIDE PASS] collapsedTaskIds:", Array.from(collapsedTaskIds));

  //         return prevTasks.map((t) => {
  //             const shouldHide = collapsedTeamIds.includes(t.parentNode);
  //             return shouldHide ? { ...t, hidden: true } : { ...t, hidden: false };
  //         });
  //     });

  //     // 2) update attempt_nodes.hidden (attempt_nodes state!)
  //     setAttemptNodes((prevAttempts) =>
  //         prevAttempts.map((a) => {
  //             const shouldHide = collapsedTaskIds.has(a.parentNode);
  //             return shouldHide ? { ...a, hidden: true } : { ...a, hidden: false };
  //         })
  //     );

  //     console.log("==========[HIDE PASS] END==========");
  // }, [collapsedByTeamId, groupNodes.length]);
  // Recalculate and update task positions based on all collapse states
  useEffect(() => {
    if (!taskNodes.length) return;

    const collapsedTaskIds = new Set(Object.keys(collapsedTasks).filter((k) => collapsedTasks[k]));
    const teamCollapsedSet = new Set(
      Object.keys(collapsedByTeamId).filter((k) => collapsedByTeamId[k]),
    );

    setTaskNodes((prevTasks) => {
      const byTeam = {};
      const taskIndexInTeam = {};
      prevTasks.forEach((t, idx) => {
        if (!byTeam[t.parentNode]) byTeam[t.parentNode] = [];
        taskIndexInTeam[t.id] = byTeam[t.parentNode].length;
        byTeam[t.parentNode].push(t);
      });

      const positionMap = {};
      Object.entries(byTeam).forEach(([teamId, list]) => {
        const isTeamCollapsed = teamCollapsedSet.has(teamId);
        // Use stable task order (order in list) instead of sorting by stale Y position
        let currentY = 0;
        list.forEach((t) => {
          const isTaskCollapsed = collapsedTaskIds.has(t.id);
          const eff = isTeamCollapsed
            ? TASK_COLLAPSED_HEIGHT
            : isTaskCollapsed
              ? TASK_COLLAPSED_HEIGHT
              : TASK_HEIGHT;
          positionMap[t.id] = currentY;
          currentY += eff;
        });
      });

      return prevTasks.map((t) => {
        const isTaskCollapsed = collapsedTaskIds.has(t.id);
        const isTeamCollapsed = teamCollapsedSet.has(t.parentNode);
        const newY = positionMap[t.id] ?? t.position.y;
        return {
          ...t,
          position: { ...t.position, y: newY },
          data: {
            ...t.data,
            isTeamCollapsed,
            isTaskCollapsed,
          },
        };
      });
    });
  }, [collapsedTasks, collapsedByTeamId, collapsedDays]);

  // When days are toggled, force a complete task position recalculation
  useEffect(() => {
    if (!taskNodes.length) return;

    const collapsedTaskIds = new Set(Object.keys(collapsedTasks).filter((k) => collapsedTasks[k]));
    const teamCollapsedSet = new Set(
      Object.keys(collapsedByTeamId).filter((k) => collapsedByTeamId[k]),
    );

    setTaskNodes((prevTasks) => {
      const byTeam = {};
      prevTasks.forEach((t) => {
        if (!byTeam[t.parentNode]) byTeam[t.parentNode] = [];
        byTeam[t.parentNode].push(t);
      });

      const positionMap = {};
      Object.entries(byTeam).forEach(([teamId, list]) => {
        const isTeamCollapsed = teamCollapsedSet.has(teamId);
        let currentY = 0;
        list.forEach((t) => {
          const isTaskCollapsed = collapsedTaskIds.has(t.id);
          const eff = isTeamCollapsed
            ? TASK_COLLAPSED_HEIGHT
            : isTaskCollapsed
              ? TASK_COLLAPSED_HEIGHT
              : TASK_HEIGHT;
          positionMap[t.id] = currentY;
          currentY += eff;
        });
      });

      return prevTasks.map((t) => {
        const newY = positionMap[t.id];
        if (newY !== t.position.y) {
          return {
            ...t,
            position: { ...t.position, y: newY },
          };
        }
        return t;
      });
    });
  }, [collapsedDays, taskNodes.length]);

  // Update attempt flags and team heights after task positions are recalculated
  useEffect(() => {
    if (!taskNodes.length || !groupNodes.length) return;

    const collapsedTaskIds = new Set(Object.keys(collapsedTasks).filter((k) => collapsedTasks[k]));
    const teamCollapsedSet = new Set(
      Object.keys(collapsedByTeamId).filter((k) => collapsedByTeamId[k]),
    );

    // Update attempts with correct collapse flags
    setAttemptNodes((prevAttempts) =>
      prevAttempts.map((a) => {
        const isTaskCollapsed = collapsedTaskIds.has(a.parentNode);
        const isTeamCollapsed = teamCollapsedSet.has(
          taskNodes.find((t) => t.id === a.parentNode)?.parentNode,
        );
        return {
          ...a,
          hidden: false,
          data: {
            ...a.data,
            isTaskCollapsed,
            isTeamCollapsed,
          },
        };
      }),
    );

    // Update team heights based on current task collapse states
    const heightsByTeam = {};
    taskNodes.forEach((t) => {
      const isTeamCollapsed = teamCollapsedSet.has(t.parentNode);
      if (isTeamCollapsed) {
        heightsByTeam[t.parentNode] = TEAM_COLLAPSED_HEIGHT;
        return;
      }
      const eff = collapsedTaskIds.has(t.id) ? TASK_COLLAPSED_HEIGHT : TASK_HEIGHT;
      heightsByTeam[t.parentNode] = (heightsByTeam[t.parentNode] || 0) + eff;
    });

    setGroupNodes((prevTeams) =>
      prevTeams.map((team) => {
        const isCollapsed = teamCollapsedSet.has(team.id);
        const expandedHeight = heightsByTeam[team.id] ?? 0;
        const height = isCollapsed ? TEAM_COLLAPSED_HEIGHT : expandedHeight;
        return {
          ...team,
          data: {
            ...team.data,
            height,
            isCollapsed,
          },
        };
      }),
    );

    setLayoutVersion((v) => v + 1);
  }, [taskNodes, collapsedTasks, collapsedByTeamId, collapsedDays]);

  // ************** -> ADDED NOW 4: Helper: getTeamInsertIndexFromY ***************** :
  function getTeamInsertIndexFromY(dropY, orderedTeamIds, groupNodes, collapsedByTeamId) {
    let currentY = TASK_HEIGHT + HEADER_BODY_GAP;

    for (let i = 0; i < orderedTeamIds.length; i++) {
      const id = orderedTeamIds[i];
      const node = groupNodes.find((n) => n.id === id);
      if (!node) continue;

      const expandedHeight = node.data?.height ?? 0;
      const effectiveHeight = collapsedByTeamId[id] ? TEAM_COLLAPSED_HEIGHT : expandedHeight;

      const midY = currentY + effectiveHeight / 2;

      console.log(
        '[REORDER CHECK]',
        id,
        'range:',
        currentY,
        '→',
        currentY + effectiveHeight,
        'mid:',
        midY,
        'dropY:',
        dropY,
      );

      if (dropY < midY) {
        return i;
      }

      currentY += effectiveHeight + TEAM_GAP_PADDING_Y;
    }

    return orderedTeamIds.length;
  }

  // ************** -> ADDED NOW 4: Updated this effect (order aware) ***************** :
  // ************** -> ADDED NOW 2: useEffect - runs when collapse map changes ***************** :
  // useEffect(() => {
  //     if (!groupNodes.length) return;

  //     console.log("==========[LAYOUT PASS] START==========");
  //     console.log("[LAYOUT PASS] collapsedByTeamId:", collapsedByTeamId);

  //     setGroupNodes((prev) => {
  //         let currentY = TASK_HEIGHT + HEADER_BODY_GAP;
  //         const next = prev.map((node) => {
  //             const isCollapsed = !!collapsedByTeamId[node.id];

  //             const expandedHeight = node.data?.height ?? 0;
  //             const effectiveHeight = isCollapsed ? TEAM_COLLAPSED_HEIGHT : expandedHeight;

  //             console.log(
  //                 "[LAYOUT PASS] team:",
  //                 node.id,
  //                 "collapsed:",
  //                 isCollapsed,
  //                 "expandedHeight:",
  //                 expandedHeight,
  //                 "effectiveHeight:",
  //                 effectiveHeight,
  //                 "newY:",
  //                 currentY
  //             );

  //             const updated = {
  //                 ...node,
  //                 position: { ...node.position, y: currentY },
  //                 data: {
  //                     ...node.data,
  //                     isCollapsed, // keep data in sync too
  //                 },
  //             };

  //             currentY += effectiveHeight + TEAM_GAP_PADDING_Y;
  //             return updated;
  //         });

  //         console.log("==========[LAYOUT PASS] END==========");
  //         return next;
  //     });

  //     // optional: update reactflow container height too
  //     // (we’ll verify the packing first, then adjust height precisely)
  // }, [collapsedByTeamId]);
  useEffect(() => {
    if (!groupNodes.length) return;
    if (!teamOrder.length) return;

    console.log('==========[LAYOUT PASS] START==========');
    console.log('[LAYOUT PASS] teamOrder:', teamOrder);
    console.log('[LAYOUT PASS] collapsedByTeamId:', collapsedByTeamId);

    setGroupNodes((prev) => {
      // map nodes by id for fast lookup
      const byId = new Map(prev.map((n) => [n.id, n]));

      // build ordered list (ignore ids that no longer exist)
      const ordered = teamOrder.map((id) => byId.get(id)).filter(Boolean);

      // append any “new/untracked” teams that aren’t in teamOrder yet (safety)
      const extras = prev.filter((n) => !teamOrder.includes(n.id));
      if (extras.length) {
        console.log(
          '[LAYOUT PASS] extras not in teamOrder:',
          extras.map((e) => e.id),
        );
      }

      let currentY = TASK_HEIGHT + HEADER_BODY_GAP;

      const next = [...ordered, ...extras].map((node) => {
        const isCollapsed = !!collapsedByTeamId[node.id];

        const expandedHeight = node.data?.height ?? 0;
        const effectiveHeight = isCollapsed ? TEAM_COLLAPSED_HEIGHT : expandedHeight;

        console.log(
          '[LAYOUT PASS] team:',
          node.id,
          'collapsed:',
          isCollapsed,
          'expandedHeight:',
          expandedHeight,
          'effectiveHeight:',
          effectiveHeight,
          'newY:',
          currentY,
        );

        const updated = {
          ...node,
          position: { ...node.position, y: currentY },
          data: { ...node.data, isCollapsed },
        };

        currentY += effectiveHeight + TEAM_GAP_PADDING_Y;
        return updated;
      });

      console.log('==========[LAYOUT PASS] END==========');
      return next;
    });
  }, [collapsedByTeamId, teamOrder, layoutVersion, groupNodes.length]);

  useEffect(() => {
    // Mode toggle: when dep_setting_selected is true, we’re in dependency mode -> disable dragging to favor edge selection
    // When false (Change Group Display), enable dragging for team reorder; keep selectable false to avoid edge overlay issues
    const draggingEnabled = mode === 'order';
    setGroupNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        selectable: false,
        draggable: draggingEnabled,
      })),
    );
  }, [mode, collapsedDays, collapsedTasks, groupNodes.length]);

  // Update attempt nodes draggable state based on mode
  useEffect(() => {
    // In inspect mode, disable dragging for attempt nodes but allow selection
    const attemptDraggingEnabled = mode !== 'inspect';
    setAttemptNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        draggable: attemptDraggingEnabled,
        selectable: true, // Always allow selection for edge highlighting
      })),
    );
  }, [mode, attempt_nodes.length]);

  // Highlight incoming/outgoing edges when a node is selected in inspect mode
  useEffect(() => {
    if (mode !== 'inspect') {
      // Clear any edge highlighting when not in inspect mode
      setEdges((prev) =>
        prev.map((e) => {
          const { stroke: _oldStroke, ...restStyle } = e.style || {};
          return { ...e, style: { ...restStyle } };
        }),
      );
      return;
    }

    setEdges((prev) =>
      prev.map((e) => {
        if (!inspectSelectedNodeId) {
          const { stroke: _oldStroke, ...restStyle } = e.style || {};
          return { ...e, style: { ...restStyle } };
        }
        const isIncoming = e.target === inspectSelectedNodeId;
        const isOutgoing = e.source === inspectSelectedNodeId;

        if (isIncoming) {
          return { ...e, style: { ...e.style, stroke: 'red' } };
        } else if (isOutgoing) {
          return { ...e, style: { ...e.style, stroke: 'green' } };
        } else {
          // Clear stroke for edges not connected to selected node
          const { stroke: _oldStroke, ...restStyle } = e.style || {};
          return { ...e, style: { ...restStyle } };
        }
      }),
    );
  }, [mode, inspectSelectedNodeId]);

  // Filter edges based on hideEdgesOfCollapsed option
  useEffect(() => {
    setEdges((prev) =>
      prev.map((edge) => {
        if (!hideEdgesOfCollapsed) {
          // When disabled, ensure edge is visible
          if (edge.hidden) {
            return { ...edge, hidden: false };
          }
          return edge;
        }

        // Extract attempt IDs from edge source/target (format: "attempt-123")
        const sourceAttemptId = edge.source?.replace('attempt-', '');
        const targetAttemptId = edge.target?.replace('attempt-', '');

        // Find the attempts to get their task IDs
        const sourceAttempt = all_attempts.find((a) => a.id === parseInt(sourceAttemptId));
        const targetAttempt = all_attempts.find((a) => a.id === parseInt(targetAttemptId));

        if (!sourceAttempt || !targetAttempt) return edge;

        // Check collapse states
        const sourceTaskId = `task-${sourceAttempt.task.id}`;
        const targetTaskId = `task-${targetAttempt.task.id}`;
        const sourceTeamId = `team-${sourceAttempt.task.team}`;
        const targetTeamId = `team-${targetAttempt.task.team}`;

        const sourceCollapsed = !!collapsedTasks[sourceTaskId] || !!collapsedByTeamId[sourceTeamId];
        const targetCollapsed = !!collapsedTasks[targetTaskId] || !!collapsedByTeamId[targetTeamId];

        const shouldHide = sourceCollapsed || targetCollapsed;

        // Only update if the hidden state actually changed
        if (edge.hidden === shouldHide) return edge;
        return { ...edge, hidden: shouldHide };
      }),
    );
  }, [hideEdgesOfCollapsed, collapsedByTeamId, collapsedTasks, all_attempts]);

  // __________LOAD DATA
  useEffect(() => {
    async function loadData() {
      // 1) load project to derive timeline
      const project = await fetch_project_detail(projectId);
      if (project.start_date && project.end_date) {
        const start = dayjs(project.start_date);
        const end = dayjs(project.end_date);
        const days = [];
        let cursor = start;
        while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
          days.push(cursor);
          cursor = cursor.add(1, 'day');
        }
        setTimelineDays(days);
        setEntryCount(days.length || DEFAULT_ENTRIES);
      } else {
        setTimelineDays([]);
        setEntryCount(DEFAULT_ENTRIES);
      }

      //LOAD TEAMS (& Tasks through Teams)
      async function loadTeams() {
        // ************** -> ADDED NOW: security log: [loadTeams] ***************** :
        console.log('[loadTeams] collapsedByTeamId:', collapsedByTeamId);

        try {
          //Fetch Teams
          const all_teams_raw = await project_teams_expanded(projectId);

          console.log('[RAW teams keys example]', Object.keys(all_teams_raw?.[0] ?? {}));
          console.log(
            '[RAW teams raw line_index]',
            all_teams_raw.map((t) => ({ id: t.id, li: t.line_index })),
          );

          const all_teams = [...all_teams_raw].sort((a, b) => {
            const ai = a.line_index ?? 999999;
            const bi = b.line_index ?? 999999;
            if (ai !== bi) return ai - bi;
            return a.id - b.id; // stable fallback
          });

          console.log(
            '[loadTeams] sortedTeams:',
            all_teams.map((t) => ({ id: t.id, li: t.line_index })),
          );

          setAll_Teams(all_teams);

          //VARIABLES
          const num_teams = all_teams.length;
          let currentY = TASK_HEIGHT + HEADER_BODY_GAP; // start below header

          //RENDER TEAM NODES
          const updated_group_nodes = all_teams
            .filter((team) => team.tasks && team.tasks.length > 0)
            .map((team) => {
              const teamNodeId = `team-${team.id}`;
              const isTeamCollapsed = !!collapsedByTeamId[teamNodeId];

              // Calculate EXPANDED height (always store expanded, LAYOUT PASS handles collapse rendering)
              let team_display_height = team.tasks.length * TASK_HEIGHT;
              // if (team_display_height < 100) {
              //   team_display_height = 100;
              // }
              if (!team.tasks) return null;

              const node = {
                id: teamNodeId,
                type: 'teamNode',
                position: { x: 0, y: currentY }, // 👈 use cumulative Y
                data: {
                  label: team.name,
                  color: team.color,
                  height: team_display_height,
                  setTaskNodes,
                  setAttemptNodes,

                  // ************** -> ADDED NOW: toggleTeamCollapse & isCollapsed ***************** :
                  toggleTeamCollapse,
                  isCollapsed: isTeamCollapsed,
                  componentWidth,
                },

                draggable: false,
                selectable: false,
                // TODO (selectable: false) in group nodes HINDERS COLLPASE BUTTON OF TEAM BUT IS ALSO NECESSARY FOR SELECTING EDGES
                // selectable: false
              };

              currentY += team_display_height + TEAM_GAP_PADDING_Y; // 👈 move down for next team

              return node;
            })
            .filter(Boolean);

          setGroupNodes(updated_group_nodes);

          // ************** -> ADDED NOW 4: initialOrder ***************** :
          const initialOrder = updated_group_nodes.map((n) => n.id);
          console.log('[teamOrder:init]', initialOrder);
          setTeamOrder(initialOrder);

          //RENDER TASK NODES
          const updated_task_nodes = all_teams.flatMap((team) => {
            const tasks_of_this_team = team.tasks || [];
            const teamNodeId = `team-${team.id}`;
            const isTeamCollapsed = !!collapsedByTeamId[teamNodeId];

            return tasks_of_this_team.map((task, taskIndex) => ({
              id: `task-${task.id}`, // globally unique ID
              type: 'taskNode', // must exist in nodeTypes
              parentNode: teamNodeId, // 👈 put it inside the TeamNode
              extent: 'parent',
              position: {
                x: SIDEBAR_WIDTH, // left inside content area
                y: taskIndex * (isTeamCollapsed ? TASK_COLLAPSED_HEIGHT : TASK_HEIGHT), // vertical stacking
              },
              data: {
                label: task.name,
                componentWidth,
                pixelMap,
                collapsedDays,
                isTeamCollapsed,
                isTaskCollapsed: !!collapsedTasks[`task-${task.id}`],
                taskId: `task-${task.id}`,
                onToggleTask: toggleTaskCollapse,
                // you can pass more here:
                // width: ..., color: ..., etc.
              },
              draggable: false,
              selectable: false,
            }));
          });

          setTaskNodes(updated_task_nodes);

          setOverAllGap(get_overall_gap(num_teams, TEAM_GAP_PADDING_Y, HEADER_BODY_GAP));
          setY_reactflow_size(
            currentY + get_overall_gap(num_teams, TEAM_GAP_PADDING_Y, HEADER_BODY_GAP),
          );
        } catch (err) {
          console.error('Error loading teams:', err);

          if (err.status === 401 || err.status === 403) {
            // optional: wipe auth state
            logout?.();
            // navigate instead of redirect()
            navigate('/login');
            return;
          }
        }
      }

      // loadAttempts
      async function loadAttempts() {
        const all_attempts = await fetch_all_attempts();
        setAll_Attempts(all_attempts);

        const updated_attempt_nodes = all_attempts.map((attempt, index) => {
          const x = getXFromSlotIndex(attempt.slot_index); // 👈 use DB value, default inside helper

          // Check if parent task's team/task is collapsed
          const taskNodeId = `task-${attempt.task.id}`;
          const taskNode = taskNodes.find((t) => t.id === taskNodeId);
          const isTeamCollapsed = taskNode?.data?.isTeamCollapsed || false;
          const isTaskCollapsed = !!collapsedTasks[taskNodeId];

          return {
            id: `attempt-${attempt.id}`,
            parentNode: taskNodeId,
            extent: 'parent',
            type: 'attemptNode',
            position: { x, y: index * 0 }, // y stays as before
            data: {
              label: attempt.name,
              number: attempt.number,
              slotIndex: attempt.slot_index,
              collapsedDays,
              isTeamCollapsed,
              isTaskCollapsed,
            },
          };
        });

        // Filter out collapsed nodes if hideCollapsedNodes is enabled
        const filteredAttemptNodes = hideCollapsedNodes
          ? updated_attempt_nodes.filter((node) => {
              const isTeamCollapsed = node.data?.isTeamCollapsed || false;
              const isTaskCollapsed = node.data?.isTaskCollapsed || false;
              return !isTeamCollapsed && !isTaskCollapsed;
            })
          : updated_attempt_nodes;

        setAttemptNodes(filteredAttemptNodes);
      }

      // loadAttemptDependencies
      async function loadAttemptDependencies() {
        const deps = await fetch_all_attempt_dependencies();

        const initialEdges = deps.map((dep) => ({
          id: `attemptdep-${dep.id}`,
          source: `attempt-${dep.vortakt_attempt_id}`,
          target: `attempt-${dep.nachtakt_attempt_id}`,
          type: 'default',
          animated: true,
          interactionWidth: 20,
          style: { strokeWidth: 2 },
        }));

        setEdges(initialEdges);
      }

      await loadTeams();
      await loadAttempts();
      await loadAttemptDependencies();
    }
    loadData();
  }, [projectId, navigate, logout, getXFromSlotIndex]); // keep other deps as before

  // Update task nodes when collapsedDays or pixelMap changes
  useEffect(() => {
    setTaskNodes((prevTasks) =>
      prevTasks.map((task) => ({
        ...task,
        data: {
          ...task.data,
          componentWidth,
          pixelMap,
          collapsedDays,
        },
      })),
    );
  }, [collapsedDays, pixelMap, componentWidth]);

  // Automatically collapse/expand empty days when hideEmptyDays changes
  useEffect(() => {
    setCollapsedDays((prevCollapsedDays) => {
      const newCollapsedDays = { ...prevCollapsedDays };
      let hasChanges = false;

      for (let i = 1; i <= entryCount; i++) {
        const isEmpty = !daysWithAttempts.has(i);
        const shouldBeCollapsed = hideEmptyDays && isEmpty;
        const isCurrentlyCollapsed = !!newCollapsedDays[i];

        if (isEmpty) {
          // Only modify empty days
          if (shouldBeCollapsed && !isCurrentlyCollapsed) {
            newCollapsedDays[i] = true;
            hasChanges = true;
          } else if (!shouldBeCollapsed && isCurrentlyCollapsed) {
            delete newCollapsedDays[i];
            hasChanges = true;
          }
        }
      }

      return hasChanges ? newCollapsedDays : prevCollapsedDays;
    });
  }, [hideEmptyDays, entryCount, daysWithAttempts]);

  // Re-filter attempt nodes when hideCollapsedNodes changes
  useEffect(() => {
    if (!all_attempts.length) return;

    const updated_attempt_nodes = all_attempts.map((attempt, index) => {
      const x = getXFromSlotIndex(attempt.slot_index);
      const taskNodeId = `task-${attempt.task.id}`;
      const taskNode = taskNodes.find((t) => t.id === taskNodeId);
      const isTeamCollapsed = taskNode?.data?.isTeamCollapsed || false;
      const isTaskCollapsed = !!collapsedTasks[taskNodeId];

      return {
        id: `attempt-${attempt.id}`,
        parentNode: taskNodeId,
        extent: 'parent',
        type: 'attemptNode',
        position: { x, y: index * 0 },
        data: {
          label: attempt.name,
          number: attempt.number,
          slotIndex: attempt.slot_index,
          collapsedDays,
          isTeamCollapsed,
          isTaskCollapsed,
        },
      };
    });

    const filteredAttemptNodes = hideCollapsedNodes
      ? updated_attempt_nodes.filter((node) => {
          const isTeamCollapsed = node.data?.isTeamCollapsed || false;
          const isTaskCollapsed = node.data?.isTaskCollapsed || false;
          return !isTeamCollapsed && !isTaskCollapsed;
        })
      : updated_attempt_nodes;

    setAttemptNodes(filteredAttemptNodes);
  }, [
    hideCollapsedNodes,
    all_attempts,
    taskNodes,
    collapsedTasks,
    collapsedDays,
    getXFromSlotIndex,
  ]);

  // Attempts no longer fully recompute on every collapsedDays change;
  // we update selectively in onToggleDay above to reduce lag.

  // Merge Nodes
  useEffect(() => {
    setMergedNodes([headerNode, ...groupNodes, ...taskNodes, ...attempt_nodes]);
  }, [headerNode, groupNodes, taskNodes, attempt_nodes, dep_setting_selected]);

  // onNodesChange
  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // onNodeDragStop
  const onNodeDragStop = useCallback(
    (event, node) => {
      // In inspect mode, disable all drag actions
      if (mode === 'inspect') return;

      playSnapSound();
      // ************** -> ADDED NOW 4: onNodeDragStop for group nodes ***************** :
      if (node.type === 'teamNode') {
        console.log('==========[TEAM DROP]==========');
        console.log('[TEAM DROP] node:', node.id);
        console.log('[TEAM DROP] dropY:', node.position.y);
        console.log('[TEAM DROP] current order:', teamOrder);

        const filtered = teamOrder.filter((id) => id !== node.id);

        const insertIndex = getTeamInsertIndexFromY(
          node.position.y,
          filtered,
          groupNodes,
          collapsedByTeamId,
        );

        const nextOrder = [
          ...filtered.slice(0, insertIndex),
          node.id,
          ...filtered.slice(insertIndex),
        ];

        console.log('[TEAM DROP] insertIndex:', insertIndex);
        console.log('[TEAM DROP] next order:', nextOrder);

        setTeamOrder(nextOrder);

        const orderIds = nextOrder.map(extractTeamId).filter((x) => x !== null);

        console.log('[TEAM DROP] saving orderIds:', orderIds);

        (async () => {
          try {
            const res = await reorder_project_teams(projectId, orderIds);
            console.log('[TEAM DROP] saved order:', res);
          } catch (err) {
            console.error('[TEAM DROP] failed to save order:', err);
          }
        })();

        return;
      }

      if (node.type !== 'attemptNode') return;

      const slotIndex = getSlotIndexFromX(node.position.x);

      // Block dropping onto collapsed days: revert to original slot and pulse
      if (collapsedDays[slotIndex]) {
        const originalSlot = node?.data?.slotIndex || 1;
        const revertX = getXFromSlotIndex(originalSlot);

        setAttemptNodes((prev) =>
          prev.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  position: { ...n.position, x: revertX },
                  data: { ...n.data, shake: true },
                }
              : n,
          ),
        );

        // Clear shake after a short delay
        setTimeout(() => {
          setAttemptNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, shake: false } } : n)),
          );
        }, 250);

        return; // do not save slot index when blocked
      }

      const snappedX = getXFromSlotIndex(slotIndex);

      setAttemptNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? { ...n, position: { ...n.position, x: snappedX }, data: { ...n.data, slotIndex } }
            : n,
        ),
      );

      setMergedNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                position: { ...n.position, x: snappedX },
              }
            : n,
        ),
      );

      const attemptId = extractAttemptId(node.id); // "attempt-19" -> 19
      if (!attemptId) return;

      (async () => {
        try {
          const res = await update_attempt_slot_index(attemptId, slotIndex);
          console.log('Slot index saved:', res);
        } catch (err) {
          console.error('Failed to save slot index:', err);
        }
      })();

      // ************** -> ADDED NOW 4: dependency list update:  ***************** :
      // }, [setMergedNodes]);
    },
    [teamOrder, groupNodes, collapsedByTeamId, collapsedDays, getXFromSlotIndex, getSlotIndexFromX],
  );

  // onEdgesChange
  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // onConnect
  const onConnect = useCallback(
    (connection) => {
      // Only allow connection creation in dependency mode
      if (mode !== 'dependency') return;

      console.log('onConnect fired:', connection);

      const vortaktId = extractAttemptId(connection.source);
      const nachtaktId = extractAttemptId(connection.target);

      if (!vortaktId || !nachtaktId) {
        console.error('Could not parse attempt IDs from nodes:', connection);
        return;
      }

      (async () => {
        try {
          const res = await add_attempt_dependency(vortaktId, nachtaktId);
          console.log('Dependency created:', res);

          setEdges((eds) =>
            addEdge(
              {
                ...connection,
                id: `attemptdep-${res.id}`, // 👈 now we know which DB row this is
                type: 'default',
                animated: true,
                interactionWidth: 20,
                style: { strokeWidth: 2 },
              },
              eds,
            ),
          );
        } catch (err) {
          console.error('Failed to create attempt dependency:', err);
        }
      })();
      playWhipSound();
    },
    [mode, setEdges],
  );

  // handleDeleteSelectedDependency
  async function handleDeleteSelectedDependency() {
    playWhipSound();
    if (!selectedDepId || !selectedEdgeId) return;

    try {
      const res = await delete_attempt_dependency(selectedDepId);
      console.log('Dependency deleted:', res);

      // Remove edge from ReactFlow
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));

      setSelectedDepId(null);
      setSelectedEdgeId(null);
    } catch (err) {
      console.error('Failed to delete dependency:', err);
    }
  }

  // ________________________RENDER________________________
  return (
    <>
      <div
        style={{ height: `${y_reactflow_size + SETTINGS_HEIGHT}px` }}
        className="flex w-screen items-center justify-center bg-white p-3 sm:max-w-full md:max-w-[700px] lg:max-w-full lg:px-10"
      >
        {/* Delete Dependency */}
        {/* TODO should be outdated */}
        {/* {selectedDepId && (
                    <div className="absolute top-15 left-0 w-full flex justify-center mt-4">
                        <button
                            onClick={handleDeleteSelectedDependency}
                            className="
                                        px-4 py-2 rounded-md 
                                        bg-red-500 text-white 
                                        text-sm font-medium 
                                        hover:bg-red-600 
                                        shadow-sm">
                            Delete selected dependency
                        </button>
                    </div>
                )} */}

        {/* ReactFlow */}
        {/* IMPORTANT: (height: y_reactflow_size + 50) */}
        <div
          style={{ width: componentWidth, height: y_reactflow_size + SETTINGS_HEIGHT }}
          className="mx-5 mt-30 mb-5 rounded-xl bg-gray-200 shadow-xl shadow-black/30 sm:mx-10"
        >
          <div style={{ height: SETTINGS_HEIGHT }} className="relative flex w-full flex-col gap-2">
            <div className="flex h-[40px] gap-2">
              <Button
                className={` ${mode === 'order' ? '!bg-gray-500' : '!bg-gray-300'} h-full w-full`}
                onClick={() => setMode('order')}
                variant="contained"
              >
                Order Mode
              </Button>

              <Button
                className={` ${mode === 'dependency' ? '!bg-gray-500' : '!bg-gray-300'} h-full w-full`}
                onClick={() => setMode('dependency')}
                variant="contained"
              >
                Dependency Mode
              </Button>

              <Button
                className={` ${mode === 'inspect' ? '!bg-gray-500' : '!bg-gray-300'} h-full w-full`}
                onClick={() => setMode('inspect')}
                variant="contained"
              >
                Inspect Mode
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                className="!bg-slate-200 !text-black"
                variant="contained"
                onClick={collapseAllTeams}
              >
                Collapse All Teams
              </Button>
              <Button
                className="!bg-slate-200 !text-black"
                variant="contained"
                onClick={expandAllTeams}
              >
                Expand All Teams
              </Button>
              <Button
                className="!bg-slate-200 !text-black"
                variant="contained"
                onClick={collapseAllDays}
              >
                Collapse All Days
              </Button>
              <Button
                className="!bg-slate-200 !text-black"
                variant="contained"
                onClick={expandAllDays}
              >
                Expand All Days
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                className={`!text-black ${hideCollapsedNodes ? '!bg-blue-400' : '!bg-slate-200'}`}
                variant="contained"
                onClick={() => setHideCollapsedNodes(!hideCollapsedNodes)}
              >
                {hideCollapsedNodes ? '✓' : ''} Hide Collapsed Nodes
              </Button>
              <Button
                className={`!text-black ${hideEdgesOfCollapsed ? '!bg-blue-400' : '!bg-slate-200'}`}
                variant="contained"
                onClick={() => setHideEdgesOfCollapsed(!hideEdgesOfCollapsed)}
              >
                {hideEdgesOfCollapsed ? '✓' : ''} Hide Edges of Collapsed
              </Button>
              <Button
                className={`!text-black ${hideEmptyDays ? '!bg-blue-400' : '!bg-slate-200'}`}
                variant="contained"
                onClick={() => setHideEmptyDays(!hideEmptyDays)}
              >
                {hideEmptyDays ? '✓' : ''} Hide Empty Days
              </Button>
            </div>
            <div className="mb-1">
              {selectedDepId && (
                <div className="h–full">
                  <button
                    onClick={handleDeleteSelectedDependency}
                    className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
                  >
                    Delete selected dependency
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ height: y_reactflow_size }}>
            <ReactFlow
              nodes={mergedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={(_, node) => {
                console.log('Node clicked:', node?.id, 'Mode:', mode);
                if (mode === 'inspect') {
                  const newId = node?.id || null;
                  console.log('Setting inspectSelectedNodeId to:', newId);
                  setInspectSelectedNodeId(newId);
                } else {
                  setSelectedNodeId(node?.id || null);
                  setSelectedEdgeId(null);
                  setSelectedDepId(null);
                }
              }}
              onPaneClick={() => {
                console.log('Pane clicked, Mode:', mode);
                if (mode === 'inspect') {
                  console.log('Clearing inspectSelectedNodeId');
                  setInspectSelectedNodeId(null);
                } else {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setSelectedDepId(null);
                }
              }}
              elementsSelectable={true} // (default, but nice to be explicit)
              deleteKeyCode={['Delete', 'Backspace']}
              minZoom={1}
              onEdgeClick={(evt, edge) => {
                console.log('EDGE CLICKED:', edge);
                if (edge.id?.startsWith('attemptdep-')) {
                  const depId = parseInt(edge.id.replace('attemptdep-', ''), 10);
                  if (!Number.isNaN(depId)) {
                    setSelectedDepId(depId);
                    setSelectedEdgeId(edge.id);
                  }
                } else {
                  setSelectedDepId(null);
                  setSelectedEdgeId(null);
                }
              }}
              translateExtent={[
                [0, 0],
                [componentWidth, y_reactflow_size],
              ]}
              onSelectionChange={({ nodes }) => {
                const first = nodes && nodes.length ? nodes[0] : null;
                setSelectedNodeId(first ? first.id : null);
              }}
            ></ReactFlow>
          </div>
        </div>
      </div>
    </>
  );
}
