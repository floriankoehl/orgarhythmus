import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
    useEdgesState,
    useNodesState,
    getStraightPath,
    BaseEdge,
    EdgeLabelRenderer,
    Background,
    MiniMap,
    Controls,
} from "reactflow";
import 'reactflow/dist/style.css';

import FaceIcon from '@mui/icons-material/Face';
import LocationOnIcon from '@mui/icons-material/LocationOn';


import SettingsButton from "./GraphSettings";

import { companyNodeTypes } from "./CompanyNodeTypes";



const initialNodes = [
];
const initialEdges = [
];




function starLayout(nodes, mainNodeId) {
    const centerX = 0;
    const centerY = 0;
    const rootRadius = 400;
    const childRadius = 350;

    if (!nodes || nodes.length === 0) return [];


    const hasCustomPosition = (node) =>
        node.position &&
        (
            node.position.x !== 0 ||
            node.position.y !== 0 ||
            node.type === "main_company_display"
        );



    let mainNode = nodes.find((n) => n.id === mainNodeId);
    if (!mainNode) {
        mainNode = nodes[0];
    }

    const mainPos = mainNode.position || { x: 0, y: 0 };
    const isRootLike = mainPos.x === 0 && mainPos.y === 0;


    if (isRootLike) {
        const others = nodes.filter((n) => n.id !== mainNode.id);
        const angleStep = others.length > 0 ? (2 * Math.PI) / others.length : 0;

        return nodes.map((node) => {
            if (node.id === mainNode.id) {

                return {
                    ...node,
                    position: { x: centerX, y: centerY },
                    data: {
                        ...(node.data ?? {}),
                        branchAngle: 0,
                    },
                };
            }


            if (hasCustomPosition(node)) {
                return node;
            }

            const index = others.findIndex((n) => n.id === node.id);
            const angle = index * angleStep;

            const x = centerX + rootRadius * Math.cos(angle);
            const y = centerY + rootRadius * Math.sin(angle);

            return {
                ...node,
                position: { x, y },

                data: {
                    ...(node.data ?? {}),
                    branchAngle: angle,
                },
            };
        });
    }


    const others = nodes.filter((n) => n.id !== mainNode.id);
    const newChildren = others.filter((n) => !hasCustomPosition(n));


    const baseAngle =
        mainNode.data?.branchAngle ??
        Math.atan2(mainPos.y - centerY, mainPos.x - centerX);

    const spread = (140 * Math.PI) / 180;

    const angleStep =
        newChildren.length > 1 ? spread / (newChildren.length - 1) : 0;
    const startAngle = baseAngle - spread / 2;

    return nodes.map((node) => {

        if (node.id === mainNode.id) {
            return {
                ...node,
                position: mainPos,
            };
        }


        if (hasCustomPosition(node)) {
            return node;
        }


        const index = newChildren.findIndex((n) => n.id === node.id);
        if (index === -1) {
            return node;
        }

        const angle = startAngle + index * angleStep;
        const x = mainPos.x + childRadius * Math.cos(angle);
        const y = mainPos.y + childRadius * Math.sin(angle);

        return {
            ...node,
            position: { x, y },
            data: {
                ...(node.data ?? {}),

                branchAngle: angle,
            },
        };
    });
}







function DetailedEdge(props) {
    const [edgePath, labelX, labelY] = getStraightPath(props);
    const [showInfo, setShowInfo] = useState(false)

    // console.log(props)
    return (
        <>
            <BaseEdge
                {...props}
                path={edgePath}
                style={{
                    ...props.style,
                    stroke: 'purple',
                    strokeWidth: 3,

                }}
            />


            <EdgeLabelRenderer>
                <div

                    onMouseEnter={() => { setShowInfo(true) }}
                    onMouseLeave={() => { setShowInfo(false) }}

                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,

                        pointerEvents: 'all',
                    }}
                    className={`
w-12 h-12 
rounded-full
bg-white
backdrop-blur-lg
border border-black/25
relative

flex
justify-center
items-center
shadow-xl
shadow-black/40

                    `}
                >

                    {props.data?.label === "Person" ?
                        <FaceIcon />
                        :
                        <LocationOnIcon />

                    }
                    {showInfo && <div
                        style={{ zIndex: 1020 }}
                        className="
    inline-flex  
     !px-3 !py-1   
    min-w-30
    max-w-50
    bg-white              
    rounded-2xl
    shadow-xl
    px-3
    py-2
    gap-2
    justify-center
    items-center
    text-black
    text-xs
    backdrop-blur-xl 
    border border-white/30 
    absolute
    top-[120%]
    z-[200]
    text-[20px]
  "
                    >
                        {props.data.value}
                    </div>}


                </div>

            </EdgeLabelRenderer>

        </>

    );
}

const edgeTypes = {
    detailed_edge: DetailedEdge,
}








export default function Graph({ id_that_was_passed }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [defaultCompanyDisplayType, setDefaultCompanyDisplayType] = useState("default_company_display")


    const [visibleNodeIds, setVisibleNodeIds] = useState(() => new Set());
    const [childrenByParent, setChildrenByParent] = useState({});

    const [rootId, setRootId] = useState(null);

    const [edgeFilter, setEdgeFilter] = useState("all");



    function edgeMatchesFilter(edge) {
        const label = edge.data?.label;

        if (edgeFilter === "all") return true;
        if (edgeFilter === "person") return label === "Person";
        if (edgeFilter === "location") return label === "Location";

        return true;
    }









    function changeSingleNodeType(nodeId, newType) {
        setNodes((prevNodes) =>
            prevNodes.map((node) =>
                node.id === nodeId
                    ? { ...node, type: newType }
                    : node
            )
        );
    }
    function change_company_display_default(set_to_this_type) {
        // console.log("Changed the display to: ", set_to_this_type)
        setDefaultCompanyDisplayType(set_to_this_type);
    }


    useEffect(() => {
        setNodes((prevNodes) =>
            prevNodes.map((node) => {
                if (node.type === "main_company_display" || node.selected) return node;

                if (
                    node.type === "default_company_display" ||
                    node.type === "minimal_company_display"
                ) {
                    return {
                        ...node,
                        type: defaultCompanyDisplayType,
                    };
                }

                return node;
            })
        );
    }, [defaultCompanyDisplayType]);






    //____________________________________________________________
    //___________Fetching Company Data & Updating View____________
    //____________________________________________________________


    //This Function removes the duplicate Nodes and edges that come when fetching a target node
    //So if company A -> B and you fetch B, that you dont get the node B -> A
    //It just stays A -> B
    const updateGraphData = (newNodes = [], newEdges = []) => {

        setNodes((prevNodes) => {

            const byId = new Map(prevNodes.map((n) => [n.id, n]));


            newNodes.forEach((n) => {
                const existing = byId.get(n.id) || {};
                byId.set(n.id, { ...existing, ...n });
            });


            return Array.from(byId.values());
        });


        setEdges((prevEdges) => {

            const byId = new Map(prevEdges.map((e) => [e.id, e]));


            newEdges.forEach((e) => {
                const existing = byId.get(e.id) || {};
                byId.set(e.id, { ...existing, ...e });
            });

            return Array.from(byId.values());
        });
    };


    async function fetchCompany(id) {

        //Fetching the Company from Api via the id
        const response = await fetch(`https://apibizray.bnbdevelopment.hu/api/v1/network/${id}`);
        if (!response.ok) {
            throw new Error("Failed to fetch company data");
        }
        const data = await response.json();
        const company = data.company;
        const mainId = company.firmenbuchnummer;



        //The company fetched on the mount will stay the rootId forever
        if (!rootId) {
            setRootId(mainId);
        }


        //The Parent Id will later be important for recursively collapsing all child nodes if you collapse this one
        const parentId = id;



        //Gives ALL node ids that are currently displayed
        const existingById = new Map(nodes.map((n) => [n.id, n]));



        //Creates First Node Instances, only the Root Node is treated differently
        const rawNodes = company.nodes.map((node) => {
            const existing = existingById.get(node.id);
            const isMain = node.id === (rootId ?? mainId);

            return {
                id: node.id,

                type: existing?.type ?? (isMain ? "main_company_display" : defaultCompanyDisplayType),

                position: existing?.position ?? { x: 0, y: 0 },

                data: {
                    ...(existing?.data ?? {}),
                    label: node.label,
                },
            };
        });



        //Creates raw edges - nothing special
        const rawEdges = company.edges.map((edge) => {
            const createdEdge = {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                type: "straight",
                data: { label: edge.label, value: edge.value },
                animated: true,
            };

            return createdEdge;
        });



        //Creates Layout and Position of Nodes with two rules: 
        //IF ROOT NODE -> Make a circle with all nodes around it
        //IF NOT ROOT NODE -> Takes angle of parent and makes a half circle for the childs
        const positionedNodes = starLayout(rawNodes, parentId);



        //Should remove duplicate Edges (so A->B = B->A, so not necessary) !!!!MAYBE NOT WOKRING FOR CHILDS THO
        updateGraphData(positionedNodes, rawEdges);




        //On Inital Mount - All Nodes are new, you can ignore
        //If you expand a Child, it checks, which Connection Nodes (Companies) are already displayed, then follows two rules: 
        //IF they are displayed - just leave them like that
        //IF NOT -> These are now added to newChildIds (will later be important for collapsing all childs and child of childs recursively)
        const newChildIds = positionedNodes
            .map((n) => n.id)
            .filter((nid) => nid !== parentId && !visibleNodeIds.has(nid));




        //Creates a Objects to reconstruct the path of who calls him for expanding
        //The Parent - is the one who calls the expansion: 
        //All Nodes that are not expanded till then will be added as their Child Nodes 
        setChildrenByParent((prev) => {
            const prevChildrenSet = prev[parentId] ?? new Set();
            const updatedChildrenSet = new Set(prevChildrenSet);

            newChildIds.forEach((nid) => {
                updatedChildrenSet.add(nid);
            });

            return {
                ...prev,
                [parentId]: updatedChildrenSet,
            };
        });











        //Updates all the Nodes that are now displayed!
        setVisibleNodeIds((prev) => {
            const next = new Set(prev);
            positionedNodes.forEach((n) => next.add(n.id));
            return next;
        });
    }


    function getPathToRoot(nodeId) {
        if (!rootId) return [];

        const path = [nodeId];
        let current = nodeId;
        const seen = new Set([nodeId]); // safety against cycles

        while (current !== rootId) {
            const parent = parentByChild[current];

            if (!parent || seen.has(parent)) {
                // no parent known or broken / cyclic structure
                break;
            }

            path.push(parent);
            seen.add(parent);
            current = parent;
        }

        // currently: [selected, ..., root]
        // return as: [root, ..., selected]
        return path.reverse();
    }


    function findParentOf(childId, childrenByParent) {
        for (const [parentId, childrenSet] of Object.entries(childrenByParent)) {
            if (childrenSet.has(childId)) {
                return parentId;
            }
        }
        return null;
    }

    function getPathToRoot(nodeId) {
        if (!rootId) return [];

        const path = [nodeId];
        let current = nodeId;
        const seen = new Set([nodeId]);

        while (current !== rootId) {
            const parent = findParentOf(current, childrenByParent);

            if (!parent || seen.has(parent)) {

                break;
            }

            path.push(parent);
            seen.add(parent);
            current = parent;
        }


        return path.reverse();
    }


    const pathEdgeSet = useMemo(() => {
        const set = new Set();

        if (!rootId) return set;


        const selectedNode = nodes.find((n) => n.selected);
        if (!selectedNode) return set;

        const path = getPathToRoot(selectedNode.id);
        if (path.length < 2) return set;


        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            set.add(`${from}->${to}`);
        }

        return set;
    }, [nodes, rootId, childrenByParent]);














    useEffect(() => {
        if (!rootId) return;


        const selectedNode = nodes.find((n) => n.selected);
        if (!selectedNode) return;

        const path = getPathToRoot(selectedNode.id);
        console.log("PATH root → ... → selected:", path);


    }, [nodes, rootId]);



    useEffect(() => {
        //DEBUG
        // console.log("VISIBLE NODE IDS (effect):", visibleNodeIds);
        // console.log("CHILDREN BY PARENT (effect):", childrenByParent);
    }, [visibleNodeIds, childrenByParent]);





    useEffect(() => {
        //This fetches the actual company at first Mount, never called again later
        fetchCompany(id_that_was_passed);
        //304173p
        //563319k
    }, []);




    const selectedNodeIds = useMemo(
        //Checks which notes are currently selected for the edges later on (Selected! So multiple are possible although i didnt implement it yet)
        () => nodes.filter((n) => n.selected).map((n) => n.id),
        [nodes]
    );


    //     const displayEdges = useMemo(
    //   () =>
    //     edges
    //       .filter((edge) => edgeMatchesFilter(edge)) 
    //       .map((edge) => {
    //         const isConnected =
    //           selectedNodeIds.includes(edge.source) ||
    //           selectedNodeIds.includes(edge.target);

    //         const isOnPath = pathEdgeSet.has(`${edge.source}->${edge.target}`);

    //         return {
    //           ...edge,
    //           type: isConnected || isOnPath ? "detailed_edge" : "straight",
    //         };
    //       }),
    //   [edges, selectedNodeIds, pathEdgeSet, edgeFilter] 
    // );

    // 1) First: edges that match the current filter
    const filteredEdges = useMemo(
        () => edges.filter((edge) => edgeMatchesFilter(edge)),
        [edges, edgeFilter]
    );

    // 2) Then: style them depending on selection + path
    const displayEdges = useMemo(
        () =>
            filteredEdges.map((edge) => {
                const isConnected =
                    selectedNodeIds.includes(edge.source) ||
                    selectedNodeIds.includes(edge.target);

                const isOnPath = pathEdgeSet.has(`${edge.source}->${edge.target}`);

                return {
                    ...edge,
                    type: isConnected || isOnPath ? "detailed_edge" : "straight",
                };
            }),
        [filteredEdges, selectedNodeIds, pathEdgeSet]
    );

    // All node IDs that still have at least one visible edge
    const visibleByFilterNodeIds = useMemo(() => {
        const set = new Set();

        // For each visible edge, mark its endpoints as visible
        filteredEdges.forEach((edge) => {
            set.add(edge.source);
            set.add(edge.target);
        });

        // Optionally always keep the root visible, even if no edges match
        if (rootId) {
            set.add(rootId);
        }

        return set;
    }, [filteredEdges, rootId]);




    //This gives ALL Children that the company expanded
    //So children -> grandchildren -> grandgrandchildren ... 
    //It recursively calls itself to collect all
    const collect_subtree_debug = true;
    const collectSubtreeIds = (parentId, childrenMap, depth = 0) => {
        const indent = "    ".repeat(depth);

        const result = new Set();
        const directChildren = childrenMap[parentId];

        //DEBUG
        if (collect_subtree_debug) {
            // console.log(indent, "PARENT: ", parentId)
            // console.log(indent, "DIRECT CHILDREN: ", directChildren)
        }

        if (!directChildren) {
            return result;
        }

        for (const childId of directChildren) {
            result.add(childId);
            const sub = collectSubtreeIds(childId, childrenMap, depth + 1);
            for (const id of sub) {
                result.add(id);
            }
        }

        return result;
    };


    //This simply receives all children, grandchildren etc. of parentId and removes them from display
    const collapseCompany = (parentId) => {
        const toRemove = collectSubtreeIds(parentId, childrenByParent);


        //Filters out all nodes that are being collapsed - This is plain
        setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));



        setEdges((prev) => {
            const edge_filter = prev.filter(
                (e) =>

                    !toRemove.has(e.source) &&
                    !toRemove.has(e.target) &&
                    e.source !== parentId

            )
            console.log(edge_filter)
            return edge_filter
        }
        );


        if (toRemove.size === 0) {
            return;
        }




        //Removes the Nodes the the currently visible set
        setVisibleNodeIds((prev) => {
            const next = new Set(prev);
            toRemove.forEach((id) => next.delete(id));
            return next;
        });


        //Updates the Children-Parent Map
        setChildrenByParent((prev) => {
            const updated = { ...prev };

            toRemove.forEach((id) => {
                delete updated[id];
            });

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



    // const renderNodes = useMemo(
    //     () =>
    //         nodes.map((node) => ({
    //             ...node,
    //             data: {
    //                 ...node.data,
    //                 fetchCompany: (id) => {
    //                     fetchCompany(id);
    //                 },
    //                 collapseCompany: (id) => {
    //                     collapseCompany(id);
    //                 },
    //                 changeNodeType: (id, newType) => changeSingleNodeType(id, newType),
    //             },
    //         })),
    //     [nodes, childrenByParent]
    // );


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
                    changeNodeType: (id, newType) => changeSingleNodeType(id, newType),
                },
            })),
        [nodes, childrenByParent]
    );

    // Only pass nodes that have at least one visible edge (or are root)
    const displayNodes = useMemo(
        () =>
            renderNodes.filter((node) => visibleByFilterNodeIds.has(node.id)),
        [renderNodes, visibleByFilterNodeIds]
    );




    return (
        <>
            <div className="w-full h-[100vh] bg-blue-300 py-15 relative">

                <SettingsButton

                    open={false}
                    changing_default_company_display_tape_f={change_company_display_default}
                    onEdgeFilterChange={setEdgeFilter}
                />



                <div className="bg-blue-200 px-10 h-full w-full">
                    <div className="h-full w-full ">
                        <ReactFlow
                            style={{ backgroundColor: '#f3f5feff' }}
                            nodes={displayNodes}
                            edges={displayEdges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            nodeTypes={companyNodeTypes}
                            edgeTypes={edgeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.3 }}

                            minZoom={0.05}
                            maxZoom={4}
                            zoomOnScroll
                            zoomOnPinch
                            zoomOnDoubleClick
                        >

                            <Background
                                variant="dots"
                                gap={20}
                                size={1}
                                color="#07111eff"
                            />


                            <MiniMap
                                pannable
                                zoomable
                            />


                            <Controls />
                        </ReactFlow>

                    </div>

                </div>

            </div>
        </>
    )
}









