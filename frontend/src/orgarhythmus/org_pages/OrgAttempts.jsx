import "reactflow/dist/style.css";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  Controls,
  Handle,
  Position
} from "reactflow";
import {
  add_dependency,
  fetch_all_tasks,
  all_dependencies,
  delete_dependency,
  fetch_all_attempts,
  fetch_all_teams
} from "../org_API";
import dagre from "@dagrejs/dagre";
import Button from "@mui/material/Button";
import { Plus, BarChart3, SlidersHorizontal, X } from "lucide-react";
import CreateTaskForm from "../org_components/CreateTaskForm";
import SMTaskCard from "../org_components/TaskCardSM";
import { width } from "@mui/system";
import snapSoundFile from "../../assets/snap.mp3"

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

function get_overall_gap(num_tasks, gap, header_gap) {
  return num_tasks * gap + header_gap -20;
}



function snapAttemptX(x) {
  // x ist die aktuelle position.x des AttemptNodes (relativ zum TaskNode)
  const GRID_OFFSET = TASK_SIDEBAR_WIDTH;

  // relative Position ab Grid-Start
  const relative = x - GRID_OFFSET;

  // in welchen Slot gehört er? (0-basiert)
  let slotIndex = Math.round(relative / TASK_WIDTH);

  // clamp, damit er nicht aus dem Grid raus kann
  if (slotIndex < 0) slotIndex = 0;
  if (slotIndex > ENTRIES - 1) slotIndex = ENTRIES - 1;

  // neue x-Position = Start dieses Slots
  return GRID_OFFSET + slotIndex * TASK_WIDTH;
}



const isMobile = window.innerWidth <= 768;
let TASK_HEIGHT = 60;
let TASK_WIDTH = 60;
const ENTRIES = 15

let SIDEBAR_WIDTH = 80;
let TASK_SIDEBAR_WIDTH = 100;

const TEAM_GAP_PADDING_Y = 5;
const TASK_GAP_PADDING_X = 0;
const HEADER_BODY_GAP = 10;


if (isMobile) {
  TASK_HEIGHT = 30;
  TASK_WIDTH = 30;
   SIDEBAR_WIDTH = 50;
 TASK_SIDEBAR_WIDTH = 50;
} 
  
// const TEAM_WIDTH = COMPONENT_WIDTH;


//JUST FOR DEMO - WILL LATER CHANGE


// Total width including both sidebars & the grid columns
const COMPONENT_WIDTH =
  SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH + (ENTRIES * TASK_WIDTH);

// Pixel map must start AFTER both sidebars
const GRID_OFFSET = SIDEBAR_WIDTH + TASK_SIDEBAR_WIDTH;

const pixelMap = Array.from({ length: ENTRIES }, (_, idx) => {
  const index = idx + 1;

  const beginn = GRID_OFFSET + (index - 1) * TASK_WIDTH;
  const end = GRID_OFFSET + index * TASK_WIDTH;

  return [index, { beginn, end }];
}).reduce((obj, [key, value]) => {
  obj[key] = value;
  return obj;
}, {});

console.log("COMPONENT_WIDTH:", COMPONENT_WIDTH);
console.log("PIXELMAP:", pixelMap);






// // space for vertical team name
// const INNER_PADDING_X = 12;    // inside the team container
// const ROW_HEIGHT = 40;
// const ROW_GAP = 8;
// const TOP_PADDING = 16;
// const BOTTOM_PADDING = 16;


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











// ⬇️ add "selected" here
function AttemptNode({ data, selected }) {
  return (
    <div
      className={`
        bg-white rounded-md border  
        shadow-sm flex justify-center items-center m-2 text-xs
        transition-all duration-150
        font-bold !text-[15px] text-black shadow-xl shadow-black/2
        ${selected ? "border-sky-500 shadow-md scale-105 shadow-black/30"  : "border-slate-300"}
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
        style={{
          left: -2,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: -2,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </div>
  );
}





const nodeTypes = {
  teamNode: TeamNode,
  taskNode: TaskNode,
  attemptNode: AttemptNode,
  taskHeaderNode: TaskHeaderNode, 
};

const headerNode = {
  id: "task-header",
  type: "taskHeaderNode",
  position: { x: 0, y: 0 },
  draggable: false,
  selectable: false,
};




export default function OrgAttempts() {
  const [all_teams, setAll_Teams] = useState([]);
  const [all_tasks, setAll_Tasks] = useState([]);
  const [all_attempts, setAll_Attempts] = useState([])
  const [nodes, setNodes] = useState([])
  const [groupNodes, setGroupNodes] = useState([])
  const [taskNodes, setTaskNodes] = useState([])
  const [mergedNodes, setMergedNodes] = useState([])
  const [x_reactflow_size, setX_reactflow_size] = useState(1000)
  const [y_reactflow_size, setY_reactflow_size] = useState(1000)
  const [overallgap, setOverAllGap] = useState(0)

  const [edges, setEdges] = useState([]);






  const REACTFLOW_HEIGHT = 700;


  useEffect(() => {
    async function loadData() {
      async function loadTeams() {

        //LOAD TEAMS
        const all_teams = await fetch_all_teams();
        setAll_Teams(all_teams)

        //VARIABLES

        const num_teams = all_teams.length
        let currentY = TASK_HEIGHT + HEADER_BODY_GAP; // start below header

        const gap = 0;


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

        setOverAllGap(get_overall_gap(num_teams,TEAM_GAP_PADDING_Y, HEADER_BODY_GAP ))
        setY_reactflow_size(currentY + get_overall_gap(num_teams,TEAM_GAP_PADDING_Y, HEADER_BODY_GAP));
      }
      //END HERE












      async function loadAttempts() {
        const all_attempts = await fetch_all_attempts();
        setAll_Attempts(all_attempts)

        const updated_nodes = all_attempts.map((attempt, index) => {
          return (
            {
              id: `attempt-${attempt.id}`,
              parentNode: `task-${attempt.task.id}`,
              extent: "parent",
              type: 'attemptNode', // Add node type
              position: { x: 0 + TASK_SIDEBAR_WIDTH, y: index * 0 },
              data: {
                label: attempt.name,
                number: attempt.number
              }
            }
          )
        })
        setNodes(updated_nodes)
      };

      // async function loadTasks() {
      //   const all_tasks = await fetch_all_tasks();
      //   setAll_Tasks(all_tasks)
      // }





      //Calling all load functions: 
      await loadTeams();
      await loadAttempts();
      // await loadTasks();  
    }
    loadData()
  }, [])


  //Print
  function debug() {
    console.log("\n\n___________ALL Teams___________", all_teams);
    // console.log("\n\n___________ALL Tasks___________", all_tasks);
    console.log("\n\n___________ALL Attempts___________", all_attempts)
  }
  debug();



 useEffect(() => {
  setMergedNodes([
    headerNode,
    ...groupNodes,
    ...taskNodes,
    ...nodes, // attempts
    
    
    
    
  ]);
}, [groupNodes, taskNodes, nodes]);






  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);



const onNodeDragStop = useCallback((event, node) => {
  if (node.type !== "attemptNode") return;

  setMergedNodes((nds) =>
    nds.map((n) => {
      if (n.id !== node.id) return n;

      const snappedX = snapAttemptX(node.position.x);
      const didSnap = snappedX !== node.position.x;

      if (didSnap) {
        playSnapSound();
      }

      return {
        ...n,
        position: {
          ...n.position,
          x: snappedX,
        },
        data: {
          ...n.data,
          justSnapped: didSnap ? Date.now() : n.data.justSnapped,
        },
      };
    })
  );
}, []);



  const onEdgesChange = useCallback((changes) => {
  setEdges((eds) => applyEdgeChanges(changes, eds));
}, []);

const onConnect = useCallback((connection) => {
  console.log("onConnect fired:", connection);

  setEdges((eds) => {
    const newEdges = addEdge(
      {
        ...connection,
        type: "default",     // 👈 curved edge, less hidden behind nodes
        animated: true,
        interactionWidth: 20,   // 👈 big click area around the line
        style: { strokeWidth: 2 },
      },
      eds
    );
    console.log("edges now:", newEdges);
    return newEdges;
  });
}, []);






//

  return (
    <>
      <div
        style={{ height: `${y_reactflow_size}px` }}
        className="w-screen 
             flex justify-center items-center 
             m-20 lg:max-w-full  lg:px-10 md:max-w-[700px] sm:max-w-full p-3
             "
      >
        <div style={{ width: COMPONENT_WIDTH, height: y_reactflow_size }} className="
        shadow-xl shadow-black/30 rounded-xl ">
          <ReactFlow
  nodes={mergedNodes}
  edges={edges}
  nodeTypes={nodeTypes}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onNodeDragStop={onNodeDragStop}
  elementsSelectable={true}               // (default, but nice to be explicit)
  deleteKeyCode={["Delete", "Backspace"]} // allow deleting selected edges/nodes
  maxZoom={1.2}
  minZoom={1}
    // onNodeClick={(evt, node) => console.log("NODE CLICKED:", node)}
  onEdgeClick={(evt, edge) => console.log("EDGE CLICKED:", edge)}

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








