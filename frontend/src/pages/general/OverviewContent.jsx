import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Folder,
  Calendar,
  User,
  Plus,
  Settings,
  Share2,
  Trash2,
  Users,
  AlertTriangle,
  X,
  Pencil,
  Check,
  Globe,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import {
  fetch_project_detail,
  fetchTeamsForProject,
  fetchTasksForProject,
  delete_project,
  update_project_api,
} from "../../api/org_API.js";
import {
  fetchAllPublicContextsApi,
  fetchProjectContextsApi,
  assignProjectToContextApi,
  removeProjectFromContextApi,
} from "../../components/ideas/api/contextApi.js";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useDataRefresh } from "../../api/dataEvents";
import { validate_project_dates, sync_project_days } from "../../api/dependencies_api.js";

/**
 * OverviewContent — project overview panel for OverviewWindow.
 *
 * Replicates ProjectMain page: editable project name, description, dates,
 * stats (team count, task count), members, context linking, team/task lists.
 * Avg priority/difficulty are omitted for now.
 */
export default function OverviewContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // ── Data loading ──
  const [project, setProject] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cross-window sync: reload when tasks/teams change ──
  const loadDataCb = useCallback(() => { loadData(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useDataRefresh(['tasks', 'teams'], loadDataCb);

  async function loadData() {
    try {
      setLoading(true);
      const [proj, teamsRes, tasksRes] = await Promise.all([
        fetch_project_detail(projectId),
        fetchTeamsForProject(projectId),
        fetchTasksForProject(projectId),
      ]);
      setProject(proj);
      setTeams(teamsRes);
      setTasks(tasksRes);
    } catch (err) {
      console.error("Error loading overview data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Name editing ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (project) setEditName(project.name);
  }, [project]);

  async function handleSaveName() {
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      await update_project_api(projectId, { name: editName.trim() });
      setProject((p) => ({ ...p, name: editName.trim() }));
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update project name: " + err.message);
    } finally {
      setSavingName(false);
    }
  }

  // ── Description editing ──
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  useEffect(() => {
    if (project) setEditDesc(project.description || "");
  }, [project]);

  async function handleSaveDesc() {
    setSavingDesc(true);
    try {
      await update_project_api(projectId, { description: editDesc });
      setProject((p) => ({ ...p, description: editDesc }));
      setIsEditingDesc(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update description: " + err.message);
    } finally {
      setSavingDesc(false);
    }
  }

  // ── Date editing ──
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(null);
  const [editEndDate, setEditEndDate] = useState(null);
  const [savingDates, setSavingDates] = useState(false);

  useEffect(() => {
    if (project) {
      setEditStartDate(project.start_date ? dayjs(project.start_date) : null);
      setEditEndDate(project.end_date ? dayjs(project.end_date) : null);
    }
  }, [project]);

  async function handleSaveDates() {
    setSavingDates(true);
    try {
      const newStart = editStartDate ? editStartDate.format("YYYY-MM-DD") : null;
      const newEnd = editEndDate ? editEndDate.format("YYYY-MM-DD") : null;

      if (newStart && newEnd) {
        const validation = await validate_project_dates(projectId, newStart, newEnd);
        if (!validation.valid) {
          const names = validation.milestones_out_of_range
            .map((m) => `"${m.name}" (needs day ${m.required_days})`)
            .join(", ");
          alert(`Cannot update dates: ${validation.error}\n\nAffected milestones: ${names}`);
          setSavingDates(false);
          return;
        }
      }

      await update_project_api(projectId, { start_date: newStart, end_date: newEnd });
      if (newStart && newEnd) await sync_project_days(projectId);
      setProject((p) => ({ ...p, start_date: newStart, end_date: newEnd }));
      setIsEditingDates(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save dates.");
    } finally {
      setSavingDates(false);
    }
  }

  // ── Context linking ──
  const [contextSectionOpen, setContextSectionOpen] = useState(false);
  const [publicContexts, setPublicContexts] = useState([]);
  const [linkedContextIds, setLinkedContextIds] = useState(new Set());
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [togglingContext, setTogglingContext] = useState(null);

  const loadContextData = useCallback(async () => {
    setLoadingContexts(true);
    try {
      const [pubCtxs, linkedCtxs] = await Promise.all([
        fetchAllPublicContextsApi(),
        fetchProjectContextsApi(projectId),
      ]);
      setPublicContexts(pubCtxs);
      setLinkedContextIds(new Set(linkedCtxs.map((c) => c.id)));
    } catch (err) {
      console.error("Failed to load contexts:", err);
    } finally {
      setLoadingContexts(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (contextSectionOpen && publicContexts.length === 0) loadContextData();
  }, [contextSectionOpen, loadContextData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleContext(contextId) {
    setTogglingContext(contextId);
    try {
      if (linkedContextIds.has(contextId)) {
        await removeProjectFromContextApi(projectId, contextId);
        setLinkedContextIds((prev) => { const n = new Set(prev); n.delete(contextId); return n; });
      } else {
        await assignProjectToContextApi(projectId, contextId);
        setLinkedContextIds((prev) => new Set(prev).add(contextId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingContext(null);
    }
  }

  // ── Delete modal ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      await delete_project(projectId);
      await new Promise((r) => setTimeout(r, 500));
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Failed to delete project: " + err.message);
      setDeleting(false);
    }
  }

  // ── Expand toggles ──
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // ── Computed ──
  const unassignedTasks = useMemo(() => tasks.filter((t) => !t.team).length, [tasks]);
  const teamsWithTasks = useMemo(() => teams.filter((t) => t.tasks && t.tasks.length > 0).length, [teams]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  const createdDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {/* ── Header: Name + Description ── */}
      <header className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        {/* Project name */}
        <div className="mb-3">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xl font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") { setEditName(project.name); setIsEditingName(false); }
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="rounded-lg bg-green-600 p-2 text-white hover:bg-green-700 disabled:opacity-50"
                title="Save"
              >
                {savingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={() => { setEditName(project.name); setIsEditingName(false); }}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
              <button
                onClick={() => setIsEditingName(true)}
                className="rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 transition-all"
                title="Edit project name"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {isEditingDesc ? (
          <div className="mb-3">
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") { setEditDesc(project.description || ""); setIsEditingDesc(false); }
              }}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveDesc}
                disabled={savingDesc}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingDesc ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
              <button
                onClick={() => { setEditDesc(project.description || ""); setIsEditingDesc(false); }}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group flex items-start gap-2 mb-3">
            <p className="text-sm leading-relaxed text-slate-600 flex-1">
              {project.description || "No description set. Click to add one."}
            </p>
            <button
              onClick={() => setIsEditingDesc(true)}
              className="rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 transition-all flex-shrink-0"
              title="Edit description"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        {/* Meta info (owner, created, dates, id) */}
        {!isEditingDates ? (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <User size={13} className="text-blue-600" />
              <span className="text-[10px] text-slate-500">Owner:</span>
              <span className="text-xs font-medium text-slate-700">{project.owner_username}</span>
            </div>

            {createdDate && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <Calendar size={13} className="text-purple-600" />
                <span className="text-[10px] text-slate-500">Created:</span>
                <span className="text-xs text-slate-700">{createdDate}</span>
              </div>
            )}

            {(project.start_date || project.end_date) ? (
              <button
                onClick={() => setIsEditingDates(true)}
                className="group/dates flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition hover:border-blue-400 hover:bg-blue-50"
                title="Edit dates"
              >
                <Calendar size={13} className="text-slate-600 group-hover/dates:text-blue-600" />
                <div className="flex gap-2">
                  {project.start_date && (
                    <span className="text-xs text-slate-700">
                      <span className="text-[10px] text-slate-500">Start: </span>
                      {new Date(project.start_date).toLocaleDateString("de-DE")}
                    </span>
                  )}
                  {project.end_date && (
                    <span className="text-xs text-slate-700">
                      <span className="text-[10px] text-slate-500">End: </span>
                      {new Date(project.end_date).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
                <Pencil size={11} className="opacity-0 group-hover/dates:opacity-100" />
              </button>
            ) : (
              <button
                onClick={() => setIsEditingDates(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition"
                title="Add dates"
              >
                <Calendar size={13} />
                <span className="text-[10px] font-medium">Add dates</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <Folder size={13} className="text-emerald-600" />
              <span className="font-mono text-xs text-slate-700">ID: {project.id}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="mb-3 text-xs font-semibold text-slate-900">Edit Project Dates</h3>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DatePicker
                  label="Start date"
                  value={editStartDate}
                  onChange={setEditStartDate}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
                <DatePicker
                  label="End date"
                  value={editEndDate}
                  onChange={setEditEndDate}
                  minDate={editStartDate || undefined}
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                />
              </div>
            </LocalizationProvider>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveDates}
                disabled={savingDates}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingDates ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
              <button
                onClick={() => {
                  setEditStartDate(project.start_date ? dayjs(project.start_date) : null);
                  setEditEndDate(project.end_date ? dayjs(project.end_date) : null);
                  setIsEditingDates(false);
                }}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-300"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Members */}
        {project.members_data && project.members_data.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Users size={13} className="text-slate-600" />
              <h3 className="text-xs font-semibold text-slate-700">Members ({project.members_data.length})</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {project.members_data.map((member) => (
                <div key={member.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-slate-700">{member.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-3">
          <button
            title="Settings"
            className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 transition"
          >
            <Settings size={16} />
          </button>
          <button
            title="Share"
            className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 transition"
          >
            <Share2 size={16} />
          </button>
          <button
            title="Delete project"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100 transition"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* ── Stats cards ── */}
      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Tasks</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{tasks.length}</p>
            </div>
            <Folder size={22} className="text-blue-400" />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{unassignedTasks} unassigned</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm transition hover:border-purple-300 hover:bg-purple-50/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Teams</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{teams.length}</p>
            </div>
            <Users size={22} className="text-purple-400" />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{teamsWithTasks} with tasks</p>
        </div>
      </div>

      {/* ── Context inclusion ── */}
      <section className="rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        <button
          onClick={() => setContextSectionOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-4"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Globe size={16} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold text-slate-900">Include to Context</h2>
              <p className="text-[10px] text-slate-500">
                Link this project to public contexts
                {linkedContextIds.size > 0 && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                    {linkedContextIds.size} linked
                  </span>
                )}
              </p>
            </div>
          </div>
          {contextSectionOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {contextSectionOpen && (
          <div className="border-t border-slate-100 px-4 pb-4">
            {loadingContexts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-emerald-400" />
                <span className="ml-2 text-xs text-slate-500">Loading contexts...</span>
              </div>
            ) : publicContexts.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">No public contexts available.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {publicContexts.map((ctx) => {
                  const isLinked = linkedContextIds.has(ctx.id);
                  const isToggling = togglingContext === ctx.id;
                  return (
                    <div
                      key={ctx.id}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition ${
                        isLinked ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${isLinked ? "bg-emerald-200" : "bg-slate-200"}`}>
                          <Globe size={12} className={isLinked ? "text-emerald-700" : "text-slate-500"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-slate-900">{ctx.name}</span>
                            {ctx.is_own && <span className="rounded bg-blue-100 px-1 py-0.5 text-[8px] font-medium text-blue-600">yours</span>}
                          </div>
                          <span className="text-[10px] text-slate-400">by {ctx.owner_username}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleContext(ctx.id)}
                        disabled={isToggling}
                        className={`flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                          isLinked ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : isLinked ? (
                          <Unlink size={10} />
                        ) : (
                          <Link2 size={10} />
                        )}
                        {isLinked ? "Remove" : "Include"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Teams & Tasks ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Teams */}
        <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Users size={16} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Teams</h2>
                <p className="text-[10px] text-slate-500">{teams.length} {teams.length === 1 ? "Team" : "Teams"}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/projects/${projectId}/teams`)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
            >
              Manage
            </button>
          </div>

          {teams.length > 0 ? (
            <div className="space-y-1.5">
              {(showAllTeams ? teams : teams.slice(0, 4)).map((team) => (
                <div
                  key={team.id}
                  onClick={() => navigate(`/projects/${projectId}/teams/${team.id}`)}
                  className="group flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color || "#64748b" }} />
                    <span className="text-xs font-medium text-slate-900">{team.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{team.tasks?.length || 0} tasks</span>
                </div>
              ))}
              {teams.length > 4 && (
                <button
                  onClick={() => setShowAllTeams((v) => !v)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition mt-1"
                >
                  {showAllTeams ? "Show less" : `Show all ${teams.length} teams`}
                </button>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Users size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-500">No teams yet</p>
            </div>
          )}
        </section>

        {/* Tasks */}
        <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <Folder size={16} className="text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
                <p className="text-[10px] text-slate-500">{tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/projects/${projectId}/tasks`)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
            >
              Manage
            </button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-1.5">
              {(showAllTasks ? tasks : tasks.slice(0, 4)).map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                  className="cursor-pointer rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-900">{task.name}</p>
                      {task.team && <p className="mt-0.5 text-[10px] text-slate-500">{task.team.name}</p>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1 text-[10px] text-slate-500">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5">P{task.priority || 0}</span>
                      <span className="rounded bg-purple-50 px-1.5 py-0.5">D{task.difficulty || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length > 4 && (
                <button
                  onClick={() => setShowAllTasks((v) => !v)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition mt-1"
                >
                  {showAllTasks ? "Show less" : `Show all ${tasks.length} tasks`}
                </button>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Folder size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-500">No tasks yet</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Delete Project Modal ── */}
      {showDeleteModal && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4">
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-2xl max-w-md w-full">
              <div className="mb-5 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle size={24} className="text-red-600" />
                </div>
              </div>
              <h2 className="mb-2 text-center text-lg font-semibold text-slate-900">Delete Project</h2>
              <p className="mb-4 text-center text-sm text-slate-600">This can't be undone.</p>
              <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="text-xs text-slate-600">You are about to delete:</p>
                <p className="mt-1 truncate text-sm font-semibold text-red-600">{project.name}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
