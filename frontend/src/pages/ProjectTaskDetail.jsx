import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
} from 'lucide-react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import {
  fetchSingleTask,
  updateTask,
  fetchTeamsForProject,
  toggle_attempt_todo,
  createAttempt,
  deleteAttempt,
} from '../api/org_API.js';

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
  const [expandedAttemptIds, setExpandedAttemptIds] = useState([]);

  // Attempt create/delete
  const [creatingAttempt, setCreatingAttempt] = useState(false);
  const [deletingAttemptId, setDeletingAttemptId] = useState(null);

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

  function toggleAttemptExpanded(attemptId) {
    setExpandedAttemptIds((prev) =>
      prev.includes(attemptId) ? prev.filter((id) => id !== attemptId) : [...prev, attemptId],
    );
  }

  async function handleCreateAttempt() {
    if (!task) return;
    setCreatingAttempt(true);
    try {
      const newAttempt = await createAttempt(projectId, task.id);
      setTask((prev) => ({
        ...prev,
        attempts: [...(prev.attempts || []), newAttempt],
      }));
    } catch (err) {
      setError('Failed to create attempt');
    } finally {
      setCreatingAttempt(false);
    }
  }

  async function handleDeleteAttempt(attemptId) {
    const confirmed = window.confirm("This can't be undone");
    if (!confirmed) return;
    setDeletingAttemptId(attemptId);
    try {
      await deleteAttempt(projectId, attemptId);
      setTask((prev) => ({
        ...prev,
        attempts: (prev.attempts || []).filter((a) => a.id !== attemptId),
      }));
    } catch (err) {
      setError('Failed to delete attempt');
    } finally {
      setDeletingAttemptId(null);
    }
  }

  async function handleToggleAttemptTodo(attemptId, todoId) {
    try {
      const res = await toggle_attempt_todo(projectId, attemptId, todoId);
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          attempts: (prev.attempts || []).map((a) => {
            if (a.id !== attemptId) return a;
            return {
              ...a,
              done: res.attempt_done,
              todos: (a.todos || []).map((t) => (t.id === todoId ? { ...t, done: res.done } : t)),
            };
          }),
        };
      });
    } catch (err) {
      setError('Failed to toggle todo');
    }
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
  const attempts = (task?.attempts || [])
    .slice()
    .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));

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

          {/* Task Stats with Circle Indicators */}
          {!isEditing && (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              {/* Priority Circles */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Priority</span>
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
              </div>

              {/* Difficulty Circles */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase">Difficulty</span>
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
              </div>

              {/* Task ID */}
              <div className="font-mono text-xs text-slate-500">ID: {task?.id}</div>
            </div>
          )}
        </header>

        {/* Attempts for this Task */}
        {task && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Attempts</h2>
                <p className="mt-1 text-xs text-slate-600">
                  {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} linked to this task
                </p>
              </div>
              <button
                onClick={handleCreateAttempt}
                disabled={creatingAttempt}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingAttempt ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add Attempt
              </button>
            </div>

            {attempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">No attempts yet</p>
                <p className="text-xs text-slate-500">Create an attempt to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="rounded-lg border border-slate-200 bg-white transition-colors"
                  >
                    {/* Attempt Header */}
                    <div
                      onClick={() => {
                        toggleAttemptExpanded(attempt.id);
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-4 px-3 py-1 transition-colors ${
                        attempt.done
                          ? 'bg-emerald-50 hover:bg-emerald-100'
                          : 'bg-white hover:bg-amber-50'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <ChevronDown
                          size={18}
                          className={`flex-shrink-0 text-slate-400 transition-transform ${
                            expandedAttemptIds.includes(attempt.id) ? 'rotate-180' : ''
                          }`}
                        />
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="flex-1 truncate text-sm font-semibold text-slate-900">
                            {attempt.name || 'Untitled attempt'}
                          </p>

                          {attempt.scheduled_date && (
                            <p className="flex-shrink-0 text-xs text-slate-600">
                              Scheduled:{' '}
                              {new Date(attempt.scheduled_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-3">
                        {typeof attempt.number === 'number' && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            #{attempt.number}
                          </span>
                        )}
                        <div
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                            attempt.done ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                          }`}
                        >
                          <span>{attempt.done ? '✓ Done' : '⏳ In Progress'}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttempt(attempt.id);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          title="Delete attempt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Todos Section */}
                    {expandedAttemptIds.includes(attempt.id) && attempt.todos && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        {attempt.todos.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No todos for this attempt</p>
                        ) : (
                          <div className="space-y-2">
                            {attempt.todos.map((todo) => (
                              <div
                                key={todo.id}
                                className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={todo.done || false}
                                  onChange={() => handleToggleAttemptTodo(attempt.id, todo.id)}
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300"
                                />
                                <span
                                  className={`flex-1 ${
                                    todo.done ? 'text-slate-400 line-through' : 'text-slate-700'
                                  }`}
                                >
                                  {todo.text}
                                </span>
                                {todo.created_at && (
                                  <span className="text-xs text-slate-400">
                                    {new Date(todo.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Link to Attempt Detail */}
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2">
                      <button
                        onClick={() =>
                          navigate(`/orgarhythmus/projects/${projectId}/attempts/${attempt.id}`)
                        }
                        className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                      >
                        View full attempt details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
