// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PipelineProvider } from "../components/shared/PipelineContext";
import WindowManager from "../components/shared/WindowManager";
import IdeaBin from "../components/ideas/IdeaBin";
import ProfileWindow from "../pages/user/ProfileWindow";
import NotificationsWindow from "../components/NotificationsWindow";
import TaskStructure from "../components/tasks_classification/TaskStructure";
import ScheduleWindow from "../grid_board/ScheduleWindow";
import CalendarWindow from "../pages/general/CalendarWindow";
import OverviewWindow from "../pages/general/OverviewWindow";

/**
 * Ordered window definitions — determines inventory bar slot order (left → right).
 */
const PROJECT_WINDOWS = [
  { id: "ideaBin" },
  { id: "taskStructure" },
  { id: "schedule" },
  { id: "calendar" },
  { id: "overview" },
  { id: "profile" },
  { id: "notifications" },
];

export default function ProjectLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <PipelineProvider>
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100">
        {/* ── Leave-project button (top-left) ── */}
        <button
          onClick={() => navigate('/')}
          className="fixed top-3 left-3 z-[99980] flex items-center gap-1.5
            px-3 py-1.5 rounded-xl text-xs font-medium
            bg-slate-900/80 backdrop-blur-lg text-slate-200
            border border-slate-700/50 shadow-lg
            hover:bg-slate-800 hover:text-white hover:scale-105
            active:scale-95 transition-all duration-150 cursor-pointer"
          title="Back to all projects"
        >
          <ArrowLeft size={14} />
          <span>Leave</span>
        </button>

        {/* Page content */}
        <main className="relative w-full flex justify-center">
          <Outlet />
        </main>

        {/* WindowManager orchestrates ALL floating windows inside a project.
            InventoryBar is rendered automatically by WindowManager. */}
        <WindowManager windows={PROJECT_WINDOWS}>
          <IdeaBin />
          <ProfileWindow />
          <NotificationsWindow />
          <TaskStructure />
          <ScheduleWindow />
          <CalendarWindow />
          <OverviewWindow />
        </WindowManager>
      </div>
    </PipelineProvider>
  );
}
