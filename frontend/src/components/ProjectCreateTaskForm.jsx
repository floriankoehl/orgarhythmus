

import { useState } from "react";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import { UserPlus, X } from "lucide-react";
import { createTaskForProject } from '../api/org_API.js';

const numbers = [1, 2, 3, 4, 5];

export default function ProjectCreateTaskForm({
  projectId,
  teams,
  projectMembers = [],
  onCreated,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [teamId, setTeamId] = useState("");
  const [approval, setApproval] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const isCreateDisabled = !name.trim();

  function toggleMember(memberId) {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  async function handleCreate() {
    if (isCreateDisabled) return;

    await createTaskForProject(projectId, {
      name,
      description,
      priority,
      difficulty,
      approval,
      team_id: teamId || null,
      assigned_members: selectedMembers,
    });

    if (onCreated) onCreated();

    setName("");
    setDescription("");
    setPriority(3);
    setDifficulty(3);
    setTeamId("");
    setSelectedMembers([]);
  }

  return (
    <div
      className="
        w-full
        rounded-2xl border border-slate-200
        bg-white/80 backdrop-blur-sm
        shadow-sm hover:shadow-md
        transition-shadow duration-150
        px-4 py-5 sm:px-6
      "
    >
      <div className="flex flex-col gap-4">
        <h1 className="mb-2 text-lg sm:text-xl font-semibold text-slate-900">
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

        {/* Description */}
        <TextField
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          id="project-task-description"
          label="Description"
          variant="outlined"
          size="small"
          fullWidth
          multiline
          rows={3}
          placeholder="Add a description for this task..."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label="Priority"
            select
            size="small"
            value={priority}
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

        {/* Assign Members */}
        {projectMembers.length > 0 && (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Assign Members (Optional)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {projectMembers.map((member) => {
                const isSelected = selectedMembers.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {isSelected ? (
                      <X size={14} />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    <span>{member.username}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Button */}
      <div className="mt-6 flex justify-end">
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
