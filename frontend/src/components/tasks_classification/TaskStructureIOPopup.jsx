import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
  Copy, Download, Check, Plus, Pencil,
  AlertCircle, Sparkles,
  ClipboardPaste, ArrowRightLeft, Star, Zap, Loader, Eye, Maximize2, Minimize2, Settings,
  RotateCcw, Save, ChevronDown,
} from "lucide-react";
import { detectTaskResponseContent } from "../shared/promptEngine/taskResponseApplier";
import ControlledApplyModal from "../shared/promptEngine/ControlledApplyPanel";
import { buildTaskChangeItems, recomposeTaskDetected, TASK_CHANGE_TYPE_META } from "../shared/promptEngine/taskChangeBuilder";
import { applyTaskDetected } from "../shared/promptEngine/taskResponseApplier";
import { aiGenerate, getDirectMode } from "../../api/aiGenerateApi";
import { assemblePromptSections } from "../shared/promptEngine/assembler";
import PromptInspector from "../shared/promptEngine/PromptInspector";
import usePromptSettings from "../usePromptSettings";

/**
 * ═══════════════════════════════════════════════════════════
 *  TaskStructureIOPopup  —  Grid Layout
 *  ─────────────────────────────────────
 *  Two-mode popup:
 *   • Export – 2×3 grid (Add / Assign / Finetune × Tasks /
 *     Teams) + Specials row + context toggle
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
export default function TaskStructureIOPopup({
  scenarios, grid, ctx, settings, assemblePrompt, applyCtx, onClose, iconColor = "#6366f1",
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
  // ─── Inspect mode ─────────────────────────────────
  const [inspectData, setInspectData] = useState(null);
  // ─── Expand mode ──────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  // ─── Settings mode ────────────────────────────────
  const [settingsMode, setSettingsMode] = useState(false);
  const { settings: ownSettings, update: updateSettings } = usePromptSettings();
  const effectiveSettings = ownSettings || settings;
  // Local editable state for in-grid prompt editing
  const [localScenarioPrompts, setLocalScenarioPrompts] = useState({});
  const [localSystemPrompt, setLocalSystemPrompt] = useState("");
  const [localEndPrompt, setLocalEndPrompt] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [collapsedScenarios, setCollapsedScenarios] = useState(new Set());
  useEffect(() => {
    if (settingsMode && effectiveSettings) {
      setLocalScenarioPrompts({ ...(effectiveSettings.scenario_prompts || {}) });
      setLocalSystemPrompt(effectiveSettings.system_prompt || "");
      setLocalEndPrompt(effectiveSettings.end_prompt || "");
      setCollapsedScenarios(new Set());
    }
  }, [settingsMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─── Export state ─────────────────────────────────────
  const [withContext, setWithContext] = useState(true);

  // ─── Import state ─────────────────────────────────────
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState(null);
  const [detected, setDetected] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const pasteRef = useRef(null);

  const popupRef = useRef(null);
  const dragRef = useRef(null);
  const [popupDims, setPopupDims] = useState({ width: 820, height: 700 });
  const [fixedPos, setFixedPos] = useState(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);

  const handleResizeMouseDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startWidth: rect.width, startHeight: rect.height };
    const onMouseMove = (mv) => {
      if (!dragRef.current) return;
      const { handle: h, startX, startY, startWidth, startHeight } = dragRef.current;
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      const newWidth = h === "bl"
        ? Math.max(440, Math.min(window.innerWidth * 0.97, startWidth - dx))
        : Math.max(440, Math.min(window.innerWidth * 0.97, startWidth + dx));
      const newHeight = Math.max(320, Math.min(window.innerHeight * 0.94, startHeight + dy));
      setPopupDims({ width: newWidth, height: newHeight });
    };
    const onMouseUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  useLayoutEffect(() => {
    if (!popupRef.current) return;
    const parent = popupRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    setFixedPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, []);

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

  // Selection stats
  const selectionStats = useMemo(() => {
    const parts = [];
    if (ctx.selectedTaskIds?.size > 0) parts.push(`${ctx.selectedTaskIds.size} task${ctx.selectedTaskIds.size > 1 ? "s" : ""}`);
    if (ctx.selectedTeamIds?.size > 0) parts.push(`${ctx.selectedTeamIds.size} team${ctx.selectedTeamIds.size > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") + " selected" : null;
  }, [ctx.selectedTaskIds, ctx.selectedTeamIds]);

  // Auto-focus paste area on import modedd
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
  const handleSettingsSave = useCallback(async () => {
    setSettingsSaving(true);
    try {
      await updateSettings({
        ...effectiveSettings,
        system_prompt: localSystemPrompt,
        end_prompt: localEndPrompt,
        scenario_prompts: { ...(effectiveSettings?.scenario_prompts || {}), ...localScenarioPrompts },
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 1500);
    } finally {
      setSettingsSaving(false);
    }
  }, [effectiveSettings, localSystemPrompt, localEndPrompt, localScenarioPrompts, updateSettings]);

  const handleCopy = useCallback(async (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    let { text } = assemblePrompt(scenarioId, modCtx, effectiveSettings);
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
  }, [assemblePrompt, modCtx, effectiveSettings, scenarioMap, customAddOn]);

  // ─── Export: direct AI generate ────────────────────────
  const handleGenerate = useCallback(async (scenarioId) => {
    setGeneratingId(scenarioId);
    setGenerateError(null);
    try {
      let { text } = assemblePrompt(scenarioId, modCtx, effectiveSettings);
      if (customAddOn.trim()) text += "\n\n" + customAddOn.trim();
      const parsed = await aiGenerate(text);
      const items = detectTaskResponseContent(parsed);
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
  }, [assemblePrompt, modCtx, effectiveSettings, customAddOn]);

  const handleDownload = useCallback((scenarioId) => {
    const { jsonString } = assemblePrompt(scenarioId, modCtx, effectiveSettings);
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
  }, [assemblePrompt, modCtx, effectiveSettings]);

  // ─── Inspect: show prompt sections ────────────────────
  const handleInspect = useCallback((scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    const { sections } = assemblePromptSections(scenarioId, modCtx, effectiveSettings);
    setInspectData({ scenarioId, scenario, sections });
    setMode("inspect");
  }, [scenarioMap, modCtx, effectiveSettings]);

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

    const items = detectTaskResponseContent(parsed);
    if (items.length === 0) {
      setParseError("Could not detect any usable task/team content in this response.");
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

  /** In settings mode: collapsible editable block for a scenario's prompt */
  const renderScenarioEditor = (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    if (!scenario) return null;
    const rawCustom = localScenarioPrompts[scenarioId] ?? (effectiveSettings?.scenario_prompts?.[scenarioId] || "");
    const displayValue = rawCustom || (scenario.defaultPrompt || "");
    const isShowingDefault = !rawCustom;
    const isCustomised = rawCustom && rawCustom !== (scenario.defaultPrompt || "");
    const isCollapsed = collapsedScenarios.has(scenarioId);
    const toggleCollapse = () => setCollapsedScenarios(prev => {
      const next = new Set(prev);
      next.has(scenarioId) ? next.delete(scenarioId) : next.add(scenarioId);
      return next;
    });
    return (
      <div key={scenarioId} className="px-1.5 py-1 flex flex-col gap-0.5">
        <div
          className="flex items-center gap-1 cursor-pointer select-none group/hdr"
          onClick={toggleCollapse}
        >
          {actionIcon(scenario.action, 8)}
          <span className="text-[9px] font-semibold text-gray-600 flex-1 truncate">{scenario.label}</span>
          {isCustomised && (
            <button
              onClick={(e) => { e.stopPropagation(); setLocalScenarioPrompts(p => ({ ...p, [scenarioId]: "" })); }}
              className="text-gray-300 hover:text-violet-500 transition-colors flex-shrink-0"
              title="Reset to default"
            >
              <RotateCcw size={7} />
            </button>
          )}
          <ChevronDown
            size={8}
            className={`text-gray-300 group-hover/hdr:text-gray-500 flex-shrink-0 transition-transform duration-150 ${isCollapsed ? "-rotate-90" : ""}`}
          />
        </div>
        {!isCollapsed && (
          <textarea
            value={displayValue}
            onChange={e => setLocalScenarioPrompts(p => ({ ...p, [scenarioId]: e.target.value }))}
            ref={el => { if (el) { el.style.height = "auto"; el.style.height = Math.max(48, el.scrollHeight) + "px"; } }}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.max(48, e.target.scrollHeight) + "px"; }}
            className={`w-full text-[9px] p-1.5 rounded border bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-300 font-sans ${
              isShowingDefault ? "text-gray-500 italic border-gray-200" : "text-gray-700 border-gray-200"
            }`}
            style={{ minHeight: "48px", resize: "none", overflow: "hidden" }}
          />
        )}
      </div>
    );
  };

  /** Render a single scenario as a clickable row inside a grid cell */
  const renderScenarioBtn = (scenarioId) => {
    const scenario = scenarioMap.get(scenarioId);
    if (!scenario) return null;
    const unavailable = availability[scenarioId];
    const isCopied = copiedId === scenarioId;
    const isGenerating = generatingId === scenarioId;
    const anyGenerating = generatingId !== null;
    const isSelected = selectedScenarioId === scenarioId;

    return (
      <div
        key={scenarioId}
        className={`group flex items-center gap-1 px-1.5 py-[3px] rounded transition-colors ${
          unavailable || (anyGenerating && !isGenerating)
            ? "opacity-35 cursor-not-allowed"
            : isGenerating
              ? "bg-amber-50 cursor-wait"
              : isSelected
                ? "bg-violet-100 cursor-pointer"
                : "hover:bg-black/5 cursor-pointer"
        }`}
        onClick={() => !unavailable && !anyGenerating && !isGenerating &&
          setSelectedScenarioId(id => id === scenarioId ? null : scenarioId)
        }
        title={unavailable || (isGenerating ? "Generating…" : scenario.description)}
      >
        {isGenerating
          ? <Loader size={9} className="text-amber-500 animate-spin flex-shrink-0" />
          : actionIcon(scenario.action, 9)
        }
        <span className={`flex-1 text-[10px] font-medium truncate leading-tight ${
          isGenerating ? "text-amber-700" : isSelected ? "text-violet-700" : "text-gray-700"
        }`}>
          {isGenerating ? "Generating…" : scenario.label}
        </span>
        {isCopied && <Check size={9} className="text-green-500 flex-shrink-0" />}
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
        className={`${expanded ? "fixed top-[4vh] left-1/2 -translate-x-1/2" : "fixed"} z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col overflow-hidden`}
        style={expanded ? {
          width: "min(1100px, 98vw)",
          height: "94vh",
        } : {
          top: fixedPos ? `${fixedPos.top}px` : 0,
          right: fixedPos ? `${fixedPos.right}px` : 0,
          visibility: fixedPos ? "visible" : "hidden",
          width: `${popupDims.width}px`,
          height: `${popupDims.height}px`,
          minWidth: "440px",
          minHeight: "320px",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} style={{ color: iconColor }} />
              <span className="text-[11px] font-semibold text-gray-800">AI I/O — Tasks</span>
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
              {settingsMode && (
                <button
                  onClick={handleSettingsSave}
                  disabled={settingsSaving}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
                    settingsSaved ? "bg-green-500 text-white" : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                  }`}
                >
                  {settingsSaved ? <Check size={9} /> : <Save size={9} />}
                  {settingsSaved ? "Saved" : "Save"}
                </button>
              )}
              <button
                onClick={() => setSettingsMode(v => !v)}
                className={`p-1 rounded transition-colors ${settingsMode ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`}
                title="Prompt settings for this window"
              >
                <Settings size={11} />
              </button>
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title={expanded ? "Collapse window" : "Expand window"}
              >
                {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-0.5" style={{ display: (mode === "inspect" || settingsMode) ? "none" : undefined }}>
            <button
              onClick={() => setMode("export")}
              className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                mode === "export"
                  ? "bg-indigo-100 text-indigo-800"
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

        {/* ── Selected scenario action bar ── */}
        {mode === "export" && !settingsMode && selectedScenarioId && (() => {
          const scenario = scenarioMap.get(selectedScenarioId);
          if (!scenario) return null;
          return (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 border-b border-violet-100 flex-shrink-0">
              <span className="text-[9px] font-semibold text-violet-700 flex-1 truncate">{scenario.label}</span>
              <button
                onClick={() => handleInspect(selectedScenarioId)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
                title="Inspect &amp; edit prompt sections"
              >
                <Eye size={8} /> Inspect
              </button>
              <button
                onClick={() => directMode ? handleGenerate(selectedScenarioId) : handleCopy(selectedScenarioId)}
                disabled={generatingId !== null}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors disabled:opacity-40 ${
                  directMode ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-violet-600 text-white hover:bg-violet-700"
                }`}
              >
                {directMode
                  ? <><Zap size={8} /> Send</>
                  : copiedId === selectedScenarioId
                    ? <><Check size={8} /> Copied!</>
                    : <><Copy size={8} /> Copy</>
                }
              </button>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════ */}
        {/*  EXPORT / SETTINGS MODE — GRID                */}
        {/* ═══════════════════════════════════════════════ */}
        {(mode === "export" || settingsMode) && (
          <div className="flex-1 overflow-y-auto p-2">
            {/* ── Settings: system / end prompt editors ── */}
            {settingsMode && (
              <div className="flex gap-2 mb-2 p-2 bg-violet-50 border border-violet-100 rounded-lg">
                <div className="flex-1">
                  <label className="text-[8px] font-bold text-violet-600 uppercase tracking-wider">System Prompt</label>
                  <textarea
                    value={localSystemPrompt}
                    onChange={e => setLocalSystemPrompt(e.target.value)}
                    placeholder="You are a helpful project management AI…"
                    className="w-full mt-0.5 text-[9px] p-1 rounded border border-violet-200 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 placeholder:text-gray-300 font-sans"
                    rows={2}
                    style={{ minHeight: "28px", maxHeight: "80px" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[8px] font-bold text-violet-600 uppercase tracking-wider">End Prompt</label>
                  <textarea
                    value={localEndPrompt}
                    onChange={e => setLocalEndPrompt(e.target.value)}
                    placeholder="Return only valid JSON, no markdown…"
                    className="w-full mt-0.5 text-[9px] p-1 rounded border border-violet-200 bg-white resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 placeholder:text-gray-300 font-sans"
                    rows={2}
                    style={{ minHeight: "28px", maxHeight: "80px" }}
                  />
                </div>
              </div>
            )}
            {/* CSS Grid — 2 rows × 3 columns */}
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

                    // Merged cell (teams:assign → null, occupied by span from tasks:assign)
                    if (cellScenarioIds === null) return null;

                    // Shared assign cell spans tasks + teams rows
                    const isSharedAssign = row.key === "tasks" && col.key === "assign";

                    return (
                      <div
                        key={cellKey}
                        className="bg-white px-1 py-1 flex flex-col gap-0"
                        style={{
                          gridColumn: colIdx[col.key],
                          gridRow: isSharedAssign ? `${gridRowIdx} / ${gridRowIdx + 2}` : gridRowIdx,
                        }}
                      >
                        {cellScenarioIds.map(id => settingsMode ? renderScenarioEditor(id) : renderScenarioBtn(id))}
                      </div>
                    );
                  })}
                </React.Fragment>
                );
              })}
            </div>

            {/* ── Specials section ── */}
            <div className="mt-2">
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-1 mb-1">
                Specials
              </div>
              <div className="grid grid-cols-2 gap-[1px] bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                {grid.specials.map(id => (
                  <div key={id} className="bg-white px-1 py-0.5">
                    {settingsMode ? renderScenarioEditor(id) : renderScenarioBtn(id)}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Custom prompt add-on (export mode only) ── */}
            {!settingsMode && (
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
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  INSPECT MODE                                  */}
        {/* ═══════════════════════════════════════════════ */}
        {!settingsMode && mode === "inspect" && inspectData && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <PromptInspector
              sections={inspectData.sections}
              scenarioLabel={inspectData.scenario?.label}
              directMode={directMode}
              isGenerating={generatingId === inspectData.scenarioId}
              customAddOn={customAddOn}
              onCustomAddOnChange={setCustomAddOn}
              onCopy={async (text) => {
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
                setCopiedId(inspectData.scenarioId);
                setLastCopiedScenario(inspectData.scenario || null);
                setInspectData(null);
                setTimeout(() => { setCopiedId(null); setMode("import"); }, 800);
              }}
              onGenerate={async (text) => {
                const sid = inspectData.scenarioId;
                setGeneratingId(sid);
                setGenerateError(null);
                setInspectData(null);
                setMode("import");
                try {
                  const parsed = await aiGenerate(text);
                  const items = detectTaskResponseContent(parsed);
                  if (!items || items.length === 0) throw new Error("No actionable content detected in AI response");
                  setDetected(items);
                } catch (e) {
                  console.error("AI generate failed:", e);
                  setGenerateError(e.message);
                  setTimeout(() => setGenerateError(null), 4000);
                } finally {
                  setGeneratingId(null);
                }
              }}
              onBack={() => { setInspectData(null); setMode("export"); }}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  IMPORT MODE                                   */}
        {/* ═══════════════════════════════════════════════ */}
        {!settingsMode && mode === "import" && (
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">

            {/* Last-copied scenario hint */}
            {lastCopiedScenario && !applyResult && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 rounded border border-indigo-200">
                <Check size={10} className="text-indigo-600 flex-shrink-0" />
                <span className="text-[10px] text-indigo-800 truncate">
                  <span className="font-medium">{lastCopiedScenario.label}</span>
                  <span className="text-indigo-600"> prompt copied — paste the AI response below</span>
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
              /* ── Controlled review & apply (using task-domain functions) ── */
              <ControlledApplyModal
                detected={detected}
                applyCtx={applyCtx}
                onResult={setApplyResult}
                onClose={() => { setDetected(null); setParseError(null); }}
                buildChangeItemsFn={buildTaskChangeItems}
                recomposeDetectedFn={recomposeTaskDetected}
                applyDetectedFn={applyTaskDetected}
                changeTypeMeta={TASK_CHANGE_TYPE_META}
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
                ? "Select a scenario · then Copy or Send from the action bar above"
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

        {/* ── Resize handles ── */}
        {!expanded && (<>
          <div onMouseDown={(e) => handleResizeMouseDown(e, "bl")} className="absolute bottom-0 left-0 w-5 h-5 z-10 cursor-sw-resize flex items-end justify-start p-1 opacity-40 hover:opacity-80 transition-opacity">
            <svg width="9" height="9" viewBox="0 0 9 9"><line x1="1" y1="8" x2="8" y2="1" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="5" x2="5" y2="1" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div onMouseDown={(e) => handleResizeMouseDown(e, "br")} className="absolute bottom-0 right-0 w-5 h-5 z-10 cursor-se-resize flex items-end justify-end p-1 opacity-40 hover:opacity-80 transition-opacity">
            <svg width="9" height="9" viewBox="0 0 9 9"><line x1="1" y1="8" x2="8" y2="1" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="8" x2="8" y2="4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </>)}
      </div>
    </>
  );
}
