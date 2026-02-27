import { useRef, useState, useCallback, useEffect } from "react";
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
  taskMode = false,
  drawTeamMode = false,
  setDrawTeamMode,
  createTeamAt,
}) {
  // ── Draw-to-create marquee state ──
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY }
  const drawModeRef = useRef(false);
  useEffect(() => { drawModeRef.current = drawTeamMode; }, [drawTeamMode]);

  const handleMarqueeStart = useCallback((e) => {
    // Only start on direct canvas background click (not on team containers)
    if (e.target.closest("[data-team-container]")) return;
    if (e.button !== 0) return; // left click only
    if (!drawModeRef.current) return;

    const rect = teamCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = teamCanvasRef.current.scrollLeft;
    const scrollTop = teamCanvasRef.current.scrollTop;
    const startX = e.clientX - rect.left + scrollLeft;
    const startY = e.clientY - rect.top + scrollTop;

    setMarquee({ startX, startY, currentX: startX, currentY: startY });

    let lastX = startX;
    let lastY = startY;

    const handleMouseMove = (moveE) => {
      const cx = moveE.clientX - rect.left + teamCanvasRef.current.scrollLeft;
      const cy = moveE.clientY - rect.top + teamCanvasRef.current.scrollTop;
      lastX = cx;
      lastY = cy;
      setMarquee((prev) => prev ? { ...prev, currentX: cx, currentY: cy } : null);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setMarquee(null);

      const mx1 = Math.min(startX, lastX);
      const my1 = Math.min(startY, lastY);
      const mx2 = Math.max(startX, lastX);
      const my2 = Math.max(startY, lastY);
      const w = mx2 - mx1;
      const h = my2 - my1;

      // Minimum size check
      if (w < 80 || h < 50) return;

      // Create team at the drawn position
      createTeamAt?.("New Team", "#6366f1", {
        x: Math.round(mx1),
        y: Math.round(my1),
        w: Math.round(w),
        h: Math.round(h),
      }).then((team) => {
        if (team) {
          // Put into edit mode so user can name it
          setEditingTeamId(team.id);
          setEditingTeamName(team.name || "New Team");
          // Exit draw mode
          setDrawTeamMode?.(false);
        }
      }).catch((err) => console.error("Draw-to-create team failed:", err));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [teamCanvasRef, createTeamAt, setEditingTeamId, setEditingTeamName, setDrawTeamMode]);

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
      className={`flex-1 relative overflow-auto bg-gray-50 ${drawTeamMode ? "cursor-crosshair" : ""}`}
      style={{ minWidth: 0 }}
      onMouseDown={handleMarqueeStart}
    >
      <div
        style={{ width: maxX, height: maxY, position: "relative" }}
      >
        {/* Draw-mode hint */}
        {drawTeamMode && !marquee && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[9998] bg-amber-100 text-amber-800 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm pointer-events-none animate-pulse">
            Draw a rectangle to create a team — or press Esc to cancel
          </div>
        )}

        {/* Marquee overlay */}
        {marquee && (() => {
          const x = Math.min(marquee.startX, marquee.currentX);
          const y = Math.min(marquee.startY, marquee.currentY);
          const w = Math.abs(marquee.currentX - marquee.startX);
          const h = Math.abs(marquee.currentY - marquee.startY);
          return w * h > 100 ? (
            <div
              style={{ left: x, top: y, width: w, height: h }}
              className="absolute border-2 border-amber-500 bg-amber-100/30 shadow-lg rounded pointer-events-none z-[9999]"
            >
              {w >= 80 && h >= 50 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50/90 px-2 py-0.5 rounded">
                    {Math.round(w)} × {Math.round(h)}
                  </span>
                </div>
              )}
            </div>
          ) : null;
        })()}
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
              taskMode={taskMode}
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
