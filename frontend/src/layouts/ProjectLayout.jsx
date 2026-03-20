// orgarhythmus/org_layouts/ProjectLayout.jsx
import { useState, useCallback } from "react";
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
 * Window definitions — determines inventory bar slot order (left → right).
 * multiInstance: true  → user can open several copies of this window type.
 * multiInstance: false → singleton (only one instance makes sense).
 */
const WINDOW_DEFS = [
  { type: "ideaBin",       multiInstance: true  },
  { type: "taskStructure", multiInstance: true  },
  { type: "schedule",      multiInstance: true  },
  { type: "calendar",      multiInstance: true  },
  { type: "overview",      multiInstance: true  },
  { type: "profile",       multiInstance: false },
  { type: "notifications", multiInstance: false },
];

/** Map from type string to the React component to render. */
const WINDOW_COMPONENTS = {
  ideaBin:       IdeaBin,
  taskStructure: TaskStructure,
  schedule:      ScheduleWindow,
  calendar:      CalendarWindow,
  overview:      OverviewWindow,
  profile:       ProfileWindow,
  notifications: NotificationsWindow,
};

/** One instance per type at startup — matches the previous single-window behaviour. */
const DEFAULT_INSTANCES = WINDOW_DEFS.map(d => ({ id: d.type, type: d.type }));

export default function ProjectLayout() {
  const { projectId } = useParams();

  // ── Instance management ──
  const [instances, setInstances] = useState(DEFAULT_INSTANCES);

  const spawnInstance = useCallback((type) => {
    setInstances(prev => {
      const count = prev.filter(i => i.type === type).length;
      const newId = `${type}_${count + 1}`;
      return [...prev, { id: newId, type }];
    });
  }, []);

  const removeInstance = useCallback((id) => {
    setInstances(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <PipelineProvider>
      <div className="min-h-screen w-full bg-slate-900">
        {/* Page content */}
        <main className="relative w-full flex justify-center">
          <Outlet />
        </main>

        {/* WindowManager orchestrates ALL floating windows inside a project.
            InventoryBar is rendered automatically by WindowManager. */}
        <WindowManager
          windowDefs={WINDOW_DEFS}
          instances={instances}
          spawnInstance={spawnInstance}
          removeInstance={removeInstance}
        >
          {instances.map(inst => {
            const Comp = WINDOW_COMPONENTS[inst.type];
            return Comp ? <Comp key={inst.id} instanceId={inst.id} /> : null;
          })}
        </WindowManager>
      </div>
    </PipelineProvider>
  );
}
