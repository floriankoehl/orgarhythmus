// Graph_4_Wrapper.jsx
import { ReactFlowProvider } from "reactflow";
import { useParams } from "react-router-dom";
import { useEffect } from "react";
import Graph from "./Graph";

export default function GraphWrapper() {
//   const { id } = useParams();

//   useEffect(() => {
//     window.scrollTo({
//       top: 0,
//       left: 0,
//       behavior: "smooth", 
//     });
//   }, [id]);

  return (
    <ReactFlowProvider>
      <Graph
        key="563319k"
        id_that_was_passed="563319k"
      />
    </ReactFlowProvider>
  );
}