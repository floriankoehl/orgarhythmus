import { useParams, useNavigate } from 'react-router-dom';
import {
  fetch_all_attempts,
  fetch_project_detail,
  project_teams_expanded,
  toggleAttemptTodo,
  createAttemptTodo,
  assignTaskMember,
  unassignTaskMember,
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
  Info,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  Plus,
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
  const [showCompleted, setShowCompleted] = useState(false); // Toggle to show/hide completed attempts

  // UI
  const [hoveredAttemptId, setHoveredAttemptId] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [showMembersForAttempt, setShowMembersForAttempt] = useState(null);
  const [showTodosForAttempt, setShowTodosForAttempt] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [newTodoText, setNewTodoText] = useState({});
  const [confirmDoneAttemptId, setConfirmDoneAttemptId] = useState(null);
  const [mobileSelectedDate, setMobileSelectedDate] = useState(dayjs(demoDate));

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

  // Helpers for mobile weekly navigation (Monday-first week)
  function getMondayStart(date) {
    const d = dayjs(date);
    const weekday = d.day(); // 0=Sun, 1=Mon, ... 6=Sat
    return d.subtract((weekday + 6) % 7, 'day'); // shift to Monday
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

    // Filter by completion status - hide done attempts by default
    if (!showCompleted) {
      filtered = filtered.filter((attempt) => !attempt.done);
    }

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
  }, [attemptsData, selectedTeamIds, viewMode, user, projectData, calendarRange, showCompleted]);

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
    setShowCompleted(false);
  };

  // Handle adding a member to an attempt
  const handleAddMember = async (attemptId, memberId) => {
    try {
      // Find the attempt to get the task ID
      const attempt = attemptsData.find(a => a.id === attemptId);
      if (!attempt || !attempt.task) {
        console.error('Attempt or task not found');
        return;
      }

      console.log('Adding member:', { attemptId, memberId, taskId: attempt.task.id });

      // Use the same API as ProjectTaskDetail
      const result = await assignTaskMember(projectId, attempt.task.id, memberId);
      
      console.log('Member added successfully:', result);
      
      // Update all attempts that share this task
      setAttemptsData(prev =>
        prev.map(a =>
          a.task?.id === attempt.task.id
            ? {
                ...a,
                task: result.task,
              }
            : a
        )
      );
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  // Handle removing a member from an attempt
  const handleRemoveMember = async (attemptId, memberId) => {
    try {
      // Find the attempt to get the task ID
      const attempt = attemptsData.find(a => a.id === attemptId);
      if (!attempt || !attempt.task) {
        console.error('Attempt or task not found');
        return;
      }

      console.log('Removing member:', { attemptId, memberId, taskId: attempt.task.id });

      // Use the same API as ProjectTaskDetail
      const result = await unassignTaskMember(projectId, attempt.task.id, memberId);
      
      console.log('Member removed successfully:', result);
      
      // Update all attempts that share this task
      setAttemptsData(prev =>
        prev.map(a =>
          a.task?.id === attempt.task.id
            ? {
                ...a,
                task: result.task,
              }
            : a
        )
      );
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  // Handle toggling a todo and auto-complete attempt if all todos are done
  const handleToggleTodo = async (attemptId, todoId) => {
    try {
      // Toggle the todo
      await toggleAttemptTodo(projectId, attemptId, todoId);

      // Update local state
      setAttemptsData(prev =>
        prev.map(a => {
          if (a.id === attemptId) {
            const updatedTodos = a.todos.map(todo =>
              todo.id === todoId ? { ...todo, done: !todo.done } : todo
            );
            
            // Check if all todos are now done
            const allTodosDone = updatedTodos.length > 0 && updatedTodos.every(t => t.done);
            // Check if any todo is not done
            const anyTodoNotDone = updatedTodos.some(t => !t.done);
            
            // Determine the new done status
            let newDoneStatus = a.done;
            if (allTodosDone && !a.done) {
              newDoneStatus = true;
              handleCompleteAttempt(attemptId);
            } else if (anyTodoNotDone && a.done) {
              newDoneStatus = false;
              handleMarkInProgress(attemptId);
            }
            
            return {
              ...a,
              todos: updatedTodos,
              done: newDoneStatus,
            };
          }
          return a;
        })
      );
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  // Handle marking attempt as done
  const handleCompleteAttempt = async (attemptId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/projects/${projectId}/attempts/${attemptId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            done: true,
          }),
        }
      );

      if (response.ok) {
        setAttemptsData(prev =>
          prev.map(a =>
            a.id === attemptId ? { ...a, done: true } : a
          )
        );
      }
    } catch (error) {
      console.error('Error completing attempt:', error);
    }
  };

  // Handle marking attempt as in progress
  const handleMarkInProgress = async (attemptId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/projects/${projectId}/attempts/${attemptId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            done: false,
          }),
        }
      );

      if (response.ok) {
        setAttemptsData(prev =>
          prev.map(a =>
            a.id === attemptId ? { ...a, done: false } : a
          )
        );
      }
    } catch (error) {
      console.error('Error marking attempt as in progress:', error);
    }
  };

  // Handle adding a new todo
  const handleAddTodo = async (attemptId) => {
    const text = newTodoText[attemptId]?.trim();
    if (!text) return;

    try {
      const newTodo = await createAttemptTodo(projectId, attemptId, text);
      
      // Update local state
      setAttemptsData(prev =>
        prev.map(a =>
          a.id === attemptId
            ? { ...a, todos: [...(a.todos || []), newTodo] }
            : a
        )
      );
      
      // Clear input
      setNewTodoText(prev => ({ ...prev, [attemptId]: '' }));
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  // Handle marking attempt as done with all todos
  const handleMarkAsDoneWithTodos = async (attemptId) => {
    try {
      const attempt = attemptsData.find(a => a.id === attemptId);
      if (!attempt) return;

      const todos = attempt.todos || [];
      const undoneTodos = todos.filter(t => !t.done);

      // Mark all undone todos as done
      await Promise.all(
        undoneTodos.map(todo => toggleAttemptTodo(projectId, attemptId, todo.id))
      );

      // Mark attempt as done
      await handleCompleteAttempt(attemptId);

      // Update local state
      setAttemptsData(prev =>
        prev.map(a =>
          a.id === attemptId
            ? {
                ...a,
                done: true,
                todos: a.todos.map(t => ({ ...t, done: true })),
              }
            : a
        )
      );

      // Close confirmation modal
      setConfirmDoneAttemptId(null);
    } catch (error) {
      console.error('Error marking attempt as done:', error);
    }
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

        {/* Mobile Weekly/Day View */}
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
              {mobileWeekStart.format('MMM D')} – {mobileWeekStart.add(6, 'day').format('MMM D')}
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
              const dayAttempts = attemptsByDate[dateKey] || [];
              const isSelected = day.isSame(mobileSelectedDate, 'day');
              return (
                <button
                  key={`mobile-day-${dateKey}`}
                  onClick={() => setMobileSelectedDate(day)}
                  className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-xs transition ${
                    isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="font-semibold">{day.format('dd').charAt(0)}</span>
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-slate-700 font-semibold">
                    {day.date()}
                  </span>
                  {dayAttempts.length > 0 && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      {dayAttempts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Attempts */}
          {(() => {
            const selectedKey = dayjs(mobileSelectedDate).format('YYYY-MM-DD');
            const dayAttempts = attemptsByDate[selectedKey] || [];
            if (dayAttempts.length === 0) {
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-xs text-slate-500">No events</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {dayAttempts.map((attempt) => {
                  const teamId = attempt.task?.team?.id;
                  const isMemberOfTeam = teamId ? isTeamMember(teamId) : false;
                  const assignedMembers = attempt.task?.assigned_members_data || [];
                  const isAssigned = user ? assignedMembers.some((m) => m.id === user.id) : false;
                  const showMembers = showMembersForAttempt === attempt.id;
                  const showTodos = showTodosForAttempt === attempt.id;
                  return (
                    <div key={attempt.id} className="rounded-lg border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm">
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: attempt.task?.team?.color || '#64748b' }} />
                              <h3 className="truncate text-sm font-semibold text-slate-900">{attempt.task?.name}</h3>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">{attempt.name || 'Untitled attempt'}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {attempt.done ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkInProgress(attempt.id); }}
                                className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition"
                              >
                                <CheckCircle2 size={12} /> Done
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDoneAttemptId(attempt.id); }}
                                className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition"
                              >
                                <AlertCircle size={12} /> Pending
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedMembers.length > 0 && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {isAssigned && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Assigned to you</span>
                          )}
                          {isMemberOfTeam && isAuthenticated && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Your team</span>
                          )}
                        </div>
                      </div>
                      <div className="flex border-t border-slate-200 text-xs">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMembersForAttempt(showMembers ? null : attempt.id); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition border-r border-slate-200"
                        >
                          {showMembers ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {showMembers ? 'Hide' : 'Show'} Members
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowTodosForAttempt(showTodos ? null : attempt.id); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition border-r border-slate-200"
                        >
                          {showTodos ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {showTodos ? 'Hide' : 'Show'} Todos
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${projectId}/attempts/${attempt.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 transition"
                        >
                          Full Page →
                        </button>
                      </div>
                      {showMembers && (
                        <div className="border-t border-slate-200 p-3 bg-slate-50/50">
                          <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                            <div className="text-xs font-semibold text-slate-700 mb-2">Assigned Members</div>
                            {assignedMembers.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mb-2.5">
                                {assignedMembers.map((member) => (
                                  <span key={member.id} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 flex items-center gap-1 cursor-pointer hover:bg-blue-200 transition" onClick={(e) => { e.stopPropagation(); handleRemoveMember(attempt.id, member.id); }}>
                                    {member.username}
                                    <span className="text-blue-500">×</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mb-2.5">No members assigned yet</p>
                            )}
                            <select
                              onChange={(e) => { e.stopPropagation(); handleAddMember(attempt.id, parseInt(e.target.value)); }}
                              onClick={(e) => e.stopPropagation()}
                              value=""
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 transition cursor-pointer"
                            >
                              <option value="">+ Add member from project</option>
                              {projectData?.members_data?.map((member) => {
                                const isAlreadyAssigned = assignedMembers.some(m => m.id === member.id);
                                return (
                                  <option key={member.id} value={member.id} disabled={isAlreadyAssigned}>
                                    {member.username} {isAlreadyAssigned ? '(assigned)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      )}
                      {showTodos && (
                        <div className="border-t border-slate-200 p-3 bg-slate-50/50">
                          <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                            <div className="text-xs font-semibold text-slate-700 mb-2">Todos ({attempt.todos?.filter(t => t.done).length || 0}/{attempt.todos?.length || 0})</div>
                            {attempt.todos && attempt.todos.length > 0 && (
                              <div className="space-y-1.5 mb-2.5">
                                {attempt.todos.map((todo) => (
                                  <div key={todo.id} onClick={(e) => { e.stopPropagation(); handleToggleTodo(attempt.id, todo.id); }} className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition group">
                                    {todo.done ? (
                                      <CheckSquare size={15} className="flex-shrink-0 text-emerald-600 mt-0.5" />
                                    ) : (
                                      <Square size={15} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 mt-0.5" />
                                    )}
                                    <span className={`text-xs flex-1 ${todo.done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{todo.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={newTodoText[attempt.id] || ''}
                                onChange={(e) => { e.stopPropagation(); setNewTodoText(prev => ({ ...prev, [attempt.id]: e.target.value })); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleAddTodo(attempt.id); } }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Add a new todo..."
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <button onClick={(e) => { e.stopPropagation(); handleAddTodo(attempt.id); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50 transition">
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Calendar Grid */}
        <div className="hidden sm:block w-full overflow-x-auto snap-x snap-mandatory">
          <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm min-w-[720px] sm:min-w-[900px]">
          {/* Day Headers */}
          <div className="mb-3 sticky top-0 z-10 bg-white/90 backdrop-blur-sm grid grid-cols-7 gap-1 sm:gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] sm:text-xs font-bold tracking-wide text-slate-600 uppercase"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty cells for days before month starts */}
            {/* dayjs returns 0 for Sunday, but we want Monday as first day, so we adjust with (day - 1 + 7) % 7 */}
            {Array.from({ length: (currentMonth.startOf('month').day() - 1 + 7) % 7 }).map((_, i) => (
              <div key={`empty-start-${i}`} className="min-h-24 sm:min-h-32 rounded-lg bg-slate-50/30" />
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
                  className={`relative min-h-24 sm:min-h-32 rounded-lg border transition snap-start ${
                    isToday
                      ? 'border-blue-400 bg-blue-50'
                      : dayAttempts.length > 0
                        ? 'border-slate-300 bg-white'
                        : 'border-slate-200 bg-slate-50/40'
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  {/* Day Number & Info Button */}
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-xs font-semibold ${
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
                    {dayAttempts.length > 0 && (
                      <button
                        onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                        className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 transition text-blue-600 hover:text-blue-700 shadow-sm"
                        title="View all attempts"
                      >
                        <Info size={16} />
                      </button>
                    )}
                  </div>

                  {/* Attempts Preview */}
                  {dayAttempts.length > 0 && (
                    <div
                      className="cursor-pointer px-2.5 pb-2 overflow-y-auto max-h-24 sm:max-h-28"
                      onClick={() =>
                        setExpandedDate(isExpanded ? null : dateKey)
                      }
                    >
                      <div className="space-y-1">
                        {dayAttempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className={`group relative flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition hover:shadow-md ${
                              attempt.done ? 'opacity-50' : ''
                            }`}
                            style={{
                              backgroundColor: attempt.task?.team?.color + (attempt.done ? '10' : '20'),
                              borderLeft: `3px solid ${attempt.task?.team?.color || '#64748b'}`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${projectId}/attempts/${attempt.id}`);
                            }}
                          >
                            <div className="min-w-0 flex-1 truncate">
                              <p className={`truncate font-semibold ${
                                attempt.done ? 'text-slate-500 line-through' : 'text-slate-900'
                              }`}>
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
              <div key={`empty-end-${i}`} className="min-h-24 sm:min-h-32 rounded-lg bg-slate-50/30" />
            ))}
          </div>
          </section>
        </div>

        {/* Expanded Date View Modal */}
        {/* Expanded Date Modal */}
        {expandedDate && attemptsByDate[expandedDate] && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setExpandedDate(null)}
            />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <section className="rounded-2xl border border-blue-200 bg-white shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white rounded-t-2xl mb-4 flex items-center justify-between p-6 border-b border-slate-200">
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
                    className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 px-6 pb-6">
              {attemptsByDate[expandedDate].map((attempt) => {
                const teamId = attempt.task?.team?.id;
                const isMemberOfTeam = teamId ? isTeamMember(teamId) : false;
                const assignedMembers = attempt.task?.assigned_members_data || [];
                const isAssigned = user ? assignedMembers.some((m) => m.id === user.id) : false;

                const showMembers = showMembersForAttempt === attempt.id;
                const showTodos = showTodosForAttempt === attempt.id;

                return (
                  <div
                    key={attempt.id}
                    className="rounded-lg border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-sm"
                  >
                    {/* Header */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
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
                          <p className="mt-0.5 text-xs text-slate-600">
                            {attempt.name || 'Untitled attempt'}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {attempt.done ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkInProgress(attempt.id);
                              }}
                              className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              Done
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDoneAttemptId(attempt.id);
                              }}
                              className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition cursor-pointer"
                            >
                              <AlertCircle size={12} />
                              Pending
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick Info */}
                      <div className="flex flex-wrap gap-1.5">
                        {assignedMembers.length > 0 && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isAssigned && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Assigned to you
                          </span>
                        )}
                        {isMemberOfTeam && isAuthenticated && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            Your team
                          </span>
                        )}
                        {attempt.task?.priority && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            P{attempt.task.priority}
                          </span>
                        )}
                        {attempt.task?.difficulty && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            D{attempt.task.difficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex border-t border-slate-200 text-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMembersForAttempt(showMembers ? null : attempt.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition border-r border-slate-200"
                      >
                        {showMembers ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {showMembers ? 'Hide' : 'Show'} Members
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTodosForAttempt(showTodos ? null : attempt.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition border-r border-slate-200"
                      >
                        {showTodos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {showTodos ? 'Hide' : 'Show'} Todos
                      </button>
                      <button
                        onClick={() => navigate(`/projects/${projectId}/attempts/${attempt.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-blue-700 hover:bg-blue-50 transition"
                      >
                        Full Page →
                      </button>
                    </div>

                    {/* Members Section */}
                    {showMembers && (
                      <div className="border-t border-slate-200 p-3 bg-slate-50/50">
                        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Assigned Members</div>
                          {assignedMembers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mb-2.5">
                              {assignedMembers.map((member) => (
                                <span 
                                  key={member.id} 
                                  className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 flex items-center gap-1 cursor-pointer hover:bg-blue-200 transition"
                                  title={`Click to remove ${member.username}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMember(attempt.id, member.id);
                                  }}
                                >
                                  {member.username}
                                  <span className="text-blue-500">×</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 mb-2.5">No members assigned yet</p>
                          )}
                          
                          {/* Add Member Dropdown */}
                          <select
                            onChange={(e) => {
                              e.stopPropagation();
                              handleAddMember(attempt.id, parseInt(e.target.value));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            value=""
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 transition cursor-pointer"
                          >
                            <option value="">+ Add member from project</option>
                            {projectData?.members_data?.map((member) => {
                              const isAlreadyAssigned = assignedMembers.some(m => m.id === member.id);
                              return (
                                <option 
                                  key={member.id} 
                                  value={member.id}
                                  disabled={isAlreadyAssigned}
                                >
                                  {member.username} {isAlreadyAssigned ? '(assigned)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Todos Section */}
                    {showTodos && (
                      <div className="border-t border-slate-200 p-3 bg-slate-50/50">
                        <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                          <div className="text-xs font-semibold text-slate-700 mb-2">
                            Todos ({attempt.todos?.filter(t => t.done).length || 0}/{attempt.todos?.length || 0})
                          </div>
                          {attempt.todos && attempt.todos.length > 0 && (
                            <div className="space-y-1.5 mb-2.5">
                              {attempt.todos.map((todo) => (
                                <div
                                  key={todo.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTodo(attempt.id, todo.id);
                                  }}
                                  className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition group"
                                >
                                  {todo.done ? (
                                    <CheckSquare size={15} className="flex-shrink-0 text-emerald-600 mt-0.5" />
                                  ) : (
                                    <Square size={15} className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 mt-0.5" />
                                  )}
                                  <span className={`text-xs flex-1 ${
                                    todo.done ? 'text-slate-500 line-through' : 'text-slate-700'
                                  }`}>
                                    {todo.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add Todo Input */}
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newTodoText[attempt.id] || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                setNewTodoText(prev => ({ ...prev, [attempt.id]: e.target.value }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddTodo(attempt.id);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Add a new todo..."
                              className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddTodo(attempt.id);
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50 transition"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              </section>
            </div>
          </>
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
          <div className="fixed left-6 bottom-6 z-40 flex flex-col items-start gap-3">
            {/* Collapsible Filter Panel */}
            {showFilters && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg backdrop-blur-sm w-80 max-h-96 overflow-y-auto">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-600" />
                    <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-600 uppercase">
                      Filters
                    </h3>
                    {selectedTeamIds.length > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {selectedTeamIds.length}
                      </span>
                    )}
                  </div>
                  {(selectedTeamIds.length > 0 || viewMode !== 'all' || showCompleted) && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      <X size={12} />
                      Clear
                    </button>
                  )}
                </div>

                {/* Show Completed Toggle */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left ${
                      showCompleted
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 size={14} className="flex-shrink-0" />
                    <span className="flex-1">Show Completed Attempts</span>
                  </button>
                </div>

                {/* Team Filter */}
                <div className="mb-2">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">Filter by Team</h4>
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

        {/* Confirmation Modal for Marking as Done */}
        {confirmDoneAttemptId && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setConfirmDoneAttemptId(null)}
            />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-2xl max-w-md w-full p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <AlertCircle size={20} className="text-amber-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Mark as Done?
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    This will mark the attempt as complete and automatically check all todos as done.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDoneAttemptId(null)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleMarkAsDoneWithTodos(confirmDoneAttemptId)}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}