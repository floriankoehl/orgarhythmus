import { useAuth } from "../../auth/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { fetch_all_projects, fetchUserTeams, fetchUserTasks } from "../../api/org_API.js";
import {
  User,
  Mail,
  Calendar,
  Folder,
  LogOut,
  ArrowRight,
  Loader2,
  Users,
  AlertCircle,
  Zap,
  ListTodo,
  BotMessageSquare,
  ChevronDown,
  ChevronRight,
  Save,
  UserCircle,
} from "lucide-react";
import usePromptSettings, { SCENARIO_LABELS, SCENARIO_GROUPS } from "../../components/usePromptSettings";

/**
 * ProfileContent — user profile panel for ProfileWindow.
 *
 * Replicates the full Profile page: user header, AI prompt settings,
 * assigned tasks, teams, projects.
 */
export default function ProfileContent() {
  const { user, isAuthenticated, loadingUser, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // ── Prompt settings ──
  const { settings: promptSettings, loading: loadingPrompt, update: updatePrompt } = usePromptSettings();
  const [promptDraft, setPromptDraft] = useState(null);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    if (promptSettings && !promptDraft) {
      setPromptDraft({
        auto_add_system_prompt: promptSettings.auto_add_system_prompt,
        auto_add_json_format: promptSettings.auto_add_json_format,
        auto_add_scenario_prompt: promptSettings.auto_add_scenario_prompt,
        auto_add_project_description: promptSettings.auto_add_project_description,
        auto_add_end_prompt: promptSettings.auto_add_end_prompt,
        system_prompt: promptSettings.system_prompt || "",
        end_prompt: promptSettings.end_prompt || "",
        scenario_prompts: { ...promptSettings.scenario_prompts },
      });
    }
  }, [promptSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const promptDirty =
    promptDraft &&
    promptSettings &&
    (promptDraft.auto_add_system_prompt !== promptSettings.auto_add_system_prompt ||
      promptDraft.auto_add_json_format !== promptSettings.auto_add_json_format ||
      promptDraft.auto_add_scenario_prompt !== promptSettings.auto_add_scenario_prompt ||
      promptDraft.auto_add_project_description !== promptSettings.auto_add_project_description ||
      promptDraft.auto_add_end_prompt !== promptSettings.auto_add_end_prompt ||
      promptDraft.system_prompt !== (promptSettings.system_prompt || "") ||
      promptDraft.end_prompt !== (promptSettings.end_prompt || "") ||
      JSON.stringify(promptDraft.scenario_prompts) !== JSON.stringify(promptSettings.scenario_prompts));

  const handleSavePrompt = useCallback(async () => {
    if (!promptDraft) return;
    setPromptSaving(true);
    try {
      await updatePrompt(promptDraft);
    } catch (e) {
      console.error("Failed to save prompt settings:", e);
    } finally {
      setPromptSaving(false);
    }
  }, [promptDraft, updatePrompt]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadTasks();
      loadProjects();
      loadTeams();
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProjects() {
    try {
      setLoadingProjects(true);
      const data = await fetch_all_projects();
      setProjects(data || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadTeams() {
    try {
      setLoadingTeams(true);
      const data = await fetchUserTeams();
      setTeams(data || []);
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setLoadingTeams(false);
    }
  }

  async function loadTasks() {
    try {
      setLoadingTasks(true);
      const data = await fetchUserTasks();
      setTasks(data || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* ── Profile Header ── */}
      <header className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg flex-shrink-0">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{user?.username}</h1>
            <p className="text-xs text-slate-600 mt-1">Welcome back to OrgaRhythmus!</p>

            <div className="flex flex-wrap gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <Mail size={13} className="text-blue-600" />
                <span className="text-xs text-slate-700">
                  {user?.email || <span className="text-slate-500 italic">No email set</span>}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <User size={13} className="text-purple-600" />
                <span className="text-xs text-slate-700 font-mono">ID: {user?.id}</span>
              </div>

              {user?.date_joined && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <Calendar size={13} className="text-emerald-600" />
                  <span className="text-xs text-slate-700">
                    Joined{" "}
                    {new Date(user.date_joined).toLocaleDateString("de-DE", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition flex-shrink-0"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* ── AI Prompt Settings ── */}
      <section className="rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        <button
          onClick={() => setPromptExpanded((p) => !p)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <BotMessageSquare size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI Prompt Settings</h2>
              <p className="text-[10px] text-slate-600">Configure prompts for JSON exports</p>
            </div>
          </div>
          {promptExpanded ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </button>

        {promptExpanded && (
          <div className="px-4 pb-4 flex flex-col gap-4">
            {loadingPrompt || !promptDraft ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Loading prompt settings...</span>
              </div>
            ) : (
              <>
                {/* Toggles */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-slate-700">Auto-Prepend Toggles</h3>
                  <p className="text-[10px] text-slate-500 -mt-1">
                    Control which sections are automatically added before the JSON when you copy an export.
                  </p>
                  {[
                    { key: "auto_add_system_prompt", label: "System Prompt", desc: "Your global instruction is prepended first." },
                    { key: "auto_add_project_description", label: "Project Description", desc: "The current project's description is included." },
                    { key: "auto_add_json_format", label: "Expected JSON Format", desc: "The expected JSON structure is shown before the data." },
                    { key: "auto_add_scenario_prompt", label: "Scenario Prompt", desc: "A scenario-specific instruction for each export type." },
                    { key: "auto_add_end_prompt", label: "End Prompt", desc: "A wrap-up instruction is appended after the JSON data." },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-start gap-2 cursor-pointer group">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={promptDraft[key]}
                          onChange={(e) => setPromptDraft((d) => ({ ...d, [key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-800 group-hover:text-amber-700 transition-colors">
                          {label}
                        </span>
                        <p className="text-[10px] text-slate-500">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* System Prompt */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold text-slate-700">Global System Prompt</h3>
                  <p className="text-[10px] text-slate-500">
                    First block prepended to every export (when enabled).
                  </p>
                  <textarea
                    value={promptDraft.system_prompt}
                    onChange={(e) => setPromptDraft((d) => ({ ...d, system_prompt: e.target.value }))}
                    placeholder="e.g. You are a project management assistant..."
                    className="w-full font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    style={{ minHeight: 80, maxHeight: 300 }}
                  />
                </div>

                {/* Scenario Prompts */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-slate-700">Scenario-Specific Prompts</h3>
                  <p className="text-[10px] text-slate-500">
                    Each export type can have its own prompt.
                  </p>

                  {SCENARIO_GROUPS.map((group) => (
                    <div key={group.label} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedGroup((g) => (g === group.label ? null : group.label))}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                      >
                        <span className="text-xs font-medium text-slate-700">{group.label}</span>
                        {expandedGroup === group.label ? (
                          <ChevronDown size={14} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-400" />
                        )}
                      </button>

                      {expandedGroup === group.label && (
                        <div className="p-3 flex flex-col gap-3 bg-white">
                          {group.scenarios.map((key) => (
                            <div key={key} className="flex flex-col gap-1">
                              <label className="text-[10px] font-medium text-slate-600">
                                {SCENARIO_LABELS[key]}
                              </label>
                              <textarea
                                value={promptDraft.scenario_prompts[key] || ""}
                                onChange={(e) =>
                                  setPromptDraft((d) => ({
                                    ...d,
                                    scenario_prompts: { ...d.scenario_prompts, [key]: e.target.value },
                                  }))
                                }
                                placeholder={`Prompt for ${SCENARIO_LABELS[key]}...`}
                                className="w-full font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded p-2 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                style={{ minHeight: 60, maxHeight: 250 }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* End Prompt */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-semibold text-slate-700">End Prompt</h3>
                  <p className="text-[10px] text-slate-500">
                    Appended after the actual JSON data.
                  </p>
                  <textarea
                    value={promptDraft.end_prompt}
                    onChange={(e) => setPromptDraft((d) => ({ ...d, end_prompt: e.target.value }))}
                    placeholder="e.g. Return ONLY a single fenced JSON code block..."
                    className="w-full font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    style={{ minHeight: 60, maxHeight: 250 }}
                  />
                </div>

                {/* Save */}
                {promptDirty && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleSavePrompt}
                      disabled={promptSaving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {promptSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {promptSaving ? "Saving..." : "Save Prompt Settings"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Assigned Tasks ── */}
      <section className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <ListTodo size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assigned Tasks</h2>
              <p className="text-[10px] text-slate-500">Tasks across all projects</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
          </span>
        </div>

        {loadingTasks ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-400" />
            <span className="text-xs text-slate-500">Loading tasks...</span>
          </div>
        ) : tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/projects/${task.project.id}/tasks/${task.id}`)}
                className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-md transition p-3 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1.5">
                      {task.team && (
                        <div
                          className="h-7 w-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: task.team.color || "#64748b" }}
                        >
                          {task.team.name?.[0]?.toUpperCase() || "T"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                          {task.name}
                        </h3>
                        {task.description && (
                          <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.project && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Folder size={10} className="text-slate-400" />
                          <span className="truncate max-w-[100px]">{task.project.name}</span>
                        </span>
                      )}
                      {task.team && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Users size={10} className="text-slate-400" />
                          {task.team.name}
                        </span>
                      )}
                      {task.difficulty && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          <Zap size={10} /> {task.difficulty}
                        </span>
                      )}
                      {task.priority && (
                        <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                          <AlertCircle size={10} /> {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <ListTodo size={28} className="text-slate-300" />
            <p className="text-xs text-slate-500">No tasks assigned yet</p>
          </div>
        )}
      </section>

      {/* ── Your Teams ── */}
      <section className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Your Teams</h2>
              <p className="text-[10px] text-slate-500">Teams across all projects</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {teams.length} {teams.length === 1 ? "Team" : "Teams"}
          </span>
        </div>

        {loadingTeams ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-400" />
            <span className="text-xs text-slate-500">Loading teams...</span>
          </div>
        ) : teams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={() => navigate(`/projects/${team.project.id}/teams/${team.id}`)}
                className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-md transition p-3 cursor-pointer group"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: team.color || "#64748b" }}
                  >
                    {team.name?.[0]?.toUpperCase() || "T"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-slate-900 group-hover:text-purple-600 transition-colors truncate">
                      {team.name}
                    </h3>
                    {team.project && (
                      <p className="text-[10px] text-slate-500 truncate">{team.project.name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Users size={10} className="text-slate-400" />
                    {team.member_count} {team.member_count === 1 ? "member" : "members"}
                  </span>
                  <ArrowRight size={12} className="text-slate-400 group-hover:text-purple-600" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Users size={28} className="text-slate-300" />
            <p className="text-xs text-slate-500">No teams yet</p>
          </div>
        )}
      </section>

      {/* ── Your Projects ── */}
      <section className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Folder size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Your Projects</h2>
              <p className="text-[10px] text-slate-500">Projects you own or are a member of</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {projects.length} {projects.length === 1 ? "Project" : "Projects"}
          </span>
        </div>

        {loadingProjects ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={16} className="animate-spin text-slate-400" />
            <span className="text-xs text-slate-500">Loading projects...</span>
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-md transition p-3 cursor-pointer group"
              >
                <div className="mb-2">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate flex-1 mr-2">
                      {project.name}
                    </h3>
                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      #{project.id}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-[10px] text-slate-600 line-clamp-2">{project.description}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <User size={10} className="text-slate-400" />
                    Owner: <span className="font-medium text-slate-900">{project.owner_username}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Calendar size={10} className="text-slate-400" />
                    Created{" "}
                    {new Date(project.created_at).toLocaleDateString("de-DE", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1 mt-2 group-hover:translate-x-0.5 transition-transform">
                  <span className="text-[10px] font-medium text-slate-500 group-hover:text-blue-600">Open</span>
                  <ArrowRight size={12} className="text-slate-400 group-hover:text-blue-600" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Folder size={28} className="text-slate-300" />
            <p className="text-xs text-slate-500">No projects yet</p>
            <button
              onClick={() => navigate("/")}
              className="mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
            >
              Go to Projects
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
