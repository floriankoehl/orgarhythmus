// frontend/src/pages/ProfilePage.jsx
import { useAuth } from "../auth/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetch_all_projects } from '../api/org_API.js';
import { User, Mail, Calendar, Folder, LogOut, ArrowRight, Loader2 } from "lucide-react";
import Button from "@mui/material/Button";

export default function ProfilePage() {
  const { user, isAuthenticated, loadingUser, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadProjects();
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
