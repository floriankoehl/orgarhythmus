import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Save, X, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

import { fetchSingleTask, updateTask, fetchTeamsForProject } from "../../api/org_API";

export default function ProjectTaskDetail() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTeamId, setEditTeamId] = useState(null);
  const [editPriority, setEditPriority] = useState(0);
  const [editDifficulty, setEditDifficulty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, taskId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [taskData, teamsData] = await Promise.all([
        fetchSingleTask(projectId, taskId),
        fetchTeamsForProject(projectId),
      ]);
      
      setTask(taskData);
      setTeams(teamsData);
      setEditName(taskData.name || "");
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
        team_id: editTeamId,
        priority: editPriority,
        difficulty: editDifficulty,
      });

      setTask(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      
      // Hide success message after 2 seconds
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
    setEditTeamId(task?.team?.id || null);
    setEditPriority(task?.priority || 0);
    setEditDifficulty(task?.difficulty || 0);
    setIsEditing(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading task...</span>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks`)}
            style={{ marginTop: "1rem", textTransform: "none" }}
          >
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const currentTeam = task?.team;
  const teamColor = currentTeam?.color || "#64748b";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center px-4">
      <div className="w-full max-w-5xl py-8 flex flex-col gap-6">
        
        {/* Back Button */}
        <button
          onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks`)}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 hover:bg-white/100 text-slate-900 transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200 w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Tasks</span>
        </button>

        {/* Save Success Message */}
        {saveSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-green-700">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Task updated successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Header Section */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            
            {!isEditing ? (
              // VIEW MODE
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-3">
                  {task?.name}
                </h1>
                
                {currentTeam && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 w-fit">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: teamColor }}
                    />
                    <span className="text-sm font-medium text-slate-900">{currentTeam.name}</span>
                  </div>
                )}

                {!currentTeam && (
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 w-fit">
                    <span className="text-sm text-slate-500 italic">No team assigned</span>
                  </div>
                )}
              </div>
            ) : (
              // EDIT MODE
              <div className="flex-1 flex flex-col gap-4">
                <TextField
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  label="Task Name"
                  size="small"
                  fullWidth
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
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </div>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)}
                    label="Priority"
                    size="small"
                    inputProps={{ min: 0, max: 5 }}
                  />
                  <TextField
                    type="number"
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(parseInt(e.target.value) || 0)}
                    label="Difficulty"
                    size="small"
                    inputProps={{ min: 0, max: 5 }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Edit task"
                >
                  <Edit2 size={20} />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editName.trim()}
                    className="p-3 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save changes"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Task Stats */}
          {!isEditing && (
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase">Priority</span>
                <span className="text-sm font-bold text-slate-900">{task?.priority || 0}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase">Difficulty</span>
                <span className="text-sm font-bold text-slate-900">{task?.difficulty || 0}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-sm text-slate-700 font-mono">Task ID: {task?.id}</span>
              </div>
            </div>
          )}
        </header>

        {/* Task Details Section */}
        {task && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Task Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Priority Level</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          i <= (task?.priority || 0) ? "bg-orange-500" : "bg-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{task?.priority || 0}/5</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Difficulty Level</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          i <= (task?.difficulty || 0) ? "bg-purple-500" : "bg-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{task?.difficulty || 0}/5</span>
                </div>
              </div>
            </div>

            {currentTeam && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Assigned Team</p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 w-fit">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: teamColor }}
                  />
                  <span className="text-sm font-medium text-slate-900">{currentTeam.name}</span>
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}