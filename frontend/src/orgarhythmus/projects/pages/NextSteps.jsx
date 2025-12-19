import { useParams } from 'react-router-dom';
import {
  fetch_all_attempts,
  project_teams_expanded,
  fetch_project_detail,
} from '../../api/org_API';
import { useEffect, useState } from 'react';
import { Filter, X, Calendar, Loader2 } from 'lucide-react';

export default function NextSteps() {
  const { projectId } = useParams();
  const [projectData, setProjectData] = useState(null);
  const [attemptsData, setAttemptsData] = useState([]);
  const [teamsData, setTeamsData] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [loading, setLoading] = useState(true);

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

        // load teams
        const teams = await project_teams_expanded(projectId);
        setTeamsData(teams);
        console.log('Project Teams Expanded:', teams);

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
  }, []);

  // Get unique teams from attempts
  const getUniqueTeams = () => {
    const teamSet = new Map();
    attemptsData.forEach((attempt) => {
      if (attempt.task?.team && !teamSet.has(attempt.task.team.id)) {
        teamSet.set(attempt.task.team.id, attempt.task.team);
      }
    });
    return Array.from(teamSet.values());
  };

  // Toggle team filter
  const toggleTeamFilter = (teamId) => {
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedTeamIds([]);
  };

  // Filter attempts based on selected teams
  const filteredAttempts =
    selectedTeamIds.length > 0
      ? attemptsData.filter((attempt) => selectedTeamIds.includes(attempt.task?.team?.id))
      : attemptsData;

  // Sort attempts by slot_index
  const sortedAndFilteredAttempts = [...filteredAttempts].sort(
    (a, b) => (a.slot_index || 0) - (b.slot_index || 0),
  );

  const uniqueTeams = getUniqueTeams();

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-6 py-8">
        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow">
            <Calendar size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Next Steps</h1>
            <p className="mt-1 text-xs text-slate-600">
              Upcoming tasks and events scheduled for this project
            </p>
          </div>
        </header>
        {/* Team Filter Buttons */}
        {uniqueTeams.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-600" />
                <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-600 uppercase">
                  Filter by Team
                </h3>
                {selectedTeamIds.length > 0 && (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {selectedTeamIds.length}
                  </span>
                )}
              </div>
              {selectedTeamIds.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueTeams.map((team) => {
                const isSelected = selectedTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeamFilter(team.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate">{team.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-6 py-12 backdrop-blur-sm">
            <Loader2 size={32} className="animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">Loading events…</span>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                Upcoming Events
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {sortedAndFilteredAttempts.length} event
                {sortedAndFilteredAttempts.length !== 1 ? 's' : ''} scheduled
              </p>
            </div>

            {sortedAndFilteredAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Calendar size={32} className="text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">
                    {selectedTeamIds.length > 0
                      ? 'No events for selected teams'
                      : 'No events scheduled yet'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedTeamIds.length > 0
                      ? 'Try adjusting your filter'
                      : 'Create tasks and attempts to populate this timeline'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAndFilteredAttempts.map((attempt) => {
                  const taskTeam = attempt.task?.team;
                  const dateStr = getDateFromSlotIndex(attempt.slot_index, projectData?.start_date);

                  return (
                    <div
                      key={attempt.id}
                      className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white/70 p-4 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                        {taskTeam && (
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: taskTeam.color }}
                          >
                            {taskTeam.name?.[0]?.toUpperCase() || 'T'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                            {attempt.task.name} ({attempt.name})
                          </h3>
                          {/* {attempt.name && (
                            <p className="mt-1 truncate text-xs text-slate-500">
                              Attempt: <span className="font-medium">{attempt.name}</span>
                            </p>
                          )}
                          {taskTeam && (
                            <p className="mt-1 text-xs text-slate-600">
                              Team:{' '}
                              <span className="font-medium text-slate-900">{taskTeam.name}</span>
                            </p>
                          )} */}
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="text-sm font-medium whitespace-nowrap text-slate-900">
                          {dateStr || 'No date'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
