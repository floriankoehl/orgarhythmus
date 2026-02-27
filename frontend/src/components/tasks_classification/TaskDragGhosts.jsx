import { createPortal } from "react-dom";

/**
 * Drag ghost overlays — shown while dragging a task.
 * Similar to IdeaBinDragGhosts.
 */
export default function TaskDragGhosts({ dragging }) {
  if (!dragging) return null;

  const { task, x, y } = dragging;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: x - 20,
        top: y - 12,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      <div className="bg-white rounded shadow-lg border border-indigo-300 px-2 py-1 max-w-[200px] opacity-90">
        <div className="text-[10px] font-semibold text-gray-800 truncate">
          {task.name || "Untitled Task"}
        </div>
        {task.team?.name && (
          <div className="text-[9px] text-gray-400">{task.team.name}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
