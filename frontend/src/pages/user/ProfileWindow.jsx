import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UserCircle } from "lucide-react";
import useFloatingWindow from "../../components/shared/useFloatingWindow";
import ProfileTitleBar from "./ProfileTitleBar";
import ProfileContent from "./ProfileContent";

/**
 * ProfileWindow — floating, resizable, movable window for the user profile.
 *
 * Mirrors ScheduleWindow / CalendarWindow / OverviewWindow pattern:
 *   collapsed  → small draggable icon
 *   expanded   → draggable + resizable floating window with title bar
 *   maximized  → near-fullscreen
 *
 * Shows: user info, AI prompt settings, assigned tasks, teams, projects.
 *
 * Mounted in OrgaLayout so it persists across all pages.
 * Automatically opens when the user navigates to the /profile route.
 */

const MIN_CONTENT_H = 200;

export default function ProfileWindow({ instanceId = "profile" }) {
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
    id: instanceId,
    openSound: "ideaOpen",
    closeSound: "ideaClose",
    defaultIcon: { x: 8, y: 60 }, // fallback when outside a WindowManager
    minSize: { w: 400, h: 340 },
  });

  // ── Auto-open when navigating to /profile (primary instance only) ──
  const prevPathRef = useRef(null);
  useEffect(() => {
    const isProfileRoute = location.pathname === "/profile";
    if (isProfileRoute && !isOpen && instanceId === "profile") {
      setWindowPos({ x: 4, y: 60 });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - 68 });
      setIsMaximized(true);
      setIsOpen(true);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-cyan-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Profile"
        >
          <UserCircle size={22} className="text-white drop-shadow" />
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-profile-window
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
          <ProfileTitleBar
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
              <ProfileContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
