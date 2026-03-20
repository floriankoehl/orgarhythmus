/**
 * TeamsTabContent — team grid for the "Teams" tab inside TaskStructure.
 * Adapted from pages/overview/Teams.jsx for in-window use.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { emitDataEvent, useManualRefresh } from "../../api/dataEvents";
import { HexColorPicker } from "react-colorful";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  project_teams_expanded,
  createTeamForProject,
  deleteTeamForProject,
} from "../../api/org_API.js";

export default function TeamsTabContent({ onViewTeamDetail }) {
  const { projectId } = useParams();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#facc15");
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadTeams();
  }, [projectId]);

  // Re-fetch whenever any window emits a data change
  useManualRefresh(loadTeams);

  async function loadTeams() {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await project_teams_expanded(projectId);
      setTeams(data);
    } catch {
      setError("Could not load teams.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      setCreating(true);
      setError(null);
      await createTeamForProject(projectId, { name: name.trim(), color });
      setName("");
      setColor("#facc15");
      setShowCreate(false);
      setShowPicker(false);
      emitDataEvent('teams');
      await loadTeams();
    } catch (err) {
      setError(err.message || "Failed to create team.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(teamId) {
    try {
      setDeletingId(teamId);
      setError(null);
      await deleteTeamForProject(projectId, teamId);
      emitDataEvent('teams');
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err) {
      setError(err.message || "Failed to delete team.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-slate-400" />
          <span className="text-xs text-slate-500">Loading teams…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-indigo-600" />
          <span className="text-xs font-semibold text-slate-700">
            {teams.length} {teams.length === 1 ? "Team" : "Teams"}
          </span>
        </div>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Plus size={14} />}
          onClick={() => setShowCreate(!showCreate)}
          style={{ textTransform: "none", borderRadius: "8px", fontSize: "11px", padding: "4px 12px" }}
        >
          New Team
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {/* Create panel */}
      {showCreate && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex-shrink-0">
          <h3 className="mb-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Create New Team
          </h3>
          <div className="flex flex-col gap-3">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              label="Team Name"
              size="small"
              fullWidth
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              inputProps={{ style: { fontSize: "13px" } }}
            />
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 cursor-pointer rounded-full border-2 border-slate-300 shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                onClick={() => setShowPicker(!showPicker)}
              />
              <span className="font-mono text-xs text-slate-600">{color}</span>
            </div>
            {showPicker && (
              <div className="w-fit rounded-xl bg-slate-900 p-3 shadow-xl">
                <HexColorPicker color={color} onChange={setColor} />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                variant="contained"
                size="small"
                style={{ textTransform: "none", fontSize: "12px" }}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : "Create"}
              </Button>
              <Button
                onClick={() => { setShowCreate(false); setShowPicker(false); }}
                variant="text"
                size="small"
                style={{ textTransform: "none", fontSize: "12px" }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team grid */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users size={32} className="mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No teams yet</p>
          <p className="mt-1 text-xs text-slate-500">Create your first team to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const hasTasks = team.tasks && team.tasks.length > 0;
            return (
              <div
                key={team.id}
                onClick={() => onViewTeamDetail(team.id)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div
                  className="h-1.5 rounded-t-xl"
                  style={{ backgroundColor: team.color || "#64748b" }}
                />
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow"
                        style={{ backgroundColor: team.color || "#64748b" }}
                      >
                        {team.name?.[0]?.toUpperCase() || "T"}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{team.name}</h3>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Users size={10} />
                          <span>{team.tasks?.length || 0} tasks</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(team.id); }}
                      disabled={deletingId === team.id}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      {deletingId === team.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                  {hasTasks && (
                    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                      <div className="space-y-1">
                        {team.tasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                            <span className="truncate">{task.name}</span>
                          </div>
                        ))}
                        {team.tasks.length > 3 && (
                          <div className="text-[11px] text-slate-400 pl-3.5">
                            +{team.tasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
