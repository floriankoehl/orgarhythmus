import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HexColorPicker } from "react-colorful";
import { ArrowLeft, Edit2, Save, X, Users, CheckCircle2, Loader2 } from "lucide-react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import { fetchSingleTeam, updateTeam } from "../../api/org_API";

export default function ProjectTeamDetail() {
  const { projectId, teamId } = useParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#facc15");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      
      // Hide success message after 2 seconds
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

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading team...</span>
        </div>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => navigate(`/orgarhythmus/projects/${projectId}/teams`)}
            style={{ marginTop: "1rem", textTransform: "none" }}
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  const tasks = team?.tasks || [];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-5xl px-4 py-8 flex flex-col gap-6">
        
        {/* Back Button */}
        <button
          onClick={() => navigate(`/orgarhythmus/projects/${projectId}/teams`)}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 hover:bg-white/100 text-slate-900 transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200 w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Teams</span>
        </button>

        {/* Save Success Message */}
        {saveSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-green-700">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Team updated successfully!</span>
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
              <div className="flex-1 flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: team?.color || "#64748b" }}
                >
                  {team?.name?.[0]?.toUpperCase() || "T"}
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
                    {team?.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="h-4 w-4 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: team?.color }}
                    />
                    <span className="text-sm font-mono text-slate-600">{team?.color}</span>
                  </div>
                </div>
              </div>
            ) : (
              // EDIT MODE
              <div className="flex-1 flex flex-col gap-4">
                <TextField
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  label="Team Name"
                  size="small"
                  fullWidth
                />

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-600">Team Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full border-2 border-slate-300 shadow cursor-pointer"
                      style={{ backgroundColor: editColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    <span className="text-sm font-mono text-slate-600">{editColor}</span>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      style={{ textTransform: "none" }}
                    >
                      {showColorPicker ? "Close Picker" : "Pick Color"}
                    </Button>
                  </div>

                  {showColorPicker && (
                    <div className="mt-2 p-3 bg-slate-900 rounded-xl shadow-xl w-fit">
                      <HexColorPicker color={editColor} onChange={setEditColor} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Edit team"
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

          {/* Team Stats */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <Users size={16} className="text-blue-600" />
              <span className="text-sm text-slate-700 font-medium">
                {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-700 font-mono">Team ID: {team?.id}</span>
            </div>
          </div>
        </header>

        {/* Tasks Section */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
              <p className="text-xs text-slate-500 mt-1">
                All tasks assigned to this team
              </p>
            </div>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-900">{task.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {task.priority && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            Priority: {task.priority}
                          </span>
                        )}
                        {task.difficulty && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            Difficulty: {task.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Users size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tasks assigned to this team yet</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}