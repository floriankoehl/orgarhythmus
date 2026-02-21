// Single idea row — display, collapse, drag handle, edit/delete buttons
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * Renders one idea item in a list (unassigned or inside a category).
 * Handles display, collapse toggle, drag initiation, and action buttons.
 */
export default function IdeaItem({
  ideaId,
  idea,
  arrayIndex,
  source,
  // Drag
  dragSource,
  prevIndex,
  hoverIndex,
  handleIdeaDrag,
  // Legend
  legendTypes,
  hoverIdeaForType,
  draggingType,
  // Collapse
  isIdeaCollapsed,
  onToggleCollapse,
  // Edit
  isEditing,
  onStartEdit,
  onConfirmDelete,
  // Refs
  ideaRefs,
}) {
  const isSource =
    dragSource &&
    dragSource.type === source.type &&
    (source.type === "unassigned" ||
      String(dragSource.id) === String(source.id));

  const legendType = idea.legend_type_id ? legendTypes[idea.legend_type_id] : null;
  const isHoveredForType = hoverIdeaForType === ideaId;

  const getDisplayText = () => {
    if (idea.headline) {
      return <span className="font-semibold">{idea.headline}</span>;
    }
    const words = idea.title.split(/\s+/);
    if (words.length > 5) {
      return <span className="font-semibold">{words.slice(0, 5).join(" ")}...</span>;
    }
    return <span className="font-semibold">{idea.title}</span>;
  };

  return (
    <div key={`idea_${ideaId}`} data-idea-item="true">
      {/* Drop indicator */}
      <div
        style={{
          opacity: isSource && arrayIndex === hoverIndex ? 1 : 0,
          transform:
            isSource && arrayIndex === hoverIndex
              ? "translateY(2px)"
              : "translateY(0px)",
          transition: "opacity 100ms ease",
        }}
        className="w-full h-1 my-[1px] rounded bg-gray-700"
      />

      {isEditing ? (
        <div className="w-full rounded bg-blue-50 text-blue-600 px-2 py-1.5 text-xs mb-1 border border-blue-200 italic">
          Editing above...
        </div>
      ) : (
        <div
          ref={(el) => (ideaRefs.current[ideaId] = el)}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleIdeaDrag(e, idea, arrayIndex, source);
          }}
          style={{
            backgroundColor:
              isHoveredForType
                ? (draggingType?.color || "#e0e7ff")
                : isSource && arrayIndex === prevIndex
                ? "#e5e7eb"
                : legendType
                ? `${legendType.color}20`
                : "#ffffff4b",
            borderLeftColor: legendType ? legendType.color : "#374151",
            borderLeftWidth: "4px",
            transform:
              isSource &&
              hoverIndex !== null &&
              arrayIndex >= hoverIndex &&
              arrayIndex !== prevIndex
                ? "translateY(6px)"
                : "translateY(0px)",
            transition: "transform 200ms ease, background-color 200ms ease, border-color 200ms ease",
          }}
          className={`w-full rounded text-gray-800 px-2 py-1.5 flex justify-between items-start text-xs mb-1 cursor-grab leading-snug shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 ${isHoveredForType ? 'ring-2 ring-offset-1' : ''}`}
        >
          <div className="flex items-start gap-1.5 flex-1 mr-1">
            {/* Collapse toggle - colored triangle */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(ideaId);
              }}
              className="cursor-pointer flex-shrink-0"
              style={{
                color: legendType ? legendType.color : "#374151",
                width: 0,
                height: 0,
                display: 'inline-block',
                borderStyle: 'solid',
                marginTop: '4px',
                ...(isIdeaCollapsed
                  ? {
                      borderWidth: '6px 0 6px 10px',
                      borderColor: `transparent transparent transparent ${legendType ? legendType.color : "#374151"}`,
                    }
                  : {
                      borderWidth: '10px 6px 0 6px',
                      borderColor: `${legendType ? legendType.color : "#374151"} transparent transparent transparent`,
                    }),
              }}
              title={`${isIdeaCollapsed ? "Expand" : "Collapse"} - ${legendType ? legendType.name : "Unassigned"}`}
            />
            <div className="break-words whitespace-pre-wrap">
              {isIdeaCollapsed ? (
                getDisplayText()
              ) : (
                <>
                  {idea.headline && <div className="font-semibold mb-0.5">{idea.headline}</div>}
                  {idea.title}
                </>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 mt-0.5 flex items-center gap-0.5 text-gray-400">
            <EditIcon
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(ideaId, idea);
              }}
              className="hover:text-blue-500! cursor-pointer"
              style={{ fontSize: 13 }}
            />
            <DeleteForeverIcon
              onClick={(e) => {
                e.stopPropagation();
                onConfirmDelete(idea);
              }}
              className="hover:text-red-500! cursor-pointer"
              style={{ fontSize: 14 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
