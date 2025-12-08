

import { ReactFlowProvider } from "reactflow";
import OrgAttempts from "./OrgAttempts";


export default function OrgAttemptsWrapper() {
    return (
        <>
            <ReactFlowProvider>
                <OrgAttempts/>
            </ReactFlowProvider>
        </>
    )
}





