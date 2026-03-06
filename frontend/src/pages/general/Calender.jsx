import { useParams, useNavigate } from 'react-router-dom';
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
} from '../../api/dependencies_api.js';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Loader2,
  Filter,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
// 
export default function Calendar() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Data
  const [projectData, setProjectData] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState({});
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters & View
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [showFilters, setShowFilters] = useState(false);

  // UI
  const [expandedDate, setExpandedDate] = useState(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState(dayjs());

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [projectRes, teamsRes, tasksRes, milestonesRes] = await Promise.all([
        fetch_project_details(projectId),
        fetch_project_teams(projectId),
        fetch_project_tasks(projectId),
        get_all_milestones(projectId),
      ]);

      setProjectData(projectRes.project);

      // Build teams lookup
      const teamsObj = {};
      for (const team of teamsRes.teams) {
        teamsObj[team.id] = team;
      }
      setTeams(teamsObj);

      // Tasks lookup
      setTasks(tasksRes.tasks || {});

      // Milestones
      const fetchedMilestones = milestonesRes.milestones;
      if (Array.isArray(fetchedMilestones)) {
        setMilestones(fetchedMilestones);
      } else {
        setMilestones([]);
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Helpers for mobile weekly navigation (Monday-first week)
  function getMondayStart(date) {
    const d = dayjs(date);
    const weekday = d.day(); // 0=Sun, 1=Mon, ... 6=Sat
    return d.subtract((weekday + 6) % 7, 'day');
  }

  function clampDateToRange(d, range) {
    let x = d;
    if (x.isBefore(range.start)) x = range.start;
    if (x.isAfter(range.end)) x = range.end;
    return x;
  }

  const mobileWeekStart = useMemo(() => getMondayStart(mobileSelectedDate), [mobileSelectedDate]);

  function navigateMobileWeek(offset) {
    const target = dayjs(mobileSelectedDate).add(offset, 'week');
    const clamped = clampDateToRange(target, calendarRange);
    setMobileSelectedDate(clamped);
  }

  // Determine calendar range from project dates
  const getCalendarRange = () => {
    if (!projectData?.start_date) {
      return {
        start: dayjs().startOf('month'),
        end: dayjs().add(3, 'month').endOf('month'),
      };
    }
    const projectStart = dayjs(projectData.start_date).startOf('month');
    const projectEnd = projectData.end_date
      ? dayjs(projectData.end_date).endOf('month')
      : dayjs(projectData.start_date).add(3, 'month').endOf('month');
    return { start: projectStart, end: projectEnd };
  };

  const calendarRange = getCalendarRange();

  // Build enriched milestones with date info
  const enrichedMilestones = useMemo(() => {
    if (!projectData?.start_date) return [];
    const startDate = dayjs(projectData.start_date);

    return milestones.map((ms) => {
      const task = tasks[ms.task];
      const teamId = task?.team;
      const team = teamId ? teams[teamId] : null;

      return {
        ...ms,
        taskName: task?.name || 'Unknown Task',
        teamName: team?.name || 'No Team',
        teamColor: team?.color || '#64748b',
        teamId: teamId,
        startDay: startDate.add(ms.start_index, 'day'),
        endDay: startDate.add(ms.start_index + ms.duration - 1, 'day'),
      };
    });
  }, [milestones, tasks, teams, projectData]);

  // Filter milestones by team
  const filteredMilestones = useMemo(() => {
    let filtered = enrichedMilestones;
    if (selectedTeamIds.length > 0) {
      filtered = filtered.filter((ms) => selectedTeamIds.includes(ms.teamId));
    }
    return filtered;
  }, [enrichedMilestones, selectedTeamIds]);

  // Group milestones by date (milestones span multiple days)
  const milestonesByDate = useMemo(() => {
    const grouped = {};
    filteredMilestones.forEach((ms) => {
      let current = ms.startDay;
      while (current.isBefore(ms.endDay) || current.isSame(ms.endDay, 'day')) {
        const dateKey = current.format('YYYY-MM-DD');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(ms);
        current = current.add(1, 'day');
      }
    });
    return grouped;
  }, [filteredMilestones]);

  // Get all days in the current month view
  const daysInMonth = useMemo(() => {
    const days = [];
    const start = currentMonth.startOf('month');
    const end = currentMonth.endOf('month');
    let current = start;
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    return days;
  }, [currentMonth]);

  // Toggle team filter
  const toggleTeamFilter = (teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const clearFilters = () => {
    setSelectedTeamIds([]);
  };

  // Unique teams for filter
  const uniqueTeams = useMemo(() => {
    return Object.values(teams).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [teams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const today = dayjs();

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-7xl flex-col gap-2 py-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
              <CalendarIcon size={18} />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Project Calendar</h1>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronLeft size={13} />
            </button>
            <div className="min-w-32 text-center">
              <h2 className="text-sm font-semibold text-slate-900">{currentMonth.format('MMMM YYYY')}</h2>
            </div>
            <button
              onClick={() => setCurrentMonth(dayjs())}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Milestone count */}
          <div className="text-xs text-slate-500">
            {filteredMilestones.length} milestone{filteredMilestones.length !== 1 ? 's' : ''}
          </div>
        </header>

        {/* Mobile Weekly View */}
        <div className="sm:hidden rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigateMobileWeek(-1)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronLeft size={13} />
            </button>
            <div className="text-sm font-semibold text-slate-900">
              {mobileWeekStart.format('MMM D')} {'\u2013'} {mobileWeekStart.add(6, 'day').format('MMM D')}
            </div>
            <button
              onClick={() => navigateMobileWeek(1)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Days Row */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = mobileWeekStart.add(i, 'day');
              const dateKey = day.format('YYYY-MM-DD');
              const dayMilestones = milestonesByDate[dateKey] || [];
              const isSelected = day.isSame(mobileSelectedDate, 'day');
              const mobileDayOfWeek = day.day();
              const isMobileWeekend = mobileDayOfWeek === 0 || mobileDayOfWeek === 6;
              return (
                <button
                  key={`mobile-day-${dateKey}`}
                  onClick={() => setMobileSelectedDate(day)}
                  className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-xs transition ${
                    isSelected ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : isMobileWeekend ? 'border-purple-200 bg-purple-50/50 text-purple-700 hover:border-purple-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="font-semibold">{day.format('dd').charAt(0)}</span>
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-slate-700 font-semibold">
                    {day.date()}
                  </span>
                  {dayMilestones.length > 0 && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      {dayMilestones.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Milestones */}
          {(() => {
            const selectedKey = dayjs(mobileSelectedDate).format('YYYY-MM-DD');
            const dayMilestones = milestonesByDate[selectedKey] || [];
            if (dayMilestones.length === 0) {
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-xs text-slate-500">No milestones</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {dayMilestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:shadow-md"
                    style={{
                      backgroundColor: ms.teamColor + '20',
                      borderLeft: `3px solid ${ms.teamColor}`,
                    }}
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <p className="truncate font-semibold text-slate-900">{ms.name}</p>
                      <p className="truncate text-slate-500 text-[10px]">
                        {ms.taskName} {'\u00B7'} {ms.teamName} {'\u00B7'} {ms.duration}d
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{ms.duration}d</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Desktop Calendar Grid */}
        <div className="hidden sm:block w-full overflow-x-auto snap-x snap-mandatory">
          <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm min-w-[720px] sm:min-w-[900px]">
            {/* Day Headers */}
            <div className="mb-3 sticky top-0 z-10 bg-white/90 backdrop-blur-sm grid grid-cols-7 gap-1 sm:gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div
                  key={day}
                  className={`py-2 text-center text-[11px] sm:text-xs font-bold tracking-wide uppercase ${
                    day === 'Sat' || day === 'Sun' ? 'text-purple-600' : 'text-slate-600'
                  }`}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Empty cells before month starts (Monday = first day) */}
              {Array.from({ length: (currentMonth.startOf('month').day() - 1 + 7) % 7 }).map((_, i) => (
                <div key={`empty-start-${i}`} className="min-h-24 sm:min-h-32 rounded-lg bg-slate-50/30" />
              ))}

              {/* Days */}
              {daysInMonth.map((day) => {
                const dateKey = day.format('YYYY-MM-DD');
                const dayMilestones = milestonesByDate[dateKey] || [];
                const isToday = day.isSame(today, 'day');
                const isCurrentMonth = day.isSame(currentMonth, 'month');
                const isExpanded = expandedDate === dateKey;
                const dayOfWeek = day.day();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={dateKey}
                    className={`relative min-h-24 sm:min-h-32 rounded-lg border transition snap-start ${
                      isToday
                        ? 'border-blue-400 bg-blue-50'
                        : isWeekend
                          ? dayMilestones.length > 0
                            ? 'border-purple-200 bg-purple-50/60'
                            : 'border-purple-100 bg-purple-50/30'
                          : dayMilestones.length > 0
                            ? 'border-slate-300 bg-white'
                            : 'border-slate-200 bg-slate-50/40'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-between px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-xs font-semibold ${
                            isToday ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {day.date()}
                        </span>
                        {dayMilestones.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {dayMilestones.length}
                          </span>
                        )}
                      </div>
                      {dayMilestones.length > 0 && (
                        <button
                          onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                          className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 transition text-blue-600 hover:text-blue-700 shadow-sm"
                          title="View milestones"
                        >
                          <Info size={16} />
                        </button>
                      )}
                    </div>

                    {/* Milestones Preview */}
                    {dayMilestones.length > 0 && (
                      <div
                        className="cursor-pointer px-2.5 pb-2 overflow-y-auto max-h-24 sm:max-h-28"
                        onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                      >
                        <div className="space-y-1">
                          {dayMilestones.map((ms) => (
                            <div
                              key={ms.id}
                              className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:shadow-md"
                              style={{
                                backgroundColor: ms.teamColor + '20',
                                borderLeft: `3px solid ${ms.teamColor}`,
                              }}
                            >
                              <div className="min-w-0 flex-1 truncate">
                                <p className="truncate font-semibold text-slate-900">{ms.name}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 flex-shrink-0">{ms.duration}d</span>
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
                length: (7 - ((daysInMonth.length + (currentMonth.startOf('month').day() - 1 + 7) % 7) % 7)) % 7,
              }).map((_, i) => (
                <div key={`empty-end-${i}`} className="min-h-24 sm:min-h-32 rounded-lg bg-slate-50/30" />
              ))}
            </div>
          </section>
        </div>

        {/* Expanded Date Modal */}
        {expandedDate && milestonesByDate[expandedDate] && (
          <>
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setExpandedDate(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <section className="rounded-2xl border border-blue-200 bg-white shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white rounded-t-2xl mb-4 flex items-center justify-between p-6 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {dayjs(expandedDate).format('dddd, MMMM D, YYYY')}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      {milestonesByDate[expandedDate].length} milestone
                      {milestonesByDate[expandedDate].length !== 1 ? 's' : ''}
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
                              <div
                                className="h-3 w-3 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: ms.teamColor }}
                              />
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                {ms.name}
                              </h3>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              Task: {ms.taskName}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {ms.teamName}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {ms.duration} day{ms.duration !== 1 ? 's' : ''}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {ms.startDay.format('MMM D')} {'\u2192'} {ms.endDay.format('MMM D')}
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

        {/* Empty State */}
        {filteredMilestones.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-12 text-center shadow-sm backdrop-blur-sm">
            <CalendarIcon size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900">No milestones scheduled</h3>
            <p className="mt-1 text-sm text-slate-600">
              {selectedTeamIds.length > 0
                ? 'Try adjusting your team filter'
                : 'Create milestones in the Dependencies view to populate this calendar'}
            </p>
          </section>
        )}

        {/* Floating Filter Button & Panel */}
        {uniqueTeams.length > 0 && (
          <div className="fixed left-6 bottom-6 z-40 flex flex-col items-start gap-3">
            {showFilters && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg backdrop-blur-sm w-80 max-h-96 overflow-y-auto">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-600" />
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-600 uppercase">
                      Filter by Team
                    </h3>
                    {selectedTeamIds.length > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {selectedTeamIds.length}
                      </span>
                    )}
                  </div>
                  {selectedTeamIds.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      <X size={12} />
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {uniqueTeams.map((team) => {
                    const isSelected = selectedTeamIds.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        onClick={() => toggleTeamFilter(team.id)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color || '#64748b' }}
                        />
                        <span className="flex-1">{team.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 active:scale-95 relative"
              title="Toggle filters"
            >
              <Filter size={20} />
              {selectedTeamIds.length > 0 && (
                <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                  {selectedTeamIds.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}