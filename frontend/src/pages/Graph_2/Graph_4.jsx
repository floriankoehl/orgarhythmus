import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
    useEdgesState,
    useNodesState,
    Handle,
    getStraightPath,
    BaseEdge,
    EdgeLabelRenderer

} from "reactflow"
import FaceIcon from '@mui/icons-material/Face';
import LocationOnIcon from '@mui/icons-material/LocationOn';




const initialNodes = [
];
const initialEdges = [
];


//Defining Layout in Star Format
function starLayout(nodes, mainNodeId) {
    const centerX = 0;
    const centerY = 0;

    const radius = 400;

    const mainNode = nodes.find((n) => n.id == mainNodeId)
    const others = nodes.filter((n) => n.id != mainNodeId)

    const angleStep = others.length > 0 ? (2 * Math.PI) / others.length : 0;

    const positionedNodes = nodes.map((node) => {
        if (node.id === mainNode.id) {
            return {
                ...node,
                position: { x: centerX, y: centerY }
            };
        };

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



// Defining Custom Nodes 
// Main Node - the company on which page we currently are
// DefaultCompanyDisplay - the defautl
function MainCompanyDisplay({ data, selected }) {
    return (
        <>
            <div className={`
${selected ? 'bg-red-300' : 'bg-orange-300'}
h-30 w-60 
flex
p-2
rounded
shadow-xl
font-bold

            `}>
                <h1>{data.label}</h1>
                <Handle type="source" position="bottom" />
                <Handle type="target" position="top" />
            </div>
        </>
    )
}

function DefaultCompanyDisplay({ selected, data }) {
    return (
        <div className={`
${selected ? 'bg-blue-400' : 'bg-yellow-200'}
h-20
w-40
rounded
shadow-xl
p-1

                    
                    
                    `}>
            {data.label}
            <Handle type="source" position="bottom" />
            <Handle type="target" position="top" />
        </div>
    );
}

const nodeTypes = {
    default_company_display: DefaultCompanyDisplay,
    main_company_display: MainCompanyDisplay,
}

// Defining Custom Edges



function DetailedEdge(props) {
    const [edgePath, labelX, labelY] = getStraightPath(props);
    console.log("props: ", props)

    return (
        <>
            <BaseEdge
                {...props}
                path={edgePath}
                style={{
                    ...props.style,
                    stroke: 'blue',
                    strokeWidth: 3,
                }}
            />


            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        pointerEvents: 'all', // so you can click it
                    }}
                    className={`
w-10 h-10 
rounded 
bg-black
backdrop-blur-lg
border border-black/25
text-white
flex
justify-center
items-center

                    `}
                >
                    
                    {props.data?.label === "Person" ? 
                    <FaceIcon/>
                    : 
                    <LocationOnIcon/>
                   
                    }

                    
                </div>
            
            </EdgeLabelRenderer>

        </>

    );
}




const edgeTypes = {
    detailed_edge: DetailedEdge,
}






export default function Graph_4() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);




    // Helper to merge new nodes & edges into the existing graph
    const updateGraphData = (newNodes = [], newEdges = []) => {
        // --- NODES ---
        setNodes((prevNodes) => {
            // Map old nodes by id
            const byId = new Map(prevNodes.map((n) => [n.id, n]));

            // Insert / overwrite with new nodes
            newNodes.forEach((n) => {
                const existing = byId.get(n.id) || {};
                byId.set(n.id, { ...existing, ...n });
            });

            // Convert back to array
            return Array.from(byId.values());
        });

        // --- EDGES ---
        setEdges((prevEdges) => {
            // Map old edges by id
            const byId = new Map(prevEdges.map((e) => [e.id, e]));

            // Insert / overwrite with new edges
            newEdges.forEach((e) => {
                const existing = byId.get(e.id) || {};
                byId.set(e.id, { ...existing, ...e });
            });

            return Array.from(byId.values());
        });
    };

    // Fetching a single company by id
    async function fetchCompany(id) {
        const response = await fetch(`https://apibizray.bnbdevelopment.hu/api/v1/network/${id}`);

        if (!response.ok) {
            throw new Error("Failed to fetch company data");
        }
        const data = await response.json();
        console.log("Fetched company data: ", data);


        const company = data.company
        const mainId = company.firmenbuchnummer;
        console.log("Main id: ", mainId)
        console.log(company)

        const rawNodes = company.nodes.map((node) => {
            const createdNode = {
                id: node.id,
                type: node.id === mainId
                    ? "main_company_display"
                    : "default_company_display",
                position: { x: 0, y: 0 },
                data: { label: node.label }
            }
            return createdNode
        });

        const rawEdges = company.edges.map((edge) => {
            const createdEdge = {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                type: "straight",
                data: {label: edge.label},
                animated: true
            }

            return createdEdge
        })


        const positionedNodes = starLayout(rawNodes, mainId)

        updateGraphData(positionedNodes, rawEdges)
        //{id: '2', position: {x:100, y:100}, data: {label: 'Node 2'}},
        // {id: 'e1-2', source: '1', target: '2', animated: true},







    }

    useEffect(() => {
        fetchCompany('563319k');
    }, []);

    const selectedNodeIds = useMemo(
        () => nodes.filter((n) => n.selected).map((n) => n.id),
        [nodes]
    );



    const displayEdges = useMemo(
        () =>
            edges.map((edge) => {
                const isConnected =
                    selectedNodeIds.includes(edge.source) ||
                    selectedNodeIds.includes(edge.target);

                return {
                    ...edge,
                    type: isConnected ? 'detailed_edge' : 'straight',
                };
            }),
        [edges, selectedNodeIds]
    );



    return (
        <>
            <div className="w-full h-[100vh] bg-blue-300 py-15">
                <div className="bg-blue-200 px-10 h-full w-full">
                    <div className="h-full w-full bg-white">
                        <ReactFlow
                            nodes={nodes}
                            edges={displayEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}

                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}

                            // onSelectionChange={handleSelectionChange}
                            fitView
                        />
                    </div>

                </div>

            </div>
        </>
    )
}










