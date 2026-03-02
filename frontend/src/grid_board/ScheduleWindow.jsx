import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import useFloatingWindow from "../components/shared/useFloatingWindow";
import MilestoneScheduleAdapter from "./MilestoneScheduleAdapter";
import ScheduleTitleBar from "./ScheduleTitleBar";

/**
 * ScheduleWindow — floating, resizable, movable window for the dependency schedule.
 *
 * Mirrors IdeaBin / TaskStructure pattern:
 *   collapsed  → small draggable icon
 *   expanded   → draggable + resizable floating window with title bar
 *   maximized  → near-fullscreen (identical to old full-page layout)
 *
 * When the content is smaller than MIN_CONTENT_W / MIN_CONTENT_H the inner
 * container scrolls instead of squishing (the grid is designed for wide screens).
 *
 * Mounted in ProjectLayout so it persists across all project sub-pages.
 * Automatically opens when the user navigates to the /dependencies route.
 */

const MIN_CONTENT_H = 200;

export default function ScheduleWindow() {
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
  } = useFloatingWindow({
    openSound: "ideaOpen",
    closeSound: "ideaClose",
    defaultIcon: { x: 8, y: 112 }, // below TaskStructure icon
    minSize: { w: 480, h: 360 },
  });

  // ── Auto-open when navigating to the /dependencies route ──
  const prevPathRef = useRef(null);
  useEffect(() => {
    const isDepsRoute = location.pathname.endsWith("/dependencies");
    if (isDepsRoute && !isOpen) {
      // Open maximized so it looks exactly like the old full-page layout
      setWindowPos({ x: 4, y: 60 });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - 68 });
      setIsMaximized(true);
      setIsOpen(true);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── View bar: DependencyGrid populates this ref, counter triggers re-render ──
  const viewBarRef = useRef({});
  const [, setViewBarTick] = useState(0);
  const triggerViewBarRender = useCallback(() => setViewBarTick(v => v + 1), []);

  // Don't render window contents when no project is selected
  if (!projectId) return null;

  return (
    <>
      {/* ───── COLLAPSED: Floating icon ───── */}
      {!isOpen && (
        <div
          ref={iconRef}
          onMouseDown={handleIconDrag}
          style={{
            position: "fixed",
            left: iconPos.x,
            top: iconPos.y,
            zIndex: zIndex,
          }}
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-sky-400 to-blue-600 border-2 border-sky-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Schedule"
        >
          <CalendarRange size={22} className="text-white drop-shadow" />
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-schedule-window
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

          {/* ── Title bar (drag handle, window controls) ── */}
          <ScheduleTitleBar
            handleWindowDrag={handleWindowDrag}
            toggleMaximize={toggleMaximize}
            isMaximized={isMaximized}
            minimizeWindow={minimizeWindow}
            viewBar={viewBarRef.current}
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
              <MilestoneScheduleAdapter
                isFloating
                windowPos={windowPos}
                windowSize={windowSize}
                setWindowPos={setWindowPos}
                setWindowSize={setWindowSize}
                isMaximized={isMaximized}
                setIsMaximized={setIsMaximized}
                viewBarRef={viewBarRef}
                triggerViewBarRender={triggerViewBarRender}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
