import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Send } from "lucide-react";

/**
 * Always-visible inline task creation form (like IdeaBin's input form).
 *
 * By default the form is expanded showing title + description.
 * Users can collapse it via the header toggle.
 * Minimal workflow: type a description → Enter → task created.
 * Height is controlled externally and resizable via a drag handle.
 */
export default function TaskQuickAdd({
  onCreate,           // (payload) => Promise<task>
  defaultTeamId,      // auto-assign team when a single team is selected
  teams,
  collapsed,          // controlled collapse state
  setCollapsed,       // (bool) => void
  formHeight,         // controlled height (px)
}) {
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const descRef = useRef(null);

  // Focus description when form is expanded
  useEffect(() => {
    if (!collapsed) {
      setTimeout(() => descRef.current?.focus(), 80);
    }
  }, [collapsed]);

  const canSubmit = description.trim() || title.trim();

  const handleSubmit = useCallback(async () => {
    if (saving || !canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        name: title.trim() || "",
        description: description.trim(),
        team_id: defaultTeamId || null,
      };
      const task = await onCreate(payload);
      if (task) {
        setDescription("");
        setTitle("");
        // Re-focus for rapid entry
        setTimeout(() => descRef.current?.focus(), 50);
      }
    } finally {
      setSaving(false);
    }
  }, [saving, canSubmit, title, description, defaultTeamId, onCreate]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const teamName =
    defaultTeamId && teams?.[defaultTeamId]
      ? teams[defaultTeamId].name
      : null;
  const teamColor =
    defaultTeamId && teams?.[defaultTeamId]
      ? teams[defaultTeamId].color || "#6366f1"
      : null;

  return (
    <div
      className="flex-shrink-0 bg-gray-50/80 flex flex-col"
      style={{ height: collapsed ? undefined : formHeight, overflow: "hidden" }}
    >
      {/* ── Header / toggle ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <Plus size={10} className="text-gray-400" />
        Quick&nbsp;Add&nbsp;Task
      </button>

      {/* ── Form body ── */}
      {!collapsed && (
        <div
          className="px-2 pb-1.5 pt-0.5 flex flex-col gap-1 flex-1 min-h-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Auto-assign indicator */}
          {teamName && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0"
              style={{
                backgroundColor: `color-mix(in srgb, ${teamColor} 10%, white)`,
                color: teamColor,
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: teamColor }}
              />
              <span className="truncate">→ {teamName}</span>
            </div>
          )}

          {/* Title input — always visible */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task title (optional)…"
            className="text-[11px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-300 bg-white flex-shrink-0"
          />

          {/* Description — primary input, fills remaining space */}
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what needs to be done…"
            className="text-[11px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-300 bg-white resize-none flex-1 min-h-[32px]"
          />

          {/* Submit row + hint */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="text-[9px] text-gray-400 leading-tight">
              Enter to add · Shift+Enter for new line
            </div>
            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                <Send size={10} />
                {saving ? "Adding…" : "Add Task"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
