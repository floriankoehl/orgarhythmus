/**
 * TeamDetailPanel — team detail view inside TaskStructure.
 * Adapted from pages/detail/TeamDetail.jsx for in-window use.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HexColorPicker } from "react-colorful";
import {
  Edit2, Save, X, Users, CheckCircle2, Loader2, Calendar,
  ChevronDown, ExternalLink,
} from "lucide-react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchSingleTeam, updateTeam, fetch_project_detail,
  fetchSingleTask, joinTeam, leaveTeam,
} from "../../api/org_API.js";

export default function TeamDetailPanel({ teamId, onViewTaskDetail }) {
  const { projectId } = useParams();
  const navigate = useNavigate(); // for attempt links
  const { user, isAuthenticated } = useAuth();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#facc15");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [project, setProject] = useState(null);
  const [viewMode, setViewMode] = useState("tasks");
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [taskDetails, setTaskDetails] = useState({});
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [projectId, teamId]);

  async function loadTeam() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSingleTeam(projectId, teamId);
      setTeam(data);
      setEditName(data.name || "");
      setEditColor(data.color || "#facc15");
      const proj = await fetch_project_detail(projectId);
      setProject(proj);
    } catch (err) {
      console.error(err);
      setError("Failed to load team details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      setError("Team name cannot be empty.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const updated = await updateTeam(projectId, teamId, {
        name: editName.trim(),
        color: editColor,
      });
      setTeam(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      setError("Failed to update team.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(team?.name || "");
    setEditColor(team?.color || "#facc15");
    setIsEditing(false);
    setShowColorPicker(false);
    setError(null);
  }

  const isMember = isAuthenticated && team?.members_data?.some((m) => m.id === user?.id);

  async function handleJoinTeam() {
    if (!projectId || !teamId) return;
    try {
      setJoining(true);
      const updated = await joinTeam(projectId, teamId);
      setTeam(updated);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to join team.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeaveTeam() {
    if (!projectId || !teamId) return;
    try {
      setLeaving(true);
      const updated = await leaveTeam(projectId, teamId);
      setTeam(updated);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to leave team.");
    } finally {
      setLeaving(false);
    }
  }

  async function toggleTaskExpanded(id) {
    setExpandedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (!taskDetails[id]) {
      try {
        const detail = await fetchSingleTask(projectId, id);
        setTaskDetails((prev) => ({ ...prev, [id]: detail }));
      } catch {
        setError("Failed to load task details");
      }
    }
  }

  const tasks = team?.tasks || [];

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">Loading team…</span>
        </div>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-4">
      {/* Success */}
      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2.5 text-green-700 flex-shrink-0">
          <CheckCircle2 size={16} />
          <span className="text-xs font-medium">Team updated!</span>
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
            /* VIEW MODE */
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg flex-shrink-0"
                style={{ backgroundColor: team?.color || "#64748b" }}
              >
                {team?.name?.[0]?.toUpperCase() || "T"}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-900 truncate">{team?.name}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: team?.color }}
                  />
                  <span className="font-mono text-xs text-slate-600">{team?.color}</span>
                </div>
              </div>
            </div>
          ) : (
            /* EDIT MODE */
            <div className="flex flex-1 flex-col gap-3">
              <TextField
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                label="Team Name"
                size="small"
                fullWidth
                inputProps={{ style: { fontSize: "13px" } }}
              />
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold text-slate-600">Team Color</span>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 cursor-pointer rounded-full border-2 border-slate-300 shadow"
                    style={{ backgroundColor: editColor }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  />
                  <span className="font-mono text-xs text-slate-600">{editColor}</span>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    style={{ textTransform: "none", fontSize: "11px" }}
                  >
                    {showColorPicker ? "Close" : "Pick Color"}
                  </Button>
                </div>
                {showColorPicker && (
                  <div className="mt-1 w-fit rounded-xl bg-slate-900 p-3 shadow-xl">
                    <HexColorPicker color={editColor} onChange={setEditColor} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {/* Join / Leave */}
            <div className="flex items-center gap-1.5">
              {!isMember && isAuthenticated && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={joining}
                  onClick={handleJoinTeam}
                  style={{ textTransform: "none", borderRadius: "8px", fontSize: "11px" }}
                >
                  {joining ? "Joining…" : "Join Team"}
                </Button>
              )}
              {isMember && (
                <Button
                  variant="outlined"
                  size="small"
                  disabled={leaving}
                  onClick={handleLeaveTeam}
                  style={{ textTransform: "none", borderRadius: "8px", fontSize: "11px" }}
                >
                  {leaving ? "Leaving…" : "Leave Team"}
                </Button>
              )}
            </div>
            {/* Edit / Save */}
            <div className="flex gap-1.5">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-blue-50 p-2.5 text-blue-600 transition-colors hover:bg-blue-100"
                  title="Edit team"
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
        </div>

        {/* Team stats */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <Users size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-slate-700">
              {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <span className="font-mono text-xs text-slate-700">ID: {team?.id}</span>
          </div>
        </div>

        {/* Members */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="mb-2 text-xs font-semibold text-slate-900">
            Members ({team?.members_data?.length || 0})
          </h3>
          {team?.members_data && team.members_data.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {team.members_data.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1"
                >
                  <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {member.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-blue-900">{member.username}</span>
                    {member.email && (
                      <span className="text-[10px] text-blue-700">{member.email}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 italic">No members yet</p>
          )}
        </div>
      </div>

      {/* View mode toggle */}
      <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-600">View:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setViewMode("steps")}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
                viewMode === "steps"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Steps
            </button>
            <button
              onClick={() => setViewMode("tasks")}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
                viewMode === "tasks"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Tasks
            </button>
          </div>
        </div>
      </div>

      {/* Steps view (empty — milestones used instead) */}
      {viewMode === "steps" && (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Calendar size={14} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Next Steps</h3>
              <p className="text-[10px] text-slate-600">Upcoming milestones for this team</p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-xs font-medium text-slate-700">No upcoming steps</p>
            <p className="text-[10px] text-slate-500">Manage milestones in the Dependencies view.</p>
          </div>
        </div>
      )}

      {/* Tasks view */}
      {viewMode === "tasks" && (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                All tasks assigned to this team
              </p>
            </div>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 bg-white">
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2"
                    onClick={() => toggleTaskExpanded(task.id)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <ChevronDown
                        size={16}
                        className={`flex-shrink-0 text-slate-400 transition-transform ${
                          expandedTaskIds.includes(task.id) ? "rotate-180" : ""
                        }`}
                      />
                      <h4 className="min-w-0 truncate text-xs font-semibold text-slate-900">
                        {task.name}
                      </h4>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {task.priority > 0 && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          P:{task.priority}
                        </span>
                      )}
                      {task.difficulty > 0 && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          D:{task.difficulty}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewTaskDetail(task.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        <ExternalLink size={12} /> View
                      </button>
                    </div>
                  </div>

                  {expandedTaskIds.includes(task.id) && (
                    <div className="border-t border-slate-200 bg-slate-50 p-3">
                      {taskDetails[task.id] ? (
                        <div className="space-y-1.5">
                          {taskDetails[task.id].description && (
                            <p className="text-xs text-slate-700">
                              {taskDetails[task.id].description}
                            </p>
                          )}
                          {taskDetails[task.id].assigned_members_data?.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Users size={12} className="text-slate-500" />
                              <span className="text-[10px] text-slate-600">
                                {taskDetails[task.id].assigned_members_data.map((m) => m.username).join(", ")}
                              </span>
                            </div>
                          )}
                          {!taskDetails[task.id].description &&
                            !taskDetails[task.id].assigned_members_data?.length && (
                              <p className="text-[10px] text-slate-500 italic">
                                No additional details
                              </p>
                            )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-slate-400" />
                          <span className="text-[10px] text-slate-500">Loading…</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Users size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-500">No tasks assigned to this team yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
