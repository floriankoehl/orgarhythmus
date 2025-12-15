// orgarhythmus/projects/pages/ProjectMain.jsx
import { useLoaderData, useNavigate } from "react-router-dom";
import { Folder, Calendar, User, ArrowLeft, Plus, Settings, Share2, Trash2, Users, AlertTriangle, X } from "lucide-react";
import { fetch_project_detail, fetchTeamsForProject, fetchTasksForProject, delete_project } from "../../api/org_API";
import Button from "@mui/material/Button";
import { useState } from "react";

export async function project_loader({ params }) {
  const { projectId } = params;
  const project = await fetch_project_detail(projectId);
  const loaded_teams = await fetchTeamsForProject(projectId);
  const loaded_tasks = await fetchTasksForProject(projectId);

  return { project, loaded_teams, loaded_tasks };
}

function ProjectStats({ tasks, teams }) {
  const totalTasks = tasks.length;
  const totalTeams = teams.length;
  const unassignedTasks = tasks.filter((t) => !t.team).length;

  const avgPriority =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.priority || 0), 0) / totalTasks).toFixed(1)
      : "-";

  const avgDifficulty =
    totalTasks > 0
      ? (tasks.reduce((sum, t) => sum + (t.difficulty || 0), 0) / totalTasks).toFixed(1)
      : "-";

  return (
    <section className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Tasks
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {totalTasks}
        </p>
        <p className="mt-1 text-xs text-slate-500">Tasks in this project</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Teams
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {totalTeams}
        </p>
        <p className="mt-1 text-xs text-slate-500">Project teams</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-3 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500">
          Unassigned
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {unassignedTasks}
        </p>
        <p className="mt-1 text-xs text-slate-500">Without team</p>
      </div>

     
    </section>
  );
}

function DeleteProjectModal({ isOpen, projectName, onConfirm, onCancel, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="animate-in fade-in slide-in-from-top-10 duration-300 w-full max-w-md mx-4">
        <div className="rounded-2xl border border-red-200 bg-white shadow-2xl p-8">
          
          {/* Close button */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-slate-500" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-slate-900 text-center mb-2">
            Delete Project
          </h2>

          {/* Warning text */}
          <p className="text-center text-slate-600 mb-6">
            <span className="font-semibold">Be cautious,</span> this can't be undone.
          </p>

          {/* Project name highlight */}
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm text-slate-600">You are about to delete:</p>
            <p className="text-lg font-semibold text-red-600 mt-1 truncate">{projectName}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectMain() {
  const { project, loaded_teams, loaded_tasks } = useLoaderData();
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createdDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      await delete_project(project.id);
      // Add a small delay to ensure the request completes
      await new Promise(resolve => setTimeout(resolve, 500));
      // Navigate to orgarhythmus main page (projects list)
      navigate("/orgarhythmus");
    } catch (err) {
      console.error(err);
      alert("Failed to delete project: " + err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-5xl px-4 py-8 flex flex-col gap-6">
        
        {/* Back Button */}
        <button
          onClick={() => navigate("/orgarhythmus/")}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/80 hover:bg-white/100 text-slate-900 transition-all duration-200 shadow-sm hover:shadow-md border border-slate-200 w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Zurück</span>
        </button>

        {/* Header Section */}
        <header className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900">
                {project.name}
              </h1>
              <p className="text-slate-600 text-base mt-2 leading-relaxed">
                {project.description || "Kein Beschreibung hinterlegt. Gestalte dein Projekt!"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                title="Project settings"
                className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <Settings size={20} />
              </button>
              <button
                title="Share project"
                className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <Share2 size={20} />
              </button>
              <button
                title="Delete project"
                onClick={() => setShowDeleteModal(true)}
                className="p-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {/* Meta Information */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <User size={16} className="text-blue-600" />
              <span className="text-sm text-slate-700 font-medium">{project.owner_username}</span>
            </div>

            {createdDate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <Calendar size={16} className="text-purple-600" />
                <span className="text-sm text-slate-700">{createdDate}</span>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <Folder size={16} className="text-emerald-600" />
              <span className="text-sm text-slate-700 font-mono">ID: {project.id}</span>
            </div>
          </div>
        </header>

        {/* Stats Section */}
        <ProjectStats tasks={loaded_tasks} teams={loaded_teams} />

        {/* Teams & Tasks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Teams Card */}
          <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
                  <p className="text-xs text-slate-500">{loaded_teams.length} {loaded_teams.length === 1 ? "Team" : "Teams"}</p>
                </div>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/orgarhythmus/projects/${project.id}/teams`)}
                style={{ textTransform: "none", borderRadius: "8px" }}
              >
                Manage
              </Button>
            </div>

            {loaded_teams.length > 0 ? (
              <div className="space-y-3">
                {loaded_teams.slice(0, 4).map((team) => (
                  <div
                    key={team.id}
                    onClick={() => navigate(`/orgarhythmus/projects/${project.id}/teams/${team.id}`)}
                    className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: team.color || "#64748b" }}
                      />
                      <span className="text-sm font-medium text-slate-900">{team.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">{team.tasks?.length || 0} tasks</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Noch keine Teams erstellt</p>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate(`/orgarhythmus/projects/${project.id}/teams`)}
                  style={{ textTransform: "none", marginTop: "1rem", borderRadius: "8px" }}
                >
                  Erstes Team erstellen
                </Button>
              </div>
            )}

            {loaded_teams.length > 4 && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(`/orgarhythmus/projects/${project.id}/teams`)}
                style={{ textTransform: "none", marginTop: "1rem", borderRadius: "8px" }}
              >
                Alle Teams anzeigen →
              </Button>
            )}
          </section>

          {/* Tasks Card */}
          <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Folder size={20} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
                  <p className="text-xs text-slate-500">{loaded_tasks.length} {loaded_tasks.length === 1 ? "Task" : "Tasks"}</p>
                </div>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/orgarhythmus/projects/${project.id}/tasks`)}
                style={{ textTransform: "none", borderRadius: "8px" }}
              >
                Manage
              </Button>
            </div>

            {loaded_tasks.length > 0 ? (
              <div className="space-y-3">
                {loaded_tasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{task.name}</p>
                        {task.team && (
                          <p className="text-xs text-slate-500 mt-1">{task.team.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
                        <span className="px-2 py-1 bg-blue-50 rounded">P{task.priority || 0}</span>
                        <span className="px-2 py-1 bg-purple-50 rounded">D{task.difficulty || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Folder size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Noch keine Tasks erstellt</p>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate(`/orgarhythmus/projects/${project.id}/tasks`)}
                  style={{ textTransform: "none", marginTop: "1rem", borderRadius: "8px" }}
                >
                  Ersten Task erstellen
                </Button>
              </div>
            )}

            {loaded_tasks.length > 4 && (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate(`/orgarhythmus/projects/${project.id}/tasks`)}
                style={{ textTransform: "none", marginTop: "1rem", borderRadius: "8px" }}
              >
                Alle Tasks anzeigen →
              </Button>
            )}
          </section>

        </div>
      </div>

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={showDeleteModal}
        projectName={project.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={deleting}
      />
    </div>
  );
}
