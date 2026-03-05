import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useWindowManager } from "./WindowManager";
import { usePipeline } from "./PipelineContext";
import { useNotifications } from "../../auth/NotificationContext";
import useWorkspace from "./useWorkspace";
import WorkspacePopup from "./WorkspacePopup";
import AISettingsPopup from "./AISettingsPopup";
import { triggerManualRefresh, useStaleData } from "../../api/dataEvents";

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
  const { projectId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState(new Set());

  const {
    workspaces,
    activeWorkspaceId,
    showPanel: showWorkspacePanel, setShowPanel: setShowWorkspacePanel,
    saveWorkspace, quickSave, overwriteWorkspace, renameWorkspace,
    loadWorkspace, removeWorkspace, toggleDefault: toggleWorkspaceDefault,
    nextWorkspace, prevWorkspace,
    wsFlashName,
  } = useWorkspace({ projectId });

  // ── AI settings popup state ──
  const [showAISettings, setShowAISettings] = useState(false);
  const staleData = useStaleData();

  if (!manager) return null;

  const { windowIds, openWindows, requestOpen, requestMinimize, allCollapsed, saveViews } = manager;

  /** Handle slot click — toggle selection; Ctrl+click adds to multi-select */
  const handleSlotClick = (id, e) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select toggle
      setSelectedSlots((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedSlots((prev) => {
        // Deselect if clicking the same single item
        if (prev.size === 1 && prev.has(id)) return new Set();
        return new Set([id]);
      });
    }
  };

  /** Deselect all when clicking the bar background */
  const handleBarBgClick = (e) => {
    // Only if the click target is the bar itself (not a child button)
    if (e.target === e.currentTarget) {
      setSelectedSlots(new Set());
    }
  };

  // ── Keyboard shortcuts: asdf = quick-save, Ctrl+Arrow = cycle workspaces ──
  const heldKeysRef = useRef(new Set());

  useEffect(() => {
    const onKeyDown = (e) => {
      // Skip when typing in inputs
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;

      // Track held keys for chord detection (asdf)
      heldKeysRef.current.add(e.key.toLowerCase());

      // Check asdf chord (all four held simultaneously)
      const held = heldKeysRef.current;
      if (held.has("a") && held.has("s") && held.has("d") && held.has("f")) {
        e.preventDefault();
        heldKeysRef.current.clear();
        quickSave();
        return;
      }

      // Check xy chord (both held simultaneously) → save views for selected slots
      if (held.has("x") && held.has("y")) {
        e.preventDefault();
        heldKeysRef.current.clear();
        setSelectedSlots((prev) => {
          if (prev.size > 0) saveViews([...prev]);
          return prev;
        });
        return;
      }

      // Ctrl + ArrowRight / ArrowLeft = cycle workspaces
      if (e.ctrlKey && e.key === "ArrowRight") {
        e.preventDefault();
        nextWorkspace();
        return;
      }
      if (e.ctrlKey && e.key === "ArrowLeft") {
        e.preventDefault();
        prevWorkspace();
        return;
      }
    };

    const onKeyUp = (e) => {
      heldKeysRef.current.delete(e.key.toLowerCase());
    };

    // Reset on blur to avoid stuck keys
    const onBlur = () => { heldKeysRef.current.clear(); };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [quickSave, nextWorkspace, prevWorkspace, saveViews]);

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
          bg-slate-700/80 backdrop-blur-xl border border-slate-500/40 shadow-lg
          hover:bg-slate-600 hover:scale-110 active:scale-95
          transition-all duration-200 cursor-pointer"
        title="Show inventory"
      >
        <ChevronUp size={12} className="text-slate-400" />
      </button>
    );
  }

  // ── Expanded: full inventory bar ──
  return (
    <>
    <div
      style={{ zIndex: 99990 }}
      onClick={handleBarBgClick}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5
        px-2 py-1.5 rounded-2xl
        bg-slate-700/90 backdrop-blur-xl border border-slate-500/50 shadow-2xl"
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
        const isSelected = selectedSlots.has(id);
        const hasNotifBadge = id === "notifications" && unreadCount > 0;

        return (
          <button
            key={id}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+click → toggle selection
                handleSlotClick(id, e);
              } else if (selectedSlots.size > 0) {
                // If anything is selected, plain click selects/deselects this slot
                handleSlotClick(id, e);
              } else {
                // Normal click → open/close
                isOpen ? requestMinimize(id) : requestOpen(id);
              }
            }}
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
                ${isSelected ? "ring-2 ring-white/80 ring-offset-1 ring-offset-slate-700" : ""}
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

      {/* ── Workspace toggle ── */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => setShowWorkspacePanel((v) => !v)}
          className={`
            group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
            transition-all duration-200 outline-none
            ${showWorkspacePanel ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"}
          `}
          title="Workspaces"
        >
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
              transition-all duration-300
              ${
                showWorkspacePanel
                  ? "bg-gradient-to-br from-violet-400 to-purple-600 ring-2 ring-violet-300/40"
                  : "bg-gradient-to-br from-gray-500 to-gray-600"
              }
            `}
          >
            <Layers size={20} className="text-white drop-shadow" />
          </div>
          <span
            className={`text-[9px] font-medium leading-none ${
              showWorkspacePanel ? "text-violet-300" : "text-slate-500"
            }`}
          >
            Spaces
          </span>
        </button>

        {/* Popup */}
        {showWorkspacePanel && (
          <WorkspacePopup
            workspaces={workspaces}
            activeId={activeWorkspaceId}
            onSave={saveWorkspace}
            onLoad={loadWorkspace}
            onOverwrite={overwriteWorkspace}
            onRename={renameWorkspace}
            onDelete={removeWorkspace}
            onToggleDefault={toggleWorkspaceDefault}
            onClose={() => setShowWorkspacePanel(false)}
          />
        )}
      </div>

      {/* ── AI Settings toggle ── */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => setShowAISettings((v) => !v)}
          className={`
            group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
            transition-all duration-200 outline-none
            ${showAISettings ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"}
          `}
          title="AI Prompt Settings"
        >
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
              transition-all duration-300
              ${
                showAISettings
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-amber-300/40"
                  : "bg-gradient-to-br from-gray-500 to-gray-600"
              }
            `}
          >
            <Sparkles size={20} className="text-white drop-shadow" />
          </div>
          <span
            className={`text-[9px] font-medium leading-none ${
              showAISettings ? "text-amber-300" : "text-slate-500"
            }`}
          >
            AI
          </span>
        </button>

        {/* Popup */}
        {showAISettings && (
          <AISettingsPopup onClose={() => setShowAISettings(false)} />
        )}
      </div>

      {/* ── Refresh button ── */}
      <button
        onClick={triggerManualRefresh}
        className={`
          group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
          transition-all duration-200 outline-none
          ${staleData ? "opacity-100" : "opacity-35 hover:opacity-55"}
        `}
        title="Refresh all windows"
      >
        <div
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
            transition-all duration-300
            ${staleData
              ? "bg-gradient-to-br from-green-400 to-emerald-600 ring-2 ring-green-300/50"
              : "bg-gradient-to-br from-gray-500 to-gray-600"
            }
          `}
        >
          <RefreshCw
            size={20}
            className={`text-white drop-shadow ${staleData ? "animate-spin" : ""}`}
            style={staleData ? { animationDuration: "2s" } : undefined}
          />
        </div>
        <span
          className={`text-[9px] font-medium leading-none ${
            staleData ? "text-green-300" : "text-slate-500"
          }`}
        >
          Refresh
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

    {/* ── "xy to save" hint when slots are selected ── */}
    {selectedSlots.size > 0 && (
      <div
        style={{ zIndex: 99991 }}
        className="fixed bottom-[72px] left-1/2 -translate-x-1/2
          px-3 py-1 rounded-lg bg-black/70 backdrop-blur-sm
          text-[10px] text-slate-300 font-medium tracking-wide
          pointer-events-none select-none
          animate-pulse"
      >
        press <span className="text-white font-bold">x + y</span> to save view
        {selectedSlots.size > 1 && ` (${selectedSlots.size} selected)`}
      </div>
    )}

    {/* ── Workspace name flash overlay ── */}
    {wsFlashName && (
      <div
        key={wsFlashName.key}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99999,
          pointerEvents: "none",
          animation: "viewFlashFade 1.2s ease-out forwards",
        }}
        className="px-8 py-4 rounded-2xl bg-black/60 backdrop-blur-sm text-white text-2xl font-bold tracking-wide shadow-2xl"
      >
        {wsFlashName.name}
      </div>
    )}
    </>
  );
}
