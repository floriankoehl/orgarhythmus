// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
import ProjectHeader from "../projects/components/ProjectHeader"

export default function ProjectLayout() {
  const { projectId } = useParams();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 ">
      {/* Header always visible */}
      <ProjectHeader projectId={projectId} />

      {/* Page content below header */}
      <main className="relative w-full flex justify-center mt-5">
        <Outlet />
      </main>
    </div>
  );
}
