import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { HexColorPicker } from "react-colorful";

import {
  fetchTeamsForProject,
  createTeamForProject,
  deleteTeamForProject,
} from "../../api/org_API";

import {
  Users,
  Plus,
  Trash2,
  Loader2
} from "lucide-react";

import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

export default function ProjectTeams() {
  const { projectId } = useParams();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create panel
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#facc15");
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  async function loadTeams() {
    try {
      setLoading(true);
      const data = await fetchTeamsForProject(projectId);
      const list = Array.isArray(data) ? data : data.teams || [];
      setTeams(list);
    } catch (err) {
      console.error(err);
      setError("Could not load teams.");
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

      setName("");
      setColor("#facc15");
      setShowPicker(false);
      setShowCreate(false);

      await loadTeams();
    } catch (err) {
      console.error(err);
      setError("Could not create team.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(teamId, teamName) {
    const ok = window.confirm(`Delete team “${teamName}”?`);
    if (!ok) return;

    try {
      setDeletingId(teamId);
      await deleteTeamForProject(projectId, teamId);

      // Optimistic UI
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err) {
      console.error(err);
      setError("Could not delete team.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-full px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Teams for Project #{projectId}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Manage which teams operate inside this OrgaRhythmus project.
              </p>
            </div>
          </div>

          <Button
            variant="contained"
            onClick={() => setShowCreate(true)}
            style={{
              borderRadius: "100px",
              textTransform: "none",
              paddingInline: "1.2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <Plus size={18} />
            New Team
          </Button>
        </header>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create team panel */}
        {showCreate && (
          <div className="relative rounded-2xl bg-white border border-slate-200 shadow p-5">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 rounded-t-lg" />

            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xs uppercase font-semibold tracking-wide text-slate-500">
                  Create Team
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enter a name and pick a team color.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="h-7 w-7 rounded-full border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-100"
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

                  <div
                    className="relative cursor-pointer"
                    onClick={() => setShowPicker((x) => !x)}
                  >
                    <div
                      className="h-8 w-24 rounded-full border border-slate-300 flex items-center justify-center bg-white shadow"
                      style={{ backgroundColor: color + "22" }}
                    >
                      {showPicker ? "OK" : "Pick"}
                    </div>

                    {showPicker && (
                      <div
                        className="absolute bottom-full right-0 mb-2 z-[9999] p-3 bg-slate-900 rounded-xl shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <HexColorPicker color={color} onChange={setColor} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outlined"
                  size="small"
                  style={{ textTransform: "none" }}
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>

                <Button
                  variant="contained"
                  size="small"
                  disabled={!name.trim() || creating}
                  style={{ textTransform: "none" }}
                  onClick={handleCreate}
                >
                  {creating ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="animate-spin" size={16} />
                      Creating…
                    </span>
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team grid */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs uppercase font-semibold tracking-wide text-slate-500">
              Teams in this project
            </h2>
            <span className="text-xs text-slate-400">
              {loading
                ? "Loading…"
                : teams.length === 0
                  ? "No teams"
                  : `${teams.length} team${teams.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
              <Loader2 className="animate-spin" />
              <span className="text-xs">Loading teams…</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-500 gap-3">
              <Users size={22} className="text-slate-300" />
              <p className="text-sm">No teams yet — create your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const initial = team.name?.[0]?.toUpperCase() || "T";

                return (
                  <div
                    key={team.id}
                    className="rounded-xl border border-slate-200 bg-white shadow hover:shadow-lg transition p-4 flex flex-col gap-4"
                  >
                    <div
                      className="h-2 w-full rounded"
                      style={{ backgroundColor: team.color }}
                    />

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full shadow flex items-center justify-center text-sm font-bold text-slate-900"
                          style={{ backgroundColor: team.color + "aa" }}
                        >
                          {initial}
                        </div>

                        <div>
                          <h3 className="font-semibold text-slate-900 truncate max-w-[150px]">
                            {team.name}
                          </h3>
                          <p className="text-xs font-mono text-slate-500">
                            {team.color}
                          </p>
                        </div>
                      </div>

                      <button
                        title="Delete team"
                        disabled={deletingId === team.id}
                        onClick={() => handleDelete(team.id, team.name)}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        {deletingId === team.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>

                    <div className="text-xs text-slate-500">
                      {team.tasks?.length || 0} tasks assigned
                    </div>
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
