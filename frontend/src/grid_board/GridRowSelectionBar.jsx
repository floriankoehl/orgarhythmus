import { useState, useCallback } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { playSound } from '../assets/sound_registry';

/**
 * Floating action bar that appears when rows are Ctrl+Click selected.
 * Shows Export (copy JSON to clipboard) and Import (open paste modal) buttons.
 * Generic version — row/node/edge terminology.
 */
export default function GridRowSelectionBar({
  selectedRows,       // Set<number> of selected row IDs
  setSelectedRows,
  rows,               // { [id]: { name, description, difficulty, priority, ... } }
  onImport,           // (jsonString) => Promise<void>
  buildClipboardText, // (scenarioKey, jsonString) => string | null
}) {
  const [copied, setCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const count = selectedRows.size;

  const handleExport = useCallback(async () => {
    const rowList = Array.from(selectedRows).map(id => {
      const r = rows[id];
      return {
        id: Number(id),
        name: r?.name || "",
        description: r?.description || "",
        difficulty: r?.difficulty || "",
        priority: r?.priority || "",
      };
    });
    const json = JSON.stringify({ rows: rowList }, null, 2);
    const text = buildClipboardText
      ? buildClipboardText('grid_selected_rows', json)
      : json;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playSound('click');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedRows, rows, buildClipboardText]);

  const handleClear = useCallback(() => {
    setSelectedRows(new Set());
    playSound('click');
  }, [setSelectedRows]);

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
          {count} row{count !== 1 ? 's' : ''} selected
        </span>

        <div className="w-px h-5 bg-slate-200" />

        <button
          onClick={handleExport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Copy row info JSON to clipboard"
        >
          {copied ? <CheckIcon style={{ fontSize: 14 }} /> : <ContentCopyIcon style={{ fontSize: 14 }} />}
          {copied ? 'Copied!' : 'Export JSON'}
        </button>

        <button
          onClick={() => { setShowImportModal(true); playSound('click'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
          title="Import edge JSON to create nodes"
        >
          <FileUploadIcon style={{ fontSize: 14 }} />
          Import Edges
        </button>

        <button
          onClick={handleClear}
          className="flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title="Deselect all rows"
        >
          <CloseIcon style={{ fontSize: 16 }} />
        </button>
      </div>

      {showImportModal && (
        <EdgeImportModal
          selectedRows={selectedRows}
          rows={rows}
          onImport={onImport}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}


function EdgeImportModal({ selectedRows, rows, onImport, onClose }) {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedIds = Array.from(selectedRows);

  const handleConfirm = useCallback(async () => {
    setError(null);
    if (!pasteText.trim()) {
      setError('Please paste the edge JSON first.');
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

    const selectedSet = new Set(selectedIds.map(Number));
    for (const dep of data.dependencies) {
      if (!dep.task_id) {
        setError('Each entry in "dependencies" must have a "task_id".');
        return;
      }
      if (!selectedSet.has(Number(dep.task_id))) {
        setError(`task_id ${dep.task_id} is not in your selected rows.`);
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
      ...(i > 0 ? { descriptions: { [Number(selectedIds[i - 1])]: "Short explanation why this edge exists" } } : {}),
    }))
  }, null, 2);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[99999]" onClick={onClose} />

      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[100000] flex flex-col"
        style={{ width: 'min(560px, 90vw)', maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">
            Import Edge Map
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <CloseIcon style={{ fontSize: 16 }} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">
            Paste the edge JSON. This will create a node for each selected row
            and schedule them respecting edges. Each entry can optionally include a <code className="text-[10px] bg-gray-100 px-1 rounded">"descriptions"</code> object
            mapping edge row IDs to a description string.
          </p>

          <p className="text-[10px] text-gray-400 mb-1 font-medium">Expected format:</p>
          <pre className="text-[10px] bg-gray-50 rounded px-2 py-1.5 border border-gray-200 text-gray-500 overflow-x-auto mb-3 max-h-32">
{exampleJson}
          </pre>

          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setError(null); }}
            placeholder="Paste edge JSON here..."
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-[10px] text-gray-400">
            {selectedIds.length} rows selected — nodes will be created & scheduled automatically
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
              {loading ? 'Creating…' : 'Create Nodes & Edges'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
