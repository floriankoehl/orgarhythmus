import React, { useState, useCallback } from "react";
import { ArrowLeft, Copy, Zap, Check, Loader, ChevronDown, ChevronRight, Info } from "lucide-react";

const SECTION_META = {
  system_prompt:       { label: "System Prompt",       badge: "bg-violet-100 text-violet-700", dot: "bg-violet-400" },
  project_description: { label: "Project Description", badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-400"   },
  json_format:         { label: "JSON Format",          badge: "bg-slate-100 text-slate-600",   dot: "bg-slate-400"  },
  scenario_prompt:     { label: "Scenario Prompt",      badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-400"  },
  payload:             { label: "Data",                 badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  end_prompt:          { label: "End Prompt",           badge: "bg-rose-100 text-rose-700",     dot: "bg-rose-400"   },
};

/**
 * PromptInspector — shows the assembled prompt broken into editable, collapsible sections.
 *
 * Props:
 *   sections            – [{ key, label, header, content, alwaysIncluded }] from assemblePromptSections
 *   scenarioLabel       – display name of the scenario
 *   directMode          – whether Direct AI mode is on (shows Generate button)
 *   isGenerating        – spinner state
 *   customAddOn         – extra text appended at the end
 *   onCustomAddOnChange – setter for customAddOn
 *   onCopy(text)        – called with the final assembled text
 *   onGenerate(text)    – called with the final assembled text (optional, Direct mode only)
 *   onBack()            – navigate back to the export grid
 */
export default function PromptInspector({
  sections,
  scenarioLabel,
  directMode,
  isGenerating,
  customAddOn = "",
  onCustomAddOnChange,
  onCopy,
  onGenerate,
  onBack,
}) {
  const [edited, setEdited] = useState(() => {
    const init = {};
    sections.forEach(s => { init[s.key] = s.content; });
    return init;
  });
  const [collapsed, setCollapsed] = useState(new Set());
  const [copied, setCopied] = useState(false);

  const toggleCollapsed = (key) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const getCombinedText = useCallback(() => {
    const parts = sections.map(s => {
      const content = edited[s.key] ?? s.content;
      return s.header ? s.header + "\n" + content : content;
    });
    if (customAddOn.trim()) parts.push(customAddOn.trim());
    return parts.join("\n\n");
  }, [sections, edited, customAddOn]);

  const handleCopy = useCallback(async () => {
    await onCopy(getCombinedText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [onCopy, getCombinedText]);

  const handleGenerate = useCallback(() => {
    onGenerate?.(getCombinedText());
  }, [onGenerate, getCombinedText]);

  const setSection = (key, value) =>
    setEdited(prev => ({ ...prev, [key]: value }));

  const allKeys = [...sections.map(s => s.key), "custom_addon"];
  const allCollapsed = allKeys.every(k => collapsed.has(k));
  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(allKeys));

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="Back to scenarios"
        >
          <ArrowLeft size={11} />
        </button>
        <span className="text-[10px] font-semibold text-gray-700 truncate flex-1">{scenarioLabel}</span>
        <button
          onClick={toggleAll}
          className="text-[9px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
          title={allCollapsed ? "Expand all sections" : "Collapse all sections"}
        >
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {/* ── Sections ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 min-h-0">

        {/* Note about how prompt is sent */}
        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-sky-50 border border-sky-100 rounded text-[9px] text-sky-700">
          <Info size={9} className="flex-shrink-0 mt-0.5" />
          <span>
            All sections are joined into a <strong>single user message</strong> sent to the AI.
            The &ldquo;System Prompt&rdquo; section is only present if enabled in AI Settings — there is no separate system role.
          </span>
        </div>

        {sections.length === 0 && (
          <p className="text-[10px] text-gray-400 text-center py-4">
            Only the Data payload is included.<br />
            Enable more sections in AI&nbsp;Settings.
          </p>
        )}

        {sections.map(s => {
          const meta = SECTION_META[s.key] ?? { label: s.label, badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
          const isPayload = s.key === "payload";
          const isCollapsed = collapsed.has(s.key);

          return (
            <div key={s.key} className="flex flex-col gap-0.5">
              {/* ── Clickable section header ── */}
              <button
                type="button"
                onClick={() => toggleCollapsed(s.key)}
                className="flex items-center gap-1.5 w-full text-left group"
              >
                {isCollapsed
                  ? <ChevronRight size={9} className="text-gray-400 flex-shrink-0" />
                  : <ChevronDown  size={9} className="text-gray-400 flex-shrink-0" />
                }
                <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${meta.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} flex-shrink-0`} />
                  {meta.label}
                  {s.alwaysIncluded && <span className="font-normal opacity-60 ml-0.5">always</span>}
                </span>
                {s.header && (
                  <span className="text-[8px] text-gray-400 font-mono select-none">{s.header}</span>
                )}
                {isCollapsed && (
                  <span className="text-[8px] text-gray-400 truncate ml-1 opacity-60 flex-1">
                    {(edited[s.key] ?? s.content).slice(0, 60).replace(/\n/g, " ")}…
                  </span>
                )}
              </button>

              {/* ── Editable textarea (hidden when collapsed) ── */}
              {!isCollapsed && (
                <textarea
                  value={edited[s.key] ?? s.content}
                  onChange={e => setSection(s.key, e.target.value)}
                  spellCheck={!isPayload}
                  ref={el => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                  className={`w-full font-mono text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-300 ${isPayload ? "text-gray-500" : ""}`}
                  style={{ minHeight: isPayload ? "100px" : "52px", overflow: "hidden", resize: "none" }}
                />
              )}
            </div>
          );
        })}

        {/* ── Custom add-on ── */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => toggleCollapsed("custom_addon")}
            className="flex items-center gap-1.5 w-full text-left"
          >
            {collapsed.has("custom_addon")
              ? <ChevronRight size={9} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown  size={9} className="text-gray-400 flex-shrink-0" />
            }
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
              Custom Add-on
              <span className="font-normal opacity-60 ml-0.5">optional</span>
            </span>
          </button>
          {!collapsed.has("custom_addon") && (
            <textarea
              value={customAddOn}
              onChange={e => onCustomAddOnChange?.(e.target.value)}
              placeholder="Extra instructions appended at the end…"
              ref={el => { if (el) { el.style.height = "auto"; el.style.height = Math.max(36, el.scrollHeight) + "px"; } }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.max(36, e.target.scrollHeight) + "px"; }}
              className="w-full font-mono text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300 placeholder:text-gray-400"
              style={{ minHeight: "36px", overflow: "hidden", resize: "none" }}
            />
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[10px] px-2.5 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <div className="flex-1" />
        {directMode && onGenerate && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 font-medium transition-colors"
            title="Send directly to OpenAI"
          >
            {isGenerating
              ? <Loader size={9} className="animate-spin" />
              : <Zap size={9} />
            }
            Generate
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700 font-medium transition-colors"
          title="Copy full assembled prompt to clipboard"
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? "Copied!" : "Copy all"}
        </button>
      </div>
    </div>
  );
}
