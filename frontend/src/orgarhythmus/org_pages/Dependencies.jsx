import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback } from "react";
import ReactFlow, { addEdge, useReactFlow  } from "reactflow";

import { add_dependency, fetch_all_tasks, all_dependencies } from "../org_API";
import dagre from "@dagrejs/dagre";



const nodeWidth = 180;
const nodeHeight = 60;
export function getLayoutedNodes(nodes, edges, direction = "TB") {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // TB = top-bottom, LR = left-right
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const { x, y } = dagreGraph.node(node.id);

    return {
      ...node,
      position: { x, y },
    };
  });
}


export default function Dependencies(){
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [tasks, setTasks] = useState([]);
    
    const { fitView } = useReactFlow(); 




useEffect(() => {
    async function loadData() {
        // 1. Load dependencies first
        const fetched_dependencies = await all_dependencies();
        const safeDeps = fetched_dependencies || [];

        const DepEdges = safeDeps.map((dep) => ({
            id: String(dep.id),
            source: String(dep.vortakt),  
            target: String(dep.nachtakt) 
        }));

        // 2. Load tasks
        const fetched_tasks = await fetch_all_tasks();
        const safeTasks = fetched_tasks || [];

        const tasknodes = safeTasks.map((task) => ({
            id: String(task.id),
            position: { x: 0, y: 0 },
            data: { label: task.name, ...task },
        }));

        // 3. Now layout with ACTUAL edges (not empty array!)
        const layouted = getLayoutedNodes(tasknodes, DepEdges, "TB");  // ✅ Pass edges
        setNodes(layouted);
        setEdges(DepEdges);

        // 4. Fit view after everything is set
        setTimeout(() => fitView({ padding: 0.2 }), 0);
    }

    loadData();
}, [fitView]);



    //Handles Connection & that they are valid
    // const onConnect = useCallback(
    //     (connection)=>{
    //         console.log("New dependency:", connection);
    //     setEdges((eds) => addEdge(connection, eds))
    // }, [setEdges]);
    const onConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(connection, eds);

        // const add_dep_response = await add_dependency
        console.log("New dependency: ", connection)
        console.log("Vortakt id: ", connection.source)
        console.log("Nachtakt id: ", connection.target)
        add_dependency(connection.source, connection.target)
        // re-layout nodes based on new edges
        setNodes((nds) => getLayoutedNodes(nds, newEdges, "TB"));

        // adjust viewport
        setTimeout(() => fitView({ padding: 0.2 }), 0);

        return newEdges;
      });
    },
    [fitView]
  );


    const isValidConnection = useCallback((connection) => {
        if (!connection.source || !connection.target) return false;
        // no self-loops
        if (connection.source === connection.target) return false;

        // later: prevent circular deps etc.
        return true;
    }, []);



    return (
        <>
            <div className="h-screen w-screen flex flex-col gap-2
            justify-center items-center bg-gray-200
            ">

                <h1>Inside Dependencies</h1>
                <div className="h-full w-[800px] bg-blue-200 rounded">
                    <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    onConnect={onConnect}
                    isValidConnection={isValidConnection}
                    fitView />


                    
                </div>
                
            </div>
        </>
    )
}








