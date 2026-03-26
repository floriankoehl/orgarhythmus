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
  Settings,
  Plus,
  X,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useWindowManager } from "./WindowManager";
import { usePipeline } from "./PipelineContext";
import { useNotifications } from "../../auth/NotificationContext";
import { useBranch } from "../../auth/BranchContext";
import useWorkspace from "./useWorkspace";
import WorkspacePopup from "./WorkspacePopup";
import AISettingsPopup from "./AISettingsPopup";
import GlobalSettingsPopup from "./GlobalSettingsPopup";
import BranchSwitcher from "./BranchSwitcher";
import { triggerManualRefresh, useStaleData, useAutoRefreshSetting } from "../../api/dataEvents";
import { indexToShortDisplay, metricStepLabel } from "../../utils/projectMetric";

/**
 * Inventory bar configuration for each window slot (keyed by type).
 * Order matches the WINDOW_DEFS config in ProjectLayout.
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
 * ─ Window slots with open/close toggle; multi-instance popup on hover
 * ─ Pipeline-mode toggle on the far right
 * ─ Collapse/expand: collapses to a tiny pill; expands back on click
 */
export default function InventoryBar() {
  const manager = useWindowManager();
  const pipeline = usePipeline();
  const { unreadCount } = useNotifications();
  const {
    isDemoMode,
    demoIndex,
    projectMetric,
    projectStartDate,
    enterDemoMode,
    exitDemoMode,
    stepDemoIndex,
  } = useBranch();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [demoLoading, setDemoLoading] = useState(false);

  // Which slot type has its instance popup open
  const [hoveredType, setHoveredType] = useState(null);

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
  const autoRefresh = useAutoRefreshSetting();

  // ── Global settings popup state ──
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

  if (!manager) return null;

  const {
    windowIds, windowDefs, instances,
    openWindows, requestOpen, requestMinimize, requestFocus,
    spawnInstance, removeInstance,
    allCollapsed, saveViews,
  } = manager;

  /** Handle slot click — toggle selection; Ctrl+click adds to multi-select */
  const handleSlotClick = (type, e) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedSlots((prev) => {
        const next = new Set(prev);
        if (next.has(type)) next.delete(type); else next.add(type);
        return next;
      });
    } else {
      setSelectedSlots((prev) => {
        if (prev.size === 1 && prev.has(type)) return new Set();
        return new Set([type]);
      });
    }
  };

  /** Deselect all when clicking the bar background */
  const handleBarBgClick = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedSlots(new Set());
    }
  };

  // ── Keyboard shortcuts: asdf = quick-save, Ctrl+Arrow = cycle workspaces ──
  const heldKeysRef = useRef(new Set());

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;

      heldKeysRef.current.add(e.key.toLowerCase());

      const held = heldKeysRef.current;
      if (held.has("a") && held.has("s") && held.has("d") && held.has("f")) {
        e.preventDefault();
        heldKeysRef.current.clear();
        quickSave();
        return;
      }

      if (held.has("x") && held.has("y")) {
        e.preventDefault();
        heldKeysRef.current.clear();
        setSelectedSlots((prev) => {
          if (prev.size > 0) {
            // Expand selected types to all their instance IDs
            const instIds = [...prev].flatMap(type =>
              instances.filter(i => i.type === type).map(i => i.id)
            );
            if (instIds.length > 0) saveViews(instIds);
          }
          return prev;
        });
        return;
      }

      if (e.ctrlKey && e.key === "ArrowRight") { e.preventDefault(); nextWorkspace(); return; }
      if (e.ctrlKey && e.key === "ArrowLeft")  { e.preventDefault(); prevWorkspace(); return; }
    };

    const onKeyUp = (e) => { heldKeysRef.current.delete(e.key.toLowerCase()); };
    const onBlur  = () => { heldKeysRef.current.clear(); };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [quickSave, nextWorkspace, prevWorkspace, saveViews, instances]);

  // When exiting orbit mode (a window opens), always show the bar expanded
  useEffect(() => {
    if (!allCollapsed) setCollapsed(false);
  }, [allCollapsed]);

  // ── Auto-hide when orbit mode is active ──
  if (allCollapsed) return null;

  // ── Collapsed: tiny pill button ──
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
      {windowIds.map((type) => {
        const config = SLOT_CONFIG[type];
        if (!config) return null;
        const def = windowDefs.find(d => d.type === type);
        const { Icon, label, gradient } = config;

        // All instances of this type
        const typeInstances = instances.filter(i => i.type === type);
        const anyOpen = typeInstances.some(i => openWindows.has(i.id));
        const isSelected = selectedSlots.has(type);
        const hasNotifBadge = type === "notifications" && unreadCount > 0;
        const multiInstance = def?.multiInstance ?? false;
        const showPopup = hoveredType === type;

        return (
          <div
            key={type}
            className="relative"
            onMouseEnter={() => setHoveredType(type)}
            onMouseLeave={() => setHoveredType(null)}
          >
            {/* ── Instance popup (shown on hover) ── */}
            {showPopup && (typeInstances.length > 0 || multiInstance) && (
              <>
                {/* Transparent bridge: fills the visual gap between button and popup
                    so onMouseLeave doesn't fire when the cursor crosses that gap. */}
                <div className="absolute bottom-full left-0 right-0 h-3 z-10" />
              <div
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2
                  bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-600/60
                  p-1.5 min-w-[150px] z-10"
                onMouseDown={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1.5 pb-1 border-b border-slate-700/60 mb-1">
                  {label}
                </div>

                {/* Instance list */}
                {typeInstances.map((inst, idx) => {
                  const instOpen = openWindows.has(inst.id);
                  const instLabel = idx === 0 ? label : `${label} ${idx + 1}`;
                  const isFirst = idx === 0;

                  return (
                    <div key={inst.id} className="flex items-center gap-0.5 group/row">
                      <button
                        onClick={() => {
                          if (instOpen) {
                            requestFocus(inst.id);
                          } else {
                            requestOpen(inst.id);
                          }
                          setHoveredType(null);
                        }}
                        className={`flex-1 flex items-center gap-2 px-1.5 py-1 rounded-lg text-[10px] transition-colors
                          ${instOpen
                            ? 'text-white hover:bg-slate-700/60'
                            : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                          }`}
                      >
                        {/* Open/closed dot */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors
                          ${instOpen ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'bg-slate-600'}`}
                        />
                        <span className="truncate max-w-[100px]">{instLabel}</span>
                      </button>

                      {/* Remove button — always shown for non-first, hidden for first unless there are others */}
                      {(!isFirst || typeInstances.length > 1) && (
                        <button
                          onClick={() => {
                            removeInstance(inst.id);
                            setHoveredType(null);
                          }}
                          className="opacity-0 group-hover/row:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center
                            rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/60 transition-all text-[11px]"
                          title={`Close ${instLabel}`}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Spawn new instance button */}
                {multiInstance && (
                  <button
                    onClick={() => {
                      spawnInstance(type);
                      setHoveredType(null);
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg
                      text-[10px] text-slate-400 hover:text-white hover:bg-slate-700/60
                      transition-colors border-t border-slate-700/60 pt-1.5"
                  >
                    <Plus size={10} />
                    <span>New {label}</span>
                  </button>
                )}
              </div>
              </>
            )}

            {/* ── Slot button ── */}
            <button
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleSlotClick(type, e);
                  return;
                }
                if (selectedSlots.size > 0) {
                  handleSlotClick(type, e);
                  return;
                }
                // Normal click: toggle single instance or open popup for multi
                if (typeInstances.length === 0) {
                  spawnInstance(type);
                } else if (typeInstances.length === 1) {
                  const inst = typeInstances[0];
                  openWindows.has(inst.id) ? requestMinimize(inst.id) : requestOpen(inst.id);
                } else {
                  // 2+ instances: toggle popup visibility on click
                  setHoveredType(prev => prev === type ? null : type);
                }
              }}
              className={`
                group/slot relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
                transition-all duration-200 outline-none
                ${anyOpen
                  ? "opacity-35 hover:opacity-55"
                  : "opacity-90 hover:opacity-100 hover:scale-105"
                }
              `}
              title={anyOpen ? `Minimize ${label}` : `Open ${label}`}
            >
              {/* Icon container */}
              <div
                className={`
                  w-10 h-10 rounded-xl bg-gradient-to-br ${gradient}
                  flex items-center justify-center shadow-lg
                  transition-all duration-200
                  ${anyOpen ? "grayscale-[60%]" : "group-hover/slot:shadow-xl"}
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
              <span className={`text-[9px] font-medium leading-none ${anyOpen ? "text-slate-500" : "text-slate-300"}`}>
                {label}
              </span>

              {/* Instance count dots (only when 2+ instances) */}
              {typeInstances.length > 1 && (
                <div className="flex gap-0.5 justify-center -mt-0.5">
                  {typeInstances.slice(0, 5).map(inst => (
                    <div
                      key={inst.id}
                      className={`w-1 h-1 rounded-full transition-colors
                        ${openWindows.has(inst.id) ? 'bg-white/70' : 'bg-white/20'}`}
                    />
                  ))}
                  {typeInstances.length > 5 && (
                    <span className="text-[7px] text-slate-400 leading-none self-center">+{typeInstances.length - 5}</span>
                  )}
                </div>
              )}
            </button>
          </div>
        );
      })}

      {/* ── Divider ── */}
      <div className="w-px h-10 bg-slate-700/50 mx-1 self-center" />

      {/* ── Branch switcher ── */}
      <BranchSwitcher />

      {/* ── Divider ── */}
      <div className="w-px h-10 bg-slate-700/50 mx-1 self-center" />

      {/* ── Demo Mode ── */}
      {isDemoMode ? (
        /* ── In demo mode: nav controls ── */
        <div className="flex flex-col items-center gap-0.5 px-1 py-1.5">
          <div className="flex items-center gap-0.5">
            {/* Step back */}
            <button
              onClick={() => stepDemoIndex(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg
                text-amber-300 hover:text-white hover:bg-amber-500/30
                transition-all duration-150"
              title={`Back one ${metricStepLabel(projectMetric)}`}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Current index display */}
            <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40
              text-amber-200 text-[10px] font-semibold tabular-nums whitespace-nowrap min-w-[60px] text-center">
              {demoIndex !== null
                ? indexToShortDisplay(demoIndex, projectMetric, projectStartDate)
                : "—"}
            </div>

            {/* Step forward */}
            <button
              onClick={() => stepDemoIndex(+1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg
                text-amber-300 hover:text-white hover:bg-amber-500/30
                transition-all duration-150"
              title={`Forward one ${metricStepLabel(projectMetric)}`}
            >
              <ChevronRight size={14} />
            </button>

            {/* Exit demo mode */}
            <button
              onClick={exitDemoMode}
              className="w-7 h-7 flex items-center justify-center rounded-lg
                text-slate-400 hover:text-rose-400 hover:bg-rose-500/20
                transition-all duration-150"
              title="Exit demo mode (branch is kept)"
            >
              <LogOut size={12} />
            </button>
          </div>
          <span className="text-[8px] font-medium leading-none text-amber-400 tracking-wide">
            DEMO
          </span>
        </div>
      ) : (
        /* ── Not in demo mode: enter button ── */
        <button
          onClick={async () => {
            setDemoLoading(true);
            try { await enterDemoMode(); } finally { setDemoLoading(false); }
          }}
          disabled={demoLoading}
          className="group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
            transition-all duration-200 outline-none opacity-50 hover:opacity-80"
          title="Enter demo mode — creates a new branch to test your schedule"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600
            flex items-center justify-center shadow-lg transition-all duration-200
            group-hover:shadow-xl">
            {demoLoading
              ? <RefreshCw size={18} className="text-white animate-spin" />
              : <FlaskConical size={18} className="text-white drop-shadow" />
            }
          </div>
          <span className="text-[9px] font-medium leading-none text-slate-500">Demo</span>
        </button>
      )}

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

        {showAISettings && (
          <AISettingsPopup onClose={() => setShowAISettings(false)} />
        )}
      </div>

      {/* ── Refresh button (only in manual mode) ── */}
      {!autoRefresh && (
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
      )}

      {/* ── Global settings toggle ── */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => setShowGlobalSettings((v) => !v)}
          className={`
            group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
            transition-all duration-200 outline-none
            ${showGlobalSettings ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"}
          `}
          title="Settings"
        >
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
              transition-all duration-300
              ${showGlobalSettings
                ? "bg-gradient-to-br from-slate-400 to-slate-600 ring-2 ring-slate-300/40"
                : "bg-gradient-to-br from-gray-500 to-gray-600"
              }
            `}
          >
            <Settings size={20} className="text-white drop-shadow" />
          </div>
          <span
            className={`text-[9px] font-medium leading-none ${
              showGlobalSettings ? "text-slate-300" : "text-slate-500"
            }`}
          >
            Settings
          </span>
        </button>
        {showGlobalSettings && (
          <GlobalSettingsPopup onClose={() => setShowGlobalSettings(false)} />
        )}
      </div>

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
