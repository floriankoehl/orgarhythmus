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
