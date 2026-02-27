import { useState } from "react";
import { ChevronDown, ChevronUp, Palette, Plus, Trash2, Pencil, Filter } from "lucide-react";

/**
 * Legend panel at the bottom of the Task Structure sidebar.
 *
 * Mirrors IdeaBin's IdeaBinLegendPanel: legend selector, types display, filter controls.
 *
 * NOTE: The backend does not yet support project-scoped legends for tasks.
 * This component is prepared for that integration. Currently shows a
 * placeholder with a note about upcoming legend support.
 *
 * Future: Will use a `useTaskLegends` hook once the backend
 * TaskLegendType model + API endpoints are created.
 */
export default function TaskLegendPanel({
  collapsed,
  setCollapsed,
}) {
  return (
    <div className="border-t border-gray-200 flex-shrink-0">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      >
        <Palette size={10} />
        Legends
        <span className="ml-auto">
          {collapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-2 py-2">
          <div className="text-[10px] text-gray-400 italic text-center py-3">
            Legend classification for tasks coming soon.
            <br />
            <span className="text-[9px]">
              Will mirror the IdeaBin legend system with per-task type assignment.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
