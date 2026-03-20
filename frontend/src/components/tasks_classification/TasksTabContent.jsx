/**
 * TasksTabContent — task list for the "All Tasks" tab inside TaskStructure.
 */
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Plus, Filter, X, Loader2, CheckCircle2, Flag, Target } from "lucide-react";
import Button from "@mui/material/Button";
import { fetchTasksForProject, fetchTeamsForProject } from "../../api/org_API.js";
import { emitDataEvent, useManualRefresh } from "../../api/dataEvents";
import ProjectCreateTaskForm from "../ProjectCreateTaskForm";
import { fetchTaskLegendsApi, fetchTaskLegendTypesApi } from "./api/taskLegendApi.js";
import { renderLegendTypeIcon } from "../ideas/legendTypeIcons.jsx";

/* ── Compact inline task card ── */
function TaskRow({ task, activeLegendId, onClick }) {
  const isDone = task.is_done;

  // Active legend badge
  const legendBadge = activeLegendId
    ? task.legend_types?.[String(activeLegendId)] ?? null
    : null;

  // All legend badges (when no legend selected, show all)
  const allBadges = !activeLegendId
    ? Object.values(task.legend_types || {})
    : null;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm ${
        isDone
          ? "border-green-200 bg-green-50/40 hover:border-green-300"
          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {isDone && <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-green-600" />}
          <span
            className={`text-xs font-semibold leading-snug ${
              isDone ? "text-green-800 line-through decoration-green-400" : "text-slate-900"
            }`}
          >
            {task.name}
          </span>
        </div>

        {/* Legend badge(s) */}
        <div className="flex flex-shrink-0 flex-wrap gap-1">
          {legendBadge && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: legendBadge.color }}
            >
              {legendBadge.icon && (
                <span style={{ fontSize: 10, lineHeight: 1 }}>
                  {renderLegendTypeIcon(legendBadge.icon, { style: { fontSize: 10 }, className: "text-white" })}
                </span>
              )}
              {legendBadge.name}
            </span>
          )}
          {allBadges && allBadges.map((b, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: b.color }}
            >
              {b.icon && (
                <span style={{ fontSize: 10, lineHeight: 1 }}>
                  {renderLegendTypeIcon(b.icon, { style: { fontSize: 10 }, className: "text-white" })}
                </span>
              )}
              {b.name}
            </span>
          ))}
        </div>
      </div>

      {/* Priority / Difficulty */}
      {(task.priority > 0 || task.difficulty > 0) && (
        <div className="mt-1.5 flex items-center gap-2">
          {task.priority > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Flag size={9} /> {task.priority}
            </span>
          )}
          {task.difficulty > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <Target size={9} /> {task.difficulty}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function TasksTabContent({ onViewTaskDetail }) {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [legendsWithTypes, setLegendsWithTypes] = useState([]);
  const [activeLegendId, setActiveLegendId] = useState(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  useManualRefresh(loadData);

  async function loadData() {
    if (!projectId) return;
    try {
      setLoading(true);
      const [taskData, teamData, legends] = await Promise.all([
        fetchTasksForProject(projectId),
        fetchTeamsForProject(projectId),
        fetchTaskLegendsApi(projectId),
      ]);
      setTasks(taskData);
      setTeams(teamData);
      // Fetch all types in parallel
      const withTypes = await Promise.all(
        legends.map(async (leg) => ({
          ...leg,
          types: await fetchTaskLegendTypesApi(projectId, leg.id),
        })),
      );
      setLegendsWithTypes(withTypes);
      // Auto-select first legend if none selected
      setActiveLegendId((prev) => {
        if (prev) return prev;
        return withTypes.length > 0 ? withTypes[0].id : null;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleTaskCreated() {
    setShowCreatePanel(false);
    emitDataEvent('tasks');
    loadData();
  }

  function toggleTeamFilter(teamId) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  }

  const filteredTasks = useMemo(() => {
    if (selectedTeamIds.length === 0) return tasks;
    return tasks.filter((t) => t.team && selectedTeamIds.includes(t.team.id));
  }, [tasks, selectedTeamIds]);

  const groupedTasks = useMemo(() => {
    const groups = {};
    filteredTasks.forEach((task) => {
      const teamId = task.team?.id || "unassigned";
      if (!groups[teamId]) groups[teamId] = { team: task.team || null, tasks: [] };
      groups[teamId].tasks.push(task);
    });
    const entries = Object.values(groups);
    entries.sort((a, b) => {
      if (!a.team) return 1;
      if (!b.team) return -1;
      return (a.team.name || "").localeCompare(b.team.name || "");
    });
    return entries;
  }, [filteredTasks]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-slate-700">
          {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
        </span>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={() => setShowCreatePanel(!showCreatePanel)}
          style={{ textTransform: "none", borderRadius: "8px", fontSize: "11px", padding: "4px 12px" }}
        >
          New Task
        </Button>
      </div>

      {/* Create panel */}
      {showCreatePanel && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex-shrink-0">
          <ProjectCreateTaskForm projectId={projectId} onTaskCreated={handleTaskCreated} />
        </div>
      )}

      {/* Legend selector */}
      {legendsWithTypes.length > 0 && (
        <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Legend:</span>
          {legendsWithTypes.map((leg) => (
            <button
              key={leg.id}
              onClick={() => setActiveLegendId(activeLegendId === leg.id ? null : leg.id)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                activeLegendId === leg.id
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {leg.name}
            </button>
          ))}
          {/* Show type key for active legend */}
          {activeLegendId && (() => {
            const leg = legendsWithTypes.find((l) => l.id === activeLegendId);
            return leg?.types?.length > 0 ? (
              <div className="ml-1 flex items-center gap-1">
                {leg.types.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.icon && (
                      <span style={{ fontSize: 10, lineHeight: 1 }}>
                        {renderLegendTypeIcon(t.icon, { style: { fontSize: 10 }, className: "text-white" })}
                      </span>
                    )}
                    {t.name}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Team filter */}
      {teams.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white/70 p-3 flex-shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Filter by Team
              </span>
            </div>
            {selectedTeamIds.length > 0 && (
              <button
                onClick={() => setSelectedTeamIds([])}
                className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200"
              >
                <X size={10} /> Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeamFilter(team.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color || "#64748b" }} />
                  {team.name}
                  <span className="text-[10px] text-slate-400">
                    ({tasks.filter((t) => t.team?.id === team.id).length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tasks grouped by team */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-5">
          {groupedTasks.map((group, idx) => (
            <div key={idx}>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <div
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: group.team ? group.team.color || "#64748b" : "#cbd5e1" }}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {group.team ? group.team.name : "Unassigned"}
                </span>
                <span className="text-[10px] text-slate-400">{group.tasks.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    activeLegendId={activeLegendId}
                    onClick={() => onViewTaskDetail(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No tasks yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Hit <span className="font-semibold">&quot;New Task&quot;</span> to add the first one.
          </p>
        </div>
      )}
    </div>
  );
}
