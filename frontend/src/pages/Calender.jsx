import { useParams } from 'react-router-dom';
import {
  fetch_all_attempts,
  fetch_project_detail,
} from '../api/org_API.js';
import { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
//
export default function NextSteps() {
  const { projectId } = useParams();
  const [projectData, setProjectData] = useState(null);
  const [attemptsData, setAttemptsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [calendarDays, setCalendarDays] = useState(14);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const [hoveredAttemptId, setHoveredAttemptId] = useState(null);

  const getDateFromSlotIndex = (slotIndex, startDate) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const daysToAdd = slotIndex - 1; // slot_index 1 = start_date
    const resultDate = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return resultDate.toLocaleDateString('de-AT', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        // load project detail
        const projectDetail = await fetch_project_detail(projectId);
        setProjectData(projectDetail);
        console.log('Project Detail:', projectDetail);

        // load attempts
        const attempts = await fetch_all_attempts(projectId);
        setAttemptsData(attempts);
        console.log('All Attempts:', attempts);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-7xl flex-col gap-6 py-8">        {/* Calendar View Toggle & Timeline */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Calendar size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Project Timeline</h2>
                <p className="text-xs text-slate-500">Scheduled attempts overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={calendarDays}
                onChange={(e) => {
                  const val = e.target.value;
                  setCalendarDays(val === 'ALL' ? 'ALL' : parseInt(val));
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={'ALL'}>All</option>
              </select>
              <label className="ml-1 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={hideEmptyDays}
                  onChange={(e) => setHideEmptyDays(e.target.checked)}
                  className="h-3 w-3 accent-blue-600"
                />
                Hide empty
              </label>
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  showCalendar
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {showCalendar ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showCalendar && projectData?.start_date && (
            <div className="space-y-3">
              {/* Day labels */}
              <div className="hidden grid-cols-7 gap-2 lg:grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-xs font-bold tracking-wide text-slate-600 uppercase"
                  >
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid - 7 columns on lg screens, 2-3 on smaller */}
              <div className="relative grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {(() => {
                  const startDate = new Date(projectData.start_date);
                  const endDate = projectData.end_date
                    ? new Date(projectData.end_date)
                    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const msPerDay = 24 * 60 * 60 * 1000;

                  // Get all attempts for this project
                  const projectAttempts = (attemptsData || []).filter(
                    (a) =>
                      a.task?.team?.project?.id === projectData.id ||
                      (a.slot_index && a.task?.team),
                  );

                  // Group by date (use local date keys to avoid TZ drift)
                  const attemptsByDate = {};
                  const fmt = (d) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const da = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${da}`;
                  };
                  projectAttempts.forEach((attempt) => {
                    if (attempt.slot_index && projectData.start_date) {
                      const d = new Date(startDate.getTime() + (attempt.slot_index - 1) * msPerDay);
                      d.setHours(0, 0, 0, 0);
                      const dateKey = fmt(d);
                      if (!attemptsByDate[dateKey]) {
                        attemptsByDate[dateKey] = [];
                      }
                      attemptsByDate[dateKey].push(attempt);
                    }
                  });

                  // Get next N days
                  const dates = [];
                  let current = new Date(today);
                  let limit = null;
                  if (calendarDays === 'ALL') {
                    if (projectData.end_date) {
                      limit = new Date(projectData.end_date);
                      limit.setHours(0, 0, 0, 0);
                    } else {
                      const keys = Object.keys(attemptsByDate);
                      if (keys.length > 0) {
                        const maxKey = keys.sort()[keys.length - 1];
                        const [y, m, d] = maxKey.split('-').map((x) => parseInt(x, 10));
                        limit = new Date(y, m - 1, d);
                      } else {
                        limit = new Date(today.getTime() + 60 * msPerDay);
                      }
                    }
                    while (current <= limit) {
                      dates.push(new Date(current));
                      current.setDate(current.getDate() + 1);
                    }
                  } else {
                    for (let i = 0; i < calendarDays; i++) {
                      dates.push(new Date(current));
                      current.setDate(current.getDate() + 1);
                    }
                  }

                  const visibleDates = hideEmptyDays
                    ? dates.filter((d) => (attemptsByDate[fmt(d)] || []).length > 0)
                    : dates;

                  return visibleDates.map((date) => {
                    const dateKey = fmt(date);
                    const dayAttempts = attemptsByDate[dateKey] || [];
                    const isToday = dateKey === fmt(today);
                    const hoveredAttempt = dayAttempts.find((a) => a.id === hoveredAttemptId);

                    return (
                      <div
                        key={dateKey}
                        className={`group relative flex h-40 flex-col rounded-lg border p-3 transition ${
                          dayAttempts.length > 0
                            ? 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                        onMouseLeave={() => setHoveredAttemptId(null)}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <span
                            className={`flex-shrink-0 rounded px-2 py-1 text-xs font-bold whitespace-nowrap ${
                              isToday ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {dayAttempts.length > 0 && (
                            <span className="flex-shrink-0 text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
                              {dayAttempts.length}
                            </span>
                          )}
                        </div>

                        {/* Scrollable attempts area */}
                        {dayAttempts.length > 0 ? (
                          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-xs">
                            {dayAttempts.map((attempt) => (
                              <div key={attempt.id} className="group/item relative">
                                <div
                                  className="cursor-pointer truncate rounded px-1.5 py-0.5 text-white shadow-sm transition"
                                  style={{
                                    backgroundColor: attempt.task?.team?.color || '#64748b',
                                  }}
                                  title={`${attempt.task?.name} - Attempt: ${attempt.name}`}
                                >
                                  <span className="block truncate font-medium text-black">
                                    {attempt.task?.name}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center text-xs text-slate-400 italic">
                            No attempts
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </section>      </div>
    </div>
  );
}