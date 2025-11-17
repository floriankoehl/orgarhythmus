import 'reactflow/dist/style.css';

import ReactFlow, {
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  getStraightPath,
  Background,
  Controls,
} from 'reactflow';


import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import Button from '@mui/material/Button';
import { useState } from 'react';

import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';


function CustomNode({ data }) {
  return (
    <div className="h-[70px] w-[120px] bg-black/50 flex flex-col justify-center items-center rounded-xl text-white">
      <h2>CUSTOM:</h2>
      <p>{data.label}</p>
       <Handle type="target" position={Position.top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function TinyNode({ data }) {
  return (
    <div className="bg-black/10 rounded-full h-10 w-10 flex justify-center items-center relative">
      <Handle type="target" position={Position.top} />
      <Handle type="source" position={Position.Bottom} />
      <AddBusinessIcon />
      
    </div>
  );
}





function HoverContainer() {
    return (
        <>
            <div className="
                            w-[150px] h-[70px]
                            bg-gradient-to-br from-purple-500/20 via-purple-300/10 to-purple-100/5
                            backdrop-blur-xl
                            rounded
                            p-4
                            shadow-lg shadow-black/10
                            ">
                <h2 className="text-black m-0">This is the hover</h2>
            </div>
        </>
    )
}









function BubbleEdge(props) {
  // 1) Let React Flow compute the path and label position for a smoothstep edge
  const [edgePath, labelX, labelY] = getStraightPath(props);
    const [show, setShow] = useState(false);

    function display_hover(){
        console.log("actually triggerd")
        if (show) {
            
            setShow(false);
        } else {
            setShow(true);
        }
    }


  return (
    <>
      {/* 2) Draw the actual edge line */}
      <BaseEdge path={edgePath} {...props} />

      {/* 3) Draw a circle INSIDE the SVG (optional, for debugging) */}
      {/* <circle cx={labelX} cy={labelY} r={5} fill="red" /> */}

      {/* 4) Draw a DIV on top using the HTML overlay layer */}
      <EdgeLabelRenderer>
  <div
    style={{
      position: 'absolute',
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: 'all',
      zIndex: 1000,
    }}
    className="relative"
  >
    <div
      onMouseOver={()=>{display_hover()}} onMouseLeave={()=>{display_hover()}}
      className="p-[2px] rounded bg-black text-white flex items-center justify-center text-[10px]"
    >
      <TransferWithinAStationIcon className="!text-[20px] pointer-events-none" />
      
    </div>
    {show && (
      <div className="absolute ">
        <HoverContainer />
      </div>
    )}
    
  </div>
</EdgeLabelRenderer>

      
    </>
  );
}


function DottedEdge(props) {
  const [edgePath, labelX, labelY] = getSmoothStepPath(props);

  
  return (
    <>
      <BaseEdge path={edgePath} {...props} />
      <circle cx={labelX} cy={labelY} r={10} fill="#ff0072" >T</circle>
        
    </>
  );
}

const edgeTypes = { bubble: BubbleEdge };

const nodeTypes = { custom: CustomNode, tiny: TinyNode };















// just "what exists", no positions yet
const logicalNodes = [
  { id: 'main', type: 'custom', data: { label: 'Main Company' } },

  { id: 'client1', type: 'tiny', data: { label: 'Client A' } },
  { id: 'client2', type: 'tiny', data: { label: 'Client B' } },
  { id: 'partner1', type: 'tiny', data: { label: 'Partner X' } },
  { id: 'subsidiary1', type: 'tiny', data: { label: 'Subsidiary Y' } },
];

const initialEdges = [
  { id: 'e-main-client1', source: 'main', target: 'client1', type: 'bubble' },
  { id: 'e-main-client2', source: 'main', target: 'client2', type: 'bubble' },
  { id: 'e-main-partner1', source: 'main', target: 'partner1', type: 'bubble' },
  { id: 'e-main-subsidiary1', source: 'main', target: 'subsidiary1', type: 'bubble' },
];


function layoutBottom(nodes, centerId, centerPos = { x: 300, y: 100 },  gapY = 180) {
    

  const centerNode = nodes.find((n) => n.id === centerId);
  const others = nodes.filter((n) => n.id !== centerId);
  const dynamicGapX = Math.max(40, 500 / others.length);

  // compute horizontal start so they are centered below
  const totalWidth = (others.length - 1) * dynamicGapX;
  const startX = centerPos.x - totalWidth / 2;

  const layoutedOthers = others.map((node, index) => {
    const x = startX + index * dynamicGapX;
    const y = centerPos.y + gapY;

    return {
      ...node,
      position: { x, y },
    };
  });

  return [
    { ...centerNode, position: centerPos },  // main node on top
    ...layoutedOthers,                      // others below
  ];
}



export default function Graph() {
  const [nodes, setNodes] = useState(() =>
    layoutBottom(logicalNodes, 'main', { x: 300, y: 200 }, 200)
  );
  const [edges, setEdges] = useState(initialEdges);
   



  const [det, setDet] = useState(true);  

  const changeViewMode = (mode) => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        type: mode, // switch node type based on viewMode
      })),
    );
  };

  function changeDetail() {
  if (det) {
    setEdges((edg) =>
      edg.map((e) => ({
        ...e,
        type: 'bubble',
      }))
    );
    setDet(false);
  } else {
    setEdges((edg) =>
      edg.map((e) => ({
        ...e,
        type: 'straight',
      }))
    );
    setDet(true);
  }
}






  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
      <div className="w-screen h-10 m-2 relative flex gap-5 items-center justify-center">
        <Button
          className="w-[200px]"
          variant="contained"
          onClick={() => changeViewMode('tiny')}
        >
          Small
        </Button>
        <Button
          className="w-[200px]"
          variant="contained"
          onClick={() => changeViewMode('custom')}
        >
          Wide
        </Button>
        <Button
          className="w-[200px]"
          variant="contained"
          onClick={() => changeDetail()}
        >
          Detailed
        </Button>
      </div>

      <div className="h-[700px] w-[900px] bg-white rounded-xl">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        >
        <Background 
    color="#aaa"        // grey dots
    gap={16}            // spacing between dots
    size={1}            // size of the dots
  />
</ReactFlow>
      </div>
    </div>
  );
}
