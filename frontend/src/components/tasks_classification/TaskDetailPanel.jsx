/**
 * TaskDetailPanel — full task detail view inside TaskStructure.
 * Shows task info, acceptance criteria (interactive), milestones with todos (interactive),
 * team assignment, member assignment, and inline editing.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { emitDataEvent, useManualRefresh } from "../../api/dataEvents";
import {
  Edit2, Save, X, CheckCircle2, Loader2, Users, UserPlus,
  ChevronDown, ChevronRight, CheckSquare, Square, Flag, Target,
} from "lucide-react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchSingleTask, updateTask, fetchTeamsForProject,
  assignTaskMember, unassignTaskMember, fetch_project_detail,
  toggleCriterion, toggleTaskDone,
} from "../../api/org_API.js";
import { toggle_milestone_todo } from "../../api/dependencies_api.js";

/* ── Priority / difficulty dot display ── */
function DotRow({ value, max = 5, color }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${i < value ? color : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

/* ── Single acceptance criterion row ── */
function CriterionRow({ criterion, onToggle, toggling }) {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors
        ${criterion.done ? "bg-green-50 hover:bg-green-100" : "bg-slate-50 hover:bg-slate-100"}
        disabled:opacity-60`}
    >
      {toggling ? (
        <Loader2 size={15} className="mt-0.5 flex-shrink-0 animate-spin text-slate-400" />
      ) : criterion.done ? (
        <CheckSquare size={15} className="mt-0.5 flex-shrink-0 text-green-600" />
      ) : (
        <Square size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
      )}
      <span
        className={`text-xs leading-relaxed ${
          criterion.done ? "text-green-700 line-through decoration-green-400" : "text-slate-700"
        }`}
      >
        {criterion.title || criterion.description || "(untitled)"}
      </span>
    </button>
  );
}

/* ── Single milestone block ── */
function MilestoneBlock({ milestone, onToggleTodo, togglingTodoId }) {
  const [expanded, setExpanded] = useState(false);
  const todos = milestone.todos || [];
  const doneTodos = todos.filter((t) => t.done).length;
  const isDone = milestone.is_done || milestone.is_done_effective || (todos.length > 0 && doneTodos === todos.length);
  const progress = todos.length > 0 ? Math.round((doneTodos / todos.length) * 100) : 0;

  return (
    <div className={`rounded-lg border ${isDone ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-white"}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold leading-snug ${
                isDone ? "text-green-700" : "text-slate-800"
              }`}
            >
              {milestone.name}
            </span>
            {isDone && <CheckCircle2 size={12} className="flex-shrink-0 text-green-600" />}
          </div>
          {milestone.description && (
            <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">{milestone.description}</p>
          )}
        </div>
        {todos.length > 0 && (
          <div className="flex flex-shrink-0 items-center gap-1.5 ml-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 tabular-nums">{doneTodos}/{todos.length}</span>
          </div>
        )}
      </button>

      {/* Todos */}
      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          {todos.length === 0 ? (
            <p className="text-[10px] italic text-slate-400">No todos for this milestone.</p>
          ) : (
            <div className="space-y-1">
              {todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => onToggleTodo(milestone.id, todo.id)}
                  disabled={togglingTodoId === todo.id}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors
                    ${todo.done ? "text-green-700" : "text-slate-700"}
                    hover:bg-slate-100 disabled:opacity-60`}
                >
                  {togglingTodoId === todo.id ? (
                    <Loader2 size={13} className="flex-shrink-0 animate-spin text-slate-400" />
                  ) : todo.done ? (
                    <CheckSquare size={13} className="flex-shrink-0 text-green-600" />
                  ) : (
                    <Square size={13} className="flex-shrink-0 text-slate-400" />
                  )}
                  <span className={todo.done ? "line-through decoration-green-400" : ""}>
                    {todo.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export default function TaskDetailPanel({ taskId, onViewTeamDetail }) {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [teams, setTeams] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTeamId, setEditTeamId] = useState(null);
  const [editPriority, setEditPriority] = useState(0);
  const [editDifficulty, setEditDifficulty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Member assignment
  const [assigningMemberId, setAssigningMemberId] = useState(null);
  const [unassigningMemberId, setUnassigningMemberId] = useState(null);

  // Criteria toggle
  const [togglingCriterionId, setTogglingCriterionId] = useState(null);

  // Milestone todo toggle
  const [togglingTodoId, setTogglingTodoId] = useState(null);

  // Done toggle
  const [togglingDone, setTogglingDone] = useState(false);
  const [incompleteCriteria, setIncompleteCriteria] = useState(null); // { message, list }

  useEffect(() => {
    loadData();
  }, [projectId, taskId]);

  useManualRefresh(loadData);

  async function loadData() {
    if (!projectId || !taskId) return;
    try {
      setLoading(true);
      setError(null);
      const [taskData, teamsData, projectData] = await Promise.all([
        fetchSingleTask(projectId, taskId),
        fetchTeamsForProject(projectId),
        fetch_project_detail(projectId),
      ]);
      setTask(taskData);
      setTeams(teamsData);
      setProjectMembers(projectData.members_data || []);
      setEditName(taskData.name || "");
      setEditDescription(taskData.description || "");
      setEditTeamId(taskData.team?.id || null);
      setEditPriority(taskData.priority || 0);
      setEditDifficulty(taskData.difficulty || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load task details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      setError("Task name cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const updated = await updateTask(projectId, taskId, {
        name: editName.trim(),
        description: editDescription.trim(),
        team_id: editTeamId,
        priority: editPriority,
        difficulty: editDifficulty,
      });
      setTask((prev) => ({ ...prev, ...updated }));
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      emitDataEvent('tasks');
    } catch (err) {
      console.error(err);
      setError("Failed to update task.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(task?.name || "");
    setEditDescription(task?.description || "");
    setEditTeamId(task?.team?.id || null);
    setEditPriority(task?.priority || 0);
    setEditDifficulty(task?.difficulty || 0);
    setIsEditing(false);
    setError(null);
  }

  async function handleAssignMember(userId) {
    setAssigningMemberId(userId);
    try {
      const result = await assignTaskMember(projectId, taskId, userId);
      setTask((prev) => ({ ...prev, ...result.task }));
      setError(null);
      emitDataEvent('tasks');
    } catch (err) {
      setError(err.message || "Failed to assign member");
    } finally {
      setAssigningMemberId(null);
    }
  }

  async function handleUnassignMember(userId) {
    setUnassigningMemberId(userId);
    try {
      const result = await unassignTaskMember(projectId, taskId, userId);
      setTask((prev) => ({ ...prev, ...result.task }));
      setError(null);
      emitDataEvent('tasks');
    } catch (err) {
      setError(err.message || "Failed to unassign member");
    } finally {
      setUnassigningMemberId(null);
    }
  }

  async function handleToggleCriterion(criterionId) {
    setTogglingCriterionId(criterionId);
    try {
      const updated = await toggleCriterion(projectId, taskId, criterionId);
      // updated is the criterion object; update it in task state
      setTask((prev) => {
        const criteria = (prev.acceptance_criteria || []).map((c) =>
          c.id === criterionId ? updated : c,
        );
        const isDone = criteria.length > 0 && criteria.every((c) => c.done);
        return { ...prev, acceptance_criteria: criteria, is_done: isDone };
      });
      emitDataEvent('tasks');
    } catch (err) {
      setError(err.message || "Failed to toggle criterion");
    } finally {
      setTogglingCriterionId(null);
    }
  }

  async function handleToggleTodo(milestoneId, todoId) {
    setTogglingTodoId(todoId);
    try {
      const updatedMilestone = await toggle_milestone_todo(projectId, milestoneId, todoId);
      setTask((prev) => {
        const milestones = (prev.milestones || []).map((m) =>
          m.id === milestoneId ? { ...m, ...updatedMilestone } : m,
        );
        return { ...prev, milestones };
      });
      emitDataEvent('milestones');
    } catch (err) {
      setError(err.message || "Failed to toggle todo");
    } finally {
      setTogglingTodoId(null);
    }
  }

  async function handleToggleTaskDone() {
    if (!task) return;
    setIncompleteCriteria(null);
    setTogglingDone(true);
    try {
      const result = await toggleTaskDone(projectId, taskId);
      setTask((prev) => ({ ...prev, ...result }));
      emitDataEvent('tasks');
    } catch (err) {
      if (err.data?.incomplete_criteria) {
        setIncompleteCriteria(err.data.incomplete_criteria);
      } else {
        setError(err.message || "Failed to toggle task done");
      }
    } finally {
      setTogglingDone(false);
    }
  }

  async function handleForceCompleteDone() {
    setIncompleteCriteria(null);
    setTogglingDone(true);
    try {
      const result = await toggleTaskDone(projectId, taskId, { forceCompleteCriteria: true });
      setTask((prev) => ({ ...prev, ...result }));
      emitDataEvent('tasks');
    } catch (err) {
      setError(err.message || "Failed to complete task");
    } finally {
      setTogglingDone(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">Loading task…</span>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const currentTeam = task?.team;
  const teamColor = currentTeam?.color || "#64748b";
  const criteria = task?.acceptance_criteria || [];
  const milestones = task?.milestones || [];
  const criteriaDone = criteria.filter((c) => c.done).length;
  const isDone = task?.is_done;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-4">
      {/* Success */}
      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5 text-green-700 flex-shrink-0">
          <CheckCircle2 size={16} />
          <span className="text-xs font-medium">Task updated!</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Incomplete criteria warning */}
      {incompleteCriteria && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex-shrink-0">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">
            Some acceptance criteria are not yet done:
          </p>
          <ul className="mb-2.5 space-y-0.5">
            {incompleteCriteria.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 text-[11px] text-amber-700">
                <Square size={11} className="flex-shrink-0" />
                {c.title}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="contained"
              onClick={handleForceCompleteDone}
              style={{ textTransform: "none", fontSize: "11px", backgroundColor: "#d97706" }}
            >
              Mark all done &amp; complete task
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => setIncompleteCriteria(null)}
              style={{ textTransform: "none", fontSize: "11px" }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Header card ── */}
      <div className={`rounded-xl border p-4 shadow-sm ${isDone ? "border-green-200 bg-green-50/60" : "border-slate-200 bg-white/90"}`}>
        <div className="flex items-start justify-between gap-3">
          {!isEditing ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2.5">
                <h2 className={`text-lg font-semibold leading-snug ${isDone ? "text-green-800 line-through decoration-green-400" : "text-slate-900"}`}>
                  {task?.name}
                </h2>
                {isDone && <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-green-600" />}
              </div>

              {/* Team */}
              <div className="mt-2">
                {currentTeam ? (
                  <button
                    onClick={() => onViewTeamDetail(currentTeam.id)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
                    {currentTeam.name}
                    <span className="text-slate-400">→</span>
                  </button>
                ) : (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs italic text-slate-500">
                    No team assigned
                  </span>
                )}
              </div>

              {/* Priority / difficulty */}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Flag size={12} className="text-orange-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</span>
                  <DotRow value={task?.priority || 0} color="bg-orange-500" />
                </div>
                <div className="flex items-center gap-2">
                  <Target size={12} className="text-purple-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Difficulty</span>
                  <DotRow value={task?.difficulty || 0} color="bg-purple-500" />
                </div>
              </div>

              {/* Description */}
              {task?.description && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                    {task.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Edit form */
            <div className="flex flex-1 flex-col gap-3">
              <TextField
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                label="Task Name"
                size="small"
                fullWidth
                inputProps={{ style: { fontSize: "13px" } }}
              />
              <TextField
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                label="Description"
                size="small"
                fullWidth
                multiline
                rows={3}
                placeholder="Add a description…"
                inputProps={{ style: { fontSize: "13px" } }}
              />
              <FormControl fullWidth size="small">
                <InputLabel>Assign Team</InputLabel>
                <Select
                  value={editTeamId || ""}
                  onChange={(e) => setEditTeamId(e.target.value || null)}
                  label="Assign Team"
                >
                  <MenuItem value=""><em>No Team</em></MenuItem>
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </div>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  type="number"
                  value={editPriority}
                  onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)}
                  label="Priority (0–5)"
                  size="small"
                  inputProps={{ min: 0, max: 5, style: { fontSize: "13px" } }}
                />
                <TextField
                  type="number"
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(parseInt(e.target.value) || 0)}
                  label="Difficulty (0–5)"
                  size="small"
                  inputProps={{ min: 0, max: 5, style: { fontSize: "13px" } }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {/* Done toggle */}
            {!isEditing && (
              <button
                onClick={handleToggleTaskDone}
                disabled={togglingDone}
                title={isDone ? "Mark as not done" : "Mark as done"}
                className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${
                  isDone
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600"
                }`}
              >
                {togglingDone ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
              </button>
            )}
            {/* Edit / Save */}
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  className="rounded-lg bg-green-500 p-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                  title="Save"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Acceptance Criteria ── */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Acceptance Criteria</h3>
          </div>
          {criteria.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-500">
              {criteriaDone}/{criteria.length} done
            </span>
          )}
        </div>

        {criteria.length > 0 ? (
          <>
            {/* Progress bar */}
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${criteria.length > 0 ? (criteriaDone / criteria.length) * 100 : 0}%` }}
              />
            </div>
            <div className="space-y-1">
              {criteria.map((c) => (
                <CriterionRow
                  key={c.id}
                  criterion={c}
                  onToggle={() => handleToggleCriterion(c.id)}
                  toggling={togglingCriterionId === c.id}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs italic text-slate-400">No acceptance criteria defined. Add them via the canvas view.</p>
        )}
      </div>

      {/* ── Milestones ── */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Flag size={14} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Milestones</h3>
          {milestones.length > 0 && (
            <span className="text-[10px] text-slate-400">
              {milestones.filter((m) => m.is_done || m.is_done_effective).length}/{milestones.length} done
            </span>
          )}
        </div>

        {milestones.length > 0 ? (
          <div className="space-y-2">
            {milestones.map((ms) => (
              <MilestoneBlock
                key={ms.id}
                milestone={ms}
                onToggleTodo={handleToggleTodo}
                togglingTodoId={togglingTodoId}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-slate-400">No milestones yet. Create them in the Dependencies (Schedule) view.</p>
        )}
      </div>

      {/* ── Members ── */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users size={14} className="text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Members ({task?.assigned_members_data?.length || 0})
          </h3>
        </div>

        {task?.assigned_members_data && task.assigned_members_data.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {task.assigned_members_data.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {member.username?.[0]?.toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold text-blue-900">{member.username}</span>
                <button
                  onClick={() => handleUnassignMember(member.id)}
                  disabled={unassigningMemberId === member.id}
                  className="ml-0.5 rounded p-0.5 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  title="Unassign"
                >
                  {unassigningMemberId === member.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <X size={10} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {projectMembers.filter((m) => !task?.assigned_members_data?.some((am) => am.id === m.id)).length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assign</p>
            <div className="flex flex-wrap gap-1.5">
              {projectMembers
                .filter((m) => !task?.assigned_members_data?.some((am) => am.id === m.id))
                .map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssignMember(member.id)}
                    disabled={assigningMemberId === member.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {assigningMemberId === member.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UserPlus size={12} />
                    )}
                    {member.username}
                    {member.id === user?.id && <span className="text-slate-400">(you)</span>}
                  </button>
                ))}
            </div>
          </div>
        )}

        {projectMembers.length > 0 &&
          projectMembers.every((m) => task?.assigned_members_data?.some((am) => am.id === m.id)) && (
            <p className="text-[10px] italic text-slate-400 mt-1">All project members assigned</p>
          )}

        {projectMembers.length === 0 && (
          <p className="text-[10px] italic text-slate-400">No project members available</p>
        )}
      </div>
    </div>
  );
}
