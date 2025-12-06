import { useEffect, useState } from "react";
import { create_task, fetch_all_teams } from "../org_API";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";

const numbers = [1, 2, 3, 4, 5];

export default function CreateTaskForm({ onTaskCreated }) {
  const [all_teams, setAll_Teams] = useState([]);

  const [task_create_name, setTask_Create_Name] = useState("");
  const [task_difficulty, setTask_Difficulty] = useState(0);
  const [task_priority, setTask_Priority] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [task_approval, setTask_Approval] = useState(false);

  const handleCreate = async () => {
    const result = await create_task(
      task_create_name,
      task_difficulty,
      task_priority,
      task_approval,
      selectedTeamId
    );

    if (onTaskCreated) {
      onTaskCreated(); // ✅ Trigger parent to reload tasks
    }

    // Optional: Reset form
    setTask_Create_Name("");
    setTask_Difficulty(0);
    setTask_Priority(0);
    setSelectedTeamId("");
  };

  useEffect(() => {
    async function loadTeams() {
      const all_fetched_teams = await fetch_all_teams();
      setAll_Teams(all_fetched_teams || []);
    }
    loadTeams();
  }, []);

  const isCreateDisabled =
    !task_create_name.trim() || task_priority === 0 || task_difficulty === 0;

  return (
    <div
      className="
        w-full max-w-md
        rounded-2xl border border-slate-200
        bg-white/80 backdrop-blur-sm
        shadow-sm hover:shadow-md
        transition-shadow duration-150
        px-4 py-5 sm:px-5
      "
    >
      <div className="flex flex-col gap-3">
        <h1 className="mb-1 text-lg sm:text-xl font-semibold text-slate-900">
          Create Task
        </h1>

        {/* Name */}
        <TextField
          value={task_create_name}
          onChange={(e) => {
            setTask_Create_Name(e.target.value);
          }}
          id="task-name"
          label="Task name"
          variant="outlined"
          size="small"
          fullWidth
        />

        {/* Team */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Team</span>
          <Select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ width: "100%" }}
          >
            <MenuItem value="">
              <em>No team</em>
            </MenuItem>

            {all_teams.map((team) => (
              <MenuItem className="p-2" key={team.id} value={team.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span>{team.name}</span>
                </div>
              </MenuItem>
            ))}
          </Select>
        </div>

        {/* Priority & Difficulty */}
        <div className="flex flex-col sm:flex-row gap-3 mt-1">
          <TextField
            label="Priority"
            select
            size="small"
            value={task_priority}
            sx={{ minWidth: 120, flex: 1 }}
            onChange={(e) => {
              setTask_Priority(Number(e.target.value));
            }}
            fullWidth
          >
            {numbers.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Difficulty"
            select
            size="small"
            value={task_difficulty}
            sx={{ minWidth: 120, flex: 1 }}
            onChange={(e) => {
              setTask_Difficulty(Number(e.target.value));
            }}
            fullWidth
          >
            {numbers.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </div>

      {/* Footer / Button */}
      <div className="mt-4 flex justify-end">
        <Button
          onClick={handleCreate}
          variant="contained"
          size="small"
          disabled={isCreateDisabled}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
