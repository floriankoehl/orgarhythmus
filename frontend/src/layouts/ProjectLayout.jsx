// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader"
import TaskStructure from "../components/tasks_classification/TaskStructure";

export default function ProjectLayout() {
  const { projectId } = useParams();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header always visible */}
      <ProjectHeader projectId={projectId} />

      {/* Page content below header — pt-16 on wrapper clears the fixed header */}
      <main className="relative w-full flex justify-center">
        <Outlet />
      </main>

      {/* Floating Task Structure — persists across all project subpages */}
      <TaskStructure />
    </div>
  );
}
