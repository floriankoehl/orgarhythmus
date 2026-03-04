// orgarhythmus/org_layouts/ProjectLayout.jsx
import { Outlet, useParams } from "react-router-dom";
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

  return (
    <PipelineProvider>
        <div className="min-h-screen w-full bg-slate-900">
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
