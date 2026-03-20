import { useRef } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../auth/NotificationContext";
import useFloatingWindow from "./shared/useFloatingWindow";
import NotificationsTitleBar from "./NotificationsTitleBar";
import NotificationsContent from "./NotificationsContent";

/**
 * NotificationsWindow — floating, resizable, movable window for notifications.
 *
 * Mirrors the ProfileWindow / CalendarWindow pattern:
 *   collapsed  → small draggable icon (with unread badge)
 *   expanded   → draggable + resizable floating window with title bar
 *   maximized  → near-fullscreen
 *
 * Mounted in OrgaLayout so it persists across all pages.
 */

const MIN_CONTENT_H = 200;

export default function NotificationsWindow({ instanceId = "notifications" }) {
  const { unreadCount } = useNotifications();

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
    defaultIcon: { x: 8, y: 112 }, // fallback when outside a WindowManager
    minSize: { w: 360, h: 320 },
  });

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
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-500
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Notifications"
        >
          <Bell size={20} className="text-white drop-shadow" />

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 animate-bounce">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-notifications-window
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
          <NotificationsTitleBar
            handleWindowDrag={handleWindowDrag}
            toggleMaximize={toggleMaximize}
            isMaximized={isMaximized}
            minimizeWindow={minimizeWindow}
            unreadCount={unreadCount}
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
              <NotificationsContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
