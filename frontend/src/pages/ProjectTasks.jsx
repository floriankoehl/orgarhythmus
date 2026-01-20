// orgarhythmus/projects/pages/ProjectTasks.jsx

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import { Plus, Filter, X } from 'lucide-react';

import { fetchTasksForProject, fetchTeamsForProject, fetch_project_detail } from '../api/org_API.js';
import SMTaskCard from '../components/TaskCardSM';
import ProjectCreateTaskForm from '../components/ProjectCreateTaskForm';

/* ---- Stats ---- */
function ProjectStats({ tasks, teams }) {
  const totalTasks = tasks.length;
  const totalTeams = teams.length;
  const unassignedTasks = tasks.filter((t) => !t.team).length;

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Tasks
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTasks}</p>
        <p className="mt-1 text-xs text-slate-500">Tasks in this project</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Teams
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{totalTeams}</p>
        <p className="mt-1 text-xs text-slate-500">Project teams</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Unassigned
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{unassignedTasks}</p>
        <p className="mt-1 text-xs text-slate-500">Without team</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Assigned Persons
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">-</p>
        <p className="mt-1 text-xs text-slate-500">Coming soon</p>
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
  const [projectMembers, setProjectMembers] = useState([]);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [taskData, teamData, projectData] = await Promise.all([
        fetchTasksForProject(projectId),
        fetchTeamsForProject(projectId),
        fetch_project_detail(projectId),
      ]);

      setTasks(taskData || []);
      setTeams(teamData || []);
      setProjectMembers(projectData.members_data || []);
    } catch (err) {
      console.error('Failed to load project tasks/teams:', err);
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

  // Toggle team filter
  function toggleTeamFilter(teamId) {
    if (selectedTeamIds.includes(teamId)) {
      setSelectedTeamIds(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      setSelectedTeamIds([...selectedTeamIds, teamId]);
    }
  }

  // Clear all filters
  function clearFilters() {
    setSelectedTeamIds([]);
  }

  // Group tasks by team
  const groupedTasks = [];

  // Filter teams if any selected
  const visibleTeams =
    selectedTeamIds.length > 0 ? teams.filter((team) => selectedTeamIds.includes(team.id)) : teams;

  // Add tasks for each visible team
  visibleTeams.forEach((team) => {
    const teamTasks = tasks.filter((task) => task.team?.id === team.id);
    if (teamTasks.length > 0) {
      groupedTasks.push({ team, tasks: teamTasks });
    }
  });

  // Add unassigned tasks if no filter is active OR if showing all
  if (selectedTeamIds.length === 0) {
    const unassignedTasks = tasks.filter((task) => !task.team);
    if (unassignedTasks.length > 0) {
      groupedTasks.push({ team: null, tasks: unassignedTasks });
    }
  }

  return (
    <div className="flex min-h-screen w-screen justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-6xl px-4 py-10">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Project #{projectId} – Tasks
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage all event tasks inside this project and assign them to project teams.
            </p>
          </div>

          <div className="flex justify-start sm:justify-end">
            <Button
              variant="contained"
              size="medium"
              onClick={() => setShowCreatePanel(true)}
              style={{
                borderRadius: '9999px',
                paddingInline: '1.25rem',
                textTransform: 'none',
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
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
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm sm:p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Create a new project task
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Define name, team, priority and difficulty for this project.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreatePanel(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

              <div className="mt-2">
                <ProjectCreateTaskForm
                  projectId={projectId}
                  teams={teams}
                  projectMembers={projectMembers}
                  onCreated={handleTaskCreated}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <ProjectStats tasks={tasks} teams={teams} />

        {/* Team Filter */}
        {teams.length > 0 && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-500" />
                <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                  Filter by Team
                </h3>
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
              {teams.map((team) => {
                const isSelected = selectedTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeamFilter(team.id)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: team.color || '#64748b' }}
                    />
                    {team.name}
                    <span className="text-xs text-slate-400">
                      ({tasks.filter((t) => t.team?.id === team.id).length})
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tasks Grouped by Team */}
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
              Project tasks
            </h2>
            <span className="text-xs text-slate-400">
              {loading ? 'Loading…' : hasTasks ? 'Live project overview' : 'Nothing here yet'}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">Loading tasks…</div>
          ) : hasTasks ? (
            <div className="space-y-6">
              {groupedTasks.map((group, idx) => (
                <section
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-6"
                >
                  {/* Team Header */}
                  <div className="mb-4 flex items-center gap-3">
                    {group.team ? (
                      <>
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: group.team.color || '#64748b' }}
                        />
                        <h2 className="text-lg font-semibold text-slate-900">{group.team.name}</h2>
                        <span className="text-xs text-slate-400">
                          {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="h-4 w-4 rounded-full bg-slate-300" />
                        <h2 className="text-lg font-semibold text-slate-600">Unassigned Tasks</h2>
                        <span className="text-xs text-slate-400">
                          {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Tasks Grid */}
                  <div className="grid grid-cols-1 place-items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {group.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() =>
                          navigate(`/projects/${projectId}/tasks/${task.id}`)
                        }
                        className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                      >
                        <SMTaskCard projectId={projectId} task={task} onTaskDeleted={loadData} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center text-sm text-slate-500">
              <p className="font-medium">No tasks in this project yet.</p>
              <p className="mt-1">
                Hit <span className="font-semibold">“New Project Task”</span> to add the first event
                ✨
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
