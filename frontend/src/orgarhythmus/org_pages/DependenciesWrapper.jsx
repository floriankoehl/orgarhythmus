

import { ReactFlowProvider } from "reactflow";
import Dependencies from "./Dependencies";


export default function DependenciesWrapper() {
    return (
        <>
            <ReactFlowProvider>
                <Dependencies/>
            </ReactFlowProvider>
        </>
    )
}





