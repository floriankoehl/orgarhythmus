/**
 * TaskDetailPanel — task detail view inside TaskStructure.
 * Adapted from pages/detail/TaskDetail.jsx for in-window use.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Edit2, Save, X, CheckCircle2, Loader2, Users, UserPlus,
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
} from "../../api/org_API.js";

export default function TaskDetailPanel({ taskId, onViewTeamDetail }) {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [teams, setTeams] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTeamId, setEditTeamId] = useState(null);
  const [editPriority, setEditPriority] = useState(0);
  const [editDifficulty, setEditDifficulty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [assigningMemberId, setAssigningMemberId] = useState(null);
  const [unassigningMemberId, setUnassigningMemberId] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId, taskId]);

  async function loadData() {
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
      setTask(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
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
      setTask(result.task);
      setError(null);
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
      setTask(result.task);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to unassign member");
    } finally {
      setUnassigningMemberId(null);
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

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          {!isEditing ? (
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{task?.name}</h2>
              {currentTeam && (
                <div
                  onClick={() => onViewTeamDetail(currentTeam.id)}
                  className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-all hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor }} />
                  <span className="text-xs font-medium text-slate-900">{currentTeam.name}</span>
                  <span className="text-[10px] text-slate-400">→</span>
                </div>
              )}
              {!currentTeam && (
                <div className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="text-xs text-slate-500 italic">No team assigned</span>
                </div>
              )}
            </div>
          ) : (
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
                  <MenuItem value="">
                    <em>No Team</em>
                  </MenuItem>
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
                  label="Priority"
                  size="small"
                  inputProps={{ min: 0, max: 5, style: { fontSize: "13px" } }}
                />
                <TextField
                  type="number"
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(parseInt(e.target.value) || 0)}
                  label="Difficulty"
                  size="small"
                  inputProps={{ min: 0, max: 5, style: { fontSize: "13px" } }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-1.5 flex-shrink-0">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-50 p-2.5 text-blue-600 transition-colors hover:bg-blue-100"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="rounded-lg bg-slate-100 p-2.5 text-slate-600 transition-colors hover:bg-slate-200"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  className="rounded-lg bg-green-500 p-2.5 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                  title="Save"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {!isEditing && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-600 uppercase">Priority</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i <= (task?.priority || 0) ? "bg-orange-500" : "bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-600 uppercase">Difficulty</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i <= (task?.difficulty || 0) ? "bg-purple-500" : "bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="font-mono text-[10px] text-slate-500">ID: {task?.id}</span>
          </div>
        )}

        {/* Description */}
        {!isEditing && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
            <div className="mb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Description
            </div>
            {task?.description ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                {task.description}
              </p>
            ) : (
              <p className="text-xs italic text-slate-500">No description provided</p>
            )}
          </div>
        )}

        {/* Assigned Members */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Users size={14} className="text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-900">
              Assigned Members ({task?.assigned_members_data?.length || 0})
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

          {projectMembers.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold text-slate-600 uppercase">
                Assign Members
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {projectMembers
                  .filter(
                    (member) =>
                      !task?.assigned_members_data?.some((am) => am.id === member.id),
                  )
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
                      <span>{member.username}</span>
                      {member.id === user?.id && (
                        <span className="text-slate-500">(you)</span>
                      )}
                    </button>
                  ))}
              </div>
              {projectMembers.every((member) =>
                task?.assigned_members_data?.some((am) => am.id === member.id),
              ) && (
                <p className="text-[10px] italic text-slate-500 mt-1">
                  All project members assigned
                </p>
              )}
            </div>
          )}

          {projectMembers.length === 0 && (
            <p className="text-[10px] italic text-slate-500">No project members available</p>
          )}
        </div>
      </div>

      {/* Milestones info */}
      {task && (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Milestones</h3>
          <p className="mt-1 text-xs text-slate-600">
            Manage milestones for this task in the Dependencies view.
          </p>
        </div>
      )}
    </div>
  );
}
