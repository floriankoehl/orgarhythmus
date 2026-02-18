import CloseIcon from '@mui/icons-material/Close';

export default function DependencyModals({
  // Day Purpose Modal
  dayPurposeModal,
  setDayPurposeModal,
  dayLabels,
  newDayPurpose,
  setNewDayPurpose,
  newDayPurposeTeams,
  setNewDayPurposeTeams,
  handleSaveDayPurpose,
  handleClearDayPurpose,
  teamOrder,
  allTeams,
  // Create Team Modal
  showCreateTeamModal,
  setShowCreateTeamModal,
  newTeamName,
  setNewTeamName,
  newTeamColor,
  setNewTeamColor,
  isCreating,
  handleCreateTeam,
  // Create Task Modal
  showCreateTaskModal,
  setShowCreateTaskModal,
  newTaskName,
  setNewTaskName,
  newTaskTeamId,
  setNewTaskTeamId,
  teams,
  handleCreateTask,
  // Move Modal
  moveModal,
  setMoveModal,
  handleConfirmMove,
  // Milestone Create Modal
  milestoneCreateModal,
  setMilestoneCreateModal,
  tasks,
  confirmMilestoneCreate,
  // Delete Confirm Modal
  deleteConfirmModal,
  setDeleteConfirmModal,
  handleConfirmDelete,
}) {
  return (
    <>
      {/* Day Purpose Modal */}
      {dayPurposeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Set Day Purpose
              </h2>
              <button
                onClick={() => setDayPurposeModal(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              Day {dayPurposeModal.dayIndex + 1} - {dayLabels[dayPurposeModal.dayIndex]?.dateStr}
              {dayLabels[dayPurposeModal.dayIndex]?.isSunday && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Sunday</span>
              )}
            </p>
            
            <input
              type="text"
              value={newDayPurpose}
              onChange={(e) => setNewDayPurpose(e.target.value)}
              placeholder="e.g., Meeting, Sprint Review, Holiday..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveDayPurpose();
                if (e.key === 'Escape') setDayPurposeModal(null);
              }}
            />

            {/* Team scope selector */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Applies to</h4>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2 py-1 rounded hover:bg-slate-50">
                  <input
                    type="radio"
                    name="purposeScope"
                    checked={newDayPurposeTeams === null}
                    onChange={() => setNewDayPurposeTeams(null)}
                    className="text-blue-600"
                  />
                  <span className="font-medium">All Teams</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2 py-1 rounded hover:bg-slate-50">
                  <input
                    type="radio"
                    name="purposeScope"
                    checked={newDayPurposeTeams !== null}
                    onChange={() => setNewDayPurposeTeams([])}
                    className="text-blue-600"
                  />
                  <span className="font-medium">Specific Teams</span>
                </label>
              </div>
              
              {newDayPurposeTeams !== null && (
                <div className="mt-2 ml-6 space-y-1 max-h-36 overflow-y-auto border border-slate-100 rounded-lg p-2">
                  {teamOrder && teamOrder.length > 0 ? teamOrder.filter(tid => !allTeams?.[tid]?._virtual).map((teamId) => {
                    const team = allTeams?.[teamId];
                    if (!team) return null;
                    const isSelected = newDayPurposeTeams.includes(teamId);
                    return (
                      <label
                        key={teamId}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setNewDayPurposeTeams(prev => 
                              isSelected 
                                ? prev.filter(id => id !== teamId)
                                : [...prev, teamId]
                            );
                          }}
                          className="rounded border-slate-300"
                        />
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color || '#94a3b8' }}
                        />
                        <span className="text-xs text-slate-700 truncate">{team.name}</span>
                      </label>
                    );
                  }) : (
                    <p className="text-xs text-slate-400 italic px-2">No teams available</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-between gap-3">
              <button
                onClick={handleClearDayPurpose}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                disabled={!dayPurposeModal.currentPurpose}
              >
                Clear Purpose
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setDayPurposeModal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDayPurpose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  disabled={newDayPurposeTeams !== null && newDayPurposeTeams.length === 0}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Team</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-slate-200"
                  />
                  <span className="text-sm text-slate-500">{newTeamColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTeamModal(false);
                  setNewTeamName("");
                  setNewTeamColor("#facc15");
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Task</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="Enter task name..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Team</label>
                <select
                  value={newTaskTeamId || ""}
                  onChange={(e) => setNewTaskTeamId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a team...</option>
                  {Object.entries(teams).filter(([, t]) => !t._virtual).map(([teamId, team]) => (
                    <option key={teamId} value={teamId}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateTaskModal(false);
                  setNewTaskName("");
                  setNewTaskTeamId(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTaskName.trim() || !newTaskTeamId || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Team Move Confirmation Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Move Task to Different Team?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to move <strong>"{moveModal.taskName}"</strong> from{" "}
              <span className="font-medium text-slate-800">{moveModal.sourceTeamName}</span> to{" "}
              <span className="font-medium text-slate-800">{moveModal.targetTeamName}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMoveModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMove}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Move Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Creation Confirmation Modal */}
      {milestoneCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Milestone?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Create a new milestone on <strong>Day {milestoneCreateModal.dayIndex + 1}</strong> for task{" "}
              <span className="font-medium text-slate-800">
                "{tasks[milestoneCreateModal.taskId]?.name || 'Unknown'}"
              </span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMilestoneCreateModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMilestoneCreate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Create Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone/Connection Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Delete {deleteConfirmModal.connectionId ? 'Connection' : deleteConfirmModal.milestoneIds ? 'Milestones' : 'Milestone'}?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-800">
                {deleteConfirmModal.connectionId
                  ? deleteConfirmModal.connectionName
                  : deleteConfirmModal.milestoneIds 
                    ? `${deleteConfirmModal.milestoneIds.length} milestones`
                    : `"${deleteConfirmModal.milestoneName}"`
                }
              </span>?{!deleteConfirmModal.connectionId && ` This will also remove any dependencies connected to ${deleteConfirmModal.milestoneIds ? 'them' : 'it'}.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}