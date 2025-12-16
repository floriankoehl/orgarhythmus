import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import { fetchSingleTask, updateTask, fetchTeamsForProject } from '../../api/org_API';

export default function ProjectTaskDetail() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
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
      setEditName(taskData.name || '');
      setEditTeamId(taskData.team?.id || null);
      setEditPriority(taskData.priority || 0);
      setEditDifficulty(taskData.difficulty || 0);
    } catch (err) {
      console.error(err);
      setError('Failed to load task details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) {
      setError('Task name cannot be empty.');
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
      setError('Failed to update task.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(task?.name || '');
    setEditTeamId(task?.team?.id || null);
    setEditPriority(task?.priority || 0);
    setEditDifficulty(task?.difficulty || 0);
    setIsEditing(false);
    setError(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading task...</span>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Button
            onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks`)}
            style={{ marginTop: '1rem', textTransform: 'none' }}
          >
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const currentTeam = task?.team;
  const teamColor = currentTeam?.color || '#64748b';

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks`)}
          className="group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 shadow-sm transition-all duration-200 hover:bg-white/100 hover:shadow-md"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Tasks</span>
        </button>

        {/* Save Success Message */}
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">Task updated successfully!</span>
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
              <div className="flex-1">
                <h1 className="mb-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  {task?.name}
                </h1>

                {currentTeam && (
                  <div
                    onClick={() =>
                      navigate(`/orgarhythmus/projects/${projectId}/teams/${currentTeam.id}`)
                    }
                    className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                  >
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: teamColor }} />
                    <span className="text-sm font-medium text-slate-900">{currentTeam.name}</span>
                    <span className="text-xs text-slate-400">→</span>
                  </div>
                )}

                {!currentTeam && (
                  <div className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-500 italic">No team assigned</span>
                  </div>
                )}
              </div>
            ) : (
              // EDIT MODE
              <div className="flex flex-1 flex-col gap-4">
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
                    value={editTeamId || ''}
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
                  className="rounded-lg bg-blue-50 p-3 text-blue-600 transition-colors hover:bg-blue-100"
                  title="Edit task"
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

          {/* Task Stats */}
          {!isEditing && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Priority</span>
                <span className="text-sm font-bold text-slate-900">{task?.priority || 0}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Difficulty</span>
                <span className="text-sm font-bold text-slate-900">{task?.difficulty || 0}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-mono text-sm text-slate-700">Task ID: {task?.id}</span>
              </div>
            </div>
          )}
        </header>

        {/* Task Details Section */}
        {task && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Task Details</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-xs font-semibold text-slate-600 uppercase">
                  Priority Level
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          i <= (task?.priority || 0) ? 'bg-orange-500' : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {task?.priority || 0}/5
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-xs font-semibold text-slate-600 uppercase">
                  Difficulty Level
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
                          i <= (task?.difficulty || 0) ? 'bg-purple-500' : 'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {task?.difficulty || 0}/5
                  </span>
                </div>
              </div>
            </div>

            {currentTeam && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase">Assigned Team</p>
                <div
                  onClick={() =>
                    navigate(`/orgarhythmus/projects/${projectId}/teams/${currentTeam.id}`)
                  }
                  className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                >
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: teamColor }} />
                  <span className="text-sm font-medium text-slate-900">{currentTeam.name}</span>
                  <span className="text-xs text-slate-400">→</span>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
