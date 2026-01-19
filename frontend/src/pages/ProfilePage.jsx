import { useAuth } from "../auth/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetch_all_projects, fetchUserTeams, fetchUserTasks } from '../api/org_API.js';
import { User, Mail, Calendar, Folder, LogOut, ArrowRight, Loader2, Users, AlertCircle, Zap, ListTodo } from "lucide-react";
import Button from "@mui/material/Button";

export default function ProfilePage() {
  const { user, isAuthenticated, loadingUser, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadTasks();
      loadProjects();
      loadTeams();
    }
  }, [isAuthenticated, user]);

  async function loadProjects() {
    try {
      setLoadingProjects(true);
      const data = await fetch_all_projects();
      setProjects(data || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadTeams() {
    try {
      setLoadingTeams(true);
      const data = await fetchUserTeams();
      setTeams(data || []);
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setLoadingTeams(false);
    }
  }

  async function loadTasks() {
    try {
      setLoadingTasks(true);
      const data = await fetchUserTasks();
      setTasks(data || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/landing");
  }

  // Still loading auth state
  if (loadingUser) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading your profile...</span>
        </div>
      </div>
    );
  }

  // Not authenticated → redirect
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center px-4 py-8">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        
        {/* Back Button */}
        <button
          onClick={() => navigate("/landing")}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 hover:bg-white/100 text-slate-900 transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200 w-fit"
        >
          <span className="text-sm font-medium">← Back</span>
        </button>

        {/* Profile Header Card */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            
            {/* Avatar */}
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg flex-shrink-0">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
                {user?.username}
              </h1>
              <p className="text-slate-600 text-sm mt-2">Welcome back to OrgaRhythmus!</p>

              {/* User Details Grid */}
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <Mail size={16} className="text-blue-600" />
                  <span className="text-sm text-slate-700">
                    {user?.email || <span className="text-slate-500 italic">No email set</span>}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <User size={16} className="text-purple-600" />
                  <span className="text-sm text-slate-700 font-mono">ID: {user?.id}</span>
                </div>

                {user?.date_joined && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <Calendar size={16} className="text-emerald-600" />
                    <span className="text-sm text-slate-700">
                      Joined {new Date(user.date_joined).toLocaleDateString("de-DE", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="outlined"
              color="error"
              size="large"
              style={{
                textTransform: "none",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </header>


         {/* Assigned Tasks Section */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <ListTodo size={20} className="text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Assigned Tasks</h2>
              </div>
              <p className="text-sm text-slate-600">
                All tasks you are currently assigned to across all projects
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
            </span>
          </div>

          {loadingTasks ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Loading tasks...</span>
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/projects/${task.project.id}/tasks/${task.id}`)}
                  className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-lg transition-all duration-200 p-5 cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-3">
                        {task.team && (
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: task.team.color || '#64748b' }}
                          >
                            {task.team.name?.[0]?.toUpperCase() || 'T'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                            {task.name}
                          </h3>
                          {task.asking && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                              {task.asking}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Task Meta */}
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        {task.project && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            <Folder size={14} className="text-slate-400" />
                            <span className="line-clamp-1">{task.project.name}</span>
                          </div>
                        )}
                        {task.team && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            <Users size={14} className="text-slate-400" />
                            <span>{task.team.name}</span>
                          </div>
                        )}
                        {task.difficulty && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                            <Zap size={14} className="text-amber-600" />
                            <span className="text-amber-700">{task.difficulty}</span>
                          </div>
                        )}
                        {task.priority && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                            <AlertCircle size={14} className="text-red-600" />
                            <span className="text-red-700">{task.priority}</span>
                          </div>
                        )}
                        {task.assigned_members_count > 1 && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            <Users size={14} className="text-slate-400" />
                            <span>{task.assigned_members_count} assigned</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center group-hover:translate-x-1 transition-transform pt-1">
                      <ArrowRight size={20} className="text-slate-400 group-hover:text-emerald-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <ListTodo size={32} className="text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No tasks assigned yet</h3>
                <p className="text-sm text-slate-600 mt-1">
                  You haven't been assigned to any tasks yet!
                </p>
              </div>
            </div>
          )}
        </section>

              {/* Teams Section */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Users size={20} className="text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Your Teams</h2>
              </div>
              <p className="text-sm text-slate-600">
                All teams you are a member of across all projects
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {teams.length} {teams.length === 1 ? "Team" : "Teams"}
            </span>
          </div>

          {loadingTeams ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Loading teams...</span>
            </div>
          ) : teams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => navigate(`/projects/${team.project.id}/teams/${team.id}`)}
                  className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-lg transition-all duration-200 p-5 cursor-pointer group flex flex-col gap-4"
                >
                  {/* Team Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: team.color || '#64748b' }}
                    >
                      {team.name?.[0]?.toUpperCase() || 'T'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                        {team.name}
                      </h3>
                      {team.project && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {team.project.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Team Meta */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Users size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-600">
                      {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2 group-hover:translate-x-1 transition-transform">
                    <span className="text-xs font-medium text-slate-500 group-hover:text-purple-600">
                      View Team
                    </span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Users size={32} className="text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No teams yet</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Join a team in one of your projects to get started!
                </p>
              </div>
            </div>
          )}
        </section>

       

        {/* Projects Section */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Folder size={20} className="text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">Your Projects</h2>
              </div>
              <p className="text-sm text-slate-600">
                All projects you own or are a member of
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {projects.length} {projects.length === 1 ? "Project" : "Projects"}
            </span>
          </div>

          {loadingProjects ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-slate-400" />
              <span className="text-sm text-slate-500">Loading projects...</span>
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-lg transition-all duration-200 p-5 cursor-pointer group flex flex-col gap-4"
                >
                  {/* Project Header */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {project.name}
                      </h3>
                      <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
                        #{project.id}
                      </div>
                    </div>
                    {project.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Project Meta */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <User size={14} className="text-slate-400" />
                      <span>Owner: <span className="font-medium text-slate-900">{project.owner_username}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      <span>
                        Created {new Date(project.created_at).toLocaleDateString("de-DE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2 mt-2 group-hover:translate-x-1 transition-transform">
                    <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600">
                      Open Project
                    </span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <Folder size={32} className="text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">No projects yet</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Start by creating your first OrgaRhythmus project!
                </p>
              </div>
              <Button
                variant="contained"
                onClick={() => navigate("/orgarhythmus")}
                style={{ textTransform: "none", marginTop: "0.5rem" }}
              >
                Go to Projects
              </Button>
            </div>
          )}
        </section>

        
      </div>
    </div>
  );
}
