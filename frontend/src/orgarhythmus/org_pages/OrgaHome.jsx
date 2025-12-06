import { useEffect, useState, useCallback } from "react";
import Button from "@mui/material/Button";
import { Plus, X } from "lucide-react";
import { fetch_all_tasks, fetch_all_teams } from "../org_API";
import CreateTaskForm from "../org_components/CreateTaskForm";
import SMTaskCard from "../org_components/TaskCardSM";

/* ---------- Stats component ---------- */
function Stats({ tasks, teams }) {
  const totalTasks = tasks.length;
  const totalTeams = teams.length;
  const unassignedTasks = tasks.filter((t) => !t.team).length;

  const avgPriority =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.priority || 0), 0) / totalTasks).toFixed(1)
      : "-";

  const avgDifficulty =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.difficulty || 0), 0) / totalTasks).toFixed(1)
      : "-";

  return (
    <section className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Total Tasks */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Tasks
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTasks}</p>
        <p className="mt-1 text-xs text-slate-500">Total tasks in your board</p>
      </div>

      {/* Total Teams */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Teams
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTeams}</p>
        <p className="mt-1 text-xs text-slate-500">Active task groups</p>
      </div>

      {/* Unassigned tasks */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Unassigned
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{unassignedTasks}</p>
        <p className="mt-1 text-xs text-slate-500">Tasks without a team</p>
      </div>

      {/* Averages */}
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Avg. Prio / Diff
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {avgPriority} / {avgDifficulty}
        </p>
        <p className="mt-1 text-xs text-slate-500">Based on all tasks</p>
      </div>
    </section>
  );
}

/* ---------- OrgaHome ---------- */
export default function OrgaHome() {
  const [all_teams, setAll_Teams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  // ✅ Load all data (tasks + teams)
  const loadAllData = useCallback(async () => {
    const all_fetched_tasks = await fetch_all_tasks();
    setTasks(all_fetched_tasks || []);

    const all_fetched_teams = await fetch_all_teams();
    setAll_Teams(all_fetched_teams || []);

    console.log("Data loaded:", all_fetched_tasks);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const hasTasks = tasks && tasks.length > 0;

  const handleTaskCreated = useCallback(() => {
    // Reload data and close panel
    loadAllData();
    setShowCreatePanel(false);
  }, [loadAllData]);

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              OrgaRhythmus Board
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {hasTasks
                ? `You currently have ${tasks.length} task${
                    tasks.length === 1 ? "" : "s"
                  } across ${all_teams.length} team${
                    all_teams.length === 1 ? "" : "s"
                  }.`
                : "Start your rhythm by creating the first task."}
            </p>
          </div>

          {/* Create Task button */}
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
              New Task
            </Button>
          </div>
        </header>

        {/* Animated create panel */}
        {showCreatePanel && (
          <div className="mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-md p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-500">
                    Create a new task
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Define name, team, priority and difficulty to add it to your rhythm.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePanel(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Slight inner highlight bar */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

              {/* Your existing form component */}
              <div className="mt-2">
                <CreateTaskForm onTaskCreated={handleTaskCreated} />
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <Stats tasks={tasks} teams={all_teams} />

        {/* Tasks container */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500">
              Tasks
            </h2>
            <span className="text-xs text-slate-400">
              {hasTasks ? "Live overview" : "Nothing here yet"}
            </span>
          </div>

          {hasTasks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 place-items-stretch">
              {tasks.map((task) => (
                <SMTaskCard
                  key={task.id}
                  task={task}
                  onTaskDeleted={loadAllData}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-500 text-sm">
              <p className="font-medium">No tasks yet.</p>
              <p className="mt-1">
                Hit <span className="font-semibold">“New Task”</span> in the top
                right to get started ✨
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
