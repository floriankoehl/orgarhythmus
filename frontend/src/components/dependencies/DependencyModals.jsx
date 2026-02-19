import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect, useCallback } from 'react';

// ── Hook: Enter/Escape key handler for modals ──
function useModalKeys(isOpen, onConfirm, onCancel) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      // Allow Enter from INPUT/SELECT (user is typing a name, Enter confirms).
      // Skip Enter only from TEXTAREA (multi-line input).
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (onConfirm) onConfirm();
        return;
      }
      // Escape always works regardless of focus
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCancel) onCancel();
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onConfirm, onCancel]);
}

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
  // Phase modal
  phaseEditModal,
  setPhaseEditModal,
  handleCreatePhase,
  handleUpdatePhase,
  handleDeletePhase,
  days,
  // Phase extra context
  projectStartDate,
  phases,
}) {
  // ── Enter key handlers for confirmation modals ──
  const confirmCreateTeam = useCallback(() => {
    if (newTeamName?.trim() && handleCreateTeam) handleCreateTeam();
  }, [newTeamName, handleCreateTeam]);
  const confirmCreateTask = useCallback(() => {
    if (newTaskName?.trim() && newTaskTeamId && handleCreateTask) handleCreateTask();
  }, [newTaskName, newTaskTeamId, handleCreateTask]);

  useModalKeys(!!showCreateTeamModal, confirmCreateTeam, () => { setShowCreateTeamModal(false); setNewTeamName(""); setNewTeamColor("#facc15"); });
  useModalKeys(!!showCreateTaskModal, confirmCreateTask, () => { setShowCreateTaskModal(false); setNewTaskName(""); setNewTaskTeamId(null); });
  useModalKeys(!!moveModal, handleConfirmMove, () => setMoveModal(null));
  useModalKeys(!!milestoneCreateModal, confirmMilestoneCreate, () => setMilestoneCreateModal(null));
  useModalKeys(!!deleteConfirmModal, handleConfirmDelete, () => setDeleteConfirmModal(null));
  useModalKeys(!!weakDepModal, () => { if (handleWeakDepConvert) handleWeakDepConvert(weakDepModal); setWeakDepModal(null); }, () => setWeakDepModal(null));
  useModalKeys(!!suggestionOfferModal, handleSuggestionOfferAccept, () => setSuggestionOfferModal(null));

  return (
    <>
      {/* Day Purpose Modal */}
      {dayPurposeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Delete {deleteConfirmModal.connectionId ? (deleteConfirmModal.connections?.length > 1 ? 'Connections' : 'Connection') : deleteConfirmModal.milestoneIds ? 'Milestones' : 'Milestone'}?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-800">
                {deleteConfirmModal.connectionId
                  ? (deleteConfirmModal.connections?.length > 1 ? `${deleteConfirmModal.connections.length} dependencies` : deleteConfirmModal.connectionName)
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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
              This {weakDepModal.type === 'resize' ? 'resize' : 'move'} violates <strong>{weakDepModal.weakConnections?.length || 0}</strong> weak dependency connection{(weakDepModal.weakConnections?.length || 0) > 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              You can either <strong>convert them to suggestions</strong> (allows the {weakDepModal.type === 'resize' ? 'resize' : 'move'} and downgrades the dependency) or <strong>block the {weakDepModal.type === 'resize' ? 'resize' : 'move'}</strong>.
            </p>
            {weakDepModal.suggestionBlocking?.length > 0 && (
              <p className="text-xs text-slate-500 mb-4">
                Additionally, {weakDepModal.suggestionBlocking.length} suggestion dependency connection{weakDepModal.suggestionBlocking.length > 1 ? 's' : ''} will be violated (allowed).
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (handleWeakDepBlock) handleWeakDepBlock(weakDepModal);
                  else setWeakDepModal(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Block {weakDepModal.type === 'resize' ? 'Resize' : 'Move'}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-sm w-full mx-4 modal-animate-in">
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

      {/* Phase Edit Modal */}
      <PhaseEditModal
        phaseEditModal={phaseEditModal}
        setPhaseEditModal={setPhaseEditModal}
        handleCreatePhase={handleCreatePhase}
        handleUpdatePhase={handleUpdatePhase}
        handleDeletePhase={handleDeletePhase}
        days={days}
        projectStartDate={projectStartDate}
        teamOrder={teamOrder}
        allTeams={allTeams}
        phases={phases}
      />

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
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

// ── Phase Create/Edit Modal ──
const PHASE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#f97316'];

function PhaseEditModal({ phaseEditModal, setPhaseEditModal, handleCreatePhase, handleUpdatePhase, handleDeletePhase, days, projectStartDate, teamOrder, allTeams, phases }) {
  const [name, setName] = useState('');
  const [startIndex, setStartIndex] = useState(0);
  const [duration, setDuration] = useState(7);
  const [color, setColor] = useState('#3b82f6');
  const [teamId, setTeamId] = useState(null); // null = all teams
  const [overlapWarning, setOverlapWarning] = useState('');

  // Helper: convert day index to date string (YYYY-MM-DD) for date inputs
  const indexToDateStr = (idx) => {
    if (!projectStartDate) return '';
    const d = new Date(projectStartDate);
    d.setDate(d.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper: convert date string to day index
  const dateStrToIndex = (dateStr) => {
    if (!projectStartDate || !dateStr) return 0;
    const start = new Date(projectStartDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffMs = target - start;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  // Helper: format index to a display date (DD.MM)
  const indexToDisplayDate = (idx) => {
    if (!projectStartDate) return `Day ${idx + 1}`;
    const d = new Date(projectStartDate);
    d.setDate(d.getDate() + idx);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };

  useEffect(() => {
    if (phaseEditModal) {
      setName(phaseEditModal.name || '');
      setStartIndex(phaseEditModal.start_index ?? 0);
      setDuration(phaseEditModal.duration ?? 7);
      setColor(phaseEditModal.color || '#3b82f6');
      setTeamId(phaseEditModal.team ?? null);
      setOverlapWarning('');
    }
  }, [phaseEditModal]);

  // Check overlap whenever start/duration/team changes
  useEffect(() => {
    if (!phaseEditModal || !phases) { setOverlapWarning(''); return; }
    const endIndex = startIndex + duration;
    const isEdit = phaseEditModal.mode === 'edit';
    const currentId = isEdit ? phaseEditModal.id : null;

    // Filter candidates: same scope (global↔global, or same team↔same team)
    const candidates = phases.filter(p => {
      if (currentId && p.id === currentId) return false;
      if (teamId === null) {
        return p.team === null || p.team === undefined;
      } else {
        return p.team === teamId;
      }
    });

    const overlapping = candidates.filter(p => {
      return startIndex < p.start_index + p.duration && p.start_index < endIndex;
    });

    if (overlapping.length > 0) {
      setOverlapWarning(`Overlaps with: ${overlapping.map(p => p.name).join(', ')}`);
    } else {
      setOverlapWarning('');
    }
  }, [startIndex, duration, teamId, phases, phaseEditModal]);

  if (!phaseEditModal) return null;

  const isEdit = phaseEditModal.mode === 'edit';

  const handleSave = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), start_index: startIndex, duration, color, team: teamId };
    if (isEdit) {
      handleUpdatePhase(phaseEditModal.id, data);
    } else {
      handleCreatePhase(data);
    }
  };

  const startDateStr = indexToDateStr(startIndex);
  const endDateStr = indexToDateStr(startIndex + duration - 1);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Edit Phase' : 'Create Phase'}
          </h2>
          <button
            onClick={() => setPhaseEditModal(null)}
            className="p-1 rounded hover:bg-slate-100"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phase Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint 1, Planning, Delivery..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !overlapWarning) handleSave();
                if (e.key === 'Escape') setPhaseEditModal(null);
              }}
            />
          </div>

          {/* Date pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
              {projectStartDate ? (
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => {
                    const idx = dateStrToIndex(e.target.value);
                    const clamped = Math.max(0, Math.min((days || 365) - 1, idx));
                    setStartIndex(clamped);
                  }}
                  min={indexToDateStr(0)}
                  max={indexToDateStr((days || 365) - 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <input
                  type="number"
                  value={startIndex + 1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setStartIndex(Math.max(0, Math.min((days || 365) - 1, v - 1)));
                  }}
                  min={1}
                  max={days || 365}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
              {projectStartDate ? (
                <input
                  type="date"
                  value={endDateStr}
                  onChange={(e) => {
                    const endIdx = dateStrToIndex(e.target.value);
                    const newDuration = endIdx - startIndex + 1;
                    setDuration(Math.max(1, newDuration));
                  }}
                  min={indexToDateStr(startIndex)}
                  max={indexToDateStr((days || 365) - 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  min={1}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}
            </div>
          </div>

          {/* Team assignment */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
            <select
              value={teamId ?? ''}
              onChange={(e) => setTeamId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Teams (global phase)</option>
              {teamOrder && teamOrder.map((tid) => {
                const team = allTeams?.[tid];
                if (!team || team._virtual) return null;
                return (
                  <option key={tid} value={tid}>
                    {team.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PHASE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-slate-900 scale-110 shadow' : 'border-transparent hover:border-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-slate-200"
                title="Pick custom color"
              />
            </div>
          </div>

          {/* Overlap warning */}
          {overlapWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">&#9888;</span>
              <span className="text-xs text-amber-800">{overlapWarning}</span>
            </div>
          )}

          {/* Preview */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[10px] text-slate-400 mb-1">Preview</div>
            <div
              className="h-6 rounded text-white text-xs font-semibold flex items-center justify-center truncate px-2"
              style={{ backgroundColor: color, maxWidth: '100%' }}
            >
              {name || 'Phase Name'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {indexToDisplayDate(startIndex)} – {indexToDisplayDate(startIndex + duration - 1)} ({duration} day{duration !== 1 ? 's' : ''})
              {teamId !== null && allTeams?.[teamId]
                ? ` · ${allTeams[teamId].name}`
                : ' · All Teams'
              }
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <div>
            {isEdit && (
              <button
                onClick={() => handleDeletePhase(phaseEditModal.id)}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPhaseEditModal(null)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !!overlapWarning}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}