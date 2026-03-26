import { useState, useRef, useEffect } from "react";
import { GitBranch, Plus, Trash2, ChevronDown, X, Check } from "lucide-react";
import { useBranch } from "../../auth/BranchContext";

/**
 * BranchSwitcher — compact dropdown for the InventoryBar.
 *
 * Shows current branch name; clicking opens a popup that lets the user:
 *   - Switch to any existing branch
 *   - Create a new branch (forked from the active branch)
 *   - Delete a non-main branch
 */
export default function BranchSwitcher() {
  const {
    branches,
    activeBranchId,
    mainBranchId,
    setActiveBranchId,
    createBranch,
    deleteBranch,
    loading,
  } = useBranch();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");
  const popupRef = useRef(null);
  const inputRef = useRef(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when create form opens
  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleSwitch = (id) => {
    setActiveBranchId(id);
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setError("Name is required"); return; }
    setError("");
    try {
      const branch = await createBranch({
        name,
        description: newDesc.trim(),
        sourceBranchId: activeBranchId,
      });
      setActiveBranchId(branch.id);
      setCreating(false);
      setNewName("");
      setNewDesc("");
      setOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this branch? All its data will be lost.")) return;
    try {
      await deleteBranch(id);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return null;

  const isMain = activeBranchId === mainBranchId;

  return (
    <div ref={popupRef} className="relative flex flex-col items-center">
      {/* ── Trigger button ── */}
      <button
        onClick={() => { setOpen((v) => !v); setCreating(false); setError(""); }}
        className={`
          group relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl
          transition-all duration-200 outline-none
          ${open ? "opacity-100 scale-105" : "opacity-70 hover:opacity-100"}
        `}
        title="Switch branch"
      >
        <div
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center shadow-lg
            transition-all duration-300
            ${open
              ? "bg-gradient-to-br from-teal-400 to-cyan-600 ring-2 ring-teal-300/40"
              : isMain
                ? "bg-gradient-to-br from-teal-500 to-cyan-700"
                : "bg-gradient-to-br from-violet-500 to-purple-700"
            }
          `}
        >
          <GitBranch size={18} className="text-white drop-shadow" />
        </div>
        <span className={`text-[9px] font-medium leading-none max-w-[44px] truncate ${open ? "text-teal-300" : "text-slate-400"}`}>
          {activeBranch?.name ?? "branch"}
        </span>
      </button>

      {/* ── Popup ── */}
      {open && (
        <div
          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2
            bg-slate-800/98 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-600/60
            p-1.5 min-w-[220px] z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1.5 pb-1 border-b border-slate-700/60 mb-1 flex items-center justify-between">
            <span>Branches</span>
            <button
              onClick={() => { setCreating((v) => !v); setError(""); setNewName(""); setNewDesc(""); }}
              className="p-0.5 rounded text-slate-400 hover:text-teal-300 hover:bg-slate-700/50 transition-colors"
              title="New branch"
            >
              <Plus size={11} />
            </button>
          </div>

          {/* Create form */}
          {creating && (
            <div className="px-1.5 py-1 mb-1 border-b border-slate-700/60">
              <div className="text-[9px] text-slate-400 mb-1">Fork from <span className="text-teal-300">{activeBranch?.name}</span></div>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Branch name"
                className="w-full text-[10px] px-1.5 py-1 bg-slate-700/60 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 mb-1"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full text-[10px] px-1.5 py-1 bg-slate-700/60 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 mb-1"
              />
              {error && <div className="text-[9px] text-red-400 mb-1">{error}</div>}
              <div className="flex gap-1">
                <button
                  onClick={handleCreate}
                  className="flex-1 flex items-center justify-center gap-0.5 text-[9px] py-1 rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                >
                  <Check size={9} /> Create
                </button>
                <button
                  onClick={() => { setCreating(false); setError(""); }}
                  className="px-1.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  <X size={9} />
                </button>
              </div>
            </div>
          )}

          {/* Branch list */}
          <div className="max-h-52 overflow-y-auto">
            {branches.map((branch) => {
              const isActive = branch.id === activeBranchId;
              return (
                <div
                  key={branch.id}
                  onClick={() => handleSwitch(branch.id)}
                  className={`
                    flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer
                    transition-colors group
                    ${isActive
                      ? "bg-teal-600/20 text-teal-300"
                      : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                    }
                  `}
                >
                  <GitBranch size={10} className={isActive ? "text-teal-400" : "text-slate-500"} />
                  <span className="flex-1 text-[10px] font-medium truncate">{branch.name}</span>
                  {branch.is_main && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-teal-900/60 text-teal-400 font-medium">main</span>
                  )}
                  {isActive && !branch.is_main && (
                    <span className="text-[8px] text-teal-400">✓</span>
                  )}
                  {!branch.is_main && (
                    <button
                      onClick={(e) => handleDelete(e, branch.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-red-400 transition-all"
                      title="Delete branch"
                    >
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
