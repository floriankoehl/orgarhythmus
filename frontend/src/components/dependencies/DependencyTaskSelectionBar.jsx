import { useState, useCallback } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { playSound } from '../../assets/sound_registry';

/**
 * Floating action bar that appears when tasks are Ctrl+Click selected.
 * Shows Export (copy JSON to clipboard) and Import (open paste modal) buttons.
 */
export default function DependencyTaskSelectionBar({
  selectedTasks,    // Set<number> of selected task IDs
  setSelectedTasks,
  tasks,            // { [id]: { name, description, difficulty, priority, ... } }
  onImport,         // (jsonString) => Promise<void>
}) {
  const [copied, setCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const count = selectedTasks.size;

  const handleExport = useCallback(async () => {
    const taskList = Array.from(selectedTasks).map(id => {
      const t = tasks[id];
      return {
        id: Number(id),
        name: t?.name || "",
        description: t?.description || "",
        difficulty: t?.difficulty || "",
        priority: t?.priority || "",
      };
    });
    const json = JSON.stringify({ tasks: taskList }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      playSound('click');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = json;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedTasks, tasks]);

  const handleClear = useCallback(() => {
    setSelectedTasks(new Set());
    playSound('click');
  }, [setSelectedTasks]);

  if (count < 2 && !showImportModal) return null;

  return (
    <>
      {/* Floating bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99998,
        }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white shadow-2xl border border-slate-200"
      >
        <span className="text-xs font-semibold text-slate-600">
          {count} task{count !== 1 ? 's' : ''} selected
        </span>

        <div className="w-px h-5 bg-slate-200" />

        {/* Export button */}
        <button
          onClick={handleExport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Copy task info JSON to clipboard (for AI prompt)"
        >
          {copied ? <CheckIcon style={{ fontSize: 14 }} /> : <ContentCopyIcon style={{ fontSize: 14 }} />}
          {copied ? 'Copied!' : 'Export JSON'}
        </button>

        {/* Import button */}
        <button
          onClick={() => { setShowImportModal(true); playSound('click'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
          title="Import dependency JSON to create milestones"
        >
          <FileUploadIcon style={{ fontSize: 14 }} />
          Import Dependencies
        </button>

        {/* Close / deselect all */}
        <button
          onClick={handleClear}
          className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title="Deselect all tasks"
        >
          <CloseIcon style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <DependencyImportModal
          selectedTasks={selectedTasks}
          tasks={tasks}
          onImport={onImport}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}


/**
 * Modal for pasting the AI-generated dependency JSON.
 * Expected format:
 * {
 *   "dependencies": [
 *     { "task_id": 123, "depends_on": [456, 789] },
 *     ...
 *   ]
 * }
 */
function DependencyImportModal({ selectedTasks, tasks, onImport, onClose }) {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedIds = Array.from(selectedTasks);

  const handleConfirm = useCallback(async () => {
    setError(null);
    if (!pasteText.trim()) {
      setError('Please paste the dependency JSON first.');
      return;
    }

    let data;
    try {
      data = JSON.parse(pasteText.trim());
    } catch {
      setError('Invalid JSON. Please check the format and try again.');
      return;
    }

    if (!data.dependencies || !Array.isArray(data.dependencies)) {
      setError('JSON must have a "dependencies" array.');
      return;
    }

    // Validate that all referenced task IDs are in the selected set
    const selectedSet = new Set(selectedIds.map(Number));
    for (const dep of data.dependencies) {
      if (!dep.task_id) {
        setError('Each entry in "dependencies" must have a "task_id".');
        return;
      }
      if (!selectedSet.has(Number(dep.task_id))) {
        setError(`task_id ${dep.task_id} is not in your selected tasks.`);
        return;
      }
      if (dep.depends_on && Array.isArray(dep.depends_on)) {
        for (const depId of dep.depends_on) {
          if (!selectedSet.has(Number(depId))) {
            setError(`Dependency references task_id ${depId} which is not selected.`);
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      await onImport(pasteText.trim());
      playSound('click');
      onClose();
    } catch (e) {
      setError(e.message || 'Import failed.');
      setLoading(false);
    }
  }, [pasteText, selectedIds, onImport, onClose]);

  const exampleJson = JSON.stringify({
    dependencies: selectedIds.slice(0, 3).map((id, i) => ({
      task_id: Number(id),
      depends_on: i > 0 ? [Number(selectedIds[i - 1])] : [],
    }))
  }, null, 2);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[99999]" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[100000] flex flex-col"
        style={{ width: 'min(560px, 90vw)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">
            Import Dependency Map
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <CloseIcon style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">
            Paste the dependency JSON from your AI. This will create a milestone for each selected task
            and schedule them respecting dependencies.
          </p>

          <p className="text-[10px] text-gray-400 mb-1 font-medium">Expected format:</p>
          <pre className="text-[10px] bg-gray-50 rounded px-2 py-1.5 border border-gray-200 text-gray-500 overflow-x-auto mb-3 max-h-32">
{exampleJson}
          </pre>

          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setError(null); }}
            placeholder="Paste dependency JSON here..."
            className="w-full font-mono text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-300"
            style={{ minHeight: '180px', maxHeight: '350px' }}
            autoFocus
          />

          {error && (
            <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-[10px] text-gray-400">
            {selectedIds.length} tasks selected — milestones will be created & scheduled automatically
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs border border-gray-300 hover:bg-gray-50 text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? 'Creating…' : 'Create Milestones & Dependencies'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
