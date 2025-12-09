import { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { Palette, Plus, X, Users } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { BASE_URL } from "../../config/api";
import { useLoaderData, useRevalidator } from "react-router-dom";
import SmTeamCard from "../org_components/SmTeamCard";

/* --------- Small stats bar for teams ---------- */
function TeamStats({ teams }) {
  const totalTeams = teams.length;
  const uniqueColors = new Set(teams.map((t) => t.color)).size;
  const avgNameLength =
    totalTeams > 0
      ? (
          teams.reduce((sum, t) => sum + (t.name?.length || 0), 0) /
          totalTeams
        ).toFixed(1)
      : "-";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-sm shadow-sm p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Teams
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {totalTeams}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Active groups in your board
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Unique colors
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {uniqueColors}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Visual distinction between teams
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Avg. name length
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {avgNameLength}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Characters per team name
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-slate-500">
            Palette preview
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {teams.slice(0, 6).map((t) => (
              <span
                key={t.id}
                className="h-4 w-4 rounded-full border border-slate-200"
                style={{ backgroundColor: t.color }}
              />
            ))}
            {teams.length > 6 && (
              <span className="text-[10px] text-slate-400 ml-1">
                +{teams.length - 6} more
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">First few colors</p>
        </div>
      </div>
    </div>
  );
}

/* --------- Main component: OrgaAllTeams ---------- */
export default function OrgaAllTeams() {
  const revalidator = useRevalidator();
  const loader_teams = useLoaderData();
  const [all_teams, setAll_Teams] = useState(loader_teams || []);

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showColorPickerPanel, setShowColorPickerPanel] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#facc15");

  useEffect(() => {
    setAll_Teams(loader_teams || []);
  }, [loader_teams]);

  async function create_team() {
    if (!teamName.trim()) return;

    console.log("Calling Create Team API from React...");

    const res = await fetch(`${BASE_URL}/api/orgarhythmus/create_team/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: teamName,
        color: teamColor,
      }),
    });

    if (!res.ok) {
      console.log(
        "REACT didnt receive correct response while creating team"
      );
      return;
    }

    console.log("Team successfully created!");

    // Reset UI and reload via loader
    setTeamName("");
    setTeamColor("#facc15");
    setShowColorPickerPanel(false);
    setShowCreatePanel(false);
    revalidator.revalidate();
  }

  const hasTeams = all_teams && all_teams.length > 0;

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-50 to-slate-100 flex justify-center">
      <div className="w-full max-w-6xl px-4 py-8 flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white">
              <Users size={18} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                Teams
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage groups, colors and structure your OrgaRhythmus.
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

        {/* Create panel */}
        {showCreatePanel && (
          <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-md p-4 sm:p-5 relative mb-4 z-50">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xs font-semibold tracking-[0.16em] uppercase text-slate-500">
                  Create a Team
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a name and color for your new group.
                </p>
              </div>
              <button
                onClick={() => setShowCreatePanel(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Name */}
              <TextField
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                id="team-name"
                label="Team name"
                variant="outlined"
                size="small"
                fullWidth
              />

              {/* Color picker */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">
                  Team color
                </span>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Palette size={16} />
                    <span>{teamColor}</span>
                  </div>

                  <div
                    style={{ backgroundColor: teamColor }}
                    className="relative h-8 w-24 flex justify-center items-center rounded-full border border-slate-200 cursor-pointer"
                    onClick={() =>
                      setShowColorPickerPanel((prev) => !prev)
                    }
                  >
                    <button
                      type="button"
                      className="w-8 h-8 flex justify-center items-center rounded-full bg-white/70 text-slate-700 text-[11px] hover:bg-white"
                    >
                      {!showColorPickerPanel ? (
                        <Palette size={16} />
                      ) : (
                        <span className="font-semibold">OK</span>
                      )}
                    </button>

                    {showColorPickerPanel && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full right-0 mt-2 z-50 p-2 bg-slate-900 rounded-xl shadow-xl"
                      >
                        <div className="h-[200px] w-[200px]">
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

              <div className="mt-2 flex justify-end">
                <Button
                  onClick={create_team}
                  variant="contained"
                  size="small"
                  disabled={!teamName.trim()}
                  style={{ textTransform: "none" }}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <TeamStats teams={all_teams} />

        {/* Team grid */}
        <section className="rounded-2xl border border-slate-200 bg-white/75 backdrop-blur-sm shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500">
              All Teams
            </h2>
            <span className="text-xs text-slate-400">
              {hasTeams
                ? `${all_teams.length} team${
                    all_teams.length === 1 ? "" : "s"
                  }`
                : "Nothing here yet"}
            </span>
          </div>

          {hasTeams ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 place-items-stretch">
              {all_teams.map((team) => (
                <SmTeamCard
                  key={team.id}
                  team={team}
                  setAll_Teams={setAll_Teams} // kept for compatibility, even if unused
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 text-sm">
              <p className="font-medium">No teams yet.</p>
              <p className="mt-1">
                Click <span className="font-semibold">“New Team”</span> to
                create your first group ✨
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
