// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader"
import IdeaBin from "../components/ideas/IdeaBin"

export default function ProjectLayout() {
  const { projectId } = useParams();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 pt-16">
      {/* Header always visible */}
      <ProjectHeader projectId={projectId} />

      {/* Page content below header — pt-16 on wrapper clears the fixed header */}
      <main className="relative w-full flex justify-center">
        <Outlet />
      </main>

      {/* Floating Idea Bin — persists across all project pages */}
      <IdeaBin />
    </div>
  );
}
