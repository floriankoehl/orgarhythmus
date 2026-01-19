import { useState } from "react";
import Button from "@mui/material/Button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { delete_task } from '../api/org_API.js';

export default function SMTaskCard({ projectId, task, onTaskDeleted }) {
  const [showVortakte, setShowVortakte] = useState(false);
  const [showNachtakte, setShowNachtakte] = useState(false);

  async function handleDelete(projectId, task_id) {
    const result = await delete_task(projectId, task_id);
    if (result) {
      onTaskDeleted();
    }
  }

  const hasParents = task.vortakte && task.vortakte.length > 0;
  const hasChildren = task.nachtakte && task.nachtakte.length > 0;

  const teamColor = task.team?.color || "#64748b";
  const teamName = task.team?.name;

  return (
    <div
      className="
        w-full max-w-[360px]
        rounded-xl border
        bg-white shadow-sm hover:shadow-md
        transition-shadow duration-150
        p-3 sm:p-4
        flex flex-col gap-2
        h-full
        relative
      "
      style={{ borderColor: teamColor + "55" }}
    >
      {/* Team color badge in top-right */}
      {teamName && (
        <div className="absolute top-2 right-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm"
            style={{
              backgroundColor: teamColor,
              color: "#ffffff",
            }}
          >
            {teamName}
          </span>
        </div>
      )}

      {/* Title + Team (with small dot) */}
      <div className="flex items-start justify-between gap-2 pr-16">
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
            {task.name}
          </h1>

          {task.team && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: teamColor }}
              />
              <span className="text-xs font-medium text-slate-600">
                {teamName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Meta: Priority & Difficulty */}
      <div className="flex flex-wrap gap-2 mt-1">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          Prio:
          <span className="ml-1 font-semibold">{task.priority}</span>
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          Diff:
          <span className="ml-1 font-semibold">{task.difficulty}</span>
        </span>
      </div>

      {/* Dependencies */}
      <div className="mt-2 space-y-2 text-sm text-slate-800">
        {/* Parents */}
        {hasParents && (
          <div className="rounded-lg bg-slate-50 px-2 py-2">
            <button
              onClick={() => setShowVortakte(!showVortakte)}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-700"
            >
              <span className="flex items-center gap-2">
                {showVortakte ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                Parents ({task.vortakte.length})
              </span>
            </button>
            {showVortakte && (
              <ul className="mt-2 space-y-1">
                {task.vortakte.map((dep) => (
                  <li
                    key={dep.dependency_id}
                    className="text-xs bg-white rounded-md px-2 py-1 flex items-center"
                  >
                    <span className="mr-1 text-slate-400">→</span>
                    <span className="font-medium">{dep.name}</span>
                    {dep.type && (
                      <span className="text-slate-500 ml-1">({dep.type})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Children */}
        {hasChildren && (
          <div className="rounded-lg bg-slate-50 px-2 py-2">
            <button
              onClick={() => setShowNachtakte(!showNachtakte)}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-700"
            >
              <span className="flex items-center gap-2">
                {showNachtakte ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                Children ({task.nachtakte.length})
              </span>
            </button>
            {showNachtakte && (
              <ul className="mt-2 space-y-1">
                {task.nachtakte.map((dep) => (
                  <li
                    key={dep.dependency_id}
                    className="text-xs bg-white rounded-md px-2 py-1 flex items-center"
                  >
                    <span className="mr-1 text-slate-400">→</span>
                    <span className="font-medium">{dep.name}</span>
                    {dep.type && (
                      <span className="text-slate-500 ml-1">({dep.type})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Footer / Delete Button */}
      <div className="mt-auto pt-3 flex justify-end">
        <Button
          onClick={() => handleDelete(projectId, task.id)}
          variant="contained"
          color="error"
          size="small"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
