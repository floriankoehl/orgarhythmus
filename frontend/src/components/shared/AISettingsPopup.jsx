import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, X, ChevronDown, ChevronRight, RotateCcw,
  ToggleLeft, ToggleRight, Save, Check, Zap,
} from "lucide-react";
import { getDirectMode, setDirectMode as persistDirectMode } from "../../api/aiGenerateApi";
import usePromptSettings, {
  ENGINE_SCENARIO_LABELS,
  ENGINE_SCENARIO_GROUPS,
  SCENARIO_LABELS,
  SCENARIO_GROUPS,
  getScenario,
} from "../usePromptSettings";

/**
 * ═══════════════════════════════════════════════════════════
 *  AISettingsPopup
 *  ───────────────
 *  Floating popup for managing AI prompt settings.
 *  Shows toggles, system prompt, scenario prompts, end prompt.
 *  Accessible from the InventoryBar.
 * ═══════════════════════════════════════════════════════════
 */
export default function AISettingsPopup({ onClose }) {
  const { settings, loading, update } = usePromptSettings();
  const [activeTab, setActiveTab] = useState("toggles"); // "toggles" | "prompts" | "scenarios"
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const popupRef = useRef(null);

  // Direct AI mode (localStorage only — not persisted to server)
  const [directMode, setDirectMode] = useState(getDirectMode);
  const handleDirectModeToggle = useCallback(() => {
    setDirectMode(prev => {
      const next = !prev;
      persistDirectMode(next);
      return next;
    });
  }, []);

  // Local editable state (mirrors settings)
  const [localSettings, setLocalSettings] = useState(null);
  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings({ ...settings });
    }
  }, [settings, localSettings]);

  // Collapsed scenario groups
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroup = useCallback((group) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await update(localSettings);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  }, [localSettings, update]);

  const toggleBool = (key) => {
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateScenarioPrompt = (scenarioId, value) => {
    setLocalSettings(prev => ({
      ...prev,
      scenario_prompts: {
        ...prev.scenario_prompts,
        [scenarioId]: value,
      },
    }));
  };

  const resetScenarioPrompt = (scenarioId) => {
    const scenario = getScenario(scenarioId);
    if (scenario) {
      updateScenarioPrompt(scenarioId, scenario.defaultPrompt);
    }
  };

  if (loading || !localSettings) {
    return (
      <>
        <div className="fixed inset-0 z-[9998]" onClick={onClose} />
        <div className="absolute bottom-full mb-2 right-0 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72">
          <div className="text-[11px] text-gray-400 animate-pulse">Loading settings…</div>
        </div>
      </>
    );
  }

  // All scenario groups: new engine + legacy
  const allGroups = [
    ...ENGINE_SCENARIO_GROUPS,
    ...SCENARIO_GROUPS.map(g => ({
      ...g,
      label: `Legacy: ${g.label}`,
    })),
  ];

  const allLabels = { ...ENGINE_SCENARIO_LABELS, ...SCENARIO_LABELS };

  const tabs = [
    { id: "toggles", label: "Toggles" },
    { id: "prompts", label: "Prompts" },
    { id: "scenarios", label: "Per-Scenario" },
  ];

  const boolFields = [
    { key: "auto_add_system_prompt", label: "System prompt", desc: "Prepend system prompt to every export" },
    { key: "auto_add_project_description", label: "Project description", desc: "Include project description" },
    { key: "auto_add_json_format", label: "Expected JSON format", desc: "Include expected JSON format spec" },
    { key: "auto_add_scenario_prompt", label: "Scenario prompt", desc: "Include scenario-specific instructions" },
    { key: "auto_add_end_prompt", label: "End prompt", desc: "Append closing instructions" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={popupRef}
        className="absolute bottom-full mb-2 right-0 z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col"
        style={{ width: "min(420px, 90vw)", maxHeight: "min(500px, 70vh)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-violet-500" />
            <span className="text-[12px] font-semibold text-gray-800">AI Prompt Settings</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                savedFlash
                  ? "bg-green-500 text-white"
                  : "bg-violet-100 text-violet-700 hover:bg-violet-200"
              }`}
            >
              {savedFlash ? <Check size={10} /> : <Save size={10} />}
              {savedFlash ? "Saved" : "Save"}
            </button>
            <button onClick={onClose} className="p-0.5 rounded text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-[10px] font-medium transition-colors border-b-2 ${
                activeTab === t.id
                  ? "text-violet-600 border-violet-500"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* ── Toggles tab ── */}
          {activeTab === "toggles" && (
            <div className="space-y-2">
              {/* ── Direct AI toggle ── */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <button onClick={handleDirectModeToggle} className="flex-shrink-0">
                  {directMode
                    ? <ToggleRight size={20} className="text-amber-500" />
                    : <ToggleLeft size={20} className="text-gray-300" />
                  }
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <Zap size={11} className="text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-800">Direct AI Mode</span>
                  </div>
                  <div className="text-[9px] text-amber-600">
                    Send prompts directly to OpenAI instead of copying to clipboard.
                    Requires OPENAI_API_KEY in server .env (local testing only).
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 mb-2">
                Control which sections are included when copying prompts to clipboard.
              </div>
              {boolFields.map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBool(f.key)}
                    className="flex-shrink-0"
                    title={localSettings[f.key] ? "Enabled" : "Disabled"}
                  >
                    {localSettings[f.key]
                      ? <ToggleRight size={20} className="text-violet-500" />
                      : <ToggleLeft size={20} className="text-gray-300" />
                    }
                  </button>
                  <div>
                    <div className="text-[11px] font-medium text-gray-700">{f.label}</div>
                    <div className="text-[9px] text-gray-400">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Prompts tab ── */}
          {activeTab === "prompts" && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">System Prompt</label>
                <textarea
                  value={localSettings.system_prompt || ""}
                  onChange={(e) => updateField("system_prompt", e.target.value)}
                  placeholder="You are a helpful project management AI…"
                  className="w-full mt-1 text-[11px] p-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-y min-h-[80px] bg-gray-50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">End Prompt</label>
                <textarea
                  value={localSettings.end_prompt || ""}
                  onChange={(e) => updateField("end_prompt", e.target.value)}
                  placeholder="Please return only valid JSON, no markdown…"
                  className="w-full mt-1 text-[11px] p-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-y min-h-[60px] bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* ── Per-Scenario tab ── */}
          {activeTab === "scenarios" && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-500 mb-2">
                Customise the AI instructions for each prompt scenario. Leave blank to use the default.
              </div>
              {allGroups.map(group => {
                const isCollapsed = collapsedGroups.has(group.label);
                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center gap-1 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {isCollapsed
                        ? <ChevronRight size={10} />
                        : <ChevronDown size={10} />
                      }
                      {group.label}
                    </button>
                    {!isCollapsed && group.scenarios.map(scenarioId => {
                      const label = allLabels[scenarioId] || scenarioId;
                      const scenarioDef = getScenario(scenarioId);
                      const hasDefault = !!scenarioDef?.defaultPrompt;
                      const currentValue = localSettings.scenario_prompts?.[scenarioId] || "";
                      const isDefault = !currentValue || (hasDefault && currentValue === scenarioDef.defaultPrompt);

                      return (
                        <div key={scenarioId} className="ml-3 mb-2">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] font-medium text-gray-700">{label}</span>
                            {hasDefault && !isDefault && (
                              <button
                                onClick={() => resetScenarioPrompt(scenarioId)}
                                className="text-gray-400 hover:text-violet-500 transition-colors"
                                title="Reset to default"
                              >
                                <RotateCcw size={9} />
                              </button>
                            )}
                          </div>
                          <textarea
                            value={currentValue}
                            onChange={(e) => updateScenarioPrompt(scenarioId, e.target.value)}
                            placeholder={scenarioDef?.defaultPrompt || "Custom prompt for this scenario…"}
                            className="w-full text-[10px] p-1.5 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-y min-h-[40px] bg-gray-50"
                            rows={2}
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

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400">
          Changes are saved per user · Prompts apply to all projects
        </div>
      </div>
    </>
  );
}
