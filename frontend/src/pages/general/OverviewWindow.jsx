import { useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import useFloatingWindow from "../../components/shared/useFloatingWindow";
import OverviewTitleBar from "./OverviewTitleBar";
import OverviewContent from "./OverviewContent";

/**
 * OverviewWindow — floating, resizable, movable window for the project overview.
 *
 * Mirrors ScheduleWindow / CalendarWindow / TaskStructure pattern:
 *   collapsed  → small draggable icon
 *   expanded   → draggable + resizable floating window with title bar
 *   maximized  → near-fullscreen
 *
 * Shows: project name (editable), description, team count, task count,
 * dates (editable), members, context linking — same as old ProjectMain page.
 *
 * Mounted in ProjectLayout so it persists across all project sub-pages.
 * Automatically opens when the user navigates to the project index route.
 */

const MIN_CONTENT_H = 200;

export default function OverviewWindow() {
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
    defaultIcon: { x: 8, y: 216 }, // below CalendarWindow icon
    minSize: { w: 380, h: 320 },
  });

  // ── Auto-open when navigating to the project index route ──
  const prevPathRef = useRef(null);
  useEffect(() => {
    // Match /projects/:id  or  /projects/:id/
    const isIndexRoute =
      /\/projects\/[^/]+\/?$/.test(location.pathname);
    if (isIndexRoute && !isOpen) {
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
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-amber-400 to-orange-600 border-2 border-amber-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Overview"
        >
          <LayoutDashboard size={22} className="text-white drop-shadow" />
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-overview-window
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
          <OverviewTitleBar
            handleWindowDrag={handleWindowDrag}
            toggleMaximize={toggleMaximize}
            isMaximized={isMaximized}
            minimizeWindow={minimizeWindow}
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
              <OverviewContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
