/**
 * TasksTabContent — task list for the "All Tasks" tab inside TaskStructure.
 */
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Plus, Filter, X, Loader2 } from "lucide-react";
import Button from "@mui/material/Button";
import { fetchTasksForProject, fetchTeamsForProject } from "../../api/org_API.js";
import { emitDataEvent, useManualRefresh } from "../../api/dataEvents";
import SMTaskCard from "../TaskCardSM.jsx";
import ProjectCreateTaskForm from "../ProjectCreateTaskForm";

export default function TasksTabContent({ onViewTaskDetail }) {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
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
      const [taskData, teamData] = await Promise.all([
        fetchTasksForProject(projectId),
        fetchTeamsForProject(projectId),
      ]);
      setTasks(taskData);
      setTeams(teamData);
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

  function clearFilters() {
    setSelectedTeamIds([]);
  }

  const filteredTasks = useMemo(() => {
    if (selectedTeamIds.length === 0) return tasks;
    return tasks.filter((t) => t.team && selectedTeamIds.includes(t.team.id));
  }, [tasks, selectedTeamIds]);

  const groupedTasks = useMemo(() => {
    const groups = {};
    filteredTasks.forEach((task) => {
      const teamId = task.team?.id || "unassigned";
      if (!groups[teamId]) {
        groups[teamId] = { team: task.team || null, tasks: [] };
      }
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">Loading tasks…</span>
        </div>
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

      {/* Team filter */}
      {teams.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white/70 p-3 flex-shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-500" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Filter by Team
              </span>
            </div>
            {selectedTeamIds.length > 0 && (
              <button
                onClick={clearFilters}
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
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: team.color || "#64748b" }}
                  />
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
              {/* Team header */}
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <div
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.team ? group.team.color || "#64748b" : "#cbd5e1" }}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {group.team ? group.team.name : "Unassigned"}
                </span>
                <span className="text-[10px] text-slate-400">{group.tasks.length}</span>
              </div>
              {/* Task cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onViewTaskDetail(task.id)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm"
                  >
                    <SMTaskCard projectId={projectId} task={task} onTaskDeleted={loadData} />
                  </div>
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
