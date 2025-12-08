import "reactflow/dist/style.css";
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  useReactFlow,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  Position,
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


// const groupNodes = [
//   {
//     id: "group_music",
//     position: { x: 0, y: 0 },
//     type: "default",
//     data: { label: "Music Group" },
//     style: {
//       width: 500,
//       height: 400,
//       background: "#eef2ff",
//       border: "2px solid #6366f1",
//       borderRadius: 12,
//     },
//     draggable: false,
//     selectable: true,
//   }

// ];



export default function OrgAttempts() {
  const [all_teams, setAll_Teams] = useState([]);
  const [all_tasks, setAll_Tasks] = useState([]);
  const [all_attempts, setAll_Attempts] = useState([])
  const [nodes, setNodes] = useState([])
  const [groupNodes, setGroupNodes] = useState([])
  const [mergedNodes, setMergedNodes] = useState([])

  const REACTFLOW_HEIGHT = 700;


  useEffect(() => {
    async function loadData() {
      async function loadTeams() {
       
        const all_teams = await fetch_all_teams();
        setAll_Teams(all_teams)

        const num_teams = all_teams.length
        const team_display_height = (REACTFLOW_HEIGHT-10)/num_teams

        const updated_group_nodes = all_teams.map((team, index) => {
          return (
            {
              id: String(team.id),
              type: "default",
              position: { x: 0, y: index * team_display_height },
              data: { label: team.name },
              style: {
                width: 800,
                height: team_display_height,
                background: team.color,
                border: "2px solid #6366f1",
                borderRadius: 12,
              },
              draggable: false,
              selectable: true,
            }

          )
        });
        setGroupNodes(updated_group_nodes)
      }


      async function loadAttempts() {
        const all_attempts = await fetch_all_attempts();
        setAll_Attempts(all_attempts)

        const updated_nodes = all_attempts.map((attempt, index) => {
          return (
            {
              id: String(attempt.id),
              parentNode: String(attempt.task.team),
              extent: "parent",
              type: 'default', // Add node type
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
      loadTeams()
      loadAttempts()
      loadTasks()
    }
    loadData()
  }, [])


  //Print
  function debug() {
    console.log("\n\n___________ALL Teams___________", all_teams);
    console.log("\n\n___________ALL Tasks___________", all_tasks);
    console.log("\n\n___________ALL Attempts___________", all_attempts)
  }
  debug();



  useEffect(() => {
    setMergedNodes([...groupNodes, ...nodes])
  }, [nodes, groupNodes])


  const onNodesChange = useCallback((changes) => {
    setMergedNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  return (
    <>
      <div className="h-[700px] w-screen 
            flex justify-center items-center 
            m-20 border rounded-xl
            shadow-xl shadow-black/30
            ">
        <ReactFlow
          nodes={mergedNodes}
          onNodesChange={onNodesChange}
          fitView
          

        >
          <Background variant="dots" gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </>
  )
}








