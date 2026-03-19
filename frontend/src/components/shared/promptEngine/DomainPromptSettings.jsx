import React, { useState, useCallback } from "react";
import {
  RotateCcw, Save, Check, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { ALL_SCENARIOS, getScenario } from "./index";

/**
 * DomainPromptSettings
 * ─────────────────────
 * Editable prompt-settings panel scoped to one domain (or all).
 *
 * Props:
 *   domain     – "ideabin" | "tasks" | "dependencies" | null (show all)
 *   settings   – current PromptSettings object
 *   onUpdate   – async (patch) => updatedSettings
 */
export default function DomainPromptSettings({ domain, settings, onUpdate }) {
  const [local, setLocal] = useState(() => ({
    ...settings,
    scenario_prompts: { ...(settings?.scenario_prompts || {}) },
  }));
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Scenarios for this domain ──
  const domainScenarios = ALL_SCENARIOS.filter(s => !domain || s.domain === domain);
  const groups = [...new Set(domainScenarios.map(s => s.group))].map(g => ({
    label: g,
    scenarios: domainScenarios.filter(s => s.group === g).map(s => s.id),
  }));

  // ── Helpers ──
  const toggleGroup = (label) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const toggleBool = (key) =>
    setLocal(prev => ({ ...prev, [key]: !prev[key] }));

  const setScenarioPrompt = (id, value) =>
    setLocal(prev => ({
      ...prev,
      scenario_prompts: { ...prev.scenario_prompts, [id]: value },
    }));

  const resetScenario = (id) => {
    const def = getScenario(id);
    setScenarioPrompt(id, def?.defaultPrompt || "");
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdate(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      // error surfaced by parent
    } finally {
      setSaving(false);
    }
  }, [local, onUpdate]);

  const boolFields = [
    { key: "auto_add_system_prompt",      label: "System prompt",      desc: "Prepend system prompt" },
    { key: "auto_add_project_description",label: "Project description", desc: "Include project description" },
    { key: "auto_add_json_format",        label: "JSON format",         desc: "Include expected format spec" },
    { key: "auto_add_scenario_prompt",    label: "Scenario prompt",     desc: "Include scenario instructions" },
    { key: "auto_add_end_prompt",         label: "End prompt",          desc: "Append closing instructions" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Section toggles (compact row) ── */}
      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sections included in prompt</div>
        <div className="flex flex-col gap-1">
          {boolFields.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleBool(f.key)}
              className="flex items-center gap-2 text-left group"
            >
              {local[f.key]
                ? <ToggleRight size={16} className="text-violet-500 flex-shrink-0" />
                : <ToggleLeft  size={16} className="text-gray-300 flex-shrink-0" />
              }
              <span className={`text-[10px] font-medium ${local[f.key] ? "text-gray-700" : "text-gray-400"}`}>
                {f.label}
              </span>
              <span className="text-[9px] text-gray-400 hidden group-hover:inline">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 min-h-0">

        {/* System prompt */}
        <div>
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">System Prompt</label>
          <textarea
            value={local.system_prompt || ""}
            onChange={e => setLocal(p => ({ ...p, system_prompt: e.target.value }))}
            placeholder="You are a helpful project management AI…"
            className="w-full mt-1 text-[10px] p-1.5 rounded border border-gray-200 bg-gray-50 resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 placeholder:text-gray-300"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
        </div>

        {/* End prompt */}
        <div>
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">End Prompt</label>
          <textarea
            value={local.end_prompt || ""}
            onChange={e => setLocal(p => ({ ...p, end_prompt: e.target.value }))}
            placeholder="Return only valid JSON, no markdown…"
            className="w-full mt-1 text-[10px] p-1.5 rounded border border-gray-200 bg-gray-50 resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 placeholder:text-gray-300"
            style={{ minHeight: "36px", maxHeight: "80px" }}
          />
        </div>

        {/* Scenario prompts */}
        {groups.length > 0 && (
          <div className="pt-1 border-t border-gray-100">
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Scenario Prompts</div>
            {groups.map(group => {
              const isCollapsed = collapsedGroups.has(group.label);
              return (
                <div key={group.label} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center gap-1 py-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                  >
                    {isCollapsed ? <ChevronRight size={9} /> : <ChevronDown size={9} />}
                    {group.label}
                  </button>

                  {!isCollapsed && group.scenarios.map(sid => {
                    const def = getScenario(sid);
                    const current = local.scenario_prompts?.[sid] || "";
                    const isCustomised = current && current !== (def?.defaultPrompt || "");

                    return (
                      <div key={sid} className="ml-3 mb-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-medium text-gray-700 flex-1">{def?.label || sid}</span>
                          {isCustomised && (
                            <button
                              onClick={() => resetScenario(sid)}
                              className="text-gray-400 hover:text-violet-500 transition-colors flex-shrink-0"
                              title="Reset to default"
                            >
                              <RotateCcw size={8} />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={current}
                          onChange={e => setScenarioPrompt(sid, e.target.value)}
                          placeholder={def?.defaultPrompt || "Custom instructions for this scenario…"}
                          className="w-full text-[10px] p-1.5 rounded border border-gray-200 bg-gray-50 resize-y focus:outline-none focus:ring-1 focus:ring-violet-300 placeholder:text-gray-300"
                          rows={2}
                          style={{ minHeight: "36px" }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] text-gray-400 flex-1">Settings are saved per user · apply to all projects</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
            saved
              ? "bg-green-500 text-white"
              : "bg-violet-100 text-violet-700 hover:bg-violet-200"
          }`}
        >
          {saved ? <Check size={9} /> : <Save size={9} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
