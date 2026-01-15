import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
} from 'reactflow';
import { EdgeLabelRenderer, getBezierPath } from 'reactflow';
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

// _________________________GLOBALS____________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________

// Main Variables
const isMobile = window.innerWidth <= 768;
let TASK_HEIGHT = 60;
let TASK_WIDTH = 60;
let SETTINGS_HEIGHT = 200;
const DEFAULT_ENTRIES = 25; // fallback if no dates

let SIDEBAR_WIDTH = 80;
let TASK_SIDEBAR_WIDTH = 100;

const TEAM_GAP_PADDING_Y = 10;
const TASK_GAP_PADDING_X = 0;
const HEADER_BODY_GAP = 10;

//  -> ADDED NOW 2: const TEAM_COLLAPSED_HEIGHT  :
const TASK_COLLAPSED_HEIGHT = 14;
const TEAM_COLLAPSED_HEIGHT = TASK_COLLAPSED_HEIGHT + 15; // slightly larger to fit header/arrow
const ATTEMPT_COLLAPSED_HEIGHT = Math.max(6, TASK_COLLAPSED_HEIGHT - 4);
const COLLAPSED_DAY_WIDTH = 12;

// _________________________HELPERS____________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________

// ________________________SOUND
// ____________________________________________

// playSnapSound
const snapAudio = new Audio(snapSoundFile);
snapAudio.volume = 0.2; // super subtle
function playSnapSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    snapAudio.currentTime = 0;
    snapAudio.play();
  } catch (e) {
    // console.log('Couldnt play snap sound');
  }
}

// playWhipSound
const whipAudio = new Audio(whipSoundFile);
whipAudio.volume = 0.3; // super subtle
function playWhipSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    whipAudio.currentTime = 0;
    whipAudio.play();
  } catch (e) {
    // console.log('Couldnt play whip sound');
  }
}

// playClackSound
const clickAudio = new Audio(clackSoundFile);
clickAudio.volume = 0.4; // super subtle
function playClackSound() {
  // try/catch so it doesn’t explode if browser blocks it
  try {
    clickAudio.currentTime = 0;
    clickAudio.play();
  } catch (e) {
    // console.log('Couldnt play whip sound');
  }
}

// ________________________Extract Ids
// ____________________________________________

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

// Helper extractTeamId  :
function extractTeamId(teamNodeId) {
  if (!teamNodeId?.startsWith('team-')) return null;
  const num = parseInt(teamNodeId.replace('team-', ''), 10);
  return Number.isNaN(num) ? null : num;
}

// ________________________Layout
// ____________________________________________

// get_overall_gap
function get_overall_gap(num_tasks, gap, header_gap) {
  return num_tasks * gap + header_gap - 10;
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

// Mobile Task Adjustment (OUT)
// if (isMobile) {
//   TASK_HEIGHT = 45;
//   TASK_WIDTH = 45;
//   SIDEBAR_WIDTH = 70;
//   TASK_SIDEBAR_WIDTH = 70;
// }

// _________________________NODES & EDGES____________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________

// ________________________Nodes
// ____________________________________________

// TeamNode
function TeamNode({ id, data }) {
  //  -> ADDED NOW: DEBUG [TeamNode render]  :
  // console.log('[TeamNode render]', id, 'data.isCollapsed =', data.isCollapsed);

  const [collapsed, setCollapsed] = useState(false);

  //  -> ADDED NOW 2: height calculation inside teamnode  :
  // const [height, setHeight] = useState(data.height);
  const collapsedHeight = data.collapsedHeight ?? TEAM_COLLAPSED_HEIGHT;
  const height = data.isCollapsed ? collapsedHeight : data.height;

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
            //  -> ADDED NOW: toggleTeamCollapse call while onclick  :
            // e.stopPropagation();
            // handleCollapse();
            // playClackSound()
            e.stopPropagation();
            // console.log('[TeamNode] click collapse:', id, 'isCollapsed(data):', data.isCollapsed);
            data.toggleTeamCollapse(id);
          }}
        >
          <ChevronsDownUp size={14} color="white" />
        </div>
      </div>

      {/* Right area – allow clicking edges through; keep left bar interactive */}
      <div className="relative flex-1 p-2" />
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
        <div className="relative flex w-full items-center justify-between px-2">
          {!isTeamCollapsed && !isTaskCollapsed && <span>{data.label}</span>}
          {!isTeamCollapsed && isTaskCollapsed && (
            <span className="flex-1 truncate pr-1 pl-4 text-[7px] text-gray-600">{data.label}</span>
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
      <div className="flex h-full flex-1">
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
      onClick={(e) => {
        console.log('[DEBUG AttemptNode CLICK]', data.number, 'target:', e.target);
      }}
      className={`${collapsedMargin} flex items-center justify-center rounded-md border bg-gray-100 text-xs !text-[15px] font-bold text-black shadow-sm shadow-xl shadow-black/2 transition-all duration-150 hover:bg-gray-700 hover:text-white ${selected ? 'scale-105 border-sky-500 shadow-md shadow-black/30' : 'border-slate-300'} ${data.shake ? 'animate-pulse' : ''}`}
      style={{
        width: attemptWidth,
        height: attemptHeight,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {!isCollapsed && (typeof data.number === 'number' ? data.number : 'X')}
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

// ________________________Edges
// ____________________________________________

// DependencyEdge
// Custom dependency edge with generous invisible hit-path for reliable clicks
function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  data,
}) {
  const isDependencyMode = !!(data && data.isDependencyMode);
  const [isHover, setIsHover] = useState(false);
  const sx = sourceX ?? 0;
  const sy = sourceY ?? 0;
  const tx = targetX ?? 0;
  const ty = targetY ?? 0;
  const dx = Math.max(40, Math.abs(tx - sx) / 2);
  const c1x = sx + dx;
  const c1y = sy;
  const c2x = tx - dx;
  const c2y = ty;
  const path = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;

  const stroke = (style && style.stroke) || '#222';
  const baseStrokeWidth = (style && style.strokeWidth) || 2;
  const isSelected = !!(data && data.isSelected);
  const strokeWidth = isSelected
    ? Math.max(baseStrokeWidth + 3, 5)
    : isDependencyMode && isHover
      ? Math.min(baseStrokeWidth + 2, 6)
      : baseStrokeWidth;
  const strokeColor = isSelected ? '#0ea5e9' : stroke;

  // Compute a good label position along the curve
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
  });

  return (
    <g className="react-flow__edge">
      <path
        className="react-flow__edge-path"
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={{ pointerEvents: 'stroke', ...(style || {}) }}
        onMouseEnter={isDependencyMode ? () => setIsHover(true) : undefined}
        onMouseLeave={isDependencyMode ? () => setIsHover(false) : undefined}
      />
      {isDependencyMode && (
        <>
          {/* Invisible, thick interaction path to capture clicks */}
          <path
            className="react-flow__edge-path edge-hit"
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(60, strokeWidth * 12)}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation?.();
              if (data && typeof data.onSelect === 'function') {
                data.onSelect(id);
              }
            }}
            onPointerDown={(e) => e.stopPropagation?.()}
            onMouseEnter={(e) => {
              // ensure cursor feedback when hovering anywhere on path
              const el = e.currentTarget;
              if (el) el.style.cursor = 'pointer';
              setIsHover(true);
            }}
            onMouseLeave={() => setIsHover(false)}
          />
          {/* Small clickable label anchored to the edge */}
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
                zIndex: 1000,
              }}
              className="edge-label"
              onClick={(e) => {
                e.stopPropagation?.();
                if (data && typeof data.onSelect === 'function') {
                  data.onSelect(id);
                }
              }}
            >
              <div
                title="Select dependency"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 8,
                  background: isSelected ? '#ef4444' : '#64748b',
                  border: isSelected ? '2px solid #fbbf24' : '1px solid #fff',
                  boxShadow: isSelected
                    ? '0 0 12px rgba(239, 68, 68, 0.8)'
                    : '0 0 4px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            </div>
          </EdgeLabelRenderer>
        </>
      )}
    </g>
  );
}

// nodeTypes
const nodeTypes = {
  teamNode: TeamNode,
  taskNode: TaskNode,
  attemptNode: AttemptNode,
  taskHeaderNode: TaskHeaderNode,
};

// edgeTypes
const edgeTypes = {
  dependencyEdge: DependencyEdge,
};

// _________________________COMPONENT____________________________
// _________________________COMPONENT____________________________
// _________________________COMPONENT____________________________
// _________________________COMPONENT____________________________
// _________________________COMPONENT____________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// _______________________________________________________________________________________________
// headerNode template removed; we’ll build it inside the component with data

// ________________________COMPONENT________________________
export default function OrgAttempts() {
  const REACTFLOW_HEIGHT = 700;
  // _________________________STATES____________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________

  // _____ROUTER & AUTH
  // ____________________________________________
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // _____Main Data
  // ____________________________________________
  const [all_teams, setAll_Teams] = useState([]);
  const [all_tasks, setAll_Tasks] = useState([]);
  const [all_attempts, setAll_Attempts] = useState([]);

  // _____Nodes
  // ____________________________________________
  const [attempt_nodes, setAttemptNodes] = useState([]);
  const [groupNodes, setGroupNodes] = useState([]);
  const [taskNodes, setTaskNodes] = useState([]);
  const [mergedNodes, setMergedNodes] = useState([]);

  // _____Edges
  // ____________________________________________
  const [edges, setEdges] = useState([]);

  // _____Layout
  // ____________________________________________
  const [y_reactflow_size, setY_reactflow_size] = useState(1000);
  const [overallgap, setOverAllGap] = useState(0);

  // _____Selected
  // ____________________________________________
  const [selectedDepId, setSelectedDepId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [inspectSelectedNodeId, setInspectSelectedNodeId] = useState(null);

  // _____Mode
  // ____________________________________________
  const [dep_setting_selected, setDep_setting_selected] = useState(true);
  const [mode, setMode] = useState('dependency'); // 'order', 'dependency', 'inspect'

  // _____Options
  // ____________________________________________
  const [hideCollapsedNodes, setHideCollapsedNodes] = useState(false);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);

  // _____Errors
  // ____________________________________________
  const [errorMessage, setErrorMessage] = useState(null);
  const edgeHighlightTimeout = useRef(null);
  const edgeRestoreRef = useRef(null);

  // _____Mystery
  // ____________________________________________
  const [layoutVersion, setLayoutVersion] = useState(0);

  // _____Geometry
  // ____________________________________________
  // Collapsed days map: key = day index (1-based), value = true/false
  const [collapsedDays, setCollapsedDays] = useState({});
  const [collapsedByTeamId, setCollapsedByTeamId] = useState({});
  const [collapsedTasks, setCollapsedTasks] = useState({});
  const [teamOrder, setTeamOrder] = useState([]);

  // _____Timeline
  // ____________________________________________
  // Timeline derived from project dates
  const [timelineDays, setTimelineDays] = useState([]);
  const [entryCount, setEntryCount] = useState(DEFAULT_ENTRIES);

  // _________________________HOOKS____________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________
  // _______________________________________________________________________________________________

  // handleEdgeSelect
  // Ensure dependency edges set selection when clicked from custom edge component
  /**
   * Handles edge selection events from dependency edges in the ReactFlow graph.
   * Parses the edge ID to extract the dependency ID, validates the format, and updates both selected dependency and edge state for UI highlighting and delete operations.
   *
   * @param {string} edgeId - The edge ID to process for selection state update
   * @param {Function} setSelectedDepId - Update selected dependency ID when valid edge clicked
   * @param {Function} setSelectedEdgeId - Update selected edge ID for visual highlighting
   */
  const handleEdgeSelect = useCallback(
    (edgeId) => {
      if (!edgeId) return;
      if (edgeId.startsWith('attemptdep-')) {
        const depId = parseInt(edgeId.replace('attemptdep-', ''), 10);
        if (!Number.isNaN(depId)) {
          setSelectedDepId(depId);
          setSelectedEdgeId(edgeId);
        }
      }
    },
    [setSelectedDepId, setSelectedEdgeId],
  );

  // daysWithAttempts
  // Compute which days have attempts scheduled
  /**
   * Builds a Set of timeline day indices that have attempts scheduled.
   * Iterates through all attempts and collects their slot index values to enable efficient empty day detection and filtering.
   *
   * @param {Array} all_attempts - Recompute set when attempt data or slot assignments change
   */
  const daysWithAttempts = useMemo(() => {
    const days = new Set();
    all_attempts.forEach((attempt) => {
      if (attempt.slot_index) {
        days.add(attempt.slot_index);
      }
    });
    return days;
  }, [all_attempts]);

  // componentWidth
  /**
   * Calculates the total width of the component by summing sidebar widths and entry widths.
   * Iterates through each timeline entry, applying collapsed width to collapsed days or full width to expanded days.
   *
   * @param {number} entryCount - Recalculate width when timeline entry count changes
   * @param {Object} collapsedDays - Recalculate width when any day's collapse state changes
   */
  const componentWidth = useMemo(() => {
    const base = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH;
    let totalWidth = 0;
    for (let i = 1; i <= entryCount; i++) {
      totalWidth += collapsedDays[i] ? COLLAPSED_DAY_WIDTH : TASK_WIDTH;
    }
    return base + totalWidth;
  }, [entryCount, collapsedDays]);

  // pixelMap
  /**
   * Maps timeline day indices to their pixel coordinate ranges on the grid.
   * Calculates cumulative X positions for each day based on collapsed width or full width, enabling pixel-to-slot conversions for node positioning.
   *
   * @param {number} entryCount - Recalculate map when timeline entry count changes
   * @param {Object} collapsedDays - Recalculate positions when any day's collapse state changes
   */
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

  // getSlotIndexFromX
  /**
   * Converts a pixel X position to the corresponding timeline slot index using midpoint matching.
   * Accumulates day widths and returns the slot where the position falls, defaulting to the last slot if out of range.
   *
   * @param {number} entryCount - Recalculate when timeline entry count changes
   * @param {Object} collapsedDays - Recalculate when any day's collapse state changes
   */
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

  // getXFromSlotIndex
  /**
   * Calculates the pixel X position for a given timeline slot index by summing prior day widths.
   * Accounts for collapsed width or full width of each preceding day to determine the starting X coordinate.
   *
   * @param {Object} collapsedDays - Recalculate position when any day's collapse state changes
   */
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

  // headerNode
  /**
   * Creates the timeline header node for ReactFlow containing layout configuration and day toggle handler.
   * Provides layout dimensions, timeline data, and collapse state to the header component; handles toggling
   * individual days while selectively updating attempt node positions for days after the toggled day.
   *
   * @param {number} componentWidth - Recalculate when total component width changes from day collapse/expansion
   * @param {Array} timelineDays - Recalculate when timeline dates change from project date updates
   * @param {number} entryCount - Recalculate when number of timeline entries changes
   * @param {Object} collapsedDays - Recalculate when any day's collapse state changes for header display
   * @param {Object} pixelMap - Recalculate when pixel coordinate mapping changes from collapse/expansion
   */
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

  // toggleTeamCollapse  :
  /**
   * Toggles a team's collapse state and automatically expands all child tasks when the team is expanded.
   * Tracks which tasks belong to the team and syncs their collapse states to prevent orphaned collapsed tasks inside an expanded team.
   *
   * @param {Array} taskNodes - Find tasks belonging to team and determine which need expansion when team expands
   */
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

  // toggleTaskCollapse
  /**
   * Toggles a task's collapse state in the hierarchy and updates the collapsed tasks map.
   * Flips the boolean flag for the task ID, allowing UI components to conditionally hide task content and update layout.
   */
  const toggleTaskCollapse = useCallback((taskNodeId) => {
    // console.log('[toggleTaskCollapse] called for:', taskNodeId);
    setCollapsedTasks((prev) => ({
      ...prev,
      [taskNodeId]: !prev[taskNodeId],
    }));
  }, []);

  // ________________________Bulk controls
  // ____________________________________________
  // collapseAllTeams
  /**
   * Collapses all team nodes in the hierarchy at once.
   * Iterates through all group nodes and sets their collapse state to true, enabling bulk collapse operations from the UI button.
   *
   * @param {Array} groupNodes - Recalculate when team structure changes to collapse all current teams
   */
  const collapseAllTeams = useCallback(() => {
    setCollapsedByTeamId(() => {
      const next = {};
      groupNodes.forEach((team) => {
        next[team.id] = true;
      });
      return next;
    });
  }, [groupNodes]);

  // expandAllTeams
  /**
   * Expands all team nodes and their child tasks at once.
   * Sets all team and task collapse states to false, ensuring child tasks are expanded when parent teams are expanded for consistency.
   *
   * @param {Array} groupNodes - Recalculate when team structure changes to expand all current teams
   * @param {Array} taskNodes - Recalculate when task structure changes to expand all current tasks
   */
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

  // collapseAllTasks
  /**
   * Collapses all task nodes in the hierarchy at once.
   * Iterates through all task nodes and sets their collapse state to true, enabling bulk collapse operations from the UI button.
   *
   * @param {Array} taskNodes - Recalculate when task structure changes to collapse all current tasks
   */
  const collapseAllTasks = useCallback(() => {
    setCollapsedTasks(() => {
      const next = {};
      taskNodes.forEach((t) => {
        next[t.id] = true;
      });
      return next;
    });
  }, [taskNodes]);

  // expandAllTasks
  /**
   * Expands all task nodes in the hierarchy at once by clearing all collapse state.
   * Resets the collapsedTasks map to an empty object, enabling all tasks to display their full content immediately.
   */
  const expandAllTasks = useCallback(() => {
    setCollapsedTasks({});
  }, []);

  // collapseAllDays
  /**
   * Collapses all timeline days at once and triggers layout recalculation.
   * Iterates through all timeline entries and sets their collapse state to true, then increments layout version to force position updates.
   *
   * @param {number} entryCount - Recalculate when timeline entry count changes to collapse all current days
   */
  const collapseAllDays = useCallback(() => {
    setCollapsedDays(() => {
      const next = {};
      for (let i = 1; i <= entryCount; i++) {
        next[i] = true;
      }
      return next;
    });
    setLayoutVersion((v) => v + 1);
  }, [entryCount]);

  // expandAllDays
  /**
   * Expands all timeline days at once and triggers layout recalculation.
   * Resets the collapsedDays map to empty object, then increments layout version to force position updates for all day widths.
   */
  const expandAllDays = useCallback(() => {
    setCollapsedDays({});
    setLayoutVersion((v) => v + 1);
  }, []);

  // getTaskIdsForTeam
  /**
   * Returns array of task IDs that belong to a specific team.
   * Filters task nodes by parentNode match and extracts their ID values for bulk operations.
   *
   * @param {Array} taskNodes - Task node array to filter by team membership
   * @param {string|number} teamId - Team ID to match against task parentNode values
   */
  function getTaskIdsForTeam(taskNodes, teamId) {
    return taskNodes.filter((t) => t.parentNode === teamId).map((t) => t.id);
  }

  // updateTaskPositionsEffect
  // Recalculate and update task positions based on all collapse states
  /**
   * Recalculates and updates task node Y positions based on current collapse states.
   * Groups tasks by parent team, applies effective heights (collapsed or expanded) per collapse state, then repositions all tasks with updated Y coordinates and collapse flags.
   *
   * @param {Object} collapsedTasks - Recalculate positions when any task collapse state changes
   * @param {Object} collapsedByTeamId - Recalculate positions when any team collapse state changes to apply team-level height
   * @param {Object} collapsedDays - Trigger position sync when day collapse states change for consistency
   */
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

  // syncTaskPositionsEffect
  // When days are toggled, force a complete task position recalculation
  /**
   * Recalculates task node Y positions when timeline days are collapsed or expanded.
   * Groups tasks by parent team, computes effective heights per collapse state, and repositions tasks with Y updates only when positions change to minimize rerenders.
   *
   * @param {Object} collapsedDays - Trigger recalculation when any day collapse state changes to propagate position updates
   * @param {number} taskNodes.length - Re-run when task count changes to account for new or removed tasks
   */
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

  // updateNodeHierarchyStateEffect
  // Update attempt flags and team heights after task positions are recalculated
  /**
   * Propagates collapse state through the 3-level hierarchy and recalculates team heights based on task collapse states.
   * Updates attempt visibility flags based on parent task/team collapse state, computes per-team height tallies (expanded vs collapsed), then increments layout version to force position updates.
   *
   * @param {Array} taskNodes - Recalculate when task structure changes (additions/removals) to update team heights from task count
   * @param {Object} collapsedTasks - Recalculate when any task collapse state changes to update attempt visibility and team height totals
   * @param {Object} collapsedByTeamId - Recalculate when any team collapse state changes to update attempt visibility and effective team heights
   * @param {Object} collapsedDays - Included for consistency to ensure layout syncs with day collapse state changes
   */
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
          hidden: isTaskCollapsed || isTeamCollapsed,
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
      const teamId = t.parentNode;
      if (!heightsByTeam[teamId]) {
        heightsByTeam[teamId] = { expanded: 0, collapsed: 0 };
      }

      heightsByTeam[teamId].collapsed += TASK_COLLAPSED_HEIGHT;
      heightsByTeam[teamId].expanded += collapsedTaskIds.has(t.id)
        ? TASK_COLLAPSED_HEIGHT
        : TASK_HEIGHT;
    });

    setGroupNodes((prevTeams) =>
      prevTeams.map((team) => {
        const isCollapsed = teamCollapsedSet.has(team.id);
        const expandedHeight = heightsByTeam[team.id]?.expanded ?? team.data?.height ?? 0;
        const collapsedHeight = heightsByTeam[team.id]?.collapsed ?? TEAM_COLLAPSED_HEIGHT;
        const height = isCollapsed ? collapsedHeight : expandedHeight;
        return {
          ...team,
          data: {
            ...team.data,
            height,
            collapsedHeight,
            isCollapsed,
          },
        };
      }),
    );

    setLayoutVersion((v) => v + 1);
  }, [taskNodes, collapsedTasks, collapsedByTeamId, collapsedDays]);

  //  Helper: getTeamInsertIndexFromY
  /**
   * Determines the insertion index for a team being dropped based on Y coordinate.
   * Iterates through ordered teams accumulating their effective heights (collapsed or expanded), then returns the index where dropY position falls before a team's midpoint.
   *
   * @param {number} dropY - Drop position Y coordinate to evaluate against team midpoints
   * @param {Array} orderedTeamIds - Ordered team IDs to check against in sequence
   * @param {Array} groupNodes - Team nodes array containing height and collapse data
   * @param {Object} collapsedByTeamId - Map of team collapse states to determine effective heights
   */
  function getTeamInsertIndexFromY(dropY, orderedTeamIds, groupNodes, collapsedByTeamId) {
    let currentY = TASK_HEIGHT + HEADER_BODY_GAP;

    for (let i = 0; i < orderedTeamIds.length; i++) {
      const id = orderedTeamIds[i];
      const node = groupNodes.find((n) => n.id === id);
      if (!node) continue;

      const expandedHeight = node.data?.height ?? 0;
      const collapsedHeight = node.data?.collapsedHeight ?? TEAM_COLLAPSED_HEIGHT;
      const effectiveHeight = collapsedByTeamId[id] ? collapsedHeight : expandedHeight;

      const midY = currentY + effectiveHeight / 2;

      if (dropY < midY) {
        return i;
      }

      currentY += effectiveHeight + TEAM_GAP_PADDING_Y;
    }

    return orderedTeamIds.length;
  }

  // layoutTeamNodesEffect
  /**
   * Positions team nodes vertically based on team order and collapse states.
   * Applies cumulative Y positioning with effective heights and updates node data.
   *
   * @param {Object} collapsedByTeamId - Hide/show attempts and update team dimensions
   * @param {Array} teamOrder - Team ordering sequence
   * @param {number} layoutVersion - Layout recalculation trigger
   * @param {number} groupNodes.length - Team count for recalculation
   */
  useEffect(() => {
    if (!groupNodes.length) return;
    if (!teamOrder.length) return;

    // console.log('==========[LAYOUT PASS] START==========');
    // console.log('[LAYOUT PASS] teamOrder:', teamOrder);
    // console.log('[LAYOUT PASS] collapsedByTeamId:', collapsedByTeamId);

    setGroupNodes((prev) => {
      // map nodes by id for fast lookup
      const byId = new Map(prev.map((n) => [n.id, n]));

      // build ordered list (ignore ids that no longer exist)
      const ordered = teamOrder.map((id) => byId.get(id)).filter(Boolean);

      // append any “new/untracked” teams that aren’t in teamOrder yet (safety)
      const extras = prev.filter((n) => !teamOrder.includes(n.id));
      if (extras.length) {
        // console.log(
        //   '[LAYOUT PASS] extras not in teamOrder:',
        //   extras.map((e) => e.id),
        // );
      }

      let currentY = TASK_HEIGHT + HEADER_BODY_GAP;

      const next = [...ordered, ...extras].map((node) => {
        const isCollapsed = !!collapsedByTeamId[node.id];

        const expandedHeight = node.data?.height ?? 0;
        const collapsedHeight = node.data?.collapsedHeight ?? TEAM_COLLAPSED_HEIGHT;
        const effectiveHeight = isCollapsed ? collapsedHeight : expandedHeight;

        // console.log(
        //   '[LAYOUT PASS] team:',
        //   node.id,
        //   'collapsed:',
        //   isCollapsed,
        //   'expandedHeight:',
        //   expandedHeight,
        //   'effectiveHeight:',
        //   effectiveHeight,
        //   'newY:',
        //   currentY,
        // );

        const updated = {
          ...node,
          position: { ...node.position, y: currentY },
          data: { ...node.data, isCollapsed },
        };

        currentY += effectiveHeight + TEAM_GAP_PADDING_Y;
        return updated;
      });

      // console.log('==========[LAYOUT PASS] END==========');
      return next;
    });
  }, [collapsedByTeamId, teamOrder, layoutVersion, groupNodes.length]);

  // applyTeamInteractivity
  /**
   * Updates all team nodes' draggability and selectability based on current mode.
   * Sets both properties to true only when currentMode is 'order',
   * enabling drag-and-drop reordering, otherwise disables both for other modes.
   *
   * @param {string} currentMode - Current operation mode ('order', 'dependency', 'inspect') to determine interactivity state
   */
  const applyTeamInteractivity = useCallback(
    (currentMode) => {
      const draggingEnabled = currentMode === 'order';
      const selectableEnabled = currentMode === 'order';
      console.log(
        '[TEAM INTERACTIVITY] mode:',
        currentMode,
        'draggable:',
        draggingEnabled,
        'selectable:',
        selectableEnabled,
      );
      setGroupNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selectable: selectableEnabled,
          draggable: draggingEnabled,
        })),
      );
    },
    [setGroupNodes],
  );

  // updateTeamDraggableStateEffect
  /**
   * Updates team node draggability and selectability based on current mode.
   * Enables dragging and selection only in order mode.
   *
   * @param {string} mode - Enable/disable dragging and selection based on mode
   * @param {Function} applyTeamInteractivity - Interactivity application function
   */
  useEffect(() => {
    applyTeamInteractivity(mode);
  }, [mode, applyTeamInteractivity]);

  // Apply task interactivity based on mode
  const applyTaskInteractivity = useCallback(
    (currentMode) => {
      const draggingEnabled = currentMode === 'order';
      const selectableEnabled = currentMode === 'order';
      console.log(
        '[TASK INTERACTIVITY] mode:',
        currentMode,
        'draggable:',
        draggingEnabled,
        'selectable:',
        selectableEnabled,
      );
      setTaskNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selectable: selectableEnabled,
          draggable: draggingEnabled,
        })),
      );
    },
    [setTaskNodes],
  );

  // updateTaskDraggableStateEffect
  /**
   * Updates task node draggability and selectability based on current mode.
   * Enables dragging and selection only in order mode.
   *
   * @param {string} mode - Enable/disable dragging and selection based on mode
   * @param {Function} applyTaskInteractivity - Interactivity application function
   */
  useEffect(() => {
    applyTaskInteractivity(mode);
  }, [mode, applyTaskInteractivity]);

  // updateAttemptDraggableStateEffect
  /**
   * Updates attempt node draggability based on current mode.
   * Disables dragging in inspect mode while maintaining selection for edge highlighting.
   *
   * @param {string} mode - Enable/disable dragging based on mode (disable in inspect mode)
   * @param {number} attempt_nodes.length - Reapply interactivity when attempt count changes
   */
  // Update attempt nodes draggable state based on mode
  useEffect(() => {
    // Only disable dragging in inspect mode
    const attemptDraggingEnabled = mode !== 'inspect';
    setAttemptNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        draggable: attemptDraggingEnabled,
        selectable: true, // Always allow selection for edge highlighting
      })),
    );
  }, [mode, attempt_nodes.length]);

  // highlightInspectEdgesEffect
  // Highlight incoming/outgoing edges when a node is selected in inspect mode
  /**
   * Highlights incoming and outgoing edges when a node is selected in inspect mode.
   * Colors incoming edges red and outgoing edges green for visual dependency tracking.
   *
   * @param {string} mode - Activate/deactivate highlighting based on inspect mode
   * @param {string|null} inspectSelectedNodeId - Update edge colors when selected node changes
   */
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

  // applyEdgeModePropertiesEffect
  // Keep edges in sync with mode for interactivity/label rendering and selection state
  /**
   * Updates edge properties based on current mode and selection state.
   * Configures dependency mode interactivity and tracks selected edges.
   *
   * @param {string} mode - Update edge properties when mode changes
   * @param {Function} handleEdgeSelect - Attach edge selection handler when callback changes
   * @param {string|null} selectedEdgeId - Update selection state when selected edge changes
   */
  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        data: {
          ...(e.data || {}),
          isDependencyMode: mode === 'dependency',
          onSelect: handleEdgeSelect,
          isSelected: e.id === selectedEdgeId,
        },
        animated: true,
        selectable: true,
        interactionWidth: mode === 'dependency' ? (e.interactionWidth ?? 40) : e.interactionWidth,
        style:
          mode === 'dependency'
            ? { ...(e.style || {}), pointerEvents: 'all', strokeWidth: e.style?.strokeWidth ?? 2 }
            : { ...(e.style || {}) },
      })),
    );
  }, [mode, handleEdgeSelect, selectedEdgeId]);

  // Temporarily highlight edges (even if currently hidden) and restore their previous state after 1s
  const highlightEdges = useCallback(
    (edgeIds) => {
      if (!edgeIds?.length) return;

      if (edgeHighlightTimeout.current) {
        clearTimeout(edgeHighlightTimeout.current);
        edgeHighlightTimeout.current = null;
      }

      const snapshot = {};

      setEdges((prev) =>
        prev.map((edge) => {
          if (!edgeIds.includes(edge.id)) return edge;

          snapshot[edge.id] = { hidden: edge.hidden, style: edge.style };

          return {
            ...edge,
            hidden: false,
            style: {
              ...(edge.style || {}),
              stroke: '#f43f5e',
              strokeWidth: 3,
              opacity: 1,
            },
          };
        }),
      );

      edgeRestoreRef.current = snapshot;

      edgeHighlightTimeout.current = setTimeout(() => {
        setEdges((prev) =>
          prev.map((edge) => {
            const restore = edgeRestoreRef.current?.[edge.id];
            if (!restore) return edge;
            return { ...edge, hidden: restore.hidden, style: restore.style };
          }),
        );

        edgeRestoreRef.current = null;
        edgeHighlightTimeout.current = null;
      }, 3000);
    },
    [setEdges],
  );

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
        //  -> ADDED NOW: security log: [loadTeams]  :
        // console.log('[loadTeams] collapsedByTeamId:', collapsedByTeamId);

        try {
          //Fetch Teams
          const all_teams_raw = await project_teams_expanded(projectId);

          // console.log('[RAW teams keys example]', Object.keys(all_teams_raw?.[0] ?? {}));
          // console.log(
          //   '[RAW teams raw line_index]',
          //   all_teams_raw.map((t) => ({ id: t.id, li: t.line_index })),
          // );

          const all_teams = [...all_teams_raw].sort((a, b) => {
            const ai = a.line_index ?? 999999;
            const bi = b.line_index ?? 999999;
            if (ai !== bi) return ai - bi;
            return a.id - b.id; // stable fallback
          });

          // console.log(
          //   '[loadTeams] sortedTeams:',
          //   all_teams.map((t) => ({ id: t.id, li: t.line_index })),
          // );

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

                  //  -> ADDED NOW: toggleTeamCollapse & isCollapsed  :
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

          //  -> ADDED NOW 4: initialOrder  :
          const initialOrder = updated_group_nodes.map((n) => n.id);
          // console.log('[teamOrder:init]', initialOrder);
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
          type: 'dependencyEdge',
          animated: true,
          selectable: true,
          interactionWidth: 40,
          style: { strokeWidth: 2, pointerEvents: 'all' },
          data: { onSelect: handleEdgeSelect, isDependencyMode: mode === 'dependency' },
        }));

        setEdges(initialEdges);
      }

      await loadTeams();
      await loadAttempts();
      await loadAttemptDependencies();
    }
    loadData();
  }, [projectId, navigate, logout, getXFromSlotIndex]); // keep other deps as before

  // refreshTaskDataPropertiesEffect
  // Update task nodes when collapsedDays or pixelMap or mode changes
  /**
   * Synchronizes task node data properties with global layout state.
   * Updates each task's data object to reflect current collapse states, dimensions, and mode.
   *
   * @param {Object} collapsedDays - Update task data when day collapse state changes
   * @param {Object} pixelMap - Update task data when pixel mapping recalculates
   * @param {number} componentWidth - Update task data when component width changes
   * @param {string} mode - Update task data when mode changes
   */
  useEffect(() => {
    setTaskNodes((prevTasks) =>
      prevTasks.map((task) => ({
        ...task,
        data: {
          ...task.data,
          componentWidth,
          pixelMap,
          collapsedDays,
          mode,
        },
      })),
    );
  }, [collapsedDays, pixelMap, componentWidth, mode]);

  // refreshTeamModeDataEffect
  // Update team nodes when mode changes
  /**
   * Synchronizes team node mode property with global mode state.
   * Updates each team's data object to reflect the current mode for mode-specific rendering or behavior.
   *
   * @param {string} mode - Update team node mode property when mode changes
   */
  useEffect(() => {
    setGroupNodes((prevTeams) =>
      prevTeams.map((team) => ({
        ...team,
        data: {
          ...team.data,
          mode,
        },
      })),
    );
  }, [mode]);

  // Automatically collapse/expand empty days when hideEmptyDays button is toggled
  const prevHideEmptyDaysRef = useRef(hideEmptyDays);

  // toggleEmptyDaysOnButtonEffect
  /**
   * Automatically collapses or expands empty timeline days when hideEmptyDays option is toggled.
   * Uses ref tracking to detect button press changes and selectively modifies only empty days without affecting manually collapsed days.
   *
   * @param {boolean} hideEmptyDays - Trigger collapse/expand of empty days when option toggles
   * @param {number} entryCount - Recalculate when timeline length changes to include new days
   * @param {Set} daysWithAttempts - Determine which days are empty and eligible for auto-collapse
   */
  useEffect(() => {
    // Only run when hideEmptyDays actually changes (button press), not on mount or other deps
    if (prevHideEmptyDaysRef.current === hideEmptyDays) return;
    prevHideEmptyDaysRef.current = hideEmptyDays;

    // Evaluate which days are empty at the time of button press
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

  // refreshAttemptNodesVisibilityEffect
  // Re-filter attempt nodes when hideCollapsedNodes changes
  /**
   * Rebuilds and filters attempt nodes based on collapse state visibility option.
   * Reconstructs all attempt nodes from raw data with current positions and collapse flags, then conditionally filters out nodes under collapsed parents when hideCollapsedNodes is enabled.
   *
   * @param {boolean} hideCollapsedNodes - Toggle visibility filter on/off for collapsed parent nodes
   * @param {Array} all_attempts - Rebuild nodes when attempt data changes (additions/deletions/modifications)
   * @param {Array} taskNodes - Recalculate parent collapse states when task structure changes
   * @param {Object} collapsedTasks - Update collapse flags when individual task collapse state changes
   * @param {Object} collapsedDays - Recalculate X positions when day collapse affects width calculations
   * @param {Function} getXFromSlotIndex - Reposition nodes when position calculation logic changes
   */
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
  // combineAllNodesForRenderEffect
  /**
   * Combines all node types into a single array for ReactFlow rendering.
   * Merges header, team, task, and attempt nodes, with optional debug logging in dependency mode to verify interactivity states.
   *
   * @param {Object} headerNode - Include timeline header node in merged array
   * @param {Array} groupNodes - Include team nodes in merged array
   * @param {Array} taskNodes - Include task nodes in merged array
   * @param {Array} attempt_nodes - Include attempt nodes in merged array
   * @param {boolean} dep_setting_selected - Re-merge when dependency setting changes (legacy dependency)
   * @param {string} mode - Trigger debug logging when mode changes to verify node interactivity
   */
  useEffect(() => {
    const merged = [headerNode, ...groupNodes, ...taskNodes, ...attempt_nodes];

    // Debug: Check selectable state of team/task nodes in dependency mode
    if (mode === 'dependency') {
      const teamNodes = merged.filter((n) => n.type === 'teamNode');
      const taskNodes = merged.filter((n) => n.type === 'taskNode');
      if (teamNodes.length > 0 || taskNodes.length > 0) {
        console.log('[MERGE DEBUG - dependency mode]', {
          teamSelectable: teamNodes[0]?.selectable,
          taskSelectable: taskNodes[0]?.selectable,
          teamDraggable: teamNodes[0]?.draggable,
          taskDraggable: taskNodes[0]?.draggable,
        });
      }
    }

    setMergedNodes(merged);
  }, [headerNode, groupNodes, taskNodes, attempt_nodes, dep_setting_selected, mode]);

  // onNodesChange
  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // onNodeDragStart - block dragging entirely in inspect mode
  const onNodeDragStart = useCallback(
    (event, node) => {
      if (mode === 'inspect') {
        event.preventDefault();
      }
    },
    [mode],
  );

  // onNodeDragStop
  const onNodeDragStop = useCallback(
    (event, node) => {
      // In inspect mode, disable all drag actions
      if (mode === 'inspect') return;

      playSnapSound();
      //  -> ADDED NOW 4: onNodeDragStop for group nodes  :
      if (node.type === 'teamNode') {
        // console.log('==========[TEAM DROP]==========');
        // console.log('[TEAM DROP] node:', node.id);
        // console.log('[TEAM DROP] dropY:', node.position.y);
        // console.log('[TEAM DROP] current order:', teamOrder);

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

        // console.log('[TEAM DROP] insertIndex:', insertIndex);
        // console.log('[TEAM DROP] next order:', nextOrder);

        setTeamOrder(nextOrder);

        const orderIds = nextOrder.map(extractTeamId).filter((x) => x !== null);

        // console.log('[TEAM DROP] saving orderIds:', orderIds);

        (async () => {
          try {
            const res = await reorder_project_teams(projectId, orderIds);
            // console.log('[TEAM DROP] saved order:', res);
          } catch (err) {
            console.error('[TEAM DROP] failed to save order:', err);
          }
        })();

        return;
      }

      if (node.type !== 'attemptNode') return;

      const slotIndex = getSlotIndexFromX(node.position.x);
      const attemptId = extractAttemptId(node.id); // "attempt-19" -> 19
      if (!attemptId) return;

      // Check if moving to this slot would violate any dependencies
      // For each edge where this node is the target (has incoming dependency)
      const incomingEdges = edges.filter((e) => e.target === node.id);
      for (const edge of incomingEdges) {
        // Find the source attempt's slot
        const sourceAttemptId = extractAttemptId(edge.source);
        const sourceAttempt = all_attempts.find((a) => a.id === sourceAttemptId);
        if (sourceAttempt && sourceAttempt.slot_index >= slotIndex) {
          // Dependency violation: trying to move before or same day as predecessor
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

          setTimeout(() => {
            setAttemptNodes((prev) =>
              prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, shake: false } } : n)),
            );
          }, 250);

          // Highlight blocking edges temporarily (even if hidden)
          const blockingEdgeIds = incomingEdges
            .filter((e) => {
              const srcId = extractAttemptId(e.source);
              const srcAttempt = all_attempts.find((a) => a.id === srcId);
              return srcAttempt && srcAttempt.slot_index >= slotIndex;
            })
            .map((e) => e.id);
          highlightEdges(blockingEdgeIds);

          playClackSound();
          setErrorMessage('Cannot move: must be after all dependencies');
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }
      }

      // Check if moving to this slot would violate outgoing dependencies
      // For each edge where this node is the source (has outgoing dependency)
      const outgoingEdges = edges.filter((e) => e.source === node.id);
      for (const edge of outgoingEdges) {
        // Find the target attempt's slot
        const targetAttemptId = extractAttemptId(edge.target);
        const targetAttempt = all_attempts.find((a) => a.id === targetAttemptId);
        if (targetAttempt && targetAttempt.slot_index <= slotIndex) {
          // Dependency violation: trying to move after or same day as successor
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

          setTimeout(() => {
            setAttemptNodes((prev) =>
              prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, shake: false } } : n)),
            );
          }, 250);

          // Highlight blocking edges temporarily (even if hidden)
          const blockingEdgeIds = outgoingEdges
            .filter((e) => {
              const tgtId = extractAttemptId(e.target);
              const tgtAttempt = all_attempts.find((a) => a.id === tgtId);
              return tgtAttempt && tgtAttempt.slot_index <= slotIndex;
            })
            .map((e) => e.id);
          highlightEdges(blockingEdgeIds);

          playClackSound();
          setErrorMessage('Cannot move: all dependents must be after this');
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }
      }

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

      // attemptId already declared at the top, so we can use it directly
      (async () => {
        try {
          const res = await update_attempt_slot_index(attemptId, slotIndex);
          // console.log('Slot index saved:', res);
        } catch (err) {
          console.error('Failed to save slot index:', err);
        }
      })();

      //  -> ADDED NOW 4: dependency list update:   :
      // }, [setMergedNodes]);
    },
    [
      teamOrder,
      groupNodes,
      collapsedByTeamId,
      collapsedDays,
      getXFromSlotIndex,
      getSlotIndexFromX,
      edges,
      all_attempts,
    ],
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

      // console.log('onConnect fired:', connection);

      const vortaktId = extractAttemptId(connection.source);
      const nachtaktId = extractAttemptId(connection.target);

      if (!vortaktId || !nachtaktId) {
        console.error('Could not parse attempt IDs from nodes:', connection);
        return;
      }

      (async () => {
        try {
          const res = await add_attempt_dependency(vortaktId, nachtaktId);
          // console.log('Dependency created:', res);

          setEdges((eds) =>
            addEdge(
              {
                ...connection,
                id: `attemptdep-${res.id}`, // 👈 now we know which DB row this is
                type: 'dependencyEdge',
                animated: true,
                selectable: true,
                interactionWidth: 40,
                style: { strokeWidth: 2, pointerEvents: 'all' },
                data: { onSelect: handleEdgeSelect, isDependencyMode: true },
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
      // console.log('Dependency deleted:', res);

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
      {/* Mode-scoped CSS to allow edge clicks in dependency mode */}
      <style>
        {`
        /* In dependency mode, ignore pointer events on team/task nodes so edges are clickable */
        .rf-dependency .react-flow__node-teamNode,
        .rf-dependency .react-flow__node-taskNode {
          pointer-events: none;
        }
        /* Keep attempts interactive (for connecting via handles) */
        .rf-dependency .react-flow__node-attemptNode {
          pointer-events: auto;
        }
        /* Ensure edges can receive pointer events and clicks target the stroke */
        .rf-dependency .react-flow__edges {
          pointer-events: all;
        }
        .rf-dependency .react-flow__edge-path {
          pointer-events: stroke;
        }
        `}
      </style>
      {/* Error Message Overlay */}
      {errorMessage && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-pulse rounded-lg bg-red-500 px-8 py-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-lg font-semibold">{errorMessage}</span>
            </div>
          </div>
        </div>
      )}

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
          className={`mx-5 mt-30 mb-5 rounded-xl bg-gray-200 shadow-xl shadow-black/30 sm:mx-10 ${
            mode === 'dependency' ? 'rf-dependency' : ''
          }`}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
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
                onClick={collapseAllTasks}
              >
                Collapse All Tasks
              </Button>
              <Button
                className="!bg-slate-200 !text-black"
                variant="contained"
                onClick={expandAllTasks}
              >
                Expand All Tasks
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
              {/*
                TEMP: Hide Edges of Collapsed is disabled during investigation
                <Button
                  className={`!text-black ${hideEdgesOfCollapsed ? '!bg-blue-400' : '!bg-slate-200'}`}
                  variant="contained"
                  onClick={() => setHideEdgesOfCollapsed(!hideEdgesOfCollapsed)}
                >
                  {hideEdgesOfCollapsed ? '✓' : ''} Hide Edges of Collapsed
                </Button>
              */}
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
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={(_, node) => {
                // In dependency mode, ignore node clicks to allow edge selection
                if (mode === 'dependency') {
                  return;
                }

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
                // Prevent pane click from clearing selection after edge click
                try {
                  evt?.stopPropagation?.();
                } catch (_) {}
                console.log('EDGE CLICKED:', edge?.id, 'event:', evt);
                if (edge.id?.startsWith('attemptdep-')) {
                  const depId = parseInt(edge.id.replace('attemptdep-', ''), 10);
                  if (!Number.isNaN(depId)) {
                    console.log('[EDGE SELECT] Setting selectedDepId:', depId, 'edgeId:', edge.id);
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
              onSelectionChange={({ nodes, edges: selectedEdges }) => {
                const first = nodes && nodes.length ? nodes[0] : null;
                console.log('[onSelectionChange]', {
                  mode,
                  selectedNodeId: first?.id,
                  nodeCount: nodes?.length,
                  edgeCount: selectedEdges?.length,
                  isTeamNode: first?.type === 'teamNode',
                  isTaskNode: first?.type === 'taskNode',
                  nodeSelectableState: first?.selectable,
                });
                setSelectedNodeId(first ? first.id : null);

                if (selectedEdges && selectedEdges.length) {
                  const e = selectedEdges[0];
                  if (e?.id?.startsWith?.('attemptdep-')) {
                    const depId = parseInt(e.id.replace('attemptdep-', ''), 10);
                    if (!Number.isNaN(depId)) {
                      setSelectedDepId(depId);
                      setSelectedEdgeId(e.id);
                    }
                  }
                }
              }}
            ></ReactFlow>
          </div>
        </div>
      </div>
    </>
  );
}
