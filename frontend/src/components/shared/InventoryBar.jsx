import {
  Lightbulb,
  LayoutGrid,
  CalendarRange,
  Calendar,
  LayoutDashboard,
  UserCircle,
  Bell,
} from "lucide-react";
import { useWindowManager } from "./WindowManager";
import { usePipeline } from "./PipelineContext";
import { useNotifications } from "../../auth/NotificationContext";

/**
 * Inventory bar configuration for each window slot.
 * Order matches the PROJECT_WINDOWS config in ProjectLayout.
 */
const SLOT_CONFIG = {
  ideaBin:       { Icon: Lightbulb,        label: "Ideas",     gradient: "from-amber-400 to-yellow-500",   border: "border-amber-300" },
  profile:       { Icon: UserCircle,       label: "Profile",   gradient: "from-cyan-400 to-blue-600",      border: "border-cyan-300" },
  notifications: { Icon: Bell,             label: "Alerts",    gradient: "from-slate-700 to-slate-900",    border: "border-slate-500" },
  taskStructure: { Icon: LayoutGrid,       label: "Tasks",     gradient: "from-indigo-500 to-violet-600",  border: "border-indigo-300" },
  schedule:      { Icon: CalendarRange,    label: "Schedule",  gradient: "from-sky-400 to-blue-600",       border: "border-sky-300" },
  calendar:      { Icon: Calendar,         label: "Calendar",  gradient: "from-emerald-400 to-teal-600",   border: "border-emerald-300" },
  overview:      { Icon: LayoutDashboard,  label: "Overview",  gradient: "from-amber-400 to-orange-600",   border: "border-amber-300" },
};

/**
 * InventoryBar — a game-style hotbar at the bottom-center of the screen.
 *
 * Each window has a "slot". When the window is collapsed, the slot is
 * full-colour (icon snapped in). When the window is open, the slot appears
 * grayed-out (icon "pulled out"). Clicking a slot toggles the window.
 *
 * The pipeline-mode toggle is displayed at the right end, separated by
 * a divider.
 */
export default function InventoryBar() {
  const manager = useWindowManager();
  const pipeline = usePipeline();
  const { unreadCount } = useNotifications();

  if (!manager) return null;

  const { windowIds, openWindows, requestOpen, requestMinimize } = manager;

  return (
    <div
      style={{ zIndex: 99990 }}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5
        px-2.5 py-1.5 rounded-2xl
        bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl"
    >
      {windowIds.map((id) => {
        const config = SLOT_CONFIG[id];
        if (!config) return null;
        const { Icon, label, gradient } = config;
        const isOpen = openWindows.has(id);
        const hasNotifBadge = id === "notifications" && unreadCount > 0;

        return (
          <button
            key={id}
            onClick={() => (isOpen ? requestMinimize(id) : requestOpen(id))}
            className={`
              group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
              transition-all duration-200 outline-none
              ${
                isOpen
                  ? "opacity-35 hover:opacity-55"
                  : "opacity-90 hover:opacity-100 hover:scale-105"
              }
            `}
            title={isOpen ? `Minimize ${label}` : `Open ${label}`}
          >
            {/* Icon container */}
            <div
              className={`
                w-10 h-10 rounded-xl bg-gradient-to-br ${gradient}
                flex items-center justify-center shadow-lg
                transition-all duration-200
                ${isOpen ? "grayscale-[60%]" : "group-hover:shadow-xl"}
              `}
            >
              <Icon size={20} className="text-white drop-shadow" />
            </div>

            {/* Badge for notifications */}
            {hasNotifBadge && (
              <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow border border-slate-900">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}

            {/* Label */}
            <span
              className={`text-[9px] font-medium leading-none ${
                isOpen ? "text-slate-500" : "text-slate-300"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* ── Divider ── */}
      <div className="w-px h-10 bg-slate-700/50 mx-1 self-center" />

      {/* ── Pipeline toggle ── */}
      <button
        onClick={pipeline.toggle}
        className={`
          group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
          transition-all duration-200 outline-none
          ${pipeline.active ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"}
        `}
        title={
          pipeline.active
            ? "Pipeline mode ON — press P to toggle"
            : "Pipeline mode OFF — press P to toggle"
        }
      >
        <div
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
            transition-all duration-300
            ${
              pipeline.active
                ? "bg-gradient-to-br from-emerald-400 to-teal-500 ring-2 ring-emerald-300/40"
                : "bg-gradient-to-br from-gray-500 to-gray-600"
            }
          `}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow"
          >
            <path d="M5 9l4-4 4 4" />
            <path d="M9 5v8a4 4 0 0 0 4 4h2" />
            <path d="M19 15l-4 4-4-4" />
            <path d="M15 19v-8a4 4 0 0 0-4-4H9" />
          </svg>
        </div>
        <span
          className={`text-[9px] font-medium leading-none ${
            pipeline.active ? "text-emerald-300" : "text-slate-500"
          }`}
        >
          Pipeline
        </span>
      </button>
    </div>
  );
}
