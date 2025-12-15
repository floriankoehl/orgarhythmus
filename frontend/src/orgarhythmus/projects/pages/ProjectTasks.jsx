// orgarhythmus/projects/pages/ProjectTasks.jsx

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { Plus } from "lucide-react";

import {
  fetchTasksForProject,
  fetchTeamsForProject,
} from "../../api/org_API";
import SMTaskCard from "../../org_components/TaskCardSM";
import ProjectCreateTaskForm from "../components/ProjectCreateTaskForm";

/* ---- Stats, wie in OrgaHome ---- */
function ProjectStats({ tasks, teams }) {
  const totalTasks = tasks.length;
  const totalTeams = teams.length;
  const unassignedTasks = tasks.filter((t) => !t.team).length;

  const avgPriority =
    totalTasks > 0
      ? (
        tasks.reduce((sum, t) => sum + (t.priority || 0), 0) / totalTasks
      ).toFixed(1)
      : "-";

  const avgDifficulty =
    totalTasks > 0
      ? (
        tasks.reduce((sum, t) => sum + (t.difficulty || 0), 0) / totalTasks
      ).toFixed(1)
      : "-";

  return (
    <section className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Tasks
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {totalTasks}
        </p>
        <p className="mt-1 text-xs text-slate-500">Tasks in this project</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Teams
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {totalTeams}
        </p>
        <p className="mt-1 text-xs text-slate-500">Project teams</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Unassigned
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {unassignedTasks}
        </p>
        <p className="mt-1 text-xs text-slate-500">Without team</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Avg. Prio / Diff
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {avgPriority} / {avgDifficulty}
        </p>
        <p className="mt-1 text-xs text-slate-500">Based on project tasks</p>
      </div>
    </section>
  );
}

/* ---- Hauptkomponente ---- */
export default function ProjectTasks() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [taskData, teamData] = await Promise.all([
        fetchTasksForProject(projectId),
        fetchTeamsForProject(projectId),
      ]);

      setTasks(taskData || []);
      setTeams(teamData || []);
    } catch (err) {
      console.error("Failed to load project tasks/teams:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasTasks = tasks && tasks.length > 0;

  function handleTaskCreated() {
    loadData();
    setShowCreatePanel(false);
  }

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              Project #{projectId} – Tasks
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage all event tasks inside this project and assign them to
              project teams.
            </p>
          </div>

          <div className="flex justify-start sm:justify-end">
            <Button
              variant="contained"
              size="medium"
              onClick={() => setShowCreatePanel(true)}
              style={{
                borderRadius: "9999px",
                paddingInline: "1.25rem",
                textTransform: "none",
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
              }}
            >
              <Plus size={18} />
              New Project Task
            </Button>
          </div>
        </header>

        {/* Create Panel */}
        {showCreatePanel && (
          <div className="mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-md p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-500">
                    Create a new project task
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Define name, team, priority and difficulty for this project.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePanel(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

              <div className="mt-2">
                <ProjectCreateTaskForm
                  projectId={projectId}
                  teams={teams}
                  onCreated={handleTaskCreated}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <ProjectStats tasks={tasks} teams={teams} />

        {/* Tasks Grid */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500">
              Project tasks
            </h2>
            <span className="text-xs text-slate-400">
              {loading
                ? "Loading…"
                : hasTasks
                  ? "Live project overview"
                  : "Nothing here yet"}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Loading tasks…
            </div>
          ) : hasTasks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 place-items-stretch">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/orgarhythmus/projects/${projectId}/tasks/${task.id}`)}
                  className="p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  <SMTaskCard
                    projectId={projectId}
                    task={task}
                    onTaskDeleted={loadData}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-500 text-sm">
              <p className="font-medium">No tasks in this project yet.</p>
              <p className="mt-1">
                Hit{" "}
                <span className="font-semibold">“New Project Task”</span> to
                add the first event ✨
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
