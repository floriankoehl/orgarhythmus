import { Zap } from "lucide-react";

/**
 * Transform-idea modal overlay (Task / Milestone).
 * Rendered absolutely inside the IdeaBin floating window.
 */
export default function IdeaBinTransformModal({
  transformModal, setTransformModal, closeTransform,
  transformName, setTransformName,
  transformTeamId, setTransformTeamId,
  transformTaskId, setTransformTaskId,
  transformTaskSearch, setTransformTaskSearch,
  projectTeams, projectTasks, transformLoading,
  executeTransformToTask, executeTransformToMilestone,
}) {
  if (!transformModal) return null;

  return (
    <>
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={closeTransform} />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[9999] min-w-[260px] max-w-[90%] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-yellow-400 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <Zap size={14} /> Transform Idea
          </span>
          <button onClick={closeTransform} className="text-amber-800 hover:text-amber-950 text-sm font-bold">✕</button>
        </div>

        {/* Idea preview */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-700">{transformModal.idea.title}</p>
          {transformModal.idea.description && (
            <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{transformModal.idea.description}</p>
          )}
        </div>

        <div className="p-4">
          {/* Step: Choose */}
          {transformModal.step === 'choose' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 mb-1">Transform this idea into:</p>
              <button
                onClick={() => setTransformModal(prev => ({ ...prev, step: 'task' }))}
                className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-amber-800">📋 Task</span>
                <p className="text-[10px] text-gray-400 mt-0.5">Create a new task assigned to a team</p>
              </button>
              <button
                onClick={() => { setTransformTeamId(null); setTransformTaskId(null); setTransformModal(prev => ({ ...prev, step: 'milestone' })); }}
                className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-blue-800">🏁 Milestone</span>
                <p className="text-[10px] text-gray-400 mt-0.5">Create a milestone on an existing task</p>
              </button>
            </div>
          )}

          {/* Step: Task */}
          {transformModal.step === 'task' && (
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Task Name</label>
                <input
                  autoFocus
                  value={transformName}
                  onChange={(e) => setTransformName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") closeTransform(); }}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded outline-none focus:border-amber-400"
                  placeholder="Task name..."
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Select Team</label>
                <div className="max-h-[140px] overflow-y-auto border border-gray-200 rounded">
                  {projectTeams.length === 0 && (
                    <p className="text-[10px] text-gray-400 p-2 italic">No teams found...</p>
                  )}
                  {projectTeams.map(team => (
                    <div
                      key={team.id}
                      onClick={() => setTransformTeamId(team.id)}
                      className={`px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
                        transformTeamId === team.id
                          ? "bg-amber-100 text-amber-900 font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      {team.color && (
                        <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300" style={{ backgroundColor: team.color }} />
                      )}
                      {team.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => setTransformModal(prev => ({ ...prev, step: 'choose' }))}
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <button
                  onClick={executeTransformToTask}
                  disabled={!transformName.trim() || !transformTeamId || transformLoading}
                  className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                >
                  {transformLoading ? "Creating..." : "Create Task"}
                </button>
              </div>
            </div>
          )}

          {/* Step: Milestone */}
          {transformModal.step === 'milestone' && (
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Milestone Name</label>
                <input
                  autoFocus
                  value={transformName}
                  onChange={(e) => setTransformName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") closeTransform(); }}
                  className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded outline-none focus:border-blue-400"
                  placeholder="Milestone name..."
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Select Task</label>
                <input
                  value={transformTaskSearch}
                  onChange={(e) => setTransformTaskSearch(e.target.value)}
                  className="w-full text-[10px] px-2 py-1 border border-gray-200 rounded outline-none focus:border-blue-300 mb-1"
                  placeholder="Search tasks..."
                />
                <div className="max-h-[160px] overflow-y-auto border border-gray-200 rounded">
                  {(() => {
                    const filtered = projectTasks.filter(t => {
                      if (!transformTaskSearch) return true;
                      const q = transformTaskSearch.toLowerCase();
                      const teamObj = projectTeams.find(tm => tm.id === (t.team || t.team_id));
                      return (
                        (t.name || '').toLowerCase().includes(q) ||
                        (teamObj?.name || '').toLowerCase().includes(q)
                      );
                    });
                    if (filtered.length === 0) return (
                      <p className="text-[10px] text-gray-400 p-2 italic">No tasks found...</p>
                    );
                    return filtered.map(task => {
                      const teamObj = projectTeams.find(tm => tm.id === (task.team || task.team_id));
                      return (
                        <div
                          key={task.id}
                          onClick={() => setTransformTaskId(task.id)}
                          className={`px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                            transformTaskId === task.id
                              ? "bg-blue-100 text-blue-900 font-medium"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          {teamObj?.color && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamObj.color }} />
                          )}
                          <span>{task.name}</span>
                          {teamObj?.name && <span className="text-[10px] text-gray-400 ml-auto">{teamObj.name}</span>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={() => setTransformModal(prev => ({ ...prev, step: 'choose' }))}
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  ← Back
                </button>
                <button
                  onClick={executeTransformToMilestone}
                  disabled={!transformName.trim() || !transformTaskId || transformLoading}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                >
                  {transformLoading ? "Creating..." : "Create Milestone"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
