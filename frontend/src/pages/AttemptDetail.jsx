import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  Edit2,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  fetchAttemptDetail,
  updateAttempt,
  createAttemptTodo,
  toggleAttemptTodo,
  deleteAttemptTodo,
} from '../api/org_API.js';
//
export default function AttemptDetail() {
  const { projectId, attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todoText, setTodoText] = useState('');
  const [error, setError] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [incomingDeps, setIncomingDeps] = useState([]);
  const [outgoingDeps, setOutgoingDeps] = useState([]);

  async function loadAttempt() {
    try {
      setLoading(true);
      const data = await fetchAttemptDetail(projectId, attemptId);
      setAttempt(data);
      setEditName(data?.name || '');
      setEditDescription(data?.description || '');
      setIncomingDeps(data?.incoming_dependencies || []);
      setOutgoingDeps(data?.outgoing_dependencies || []);
    } catch (err) {
      setError('Failed to load attempt');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttempt();
  }, [projectId, attemptId]);

  async function handleToggleDone() {
    if (!attempt) return;
    setSaving(true);
    try {
      const res = await updateAttempt(projectId, attemptId, { done: !attempt.done });
      setAttempt((a) => ({ ...a, done: res.done }));
    } catch (err) {
      setError('Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInfo() {
    if (!attempt) return;
    setSaving(true);
    try {
      const res = await updateAttempt(projectId, attemptId, {
        name: editName,
        description: editDescription,
      });
      setAttempt((a) => ({ ...a, name: res.name, description: res.description }));
      setEditingInfo(false);
    } catch (err) {
      setError('Failed to save attempt info');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTodo(e) {
    e.preventDefault();
    if (!todoText.trim()) return;
    try {
      const res = await createAttemptTodo(projectId, attemptId, todoText.trim());
      setAttempt((a) => ({
        ...a,
        done: res.attempt_done,
        todos: [res, ...(a?.todos || [])],
      }));
      setTodoText('');
    } catch (err) {
      setError('Failed to add todo');
    }
  }

  async function handleToggleTodo(todoId) {
    try {
      const res = await toggleAttemptTodo(projectId, attemptId, todoId);
      setAttempt((a) => ({
        ...a,
        done: res.attempt_done,
        todos: (a?.todos || []).map((t) => (t.id === todoId ? { ...t, done: res.done } : t)),
      }));
    } catch (err) {
      setError('Failed to toggle todo');
    }
  }

  async function handleDeleteTodo(todoId) {
    try {
      const res = await deleteAttemptTodo(projectId, attemptId, todoId);
      setAttempt((a) => ({
        ...a,
        done: res.attempt_done,
        todos: (a?.todos || []).filter((t) => t.id !== todoId),
      }));
    } catch (err) {
      setError('Failed to delete todo');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Could not load attempt.
      </div>
    );
  }

  const teamColor = attempt.task?.team?.color || '#94a3b8';

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-4xl flex-col gap-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 shadow-sm transition hover:bg-white"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow"
              style={{ backgroundColor: teamColor }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {attempt.task?.name} — {attempt.name || 'Untitled attempt'} #
                {attempt.slot_index ?? attempt.number ?? '—'}
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Slot: {attempt.slot_index ?? '—'} · Team: {attempt.task?.team?.name || '—'}
              </p>
              {attempt.scheduled_date && (
                <p className="mt-1 text-xs text-slate-600">
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

          <div className="flex flex-shrink-0 flex-col gap-2">
            <button
              onClick={handleToggleDone}
              disabled={saving}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow transition ${
                attempt.done
                  ? 'border border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50'
                  : 'border border-amber-300 bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50'
              }`}
            >
              <CheckCircle2 size={18} />
              {attempt.done ? '✓ Done' : 'In Progress'}
            </button>
            <div className="flex gap-2">
              {attempt.task?.id && (
                <button
                  onClick={() =>
                    navigate(`/projects/${projectId}/tasks/${attempt.task.id}`)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <ExternalLink size={14} /> Task
                </button>
              )}
              {attempt.task?.team?.id && (
                <button
                  onClick={() =>
                    navigate(`/projects/${projectId}/teams/${attempt.task.team.id}`)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <ExternalLink size={14} /> Team
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Attempt Info</h2>
              <p className="text-xs text-slate-500">Name and description</p>
            </div>
            {!editingInfo ? (
              <button
                onClick={() => setEditingInfo(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow transition hover:bg-slate-200"
              >
                <Edit2 size={16} /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditName(attempt?.name || '');
                    setEditDescription(attempt?.description || '');
                    setEditingInfo(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 shadow transition hover:bg-slate-200"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  onClick={handleSaveInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Save
                </button>
              </div>
            )}
          </div>

          {!editingInfo ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-600">Attempt Name</p>
                <p className="text-sm text-slate-900">{attempt.name || 'Untitled attempt'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Description</p>
                <p className="text-sm text-slate-700">{attempt.description || '—'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Attempt Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Dependencies</h2>
            <p className="text-xs text-slate-500">
              Incoming: {incomingDeps.length} · Outgoing: {outgoingDeps.length}
            </p>
          </div>

          {/* Incoming Dependencies */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Incoming</h3>
            {incomingDeps.length === 0 ? (
              <p className="text-xs text-slate-500">No incoming dependencies.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {incomingDeps.map((dep) => {
                  const a = dep.attempt;
                  const color = a?.task?.team?.color || '#cbd5e1';
                  return (
                    <li
                      key={`${dep.type || 'dep'}-${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">
                          {a?.task?.name} — {a?.name || 'Untitled attempt'} #
                          {a?.slot_index ?? a?.number ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {a?.scheduled_date && (
                          <span className="text-xs text-slate-500">
                            {new Date(a.scheduled_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            navigate(`/projects/${projectId}/attempts/${a.id}`)
                          }
                          className="text-xs font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                        >
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Outgoing Dependencies */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Outgoing</h3>
            {outgoingDeps.length === 0 ? (
              <p className="text-xs text-slate-500">No outgoing dependencies.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {outgoingDeps.map((dep) => {
                  const a = dep.attempt;
                  const color = a?.task?.team?.color || '#cbd5e1';
                  return (
                    <li
                      key={`${dep.type || 'dep'}-${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">
                          {a?.task?.name} — {a?.name || 'Untitled attempt'} #
                          {a?.slot_index ?? a?.number ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {a?.scheduled_date && (
                          <span className="text-xs text-slate-500">
                            {new Date(a.scheduled_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            navigate(`/projects/${projectId}/attempts/${a.id}`)
                          }
                          className="text-xs font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                        >
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Todos</h2>
              <p className="text-xs text-slate-500">
                Manage todos for this attempt ({attempt.todos?.length || 0})
              </p>
            </div>
          </div>

          <form onSubmit={handleAddTodo} className="mb-4 flex gap-2">
            <input
              value={todoText}
              onChange={(e) => setTodoText(e.target.value)}
              placeholder="Add todo..."
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              <Plus size={16} />
              Add
            </button>
          </form>

          {attempt.todos?.length ? (
            <ul className="space-y-2">
              {attempt.todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className={todo.done ? 'text-slate-400 line-through' : 'text-slate-800'}>
                      {todo.text}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              No todos yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
