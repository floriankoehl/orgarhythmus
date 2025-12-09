// orgarhythmus/projects/pages/ProjectMain.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { Users, Plus } from "lucide-react";
import { HexColorPicker } from "react-colorful";

import { fetchTeamsForProject, createTeamForProject } from "../../org_API";

export default function ProjectTeams() {
  const { projectId } = useParams();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#facc15");
  const [showColorPicker, setShowColorPicker] = useState(false);

  async function loadTeams() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTeamsForProject(projectId);
      setTeams(data || []);
    } catch (err) {
      console.error(err);
      setError("Could not load teams for this project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadTeams();
    }
  }, [projectId]);

  async function handleCreateTeam() {
    if (!teamName.trim()) return;

    try {
      await createTeamForProject(projectId, {
        name: teamName,
        color: teamColor,
      });

      setTeamName("");
      setTeamColor("#facc15");
      setShowColorPicker(false);
      setShowCreatePanel(false);

      await loadTeams();
    } catch (err) {
      console.error(err);
      setError("Could not create team.");
    }
  }

  const hasTeams = teams && teams.length > 0;

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-8 flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Users size={18} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                Project #{projectId}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage the teams inside this OrgaRhythmus project.
              </p>
            </div>
          </div>

          <div className="flex justify-start sm:justify-end">
            <Button
              variant="contained"
              size="medium"
              onClick={() => setShowCreatePanel(true)}
              style={{
                textTransform: "none",
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
                borderRadius: "9999px",
                paddingInline: "1.1rem",
              }}
            >
              <Plus size={18} />
              New Team
            </Button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Create panel */}
        {showCreatePanel && (
          <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-md p-4 sm:p-5 relative mb-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">
                  Create team
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a name and color for this project team.
                </p>
              </div>
              <button
                onClick={() => setShowCreatePanel(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <TextField
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                id="team-name"
                label="Team name"
                variant="outlined"
                size="small"
                fullWidth
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-700">
                  Team color
                </span>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: teamColor }}
                    />
                    <span>{teamColor}</span>
                  </div>

                  {/* Wrapper relativ, Picker mit hohem z-index */}
                  <div
                    className="relative z-100 h-8 w-28 flex justify-center items-center rounded-full border border-slate-300 cursor-pointer bg-white"
                    style={{ backgroundColor: teamColor + "22" }}
                    onClick={() => setShowColorPicker((prev) => !prev)}
                  >
                    <button
                      type="button"
                      className="w-10 h-8 flex justify-center items-center rounded-full bg-white/80 text-slate-800 text-[11px] hover:bg-white shadow-sm"
                    >
                      {!showColorPicker ? "Pick" : "OK"}
                    </button>

                    {showColorPicker && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full right-0 mt-2 z-[60] p-2 bg-slate-900 rounded-xl shadow-2xl"
                      >
                        <div className="h-[220px] w-[220px]">
                          <HexColorPicker
                            color={teamColor}
                            onChange={setTeamColor}
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <Button
                  onClick={() => setShowCreatePanel(false)}
                  variant="outlined"
                  size="small"
                  style={{
                    textTransform: "none",
                    borderColor: "rgba(148,163,184,0.9)",
                    color: "#334155",
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeam}
                  variant="contained"
                  size="small"
                  disabled={!teamName.trim()}
                  style={{
                    textTransform: "none",
                  }}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team list – optisch an SmTeamCard angelehnt */}
        <section className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-4 sm:p-6 flex-1 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500">
              Teams in this project
            </h2>
            <span className="text-xs text-slate-400">
              {loading
                ? "Loading…"
                : hasTeams
                ? `${teams.length} team${teams.length === 1 ? "" : "s"}`
                : "No teams yet"}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Loading teams…
            </div>
          ) : hasTeams ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const color = team.color || "#0f172a";
                const tasks = team.tasks || [];
                return (
                  <div
                    key={team.id}
                    className="
                      w-full max-w-[320px]
                      rounded-xl border border-slate-300
                      bg-white shadow-sm hover:shadow-lg
                      transition-shadow duration-150
                      flex flex-col overflow-hidden
                    "
                  >
                    {/* Color banner */}
                    <div
                      className="h-3 w-full"
                      style={{ backgroundColor: color }}
                    />

                    <div className="p-4 flex flex-col gap-3 h-full">
                      {/* Header ähnlich SmTeamCard */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-10 w-10 rounded-full border border-slate-200 shadow-sm flex items-center justify-center text-sm font-bold text-slate-900"
                            style={{ backgroundColor: color + "aa" }}
                          >
                            {team.name?.[0]?.toUpperCase() || "T"}
                          </span>

                          <div>
                            <h3 className="text-base font-semibold text-slate-900 truncate max-w-[150px]">
                              {team.name}
                            </h3>
                            <p className="text-[11px] text-slate-600">
                              {color}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Kleine Info zu Tasks, falls vorhanden */}
                      <div className="flex flex-col flex-1">
                        <p className="text-[12px] font-semibold text-slate-700 mb-1">
                          Tasks ({tasks.length})
                        </p>

                        <div
                          className="rounded-md p-2 max-h-32 overflow-y-auto border"
                          style={{
                            backgroundColor: color + "15",
                            borderColor: color + "40",
                          }}
                        >
                          {tasks.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {tasks.map((task) => (
                                <li
                                  key={task.id}
                                  className="
                                    text-[12px] bg-white rounded-md px-2 py-1 
                                    border border-slate-200 flex items-center shadow-sm
                                  "
                                >
                                  <span className="mr-1 text-slate-400">•</span>
                                  <span className="truncate">{task.name}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-slate-500">
                              No tasks assigned yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              No teams yet. Click{" "}
              <span className="font-semibold text-slate-900">
                “New Team”
              </span>{" "}
              to create the first one ✨
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
