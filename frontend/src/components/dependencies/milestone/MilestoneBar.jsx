import EditIcon from '@mui/icons-material/Edit';

/**
 * MilestoneBar - Individual milestone rendering component
 * 
 * Renders a single milestone bar with its various interactive elements:
 * - Main bar with name display
 * - Edit/rename functionality
 * - Edge resize handles (schedule mode)
 * - Connection handles (dependency mode)
 */
export default function MilestoneBar({
  milestone,
  task_key,
  tasks,
  team,
  taskHeight,
  taskY,
  milestoneColor,
  msLeft,
  msWidth,
  // UI state
  isSelected,
  isEditing,
  showEdgeResize,
  isBlockedHighlight,
  refactorMode,
  viewMode,
  safeMode,
  selectedMilestones,
  editingMilestoneName,
  // Handlers
  handleMileStoneMouseDown,
  handleMilestoneClick,
  handleRefactorDrag,
  setHoveredMilestone,
  setEditingMilestoneId,
  setEditingMilestoneName,
  handleMilestoneRenameSubmit,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
}) {
  const showConnect = false;

  return (
    <div
      data-milestone
      onMouseDown={(e) => {
        e.stopPropagation();
        if (refactorMode) {
          handleRefactorDrag(e, "milestone", {
            id: milestone.id,
            name: milestone.name,
            description: milestone.description || "",
            color: milestoneColor,
            taskId: task_key,
            taskName: tasks[task_key]?.name || "",
          });
          return;
        }
        if (!isEditing) {
          handleMileStoneMouseDown(e, milestone.id);
        }
      }}
      onClick={(e) => {
        if (!isEditing) {
          handleMilestoneClick(e, milestone.id);
        }
      }}
      onMouseEnter={() => setHoveredMilestone(milestone.id)}
      onMouseLeave={() => setHoveredMilestone(null)}
      className={`absolute rounded cursor-pointer ${
        refactorMode
          ? 'ring-2 ring-orange-400 ring-offset-1'
          : isBlockedHighlight 
            ? 'ring-2 ring-red-500 ring-offset-1 shadow-lg animate-pulse'
            : isSelected 
              ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg' 
              : 'hover:brightness-95'
      }`}
      style={{
        left: `${msLeft}px`,
        top: `${taskY}px`,
        width: `${msWidth}px`,
        height: `${taskHeight - 4}px`,
        backgroundColor: milestoneColor,
        pointerEvents: 'auto',
        zIndex: isSelected ? 25 : 20,
        marginTop: '2px',
      }}
      key={milestone.id}
    >
      {/* Milestone name */}
      <div className="flex items-center h-full px-2 overflow-hidden">
        <span className={`truncate text-xs ${isSelected ? 'text-white' : ''}`}>
          {milestone.name}
        </span>
      </div>

      {/* Edit name icon - shown when selected (single) and not already editing */}
      {isSelected && selectedMilestones.size === 1 && !isEditing && (
        <div
          className="absolute -top-7 left-0 flex items-center gap-1 bg-white rounded shadow-md border border-slate-200 px-1.5 py-0.5 cursor-pointer hover:bg-slate-50 transition"
          style={{ pointerEvents: 'auto', zIndex: 30 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEditingMilestoneId(milestone.id);
            setEditingMilestoneName(milestone.name);
          }}
        >
          <EditIcon style={{ fontSize: 12 }} className="text-slate-500" />
          <span className="text-[10px] text-slate-500">Rename</span>
        </div>
      )}

      {/* Inline rename input - shown above the milestone when editing */}
      {isEditing && (
        <div
          className="absolute -top-8 left-0 z-30"
          style={{ pointerEvents: 'auto', minWidth: '160px' }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={editingMilestoneName}
            onChange={(e) => setEditingMilestoneName(e.target.value)}
            onBlur={() => handleMilestoneRenameSubmit(milestone.id, editingMilestoneName)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                handleMilestoneRenameSubmit(milestone.id, editingMilestoneName);
              }
              if (e.key === 'Escape') {
                setEditingMilestoneId(null);
                setEditingMilestoneName('');
              }
            }}
            className="w-full px-2 py-1 text-xs font-medium bg-white border-2 border-blue-500 rounded shadow-lg outline-none"
          />
        </div>
      )}

      {/* Edge resize handles - only in edit (schedule) mode */}
      {showEdgeResize && (
        <>
          {/* Left edge resize handle */}
          <div
            className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
            style={{ pointerEvents: 'auto', zIndex: 5 }}
            onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "left")}
          />
          {/* Right edge resize handle */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
            style={{ pointerEvents: 'auto', zIndex: 5 }}
            onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "right")}
          />
        </>
      )}

      {/* Connection handles - only in dependency mode */}
      {viewMode === "dependency" && !safeMode && (
        <>
          {/* Target handle (left) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
              showConnect 
                ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
            }`}
            style={{ pointerEvents: 'auto', zIndex: 10 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleConnectionDragStart(e, milestone.id, "target");
            }}
          />
          {/* Source handle (right) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
              showConnect 
                ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
            }`}
            style={{ pointerEvents: 'auto', zIndex: 10 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleConnectionDragStart(e, milestone.id, "source");
            }}
          />
        </>
      )}
    </div>
  );
}
