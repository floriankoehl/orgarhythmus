import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback } from 'react';
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
} from '../../api/org_API';
import snapSoundFile from '../../../assets/snap.mp3';
import whipSoundFile from '../../../assets/whip.mp3';
import clackSoundFile from '../../../assets/pen_down.mp3';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ChevronsDownUp } from 'lucide-react';
import Button from '@mui/material/Button';

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

// getSlotIndexFromX
function getSlotIndexFromX(x) {
  const relative = x - TASK_SIDEBAR_WIDTH;

  let idxZero = Math.round(relative / TASK_WIDTH); // 0-based
  if (idxZero < 0) idxZero = 0;
  if (idxZero > ENTRIES - 1) idxZero = ENTRIES - 1;

  return idxZero + 1; // 1-based
}

// getXFromSlotIndex
function getXFromSlotIndex(slotIndex) {
  let idxZero = (slotIndex ?? 1) - 1;
  if (idxZero < 0) idxZero = 0;
  if (idxZero > ENTRIES - 1) idxZero = ENTRIES - 1;

  return TASK_SIDEBAR_WIDTH + idxZero * TASK_WIDTH;
}

// snapAttemptX
function snapAttemptX(x) {
  const slotIndex = getSlotIndexFromX(x);
  return getXFromSlotIndex(slotIndex);
}

// Main Variables
const isMobile = window.innerWidth <= 768;
let TASK_HEIGHT = 60;
let TASK_WIDTH = 60;
let SETTINGS_HEIGHT = 85;
const ENTRIES = 25;

let SIDEBAR_WIDTH = 80;
let TASK_SIDEBAR_WIDTH = 100;

const TEAM_GAP_PADDING_Y = 10;
const TASK_GAP_PADDING_X = 0;
const HEADER_BODY_GAP = 10;

// ************** -> ADDED NOW 2: const TEAM_COLLAPSED_HEIGHT ***************** :
const TEAM_COLLAPSED_HEIGHT = 20;

// Mobile Task Adjustment
if (isMobile) {
  TASK_HEIGHT = 45;
  TASK_WIDTH = 45;
  SIDEBAR_WIDTH = 70;
  TASK_SIDEBAR_WIDTH = 70;
}

// Total Width Caluclations
// Total width including both sidebars & the grid columns
const COMPONENT_WIDTH = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH + ENTRIES * TASK_WIDTH;

// Pixel Map
// Pixel map must start AFTER both sidebars
const GRID_OFFSET = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH;

// pixelMap
const pixelMap = Array.from({ length: ENTRIES }, (_, idx) => {
  const index = idx + 1;

  const beginn = GRID_OFFSET + (index - 1) * TASK_WIDTH;
  const end = GRID_OFFSET + index * TASK_WIDTH;

  return [index, { beginn, end }];
}).reduce((obj, [key, value]) => {
  obj[key] = value;
  return obj;
}, {});

// ________________________NODE DEFINITIONS________________________

// TaskHeaderNode
function TaskHeaderNode() {
  return (
    <div
      style={{
        width: COMPONENT_WIDTH,
        height: TASK_HEIGHT,
      }}
      className="flex items-center rounded-t-lg border border-slate-300 border-b-slate-300 bg-slate-50 text-slate-700"
    >
      {/* Team sidebar */}
      <div
        style={{ width: SIDEBAR_WIDTH }}
        className="flex items-center justify-center border-r border-slate-300 text-xs font-medium"
      >
        Team
      </div>

      {/* Task sidebar */}
      <div
        style={{ width: TASK_SIDEBAR_WIDTH }}
        className="flex items-center justify-center border-r border-slate-300 text-xs font-medium"
      >
        Task
      </div>

      {/* Grid columns */}
      <div className="flex h-full flex-1">
        {Array.from({ length: ENTRIES }).map((_, idx) => (
          <div
            key={idx}
            style={{ width: TASK_WIDTH }}
            className="flex items-center justify-center border-l border-slate-200 text-[11px]"
          >
            <span className="px-2 py-1 text-lg font-bold text-slate-700">{idx + 1}</span>
          </div>
        ))}
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
      style={{ width: COMPONENT_WIDTH, height: height }}
      className="relative flex h-full overflow-hidden rounded-lg border border-slate-300"
    >
      {/* top color strip */}
      <div
        style={{
          backgroundColor: data.color,
          height: '3px',
          width: '100%',
        }}
        className="absolute top-0 left-0"
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

      {/* Right area – attempts live visually here, but as separate nodes */}
      <div className="relative flex-1 p-2" />
    </div>
  );
}

// TaskNode
function TaskNode({ data }) {
  return (
    <div
      style={{ width: COMPONENT_WIDTH - SIDEBAR_WIDTH, height: TASK_HEIGHT }}
      className="flex h-full w-full border-b border-black/20"
    >
      {/* Left: task label bar */}
      <div
        style={{ width: TASK_SIDEBAR_WIDTH }}
        className="flex h-full items-center justify-center border-r bg-white/20 text-xs tracking-wide text-black"
      >
        {data.label}
      </div>

      {/* Right: pixel slots */}
      <div className="flex h-full flex-1" style={{ pointerEvents: 'none' }}>
        {Object.entries(pixelMap).map(([index, range]) => (
          <div
            key={index}
            style={{
              width: range.end - range.beginn,
              height: '100%',
            }}
            className="border border-black/10"
          />
        ))}
      </div>
    </div>
  );
}

// AttemptNode
function AttemptNode({ data, selected }) {
  return (
    <div
      className={`m-2 flex items-center justify-center rounded-md border bg-gray-100 text-xs !text-[15px] font-bold text-black shadow-sm shadow-xl shadow-black/2 transition-all duration-150 hover:bg-gray-700 hover:text-white ${selected ? 'scale-105 border-sky-500 shadow-md shadow-black/30' : 'border-slate-300'} `}
      style={{
        width: TASK_WIDTH - 15,
        height: TASK_HEIGHT - 15,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {data.number}

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

// headerNode
const headerNode = {
  id: 'task-header',
  type: 'taskHeaderNode',
  position: { x: 0, y: 0 },
  draggable: false,
  selectable: false,
};

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

  const REACTFLOW_HEIGHT = 700;

  const [dep_setting_selected, setDep_setting_selected] = useState(true);

  // ************** -> ADDED NOW : collapsedByTeamId ***************** :
  const [collapsedByTeamId, setCollapsedByTeamId] = useState({});

  // ************** -> ADDED NOW 4: teamOrder useState ***************** :
  const [teamOrder, setTeamOrder] = useState([]);

  // ************** -> ADDED NOW: toggleTeamCollapse ***************** :
  const toggleTeamCollapse = useCallback((teamNodeId) => {
    console.log('[toggleTeamCollapse] called for:', teamNodeId);

    setCollapsedByTeamId((prev) => {
      const next = {
        ...prev,
        [teamNodeId]: !prev[teamNodeId],
      };

      console.log('[toggleTeamCollapse] prev:', prev);
      console.log('[toggleTeamCollapse] next:', next);

      return next;
    });
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
  useEffect(() => {
    if (!groupNodes.length) return;

    console.log('==========[HIDE PASS] START==========');
    console.log('[HIDE PASS] collapsedByTeamId:', collapsedByTeamId);

    const collapsedTeamIds = Object.keys(collapsedByTeamId).filter((k) => collapsedByTeamId[k]);
    console.log('[HIDE PASS] collapsedTeamIds:', collapsedTeamIds);

    // ✅ compute collapsed task ids from current taskNodes state (closure)
    const collapsedTaskIds = new Set(
      taskNodes.filter((t) => collapsedTeamIds.includes(t.parentNode)).map((t) => t.id),
    );

    console.log('[HIDE PASS] collapsedTaskIds:', Array.from(collapsedTaskIds));

    // 1) tasks: hide if parent team collapsed
    setTaskNodes((prevTasks) =>
      prevTasks.map((t) => ({
        ...t,
        hidden: collapsedTeamIds.includes(t.parentNode),
      })),
    );

    // 2) attempts: hide if parent task is in collapsedTaskIds
    setAttemptNodes((prevAttempts) =>
      prevAttempts.map((a) => ({
        ...a,
        hidden: collapsedTaskIds.has(a.parentNode),
      })),
    );

    console.log('==========[HIDE PASS] END==========');
  }, [collapsedByTeamId, groupNodes.length]);

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
  }, [collapsedByTeamId, teamOrder, groupNodes.length]);

  useEffect(() => {
    console.log('Dep settings selected is now: ', dep_setting_selected);
    setGroupNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        selectable: !dep_setting_selected,
        draggable: !dep_setting_selected,
      })),
    );
    console.log('Dep settings selected is now: ', dep_setting_selected);
  }, [dep_setting_selected]);

  // __________LOAD DATA
  useEffect(() => {
    async function loadData() {
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
              let team_display_height = team.tasks.length * TASK_HEIGHT;
              // if (team_display_height < 100) {
              //   team_display_height = 100;
              // }
              if (!team.tasks) return null;

              const node = {
                id: `team-${team.id}`,
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
                  isCollapsed: !!collapsedByTeamId[`team-${team.id}`],
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

            return tasks_of_this_team.map((task, taskIndex) => ({
              id: `task-${task.id}`, // globally unique ID
              type: 'taskNode', // must exist in nodeTypes
              parentNode: `team-${team.id}`, // 👈 put it inside the TeamNode
              extent: 'parent',
              position: {
                x: SIDEBAR_WIDTH, // left inside content area
                y: taskIndex * TASK_HEIGHT, // vertical stacking
              },
              data: {
                label: task.name,
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

          return {
            id: `attempt-${attempt.id}`,
            parentNode: `task-${attempt.task.id}`,
            extent: 'parent',
            type: 'attemptNode',
            position: { x, y: index * 0 }, // y stays as before
            data: {
              label: attempt.name,
              number: attempt.number,
            },
          };
        });

        setAttemptNodes(updated_attempt_nodes);
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

    // ************** -> ADDED NOW: collapsedByTeamId added ***************** :
    // ************** -> ADDED NOW 2: collapsedByTeamId removed again ***************** :
  }, [projectId, navigate, logout]);

  // Merge Nodes
  useEffect(() => {
    setMergedNodes([
      headerNode,
      ...groupNodes,
      ...taskNodes,
      ...attempt_nodes, // attempts
    ]);
  }, [groupNodes, taskNodes, attempt_nodes, dep_setting_selected]);

  // onNodesChange
  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // onNodeDragStop
  const onNodeDragStop = useCallback(
    (event, node) => {
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
      const snappedX = getXFromSlotIndex(slotIndex);

      setAttemptNodes((prev) =>
        prev.map((n) =>
          n.id === node.id ? { ...n, position: { ...n.position, x: snappedX } } : n,
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
    [teamOrder, groupNodes, collapsedByTeamId],
  );

  // onEdgesChange
  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // onConnect
  const onConnect = useCallback(
    (connection) => {
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
    [setEdges],
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
          style={{ width: COMPONENT_WIDTH, height: y_reactflow_size + SETTINGS_HEIGHT }}
          className="mx-5 mt-30 mb-5 rounded-xl bg-gray-200 shadow-xl shadow-black/30 sm:mx-10"
        >
          <div style={{ height: SETTINGS_HEIGHT }} className="relative flex w-full flex-col gap-2">
            <div className="flex h-[40px] gap-2">
              <Button
                className={` ${dep_setting_selected ? '!bg-gray-300' : '!bg-gray-500'} h-full w-full`}
                onClick={() => setDep_setting_selected(false)}
                variant="contained"
              >
                Change Group Display
              </Button>

              <Button
                className={` ${dep_setting_selected ? '!bg-gray-500' : '!bg-gray-300'} h-full w-full`}
                onClick={() => setDep_setting_selected(true)}
                variant="contained"
              >
                Delete Dependencies
              </Button>

              {/* <Button className="w-full h-full !bg-blue-300" variant="contained">Change Dependencies</Button> */}
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
                [COMPONENT_WIDTH, y_reactflow_size],
              ]}
            ></ReactFlow>
          </div>
        </div>
      </div>
    </>
  );
}
