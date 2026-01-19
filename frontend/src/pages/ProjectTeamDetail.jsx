import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Users,
  CheckCircle2,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

import {
  fetchSingleTeam,
  updateTeam,
  fetch_all_attempts,
  fetch_project_detail,
  fetchSingleTask,
  fetchAttemptDetail,
  toggleAttemptTodo,
} from '../api/org_API.js';

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
  // Next steps
  const [project, setProject] = useState(null);
  const [nextSteps, setNextSteps] = useState([]);
  const [viewMode, setViewMode] = useState('steps');
  const [viewDays, setViewDays] = useState(14);
  const [showEmptyDays, setShowEmptyDays] = useState(false);
  // Expansions & details
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [taskDetails, setTaskDetails] = useState({}); // taskId -> task detail with attempts
  const [expandedAttemptIds, setExpandedAttemptIds] = useState([]);
  const [attemptDetails, setAttemptDetails] = useState({}); // attemptId -> attempt detail with todos

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
      // Load project and next steps for this team
      const proj = await fetch_project_detail(projectId);
      setProject(proj);
      const allAttempts = await fetch_all_attempts();
      const teamAttempts = (allAttempts || []).filter((a) => a.task?.team?.id === Number(teamId));
      const sorted = teamAttempts.slice().sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
      setNextSteps(sorted);
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
            onClick={() => navigate(`/projects/${projectId}/teams`)}
            style={{ marginTop: '1rem', textTransform: 'none' }}
          >
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  const tasks = team?.tasks || [];

  function formatScheduledDate(slotIndex) {
    const start = project?.start_date ? new Date(project.start_date) : null;
    if (!start || !slotIndex) return null;
    const d = new Date(start.getTime() + (slotIndex - 1) * 24 * 60 * 60 * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function getScheduledDate(slotIndex) {
    const start = project?.start_date ? new Date(project.start_date) : null;
    if (!start || !slotIndex) return null;
    return new Date(start.getTime() + (slotIndex - 1) * 24 * 60 * 60 * 1000);
  }

  const scheduledAll = nextSteps
    .filter((a) => project?.start_date && Number.isInteger(a.slot_index) && a.slot_index > 0)
    .sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Filter scheduled steps based on viewDays
  const getFilteredScheduledSteps = () => {
    if (viewDays === Infinity) {
      return scheduledAll; // Show ALL
    }
    return scheduledAll.filter((a) => {
      const d = getScheduledDate(a.slot_index);
      if (!d) return false;
      const diff = Math.floor((d.getTime() - today.getTime()) / msPerDay);
      return diff >= 0 && diff <= viewDays;
    });
  };

  const scheduledSteps = getFilteredScheduledSteps();

  // Group attempts by date
  const groupAttemptsByDate = () => {
    const groups = {};
    scheduledSteps.forEach((attempt) => {
      const d = getScheduledDate(attempt.slot_index);
      if (d) {
        const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(attempt);
      }
    });
    return groups;
  };

  // Get all dates in range (for showing empty days)
  const getAllDatesInRange = () => {
    const dates = [];
    let current = new Date(today);
    const endDate =
      viewDays === Infinity
        ? new Date(scheduledAll[scheduledAll.length - 1]?.scheduled_date || today)
        : new Date(today.getTime() + viewDays * msPerDay);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const attemptsByDate = groupAttemptsByDate();
  const allDates = getAllDatesInRange();
  const displayDates = showEmptyDays
    ? allDates
    : Object.keys(attemptsByDate).map((d) => new Date(d));

  const unscheduledSteps = nextSteps.filter(
    (a) => !project?.start_date || !Number.isInteger(a.slot_index) || a.slot_index <= 0,
  );

  async function toggleTaskExpanded(id) {
    setExpandedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (!taskDetails[id]) {
      try {
        const detail = await fetchSingleTask(projectId, id);
        setTaskDetails((prev) => ({ ...prev, [id]: detail }));
      } catch (e) {
        setError('Failed to load task attempts');
      }
    }
  }

  async function toggleAttemptExpanded(attemptId) {
    setExpandedAttemptIds((prev) =>
      prev.includes(attemptId) ? prev.filter((x) => x !== attemptId) : [...prev, attemptId],
    );
    if (!attemptDetails[attemptId]) {
      try {
        const detail = await fetchAttemptDetail(projectId, attemptId);
        setAttemptDetails((prev) => ({ ...prev, [attemptId]: detail }));
      } catch (e) {
        setError('Failed to load attempt todos');
      }
    }
  }

  async function handleToggleTodo(attemptId, todoId) {
    try {
      const res = await toggleAttemptTodo(projectId, attemptId, todoId);

      // Update attempt details
      setAttemptDetails((prev) => ({
        ...prev,
        [attemptId]: {
          ...prev[attemptId],
          done: res.attempt_done,
          todos: (prev[attemptId]?.todos || []).map((t) =>
            t.id === todoId ? { ...t, done: res.done } : t,
          ),
        },
      }));

      // Update nextSteps (for Steps view)
      setNextSteps((prev) =>
        prev.map((attempt) =>
          attempt.id === attemptId ? { ...attempt, done: res.attempt_done } : attempt,
        ),
      );

      // Update taskDetails (for Tasks view)
      setTaskDetails((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((taskId) => {
          if (updated[taskId].attempts) {
            updated[taskId] = {
              ...updated[taskId],
              attempts: updated[taskId].attempts.map((attempt) =>
                attempt.id === attemptId ? { ...attempt, done: res.attempt_done } : attempt,
              ),
            };
          }
        });
        return updated;
      });
    } catch (e) {
      setError('Failed to toggle todo');
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/projects/${projectId}/teams`)}
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

        {/* View Mode Toggle */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">View:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setViewMode('steps')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'steps'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Steps
              </button>
              <button
                onClick={() => setViewMode('tasks')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  viewMode === 'tasks'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tasks
              </button>
            </div>
          </div>
        </section>

        {viewMode === 'steps' && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Calendar size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Next Steps</h2>
                  <p className="mt-1 text-xs text-slate-600">Upcoming attempts for this team</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Next</span>
                <select
                  value={viewDays === Infinity ? 'all' : viewDays}
                  onChange={(e) =>
                    setViewDays(
                      e.target.value === 'all' ? Infinity : parseInt(e.target.value) || 14,
                    )
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-300"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value="all">ALL</option>
                </select>
                <button
                  onClick={() => setShowEmptyDays(!showEmptyDays)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    showEmptyDays
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  title={showEmptyDays ? 'Hide empty days' : 'Show empty days'}
                >
                  {showEmptyDays ? 'Hide Empty' : 'Show Empty'}
                </button>
              </div>
            </div>

            {scheduledSteps.length === 0 && unscheduledSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">No upcoming attempts</p>
                <p className="text-xs text-slate-500">Create tasks and schedule attempts.</p>
              </div>
            ) : (
              <>
                {/* List View - Date first, then name */}
                {displayDates.length > 0 && (
                  <div className="space-y-3">
                    {displayDates.map((date) => {
                      const dateKey = date.toISOString().split('T')[0];
                      const attemptsOnDate = attemptsByDate[dateKey] || [];
                      const hasAttempts = attemptsOnDate.length > 0;
                      const isToday = dateKey === today.toISOString().split('T')[0];

                      if (!hasAttempts && !showEmptyDays) {
                        return null;
                      }

                      return (
                        <div key={dateKey}>
                          {/* Attempts for this date - Date and name on same row */}
                          {hasAttempts ? (
                            <div className="space-y-2">
                              {attemptsOnDate.map((attempt) => (
                                <div
                                  key={attempt.id}
                                  className="group flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 transition hover:border-blue-300 hover:bg-blue-50"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div
                                      className={`flex min-w-fit items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold flex-shrink-0 ${
                                        isToday
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      <Calendar size={12} />
                                      {date.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </div>
                                    <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                                      {attempt.task?.name} — {attempt.name || 'Attempt'} #
                                      {attempt.slot_index ?? attempt.number ?? '—'}
                                    </h3>
                                  </div>
                                  <button
                                    onClick={() =>
                                      navigate(
                                        `/projects/${projectId}/attempts/${attempt.id}`,
                                      )
                                    }
                                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                                  >
                                    <ExternalLink size={14} /> Open
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-2.5">
                              <div className="flex min-w-fit items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 flex-shrink-0">
                                <Calendar size={12} />
                                {date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              <span className="text-xs font-medium text-slate-500">Empty</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unscheduled Section */}
                  <div className="mt-6">
                    <h3 className="mb-2 text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                      Unscheduled
                    </h3>
                    <div className="space-y-3">
                      {unscheduledSteps.map((a) => (
                        <div
                          key={a.id}
                          className="group flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 transition hover:border-amber-400"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                {a.task?.name} — {a.name || 'Attempt'}
                              </h3>
                              <span className="inline-flex flex-shrink-0 items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                No date scheduled
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              navigate(`/projects/${projectId}/attempts/${a.id}`)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                          >
                            <ExternalLink size={14} /> Open
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Tasks Section */}
        {viewMode === 'tasks' && (
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
                  <div key={task.id} className="rounded-lg border border-slate-200 bg-white">
                    <div
                      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5"
                      onClick={() => toggleTaskExpanded(task.id)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <ChevronDown
                          size={18}
                          className={`flex-shrink-0 text-slate-400 transition-transform ${
                            expandedTaskIds.includes(task.id) ? 'rotate-180' : ''
                          }`}
                        />
                        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                          {task.name}
                        </h3>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {task.priority && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            P: {task.priority}
                          </span>
                        )}
                        {task.difficulty && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            D: {task.difficulty}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${projectId}/tasks/${task.id}`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                        >
                          <ExternalLink size={14} /> View
                        </button>
                      </div>
                    </div>

                    {expandedTaskIds.includes(task.id) && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        {taskDetails[task.id]?.attempts?.length ? (
                          <div className="space-y-2">
                            {taskDetails[task.id].attempts.map((attempt) => (
                              <div
                                key={attempt.id}
                                className="rounded-lg border border-slate-200 bg-white"
                              >
                                <div
                                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                                    attempt.done ? 'bg-emerald-50' : 'bg-white'
                                  }`}
                                  onClick={() => toggleAttemptExpanded(attempt.id)}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <ChevronRight
                                      size={16}
                                      className={`flex-shrink-0 text-slate-400 transition-transform ${
                                        expandedAttemptIds.includes(attempt.id) ? 'rotate-90' : ''
                                      }`}
                                    />
                                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                                      {attempt.name || 'Untitled attempt'}
                                    </p>
                                    {attempt.scheduled_date && (
                                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                        <Calendar size={10} />
                                        {new Date(attempt.scheduled_date).toLocaleDateString(
                                          'en-US',
                                          { month: 'short', day: 'numeric' },
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`flex-shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${attempt.done ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}
                                  >
                                    {attempt.done ? '✓' : '⏳'}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(
                                        `/projects/${projectId}/attempts/${attempt.id}`,
                                      );
                                    }}
                                    className="flex-shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                  >
                                    Open
                                  </button>
                                </div>

                                {expandedAttemptIds.includes(attempt.id) &&
                                  attemptDetails[attempt.id]?.todos && (
                                    <div className="border-t border-slate-200 bg-slate-50 p-3">
                                      {attemptDetails[attempt.id].todos.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">
                                          No todos for this attempt
                                        </p>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {attemptDetails[attempt.id].todos.map((todo) => (
                                            <li
                                              key={todo.id}
                                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                                            >
                                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={todo.done || false}
                                                  onChange={() =>
                                                    handleToggleTodo(attempt.id, todo.id)
                                                  }
                                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                                                />
                                                <span
                                                  className={
                                                    todo.done
                                                      ? 'truncate text-slate-400 line-through'
                                                      : 'truncate text-slate-800'
                                                  }
                                                >
                                                  {todo.text}
                                                </span>
                                              </div>
                                              {todo.created_at && (
                                                <span className="flex-shrink-0 text-xs text-slate-400">
                                                  {new Date(todo.created_at).toLocaleDateString(
                                                    'en-US',
                                                    { month: 'short', day: 'numeric' },
                                                  )}
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            No attempts loaded for this task.
                          </p>
                        )}
                      </div>
                    )}
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
        )}
      </div>
    </div>
  );
}
