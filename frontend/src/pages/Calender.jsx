import { useParams, useNavigate } from 'react-router-dom';
import {
  fetch_all_attempts,
  fetch_project_detail,
  project_teams_expanded,
} from '../api/org_API.js';
import { useAuth } from '../auth/AuthContext';
import { useDemoDate } from '../auth/DemoDateContext';
import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Loader2,
  Filter,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

export default function CalendarPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { demoDate } = useDemoDate();

  // Data
  const [projectData, setProjectData] = useState(null);
  const [attemptsData, setAttemptsData] = useState([]);
  const [teamsData, setTeamsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & View
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'my-tasks', 'my-teams'
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [hideEmptyDays, setHideEmptyDays] = useState(false);

  // UI
  const [hoveredAttemptId, setHoveredAttemptId] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [project, attempts, teams] = await Promise.all([
        fetch_project_detail(projectId),
        fetch_all_attempts(projectId),
        project_teams_expanded(projectId),
      ]);
      console.log('Teams data from API:', teams);
      console.log('Sample team members:', teams?.[0]);
      console.log('Attempts data from API:', attempts);
      console.log('Sample attempt task:', attempts?.[0]?.task);
      console.log('Current user:', user);
      setProjectData(project);
      setAttemptsData(attempts || []);
      setTeamsData(teams || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Determine calendar range
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

  // Filter attempts based on view mode and team selection
  const filteredAttempts = useMemo(() => {
    let filtered = attemptsData.filter((attempt) => {
      if (!attempt.slot_index || attempt.slot_index <= 0) return false;
      if (!projectData?.start_date) return false;

      const attemptDate = dayjs(projectData.start_date).add(attempt.slot_index - 1, 'day');
      return attemptDate.isBetween(calendarRange.start, calendarRange.end, null, '[]');
    });

    // Apply team filter
    if (selectedTeamIds.length > 0) {
      filtered = filtered.filter((attempt) =>
        selectedTeamIds.includes(attempt.task?.team?.id),
      );
    }

    // Apply view mode filter
    if (viewMode === 'my-tasks' && user) {
      filtered = filtered.filter((attempt) => {
        const assignedMembers = attempt.task?.assigned_members_data || [];
        return assignedMembers.some((m) => m.id === user.id);
      });
    } else if (viewMode === 'my-teams' && user) {
      filtered = filtered.filter((attempt) => {
        const teamId = attempt.task?.team?.id;
        if (!teamId) return false;
        const team = teamsData.find((t) => t.id === teamId);
        const teamMembers = team?.members_data || [];
        return teamMembers.some((m) => m.id === user.id);
      });
    }

    return filtered;
  }, [attemptsData, selectedTeamIds, viewMode, user, projectData, calendarRange]);

  // Group attempts by date
  const attemptsByDate = useMemo(() => {
    const grouped = {};
    filteredAttempts.forEach((attempt) => {
      if (attempt.slot_index && projectData?.start_date) {
        const attemptDate = dayjs(projectData.start_date)
          .add(attempt.slot_index - 1, 'day')
          .format('YYYY-MM-DD');
        if (!grouped[attemptDate]) {
          grouped[attemptDate] = [];
        }
        grouped[attemptDate].push(attempt);
      }
    });
    return grouped;
  }, [filteredAttempts, projectData]);

  // Get all dates in current month
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

  // Check if user is member of team
  const isTeamMember = (teamId) => {
    if (!user) return false;
    const team = teamsData.find((t) => t.id === teamId);
    const teamMembers = team?.members_data || [];
    return teamMembers.some((m) => m.id === user.id);
  };

  // Toggle team filter
  const toggleTeamFilter = (teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedTeamIds([]);
    setViewMode('all');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  const today = demoDate;
  const uniqueTeams = Array.from(
    new Map(teamsData.map((team) => [team.id, team])).values(),
  ).sort((a, b) => (a.line_index ?? 0) - (b.line_index ?? 0));

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-7xl flex-col gap-2 py-4">
        {/* Integrated Header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
              <Calendar size={18} />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Project Calendar</h1>
          </div>

          {/* Month in center */}
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

          {/* View Mode Toggle */}
          <div className="flex gap-1.5">
            {isAuthenticated && (
              <>
                <button
                  onClick={() => setViewMode('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    viewMode === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewMode('my-tasks')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    viewMode === 'my-tasks'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  My Tasks
                </button>
                <button
                  onClick={() => setViewMode('my-teams')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    viewMode === 'my-teams'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  My Teams
                </button>
              </>
            )}
          </div>
        </header>

        {/* Calendar Grid */}
        <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
          {/* Day Headers */}
          <div className="mb-3 grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-bold tracking-wide text-slate-600 uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for days before month starts */}
            {/* dayjs returns 0 for Sunday, but we want Monday as first day, so we adjust with (day - 1 + 7) % 7 */}
            {Array.from({ length: (currentMonth.startOf('month').day() - 1 + 7) % 7 }).map((_, i) => (
              <div key={`empty-start-${i}`} className="min-h-32 rounded-lg bg-slate-50/30" />
            ))}

            {/* Days of month */}
            {daysInMonth.map((day) => {
              const dateKey = day.format('YYYY-MM-DD');
              const dayAttempts = attemptsByDate[dateKey] || [];
              const isToday = day.isSame(today, 'day');
              const isCurrentMonth = day.isSame(currentMonth, 'month');
              const isExpanded = expandedDate === dateKey;

              return (
                <div
                  key={dateKey}
                  className={`relative min-h-32 rounded-lg border transition ${
                    isToday
                      ? 'border-blue-400 bg-blue-50'
                      : dayAttempts.length > 0
                        ? 'border-slate-300 bg-white'
                        : 'border-slate-200 bg-slate-50/40'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {day.date()}
                      </span>
                      {dayAttempts.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {dayAttempts.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attempts Preview */}
                  {dayAttempts.length > 0 && (
                    <div
                      className="cursor-pointer px-2.5 pb-2"
                      onClick={() =>
                        setExpandedDate(isExpanded ? null : dateKey)
                      }
                    >
                      <div className="space-y-1">
                        {dayAttempts.slice(0, 2).map((attempt) => (
                          <div
                            key={attempt.id}
                            className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:shadow-md"
                            style={{
                              backgroundColor: attempt.task?.team?.color + '20',
                              borderLeft: `3px solid ${attempt.task?.team?.color || '#64748b'}`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${projectId}/attempts/${attempt.id}`);
                            }}
                          >
                            <div className="min-w-0 flex-1 truncate">
                              <p className="truncate font-semibold text-slate-900">
                                {attempt.task?.name}
                              </p>
                              <p className="truncate text-slate-600">
                                {attempt.name || 'Untitled'}
                              </p>
                            </div>
                            {attempt.done && (
                              <CheckCircle2
                                size={13}
                                className="flex-shrink-0 text-emerald-600"
                              />
                            )}
                          </div>
                        ))}
                        {dayAttempts.length > 2 && (
                          <button
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100"
                            onClick={() =>
                              setExpandedDate(isExpanded ? null : dateKey)
                            }
                          >
                            +{dayAttempts.length - 2} more
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {dayAttempts.length === 0 && hideEmptyDays && (
                    <div className="flex h-20 items-center justify-center px-2">
                      <p className="text-xs text-slate-400 italic">No events</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty cells for days after month ends */}
            {Array.from({
              length: 7 - (((daysInMonth.length + (currentMonth.startOf('month').day() - 1 + 7) % 7)) % 7),
            }).map((_, i) => (
              <div key={`empty-end-${i}`} className="min-h-32 rounded-lg bg-slate-50/30" />
            ))}
          </div>
        </section>

        {/* Expanded Date View Modal */}
        {expandedDate && attemptsByDate[expandedDate] && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-md backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {dayjs(expandedDate).format('dddd, MMMM D, YYYY')}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  {attemptsByDate[expandedDate].length} event
                  {attemptsByDate[expandedDate].length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setExpandedDate(null)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {attemptsByDate[expandedDate].map((attempt) => {
                const teamId = attempt.task?.team?.id;
                const isMemberOfTeam = teamId ? isTeamMember(teamId) : false;
                const assignedMembers = attempt.task?.assigned_members_data || [];
                const isAssigned = user ? assignedMembers.some((m) => m.id === user.id) : false;

                return (
                  <div
                    key={attempt.id}
                    onClick={() => navigate(`/projects/${projectId}/attempts/${attempt.id}`)}
                    className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:shadow-md"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 flex-shrink-0 rounded-full"
                            style={{
                              backgroundColor: attempt.task?.team?.color || '#64748b',
                            }}
                          />
                          <h3 className="truncate text-sm font-semibold text-slate-900">
                            {attempt.task?.name}
                          </h3>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {attempt.name || 'Untitled attempt'} • Step {attempt.slot_index}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {attempt.done ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={12} />
                            Done
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            <AlertCircle size={12} />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {isAssigned && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          Assigned to you
                        </span>
                      )}
                      {isMemberOfTeam && isAuthenticated && (
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                          Your team
                        </span>
                      )}
                      {attempt.task?.priority && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          P{attempt.task.priority}
                        </span>
                      )}
                      {attempt.task?.difficulty && (
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                          D{attempt.task.difficulty}
                        </span>
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: attempt.task?.team?.color || '#64748b',
                        }}
                      />
                      <span className="text-xs font-medium text-slate-700">
                        {attempt.task?.team?.name || 'No team'}
                      </span>
                      {attempt.task?.team?.members_data?.length > 0 && (
                        <span className="ml-auto text-xs text-slate-500">
                          {attempt.task.team.members_data.length} member
                          {attempt.task.team.members_data.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {filteredAttempts.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white/70 p-12 text-center shadow-sm backdrop-blur-sm">
            <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900">No events scheduled</h3>
            <p className="mt-1 text-sm text-slate-600">
              {selectedTeamIds.length > 0
                ? 'Try adjusting your team filter'
                : viewMode === 'my-tasks'
                  ? 'You are not assigned to any tasks yet'
                  : viewMode === 'my-teams'
                    ? 'You are not a member of any teams yet'
                    : 'Create tasks and schedule attempts to populate this calendar'}
            </p>
          </section>
        )}

        {/* Floating Filter Button & Panel */}
        {uniqueTeams.length > 0 && (
          <div className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-3">
            {/* Collapsible Filter Panel */}
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
                  {(selectedTeamIds.length > 0 || viewMode !== 'all') && (
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
                    const isMember = isTeamMember(team.id);

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
                        {isMember && isAuthenticated && (
                          <Users size={12} className="text-blue-600 flex-shrink-0" title="You are a member" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Button */}
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