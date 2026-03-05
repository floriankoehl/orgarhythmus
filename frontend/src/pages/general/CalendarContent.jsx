import { useParams } from "react-router-dom";
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
} from "../../api/dependencies_api.js";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Loader2,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { useDataRefresh } from "../../api/dataEvents";

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

/**
 * CalendarContent — renders the calendar inside CalendarWindow.
 *
 * Props:
 *   effectiveView  "3d" | "7d" | "1m"
 *   transposed     boolean (swap rows ↔ columns for 3d/7d)
 *   windowSize     { w, h }
 */
export default function CalendarContent({ effectiveView, transposed, windowSize }) {
  const { projectId } = useParams();

  // ── Data ──
  const [projectData, setProjectData] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState({});
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Filters & navigation ──
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [currentDayStart, setCurrentDayStart] = useState(dayjs().startOf("day"));
  const [showFilters, setShowFilters] = useState(false);

  // ── Month-view UI ──
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cross-window sync: reload when tasks/teams/milestones change ──
  const loadDataCb = useCallback(() => { loadData(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useDataRefresh(['tasks', 'teams', 'milestones'], loadDataCb);

  async function loadData() {
    try {
      setLoading(true);
      const [projectRes, teamsRes, tasksRes, milestonesRes] = await Promise.all([
        fetch_project_details(projectId),
        fetch_project_teams(projectId),
        fetch_project_tasks(projectId),
        get_all_milestones(projectId),
      ]);

      setProjectData(projectRes.project);

      const teamsObj = {};
      for (const team of teamsRes.teams) {
        teamsObj[team.id] = team;
      }
      setTeams(teamsObj);
      setTasks(tasksRes.tasks || {});

      const fetchedMilestones = milestonesRes.milestones;
      setMilestones(Array.isArray(fetchedMilestones) ? fetchedMilestones : []);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  }

  // ── Enriched milestones ──
  const enrichedMilestones = useMemo(() => {
    if (!projectData?.start_date) return [];
    const startDate = dayjs(projectData.start_date);

    return milestones.map((ms) => {
      const task = tasks[ms.task];
      const teamId = task?.team;
      const team = teamId ? teams[teamId] : null;
      return {
        ...ms,
        taskName: task?.name || "Unknown Task",
        teamName: team?.name || "No Team",
        teamColor: team?.color || "#64748b",
        teamId,
        startDay: startDate.add(ms.start_index, "day"),
        endDay: startDate.add(ms.start_index + ms.duration - 1, "day"),
      };
    });
  }, [milestones, tasks, teams, projectData]);

  // ── Filtered milestones ──
  const filteredMilestones = useMemo(() => {
    if (selectedTeamIds.length === 0) return enrichedMilestones;
    return enrichedMilestones.filter((ms) => selectedTeamIds.includes(ms.teamId));
  }, [enrichedMilestones, selectedTeamIds]);

  // ── Group by date ──
  const milestonesByDate = useMemo(() => {
    const grouped = {};
    filteredMilestones.forEach((ms) => {
      let current = ms.startDay;
      while (current.isBefore(ms.endDay) || current.isSame(ms.endDay, "day")) {
        const dateKey = current.format("YYYY-MM-DD");
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(ms);
        current = current.add(1, "day");
      }
    });
    return grouped;
  }, [filteredMilestones]);

  // ── Days in current month (for month view) ──
  const daysInMonth = useMemo(() => {
    const days = [];
    const start = currentMonth.startOf("month");
    const end = currentMonth.endOf("month");
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "day")) {
      days.push(current);
      current = current.add(1, "day");
    }
    return days;
  }, [currentMonth]);

  // ── Days for 3d / 7d views ──
  const shortDays = useMemo(() => {
    const count = effectiveView === "3d" ? 3 : 7;
    return Array.from({ length: count }, (_, i) => currentDayStart.add(i, "day"));
  }, [currentDayStart, effectiveView]);

  // ── Unique teams for filter ──
  const uniqueTeams = useMemo(() => {
    return Object.values(teams).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [teams]);

  const toggleTeamFilter = (teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const clearFilters = () => setSelectedTeamIds([]);

  const today = dayjs();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  MONTH VIEW — exact replica of original Calender.jsx desktop grid
  // ─────────────────────────────────────────────────────────────
  if (effectiveView === "1m") {
    return (
      <div className="flex flex-col h-full p-3 gap-2">
        {/* Header with navigation */}
        <header className="flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
              <CalendarIcon size={16} />
            </div>
            <h1 className="text-sm font-semibold text-slate-900">Project Calendar</h1>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronLeft size={13} />
            </button>
            <div className="min-w-28 text-center">
              <h2 className="text-sm font-semibold text-slate-900">
                {currentMonth.format("MMMM YYYY")}
              </h2>
            </div>
            <button
              onClick={() => setCurrentMonth(dayjs())}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Milestone count + filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {filteredMilestones.length} milestone{filteredMilestones.length !== 1 ? "s" : ""}
            </span>
            {uniqueTeams.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-lg border transition ${
                  showFilters || selectedTeamIds.length > 0
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
                title="Filter by team"
              >
                <Filter size={13} />
                {selectedTeamIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                    {selectedTeamIds.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Filter panel (inline) */}
        {showFilters && uniqueTeams.length > 0 && (
          <div className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filter by Team</span>
              </div>
              {selectedTeamIds.length > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  <X size={11} /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {uniqueTeams.map((team) => {
                const isSelected = selectedTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeamFilter(team.id)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || "#64748b" }} />
                    {team.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div className="flex-1 min-h-0 overflow-auto">
          <section className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-sm min-w-[640px]">
            {/* Day headers */}
            <div className="mb-2 sticky top-0 z-10 bg-white/90 backdrop-blur-sm grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before month starts (Monday = first day) */}
              {Array.from({ length: (currentMonth.startOf("month").day() - 1 + 7) % 7 }).map((_, i) => (
                <div key={`empty-start-${i}`} className="min-h-20 rounded-lg bg-slate-50/30" />
              ))}

              {/* Days */}
              {daysInMonth.map((day) => {
                const dateKey = day.format("YYYY-MM-DD");
                const dayMilestones = milestonesByDate[dateKey] || [];
                const isToday = day.isSame(today, "day");
                const isCurrentMonth = day.isSame(currentMonth, "month");
                const isExpanded = expandedDate === dateKey;

                return (
                  <div
                    key={dateKey}
                    className={`relative min-h-20 rounded-lg border transition ${
                      isToday
                        ? "border-blue-400 bg-blue-50"
                        : dayMilestones.length > 0
                          ? "border-slate-300 bg-white"
                          : "border-slate-200 bg-slate-50/40"
                    } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-semibold ${
                            isToday ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {day.date()}
                        </span>
                        {dayMilestones.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            {dayMilestones.length}
                          </span>
                        )}
                      </div>
                      {dayMilestones.length > 0 && (
                        <button
                          onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                          className="p-1 rounded-lg bg-blue-100 hover:bg-blue-200 transition text-blue-600 hover:text-blue-700 shadow-sm"
                          title="View milestones"
                        >
                          <Info size={14} />
                        </button>
                      )}
                    </div>

                    {/* Milestones preview */}
                    {dayMilestones.length > 0 && (
                      <div
                        className="cursor-pointer px-2 pb-1.5 overflow-y-auto max-h-20"
                        onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                      >
                        <div className="space-y-0.5">
                          {dayMilestones.map((ms) => (
                            <div
                              key={ms.id}
                              className="group relative flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition hover:shadow-md"
                              style={{
                                backgroundColor: ms.teamColor + "20",
                                borderLeft: `3px solid ${ms.teamColor}`,
                              }}
                            >
                              <div className="min-w-0 flex-1 truncate">
                                <p className="truncate font-semibold text-slate-900">{ms.name}</p>
                              </div>
                              <span className="text-[9px] text-slate-400 flex-shrink-0">{ms.duration}d</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty cells after month ends */}
              {Array.from({
                length: (7 - ((daysInMonth.length + (currentMonth.startOf("month").day() - 1 + 7) % 7) % 7)) % 7,
              }).map((_, i) => (
                <div key={`empty-end-${i}`} className="min-h-20 rounded-lg bg-slate-50/30" />
              ))}
            </div>
          </section>
        </div>

        {/* Expanded date modal */}
        {expandedDate && milestonesByDate[expandedDate] && (
          <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999]" onClick={() => setExpandedDate(null)} />
            <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4">
              <section className="rounded-2xl border border-blue-200 bg-white shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white rounded-t-2xl mb-4 flex items-center justify-between p-6 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {dayjs(expandedDate).format("dddd, MMMM D, YYYY")}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      {milestonesByDate[expandedDate].length} milestone
                      {milestonesByDate[expandedDate].length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedDate(null)}
                    className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 px-6 pb-6">
                  {milestonesByDate[expandedDate].map((ms) => (
                    <div
                      key={ms.id}
                      className="rounded-lg border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: ms.teamColor }} />
                              <h3 className="truncate text-sm font-semibold text-slate-900">{ms.name}</h3>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">Task: {ms.taskName}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{ms.teamName}</span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {ms.duration} day{ms.duration !== 1 ? "s" : ""}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {ms.startDay.format("MMM D")} {"\u2192"} {ms.endDay.format("MMM D")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {/* Empty state */}
        {filteredMilestones.length === 0 && (
          <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/70 p-8 text-center">
            <CalendarIcon size={40} className="mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-semibold text-slate-900">No milestones scheduled</h3>
            <p className="mt-1 text-xs text-slate-600">
              {selectedTeamIds.length > 0
                ? "Try adjusting your team filter"
                : "Create milestones in the Dependencies view to populate this calendar"}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  3-DAY / 7-DAY VIEW
  // ─────────────────────────────────────────────────────────────
  const dayCount = effectiveView === "3d" ? 3 : 7;

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* Header with day navigation */}
      <header className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
            <CalendarIcon size={16} />
          </div>
          <h1 className="text-sm font-semibold text-slate-900">
            {effectiveView === "3d" ? "3-Day" : "7-Day"} View
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDayStart(currentDayStart.subtract(dayCount, "day"))}
            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ChevronLeft size={13} />
          </button>
          <div className="min-w-36 text-center">
            <h2 className="text-sm font-semibold text-slate-900">
              {currentDayStart.format("MMM D")} {"\u2013"} {currentDayStart.add(dayCount - 1, "day").format("MMM D, YYYY")}
            </h2>
          </div>
          <button
            onClick={() => setCurrentDayStart(dayjs().startOf("day"))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDayStart(currentDayStart.add(dayCount, "day"))}
            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {filteredMilestones.length} milestone{filteredMilestones.length !== 1 ? "s" : ""}
          </span>
          {uniqueTeams.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg border transition relative ${
                showFilters || selectedTeamIds.length > 0
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
              title="Filter by team"
            >
              <Filter size={13} />
              {selectedTeamIds.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white">
                  {selectedTeamIds.length}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Filter panel (inline) */}
      {showFilters && uniqueTeams.length > 0 && (
        <div className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filter by Team</span>
            </div>
            {selectedTeamIds.length > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <X size={11} /> Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {uniqueTeams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <button
                  key={team.id}
                  onClick={() => toggleTeamFilter(team.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || "#64748b" }} />
                  {team.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day columns / rows */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div
          className={`grid gap-2 h-full ${
            transposed
              ? "" // rows: one row per day
              : "" // columns: one column per day (default)
          }`}
          style={
            transposed
              ? { gridTemplateRows: `repeat(${dayCount}, 1fr)`, gridTemplateColumns: "1fr" }
              : { gridTemplateColumns: `repeat(${dayCount}, 1fr)`, gridTemplateRows: "1fr" }
          }
        >
          {shortDays.map((day) => {
            const dateKey = day.format("YYYY-MM-DD");
            const dayMilestones = milestonesByDate[dateKey] || [];
            const isToday = day.isSame(today, "day");

            return (
              <div
                key={dateKey}
                className={`flex flex-col rounded-xl border overflow-hidden ${
                  isToday ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"
                }`}
              >
                {/* Day header */}
                <div
                  className={`flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 ${
                    isToday ? "border-blue-300 bg-blue-100/60" : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                      isToday ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {day.date()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{day.format("dddd")}</p>
                    <p className="text-[10px] text-slate-500">{day.format("MMM D, YYYY")}</p>
                  </div>
                  {dayMilestones.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      {dayMilestones.length}
                    </span>
                  )}
                </div>

                {/* Milestone list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {dayMilestones.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-4">No milestones</p>
                  ) : (
                    dayMilestones.map((ms) => (
                      <div
                        key={ms.id}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition hover:shadow-md"
                        style={{
                          backgroundColor: ms.teamColor + "20",
                          borderLeft: `3px solid ${ms.teamColor}`,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{ms.name}</p>
                          <p className="truncate text-[10px] text-slate-500">
                            {ms.taskName} {"\u00B7"} {ms.teamName} {"\u00B7"} {ms.duration}d
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{ms.duration}d</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {filteredMilestones.length === 0 && (
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/70 p-8 text-center">
          <CalendarIcon size={40} className="mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-semibold text-slate-900">No milestones scheduled</h3>
          <p className="mt-1 text-xs text-slate-600">
            {selectedTeamIds.length > 0
              ? "Try adjusting your team filter"
              : "Create milestones in the Dependencies view to populate this calendar"}
          </p>
        </div>
      )}
    </div>
  );
}
