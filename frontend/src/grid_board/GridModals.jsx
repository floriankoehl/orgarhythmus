import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect, useCallback } from 'react';

/**
 * GridModals – all modal dialogs for the generic grid board.
 *
 * Generic port of DependencyModals – domain terms replaced:
 *   day → column, team → lane, task → row, milestone → node,
 *   dependency/connection → edge
 *
 * Navigation-specific modals (Create Lane / Create Row) keep semantically
 * neutral labels. The adapter can override button labels via props if needed.
 */

// ── Hook: Enter/Escape key handler for modals ──
function useModalKeys(isOpen, onConfirm, onCancel) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (onConfirm) onConfirm();
        return;
      }
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

export default function GridModals({
  // Column Purpose Modal
  columnPurposeModal,
  setColumnPurposeModal,
  columnLabels,
  newColumnPurpose,
  setNewColumnPurpose,
  newColumnPurposeLanes,
  setNewColumnPurposeLanes,
  handleSaveColumnPurpose,
  handleClearColumnPurpose,
  laneOrder,
  allLanes,
  // Create Lane Modal
  showCreateLaneModal,
  setShowCreateLaneModal,
  newLaneName,
  setNewLaneName,
  newLaneColor,
  setNewLaneColor,
  isCreating,
  handleCreateLane,
  // Create Row Modal
  showCreateRowModal,
  setShowCreateRowModal,
  newRowName,
  setNewRowName,
  newRowLaneId,
  setNewRowLaneId,
  lanes,
  handleCreateRow,
  // Move Modal
  moveModal,
  setMoveModal,
  handleConfirmMove,
  // Node Create Modal
  nodeCreateModal,
  setNodeCreateModal,
  rows,
  confirmNodeCreate,
  // Delete Confirm Modal
  deleteConfirmModal,
  setDeleteConfirmModal,
  handleConfirmDelete,
  // Weak edge conflict modal
  weakEdgeModal,
  setWeakEdgeModal,
  handleWeakEdgeConvert,
  handleWeakEdgeBlock,
  // Edge edit modal
  edgeEditModal,
  setEdgeEditModal,
  handleUpdateEdge,
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
  totalColumns,
  // Phase extra context
  projectStartDate,
  phases,
  // Custom labels (adapter can override)
  laneLabel = 'Lane',
  rowLabel = 'Row',
  nodeLabel = 'Node',
  edgeLabel = 'Edge',
  columnLabel = 'Column',
}) {
  // ── Enter key handlers for confirmation modals ──
  const confirmCreateLane = useCallback(() => {
    if (newLaneName?.trim() && handleCreateLane) handleCreateLane();
  }, [newLaneName, handleCreateLane]);
  const confirmCreateRow = useCallback(() => {
    if (newRowName?.trim() && newRowLaneId && handleCreateRow) handleCreateRow();
  }, [newRowName, newRowLaneId, handleCreateRow]);

  useModalKeys(!!showCreateLaneModal, confirmCreateLane, () => { setShowCreateLaneModal(false); setNewLaneName(""); setNewLaneColor("#facc15"); });
  useModalKeys(!!showCreateRowModal, confirmCreateRow, () => { setShowCreateRowModal(false); setNewRowName(""); setNewRowLaneId(null); });
  useModalKeys(!!moveModal, handleConfirmMove, () => setMoveModal(null));
  useModalKeys(!!nodeCreateModal, confirmNodeCreate, () => setNodeCreateModal(null));
  useModalKeys(!!deleteConfirmModal, handleConfirmDelete, () => setDeleteConfirmModal(null));
  useModalKeys(!!weakEdgeModal, () => { if (handleWeakEdgeConvert) handleWeakEdgeConvert(weakEdgeModal); setWeakEdgeModal(null); }, () => setWeakEdgeModal(null));
  useModalKeys(!!suggestionOfferModal, handleSuggestionOfferAccept, () => setSuggestionOfferModal(null));

  return (
    <>
      {/* Column Purpose Modal */}
      {columnPurposeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Set {columnLabel} Purpose
              </h2>
              <button
                onClick={() => setColumnPurposeModal(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              {columnLabel} {columnPurposeModal.columnIndex + 1} - {columnLabels[columnPurposeModal.columnIndex]?.dateStr}
              {columnLabels[columnPurposeModal.columnIndex]?.isSunday && (
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Sunday</span>
              )}
            </p>

            <input
              type="text"
              value={newColumnPurpose}
              onChange={(e) => setNewColumnPurpose(e.target.value)}
              placeholder="e.g., Meeting, Sprint Review, Holiday..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveColumnPurpose();
                if (e.key === 'Escape') setColumnPurposeModal(null);
              }}
            />

            {/* Lane scope selector */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Applies to</h4>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2 py-1 rounded hover:bg-slate-50">
                  <input
                    type="radio"
                    name="purposeScope"
                    checked={newColumnPurposeLanes === null}
                    onChange={() => setNewColumnPurposeLanes(null)}
                    className="text-blue-600"
                  />
                  <span className="font-medium">All {laneLabel}s</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer px-2 py-1 rounded hover:bg-slate-50">
                  <input
                    type="radio"
                    name="purposeScope"
                    checked={newColumnPurposeLanes !== null}
                    onChange={() => setNewColumnPurposeLanes([])}
                    className="text-blue-600"
                  />
                  <span className="font-medium">Specific {laneLabel}s</span>
                </label>
              </div>

              {newColumnPurposeLanes !== null && (
                <div className="mt-2 ml-6 space-y-1 max-h-36 overflow-y-auto border border-slate-100 rounded-lg p-2">
                  {laneOrder && laneOrder.length > 0 ? laneOrder.filter(lid => !allLanes?.[lid]?._virtual).map((laneId) => {
                    const lane = allLanes?.[laneId];
                    if (!lane) return null;
                    const isSelected = newColumnPurposeLanes.includes(laneId);
                    return (
                      <label
                        key={laneId}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setNewColumnPurposeLanes(prev =>
                              isSelected
                                ? prev.filter(id => id !== laneId)
                                : [...prev, laneId]
                            );
                          }}
                          className="rounded border-slate-300"
                        />
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: lane.color || '#94a3b8' }}
                        />
                        <span className="text-xs text-slate-700 truncate">{lane.name}</span>
                      </label>
                    );
                  }) : (
                    <p className="text-xs text-slate-400 italic px-2">No {laneLabel.toLowerCase()}s available</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3">
              <button
                onClick={handleClearColumnPurpose}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                disabled={!columnPurposeModal.currentPurpose}
              >
                Clear Purpose
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setColumnPurposeModal(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveColumnPurpose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  disabled={newColumnPurposeLanes !== null && newColumnPurposeLanes.length === 0}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Lane Modal */}
      {showCreateLaneModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New {laneLabel}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{laneLabel} Name</label>
                <input
                  type="text"
                  value={newLaneName}
                  onChange={(e) => setNewLaneName(e.target.value)}
                  placeholder={`Enter ${laneLabel.toLowerCase()} name...`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{laneLabel} Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newLaneColor}
                    onChange={(e) => setNewLaneColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-slate-200"
                  />
                  <span className="text-sm text-slate-500">{newLaneColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateLaneModal(false);
                  setNewLaneName("");
                  setNewLaneColor("#facc15");
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLane}
                disabled={!newLaneName.trim() || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : `Create ${laneLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Row Modal */}
      {showCreateRowModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New {rowLabel}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{rowLabel} Name</label>
                <input
                  type="text"
                  value={newRowName}
                  onChange={(e) => setNewRowName(e.target.value)}
                  placeholder={`Enter ${rowLabel.toLowerCase()} name...`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign to {laneLabel}</label>
                <select
                  value={newRowLaneId || ""}
                  onChange={(e) => setNewRowLaneId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a {laneLabel.toLowerCase()}...</option>
                  {Object.entries(lanes).filter(([, l]) => !l._virtual).map(([laneId, lane]) => (
                    <option key={laneId} value={laneId}>
                      {lane.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateRowModal(false);
                  setNewRowName("");
                  setNewRowLaneId(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRow}
                disabled={!newRowName.trim() || !newRowLaneId || isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : `Create ${rowLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Lane Move Confirmation Modal */}
      {moveModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Move {rowLabel} to Different {laneLabel}?</h2>
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
                Move {rowLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Node Creation Confirmation Modal */}
      {nodeCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Create {nodeLabel}?</h2>
            <p className="text-sm text-slate-600 mb-4">
              Create a new {nodeLabel.toLowerCase()} on <strong>{columnLabel} {nodeCreateModal.columnIndex + 1}</strong> for {rowLabel.toLowerCase()}{" "}
              <span className="font-medium text-slate-800">
                "{rows[nodeCreateModal.rowId]?.name || 'Unknown'}"
              </span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setNodeCreateModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmNodeCreate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Create {nodeLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Node/Edge Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Delete {deleteConfirmModal.edgeId
                ? (deleteConfirmModal.edges?.length > 1 ? `${edgeLabel}s` : edgeLabel)
                : deleteConfirmModal.nodeIds ? `${nodeLabel}s` : nodeLabel}?
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-800">
                {deleteConfirmModal.edgeId
                  ? (deleteConfirmModal.edges?.length > 1 ? `${deleteConfirmModal.edges.length} ${edgeLabel.toLowerCase()}s` : deleteConfirmModal.edgeName)
                  : deleteConfirmModal.nodeIds
                    ? `${deleteConfirmModal.nodeIds.length} ${nodeLabel.toLowerCase()}s`
                    : `"${deleteConfirmModal.nodeName}"`
                }
              </span>?{!deleteConfirmModal.edgeId && ` This will also remove any ${edgeLabel.toLowerCase()}s connected to ${deleteConfirmModal.nodeIds ? 'them' : 'it'}.`}
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

      {/* Weak Edge Conflict Modal */}
      {weakEdgeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-amber-900">
                Weak {edgeLabel} Conflict
              </h2>
              <button
                onClick={() => setWeakEdgeModal(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              This {weakEdgeModal.type === 'resize' ? 'resize' : 'move'} violates <strong>{weakEdgeModal.weakConnections?.length || 0}</strong> weak {edgeLabel.toLowerCase()}{(weakEdgeModal.weakConnections?.length || 0) > 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              You can either <strong>convert them to suggestions</strong> (allows the {weakEdgeModal.type === 'resize' ? 'resize' : 'move'} and downgrades the {edgeLabel.toLowerCase()}) or <strong>block the {weakEdgeModal.type === 'resize' ? 'resize' : 'move'}</strong>.
            </p>
            {weakEdgeModal.suggestionBlocking?.length > 0 && (
              <p className="text-xs text-slate-500 mb-4">
                Additionally, {weakEdgeModal.suggestionBlocking.length} suggestion {edgeLabel.toLowerCase()}{weakEdgeModal.suggestionBlocking.length > 1 ? 's' : ''} will be violated (allowed).
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (handleWeakEdgeBlock) handleWeakEdgeBlock(weakEdgeModal);
                  else setWeakEdgeModal(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Block {weakEdgeModal.type === 'resize' ? 'Resize' : 'Move'}
              </button>
              <button
                onClick={() => {
                  if (handleWeakEdgeConvert) handleWeakEdgeConvert(weakEdgeModal);
                  setWeakEdgeModal(null);
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
              The source {nodeLabel.toLowerCase()} doesn't finish before the target starts, so a strong or weak {edgeLabel.toLowerCase()} can't be created. Would you like to create it as a <span className="font-semibold text-blue-700">suggestion</span> instead?
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Suggestion {edgeLabel.toLowerCase()}s warn about violations but don't block moves.
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
        totalColumns={totalColumns}
        projectStartDate={projectStartDate}
        laneOrder={laneOrder}
        allLanes={allLanes}
        phases={phases}
        laneLabel={laneLabel}
        columnLabel={columnLabel}
      />

      {/* Edge Edit Modal */}
      <EdgeEditModal
        edgeEditModal={edgeEditModal}
        setEdgeEditModal={setEdgeEditModal}
        handleUpdateEdge={handleUpdateEdge}
        edgeLabel={edgeLabel}
      />
    </>
  );
}

function EdgeEditModal({ edgeEditModal, setEdgeEditModal, handleUpdateEdge, edgeLabel = 'Edge' }) {
  const [editWeight, setEditWeight] = useState('strong');
  const [editReason, setEditReason] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (edgeEditModal) {
      setEditWeight(edgeEditModal.weight || 'strong');
      setEditReason(edgeEditModal.reason || '');
      setEditDescription(edgeEditModal.description || '');
    }
  }, [edgeEditModal]);

  if (!edgeEditModal) return null;

  const handleSave = async () => {
    if (handleUpdateEdge) {
      const result = await handleUpdateEdge(
        edgeEditModal,
        { weight: editWeight, reason: editReason || null, description: editDescription || null }
      );
      if (result === false) return;
    }
    setEdgeEditModal(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full mx-4 modal-animate-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit {edgeLabel}
          </h2>
          <button
            onClick={() => setEdgeEditModal(null)}
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

        {/* Description text */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description <span className="text-slate-400 font-normal">(optional, detailed explanation)</span>
          </label>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Detailed explanation of why this edge exists…"
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
          />
          {editDescription && (
            <button
              onClick={() => setEditDescription('')}
              className="text-[10px] text-red-500 hover:underline mt-1"
            >
              Clear description
            </button>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setEdgeEditModal(null)}
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

function PhaseEditModal({ phaseEditModal, setPhaseEditModal, handleCreatePhase, handleUpdatePhase, handleDeletePhase, totalColumns, projectStartDate, laneOrder, allLanes, phases, laneLabel = 'Lane', columnLabel = 'Column' }) {
  const [name, setName] = useState('');
  const [startIndex, setStartIndex] = useState(0);
  const [duration, setDuration] = useState(7);
  const [color, setColor] = useState('#3b82f6');
  const [laneId, setLaneId] = useState(null);
  const [overlapWarning, setOverlapWarning] = useState('');

  const indexToDateStr = (idx) => {
    if (!projectStartDate) return '';
    const d = new Date(projectStartDate);
    d.setDate(d.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const dateStrToIndex = (dateStr) => {
    if (!projectStartDate || !dateStr) return 0;
    const start = new Date(projectStartDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffMs = target - start;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const indexToDisplayDate = (idx) => {
    if (!projectStartDate) return `${columnLabel} ${idx + 1}`;
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
      setLaneId(phaseEditModal.team ?? null);
      setOverlapWarning('');
    }
  }, [phaseEditModal]);

  useEffect(() => {
    if (!phaseEditModal || !phases) { setOverlapWarning(''); return; }
    const endIndex = startIndex + duration;
    const isEdit = phaseEditModal.mode === 'edit';
    const currentId = isEdit ? phaseEditModal.id : null;

    const candidates = phases.filter(p => {
      if (currentId && p.id === currentId) return false;
      if (laneId === null) {
        return p.team === null || p.team === undefined;
      } else {
        return p.team === laneId;
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
  }, [startIndex, duration, laneId, phases, phaseEditModal]);

  if (!phaseEditModal) return null;

  const isEdit = phaseEditModal.mode === 'edit';

  const handleSave = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), start_index: startIndex, duration, color, team: laneId };
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
                    const clamped = Math.max(0, Math.min((totalColumns || 365) - 1, idx));
                    setStartIndex(clamped);
                  }}
                  min={indexToDateStr(0)}
                  max={indexToDateStr((totalColumns || 365) - 1)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <input
                  type="number"
                  value={startIndex + 1}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setStartIndex(Math.max(0, Math.min((totalColumns || 365) - 1, v - 1)));
                  }}
                  min={1}
                  max={totalColumns || 365}
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
                  max={indexToDateStr((totalColumns || 365) - 1)}
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

          {/* Lane assignment */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
            <select
              value={laneId ?? ''}
              onChange={(e) => setLaneId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All {laneLabel}s (global phase)</option>
              {laneOrder && laneOrder.map((lid) => {
                const lane = allLanes?.[lid];
                if (!lane || lane._virtual) return null;
                return (
                  <option key={lid} value={lid}>
                    {lane.name}
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
              {indexToDisplayDate(startIndex)} – {indexToDisplayDate(startIndex + duration - 1)} ({duration} {columnLabel.toLowerCase()}{duration !== 1 ? 's' : ''})
              {laneId !== null && allLanes?.[laneId]
                ? ` · ${allLanes[laneId].name}`
                : ` · All ${laneLabel}s`
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
