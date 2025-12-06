import 'reactflow/dist/style.css';
import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
    useReactFlow,
    applyNodeChanges,
    Background,
    Controls,

} from "reactflow";
import { add_dependency, fetch_all_tasks, all_dependencies, delete_dependency } from "../org_API";
import dagre from "@dagrejs/dagre";
import Button from '@mui/material/Button';


//Caluclates Layout
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


export default function Dependencies() {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedEdge, setSelectedEdge] = useState(null);

    const { fitView } = useReactFlow();



    //Load Data in the beginning
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

    //Connecting Tasks
    const onConnect = useCallback(
        async (connection) => {
            // 1) Inform backend
            const created = await add_dependency(connection.source, connection.target);
            // adjust to your real API shape if needed

            // 2) Build a proper edge object with backend ID
            const newEdge = {
                id: String(created.id),            // backend dependency id
                source: String(created.vortakt),   // or whatever your field is called
                target: String(created.nachtakt),
            };

            // 3) Update state + layout + viewport
            setEdges((eds) => {
                const nextEdges = [...eds, newEdge];

                setNodes((nds) => getLayoutedNodes(nds, nextEdges, "TB"));
                setTimeout(() => fitView({ padding: 0.2 }), 0);

                return nextEdges;
            });
        },
        [fitView]
    );
    //Checks if Connection is Valid
    const isValidConnection = useCallback((connection) => {
        if (!connection.source || !connection.target) return false;
        // no self-loops
        if (connection.source === connection.target) return false;

        // later: prevent circular deps etc.
        return true;
    }, []);

    //Makes nodes Draggable
    const onNodesChange = useCallback(
        (changes) => {
            setNodes((nds) => applyNodeChanges(changes, nds));
        },
        []
    );



    async function handle_dep_deletion() {
  if (!selectedEdge) return; // nothing selected

  const ok = window.confirm("Delete this dependency?");
  if (!ok) return;

  try {
    await delete_dependency(selectedEdge.id);

    setEdges((eds) => {
      const nextEdges = eds.filter((e) => e.id !== selectedEdge.id);

      setNodes((nds) => getLayoutedNodes(nds, nextEdges, "TB"));
      setTimeout(() => fitView({ padding: 0.2 }), 0);

      return nextEdges;
    });

    setShowSettings(false);
    setSelectedEdge(null);
  } catch (err) {
    console.error("Could not delete dependency", err);
  }
}



    const onEdgeClick = useCallback((event, edge) => {
  event.stopPropagation();      // so clicking edge doesn't also trigger pane click
  setSelectedEdge(edge);        // store the clicked edge
  setShowSettings(true);        // open your settings / delete UI
}, []);






    return (
        <>
            <div className="h-screen w-screen flex flex-col gap-2
            justify-center items-center bg-black/2
            ">

                <div className='h-20 w-full  mt-20 flex justify-center items-center'>
                    <div
                        className='w-[900px] h-full bg-white border rounded flex items-center p-2'>
                        {showSettings && <Button
                            onClick={() => { handle_dep_deletion() }}
                            className="h-10 " variant="outlined" color="error">Delete Dependency</Button>}
                        
                            

                    </div>
                </div>
                <div className="h-full w-[900px] rounded border">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}


                        onNodesChange={onNodesChange}
                        onEdgeClick={onEdgeClick}
                        onConnect={onConnect}
                        isValidConnection={isValidConnection}


                        fitView ><Background variant="dots" gap={16} size={1} />
                        <Controls />
                    </ReactFlow>



                </div>

            </div>
        </>
    )
}








