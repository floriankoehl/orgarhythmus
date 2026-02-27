import React, { useState, useRef, useCallback } from "react";
import { X, Upload, ClipboardPaste, FileJson, Check } from "lucide-react";

/**
 * Modal that lets the user import teams + tasks from JSON.
 * Two input modes: paste text or upload a file.
 *
 * ── Accepted JSON formats ──
 *
 * Full project (teams with tasks):
 *   {
 *     "teams": [
 *       {
 *         "name": "Design",
 *         "color": "#6366f1",
 *         "tasks": [
 *           { "name": "Task A", "description": "...", "priority": "high", "difficulty": "medium" }
 *         ]
 *       }
 *     ],
 *     "unassigned_tasks": [
 *       { "name": "Task B", "description": "..." }
 *     ]
 *   }
 *
 * Single or multiple teams:
 *   { "name": "Design", "color": "#6366f1", "tasks": [...] }
 *   { "teams": [ { "name": "Design", "tasks": [...] }, ... ] }
 *
 * Tasks only (inserted as unassigned):
 *   { "tasks": [ { "name": "...", "description": "..." } ] }
 *   [ { "name": "...", "description": "..." } ]
 *
 * Props:
 *   scope           – "project" | "teams" | "tasks"
 *   targetTeamName  – when scope="tasks", the team name (for display)
 *   onImport(data)  – called with normalised { teams, unassigned_tasks }
 *   onClose         – close callback
 */
export default function TaskImportModal({ scope = "project", targetTeamName, onImport, onClose }) {
  const [mode, setMode] = useState(null); // null = choose, "paste" | "file"
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const headerText = scope === "tasks"
    ? `Insert Tasks → ${targetTeamName || "Team"}`
    : scope === "teams"
      ? "Import Teams"
      : "Import Project Structure";

  // ── Normalise & validate the incoming JSON ──
  const normalise = (data) => {
    // Bare array → treat as tasks
    if (Array.isArray(data)) {
      return { teams: [], unassigned_tasks: data };
    }

    if (!data || typeof data !== "object") {
      throw new Error("Expected a JSON object or array.");
    }

    // Full project format: { teams, unassigned_tasks? }
    if (data.teams && Array.isArray(data.teams)) {
      for (let i = 0; i < data.teams.length; i++) {
        const t = data.teams[i];
        if (!t || typeof t !== "object") throw new Error(`Team at index ${i} is not a valid object.`);
        if (!t.name) t.name = `Imported Team ${i + 1}`;
        if (!t.tasks) t.tasks = [];
        if (!Array.isArray(t.tasks)) t.tasks = [];
      }
      return {
        teams: data.teams,
        unassigned_tasks: Array.isArray(data.unassigned_tasks) ? data.unassigned_tasks : [],
      };
    }

    // Single team format: { name, tasks }
    if (data.name && (data.tasks || data.color)) {
      if (!data.tasks) data.tasks = [];
      return { teams: [data], unassigned_tasks: [] };
    }

    // Tasks-only format: { tasks: [...] }
    if (data.tasks && Array.isArray(data.tasks)) {
      return { teams: [], unassigned_tasks: data.tasks };
    }

    throw new Error(
      'JSON must have a "teams" array, or be a team object with "name" + "tasks", or a "tasks" array.'
    );
  };

  const parseAndImport = useCallback(async (raw) => {
    setError(null);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      setError("Invalid JSON. Please check the format and try again.");
      return;
    }

    let normalised;
    try {
      normalised = normalise(data);
    } catch (e) {
      setError(e.message);
      return;
    }

    // Scope validation
    if (scope === "tasks" && normalised.teams.length > 0 && normalised.unassigned_tasks.length === 0) {
      // User pasted a team export into the "insert tasks" modal → extract tasks from the first team
      const allTasks = normalised.teams.flatMap((t) => t.tasks || []);
      normalised = { teams: [], unassigned_tasks: allTasks };
    }

    const totalTasks = normalised.unassigned_tasks.length + normalised.teams.reduce((s, t) => s + (t.tasks?.length || 0), 0);
    if (totalTasks === 0 && normalised.teams.length === 0) {
      setError("No teams or tasks found in the JSON.");
      return;
    }

    setLoading(true);
    try {
      await onImport(normalised);
    } catch (e) {
      setError(e.message || "Import failed.");
      setLoading(false);
    }
  }, [onImport, scope]);

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

  // ── Example JSON snippets for each scope ──
  const exampleJson = scope === "tasks"
    ? `// Array of tasks:
{
  "tasks": [
    { "name": "Task A", "description": "...", "priority": "high", "difficulty": "easy" },
    { "name": "Task B", "description": "..." }
  ]
}

// Or a bare array:
[
  { "name": "Task A", "description": "..." },
  { "name": "Task B" }
]`
    : scope === "teams"
      ? `// Single team:
{
  "name": "Design",
  "color": "#6366f1",
  "tasks": [
    { "name": "Task A", "description": "...", "priority": "high" }
  ]
}

// Multiple teams:
{
  "teams": [
    {
      "name": "Design",
      "color": "#6366f1",
      "tasks": [{ "name": "Task A" }]
    },
    {
      "name": "Development",
      "color": "#10b981",
      "tasks": [{ "name": "Task B" }]
    }
  ]
}`
      : `// Full project structure:
{
  "teams": [
    {
      "name": "Design",
      "color": "#6366f1",
      "tasks": [
        { "name": "Task A", "description": "...", "priority": "high", "difficulty": "medium" },
        { "name": "Task B" }
      ]
    },
    {
      "name": "Dev",
      "color": "#10b981",
      "tasks": [{ "name": "Task C" }]
    }
  ],
  "unassigned_tasks": [
    { "name": "Task D", "description": "backlog item" }
  ]
}`;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={onClose} />

      {/* Modal */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[9999] flex flex-col"
        style={{ width: "min(560px, 90%)", maxHeight: "80%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">
            {headerText}
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
                {scope === "tasks"
                  ? <>Add tasks to <strong>{targetTeamName || "this team"}</strong> from JSON.</>
                  : scope === "teams"
                    ? "Create teams (with their tasks) from JSON."
                    : "Import a full project structure — teams and tasks — from JSON."
                }
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
                Paste your JSON below. Accepted format:
              </p>
              <pre className="text-[10px] bg-gray-50 rounded px-2 py-1.5 border border-gray-200 text-gray-500 overflow-x-auto whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                {exampleJson}
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
                      {scope === "tasks" ? "Insert Tasks" : "Import"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── File mode ── */}
          {mode === "file" && (
            <div className="flex flex-col gap-3 items-center py-6">
              {loading ? (
                <p className="text-sm text-gray-500">Importing…</p>
              ) : (
                <>
                  <Upload size={32} className="text-gray-300" />
                  <p className="text-xs text-gray-500">Select a JSON file or drag it here.</p>
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

        {/* Footer */}
        <div className="px-4 pb-3 text-[10px] text-gray-400">
          {scope === "tasks"
            ? "Insert tasks into the selected team. Each task object needs at least a \"name\" field."
            : "Each team needs a \"name\". Tasks need at least a \"name\". Optional: description, priority (low/medium/high), difficulty (easy/medium/hard), color."
          }
        </div>
      </div>
    </>
  );
}
