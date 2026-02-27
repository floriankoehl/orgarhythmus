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
  selectedTeamIds,
  setSelectedTeamIds,
  collapsedTeamIds,
  onCollapseTeam,
  onExpandTeam,
  onInsertTasks,
  onExportTeam,
}) {
  // ── Draw-to-create marquee state ──
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY }
  const drawModeRef = useRef(false);
  useEffect(() => { drawModeRef.current = drawTeamMode; }, [drawTeamMode]);

  const handleMarqueeStart = useCallback((e) => {
    // Only start on direct canvas background click (not on team containers)
    if (e.target.closest("[data-team-container]")) return;
    if (e.button !== 0) return; // left click only

    const isDrawMode = drawModeRef.current;
    const rect = teamCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = teamCanvasRef.current.scrollLeft;
    const scrollTop = teamCanvasRef.current.scrollTop;
    const startX = e.clientX - rect.left + scrollLeft;
    const startY = e.clientY - rect.top + scrollTop;
    const ctrlKey = e.ctrlKey || e.metaKey;

    setMarquee({ startX, startY, currentX: startX, currentY: startY, isDrawMode });

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

      if (isDrawMode) {
        // Draw-to-create team
        if (w < 80 || h < 50) return;
        createTeamAt?.("New Team", "#6366f1", {
          x: Math.round(mx1),
          y: Math.round(my1),
          w: Math.round(w),
          h: Math.round(h),
        }).then((team) => {
          if (team) {
            setEditingTeamId(team.id);
            setEditingTeamName(team.name || "New Team");
            setDrawTeamMode?.(false);
          }
        }).catch((err) => console.error("Draw-to-create team failed:", err));
      } else {
        // Selection marquee for teams
        if (w * h < 100) {
          // Just a click — deselect all
          setSelectedTeamIds?.(new Set());
          return;
        }
        const hit = [];
        for (const tid of teamOrder) {
          const pos = teamPositions[tid];
          if (!pos) continue;
          const tx = pos.x || 0;
          const ty = pos.y || 0;
          const tw = pos.w || 240;
          const th = pos.h || 300;
          if (tx + tw > mx1 && tx < mx2 && ty + th > my1 && ty < my2) {
            hit.push(tid);
          }
        }
        if (hit.length > 0) {
          if (ctrlKey) {
            setSelectedTeamIds?.((old) => {
              const next = new Set(old);
              hit.forEach((id) => next.add(id));
              return next;
            });
          } else {
            setSelectedTeamIds?.(new Set(hit));
          }
        } else {
          setSelectedTeamIds?.(new Set());
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [teamCanvasRef, createTeamAt, setEditingTeamId, setEditingTeamName, setDrawTeamMode, teamOrder, teamPositions, setSelectedTeamIds]);

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

        {/* Collapsed team chips at top of canvas */}
        {teamOrder.some(tid => collapsedTeamIds?.has(tid)) && (
          <div className="absolute top-1.5 left-2 flex flex-wrap gap-1.5 z-50 max-w-[70%]">
            {teamOrder.filter(tid => collapsedTeamIds?.has(tid)).map(tid => {
              const t = teams[tid];
              if (!t) return null;
              const taskCount = (tasksByTeamMap[tid] || []).length;
              return (
                <button
                  key={tid}
                  onClick={() => onExpandTeam?.(tid)}
                  className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border shadow-sm hover:shadow-md transition-all cursor-pointer"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${t.color || "#6366f1"} 12%, white)`,
                    borderColor: `color-mix(in srgb, ${t.color || "#6366f1"} 40%, white)`,
                    color: t.color || "#6366f1",
                  }}
                  title={`Click to expand ${t.name}`}
                >
                  {t.name || "Unnamed"} · {taskCount}
                </button>
              );
            })}
          </div>
        )}

        {/* Marquee overlay */}
        {marquee && (() => {
          const x = Math.min(marquee.startX, marquee.currentX);
          const y = Math.min(marquee.startY, marquee.currentY);
          const w = Math.abs(marquee.currentX - marquee.startX);
          const h = Math.abs(marquee.currentY - marquee.startY);
          const isDrawing = marquee.isDrawMode;
          return w * h > 100 ? (
            <div
              style={{ left: x, top: y, width: w, height: h }}
              className={`absolute border-2 rounded pointer-events-none z-[9999] ${
                isDrawing
                  ? "border-amber-500 bg-amber-100/30 shadow-lg"
                  : "border-indigo-400 bg-indigo-100/20"
              }`}
            >
              {isDrawing && w >= 80 && h >= 50 && (
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
          if (collapsedTeamIds?.has(teamId)) return null;
          const team = teams[teamId];
          const pos = teamPositions[teamId];
          if (!team || !pos) return null;
          const taskIds = tasksByTeamMap[teamId] || [];
          const isTeamSelected = selectedTeamIds?.has(teamId);

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
              isTeamSelected={isTeamSelected}
              onCollapseTeam={onCollapseTeam}
              setSelectedTeamIds={setSelectedTeamIds}
              onInsertTasks={onInsertTasks}
              onExportTeam={onExportTeam}
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
