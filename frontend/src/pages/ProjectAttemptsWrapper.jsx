

import { ReactFlowProvider } from "reactflow";
import ProjectAttempts from "./ProjectAttempts";


export default function OrgAttemptsWrapper() {
    return (
        <>
            <ReactFlowProvider>
                <div className="h-full bg-black/5">
                    <ProjectAttempts />
                </div>

            </ReactFlowProvider>
        </>
    )
}





