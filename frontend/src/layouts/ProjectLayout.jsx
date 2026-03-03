// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
import ProjectHeader from "../components/ProjectHeader"
import WindowManager from "../components/shared/WindowManager";
import IdeaBin from "../components/ideas/IdeaBin";
import ProfileWindow from "../pages/user/ProfileWindow";
import NotificationsWindow from "../components/NotificationsWindow";
import TaskStructure from "../components/tasks_classification/TaskStructure";
import ScheduleWindow from "../grid_board/ScheduleWindow";
import CalendarWindow from "../pages/general/CalendarWindow";
import OverviewWindow from "../pages/general/OverviewWindow";

/**
 * Ordered window definitions — determines icon dock layout (top → bottom).
 * The first 3 are org-level windows absorbed into the project manager;
 * the last 4 are project-specific.
 */
const PROJECT_WINDOWS = [
  { id: "ideaBin" },
  { id: "profile" },
  { id: "notifications" },
  { id: "taskStructure" },
  { id: "schedule" },
  { id: "calendar" },
  { id: "overview" },
];

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

      {/* WindowManager orchestrates ALL floating windows inside a project */}
      <WindowManager windows={PROJECT_WINDOWS} dockStartY={60}>
        <IdeaBin />
        <ProfileWindow />
        <NotificationsWindow />
        <TaskStructure />
        <ScheduleWindow />
        <CalendarWindow />
        <OverviewWindow />
      </WindowManager>
    </div>
  );
}
