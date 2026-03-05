import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Copy, Download, Check, Plus, RefreshCw, Pencil,
  Search as SearchIcon, AlertCircle, Sparkles,
  ClipboardPaste, ArrowRightLeft, Star, Zap, Loader,
} from "lucide-react";
import { detectResponseContent } from "../shared/promptEngine/responseApplier";
import ControlledApplyModal from "../shared/promptEngine/ControlledApplyPanel";
import { aiGenerate, getDirectMode } from "../../api/aiGenerateApi";

/**
 * ═══════════════════════════════════════════════════════════
 *  IdeaBinIOPopup  —  Grid Layout v2
 *  ──────────────────────────────────
 *  Two-mode popup:
 *   • Export – 3×3 grid (Add / Assign / Finetune × Ideas /
 *     Categories / Legends & Filters) + Specials row + context toggle
 *   • Import – paste AI response, preview & apply
 *
 *  Props:
 *    scenarios       – array of scenario definitions
 *    grid            – { rows, columns, cells, specials } metadata
 *    ctx             – data context for availability + payload
 *    settings        – user's prompt settings
 *    assemblePrompt  – (scenarioId, ctx, settings) => { text, json, jsonString }
 *    applyCtx        – object with API functions for applying responses
 *    onClose         – close callback
 *    iconColor       – title bar icon colour
 * ═══════════════════════════════════════════════════════════
 */
export default function IdeaBinIOPopup({
  scenarios, grid, ctx, settings, assemblePrompt, applyCtx, onClose, iconColor = "#92400e",
}) {
  // ─── Shared state ─────────────────────────────────────
  const [mode, setMode] = useState("export");
  const [copiedId, setCopiedId] = useState(null);
  const [lastCopiedScenario, setLastCopiedScenario] = useState(null);

  // ─── Direct AI mode ───────────────────────────────────
  const [directMode] = useState(getDirectMode);
  const [generatingId, setGeneratingId] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  // ─── Custom prompt add-on ─────────────────────────
  const [customAddOn, setCustomAddOn] = useState("");
  // ─── Export state ─────────────────────────────────────
  const [withContext, setWithContext] = useState(true);
  const [selectedLegendId, setSelectedLegendId] = useState(
    () => ctx.dims?.legends?.[0]?.id ?? null,
  );

  // ─── Import state ─────────────────────────────────────
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState(null);
  const [detected, setDetected] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const pasteRef = useRef(null);

  const popupRef = useRef(null);

  // Build scenario lookup map
  const scenarioMap = useMemo(() => {
    const m = new Map();
    scenarios.forEach(s => m.set(s.id, s));
    return m;
  }, [scenarios]);

  // Modified ctx with context toggle + legend picker
  const modCtx = useMemo(() => ({
    ...ctx,
    _withContext: withContext,
    _selectedLegendId: selectedLegendId,
  }), [ctx, withContext, selectedLegendId]);

  // Compute availability for each scenario (using base ctx, not toggles)
  const availability = useMemo(() => {
    const map = {};
    scenarios.forEach(s => {
      let msg = s.unavailableMsg(ctx);
      // For legend-picker scenarios, check if a legend is selected
      if (!msg && s.needsLegendPicker && !selectedLegendId) {
        msg = "Select a legend from the dropdown";
      }
      map[s.id] = msg;
    });
    return map;
  }, [scenarios, ctx, selectedLegendId]);

  // Selection stats
  const selectionStats = useMemo(() => {
    const parts = [];
    if (ctx.selectedIdeaIds?.size > 0) parts.push(`${ctx.selectedIdeaIds.size} idea${ctx.selectedIdeaIds.size > 1 ? "s" : ""}`);
    if (ctx.selectedCategoryIds?.size > 0) parts.push(`${ctx.selectedCategoryIds.size} cat${ctx.selectedCategoryIds.size > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") + " selected" : null;
  }, [ctx.selectedIdeaIds, ctx.selectedCategoryIds]);

  // Auto-focus paste area on import mode
  useEffect(() => {
    if (mode === "import") pasteRef.current?.focus();
  }, [mode]);

  // ─── Action icons ─────────────────────────────────────
  const actionIcon = (action, size = 10) => {
    if (action === "add") return <Plus size={size} className="text-green-500 flex-shrink-0" />;
    if (action === "assign") return <ArrowRightLeft size={size} className="text-teal-500 flex-shrink-0" />;
    if (action === "finetune") return <Pencil size={size} className="text-blue-500 flex-shrink-0" />;
    if (action === "special") return <Star size={size} className="text-amber-500 flex-shrink-0" />;
    return <Sparkles size={size} className="text-gray-400 flex-shrink-0" />;
  };

  // Column header colour hints
  const colColors = {
    add: "text-green-700 bg-green-50",
    assign: "text-teal-700 bg-teal-50",
    finetune: "text-blue-700 bg-blue-50",
  };

  // ─── Export: copy prompt ──────────────────────────────
  const handleCopy = useCallback(async (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    let { text } = assemblePrompt(scenarioId, modCtx, settings);
    if (customAddOn.trim()) text += "\n\n" + customAddOn.trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiedId(scenarioId);
    setLastCopiedScenario(scenario || null);
    setTimeout(() => {
      setCopiedId(null);
      setMode("import");
    }, 800);
  }, [assemblePrompt, modCtx, settings, scenarioMap, customAddOn]);

  // ─── Export: direct AI generate ────────────────────────
  const handleGenerate = useCallback(async (scenarioId) => {
    setGeneratingId(scenarioId);
    setGenerateError(null);
    try {
      let { text } = assemblePrompt(scenarioId, modCtx, settings);
      if (customAddOn.trim()) text += "\n\n" + customAddOn.trim();
      const parsed = await aiGenerate(text);
      const items = detectResponseContent(parsed);
      if (!items || items.length === 0) {
        throw new Error("No actionable content detected in AI response");
      }
      setDetected(items);
      setMode("import");
    } catch (e) {
      console.error("AI generate failed:", e);
      setGenerateError(e.message);
      setTimeout(() => setGenerateError(null), 4000);
    } finally {
      setGeneratingId(null);
    }
  }, [assemblePrompt, modCtx, settings, customAddOn]);

  const handleDownload = useCallback((scenarioId) => {
    const { jsonString } = assemblePrompt(scenarioId, modCtx, settings);
    const blob = new Blob([jsonString], { type: "application/json" });
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${scenarioId}_${ts}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [assemblePrompt, modCtx, settings]);

  // ─── Import: parse ────────────────────────────────────
  const handleParse = useCallback(() => {
    const raw = pasteText.trim();
    if (!raw) { setParseError("Paste some JSON first."); return; }

    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      setParseError(`Invalid JSON: ${e.message}`);
      return;
    }

    const items = detectResponseContent(parsed);
    if (items.length === 0) {
      setParseError("Could not detect any usable content in this response.");
      return;
    }

    setParseError(null);
    setDetected(items);
  }, [pasteText]);

  const resetImport = useCallback(() => {
    setPasteText("");
    setParseError(null);
    setDetected(null);
    setApplyResult(null);
  }, []);

  // ─── Render helpers ───────────────────────────────────

  /** Render a single scenario as a clickable row inside a grid cell */
  const renderScenarioBtn = (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    if (!scenario) return null;
    const unavailable = availability[scenarioId];
    const isCopied = copiedId === scenarioId;
    const isGenerating = generatingId === scenarioId;
    const anyGenerating = generatingId !== null;

    return (
      <div
        key={scenarioId}
        className={`group flex items-center gap-1 px-1.5 py-[3px] rounded transition-colors ${
          unavailable || (anyGenerating && !isGenerating)
            ? "opacity-35 cursor-not-allowed"
            : isGenerating
              ? "bg-amber-50 cursor-wait"
              : "hover:bg-black/5 cursor-pointer"
        }`}
        onClick={() => !unavailable && !anyGenerating && (
          directMode ? handleGenerate(scenarioId) : handleCopy(scenarioId)
        )}
        title={unavailable || (isGenerating ? "Generating…" : scenario.description)}
      >
        {isGenerating
          ? <Loader size={9} className="text-amber-500 animate-spin flex-shrink-0" />
          : actionIcon(scenario.action, 9)
        }
        <span className={`flex-1 text-[10px] font-medium truncate leading-tight ${
          isGenerating ? "text-amber-700" : "text-gray-700"
        }`}>
          {isGenerating ? "Generating…" : scenario.label}
        </span>
        {!unavailable && !isGenerating && (
          <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {isCopied ? (
              <Check size={9} className="text-green-500" />
            ) : directMode ? (
              <Zap size={8} className="text-amber-500" />
            ) : (
              <>
                <Copy size={8} className="text-gray-400" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(scenarioId); }}
                  className="p-0 text-gray-300 hover:text-gray-600"
                  title="Download as JSON"
                >
                  <Download size={8} />
                </button>
              </>
            )}
          </span>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Popup */}
      <div
        ref={popupRef}
        className="absolute right-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
        style={{ width: "min(680px, 92vw)", maxHeight: "min(620px, 80vh)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} style={{ color: iconColor }} />
              <span className="text-[11px] font-semibold text-gray-800">AI I/O</span>
            </div>
            <div className="flex items-center gap-2">
              {selectionStats && mode === "export" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                  {selectionStats}
                </span>
              )}
              {/* Context toggle */}
              {mode === "export" && (
                <button
                  onClick={() => setWithContext(v => !v)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    withContext
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  title={withContext
                    ? "ON: Prompts include existing context for reference"
                    : "OFF: Blank-slate prompts without existing data"
                  }
                >
                  Context {withContext ? "ON" : "OFF"}
                </button>
              )}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-0.5">
            <button
              onClick={() => setMode("export")}
              className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                mode === "export"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Copy size={9} className="inline mr-1 -mt-px" />
              Export Prompt
            </button>
            <button
              onClick={() => setMode("import")}
              className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                mode === "import"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <ClipboardPaste size={9} className="inline mr-1 -mt-px" />
              Import Response
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/*  EXPORT MODE — GRID                            */}
        {/* ═══════════════════════════════════════════════ */}
        {mode === "export" && (
          <div className="flex-1 overflow-y-auto p-2">
            {/* CSS Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr 1fr 1fr",
                gridTemplateRows: "auto",
                gap: "1px",
              }}
              className="bg-gray-200 rounded-lg overflow-hidden border border-gray-200"
            >
              {/* ── Row 0: Column headers ── */}
              <div className="bg-gray-50" style={{ gridColumn: 1, gridRow: 1 }} /> {/* empty corner */}
              {grid.columns.map((col, ci) => (
                <div
                  key={col.key}
                  style={{ gridColumn: ci + 2, gridRow: 1 }}
                  className={`px-2 py-1.5 text-[10px] font-bold text-center uppercase tracking-wide ${colColors[col.key] || "bg-gray-50 text-gray-600"}`}
                >
                  {col.label}
                </div>
              ))}

              {/* ── Grid rows ── */}
              {grid.rows.map((row, ri) => {
                const gridRowIdx = ri + 2; // row 1 = headers, row 2+ = data
                const colIdx = { add: 2, assign: 3, finetune: 4 };

                return (
                <React.Fragment key={row.key}>
                  {/* Row label */}
                  <div
                    className="bg-gray-50 px-2 py-2 flex items-start"
                    style={{ gridColumn: 1, gridRow: gridRowIdx }}
                  >
                    <span className="text-[10px] font-bold text-gray-600 leading-tight">
                      {row.label}
                    </span>
                  </div>

                  {/* Cells */}
                  {grid.columns.map((col) => {
                    const cellKey = `${row.key}:${col.key}`;
                    const cellScenarioIds = grid.cells[cellKey];

                    // Merged cell (categories:assign → null, occupied by span from ideas:assign)
                    if (cellScenarioIds === null) return null;

                    // Shared assign cell spans ideas + categories rows
                    const isSharedAssign = row.key === "ideas" && col.key === "assign";

                    return (
                      <div
                        key={cellKey}
                        className="bg-white px-1 py-1 flex flex-col gap-0"
                        style={{
                          gridColumn: colIdx[col.key],
                          gridRow: isSharedAssign ? `${gridRowIdx} / ${gridRowIdx + 2}` : gridRowIdx,
                        }}
                      >
                        {cellScenarioIds.map(id => renderScenarioBtn(id))}
                      </div>
                    );
                  })}
                </React.Fragment>
                );
              })}
            </div>

            {/* ── Legend picker (for scenarios needing it) ── */}
            {ctx.dims?.legends?.length > 0 && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <span className="text-[9px] text-gray-500 font-medium">Active legend:</span>
                <select
                  value={selectedLegendId || ""}
                  onChange={(e) => setSelectedLegendId(Number(e.target.value) || null)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">Select legend…</option>
                  {ctx.dims.legends.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <span className="text-[8px] text-gray-400 italic">
                  Used by "1 legend →" and "single legend" scenarios
                </span>
              </div>
            )}

            {/* ── Specials section ── */}
            <div className="mt-2">
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-1">
                Specials
              </div>
              <div className="grid grid-cols-2 gap-[1px] bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                {grid.specials.map(id => (
                  <div key={id} className="bg-white px-1 py-0.5">
                    {renderScenarioBtn(id)}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Custom prompt add-on ── */}
            <div className="mt-2 px-1">
              <textarea
                value={customAddOn}
                onChange={(e) => setCustomAddOn(e.target.value)}
                placeholder="Custom add-on to the prompt (appended at the end)…"
                className="w-full text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-gray-400"
                style={{ minHeight: "32px", maxHeight: "120px" }}
                rows={1}
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  IMPORT MODE                                   */}
        {/* ═══════════════════════════════════════════════ */}
        {mode === "import" && (
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">

            {/* Last-copied scenario hint */}
            {lastCopiedScenario && !applyResult && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 rounded border border-amber-200">
                <Check size={10} className="text-amber-600 flex-shrink-0" />
                <span className="text-[10px] text-amber-800 truncate">
                  <span className="font-medium">{lastCopiedScenario.label}</span>
                  <span className="text-amber-600"> prompt copied — paste the AI response below</span>
                </span>
              </div>
            )}

            {/* ── Apply result screen ── */}
            {applyResult ? (
              <div className="flex flex-col gap-2 py-2">
                {applyResult.created.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
                    <div className="text-[11px] font-semibold text-green-800 mb-1">Applied successfully</div>
                    {applyResult.created.map((msg, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] text-green-700">
                        <Check size={9} className="flex-shrink-0" />
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
                {applyResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                    <div className="text-[11px] font-semibold text-red-800 mb-1">Errors</div>
                    {applyResult.errors.map((msg, i) => (
                      <div key={i} className="text-[10px] text-red-600">{msg}</div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={resetImport}
                    className="flex-1 text-[10px] py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Import another
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 text-[10px] py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : detected ? (
              /* ── Controlled review & apply ── */
              <ControlledApplyModal
                detected={detected}
                applyCtx={applyCtx}
                onResult={setApplyResult}
                onClose={() => { setDetected(null); setParseError(null); }}
              />
            ) : (
              /* ── Paste textarea ── */
              <>
                {lastCopiedScenario?.expectedFormat && (
                  <details className="group">
                    <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                      Expected format
                    </summary>
                    <pre className="text-[9px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 mt-1 overflow-x-auto max-h-32 overflow-y-auto font-mono">
                      {lastCopiedScenario.expectedFormat}
                    </pre>
                  </details>
                )}

                <textarea
                  ref={pasteRef}
                  value={pasteText}
                  onChange={(e) => { setPasteText(e.target.value); setParseError(null); }}
                  placeholder="Paste the AI's JSON response here…"
                  className="w-full font-mono text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-300 placeholder:text-gray-400"
                  style={{ minHeight: "120px", maxHeight: "300px" }}
                />

                {parseError && (
                  <div className="flex items-start gap-1.5 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-600">
                    <AlertCircle size={10} className="flex-shrink-0 mt-0.5" />
                    {parseError}
                  </div>
                )}

                <button
                  onClick={handleParse}
                  disabled={!pasteText.trim()}
                  className="w-full text-[10px] py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium transition-colors"
                >
                  Parse & Preview
                </button>

                <p className="text-[9px] text-gray-400">
                  Supports JSON objects, arrays, and JSON inside markdown code fences.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] flex-shrink-0 flex items-center gap-2">
          {generateError ? (
            <span className="text-red-500 font-medium">{generateError}</span>
          ) : (
            <span className="text-gray-400">
              {mode === "export"
                ? directMode
                  ? "Click scenario to generate directly via OpenAI"
                  : "Click scenario to copy prompt · switches to Import after copy"
                : "Paste AI response · preview & apply"
              }
            </span>
          )}
          {directMode && mode === "export" && (
            <span className="ml-auto flex items-center gap-0.5 text-amber-500 font-medium">
              <Zap size={8} /> Direct
            </span>
          )}
        </div>
      </div>
    </>
  );
}
