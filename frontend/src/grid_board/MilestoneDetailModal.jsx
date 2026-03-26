import { useEffect, useRef, useState, useCallback } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

const DEFAULT_TODO_TITLE = 'Milestone finished';

/**
 * MilestoneDetailModal — opened on double-click of a milestone.
 * Supports editing name, description, and acceptance criteria (todos).
 */
export default function MilestoneDetailModal({
  milestone,
  onClose,
  onToggleTodo,
  onUpdate,
  onAddTodo,
  onDeleteTodo,
}) {
  const cardRef = useRef(null);

  // ── Local state (mirrors milestone prop; updates optimistically) ──
  const [name, setName] = useState(milestone?.name ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [todos, setTodos] = useState(milestone?.todos ?? []);
  const [toggling, setToggling] = useState(new Set());
  const [deleting, setDeleting] = useState(new Set());
  const [newTodoText, setNewTodoText] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const addInputRef = useRef(null);

  // Sync when milestone changes (e.g. parent updates it)
  useEffect(() => {
    setName(milestone?.name ?? '');
    setDescription(milestone?.description ?? '');
    setTodos(milestone?.todos ?? []);
  }, [milestone?.id]);

  // Keep todos in sync whenever parent pushes updates
  useEffect(() => {
    setTodos(milestone?.todos ?? []);
  }, [milestone?.todos]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus add input when shown
  useEffect(() => {
    if (addingTodo) addInputRef.current?.focus();
  }, [addingTodo]);

  // ── Name save on blur / Enter ──
  const commitName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === milestone?.name) return;
    try { await onUpdate?.({ name: trimmed }); } catch { setName(milestone?.name ?? ''); }
  }, [name, milestone?.name, onUpdate]);

  // ── Description save on blur ──
  const commitDescription = useCallback(async () => {
    if (description === (milestone?.description ?? '')) return;
    try { await onUpdate?.({ description }); } catch { setDescription(milestone?.description ?? ''); }
  }, [description, milestone?.description, onUpdate]);

  // ── Toggle todo ──
  const handleToggle = useCallback(async (todo) => {
    if (toggling.has(todo.id)) return;
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done: !t.done } : t));
    setToggling((prev) => new Set(prev).add(todo.id));
    try {
      await onToggleTodo(todo.id);
    } catch {
      setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done: todo.done } : t));
    } finally {
      setToggling((prev) => { const n = new Set(prev); n.delete(todo.id); return n; });
    }
  }, [toggling, onToggleTodo]);

  // ── Delete todo ──
  const handleDelete = useCallback(async (todo) => {
    if (deleting.has(todo.id)) return;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    setDeleting((prev) => new Set(prev).add(todo.id));
    try {
      await onDeleteTodo(todo.id);
    } catch {
      setTodos((prev) => [...prev, todo].sort((a, b) => a.order - b.order));
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(todo.id); return n; });
    }
  }, [deleting, onDeleteTodo]);

  // ── Add todo ──
  const handleAddTodo = useCallback(async () => {
    const title = newTodoText.trim();
    if (!title) return;
    setNewTodoText('');
    setAddingTodo(false);
    try {
      await onAddTodo(title);
    } catch { /* parent handles rollback */ }
  }, [newTodoText, onAddTodo]);

  if (!milestone) return null;

  const allDone = todos.length > 0 && todos.every((t) => t.done);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        ref={cardRef}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* ── Header: editable name ── */}
        <div className="flex items-start gap-2 px-5 pt-5 pb-3">
          {allDone && (
            <CheckCircleIcon style={{ fontSize: 18, flexShrink: 0, marginTop: 3 }} className="text-green-500" />
          )}
          <input
            className="flex-1 text-base font-semibold text-slate-800 bg-transparent border-b border-transparent
              hover:border-slate-300 focus:border-sky-400 focus:outline-none transition-colors py-0.5 min-w-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
            placeholder="Milestone name"
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <CloseIcon style={{ fontSize: 16 }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* ── Description ── */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
            <textarea
              className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                focus:outline-none focus:border-sky-400 focus:bg-white transition-colors resize-none leading-relaxed"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              placeholder="Add a description…"
            />
          </div>

          {/* ── Acceptance criteria (todos) ── */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Acceptance Criteria
            </p>
            <ul className="space-y-1">
              {todos.map((todo) => {
                const isDefault = todo.title === DEFAULT_TODO_TITLE;
                return (
                  <li key={todo.id} className="flex items-center gap-1 group/todo">
                    <button
                      onClick={() => handleToggle(todo)}
                      disabled={toggling.has(todo.id)}
                      className={`flex-1 flex items-start gap-2.5 text-left px-3 py-2 rounded-lg transition-colors
                        ${todo.done ? 'bg-green-50 hover:bg-green-100' : 'bg-slate-50 hover:bg-slate-100'}
                        ${toggling.has(todo.id) ? 'opacity-50' : ''}`}
                    >
                      {todo.done
                        ? <CheckCircleIcon style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} className="text-green-500" />
                        : <RadioButtonUncheckedIcon style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} className="text-slate-300 group-hover/todo:text-slate-400 transition-colors" />
                      }
                      <span className={`text-sm leading-snug ${todo.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {todo.title}
                      </span>
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleDelete(todo)}
                        disabled={deleting.has(todo.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50
                          opacity-0 group-hover/todo:opacity-100 transition-all"
                        title="Remove"
                      >
                        <DeleteOutlineIcon style={{ fontSize: 14 }} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Add new criterion */}
            {addingTodo ? (
              <form
                className="flex items-center gap-1.5 mt-2"
                onSubmit={(e) => { e.preventDefault(); handleAddTodo(); }}
              >
                <input
                  ref={addInputRef}
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder="New criterion…"
                  className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5
                    focus:outline-none focus:border-sky-400 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setAddingTodo(false); setNewTodoText(''); }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newTodoText.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 text-white
                    hover:bg-sky-700 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingTodo(true)}
                className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                  text-xs text-slate-400 border border-dashed border-slate-200
                  hover:border-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <AddIcon style={{ fontSize: 14 }} />
                Add criterion
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
