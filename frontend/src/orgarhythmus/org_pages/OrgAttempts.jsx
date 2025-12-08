import "reactflow/dist/style.css";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  useReactFlow,
  applyNodeChanges,
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


const COMPONENT_WIDTH = 800
const TEAM_WIDTH = COMPONENT_WIDTH;
const single_task_display_height = 50
const SIDEBAR_WIDTH = 60;     


// space for vertical team name
const INNER_PADDING_X = 12;    // inside the team container
const ROW_HEIGHT = 40;
const ROW_GAP = 8;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 16;






function TeamNode({ data }) {
  const sidebarWidth = data.sidebarWidth ?? 60;

  return (
    <div 
    style={{width: COMPONENT_WIDTH, height: data.height}}
    className="w-[800px] h-full flex bg-slate-100 rounded-lg overflow-hidden border border-slate-300">
      {/* Left vertical label */}
      <div
        style={{ width: sidebarWidth, backgroundColor: data.color }}
        className={` text-white flex items-center justify-center`}
      >
        <span
          className="text-xs font-semibold tracking-wide text-black"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {data.label}
        </span>
      </div>

      {/* Right area – children (attempt nodes) will be rendered on top of this */}
      <div className="flex-1 relative p-2">
        {/* React Flow will paint child nodes here via parentNode/extent='parent' */}

      
      
      </div>
    </div>
  );
}


function TaskNode({data }){
  return (
    <>
      <div 
      style={{width: COMPONENT_WIDTH-SIDEBAR_WIDTH, height: single_task_display_height}}
      className=" w-full h-full border">
        {data.label}

      </div>
    </>
  )
}











function AttemptNode({ data }) {
  return (
    <div
      className="h-10 bg-white rounded-md border border-slate-300 shadow-sm flex items-center px-3 text-xs"
      style={{ width: data.width }}   // 👈 we pass width via data
    >
      {data.label}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}




const nodeTypes = {
  teamNode: TeamNode,
  taskNode: TaskNode,
  attemptNode: AttemptNode,
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

  const REACTFLOW_HEIGHT = 700;


  useEffect(() => {
    async function loadData() {
      async function loadTeams() {

        //LOAD TEAMS
        const all_teams = await fetch_all_teams();
        setAll_Teams(all_teams)

        //VARIABLES
        
        const num_teams = all_teams.length
        let currentY = 0;
        const gap = 0; 


        //RENDER TEAM NODES
        const updated_group_nodes = all_teams.map((team) => {
          let team_display_height = team.tasks.length * single_task_display_height;
          if (team_display_height < 100) {
            team_display_height = 100;
          }

          const node = {
            id: String(team.id),
            type: "teamNode",
            position: { x: 0, y: currentY },   // 👈 use cumulative Y
            data: { label: team.name, color: team.color, height:  team_display_height},

            draggable: false,
            selectable: false,
          };

          currentY += team_display_height + gap;  // 👈 move down for next team
          

          return node;
        });
        setGroupNodes(updated_group_nodes);
        setY_reactflow_size(currentY + 100);

        //RENDER TASK NODES
        const updated_task_nodes = all_teams.flatMap((team) => {
          const tasks_of_this_team = team.tasks || [];

          return tasks_of_this_team.map((task, taskIndex) => ({
            id: `task-${task.id}`,          // globally unique ID
            type: "taskNode",               // must exist in nodeTypes
            parentNode: String(team.id),    // 👈 put it inside the TeamNode
            extent: "parent",
            position: {
              x: SIDEBAR_WIDTH,                         // left inside content area
              y: taskIndex * single_task_display_height,            // vertical stacking
            },
            data: {
              label: task.name,
              // you can pass more here:
              // width: ..., color: ..., etc.
            },
            draggable: false,
          }));
        });

        setTaskNodes(updated_task_nodes);


      }













      async function loadAttempts() {
        const all_attempts = await fetch_all_attempts();
        setAll_Attempts(all_attempts)

        const updated_nodes = all_attempts.map((attempt, index) => {
          return (
            {
              id: String(attempt.id),
              parentNode: `task-${attempt.task.id}`,
              extent: "parent",
              type: 'attemptNode', // Add node type
              position: { x: 0, y: index * 0 },
              data: {
                label: attempt.name
              }
            }
          )
        })
        setNodes(updated_nodes)
      };

      async function loadTasks() {
        const all_tasks = await fetch_all_tasks();
        setAll_Tasks(all_tasks)
      }





      //Calling all load functions: 
      await loadTeams();
      await loadAttempts();
      await loadTasks();  
    }
    loadData()
  }, [])


  //Print
  function debug() {
    console.log("\n\n___________ALL Teams___________", all_teams);
    // console.log("\n\n___________ALL Tasks___________", all_tasks);
    // console.log("\n\n___________ALL Attempts___________", all_attempts)
  }
  debug();



  useEffect(() => {
  setMergedNodes([...groupNodes, ...taskNodes, ...nodes]);
}, [nodes, groupNodes, taskNodes]);



  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  return (
    <>
      <div
  style={{ height: `${y_reactflow_size}px` }}
  className="w-screen 
             flex justify-center items-center 
             m-20 border 
             shadow-xl shadow-black/30"
      >
        <ReactFlow
          nodes={mergedNodes}
          nodeTypes={nodeTypes}
          
          onNodesChange={onNodesChange}
          

          maxZoom={1.2}
          minZoom={0.8}
          translateExtent={[
            [0, 0],
            [COMPONENT_WIDTH + 100, y_reactflow_size],  // ✅ same value
          ]}
        >
          
         
        </ReactFlow>
      </div>

    </>
  )
}








