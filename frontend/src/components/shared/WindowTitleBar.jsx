import { Minus, Maximize2, Minimize2 } from "lucide-react";

/**
 * Shared window title bar — provides drag handle, double-click-to-collapse,
 * and standardized window controls (collapse + full/partial toggle).
 *
 * Usage:
 *   <WindowTitleBar {...commonProps} className="bg-gradient-to-r from-...">
 *     <Icon /> <span>Title</span>
 *   </WindowTitleBar>
 *
 * For windows with content between the title and controls, children can
 * include that content; the flex-1 spacer pushes controls to the right.
 *
 * Pass `rightContent` for content between the spacer and window controls.
 * Pass `controls={false}` to render your own custom control buttons.
 *
 * @param {function} handleWindowDrag  onMouseDown handler for dragging
 * @param {function} minimizeWindow    collapse window to inventory bar
 * @param {function} toggleMaximize    toggle between full-screen and custom size
 * @param {boolean}  isMaximized       current maximize state
 * @param {string}   className         gradient / border classes (no py — standardized to py-1)
 * @param {object}   style             optional inline style (e.g. dynamic gradient)
 * @param {ReactNode} rightContent     optional content between spacer and controls
 * @param {boolean}  controls          render built-in collapse + toggle buttons (default true)
 * @param {ReactNode} children         left-side content (icon, title, tabs, etc.)
 */
export default function WindowTitleBar({
  handleWindowDrag,
  minimizeWindow,
  toggleMaximize,
  isMaximized,
  className = "",
  style,
  rightContent,
  controls = true,
  children,
}) {
  return (
    <div
      onMouseDown={handleWindowDrag}
      onDoubleClick={(e) => {
        e.preventDefault();
        minimizeWindow();
      }}
      className={`flex items-center gap-2 px-3 py-1 cursor-grab active:cursor-grabbing flex-shrink-0 select-none ${className}`}
      style={style}
    >
      {children}

      <div className="flex-1" />

      {rightContent}

      {controls && (
        <div
          className="flex items-center gap-0.5 flex-shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={minimizeWindow}
            className="p-0.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title="Collapse"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={toggleMaximize}
            className="p-0.5 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title={isMaximized ? "Restore size" : "Full screen"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
