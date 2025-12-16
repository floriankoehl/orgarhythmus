import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import { ArrowLeft, Edit2, Save, X, Users, CheckCircle2, Loader2 } from 'lucide-react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

import { fetchSingleTeam, updateTeam } from '../../api/org_API';

export default function ProjectTeamDetail() {
  const { projectId, teamId } = useParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#facc15');
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
      setEditName(data.name || '');
      setEditColor(data.color || '#facc15');
    } catch (err) {
      console.error(err);
      setError('Failed to load team details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      setError('Team name cannot be empty.');
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
      setError('Failed to update team.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(team?.name || '');
    setEditColor(team?.color || '#facc15');
    setIsEditing(false);
    setShowColorPicker(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading team...</span>
        </div>
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => navigate(`/orgarhythmus/projects/${projectId}/teams`)}
            style={{ marginTop: '1rem', textTransform: 'none' }}
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  const tasks = team?.tasks || [];

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/orgarhythmus/projects/${projectId}/teams`)}
          className="group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 shadow-sm transition-all duration-200 hover:bg-white/100 hover:shadow-md"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Teams</span>
        </button>

        {/* Save Success Message */}
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Team updated successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Header Section */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            {!isEditing ? (
              // VIEW MODE
              <div className="flex flex-1 items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg"
                  style={{ backgroundColor: team?.color || '#64748b' }}
                >
                  {team?.name?.[0]?.toUpperCase() || 'T'}
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                    {team?.name}
                  </h1>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: team?.color }}
                    />
                    <span className="font-mono text-sm text-slate-600">{team?.color}</span>
                  </div>
                </div>
              </div>
            ) : (
              // EDIT MODE
              <div className="flex flex-1 flex-col gap-4">
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
                      className="h-10 w-10 cursor-pointer rounded-full border-2 border-slate-300 shadow"
                      style={{ backgroundColor: editColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    <span className="font-mono text-sm text-slate-600">{editColor}</span>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      style={{ textTransform: 'none' }}
                    >
                      {showColorPicker ? 'Close Picker' : 'Pick Color'}
                    </Button>
                  </div>

                  {showColorPicker && (
                    <div className="mt-2 w-fit rounded-xl bg-slate-900 p-3 shadow-xl">
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
                  className="rounded-lg bg-blue-50 p-3 text-blue-600 transition-colors hover:bg-blue-100"
                  title="Edit team"
                >
                  <Edit2 size={20} />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="rounded-lg bg-slate-100 p-3 text-slate-600 transition-colors hover:bg-slate-200"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editName.trim()}
                    className="rounded-lg bg-green-500 p-3 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Save changes"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Team Stats */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Users size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-slate-700">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-mono text-sm text-slate-700">Team ID: {team?.id}</span>
            </div>
          </div>
        </header>

        {/* Tasks Section */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
              <p className="mt-1 text-xs text-slate-500">All tasks assigned to this team</p>
            </div>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks/${task.id}`)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-900">{task.name}</h3>
                      <div className="mt-2 flex items-center gap-2">
                        {task.priority && (
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            Priority: {task.priority}
                          </span>
                        )}
                        {task.difficulty && (
                          <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                            Difficulty: {task.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 transition-colors group-hover:text-blue-600">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Users size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No tasks assigned to this team yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
