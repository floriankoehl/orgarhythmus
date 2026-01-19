import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';

import {
  project_teams_expanded, // Change this
  createTeamForProject,
  deleteTeamForProject,
} from '../orgarhythmus/api/org_API';

import { Users, Plus, Trash2, Loader2 } from 'lucide-react';

import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

export default function ProjectTeams() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create panel
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#facc15');
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  async function loadTeams() {
    try {
      setLoading(true);
      const data = await project_teams_expanded(projectId); // Use expanded version
      const list = Array.isArray(data) ? data : [];
      setTeams(list);
    } catch (err) {
      console.error(err);
      setError('Could not load teams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) loadTeams();
  }, [projectId]);

  async function handleCreate() {
    if (!name.trim()) return;

    try {
      setCreating(true);
      await createTeamForProject(projectId, { name, color });

      setName('');
      setColor('#facc15');
      setShowPicker(false);
      setShowCreate(false);

      await loadTeams();
    } catch (err) {
      console.error(err);
      setError('Could not create team.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(teamId, teamName) {
    const ok = window.confirm(`Delete team "${teamName}"?`);
    if (!ok) return;

    try {
      setDeletingId(teamId);
      await deleteTeamForProject(projectId, teamId);

      // Optimistic UI
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err) {
      console.error(err);
      setError('Could not delete team.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-screen w-full justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="flex w-full max-w-5xl flex-col gap-6 py-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Teams for Project #{projectId}
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Manage which teams operate inside this OrgaRhythmus project.
              </p>
            </div>
          </div>

          <Button
            variant="contained"
            onClick={() => setShowCreate(true)}
            style={{
              borderRadius: '100px',
              textTransform: 'none',
              paddingInline: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Plus size={18} />
            New Team
          </Button>
        </header>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create team panel */}
        {showCreate && (
          <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-lg bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Create Team
                </h2>
                <p className="mt-1 text-xs text-slate-500">Enter a name and pick a team color.</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                label="Team name"
                size="small"
                fullWidth
              />

              {/* Color picker */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Team color</span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono">{color}</span>
                  </div>

                  <div className="relative cursor-pointer" onClick={() => setShowPicker((x) => !x)}>
                    <div
                      className="flex h-8 w-24 items-center justify-center rounded-full border border-slate-300 bg-white shadow"
                      style={{ backgroundColor: color + '22' }}
                    >
                      {showPicker ? 'OK' : 'Pick'}
                    </div>

                    {showPicker && (
                      <div
                        className="absolute right-0 bottom-full z-[9999] mb-2 rounded-xl bg-slate-900 p-3 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HexColorPicker color={color} onChange={setColor} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outlined"
                size="small"
                style={{ textTransform: 'none' }}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                size="small"
                disabled={!name.trim() || creating}
                style={{ textTransform: 'none' }}
                onClick={handleCreate}
              >
                {creating ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="animate-spin" size={16} />
                    Creating…
                  </span>
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Team grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Teams in this project
            </h2>
            <span className="text-xs text-slate-400">
              {loading
                ? 'Loading…'
                : teams.length === 0
                  ? 'No teams'
                  : `${teams.length} team${teams.length === 1 ? '' : 's'}`}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
              <Loader2 className="animate-spin" />
              <span className="text-xs">Loading teams…</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
              <Users size={22} className="text-slate-300" />
              <p className="text-sm">No teams yet — create your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const initial = team.name?.[0]?.toUpperCase() || 'T';
                const taskCount = team.tasks?.length || 0;

                return (
                  <div
                    key={team.id}
                    onClick={() => navigate(`/orgarhythmus/projects/${projectId}/teams/${team.id}`)}
                    className="flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow transition hover:shadow-lg"
                  >
                    <div className="h-2 w-full rounded" style={{ backgroundColor: team.color }} />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-slate-900 shadow"
                          style={{ backgroundColor: team.color + 'aa' }}
                        >
                          {initial}
                        </div>

                        <div>
                          <h3 className="max-w-[150px] truncate font-semibold text-slate-900">
                            {team.name}
                          </h3>
                          <p className="font-mono text-xs text-slate-500">{team.color}</p>
                        </div>
                      </div>

                      <button
                        title="Delete team"
                        disabled={deletingId === team.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(team.id, team.name);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        {deletingId === team.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>

                    {/* Tasks list */}
                    {taskCount > 0 ? (
                      <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
                        <p className="text-xs font-semibold text-slate-600">Tasks ({taskCount})</p>
                        <ul className="space-y-1">
                          {team.tasks.slice(0, 3).map((task) => (
                            <li
                              key={task.id}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent team card click
                                navigate(`/orgarhythmus/projects/${projectId}/tasks/${task.id}`);
                              }}
                              className="-mx-2 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              <span className="h-1 w-1 rounded-full bg-slate-400" />
                              <span className="flex-1 truncate">{task.name}</span>
                              <span className="text-[10px] text-slate-400">→</span>
                            </li>
                          ))}
                          {taskCount > 3 && (
                            <li className="px-2 text-xs text-slate-500 italic">
                              +{taskCount - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No tasks assigned</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
