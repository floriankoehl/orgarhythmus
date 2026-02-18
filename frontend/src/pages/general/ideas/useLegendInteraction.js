// Legend drag-assign interaction + legend editing UI state
import { useState, useRef } from "react";

/**
 * Hook for managing legend type interactions:
 * - Dragging a legend circle onto an idea to assign its type
 * - Legend edit state (name, color picker)
 * - Create new legend state
 */
export function useLegendInteraction({
  legendTypes,
  assign_idea_legend_type,
  ideaRefs,
}) {
  const [draggingLegend, setDraggingLegend] = useState(null);
  const [hoverIdeaForLegend, setHoverIdeaForLegend] = useState(null);

  // Legend editing state
  const [editingLegendId, setEditingLegendId] = useState(null);
  const [editingLegendName, setEditingLegendName] = useState("");
  const [showLegendColorPicker, setShowLegendColorPicker] = useState(null);
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendColor, setNewLegendColor] = useState("#6366f1");
  const [newLegendName, setNewLegendName] = useState("");
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  const handleLegendDrag = (event, legendTypeId) => {
    event.preventDefault();
    let currentHoverIdeaId = null;

    setDraggingLegend({
      id: legendTypeId,
      x: event.clientX,
      y: event.clientY,
      color: legendTypeId ? legendTypes[legendTypeId]?.color : "#374151",
    });

    const onMouseMove = (e) => {
      setDraggingLegend((prev) => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));

      // Check if hovering over any idea
      let foundIdeaId = null;
      for (const [ideaId, ref] of Object.entries(ideaRefs.current)) {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          ) {
            foundIdeaId = parseInt(ideaId);
            break;
          }
        }
      }
      currentHoverIdeaId = foundIdeaId;
      setHoverIdeaForLegend(foundIdeaId);
    };

    const onMouseUp = () => {
      if (currentHoverIdeaId) {
        assign_idea_legend_type(currentHoverIdeaId, legendTypeId);
      }
      setDraggingLegend(null);
      setHoverIdeaForLegend(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return {
    // Legend drag state
    draggingLegend,
    hoverIdeaForLegend,
    handleLegendDrag,

    // Legend editing state
    editingLegendId,
    setEditingLegendId,
    editingLegendName,
    setEditingLegendName,
    showLegendColorPicker,
    setShowLegendColorPicker,
    legendCollapsed,
    setLegendCollapsed,

    // Create legend state
    showCreateLegend,
    setShowCreateLegend,
    newLegendColor,
    setNewLegendColor,
    newLegendName,
    setNewLegendName,
  };
}
