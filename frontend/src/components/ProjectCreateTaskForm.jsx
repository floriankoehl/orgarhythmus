

import { useState } from "react";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import { createTaskForProject } from "../orgarhythmus/api/org_API";

const numbers = [1, 2, 3, 4, 5];

export default function ProjectCreateTaskForm({
  projectId,
  teams,
  onCreated,
}) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [teamId, setTeamId] = useState("");
  const [approval, setApproval] = useState(false); // falls du das später nutzt

  const isCreateDisabled =
    !name.trim() || priority === 0 || difficulty === 0;

  async function handleCreate() {
    if (isCreateDisabled) return;

    await createTaskForProject(projectId, {
      name,
      priority,
      difficulty,
      approval,
      team_id: teamId || null,
      // wenn du „Events“ im Backend markieren willst:
      // type: "event",
    });

    if (onCreated) onCreated();

    setName("");
    setPriority(0);
    setDifficulty(0);
    setTeamId("");
  }

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
          Create Project Task
        </h1>

        {/* Name */}
        <TextField
          value={name}
          onChange={(e) => setName(e.target.value)}
          id="project-task-name"
          label="Task name (event)"
          variant="outlined"
          size="small"
          fullWidth
        />

        {/* Team (nur Teams dieses Projekts) */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Team</span>
          <Select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ width: "100%" }}
          >
            <MenuItem value="">
              <em>No team</em>
            </MenuItem>

            {teams.map((team) => (
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
            value={priority}
            sx={{ minWidth: 120, flex: 1 }}
            onChange={(e) => setPriority(Number(e.target.value))}
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
            value={difficulty}
            sx={{ minWidth: 120, flex: 1 }}
            onChange={(e) => setDifficulty(Number(e.target.value))}
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
