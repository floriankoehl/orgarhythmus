// projects/pages/ProjectMain.jsx
import { useLoaderData, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Folder,
  Calendar,
  User,
  ArrowLeft,
  Plus,
  Settings,
  Share2,
  Trash2,
  Users,
  AlertTriangle,
  X,
  Pencil,
  Check,
  CheckCircle2,
  Circle,
  TrendingUp,
  Target,
  Zap,
} from 'lucide-react';
import {
  fetch_project_detail,
  fetchTeamsForProject,
  fetchTasksForProject,
  fetch_all_attempts,
  delete_project,
  update_project_api,
} from '../../api/org_API';
import Button from '@mui/material/Button';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

export async function project_loader({ params }) {
  const { projectId } = params;
  const project = await fetch_project_detail(projectId);
  const loaded_teams = await fetchTeamsForProject(projectId);
  const loaded_tasks = await fetchTasksForProject(projectId);
  const loaded_attempts = await fetch_all_attempts(projectId);

  return { project, loaded_teams, loaded_tasks, loaded_attempts };
}

function ProjectStats({ tasks, teams, attempts }) {
  const totalTasks = tasks.length;
  const totalTeams = teams.length;
  const unassignedTasks = tasks.filter((t) => !t.team).length;

  const avgPriority =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.priority || 0), 0) / totalTasks).toFixed(1)
      : '-';

  const avgDifficulty =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.difficulty || 0), 0) / totalTasks).toFixed(1)
      : '-';

  // Calculate completion stats
  const totalAttempts = (attempts || []).length;
  const completedAttempts = (attempts || []).filter((a) => a.done).length;
  const completionRate =
    totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0;

  // Calculate team stats
  const teamsWithTasks = teams.filter((t) => t.tasks && t.tasks.length > 0).length;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm transition hover:border-blue-300 hover:bg-blue-50/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Tasks
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{totalTasks}</p>
          </div>
          <Folder size={24} className="text-blue-400" />
        </div>
        <p className="mt-1 text-xs text-slate-500">{unassignedTasks} unassigned</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-purple-300 hover:bg-purple-50/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Teams
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{totalTeams}</p>
          </div>
          <Users size={24} className="text-purple-400" />
        </div>
        <p className="mt-1 text-xs text-slate-500">{teamsWithTasks} with tasks</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Completion
            </p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{completionRate}%</p>
          </div>
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {completedAttempts} of {totalAttempts}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
              Avg Difficulty
            </p>
            -
          </div>
          <Zap size={24} className="text-amber-400" />
        </div>
        <p className="mt-1 text-xs text-slate-500">Out of 10</p>
      </div>
    </section>
  );
}

function DeleteProjectModal({ isOpen, projectName, onConfirm, onCancel, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="animate-in fade-in slide-in-from-top-10 mx-4 w-full max-w-md duration-300">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-2xl">
          {/* Close button */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="absolute top-4 right-4 rounded-lg p-2 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} className="text-slate-500" />
          </button>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h2 className="mb-2 text-center text-2xl font-semibold text-slate-900">Delete Project</h2>

          {/* Warning text */}
          <p className="mb-6 text-center text-slate-600">
            <span className="font-semibold">Be cautious,</span> this can't be undone.
          </p>

          {/* Project name highlight */}
          <div className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-slate-600">You are about to delete:</p>
            <p className="mt-1 truncate text-lg font-semibold text-red-600">{projectName}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// test
export default function ProjectMain() {
  const { project: initialProject, loaded_teams, loaded_tasks, loaded_attempts } = useLoaderData();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectName, setProjectName] = useState(initialProject.name);
  const [saving, setSaving] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true); // Default to true
  const [calendarDays, setCalendarDays] = useState(14);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const [hoveredAttemptId, setHoveredAttemptId] = useState(null);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Add state for the current dates
  const [startDate, setStartDate] = useState(initialProject.start_date);
  const [endDate, setEndDate] = useState(initialProject.end_date);

  const [editStartDate, setEditStartDate] = useState(
    initialProject.start_date ? dayjs(initialProject.start_date) : null,
  );
  const [editEndDate, setEditEndDate] = useState(
    initialProject.end_date ? dayjs(initialProject.end_date) : null,
  );
  const [savingDates, setSavingDates] = useState(false);

  // Use the state variables for display
  const createdDate = initialProject.created_at
    ? new Date(initialProject.created_at).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  async function handleSaveName() {
    if (!projectName.trim()) {
      alert('Project name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      await update_project_api(initialProject.id, { name: projectName });
      // projectName is already in state, so no need to update
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update project name: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setProjectName(initialProject.name);
    setIsEditingName(false);
  }

  async function handleSaveDates() {
    try {
      setSavingDates(true);
      const newStartDate = editStartDate ? editStartDate.format('YYYY-MM-DD') : null;
      const newEndDate = editEndDate ? editEndDate.format('YYYY-MM-DD') : null;

      await update_project_api(initialProject.id, {
        start_date: newStartDate,
        end_date: newEndDate,
      });

      // Update state
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      setIsEditingDates(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update project dates: ' + err.message);
    } finally {
      setSavingDates(false);
    }
  }

  function handleCancelDateEdit() {
    setEditStartDate(startDate ? dayjs(startDate) : null);
    setEditEndDate(endDate ? dayjs(endDate) : null);
    setIsEditingDates(false);
  }

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      await delete_project(initialProject.id);
      await new Promise((resolve) => setTimeout(resolve, 500));
      navigate('/orgarhythmus');
    } catch (err) {
      console.error(err);
      alert('Failed to delete project: ' + err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 shadow-sm transition-all duration-200 hover:bg-white/100 hover:shadow-md"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Zurück</span>
        </button>

        {/* Header Section */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-3xl font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none sm:text-4xl"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="rounded-lg bg-green-600 p-3 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Save name"
                  >
                    {saving ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Check size={20} />
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="rounded-lg bg-slate-100 p-3 text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Cancel"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                    {projectName}
                  </h1>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="rounded-lg p-2 text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600"
                    title="Edit project name"
                  >
                    <Pencil size={20} />
                  </button>
                </div>
              )}
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                {initialProject.description ||
                  'Kein Beschreibung hinterlegt. Gestalte dein Projekt!'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                title="Project settings"
                className="rounded-lg bg-slate-100 p-3 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <Settings size={20} />
              </button>
              <button
                title="Share project"
                className="rounded-lg bg-slate-100 p-3 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <Share2 size={20} />
              </button>
              <button
                title="Delete project"
                onClick={() => setShowDeleteModal(true)}
                className="rounded-lg bg-red-50 p-3 text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {/* Meta Information */}
          {!isEditingDates ? (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <User size={16} className="text-blue-600" />
                <span className="mr-1 text-xs text-slate-500">Owner:</span>
                <span className="text-sm font-medium text-slate-700">
                  {initialProject.owner_username}
                </span>
              </div>

              {createdDate && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Calendar size={16} className="text-purple-600" />
                  <span className="mr-1 text-xs text-slate-500">Created:</span>
                  <span className="text-sm text-slate-700">{createdDate}</span>
                </div>
              )}

              {(startDate || endDate) && (
                <button
                  onClick={() => setIsEditingDates(true)}
                  className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-all hover:border-blue-400 hover:bg-blue-50"
                  title="Edit dates"
                >
                  <Calendar
                    size={16}
                    className="text-slate-600 transition-colors group-hover:text-blue-600"
                  />
                  <div className="flex gap-3">
                    {startDate && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Start:</span>
                        <span className="text-sm text-slate-700">
                          {new Date(startDate).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    )}
                    {endDate && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">End:</span>
                        <span className="text-sm text-slate-700">
                          {new Date(endDate).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    )}
                  </div>
                  <Pencil
                    size={14}
                    className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              )}

              {!startDate && !endDate && (
                <button
                  onClick={() => setIsEditingDates(true)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                  title="Add dates"
                >
                  <Calendar size={16} />
                  <span className="text-xs font-medium">Daten hinzufügen</span>
                </button>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Folder size={16} className="text-emerald-600" />
                <span className="font-mono text-sm text-slate-700">ID: {initialProject.id}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">
                Projektzeitraum bearbeiten
              </h3>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DatePicker
                    label="Startdatum (optional)"
                    value={editStartDate}
                    onChange={setEditStartDate}
                    minDate={dayjs()}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                      },
                    }}
                  />

                  <DatePicker
                    label="Enddatum (optional)"
                    value={editEndDate}
                    onChange={setEditEndDate}
                    minDate={editStartDate || dayjs()}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                      },
                    }}
                  />
                </div>
              </LocalizationProvider>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSaveDates}
                  disabled={savingDates}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingDates ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Speichern
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelDateEdit}
                  disabled={savingDates}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={16} />
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Members Section */}
          {initialProject.members_data && initialProject.members_data.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users size={16} className="text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Project Members ({initialProject.members_data.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {initialProject.members_data.map((member) => (
                  <div
                    key={member.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-slate-700">{member.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Stats Section */}
        <ProjectStats tasks={loaded_tasks} teams={loaded_teams} attempts={loaded_attempts} />

        {/* Calendar View Toggle & Timeline */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Calendar size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Project Timeline</h2>
                <p className="text-xs text-slate-500">Scheduled attempts overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={calendarDays}
                onChange={(e) => {
                  const val = e.target.value;
                  setCalendarDays(val === 'ALL' ? 'ALL' : parseInt(val));
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={'ALL'}>All</option>
              </select>
              <label className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hideEmptyDays}
                  onChange={(e) => setHideEmptyDays(e.target.checked)}
                  className="h-3 w-3 accent-blue-600"
                />
                Hide empty
              </label>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  showCalendar
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {showCalendar ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showCalendar && initialProject.start_date && (
            <div className="space-y-3">
              {/* Day labels */}
              <div className="hidden grid-cols-7 gap-2 lg:grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-xs font-bold tracking-wide text-slate-600 uppercase"
                  >
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid - 7 columns on lg screens, 2-3 on smaller */}
              <div className="relative grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {(() => {
                  const startDate = new Date(initialProject.start_date);
                  const endDate = initialProject.end_date
                    ? new Date(initialProject.end_date)
                    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const msPerDay = 24 * 60 * 60 * 1000;

                  // Get all attempts for this project
                  const projectAttempts = (loaded_attempts || []).filter(
                    (a) =>
                      a.task?.team?.project?.id === initialProject.id ||
                      (a.slot_index && a.task?.team),
                  );

                  // Group by date (use local date keys to avoid TZ drift)
                  const attemptsByDate = {};
                  const fmt = (d) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const da = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${da}`;
                  };
                  projectAttempts.forEach((attempt) => {
                    if (attempt.slot_index && initialProject.start_date) {
                      const d = new Date(startDate.getTime() + (attempt.slot_index - 1) * msPerDay);
                      d.setHours(0, 0, 0, 0);
                      const dateKey = fmt(d);
                      if (!attemptsByDate[dateKey]) {
                        attemptsByDate[dateKey] = [];
                      }
                      attemptsByDate[dateKey].push(attempt);
                    }
                  });

                  // Get next 14 days
                  const dates = [];
                  let current = new Date(today);
                  let limit = null;
                  if (calendarDays === 'ALL') {
                    if (initialProject.end_date) {
                      limit = new Date(initialProject.end_date);
                      limit.setHours(0, 0, 0, 0);
                    } else {
                      const keys = Object.keys(attemptsByDate);
                      if (keys.length > 0) {
                        const maxKey = keys.sort()[keys.length - 1];
                        const [y, m, d] = maxKey.split('-').map((x) => parseInt(x, 10));
                        limit = new Date(y, m - 1, d);
                      } else {
                        limit = new Date(today.getTime() + 60 * msPerDay);
                      }
                    }
                    while (current <= limit) {
                      dates.push(new Date(current));
                      current.setDate(current.getDate() + 1);
                    }
                  } else {
                    for (let i = 0; i < calendarDays; i++) {
                      dates.push(new Date(current));
                      current.setDate(current.getDate() + 1);
                    }
                  }

                  const visibleDates = hideEmptyDays
                    ? dates.filter((d) => (attemptsByDate[fmt(d)] || []).length > 0)
                    : dates;

                  return visibleDates.map((date) => {
                    const dateKey = fmt(date);
                    const dayAttempts = attemptsByDate[dateKey] || [];
                    const isToday = dateKey === fmt(today);
                    const hoveredAttempt = dayAttempts.find((a) => a.id === hoveredAttemptId);

                    return (
                      <div
                        key={dateKey}
                        className={`group relative flex h-40 flex-col rounded-lg border p-3 transition ${
                          dayAttempts.length > 0
                            ? 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                        onMouseLeave={() => setHoveredAttemptId(null)}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <span
                            className={`flex-shrink-0 rounded px-2 py-1 text-xs font-bold whitespace-nowrap ${
                              isToday ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {dayAttempts.length > 0 && (
                            <span className="flex-shrink-0 text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
                              {dayAttempts.length}
                            </span>
                          )}
                        </div>

                        {/* Scrollable attempts area */}
                        {dayAttempts.length > 0 ? (
                          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-xs">
                            {dayAttempts.map((attempt) => (
                              <div key={attempt.id} className="group/item relative">
                                <div
                                  className="cursor-pointer truncate rounded px-1.5 py-0.5 text-white shadow-sm transition"
                                  style={{
                                    backgroundColor: attempt.task?.team?.color || '#64748b',
                                  }}
                                  title={`${attempt.task?.name} - Attempt: ${attempt.name}`}
                                >
                                  <span className="block truncate font-medium text-black">
                                    {attempt.task?.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center text-xs text-slate-400 italic">
                            No attempts
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              onClick=
              {() =>
                navigate(`/projects/${initialProject.id}/tasks/${attempt.task?.id}`)
              }
            </div>
          )}
        </section>

        {/* Teams & Tasks Grid - use initialProject.id instead of project.id */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Teams Card */}
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
                  <p className="text-xs text-slate-500">
                    {loaded_teams.length} {loaded_teams.length === 1 ? 'Team' : 'Teams'}
                  </p>
                </div>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/projects/${initialProject.id}/teams`)}
                style={{ textTransform: 'none', borderRadius: '8px' }}
              >
                Manage
              </Button>
            </div>

            {loaded_teams.length > 0 ? (
              <div className="space-y-3">
                {(showAllTeams ? loaded_teams : loaded_teams.slice(0, 4)).map((team) => (
                  <div
                    key={team.id}
                    onClick={() =>
                      navigate(`/projects/${initialProject.id}/teams/${team.id}`)
                    }
                    className="group flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: team.color || '#64748b' }}
                      />
                      <span className="text-sm font-medium text-slate-900">{team.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">{team.tasks?.length || 0} tasks</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">Noch keine Teams erstellt</p>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate(`/projects/${initialProject.id}/teams`)}
                  style={{ textTransform: 'none', marginTop: '1rem', borderRadius: '8px' }}
                >
                  Erstes Team erstellen
                </Button>
              </div>
            )}

            {loaded_teams.length > 4 && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowAllTeams((v) => !v)}
                style={{ textTransform: 'none', marginTop: '1rem', borderRadius: '8px' }}
              >
                {showAllTeams ? 'Weniger anzeigen' : 'Alle Teams anzeigen →'}
              </Button>
            )}
          </section>

          {/* Tasks Card */}
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Folder size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
                  <p className="text-xs text-slate-500">
                    {loaded_tasks.length} {loaded_tasks.length === 1 ? 'Task' : 'Tasks'}
                  </p>
                </div>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/projects/${initialProject.id}/tasks`)}
                style={{ textTransform: 'none', borderRadius: '8px' }}
              >
                Manage
              </Button>
            </div>

            {loaded_tasks.length > 0 ? (
              <div className="space-y-3">
                {(showAllTasks ? loaded_tasks : loaded_tasks.slice(0, 4)).map((task) => (
                  <div
                    key={task.id}
                    onClick={() =>
                      navigate(`/projects/${initialProject.id}/tasks/${task.id}`)
                    }
                    className="cursor-pointer rounded-lg bg-slate-50 p-3 transition-all hover:bg-slate-100 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{task.name}</p>
                        {task.team && (
                          <p className="mt-1 text-xs text-slate-500">{task.team.name}</p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-500">
                        <span className="rounded bg-blue-50 px-2 py-1">P{task.priority || 0}</span>
                        <span className="rounded bg-purple-50 px-2 py-1">
                          D{task.difficulty || 0}
                        </span>
                        <span className="text-slate-400">→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Folder size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">Noch keine Tasks erstellt</p>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate(`/projects/${initialProject.id}/tasks`)}
                  style={{ textTransform: 'none', marginTop: '1rem', borderRadius: '8px' }}
                >
                  Ersten Task erstellen
                </Button>
              </div>
            )}

            {loaded_tasks.length > 4 && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowAllTasks((v) => !v)}
                style={{ textTransform: 'none', marginTop: '1rem', borderRadius: '8px' }}
              >
                {showAllTasks ? 'Weniger anzeigen' : 'Alle Tasks anzeigen →'}
              </Button>
            )}
          </section>
        </div>
      </div>

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={showDeleteModal}
        projectName={projectName}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={deleting}
      />
    </div>
  );
}
