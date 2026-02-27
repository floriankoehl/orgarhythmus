import { useRef } from "react";
import TeamContainer from "./TeamContainer";

/**
 * Right canvas — spatial container for team cards.
 *
 * Mirrors IdeaBin's IdeaBinCategoryCanvas: overlay-scrollable canvas
 * with absolutely-positioned team containers.
 */
export default function TeamCanvas({
  tasks,
  teams,
  teamOrder,
  teamPositions,
  tasksByTeamMap, // { teamId: [taskId,...] }
  handleTeamDrag,
  handleTeamResize,
  editingTeamId,
  setEditingTeamId,
  editingTeamName,
  setEditingTeamName,
  onRenameTeam,
  onDeleteTeam,
  onUpdateTeamColor,
  dragging,
  dragSource,
  hoverIndex,
  prevIndex,
  hoverTeamId,
  handleTaskDrag,
  selectedTaskIds,
  setSelectedTaskIds,
  onEditTask,
  onDeleteTask,
  setConfirmModal,
  teamCanvasRef,
}) {
  // Calculate canvas bounds to fit all containers
  let maxX = 600, maxY = 400;
  for (const pos of Object.values(teamPositions)) {
    const right = (pos.x || 0) + (pos.w || 240) + 40;
    const bottom = (pos.y || 0) + (pos.h || 300) + 40;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return (
    <div
      ref={teamCanvasRef}
      className="flex-1 relative overflow-auto bg-gray-50"
      style={{ minWidth: 0 }}
    >
      <div
        style={{ width: maxX, height: maxY, position: "relative" }}
      >
        {teamOrder.map((teamId) => {
          const team = teams[teamId];
          const pos = teamPositions[teamId];
          if (!team || !pos) return null;
          const taskIds = tasksByTeamMap[teamId] || [];

          return (
            <TeamContainer
              key={teamId}
              team={team}
              tasks={tasks}
              taskIds={taskIds}
              teams={teams}
              position={pos}
              handleTeamDrag={handleTeamDrag}
              handleTeamResize={handleTeamResize}
              editingTeamId={editingTeamId}
              setEditingTeamId={setEditingTeamId}
              editingTeamName={editingTeamName}
              setEditingTeamName={setEditingTeamName}
              onRenameTeam={onRenameTeam}
              onDeleteTeam={onDeleteTeam}
              onUpdateTeamColor={onUpdateTeamColor}
              dragging={dragging}
              dragSource={dragSource}
              hoverIndex={hoverIndex}
              prevIndex={prevIndex}
              hoverTeamId={hoverTeamId}
              handleTaskDrag={handleTaskDrag}
              selectedTaskIds={selectedTaskIds}
              setSelectedTaskIds={setSelectedTaskIds}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              setConfirmModal={setConfirmModal}
            />
          );
        })}

        {/* Empty state when no teams */}
        {teamOrder.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-sm font-medium">No teams yet</p>
              <p className="text-[10px] mt-1">Create a team from the toolbar above</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
