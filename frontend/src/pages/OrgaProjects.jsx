// projects/components/OrgaProjects.jsx
import { useEffect, useState } from 'react';
import {
  fetch_all_projects,
  create_project_api,
  fetch_all_projects_browsable,
  join_project_api,
  leave_project_api,
} from '../api/org_API.js';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Plus, Folder, Calendar, User, LogIn, LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Tab component
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-cyan-500/90 text-white shadow-md'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

// Project card component
function ProjectCard({
  project,
  isOwner,
  isMember,
  onJoin,
  onLeave,
  onOpen,
  joinLoading,
  leaveLoading,
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 transition-all duration-200 hover:shadow-lg"
    >
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400" />

      {/* Project Header */}
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
            {project.name}
          </h3>
          <div className="flex-shrink-0 rounded bg-slate-100 px-2 py-1 text-xs font-semibold whitespace-nowrap text-slate-500">
            #{project.id}
          </div>
        </div>
        {project.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{project.description}</p>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <User size={11} />
          <span>{project.owner_username}</span>
        </span>
        {project.created_at && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} />
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </span>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
            Owner
          </span>
        )}
        {isMember && !isOwner && (
          <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
            Member
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-auto flex gap-2">
        {isOwner || isMember ? (
          <>
            <Button
              variant="contained"
              size="small"
              onClick={onOpen}
              style={{
                textTransform: 'none',
                borderRadius: '6px',
                flex: 1,
              }}
            >
              Open
            </Button>
            {!isOwner && (
              <Button
                variant="outlined"
                size="small"
                onClick={onLeave}
                disabled={leaveLoading}
                startIcon={
                  leaveLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )
                }
                style={{
                  textTransform: 'none',
                  borderRadius: '6px',
                  color: '#ef4444',
                  borderColor: '#ef4444',
                }}
              >
                {leaveLoading ? '...' : 'Leave'}
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={onJoin}
            disabled={joinLoading}
            startIcon={
              joinLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />
            }
            style={{
              textTransform: 'none',
              borderRadius: '6px',
              width: '100%',
            }}
          >
            {joinLoading ? 'Joining...' : 'Join Project'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function OrgaProjects() {
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState('member-projects'); // 'member-projects', 'other-projects'

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Projects data
  const [memberProjects, setMemberProjects] = useState([]);
  const [otherProjects, setOtherProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Loading states for join/leave actions
  const [loadingActions, setLoadingActions] = useState({});

  // Leave confirmation
  const [leaveConfirmProject, setLeaveConfirmProject] = useState(null);

  async function loadProjects() {
    try {
      setLoading(true);
      const [yourData, allData] = await Promise.all([
        fetch_all_projects(),
        fetch_all_projects_browsable(),
      ]);

      // All projects where user is owner or member
      setMemberProjects(yourData || []);
      // Only projects where user is NOT owner and NOT member
      const filteredOther = (allData || []).filter((p) => !p.is_owner && !p.is_member);
      setOtherProjects(filteredOther);
    } catch (err) {
      console.error(err);
      setError('Could not load projects.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please give your project a name.');
      return;
    }

    try {
      setFormSubmitting(true);
      const newProject = await create_project_api(
        name.trim(),
        description.trim(),
        startDate || null,
        endDate || null,
      );

      // Reload projects to get updated data
      await loadProjects();

      // Reset form
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not create project.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleJoinProject(projectId) {
    try {
      setLoadingActions((prev) => ({ ...prev, [projectId]: true }));
      await join_project_api(projectId);

      // Reload projects
      await loadProjects();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not join project.');
    } finally {
      setLoadingActions((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  function handleLeaveProjectClick(project) {
    setLeaveConfirmProject(project);
  }

  async function confirmLeaveProject() {
    if (!leaveConfirmProject) return;

    try {
      setLoadingActions((prev) => ({ ...prev, [leaveConfirmProject.id]: true }));
      await leave_project_api(leaveConfirmProject.id);

      // Reload projects
      await loadProjects();
      setLeaveConfirmProject(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not leave project.');
    } finally {
      setLoadingActions((prev) => ({ ...prev, [leaveConfirmProject.id]: false }));
    }
  }

  const hasMemberProjects = memberProjects && memberProjects.length > 0;
  const hasOtherProjects = otherProjects && otherProjects.length > 0;

  
  return (
    <div className="flex min-h-screen w-screen justify-center bg-gradient-to-b from-slate-50 to-slate-100 ">
      <div className="flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              <Folder size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Projekte
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Lege neue Projekte an und verwalte deine OrgaRhythmus-Projekte
              </p>
            </div>
          </div>
        </header>

        {/* Create form card */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Neues Projekt
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Name und optionale Beschreibung – mehr brauchst du noch nicht.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <TextField
              label="Projektname"
              size="small"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <TextField
              label="Beschreibung (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DatePicker
                  label="Startdatum (optional)"
                  value={startDate ? dayjs(startDate) : null}
                  onChange={(newValue) =>
                    setStartDate(newValue ? newValue.format('YYYY-MM-DD') : '')
                  }
                  minDate={dayjs()}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          backgroundColor: 'rgba(249, 250, 251, 0.7)',
                          transition: 'all 0.2s',
                          '&:hover': {
                            backgroundColor: 'rgba(249, 250, 251, 1)',
                          },
                          '&.Mui-focused': {
                            backgroundColor: '#fff',
                            boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)',
                          },
                        },
                        '& .MuiOutlinedInput-input': {
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        },
                      },
                    },
                  }}
                />

                <DatePicker
                  label="Enddatum (optional)"
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(newValue) => setEndDate(newValue ? newValue.format('YYYY-MM-DD') : '')}
                  minDate={startDate ? dayjs(startDate) : dayjs()}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          backgroundColor: 'rgba(249, 250, 251, 0.7)',
                          transition: 'all 0.2s',
                          '&:hover': {
                            backgroundColor: 'rgba(249, 250, 251, 1)',
                          },
                          '&.Mui-focused': {
                            backgroundColor: '#fff',
                            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                          },
                        },
                        '& .MuiOutlinedInput-input': {
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        },
                      },
                    },
                  }}
                />
              </div>
            </LocalizationProvider>

            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

            <div className="mt-1 flex justify-end">
              <Button
                type="submit"
                variant="contained"
                disabled={formSubmitting || !name.trim()}
                style={{
                  textTransform: 'none',
                  borderRadius: '9999px',
                  paddingInline: '1.1rem',
                  display: 'flex',
                  gap: '0.35rem',
                  alignItems: 'center',
                }}
              >
                <Plus size={16} />
                {formSubmitting ? 'Wird erstellt...' : 'Projekt erstellen'}
              </Button>
            </div>
          </form>
        </section>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton
            active={activeTab === 'member-projects'}
            onClick={() => setActiveTab('member-projects')}
          >
            Deine Projekte ({memberProjects.length})
          </TabButton>
          <TabButton
            active={activeTab === 'other-projects'}
            onClick={() => setActiveTab('other-projects')}
          >
            Andere Projekte ({otherProjects.length})
          </TabButton>
        </div>

        {/* Projects Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white/75 p-8 shadow-sm backdrop-blur-sm">
            <Loader2 size={32} className="mb-2 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Lade Projekte...</p>
          </div>
        ) : (
          <>
            {/* Member Projects Tab */}
            {activeTab === 'member-projects' && (
              <section className="rounded-2xl border border-slate-200 bg-white/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
                {hasMemberProjects ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {memberProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isOwner={project.is_owner}
                        isMember={true}
                        onOpen={() => navigate(`/projects/${project.id}/`)}
                        onJoin={() => handleJoinProject(project.id)}
                        onLeave={() => handleLeaveProjectClick(project)}
                        joinLoading={loadingActions[project.id]}
                        leaveLoading={loadingActions[project.id]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Folder size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      Du bist noch in keinem Projekt Mitglied
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Wechsel zu "Andere Projekte", um einem beizutreten!
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Other Projects Tab */}
            {activeTab === 'other-projects' && (
              <section className="rounded-2xl border border-slate-200 bg-white/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
                {hasOtherProjects ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {otherProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        isOwner={project.is_owner}
                        isMember={project.is_member}
                        onOpen={() => navigate(`/projects/${project.id}`)}
                        onJoin={() => handleJoinProject(project.id)}
                        onLeave={() => handleLeaveProjectClick(project)}
                        joinLoading={loadingActions[project.id]}
                        leaveLoading={loadingActions[project.id]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Folder size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">Keine weiteren Projekte verfügbar</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Du bist bereits Mitglied in allen existierenden Projekten!
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* Leave Confirmation Modal */}
        {leaveConfirmProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-2 text-xl font-semibold text-slate-900">Projekt verlassen?</h3>
              <p className="mb-4 text-sm text-slate-600">
                Möchtest du wirklich das Projekt{' '}
                <span className="font-semibold">{leaveConfirmProject.name}</span> verlassen?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLeaveConfirmProject(null)}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={confirmLeaveProject}
                  disabled={loadingActions[leaveConfirmProject.id]}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingActions[leaveConfirmProject.id] ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Verlasse...
                    </>
                  ) : (
                    'Verlassen'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
