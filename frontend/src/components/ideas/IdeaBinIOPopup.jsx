import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Copy, Download, Check, ChevronRight, ChevronDown,
  Plus, RefreshCw, Search as SearchIcon, AlertCircle, Sparkles,
  ClipboardPaste,
} from "lucide-react";
import { detectResponseContent } from "../shared/promptEngine/responseApplier";
import ControlledApplyPanel from "../shared/promptEngine/ControlledApplyPanel";

/**
 * ═══════════════════════════════════════════════════════════
 *  IdeaBinIOPopup
 *  ──────────────
 *  Two-mode popup:
 *   • Export – scenario list, click to copy prompt to clipboard
 *   • Import – paste AI response, preview & apply
 *
 *  After copying a scenario the popup transitions to Import
 *  mode, pre-loaded with the expected format hint.
 *
 *  Props:
 *    scenarios       – array of scenario definitions
 *    groups          – ordered group labels
 *    ctx             – data context for availability + payload
 *    settings        – user's prompt settings
 *    assemblePrompt  – (scenarioId, ctx, settings) => { text, json, jsonString }
 *    applyCtx        – object with API functions for applying responses
 *    onClose         – close callback
 *    iconColor       – title bar icon colour (for theming)
 * ═══════════════════════════════════════════════════════════
 */
export default function IdeaBinIOPopup({
  scenarios, groups, ctx, settings, assemblePrompt, applyCtx, onClose, iconColor = "#92400e",
}) {
  // ─── Shared state ─────────────────────────────────────
  const [mode, setMode] = useState("export"); // "export" | "import"
  const [copiedId, setCopiedId] = useState(null);
  const [lastCopiedScenario, setLastCopiedScenario] = useState(null);

  // ─── Export state ─────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef(null);

  // ─── Import state ─────────────────────────────────────
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState(null);
  const [detected, setDetected] = useState(null);     // null | Array
  const [applyResult, setApplyResult] = useState(null); // null | { created, errors }
  const pasteRef = useRef(null);

  const popupRef = useRef(null);

  // Auto-focus on mode switch
  useEffect(() => {
    if (mode === "export") searchRef.current?.focus();
    else pasteRef.current?.focus();
  }, [mode]);

  // Action icons by scenario action type
  const actionIcon = (action) => {
    if (action === "add") return <Plus size={11} className="text-green-500 flex-shrink-0" />;
    if (action === "overwork") return <RefreshCw size={11} className="text-blue-500 flex-shrink-0" />;
    if (action === "analyse") return <SearchIcon size={11} className="text-purple-500 flex-shrink-0" />;
    return <Sparkles size={11} className="text-gray-400 flex-shrink-0" />;
  };

  // Compute availability for each scenario
  const availability = useMemo(() => {
    const map = {};
    scenarios.forEach(s => {
      map[s.id] = s.unavailableMsg(ctx);
    });
    return map;
  }, [scenarios, ctx]);

  // Filter by search
  const filteredScenarios = useMemo(() => {
    if (!searchQuery.trim()) return scenarios;
    const q = searchQuery.toLowerCase();
    return scenarios.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q)
    );
  }, [scenarios, searchQuery]);

  // Group scenarios
  const groupedScenarios = useMemo(() => {
    const map = new Map();
    groups.forEach(g => map.set(g, []));
    filteredScenarios.forEach(s => {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group).push(s);
    });
    for (const [k, v] of map) {
      if (v.length === 0) map.delete(k);
    }
    return map;
  }, [filteredScenarios, groups]);

  // Selection stats for header
  const selectionStats = useMemo(() => {
    const parts = [];
    if (ctx.selectedIdeaIds?.size > 0) parts.push(`${ctx.selectedIdeaIds.size} idea${ctx.selectedIdeaIds.size > 1 ? "s" : ""}`);
    if (ctx.selectedCategoryIds?.size > 0) parts.push(`${ctx.selectedCategoryIds.size} cat${ctx.selectedCategoryIds.size > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") + " selected" : null;
  }, [ctx.selectedIdeaIds, ctx.selectedCategoryIds]);

  const toggleGroup = useCallback((group) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }, []);

  // ─── Export: copy prompt ──────────────────────────────
  const handleCopy = useCallback(async (scenarioId) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    const { text } = assemblePrompt(scenarioId, ctx, settings);
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
      // Auto-switch to import mode after brief "Copied" flash
      setMode("import");
    }, 800);
  }, [assemblePrompt, ctx, settings, scenarios]);

  const handleDownload = useCallback((scenarioId) => {
    const { jsonString } = assemblePrompt(scenarioId, ctx, settings);
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
  }, [assemblePrompt, ctx, settings]);

  // ─── Import: parse ────────────────────────────────────
  const handleParse = useCallback(() => {
    const raw = pasteText.trim();
    if (!raw) { setParseError("Paste some JSON first."); return; }

    // Try to extract JSON from markdown code blocks
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

  // ─── Import: reset ────────────────────────────────────
  const resetImport = useCallback(() => {
    setPasteText("");
    setParseError(null);
    setDetected(null);
    setApplyResult(null);
  }, []);

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
        style={{ width: "min(380px, 90vw)", maxHeight: "min(560px, 75vh)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header with mode tabs ── */}
        <div className="px-3 pt-2 pb-1.5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} style={{ color: iconColor }} />
              <span className="text-[11px] font-semibold text-gray-800">AI I/O</span>
            </div>
            {selectionStats && mode === "export" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                {selectionStats}
              </span>
            )}
          </div>
          {/* Mode tabs */}
          <div className="flex gap-0.5 mb-1">
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

          {/* Search (export only) */}
          {mode === "export" && (
            <div className="relative">
              <SearchIcon size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenarios…"
                className="w-full text-[10px] pl-6 pr-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-amber-400 bg-gray-50"
              />
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/*  EXPORT MODE                                   */}
        {/* ═══════════════════════════════════════════════ */}
        {mode === "export" && (
          <div className="flex-1 overflow-y-auto py-1">
            {groupedScenarios.size === 0 && (
              <div className="px-3 py-4 text-[10px] text-gray-400 text-center italic">
                No matching scenarios
              </div>
            )}
            {[...groupedScenarios.entries()].map(([group, items]) => (
              <div key={group}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors"
                >
                  {collapsedGroups.has(group)
                    ? <ChevronRight size={10} />
                    : <ChevronDown size={10} />
                  }
                  {group}
                  <span className="text-[8px] font-normal text-gray-400 ml-auto">
                    {items.filter(s => !availability[s.id]).length}/{items.length}
                  </span>
                </button>

                {/* Scenario items */}
                {!collapsedGroups.has(group) && items.map(scenario => {
                  const unavailable = availability[scenario.id];
                  const isCopied = copiedId === scenario.id;

                  return (
                    <div
                      key={scenario.id}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 mx-1 rounded transition-colors ${
                        unavailable
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-amber-50 cursor-pointer"
                      }`}
                      onClick={() => !unavailable && handleCopy(scenario.id)}
                      title={unavailable || scenario.description}
                    >
                      {actionIcon(scenario.action)}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-gray-800 font-medium truncate leading-tight">
                          {scenario.label}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate leading-tight">
                          {unavailable ? (
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <AlertCircle size={8} />
                              {unavailable}
                            </span>
                          ) : scenario.description}
                        </div>
                      </div>
                      {!unavailable && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {isCopied ? (
                            <span className="flex items-center gap-0.5 text-green-500 text-[9px] font-medium">
                              <Check size={10} />
                              Copied
                            </span>
                          ) : (
                            <>
                              <Copy size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownload(scenario.id); }}
                                className="p-0.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                                title="Download as JSON file"
                              >
                                <Download size={10} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
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
              <ControlledApplyPanel
                detected={detected}
                applyCtx={applyCtx}
                onResult={setApplyResult}
                onBack={() => { setDetected(null); setParseError(null); }}
              />
            ) : (
              /* ── Paste textarea ── */
              <>
                {/* Format hint from last-copied scenario */}
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
        <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400">
          {mode === "export"
            ? "Click to copy prompt · switches to Import after copy"
            : "Paste AI response · preview & apply"
          }
        </div>
      </div>
    </>
  );
}
