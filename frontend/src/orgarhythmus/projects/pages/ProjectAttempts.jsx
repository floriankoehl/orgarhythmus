import "reactflow/dist/style.css";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Handle,
    Position
} from "reactflow";
import {
    fetch_all_attempts,
    fetch_all_teams,
    add_attempt_dependency,
    fetch_all_attempt_dependencies,
    update_attempt_slot_index,
    delete_attempt_dependency
} from "../../api/org_API";
import snapSoundFile from "../../../assets/snap.mp3"
import { useParams } from "react-router-dom";





// ________________________GLOBALS AND HELPERS________________________

// extractAttemptId
function extractAttemptId(nodeId) {
    if (!nodeId) return null;

    // If it looks like "attempt-19"
    if (nodeId.startsWith("attempt-")) {
        const num = parseInt(nodeId.replace("attempt-", ""), 10);
        return Number.isNaN(num) ? null : num;
    }

    // Fallback: maybe it's already just "19"
    const num = parseInt(nodeId, 10);
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
        // ignore
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
const ENTRIES = 25

let SIDEBAR_WIDTH = 80;
let TASK_SIDEBAR_WIDTH = 100;

const TEAM_GAP_PADDING_Y = 5;
const TASK_GAP_PADDING_X = 0;
const HEADER_BODY_GAP = 10;


// Mobile Task Adjustment
if (isMobile) {
    TASK_HEIGHT = 45;
    TASK_WIDTH = 45;
    SIDEBAR_WIDTH = 70;
    TASK_SIDEBAR_WIDTH = 70;
}


// Total Width Caluclations
// Total width including both sidebars & the grid columns
const COMPONENT_WIDTH =
    SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH + (ENTRIES * TASK_WIDTH);


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
            className="
        flex items-center
        bg-slate-50
        border border-slate-300
        border-b-slate-300
        rounded-t-lg
        text-slate-700
      "
        >
            {/* Team sidebar */}
            <div
                style={{ width: SIDEBAR_WIDTH }}
                className="
          flex items-center justify-center
          font-medium text-xs
          border-r border-slate-300
        "
            >
                Team
            </div>

            {/* Task sidebar */}
            <div
                style={{ width: TASK_SIDEBAR_WIDTH }}
                className="
          flex items-center justify-center
          font-medium text-xs
          border-r border-slate-300
        "
            >
                Task
            </div>

            {/* Grid columns */}
            <div className="flex-1 flex h-full">
                {Array.from({ length: ENTRIES }).map((_, idx) => (
                    <div
                        key={idx}
                        style={{ width: TASK_WIDTH }}
                        className="
              flex items-center justify-center
              text-[11px]
              border-l border-slate-200
              
            "
                    >
                        <span className="px-2 py-1  font-bold text-lg   text-slate-700">
                            {idx + 1}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// TeamNode
function TeamNode({ data }) {
    return (
        <div
            style={{ width: COMPONENT_WIDTH, height: data.height }}
            className="relative h-full flex rounded-lg overflow-hidden border border-slate-300"
        >
            {/* top color strip */}
            <div
                style={{
                    backgroundColor: data.color,
                    height: "3px",
                    width: "100%",
                }}
                className="absolute top-0 left-0"
            />

            {/* Left vertical label */}
            <div
                style={{ width: SIDEBAR_WIDTH, backgroundColor: data.color }}
                className="text-white flex items-center justify-center"
            >
                <span
                    className="text-xs font-semibold tracking-wide text-black"
                    style={{ textOrientation: "mixed" }}
                >
                    {data.label}
                </span>
            </div>

            {/* Right area – attempts live visually here, but as separate nodes */}
            <div className="flex-1 relative p-2" />
        </div>
    );
}

// TaskNode
function TaskNode({ data }) {
    return (
        <div
            style={{ width: COMPONENT_WIDTH - SIDEBAR_WIDTH, height: TASK_HEIGHT }}
            className="w-full h-full border-b border-black/20 flex"
        >
            {/* Left: task label bar */}
            <div
                style={{ width: TASK_SIDEBAR_WIDTH }}
                className="h-full bg-white/20 border-r flex justify-center items-center text-xs tracking-wide text-black"
            >
                {data.label}
            </div>

            {/* Right: pixel slots */}
            <div className="flex-1 h-full flex" style={{ pointerEvents: "none" }}>
                {Object.entries(pixelMap).map(([index, range]) => (
                    <div
                        key={index}
                        style={{
                            width: range.end - range.beginn,
                            height: "100%",
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
            className={`
          bg-gray-100 hover:bg-gray-700 hover:text-white rounded-md border  
          shadow-sm flex justify-center items-center m-2 text-xs
          transition-all duration-150
          font-bold !text-[15px] text-black shadow-xl shadow-black/2
          ${selected ? "border-sky-500 shadow-md scale-105 shadow-black/30" : "border-slate-300"}
        `}
            style={{
                width: TASK_WIDTH - 15,
                height: TASK_HEIGHT - 15,
                position: "relative",
                zIndex: 10,
            }}
        >
            {data.number}

            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2"
                style={{
                    left: -2,
                    top: "50%",
                    transform: "translateY(-50%)",
                }}
            />

            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2"
                style={{
                    right: -2,
                    top: "50%",
                    transform: "translateY(-50%)",
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
    id: "task-header",
    type: "taskHeaderNode",
    position: { x: 0, y: 0 },
    draggable: false,
    selectable: false,
};



// ________________________COMPONENT________________________
export default function OrgAttempts() {
    // States & Variables
    const { projectId } = useParams();
    console.log("PROJECT ID FROM PARAMS: ", projectId);

    const [all_teams, setAll_Teams] = useState([]);
    const [all_tasks, setAll_Tasks] = useState([]);
    const [all_attempts, setAll_Attempts] = useState([])
    const [nodes, setNodes] = useState([])
    const [groupNodes, setGroupNodes] = useState([])
    const [taskNodes, setTaskNodes] = useState([])
    const [mergedNodes, setMergedNodes] = useState([])
    const [y_reactflow_size, setY_reactflow_size] = useState(1000)
    const [overallgap, setOverAllGap] = useState(0)

    const [edges, setEdges] = useState([]);
    const [selectedDepId, setSelectedDepId] = useState(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);

    const REACTFLOW_HEIGHT = 700;



    // __________LOAD DATA
    useEffect(() => {
        async function loadData() {
            //LOAD TEAMS (& Tasks through Teams)
            async function loadTeams() {

                //Fetch Teams
                const all_teams = await fetch_all_teams(projectId);
                setAll_Teams(all_teams)


                //VARIABLES
                const num_teams = all_teams.length
                let currentY = TASK_HEIGHT + HEADER_BODY_GAP; // start below header


                //RENDER TEAM NODES
                const updated_group_nodes = all_teams
                    .filter(team => team.tasks && team.tasks.length > 0)
                    .map((team) => {
                        let team_display_height = team.tasks.length * TASK_HEIGHT;
                        // if (team_display_height < 100) {
                        //   team_display_height = 100;
                        // }
                        if (!team.tasks) return null;

                        const node = {
                            id: `team-${team.id}`,
                            type: "teamNode",
                            position: { x: 0, y: currentY },   // 👈 use cumulative Y
                            data: { label: team.name, color: team.color, height: team_display_height },

                            draggable: false,
                            selectable: false,
                        };

                        currentY += team_display_height + TEAM_GAP_PADDING_Y;  // 👈 move down for next team


                        return node;
                    }).filter(Boolean);;

                setGroupNodes(updated_group_nodes);


                //RENDER TASK NODES
                const updated_task_nodes = all_teams.flatMap((team) => {
                    const tasks_of_this_team = team.tasks || [];

                    return tasks_of_this_team.map((task, taskIndex) => ({
                        id: `task-${task.id}`,          // globally unique ID
                        type: "taskNode",               // must exist in nodeTypes
                        parentNode: `team-${team.id}`,    // 👈 put it inside the TeamNode
                        extent: "parent",
                        position: {
                            x: SIDEBAR_WIDTH,                         // left inside content area
                            y: taskIndex * TASK_HEIGHT,            // vertical stacking
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

                setOverAllGap(get_overall_gap(num_teams, TEAM_GAP_PADDING_Y, HEADER_BODY_GAP))
                setY_reactflow_size(currentY + get_overall_gap(num_teams, TEAM_GAP_PADDING_Y, HEADER_BODY_GAP));
            }


            // loadAttempts
            async function loadAttempts() {
                const all_attempts = await fetch_all_attempts();
                setAll_Attempts(all_attempts);

                const updated_nodes = all_attempts.map((attempt, index) => {
                    const x = getXFromSlotIndex(attempt.slot_index);  // 👈 use DB value, default inside helper

                    return {
                        id: `attempt-${attempt.id}`,
                        parentNode: `task-${attempt.task.id}`,
                        extent: "parent",
                        type: "attemptNode",
                        position: { x, y: index * 0 },   // y stays as before
                        data: {
                            label: attempt.name,
                            number: attempt.number,
                        },
                    };
                });

                setNodes(updated_nodes);
            }



            // loadAttemptDependencies
            async function loadAttemptDependencies() {
                const deps = await fetch_all_attempt_dependencies();

                const initialEdges = deps.map((dep) => ({
                    id: `attemptdep-${dep.id}`,
                    source: `attempt-${dep.vortakt_attempt_id}`,
                    target: `attempt-${dep.nachtakt_attempt_id}`,
                    type: "default",
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
        loadData()
    }, [])





    // Merge Nodes
    useEffect(() => {
        setMergedNodes([
            headerNode,
            ...groupNodes,
            ...taskNodes,
            ...nodes, // attempts




        ]);
    }, [groupNodes, taskNodes, nodes]);





    // onNodesChange
    const onNodesChange = useCallback((changes) => {
        setMergedNodes((nds) => applyNodeChanges(changes, nds));
    }, []);




    // onNodeDragStop
    const onNodeDragStop = useCallback((event, node) => {
        if (node.type !== "attemptNode") return;

        const slotIndex = getSlotIndexFromX(node.position.x);
        const snappedX = getXFromSlotIndex(slotIndex);

        setMergedNodes((nds) =>
            nds.map((n) =>
                n.id === node.id
                    ? {
                        ...n,
                        position: { ...n.position, x: snappedX },
                    }
                    : n
            )
        );

        const attemptId = extractAttemptId(node.id); // "attempt-19" -> 19
        if (!attemptId) return;

        (async () => {
            try {
                const res = await update_attempt_slot_index(attemptId, slotIndex);
                console.log("Slot index saved:", res);
            } catch (err) {
                console.error("Failed to save slot index:", err);
            }
        })();
    }, [setMergedNodes]);


    // onEdgesChange
    const onEdgesChange = useCallback((changes) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);


    // onConnect
    const onConnect = useCallback((connection) => {
        console.log("onConnect fired:", connection);

        const vortaktId = extractAttemptId(connection.source);
        const nachtaktId = extractAttemptId(connection.target);

        if (!vortaktId || !nachtaktId) {
            console.error("Could not parse attempt IDs from nodes:", connection);
            return;
        }

        (async () => {
            try {
                const res = await add_attempt_dependency(vortaktId, nachtaktId);
                console.log("Dependency created:", res);

                setEdges((eds) =>
                    addEdge(
                        {
                            ...connection,
                            id: `attemptdep-${res.id}`,   // 👈 now we know which DB row this is
                            type: "default",
                            animated: true,
                            interactionWidth: 20,
                            style: { strokeWidth: 2 },
                        },
                        eds
                    )
                );
            } catch (err) {
                console.error("Failed to create attempt dependency:", err);
            }
        })();
    }, [setEdges]);


    // handleDeleteSelectedDependency
    async function handleDeleteSelectedDependency() {
        if (!selectedDepId || !selectedEdgeId) return;

        try {
            const res = await delete_attempt_dependency(selectedDepId);
            console.log("Dependency deleted:", res);

            // Remove edge from ReactFlow
            setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));

            setSelectedDepId(null);
            setSelectedEdgeId(null);
        } catch (err) {
            console.error("Failed to delete dependency:", err);
        }
    }




    // ________________________RENDER________________________
    return (
        <>
            <div
                style={{ height: `${y_reactflow_size}px` }}
                className="w-screen !h-screen
                        flex justify-center items-center 
                        lg:max-w-full  lg:px-10 
                        md:max-w-[700px] sm:max-w-full p-3">

                {/* Delete Dependency */}
                {selectedDepId && (
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
                )}


                {/* ReactFlow */}
                <div style={{ width: COMPONENT_WIDTH, height: y_reactflow_size }} className="
                                shadow-xl shadow-black/30 rounded-xl max-h-[75vh] ">
                    <ReactFlow
                        nodes={mergedNodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDragStop={onNodeDragStop}
                        elementsSelectable={true}               // (default, but nice to be explicit)
                        deleteKeyCode={["Delete", "Backspace"]}
                        minZoom={1}
                        onEdgeClick={(evt, edge) => {
                            console.log("EDGE CLICKED:", edge);
                            if (edge.id?.startsWith("attemptdep-")) {
                                const depId = parseInt(edge.id.replace("attemptdep-", ""), 10);
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
                            [COMPONENT_WIDTH + 100, y_reactflow_size],
                        ]}
                    >


                    </ReactFlow>
                </div>


            </div>

        </>
    )
}








