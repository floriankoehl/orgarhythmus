import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lightbulb,
  LayoutGrid,
  CalendarRange,
  Calendar,
  LayoutDashboard,
  UserCircle,
  Bell,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
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
 * Features:
 * ─ Leave-project button on the far left
 * ─ Window slots with open/close toggle
 * ─ Pipeline-mode toggle on the far right
 * ─ Collapse/expand: collapses to a tiny pill; expands back on click
 */
export default function InventoryBar() {
  const manager = useWindowManager();
  const pipeline = usePipeline();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  if (!manager) return null;

  const { windowIds, openWindows, requestOpen, requestMinimize, allCollapsed } = manager;

  // When exiting orbit mode (a window opens), always show the bar expanded
  useEffect(() => {
    if (!allCollapsed) setCollapsed(false);
  }, [allCollapsed]);

  // ── Auto-hide when orbit mode is active (all windows collapsed) ──
  if (allCollapsed) return null;

  // ── Collapsed: tiny pill button to re-expand ──
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{ zIndex: 99990 }}
        className="fixed bottom-2 left-1/2 -translate-x-1/2
          flex items-center justify-center
          w-10 h-5 rounded-full
          bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 shadow-lg
          hover:bg-slate-800 hover:scale-110 active:scale-95
          transition-all duration-200 cursor-pointer"
        title="Show inventory"
      >
        <ChevronUp size={12} className="text-slate-400" />
      </button>
    );
  }

  // ── Expanded: full inventory bar ──
  return (
    <div
      style={{ zIndex: 99990 }}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5
        px-2 py-1.5 rounded-2xl
        bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl"
    >
      {/* ── Leave project ── */}
      <button
        onClick={() => navigate('/')}
        className="group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
          transition-all duration-200 outline-none opacity-80 hover:opacity-100 hover:scale-105"
        title="Leave project"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-700
          flex items-center justify-center shadow-lg transition-all duration-200
          group-hover:shadow-xl"
        >
          <ArrowLeft size={20} className="text-white drop-shadow" />
        </div>
        <span className="text-[9px] font-medium leading-none text-slate-300">Leave</span>
      </button>

      {/* ── Divider ── */}
      <div className="w-px h-10 bg-slate-700/50 mx-1 self-center" />

      {/* ── Window slots ── */}
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

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(true)}
        className="self-center ml-0.5 p-1 rounded-lg
          text-slate-500 hover:text-slate-300 hover:bg-slate-800/60
          transition-all duration-150 cursor-pointer"
        title="Hide inventory"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
