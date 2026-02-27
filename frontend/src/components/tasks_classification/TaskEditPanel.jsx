import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronUp, CheckSquare, Milestone as MilestoneIcon, Save } from "lucide-react";

/**
 * Task editing / creation panel — shown in the left sidebar, replacing the task list.
 *
 * Supports both creating new tasks (`isNew = true`) and editing existing ones.
 * Save via Enter (in text fields) or the Save button. Escape closes.
 */
export default function TaskEditPanel({
  task,           // task object for edit mode; null for creation
  isNew = false,  // true when creating a new task
  teams,
  teamOrder,
  onUpdate,       // (taskId, payload) for edit mode
  onCreate,       // (payload) => Promise<task> for creation mode
  onClose,
  milestones,
}) {
  const [name, setName] = useState(task?.name || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "");
  const [difficulty, setDifficulty] = useState(task?.difficulty || "");
  const [teamId, setTeamId] = useState(task?.team?.id || task?.team || "");
  const [criteria, setCriteria] = useState(() => {
    try { return JSON.parse(task?.asking || "[]"); }
    catch { return task?.asking ? [task.asking] : []; }
  });
  const [newCriterion, setNewCriterion] = useState("");
  const [showMilestones, setShowMilestones] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  // Focus + select name on open
  useEffect(() => {
    setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 50);
  }, [task?.id, isNew]);

  // Sync local state when switching between tasks
  useEffect(() => {
    setName(task?.name || "");
    setDescription(task?.description || "");
    setPriority(task?.priority || "");
    setDifficulty(task?.difficulty || "");
    setTeamId(task?.team?.id || task?.team || "");
    try { setCriteria(JSON.parse(task?.asking || "[]")); }
    catch { setCriteria(task?.asking ? [task.asking] : []); }
  }, [task?.id]);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) { nameRef.current?.focus(); return; }
    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim(),
        priority,
        difficulty,
        team_id: teamId || null,
        asking: JSON.stringify(criteria),
      };
      if (isNew) {
        await onCreate?.(payload);
      } else if (task) {
        await onUpdate?.(task.id, payload);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save task:", err);
    }
    setSaving(false);
  }, [name, description, priority, difficulty, teamId, criteria, isNew, task, onCreate, onUpdate, onClose, saving]);

  // ── Keyboard: Enter = save, Escape = close ──
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      // Allow Enter in textarea for newlines
      if (e.target.tagName === "TEXTAREA") return;
      // Allow Enter in criterion input to add criterion (handled by its own handler)
      if (e.target.dataset?.criterionInput) return;
      e.preventDefault();
      handleSave();
    }
  }, [onClose, handleSave]);

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria((prev) => [...prev, newCriterion.trim()]);
    setNewCriterion("");
  };

  const removeCriterion = (idx) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const priorityOptions = ["", "low", "medium", "high"];
  const difficultyOptions = ["", "easy", "medium", "hard"];

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 flex-shrink-0">
        <span className="text-[11px] font-semibold text-gray-700">
          {isNew ? "New Task" : "Edit Task"}
        </span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Name */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase">Name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name…"
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description…"
            className="w-full text-[10px] border border-gray-200 rounded px-2 py-1 mt-0.5 resize-none focus:outline-none focus:border-indigo-300"
          />
        </div>

        {/* Team */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase">Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value ? parseInt(e.target.value, 10) : "")}
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
          >
            <option value="">Unassigned</option>
            {teamOrder.map((tid) => {
              const t = teams[tid];
              if (!t) return null;
              return <option key={tid} value={tid}>{t.name || "Unnamed"}</option>;
            })}
          </select>
        </div>

        {/* Priority + Difficulty side by side */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[9px] font-medium text-gray-500 uppercase">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
            >
              {priorityOptions.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-medium text-gray-500 uppercase">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
            >
              {difficultyOptions.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
            </select>
          </div>
        </div>

        {/* Acceptance Criteria */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase flex items-center gap-1">
            <CheckSquare size={9} /> Acceptance Criteria
          </label>
          <div className="mt-1 space-y-0.5">
            {criteria.map((c, i) => (
              <div key={i} className="flex items-start gap-1 group">
                <span className="text-[10px] text-gray-400 mt-0.5">•</span>
                <span className="text-[10px] text-gray-700 flex-1">{c}</span>
                <button
                  onClick={() => removeCriterion(i)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <input
              data-criterion-input="true"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); addCriterion(); } }}
              placeholder="Add criterion…"
              className="flex-1 text-[10px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-300"
            />
            <button onClick={addCriterion} className="text-indigo-500 hover:text-indigo-700 p-0.5">
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Milestones */}
        <div>
          <button
            onClick={() => setShowMilestones((p) => !p)}
            className="flex items-center gap-1 text-[9px] font-medium text-gray-500 uppercase hover:text-gray-700"
          >
            <MilestoneIcon size={9} />
            Milestones ({milestones?.length || 0})
            {showMilestones ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
          {showMilestones && (
            <div className="mt-1 space-y-1">
              {(!milestones || milestones.length === 0) && (
                <div className="text-[10px] text-gray-400 italic">No milestones</div>
              )}
              {milestones?.map((m) => (
                <div key={m.id} className="bg-gray-50 rounded p-1.5 border border-gray-100">
                  <div className="text-[10px] font-medium text-gray-700">{m.name}</div>
                  {m.description && (
                    <div className="text-[9px] text-gray-500 mt-0.5">{m.description}</div>
                  )}
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    Day {m.start_index} · {m.duration} day{m.duration !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save / Cancel footer */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 font-medium transition-colors"
        >
          <Save size={10} />
          {isNew ? "Create" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="text-[10px] px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium transition-colors"
        >
          Cancel
        </button>
        <span className="text-[9px] text-gray-400 ml-auto">↵ save</span>
      </div>
    </div>
  );
}
