// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
import ProjectHeader from "../projects/components/ProjectHeader"

export default function ProjectLayout() {
  const { projectId } = useParams();   // ⬅️ read from URL
//bg-slate-800
  return (
    <div className="min-h-screen  text-slate-50"> 
      {/* Header always visible, gets the id */}
      <ProjectHeader projectId={projectId} />

      {/* Page content below header */}
      <main className="relative">
        <Outlet />
      </main>
    </div>
  );
}
