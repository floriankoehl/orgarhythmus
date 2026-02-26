import React, { useState, useRef, useCallback } from "react";
import { X, Upload, ClipboardPaste, FileJson, Check } from "lucide-react";

/**
 * Modal that lets the user import a category from JSON.
 * Two modes: paste text or upload a file.
 *
 * Props:
 *   onImport(jsonObject)  – called with the parsed JSON when user confirms
 *   onClose               – close callback
 */
export default function IdeaBinCategoryImportModal({ onImport, onClose }) {
  const [mode, setMode] = useState(null); // null = choose, "paste" | "file"
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const parseAndImport = useCallback(async (raw) => {
    setError(null);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      setError("Invalid JSON. Please check the format and try again.");
      return;
    }

    // Basic validation
    if (!data.category_name && !data.ideas) {
      setError('JSON must have "category_name" and/or "ideas" fields.');
      return;
    }

    if (!data.category_name) {
      data.category_name = "Imported Category";
    }
    if (!data.ideas || !Array.isArray(data.ideas)) {
      data.ideas = [];
    }

    setLoading(true);
    try {
      await onImport(data);
    } catch (e) {
      setError(e.message || "Import failed.");
      setLoading(false);
    }
  }, [onImport]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await parseAndImport(text);
    } catch {
      setError("Could not read file.");
    }
  }, [parseAndImport]);

  const handlePasteConfirm = useCallback(() => {
    if (!pasteText.trim()) {
      setError("Please paste some JSON first.");
      return;
    }
    parseAndImport(pasteText.trim());
  }, [pasteText, parseAndImport]);

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={onClose} />

      {/* Modal */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[9999] flex flex-col"
        style={{ width: "min(520px, 90%)", maxHeight: "80%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">
            Import Category
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-3">

          {/* ── Mode selection ── */}
          {mode === null && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-500">
                Create a new category from JSON. Choose how to provide the data:
              </p>
              <button
                onClick={() => { setMode("paste"); setError(null); }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition text-left"
              >
                <ClipboardPaste size={20} className="text-blue-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Paste JSON</div>
                  <div className="text-[11px] text-gray-500">Paste text directly — ideal for quick edits or AI-refined output</div>
                </div>
              </button>
              <button
                onClick={() => { setMode("file"); setError(null); fileRef.current?.click(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition text-left"
              >
                <FileJson size={20} className="text-indigo-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-800">Upload File</div>
                  <div className="text-[11px] text-gray-500">Select a .json file from your computer</div>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* ── Paste mode ── */}
          {mode === "paste" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-500">
                Paste your JSON below. Expected format:
              </p>
              <pre className="text-[10px] bg-gray-50 rounded px-2 py-1.5 border border-gray-200 text-gray-500 overflow-x-auto">
{`{
  "category_name": "My Category",
  "ideas": [
    { "title": "...", "description": "..." },
    ...
  ]
}`}
              </pre>
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setError(null); }}
                placeholder="Paste JSON here..."
                className="w-full font-mono text-[11px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-300"
                style={{ minHeight: "180px", maxHeight: "400px" }}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setMode(null); setPasteText(""); setError(null); }}
                  className="px-3 py-1.5 rounded text-xs border border-gray-300 hover:bg-gray-50 text-gray-600"
                >
                  Back
                </button>
                <button
                  onClick={handlePasteConfirm}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Importing…" : (
                    <>
                      <Check size={12} />
                      Convert & Import
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── File mode (uploading) ── */}
          {mode === "file" && (
            <div className="flex flex-col gap-3 items-center py-6">
              {loading ? (
                <p className="text-sm text-gray-500">Importing…</p>
              ) : (
                <>
                  <Upload size={32} className="text-gray-300" />
                  <p className="text-xs text-gray-500">
                    Select a JSON file or drag it here.
                  </p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-4 py-1.5 rounded text-xs text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Choose File
                  </button>
                  <button
                    onClick={() => { setMode(null); setError(null); }}
                    className="px-3 py-1.5 rounded text-xs border border-gray-300 hover:bg-gray-50 text-gray-600"
                  >
                    Back
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 pb-3 text-[10px] text-gray-400">
          The imported data will create a brand-new category with the ideas listed in the JSON.
        </div>
      </div>
    </>
  );
}
