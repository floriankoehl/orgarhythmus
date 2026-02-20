// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams, useLocation } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader"
import IdeaBin from "../components/ideas/IdeaBin"

export default function ProjectLayout() {
  const { projectId } = useParams();
  const location = useLocation();
  const isIdeasPage = location.pathname.endsWith("/ideas");

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 ">
      {/* Header always visible */}
      <ProjectHeader projectId={projectId} />

      {/* Page content below header */}
      <main className="relative w-full flex justify-center mt-5">
        <Outlet />
      </main>

      {/* Floating Idea Bin — persists across all project pages except Ideas page */}
      {!isIdeasPage && <IdeaBin />}
    </div>
  );
}
