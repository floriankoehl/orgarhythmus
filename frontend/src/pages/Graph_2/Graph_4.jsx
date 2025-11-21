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
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';




const initialNodes = [
];
const initialEdges = [
];


//Defining Layout in Star Format
function starLayout(nodes, mainNodeId) {
    const centerX = 0;
    const centerY = 0;
    const radius = 400;

    if (!nodes || nodes.length === 0) return [];

    // Versuche, den gewünschten Main-Node zu finden
    let mainNode = nodes.find((n) => n.id === mainNodeId);

    // 🔥 Fallback: wenn der gewünschte Main-Node in diesem Batch nicht vorkommt,
    // nimm einfach den ersten Node als Zentrum
    if (!mainNode) {
        mainNode = nodes[0];
    }

    const others = nodes.filter((n) => n.id !== mainNode.id);

    const angleStep = others.length > 0 ? (2 * Math.PI) / others.length : 0;

    const positionedNodes = nodes.map((node) => {
        if (node.id === mainNode.id) {
            return {
                ...node,
                position: { x: centerX, y: centerY },
            };
        }

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

function DefaultCompanyDisplay({ id, selected, data }) {
    return (
        <div className={`
${selected ? 'bg-blue-400' : 'bg-yellow-200'}
h-30
w-40
rounded
shadow-xl
p-1
flex
flex-col
gap-2
justify-center
items-center

                    
                    
                    `}>
            {data.label}
            <Handle type="source" position="bottom" />
            <Handle type="target" position="top" />
            <div className="flex gap-2 justify-center">
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log("Expand triggered, i am : ", id)
                        data.fetchCompany(id)

                    }}
                    className="bg-white p-1 rounded hover:bg-gray-200">
                    <OpenInFullIcon />
                </div>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        
                        console.log("Collapse triggered, i am : ", id)
                        data.collapseCompany(id);
                    }}
                    className="bg-white p-1 rounded hover:bg-gray-200">
                    <CloseFullscreenIcon />
                </div>


            </div>

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
    // console.log("props: ", props)

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
w-12 h-12 
rounded-full
bg-white
backdrop-blur-lg
border border-black/25

flex
justify-center
items-center
shadow-xl

                    `}
                >

                    {props.data?.label === "Person" ?
                        <FaceIcon />
                        :
                        <LocationOnIcon />

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


    const [visibleNodeIds, setVisibleNodeIds] = useState(() => new Set());
    const [childrenByParent, setChildrenByParent] = useState({});
    const [rootId, setRootId] = useState(null);




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
        // console.log("Fetched company data: ", data);


        const company = data.company
        const mainId = company.firmenbuchnummer;


        // 🔥 Root nur einmal setzen (beim ersten Fetch)
        if (!rootId) {
            setRootId(mainId);
        }

        // Welche ID gilt aktuell als "Main" im Layout?
        const effectiveMainId = rootId ?? mainId;

        const rawNodes = company.nodes.map((node) => {
            const isMain = node.id === effectiveMainId;

            const createdNode = {
                id: node.id,
                type: isMain
                    ? "main_company_display"
                    : "default_company_display",
                position: { x: 0, y: 0 },
                data: { label: node.label }
            };
            return createdNode;
        });

        const rawEdges = company.edges.map((edge) => {
            const createdEdge = {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                type: "straight",
                data: { label: edge.label },
                animated: true
            };

            return createdEdge;
        });

        // 🔥 Layout immer um die ursprüngliche Root zentrieren
        const positionedNodes = starLayout(rawNodes, effectiveMainId);


        updateGraphData(positionedNodes, rawEdges)
        //{id: '2', position: {x:100, y:100}, data: {label: 'Node 2'}},
        // {id: 'e1-2', source: '1', target: '2', animated: true},


        // 🔍 Neue Child-IDs ermitteln: alle, die nicht mainId sind
        // und noch NICHT im aktuellen visibleNodeIds-Set enthalten sind
        const newChildIds = positionedNodes
            .map((n) => n.id)
            .filter((id) => id !== mainId && !visibleNodeIds.has(id));

        // 🧬 childrenByParent-Eintrag für mainId aktualisieren
        setChildrenByParent((prev) => {
            const prevChildrenSet = prev[mainId] ?? new Set();
            const updatedChildrenSet = new Set(prevChildrenSet);

            newChildIds.forEach((id) => {
                updatedChildrenSet.add(id);
            });

            return {
                ...prev,
                [mainId]: updatedChildrenSet,
            };
        });


        // 🔥 alle Nodes aus diesem Fetch zur Sichtbarkeit dazu nehmen (nicht überschreiben)
        setVisibleNodeIds((prev) => {
            const next = new Set(prev);
            positionedNodes.forEach((n) => next.add(n.id));
            return next;
        });





    }

    useEffect(() => {
        console.log("VISIBLE NODE IDS (effect):", visibleNodeIds);
        console.log("CHILDREN BY PARENT (effect):", childrenByParent);
    }, [visibleNodeIds, childrenByParent]);





    useEffect(() => {
        fetchCompany('563319k');
        //304173p
        //563319k
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




// 🔁 Alle Nachkommen eines Parents rekursiv einsammeln
const collectSubtreeIds = (parentId, childrenMap) => {
  const result = new Set();
  const directChildren = childrenMap[parentId];
  if (!directChildren) return result;

  for (const childId of directChildren) {
    result.add(childId);
    const sub = collectSubtreeIds(childId, childrenMap);
    for (const id of sub) {
      result.add(id);
    }
  }

  return result;
};


// const collapseCompany = (parentId) => {
//   // 1️⃣ Alle Kinder (inkl. Enkel usw.) einsammeln
//   const toRemove = collectSubtreeIds(parentId, childrenByParent);

//   if (toRemove.size === 0) {
//     return; // nichts zu tun
//   }

//   // 2️⃣ Nodes wirklich aus dem Graph entfernen
//   setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));

//   // 3️⃣ Alle Edges entfernen, die zu einem entfernten Node gehören
//   setEdges((prev) =>
//     prev.filter(
//       (e) => !toRemove.has(e.source) && !toRemove.has(e.target)
//     )
//   );

//   // 4️⃣ Sichtbarkeits-Set updaten (optional, aber sauber)
//   setVisibleNodeIds((prev) => {
//     const next = new Set(prev);
//     toRemove.forEach((id) => next.delete(id));
//     return next;
//   });

//   // 5️⃣ Optional: childrenByParent „aufräumen“
//   setChildrenByParent((prev) => {
//     const updated = { ...prev };

//     // alle Einträge für entfernte Nodes löschen
//     toRemove.forEach((id) => {
//       delete updated[id];
//     });

//     // und sie aus den Kind-Sets anderer Eltern rausnehmen
//     Object.keys(updated).forEach((parent) => {
//       const set = updated[parent];
//       if (!set) return;
//       const newSet = new Set(
//         [...set].filter((childId) => !toRemove.has(childId))
//       );
//       updated[parent] = newSet;
//     });

//     return updated;
//   });
// };










    // const renderNodes = useMemo(
    //     () =>
    //         nodes.map((node) => ({
    //             ...node,
    //             data: {
    //                 ...node.data,
    //                 // Funktion, die vom Node aus aufgerufen werden kann
    //                 fetchCompany: (id) => {
    //                     fetchCompany(id);
    //                 },
    //             },
    //         })),
    //     [nodes]
    // );

const collapseCompany = (parentId) => {
  // 1️⃣ Alle Kinder (inkl. Enkel usw.) einsammeln
  const toRemove = collectSubtreeIds(parentId, childrenByParent);

  if (toRemove.size === 0) {
    return; // nichts zu tun
  }

  // 2️⃣ Nodes wirklich aus dem Graph entfernen
  setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));

  // 3️⃣ Alle Edges entfernen,
  //    - die zu entfernten Nodes gehören
  //    - ODER bei denen die Source der Parent selbst ist (Edges aus diesem Expand)
  setEdges((prev) =>
    prev.filter(
      (e) =>
        !toRemove.has(e.source) &&
        !toRemove.has(e.target) &&
        e.source !== parentId
    )
  );

  // 4️⃣ Sichtbarkeits-Set updaten (optional, aber sauber)
  setVisibleNodeIds((prev) => {
    const next = new Set(prev);
    toRemove.forEach((id) => next.delete(id));
    return next;
  });

  // 5️⃣ Optional: childrenByParent „aufräumen“
  setChildrenByParent((prev) => {
    const updated = { ...prev };

    // alle Einträge für entfernte Nodes löschen
    toRemove.forEach((id) => {
      delete updated[id];
    });

    // und sie aus den Kind-Sets anderer Eltern rausnehmen
    Object.keys(updated).forEach((parent) => {
      const set = updated[parent];
      if (!set) return;
      const newSet = new Set(
        [...set].filter((childId) => !toRemove.has(childId))
      );
      updated[parent] = newSet;
    });

    return updated;
  });
};



const renderNodes = useMemo(
  () =>
    nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        fetchCompany: (id) => {
          fetchCompany(id);
        },
        collapseCompany: (id) => {
          collapseCompany(id);
        },
      },
    })),
  [nodes, childrenByParent]
);

    return (
        <>
            <div className="w-full h-[100vh] bg-blue-300 py-15">
                <div className="bg-blue-200 px-10 h-full w-full">
                    <div className="h-full w-full bg-white">
                        <ReactFlow
                            nodes={renderNodes}
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










