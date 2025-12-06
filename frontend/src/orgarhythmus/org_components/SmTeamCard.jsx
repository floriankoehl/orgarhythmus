import Button from "@mui/material/Button";
import { BASE_URL } from "../../config/api";

export default function SmTeamCard({ team, setAll_Teams }) {
  const color = team.color || "#0f172a";
  const tasks = team.tasks || [];

  async function delete_team(id) {
    console.log("Trying to delete team...");

    const res = await fetch(`${BASE_URL}/api/orgarhythmus/delete_team/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      console.log("Couldn’t delete team");
      return;
    }

    setAll_Teams((prevTeams) => prevTeams.filter((team) => team.id !== id));

    console.log("Team deleted successfully");
  }

  return (
    <div
      className="
        w-full max-w-[320px]
        rounded-xl border border-slate-300
        bg-white shadow-sm hover:shadow-lg
        transition-shadow duration-150
        flex flex-col overflow-hidden
      "
    >
      {/* Strong color banner */}
      <div
        className="h-3 w-full"
        style={{ backgroundColor: color }}
      />

      <div className="p-4 flex flex-col gap-3 h-full">
        {/* Team Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Strong color bubble */}
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

        {/* Tasks Section */}
        <div className="flex flex-col flex-1">
          <p className="text-[12px] font-semibold text-slate-700 mb-1">
            Tasks ({tasks.length})
          </p>

          {/* Subtle color background */}
          <div
            className="rounded-md p-2 max-h-40 overflow-y-auto border"
            style={{ backgroundColor: color + "15", borderColor: color + "40" }}
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

        {/* Delete Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => delete_team(team.id)}
            variant="contained"
            color="error"
            size="small"
            style={{ textTransform: "none" }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
