import { useState, useRef, useCallback } from "react";
import {
  Sparkles, X, Check, Zap,
  ToggleLeft, ToggleRight, Save,
} from "lucide-react";
import { getDirectMode, setDirectMode as persistDirectMode } from "../../api/aiGenerateApi";
import usePromptSettings from "../usePromptSettings";
import { DEFAULT_SYSTEM_PROMPT } from "./promptEngine/promptDefaults";
import DomainPromptSettings from "./promptEngine/DomainPromptSettings";
import DefaultPromptTooltip from "./promptEngine/DefaultPromptTooltip";

/**
 * AISettingsPopup
 * ───────────────
 * Global AI prompt settings, accessible from the InventoryBar.
 *
 * Tabs:
 *   Toggles   – section toggles + Direct AI mode
 *   Prompts   – system prompt + end prompt
 *   IdeaBin   – per-scenario prompts for the IdeaBin domain
 *   Tasks     – per-scenario prompts for the Tasks domain
 *   Schedule  – per-scenario prompts for the Dependencies/Schedule domain
 */
export default function AISettingsPopup({ onClose }) {
  const { settings, loading, update } = usePromptSettings();
  const [activeTab, setActiveTab] = useState("toggles");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const popupRef = useRef(null);

  // Direct AI mode — localStorage only, not persisted to server
  const [directMode, setDirectMode] = useState(getDirectMode);
  const handleDirectModeToggle = useCallback(() => {
    setDirectMode(prev => {
      const next = !prev;
      persistDirectMode(next);
      return next;
    });
  }, []);

  // Local editable state for the Toggles + Prompts tabs
  const [localSettings, setLocalSettings] = useState(null);
  if (settings && !localSettings) {
    setLocalSettings({ ...settings });
  }

  const handleSave = useCallback(async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await update(localSettings);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      // hook surfaces the error
    } finally {
      setSaving(false);
    }
  }, [localSettings, update]);

  const toggleBool = (key) =>
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const boolFields = [
    { key: "auto_add_system_prompt",       label: "System prompt",       desc: "Prepend system prompt to every export" },
    { key: "auto_add_project_description", label: "Project description", desc: "Include project description" },
    { key: "auto_add_json_format",         label: "Expected JSON format", desc: "Include expected JSON format spec" },
    { key: "auto_add_scenario_prompt",     label: "Scenario prompt",     desc: "Include scenario-specific instructions" },
    { key: "auto_add_end_prompt",          label: "End prompt",          desc: "Append closing instructions" },
  ];

  const tabs = [
    { id: "toggles",  label: "Toggles" },
    { id: "prompts",  label: "Prompts" },
    { id: "ideabin",  label: "IdeaBin" },
    { id: "tasks",    label: "Tasks" },
    { id: "schedule", label: "Schedule" },
  ];

  // Domain-specific tabs use the save-via-hook pattern
  const domainTabDomain = { ideabin: "ideabin", tasks: "tasks", schedule: "dependencies" };

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

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={popupRef}
        className="absolute bottom-full mb-2 right-0 z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col"
        style={{ width: "min(460px, 92vw)", maxHeight: "min(560px, 76vh)" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-violet-500" />
            <span className="text-[12px] font-semibold text-gray-800">AI Prompt Settings</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Save only shown for toggles/prompts tabs (domain tabs have their own save) */}
            {(activeTab === "toggles" || activeTab === "prompts") && (
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
            )}
            <button onClick={onClose} className="p-0.5 rounded text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 px-1 flex-shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === t.id
                  ? "text-violet-600 border-violet-500"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Toggles */}
          {activeTab === "toggles" && (
            <div className="p-3 space-y-2">
              {/* Direct AI mode */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                <button onClick={handleDirectModeToggle} className="flex-shrink-0">
                  {directMode
                    ? <ToggleRight size={20} className="text-amber-500" />
                    : <ToggleLeft  size={20} className="text-gray-300" />
                  }
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <Zap size={11} className="text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-800">Direct AI Mode</span>
                  </div>
                  <div className="text-[9px] text-amber-600">
                    Send prompts directly to OpenAI instead of copying to clipboard.
                    Requires OPENAI_API_KEY in server .env.
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 mb-1">
                Control which sections are included when copying or sending prompts.
              </div>
              {boolFields.map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <button onClick={() => toggleBool(f.key)} className="flex-shrink-0">
                    {localSettings[f.key]
                      ? <ToggleRight size={20} className="text-violet-500" />
                      : <ToggleLeft  size={20} className="text-gray-300" />
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

          {/* Prompts */}
          {activeTab === "prompts" && (
            <div className="p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">System Prompt</label>
                  <DefaultPromptTooltip
                    defaultPrompt={DEFAULT_SYSTEM_PROMPT}
                    isCustomised={localSettings.system_prompt !== DEFAULT_SYSTEM_PROMPT}
                    onReset={() => setLocalSettings(p => ({ ...p, system_prompt: DEFAULT_SYSTEM_PROMPT }))}
                    size={11}
                  />
                </div>
                <textarea
                  value={localSettings.system_prompt || ""}
                  onChange={e => setLocalSettings(p => ({ ...p, system_prompt: e.target.value }))}
                  placeholder="You are a helpful project management AI…"
                  className="w-full text-[11px] p-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-y min-h-[80px] bg-gray-50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">End Prompt</label>
                <textarea
                  value={localSettings.end_prompt || ""}
                  onChange={e => setLocalSettings(p => ({ ...p, end_prompt: e.target.value }))}
                  placeholder="Return only valid JSON, no markdown…"
                  className="w-full mt-1 text-[11px] p-2 rounded border border-gray-200 focus:outline-none focus:border-violet-400 resize-y min-h-[60px] bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Domain-specific scenario tabs */}
          {(activeTab === "ideabin" || activeTab === "tasks" || activeTab === "schedule") && settings && (
            <DomainPromptSettings
              domain={domainTabDomain[activeTab]}
              settings={settings}
              onUpdate={update}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400 flex-shrink-0">
          Settings are saved per user · apply to all projects
        </div>
      </div>
    </>
  );
}
