import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect } from 'react';

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
  // Weak dep conflict modal
  weakDepModal,
  setWeakDepModal,
  handleWeakDepConvert,
  handleWeakDepBlock,
  // Connection edit modal
  connectionEditModal,
  setConnectionEditModal,
  handleUpdateConnection,
  // Suggestion offer modal
  suggestionOfferModal,
  setSuggestionOfferModal,
  handleSuggestionOfferAccept,
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

      {/* Weak Dependency Conflict Modal */}
      {weakDepModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-900">
                Weak Dependency Conflict
              </h2>
              <button
                onClick={() => setWeakDepModal(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              This move violates <strong>{weakDepModal.weakConnections?.length || 0}</strong> weak dependency connection{(weakDepModal.weakConnections?.length || 0) > 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              You can either <strong>convert them to suggestions</strong> (allows the move and downgrades the dependency) or <strong>block the move</strong>.
            </p>
            {weakDepModal.suggestionBlocking?.length > 0 && (
              <p className="text-xs text-slate-500 mb-4">
                Additionally, {weakDepModal.suggestionBlocking.length} suggestion dependency connection{weakDepModal.suggestionBlocking.length > 1 ? 's' : ''} will be violated (allowed).
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (handleWeakDepBlock) handleWeakDepBlock();
                  setWeakDepModal(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Block Move
              </button>
              <button
                onClick={() => {
                  if (handleWeakDepConvert) handleWeakDepConvert(weakDepModal);
                  setWeakDepModal(null);
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
              >
                Convert to Suggestions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Offer Modal */}
      {suggestionOfferModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Timing Constraint Violated
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              The source milestone doesn't finish before the target starts, so a strong or weak dependency can't be created. Would you like to create it as a <span className="font-semibold text-blue-700">suggestion</span> instead?
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Suggestion dependencies warn about violations but don't block moves.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSuggestionOfferModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSuggestionOfferAccept}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Create as Suggestion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Edit Modal */}
      <ConnectionEditModal
        connectionEditModal={connectionEditModal}
        setConnectionEditModal={setConnectionEditModal}
        handleUpdateConnection={handleUpdateConnection}
      />
    </>
  );
}

function ConnectionEditModal({ connectionEditModal, setConnectionEditModal, handleUpdateConnection }) {
  const [editWeight, setEditWeight] = useState('strong');
  const [editReason, setEditReason] = useState('');

  // Sync local state when modal opens/changes
  useEffect(() => {
    if (connectionEditModal) {
      setEditWeight(connectionEditModal.weight || 'strong');
      setEditReason(connectionEditModal.reason || '');
    }
  }, [connectionEditModal]);

  if (!connectionEditModal) return null;

  const handleSave = async () => {
    if (handleUpdateConnection) {
      const result = await handleUpdateConnection(
        connectionEditModal,
        { weight: editWeight, reason: editReason || null }
      );
      if (result === false) return; // validation failed — keep modal open
    }
    setConnectionEditModal(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit Dependency
          </h2>
          <button
            onClick={() => setConnectionEditModal(null)}
            className="p-1 rounded hover:bg-slate-100"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Weight selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Weight</label>
          <div className="flex gap-2">
            {[
              { value: 'strong', label: 'Strong', color: 'bg-red-100 text-red-800 border-red-300', desc: 'Blocks moves' },
              { value: 'weak', label: 'Weak', color: 'bg-amber-100 text-amber-800 border-amber-300', desc: 'Asks to convert' },
              { value: 'suggestion', label: 'Suggestion', color: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'Warns only' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setEditWeight(opt.value)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition ${
                  editWeight === opt.value
                    ? `${opt.color} ring-2 ring-offset-1 ring-slate-400`
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-[10px] mt-0.5 opacity-75">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Reason text */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Reason <span className="text-slate-400 font-normal">(shown on path)</span>
          </label>
          <input
            type="text"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="is necessary for"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          {editReason && (
            <button
              onClick={() => setEditReason('')}
              className="text-[10px] text-red-500 hover:underline mt-1"
            >
              Clear reason
            </button>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConnectionEditModal(null)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}