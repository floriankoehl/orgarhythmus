import { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronUp, CheckSquare, Milestone as MilestoneIcon } from "lucide-react";

/**
 * Task editing side-panel / inline panel.
 *
 * Covers SRS §4: team assignment, priority, difficulty, status,
 * acceptance criteria, and milestone visibility.
 *
 * Acceptance criteria: ordered bullet list of plain text entries (§4.1).
 * Milestones: display only, non-scheduling attributes editable (§4.2).
 */
export default function TaskEditPanel({
  task,
  teams,
  teamOrder,
  onUpdate,
  onClose,
  milestones,  // [ { id, name, description, start_index, duration } ]
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
  const nameRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, [task?.id]);

  // Auto-save on any field change (debounced)
  const scheduleAutoSave = (overrides = {}) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = {
        name: overrides.name ?? name,
        description: overrides.description ?? description,
        priority: overrides.priority ?? priority,
        difficulty: overrides.difficulty ?? difficulty,
        team_id: overrides.teamId !== undefined ? (overrides.teamId || null) : (teamId || null),
        asking: JSON.stringify(overrides.criteria ?? criteria),
      };
      onUpdate(task.id, payload);
    }, 500);
  };

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    const next = [...criteria, newCriterion.trim()];
    setCriteria(next);
    setNewCriterion("");
    scheduleAutoSave({ criteria: next });
  };

  const removeCriterion = (idx) => {
    const next = criteria.filter((_, i) => i !== idx);
    setCriteria(next);
    scheduleAutoSave({ criteria: next });
  };

  const priorityOptions = ["", "low", "medium", "high"];
  const difficultyOptions = ["", "easy", "medium", "hard"];

  if (!task) return null;

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white w-[280px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 flex-shrink-0">
        <span className="text-[11px] font-semibold text-gray-700">Edit Task</span>
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
            onChange={(e) => { setName(e.target.value); scheduleAutoSave({ name: e.target.value }); }}
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase">Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); scheduleAutoSave({ description: e.target.value }); }}
            rows={3}
            className="w-full text-[10px] border border-gray-200 rounded px-2 py-1 mt-0.5 resize-none focus:outline-none focus:border-indigo-300"
          />
        </div>

        {/* Team */}
        <div>
          <label className="text-[9px] font-medium text-gray-500 uppercase">Team</label>
          <select
            value={teamId}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : "";
              setTeamId(val);
              scheduleAutoSave({ teamId: val });
            }}
            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
          >
            <option value="">Unassigned</option>
            {teamOrder.map((tid) => {
              const t = teams[tid];
              if (!t) return null;
              return (
                <option key={tid} value={tid}>
                  {t.name || "Unnamed"}
                </option>
              );
            })}
          </select>
        </div>

        {/* Priority + Difficulty side by side */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[9px] font-medium text-gray-500 uppercase">Priority</label>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value); scheduleAutoSave({ priority: e.target.value }); }}
              className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>{p || "—"}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-medium text-gray-500 uppercase">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => { setDifficulty(e.target.value); scheduleAutoSave({ difficulty: e.target.value }); }}
              className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 mt-0.5 focus:outline-none focus:border-indigo-300"
            >
              {difficultyOptions.map((d) => (
                <option key={d} value={d}>{d || "—"}</option>
              ))}
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
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCriterion(); }}
              placeholder="Add criterion…"
              className="flex-1 text-[10px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-300"
            />
            <button
              onClick={addCriterion}
              className="text-indigo-500 hover:text-indigo-700 p-0.5"
            >
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
    </div>
  );
}
