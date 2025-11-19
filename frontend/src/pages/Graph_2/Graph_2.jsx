import 'reactflow/dist/style.css';
import ReactFlow, { Handle, getStraightPath, BaseEdge, EdgeLabelRenderer } from 'reactflow';
import { useEffect, useMemo, useState } from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';



function Company({ id, data }) {
    return (
        <>
            <div className='h-[50px] w-[90px] bg-purple-200 shadow-xl shadow-red-200 rounded flex flex-col justify-center items-center'>
                <Handle type="target" position="top" />
                <p className='text-black text-center'>{data.label}</p>
                <Handle type="source" position="bottom" />
                <Button 
                size="small" sx={{ minWidth: 0, padding: 0.25, fontSize: "6px"}} 
                className="!bg-red-700" 
                variant="contained" 
                onClick={() => data.deleteNode(id)}

                >Delete</Button>
            </div>
        </>
    );
};


function DetailedEdge(props) {
    const [edgePath, labelX, labelY] = getStraightPath(props);

    return (
        <>
            <BaseEdge path={edgePath} {...props} />
            <EdgeLabelRenderer>
                <div

                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                    }}
                >
                    <button className='bg-blue-200 p-1 rounded text-[10px]'>Click Me</button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};


const edgeTypes = {
    detailed: DetailedEdge,
};

const nodeTypes = {
    company: Company,
};




const initial_nodes = [
    {id: "1", type: 'company', position: {x: 0, y: 0}, data: {label: "Node 1", id: "1"}},
    {id: "2", type: 'company', position: {x: 100, y: 100}, data: {label: "Node 2", id: "2"}},
    {id: "3", type: 'company', position: {x: 200, y: 200}, data: {label: "Node 3", id: "3"}},
]


const inital_egdes = [
    {id: "e1-2", type: "detailed", source: "1", target: "2"},
    {id: "e2-3", type: "detailed", source: "2", target: "3"},
]



export default function Graph_2() {
    const [edges, setEdges] = useState(inital_egdes);
    const [nodes, setNodes] = useState(initial_nodes);

    const [alignment, setAlignment] = useState('1');

    const handleChange = (event, newAlignment) => {
        if (!newAlignment) return;
        setAlignment(newAlignment);
        setEdges((edges)=>{
            return edges.map((edge)=>{
                if (newAlignment === '1') {
                    return {...edge, type:  "default"}
                } else if (newAlignment === '2') {
                    return {...edge, type:  "detailed"}
                } else if (newAlignment === '3') {
                    return {...edge, type:  "default"}
                }
               
        })});
    };

    useEffect(() => {
        console.log("Graph changed:", { nodes, edges });
    }, [nodes, edges]);



    function deleteNode(node_id) {
        setNodes((nodes) => nodes.filter((n) => n.id !== node_id));
    };



    const renderNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          deleteNode, // ← function from this component
        },
      })),
    [nodes] // deleteNode is stable here, we don’t wrap it in useCallback yet
  );


    return (
        <>

        <div className='h-200 w-full  flex justify-center items-center'>
            <div>
                    <h1 className='text-black font-bold text-3xl mb-5 text-center'>Graph 2 Page</h1>
                    
                

                <div className='h-[700px] w-[800px] bg-white rounded-xl shadow-xl shadow-black/20'>
                    <div className=' h-[60px] rounded  flex justify-center relative'>
                        <ToggleButtonGroup
                            className='bg-white   shadow-md shadow-black/10 rounded relative w-full !w-full flex justify-center'
                            color="primary"
                            value={alignment}
                            exclusive
                            onChange={handleChange}
                            aria-label="Platform"
                        >
                            <ToggleButton  className="w-1/3 p-0 m-0" value="1">Simple</ToggleButton>
                            <ToggleButton  className="w-1/3 p-0 m-0" value="2">Detailed</ToggleButton>
                            <ToggleButton className="w-1/3 p-0 m-0" value="3">Connections</ToggleButton>
                        </ToggleButtonGroup>
                    </div>
                    
                    <ReactFlow
                        
                        nodes={renderNodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                    />
                </div>
            </div>
        </div>
            
        </>
    );
};

  





