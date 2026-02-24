/**
 * Floating drag ghost overlays rendered outside the IdeaBin window.
 * Three types: internal idea ghost, type drag ghost, and external ghost.
 */
export default function IdeaBinDragGhosts({ dragging, externalGhost, draggingType, selectedIdeaIds }) {
  // Multi-drag: show count badge when dragging one of several selected ideas
  const multiDragCount = dragging && selectedIdeaIds && selectedIdeaIds.size > 1
    && (selectedIdeaIds.has(dragging.idea.placement_id) || selectedIdeaIds.has(dragging.idea.id))
    ? selectedIdeaIds.size : 0;

  return (
    <>
      {/* Internal idea drag ghost */}
      {dragging && !externalGhost && (
        <div
          style={{
            top: dragging.y, left: dragging.x,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none", zIndex: 99999,
          }}
          className="fixed max-w-48 shadow-lg border border-gray-200 bg-white rounded text-gray-800 px-2 py-1 flex items-center text-[10px]"
        >
          <span className="whitespace-pre-wrap line-clamp-2">
            {dragging.idea.title}
          </span>
          {multiDragCount > 1 && (
            <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
              {multiDragCount}
            </span>
          )}
        </div>
      )}

      {/* Type drag ghost */}
      {draggingType && (
        <div
          style={{
            top: draggingType.y, left: draggingType.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none", zIndex: 99999,
            backgroundColor: draggingType.color,
          }}
          className="fixed w-6 h-6 rounded-full shadow-lg border-2 border-white"
        />
      )}

      {/* External drag ghost — visible when dragging an idea outside the IdeaBin window */}
      {externalGhost && (
        <div
          id="ideabin-external-ghost"
          style={{
            position: "fixed",
            left: externalGhost.x + 12,
            top: externalGhost.y - 8,
            zIndex: 99999,
            pointerEvents: "none",
            maxWidth: 220,
          }}
        >
          {multiDragCount > 1 && (
            <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow z-10">
              {multiDragCount}
            </span>
          )}
          <div
            className="rounded-lg shadow-xl border-2 px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined
                ? "#ede9fe"
                : externalGhost.teamId
                  ? (externalGhost.taskId ? "#dbeafe" : "#fef3c7")
                  : "#ffffff",
              borderColor: externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined
                ? "#7c3aed"
                : externalGhost.teamId
                  ? (externalGhost.taskId ? "#3b82f6" : (externalGhost.teamColor || "#f59e0b"))
                  : "#d1d5db",
              color: "#1f2937",
            }}
          >
            <div className="truncate">
              {externalGhost.idea.title.split(/\s+/).slice(0, 5).join(" ")}
            </div>
            {externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined && externalGhost.taskId ? (
              <div className="text-[10px] mt-0.5 opacity-80">
                🏁 {externalGhost.dayLabel ? `${externalGhost.dayWeekday || ''} ${externalGhost.dayLabel}`.trim() : `Day ${parseInt(externalGhost.dayIndex) + 1}`}
              </div>
            ) : externalGhost.teamId ? (
              <div className="text-[10px] mt-0.5 opacity-80">
                {externalGhost.taskId
                  ? <>🏁 → <span className="font-semibold">{externalGhost.taskName}</span></>
                  : <>📋 → <span className="font-semibold" style={{ color: externalGhost.teamColor }}>{externalGhost.teamName}</span></>
                }
              </div>
            ) : (
              <div className="text-[10px] mt-0.5 text-gray-400 italic">Drag onto a team or task...</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
