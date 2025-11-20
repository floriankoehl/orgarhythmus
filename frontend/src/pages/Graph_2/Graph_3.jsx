
import ReactFlow, {Handle, 
    useReactFlow,
    BaseEdge, getStraightPath, getSmoothStepPath, useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import InfoIcon from '@mui/icons-material/Info';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import SelectHeader from '../../components/SelectHeader.jsx';
import dagre from 'dagre';
import FindReplaceIcon from '@mui/icons-material/FindReplace';



// function getLayoutedElements(nodes, edges) {
//   const dagreGraph = new dagre.graphlib.Graph();

//   // minimal config
//   dagreGraph.setDefaultEdgeLabel(() => ({}));
//   dagreGraph.setGraph({ rankdir: 'TB' }); // top → bottom, you can change to 'LR' later

//   // tell dagre about the nodes
//   nodes.forEach((node) => {
//     dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
//   });

//   // tell dagre about the edges
//   edges.forEach((edge) => {
//     dagreGraph.setEdge(edge.source, edge.target);
//   });

//   // let dagre compute positions
//   dagre.layout(dagreGraph);

//   // map positions back to React Flow nodes
//   const layoutedNodes = nodes.map((node) => {
//     const { x, y } = dagreGraph.node(node.id);

//     return {
//       ...node,
//       position: {
//         x: x - nodeWidth / 2,
//         y: y - nodeHeight / 2,
//       },
//     };
//   });

//   // edges unchanged
//   return { nodes: layoutedNodes, edges };
// }




function getStarLayout(nodes, mainNodeId) {
  // Mittelpunkt des Layouts in "Weltkoordinaten"
  const centerX = 0;
  const centerY = 0;

  // Radius für den Kreis der Nachbarn (kannst du anpassen)
  console.log("nodes:", nodes.length);
  let radius = 200;
  if (nodes.length > 7) {
    radius = 350;
  } 
  

  // Hauptknoten finden (oder fallback auf erstes Element)
  const mainNode = nodes.find((n) => n.id === mainNodeId) ?? nodes[0];

  // Alle anderen Nodes
  const others = nodes.filter((n) => n.id !== mainNode.id);

  const angleStep = others.length > 0 ? (2 * Math.PI) / others.length : 0;

  const positionedNodes = nodes.map((node) => {
    if (node.id === mainNode.id) {
      // Hauptknoten in die Mitte
      return {
        ...node,
        position: { x: centerX, y: centerY },
      };
    }

    // Index dieses Nodes innerhalb der "anderen"
    const index = others.findIndex((n) => n.id === node.id);
    const angle = index * angleStep;

    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      position: { x, y },
    };
  });

  return positionedNodes;
}








function Company({ id, data }) {
    return (
        <> 
            <Handle type="target" position="top" />
            <Handle type="source" position="bottom" />
            <div

className={`
relative 
h-20 
w-40 
p-2
${data.mainNodeId === id ? "bg-blue-400" : "bg-yellow-200"}
rounded 
flex flex-col 
justify-center 
items-center 
shadow-lg 
hover:shadow-2xl
hover:bg-yellow-300
`}>
                <div>
                    <h1 className='text-black text-center text-xs'>{data.label}</h1>
                    <div className='flex gap-2 justify-center mt-2'>
                        <div 
                        onClick={()=>{data.swap_view(id)}}
                        className='bg-white w-[30px] h-[30px] flex justify-center items-center rounded hover:bg-gray-200 hover:shadow-md hover:shadow-black/20'>
                            <InfoIcon className='!text-[20px]'/>
                        </div>
                        <div 
                        onClick={()=>{
                            
                            data.switch_selection(id);
                            console.log("This is my id: ", id)
                        
                        }}
                        className='bg-white w-[30px] h-[30px] flex justify-center items-center rounded hover:bg-gray-200 hover:shadow-md hover:shadow-black/20'>

                            <FindReplaceIcon className='!text-[20px]'/>
                        </div>
                        
                    </div>
                    
                </div>
                
                
            </div>
        </>
    )
}


function CompanyDetailed({id, data}){
    return (
        <>
            <div 
            
            className='h-30 w-50 bg-orange-200 rounded flex flex-col shadow-lg p-2 relative'>
                <Handle type="target" position="top" />
                <Handle type="source" position="bottom" />
                <h1 className='text-black'>{data.label}</h1>
                <div 
                onClick={()=>{data.swap_view(id)}}
                className='
                absolute
                top-0
                right-0
                bg-white
                h-8
                w-8
                
                m-1
                rounded-full
                flex
                justify-center
                items-center
                
                hover:bg-gray-200
                hover:shadow-md
                hover:shadow-black/20
                
                '>
                    <ZoomOutIcon className='
                        !text-[30px]
                        
                    '/>
                </div>
            </div>
        </>
    )
}




function default_edge(props) {
    const [edgePath, labelX, labelY] = getStraightPath(props);

    return (
        <>
            <BaseEdge path={edgePath} {...props}  />
        </>
    );
};


function smoothed(props) {
    const [edgePath, labelX, labelY] = getSmoothStepPath(props);

    return (
        <>
            <BaseEdge path={edgePath} {...props}  />
        </>
    );
};



const edgeTypes = {
    default_edge: default_edge,
    smoothed: smoothed,
};


const nodeTypes = {
    company: Company,
    companyDetailed: CompanyDetailed,
};



const initialNodes = [
    // {id: '1', type: "company", position: { x: 250, y: 0 }, data: { label: 'Company A' }},
    // {id: '2', type: "company", position: { x: 100, y: 100 }, data: { label: 'Company B' }},
    // {id: '3', type: "company", position: { x: 400, y: 100 }, data: { label: 'Company C' }},
];


const initalEdges = [
    // {id: 'e1-2', type: "default_edge", source: '1', target: '2', animated: true, label: 'Partnership'},
    // {id: 'e1-3', type: "default_edge", source: '1', target: '3', animated: true, label: 'Supplier'},
    // {id: 'e2-3', type: "default_edge", source: '2', target: '3', animated: true, label: 'Client'},
];




export default function Graph_3() {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initalEdges);
    const [mainNodeId, setmainNodeId] = useState(null);
    const [expandedNodeId, setExpandedNodeId] = useState(null);

    const [selection, setSelection] = useState(1);

//     async function fetchData(id) {
//     const response = await fetch(`https://apibizray.bnbdevelopment.hu/api/v1/network/563319k`);

//     if (!response.ok) {
//       console.error('Failed to fetch data');
//       return;
//     }

//     const data = await response.json();
//     console.log('Fetched data:', data.dummy_data);

//     // 1) Main company id (firmenbuchnummer)
//     const mainId = data.dummy_data.firmenbuchnummer;
//     console.log('Main company ID:', mainId);

//     // 2) Build raw nodes from API
//     const rawNodes = data.dummy_data.nodes.map((node) => ({
//       id: node.id,
//       type: 'company',
//       // temporary, will be overwritten by Dagre
//       position: { x: 0, y: 0 },
//       data: { label: node.label },
//     }));

//     // you can keep this as-is; no need to reorder anymore:
//     const nodesFromApi = rawNodes;

//     // 3) Build edges from API
//     const edgesFromApi = data.dummy_data.edges.map((edge, index) => ({
//       id: `e${index}-${edge.source}-${edge.target}`,
//       type: 'default_edge',
//       source: edge.source,
//       target: edge.target,
//       animated: true,
//       label: edge.label,
//     }));

//     // 4) Use Dagre to compute positions, telling it the main node
//     const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
//       nodesFromApi,
//       edgesFromApi,
//       'TB',     // 'TB' = top-bottom layout
//       mainId    // 🔥 pass main node id to enforce top rank
//     );

//     setNodes(layoutedNodes);
//     setEdges(layoutedEdges);
//     setmainNodeId(mainId);

//     setTimeout(() => {
//     fitView({ padding: 0.2, duration: 400 });
//   }, 0);
//   }


async function fetchData(id) {
  const response = await fetch(
    `https://apibizray.bnbdevelopment.hu/api/v1/network/${id}`
  );

  if (!response.ok) {
    console.error('Failed to fetch data', response.status);
    return;
  }

  const data = await response.json();
  console.log('Fetched raw data:', data);

  // alles liegt unter data.company
  const company = data.company;
  const mainId = company.firmenbuchnummer;
  console.log('Main company ID:', mainId);

  // 1) Nodes bauen
  const rawNodes = company.nodes.map((node) => ({
    id: node.id,
    // später kannst du node.type für unterschiedliche Node-Komponenten nutzen
    type: 'company',
    position: { x: 0, y: 0 }, // wird von getStarLayout überschrieben
    data: { label: node.label, expanded: false },
  }));

  // 2) Edges bauen
  const rawEdges = company.edges.map((edge, index) => ({
    id: `e${index}-${edge.source}-${edge.target}`,
    type: 'default_edge',
    source: edge.source,
    target: edge.target,
    animated: true,
    label: edge.label,
  }));

  // 3) Layout als Stern (🔥 hier war der Bug: nodesFromApi/edgesFromApi)
  const layoutedNodes = getStarLayout(rawNodes, mainId);

  setNodes(layoutedNodes);
  setEdges(rawEdges);
  setmainNodeId(mainId);

  // 4) alles ins Bild holen
  setTimeout(() => {
    fitView({ padding: 0.2, duration: 400 });
  }, 0);
}

// Beim Mount einmal aufrufen:
useEffect(() => {
  fetchData('563319k');   // nimm erstmal die ID, die im Browser sicher funktioniert
}, []);
// '661613k' 563319k




async function updateNodesAndEdges(id) {
    const response = await fetch(`https://apibizray.bnbdevelopment.hu/api/v1/network/${id}`);
    if (!response.ok) {
        console.error('Failed to fetch data');
        return;
    }
    const data = await response.json();
    console.log('Fetched data:', data);

// nach dem API-Call
const company = data.company;
const mainId = company.firmenbuchnummer;

const rawNodes = company.nodes.map((node) => ({
  id: node.id,
  type: 'company',
  position: { x: 0, y: 0 },
  data: { label: node.label, expanded: false },
  
}));

const rawEdges = company.edges.map((edge, index) => ({
  id: `e${index}-${edge.source}-${edge.target}`,
  type: 'default_edge',
  source: edge.source,
  target: edge.target,
  animated: true,
  label: edge.label,
}));

const layoutedNodes = getStarLayout(rawNodes, mainId);

setNodes((prev) => {
  const existingIds = new Set(prev.map((n) => n.id));
  const newOnes = layoutedNodes.filter((n) => !existingIds.has(n.id));
  return [...prev, ...newOnes];
});

setEdges((prev) => {
  const key = (e) => `${e.source}-${e.target}-${e.label}`;
  const existingKeys = new Set(prev.map(key));
  const newOnes = rawEdges.filter((e) => !existingKeys.has(key(e)));
  return [...prev, ...newOnes];
});

setExpandedNodeId(id);

}


async function unselectNode(id) {
    const new_edges = edges.filter((edge) => {
        return !((edge.source === id || edge.target === id) && (edge.source !== mainNodeId && edge.target !== mainNodeId));
    });
    
    setEdges(new_edges);
    setExpandedNodeId(null);
}


function switch_selection(id) {
  const node = nodes.find((node) => node.id === id);
  if (!node) return;

  const isExpanded = node.data?.expanded;

  if (isExpanded) {
    unselectNode(id);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, expanded: false } } : n
      )
    );
  } else {
    updateNodesAndEdges(id);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, expanded: true } } : n
      )
    );
  }
}


    
    const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );




    const change_selection = (newSelection) => {
        setSelection(newSelection);
    };


    useEffect(() => {
        setEdges((edges)=>{
            return edges.map((edge)=>{
                if (selection === 1) {
                    return {...edge, type:  "default_edge"}
                } else if (selection === 2) {
                    return {...edge, type:  "smoothed"}
                } else if (selection === 3) {
                    return {...edge, type:  "default_edge"}
                }
        })});
    }, [selection]);



    const swap_view = (id) => {
        setNodes((nodes)=>{
            return nodes.map((node)=>{
                if (node.id === id) {
                    if (node.type === "company")
                        return {...node, type: "companyDetailed"};
                    else {
                        return {...node, type: "company"};
                    }
                    
                }
                return node;
            }
        )} );
    };

    const renderNodes = useMemo(() => 
    nodes.map((node) => {
        node = {...node};
        node.data = {...node.data,
            mainNodeId,
            swap_view, 
            switch_selection
        };
        return node;
    })
, [nodes, swap_view]);





    return (
  <div className="h-screen flex flex-col p-20 gap-4">
    {/* Header */}
    <div className="border-2 border-yellow-200 bg-yellow-200 shrink-0">
      <h1>{selection}</h1>
      <SelectHeader change_selection={change_selection} />
    </div>

    {/* Graph area */}
    <div className="border-2 border-green-200 bg-green-200 flex-1 p-5">
      <ReactFlow
        className="h-full w-full bg-white rounded-lg"
        nodes={renderNodes}
        nodeTypes={nodeTypes}
        edges={edges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      />
    </div>
  </div>
);

}





