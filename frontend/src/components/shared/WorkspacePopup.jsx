import { useState, useRef, useEffect, useCallback } from "react";
import { Save, Trash2, Star, RefreshCw, Pencil, Check, X } from "lucide-react";
import { playSound } from "../../assets/sound_registry";

/**
 * WorkspacePopup — floating panel for workspace CRUD, rendered above the InventoryBar.
 *
 * Props come from the useWorkspace hook:
 *   workspaces, saveWorkspace, loadWorkspace, overwriteWorkspace,
 *   renameWorkspace, removeWorkspace, toggleDefault
 */
export default function WorkspacePopup({
  workspaces,
  activeId,
  onSave,
  onLoad,
  onOverwrite,
  onRename,
  onDelete,
  onToggleDefault,
  onClose,
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Close on click-outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Focus input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  }, [name, onSave]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  }, [handleSave, onClose]);

  const commitRename = useCallback((id) => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== workspaces.find(w => w.id === id)?.name) {
      onRename(id, trimmed);
    }
    setEditingId(null);
    setEditingName("");
  }, [editingName, onRename, workspaces]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
        w-72 max-h-80 flex flex-col
        bg-slate-800/95 backdrop-blur-xl rounded-xl border border-slate-600/50
        shadow-2xl overflow-hidden"
      style={{ zIndex: 99999 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Workspaces</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Save new */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700/40">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New workspace name…"
          className="flex-1 text-xs px-2 py-1 rounded-md bg-slate-700/60 border border-slate-600/50
            text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/60"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="p-1 rounded-md bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-30
            text-white transition-all duration-150"
          title="Save current layout"
        >
          <Save size={13} />
        </button>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {workspaces.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-500">
            No workspaces yet
          </div>
        )}

        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={`group flex items-center gap-1 px-3 py-1.5 transition-colors ${
              ws.id === activeId ? "bg-violet-900/30" : "hover:bg-slate-700/40"
            }`}
          >
            {/* Default star */}
            <button
              onClick={() => onToggleDefault(ws.id)}
              className={`shrink-0 p-0.5 rounded transition-colors ${
                ws.is_default
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-slate-600 hover:text-slate-400"
              }`}
              title={ws.is_default ? "Default" : "Set as default"}
            >
              <Star size={12} fill={ws.is_default ? "currentColor" : "none"} />
            </button>

            {/* Name — click to load; or inline edit */}
            {editingId === ws.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(ws.id);
                  if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                }}
                onBlur={() => commitRename(ws.id)}
                className="flex-1 text-xs px-1.5 py-0.5 rounded bg-slate-700 border border-indigo-500/60
                  text-slate-200 outline-none"
              />
            ) : (
              <button
                onClick={() => { onLoad(ws.id); onClose(); }}
                className="flex-1 text-left text-xs text-slate-300 hover:text-white truncate
                  transition-colors cursor-pointer"
                title={`Load "${ws.name}"`}
              >
                {ws.name}
              </button>
            )}

            {/* Actions (visible on hover) */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditingId(ws.id); setEditingName(ws.name); }}
                className="p-0.5 rounded hover:bg-slate-600 text-slate-500 hover:text-slate-300 transition-colors"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => onOverwrite(ws.id)}
                className="p-0.5 rounded hover:bg-slate-600 text-slate-500 hover:text-blue-300 transition-colors"
                title="Overwrite with current layout"
              >
                <RefreshCw size={11} />
              </button>
              <button
                onClick={() => onDelete(ws.id)}
                className="p-0.5 rounded hover:bg-slate-600 text-slate-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
