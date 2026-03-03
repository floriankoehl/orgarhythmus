import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import useFloatingWindow from "../../components/shared/useFloatingWindow";
import CalendarTitleBar from "./CalendarTitleBar";
import CalendarContent from "./CalendarContent";

/**
 * CalendarWindow — floating, resizable, movable window for the project calendar.
 *
 * Mirrors ScheduleWindow / IdeaBin / TaskStructure pattern:
 *   collapsed  → small draggable icon
 *   expanded   → draggable + resizable floating window with title bar
 *   maximized  → near-fullscreen
 *
 * View modes: "auto" | "3d" | "7d" | "1m"
 *   - auto: switches between 3d / 7d / 1m based on window size
 *   - 3d / 7d: support horizontal ↔ vertical transpose
 *   - 1m: full month grid (exact replica of original Calendar page)
 *
 * Mounted in ProjectLayout so it persists across all project sub-pages.
 * Automatically opens when the user navigates to the /calender route.
 */

const MIN_CONTENT_H = 200;

export default function CalendarWindow() {
  const { projectId } = useParams();
  const location = useLocation();

  const {
    isOpen, setIsOpen,
    windowPos, setWindowPos,
    windowSize, setWindowSize,
    iconPos,
    isMaximized, setIsMaximized,
    zIndex, bringToFront,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag,
    handleWindowResize, handleEdgeResize,
    managed,
  } = useFloatingWindow({
    id: "calendar",
    openSound: "ideaOpen",
    closeSound: "ideaClose",
    minSize: { w: 360, h: 300 },
  });

  // ── View mode state ──
  const [viewMode, setViewMode] = useState("auto"); // "auto" | "3d" | "7d" | "1m"
  const [transposed, setTransposed] = useState(false);

  // ── Resolve effective view when mode is "auto" ──
  const effectiveView = (() => {
    if (viewMode !== "auto") return viewMode;
    const w = windowSize.w;
    if (w < 500) return "3d";
    if (w < 800) return "7d";
    return "1m";
  })();

  // ── Auto-open when navigating to the /calender route ──
  const prevPathRef = useRef(null);
  useEffect(() => {
    const isCalendarRoute = location.pathname.endsWith("/calender");
    if (isCalendarRoute && !isOpen) {
      setWindowPos({ x: 4, y: 60 });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - 68 });
      setIsMaximized(true);
      setIsOpen(true);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) return null;

  return (
    <>
      {/* ───── COLLAPSED: Floating icon (hidden when managed) ───── */}
      {!isOpen && !managed && (
        <div
          ref={iconRef}
          onMouseDown={handleIconDrag}
          style={{
            position: "fixed",
            left: iconPos.x,
            top: iconPos.y,
            zIndex: zIndex,
          }}
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-emerald-400 to-teal-600 border-2 border-emerald-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Calendar"
        >
          <CalendarIcon size={22} className="text-white drop-shadow" />
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-calendar-window
          onMouseDown={bringToFront}
          style={{
            position: "fixed",
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.w,
            height: windowSize.h,
            zIndex: zIndex,
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden select-none"
        >
          {/* ── Resize edges ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top")} className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom")} className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "left")} className="absolute left-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "right")} className="absolute right-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          {/* ── Resize corners ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top-left")} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "top-right")} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-left")} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-right")} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-20" />

          {/* ── Title bar ── */}
          <CalendarTitleBar
            handleWindowDrag={handleWindowDrag}
            toggleMaximize={toggleMaximize}
            isMaximized={isMaximized}
            minimizeWindow={minimizeWindow}
            viewMode={viewMode}
            setViewMode={setViewMode}
            effectiveView={effectiveView}
            transposed={transposed}
            setTransposed={setTransposed}
          />

          {/* ── Content area ── */}
          <div
            className="flex-1 min-h-0 overflow-auto"
            style={{ minWidth: 0 }}
          >
            <div
              style={{
                minHeight: `${MIN_CONTENT_H}px`,
                height: "100%",
              }}
            >
              <CalendarContent
                effectiveView={effectiveView}
                transposed={transposed}
                windowSize={windowSize}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
