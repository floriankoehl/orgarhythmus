import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Copy, Download, Check, Plus, Pencil,
  AlertCircle, Sparkles,
  ClipboardPaste, ArrowRightLeft, Star,
  AlertTriangle,
} from "lucide-react";
import { detectDepResponseContent } from "../components/shared/promptEngine/depResponseApplier";
import ControlledApplyModal from "../components/shared/promptEngine/ControlledApplyPanel";
import { buildDepChangeItems, recomposeDepDetected, DEP_CHANGE_TYPE_META } from "../components/shared/promptEngine/depChangeBuilder";
import { applyDepDetected } from "../components/shared/promptEngine/depResponseApplier";

/**
 * ═══════════════════════════════════════════════════════════
 *  DependencyIOPopup  —  Grid Layout
 *  ──────────────────────────────────
 *  Two-mode popup:
 *   • Export – 3×2 grid (Add / Finetune × Tasks /
 *     Milestones / Dependencies) + Specials row + context toggle
 *   • Import – paste AI response, preview & apply
 *             with conflict detection for scheduling violations
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
 *    onResolveStart  – optional (info) => void — called when entering conflict resolve mode
 *    onResolveEnd    – optional () => void — called when exiting resolve mode
 *    resolveActive   – optional boolean — true when in resolve mode (from adapter)
 * ═══════════════════════════════════════════════════════════
 */
export default function DependencyIOPopup({
  scenarios, grid, ctx, settings, assemblePrompt, applyCtx, onClose, iconColor = "#0ea5e9",
  onResolveStart, onResolveEnd, resolveActive,
}) {
  // ─── Shared state ─────────────────────────────────────
  const [mode, setMode] = useState("export");
  const [copiedId, setCopiedId] = useState(null);
  const [lastCopiedScenario, setLastCopiedScenario] = useState(null);

  // ─── Export state ─────────────────────────────────────
  const [withContext, setWithContext] = useState(true);

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

  // Modified ctx with context toggle
  const modCtx = useMemo(() => ({
    ...ctx,
    _withContext: withContext,
  }), [ctx, withContext]);

  // Compute availability for each scenario
  const availability = useMemo(() => {
    const map = {};
    scenarios.forEach(s => {
      const msg = s.unavailableMsg(ctx);
      map[s.id] = msg;
    });
    return map;
  }, [scenarios, ctx]);

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

  const colColors = {
    add: "text-green-700 bg-green-50",
    finetune: "text-blue-700 bg-blue-50",
  };

  // ─── Export: copy prompt ──────────────────────────────
  const handleCopy = useCallback(async (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    const { text } = assemblePrompt(scenarioId, modCtx, settings);
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
  }, [assemblePrompt, modCtx, settings, scenarioMap]);

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

  // Wrap buildDepChangeItems to pass nodes/rows/lanes context
  const buildChangeItemsWithCtx = useCallback((det) => {
    return buildDepChangeItems(det, ctx.nodes || {}, ctx.rows || {}, ctx.lanes || {});
  }, [ctx.nodes, ctx.rows, ctx.lanes]);

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

    const items = detectDepResponseContent(parsed);
    if (items.length === 0) {
      setParseError("Could not detect any milestone/dependency content in this response.");
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

  // ─── Resolve conflict handler ─────────────────────────
  const handleResolve = useCallback((changeItem) => {
    if (!onResolveStart || !changeItem.detail) return;
    onResolveStart({
      sourceId: changeItem.detail.sourceId,
      targetId: changeItem.detail.targetId,
      sourceName: changeItem.detail.sourceName,
      targetName: changeItem.detail.targetName,
      changeItemId: changeItem.id,
    });
  }, [onResolveStart]);

  // ─── Render helpers ───────────────────────────────────

  const renderScenarioBtn = (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    if (!scenario) return null;
    const unavailable = availability[scenarioId];
    const isCopied = copiedId === scenarioId;

    return (
      <div
        key={scenarioId}
        className={`group flex items-center gap-1 px-1.5 py-[3px] rounded transition-colors ${
          unavailable
            ? "opacity-35 cursor-not-allowed"
            : "hover:bg-black/5 cursor-pointer"
        }`}
        onClick={() => !unavailable && handleCopy(scenarioId)}
        title={unavailable || scenario.description}
      >
        {actionIcon(scenario.action, 9)}
        <span className="flex-1 text-[10px] text-gray-700 font-medium truncate leading-tight">
          {scenario.label}
        </span>
        {!unavailable && (
          <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {isCopied ? (
              <Check size={9} className="text-green-500" />
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

  // When resolving, hide popup UI but keep everything mounted to preserve state
  const hidePopup = resolveActive;

  return (
    <>
      {/* Backdrop — hidden during resolve */}
      {!hidePopup && <div className="fixed inset-0 z-[9998]" onClick={onClose} />}

      {/* Popup — hidden during resolve */}
      <div
        ref={popupRef}
        className="absolute right-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col"
        style={{ width: "min(580px, 92vw)", maxHeight: "min(580px, 80vh)", display: hidePopup ? "none" : undefined }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} style={{ color: iconColor }} />
              <span className="text-[11px] font-semibold text-gray-800">AI I/O — Dependencies</span>
            </div>
            <div className="flex items-center gap-2">
              {mode === "export" && (
                <button
                  onClick={() => setWithContext(v => !v)}
                  className={`text-[9px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    withContext
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  title={withContext
                    ? "ON: Prompts include existing milestones/dependencies"
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
                  ? "bg-sky-100 text-sky-800"
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
            {/* CSS Grid — 3 rows × 2 columns */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr 1fr",
                gridTemplateRows: "auto",
                gap: "1px",
              }}
              className="bg-gray-200 rounded-lg overflow-hidden border border-gray-200"
            >
              {/* Row 0: Column headers */}
              <div className="bg-gray-50" style={{ gridColumn: 1, gridRow: 1 }} />
              {grid.columns.map((col, ci) => (
                <div
                  key={col.key}
                  style={{ gridColumn: ci + 2, gridRow: 1 }}
                  className={`px-2 py-1.5 text-[10px] font-bold text-center uppercase tracking-wide ${colColors[col.key] || "bg-gray-50 text-gray-600"}`}
                >
                  {col.label}
                </div>
              ))}

              {/* Grid rows */}
              {grid.rows.map((row, ri) => {
                const gridRowIdx = ri + 2;
                const colIdx = { add: 2, finetune: 3 };

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
                      if (cellScenarioIds === null) return null;

                      return (
                        <div
                          key={cellKey}
                          className="bg-white px-1 py-1 flex flex-col gap-0"
                          style={{
                            gridColumn: colIdx[col.key],
                            gridRow: gridRowIdx,
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

            {/* Specials section */}
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  IMPORT MODE                                   */}
        {/* ═══════════════════════════════════════════════ */}
        {mode === "import" && (
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">

            {/* Last-copied scenario hint */}
            {lastCopiedScenario && !applyResult && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-sky-50 rounded border border-sky-200">
                <Check size={10} className="text-sky-600 flex-shrink-0" />
                <span className="text-[10px] text-sky-800 truncate">
                  <span className="font-medium">{lastCopiedScenario.label}</span>
                  <span className="text-sky-600"> prompt copied — paste the AI response below</span>
                </span>
              </div>
            )}

            {/* Apply result screen */}
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
                {applyResult.conflicts?.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded px-3 py-2">
                    <div className="text-[11px] font-semibold text-orange-800 mb-1 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      Scheduling Conflicts
                    </div>
                    <p className="text-[9px] text-orange-600 mb-1.5">
                      These dependencies were created but violate scheduling rules.
                      Adjust milestone positions in the grid to resolve them.
                    </p>
                    {applyResult.conflicts.map((c, i) => (
                      <div key={i} className="text-[10px] text-orange-700 mb-1">
                        <span className="font-medium">"{c.sourceName}" → "{c.targetName}"</span>
                        <span className="text-orange-500 ml-1">
                          (source ends day {c.sourceEnd}, target starts day {c.targetStart})
                        </span>
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
              <ControlledApplyModal
                detected={detected}
                applyCtx={applyCtx}
                onResult={setApplyResult}
                onClose={() => { setDetected(null); setParseError(null); }}
                buildChangeItemsFn={buildChangeItemsWithCtx}
                recomposeDetectedFn={recomposeDepDetected}
                applyDetectedFn={applyDepDetected}
                changeTypeMeta={DEP_CHANGE_TYPE_META}
                onResolve={onResolveStart ? handleResolve : undefined}
                paused={resolveActive}
              />
            ) : (
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
                  className="w-full font-mono text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 resize-y focus:outline-none focus:ring-1 focus:ring-sky-300 placeholder:text-gray-400"
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
                  className="w-full text-[10px] py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 font-medium transition-colors"
                >
                  Parse & Preview
                </button>

                <p className="text-[9px] text-gray-400">
                  Supports JSON objects, arrays, and JSON inside markdown code fences.
                  Scheduling conflicts will be highlighted for manual resolution.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400 flex-shrink-0">
          {mode === "export"
            ? "Click scenario to copy prompt · switches to Import after copy"
            : "Paste AI response · preview & apply · conflicts shown for manual fix"
          }
        </div>
      </div>
    </>
  );
}
