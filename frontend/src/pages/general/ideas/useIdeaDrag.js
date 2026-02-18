// Idea drag & drop behavior and hover logic
import { useState, useRef } from "react";

/**
 * Hook for managing all idea drag & drop interactions.
 * Handles dragging ideas between unassigned list and categories,
 * reordering within same container, and hover detection.
 */
export function useIdeaDrag({
  categories,
  unassignedOrder,
  setUnassignedOrder,
  categoryOrders,
  setCategoryOrders,
  safe_order,
  assign_idea_to_category,
  categoryContainerRef,
  IdeaListRef,
  categoryRefs,
}) {
  const [dragging, setDragging] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [prevIndex, setPrevIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverCategory, setHoverCategory] = useState(null);
  const [hoverUnassigned, setHoverUnassigned] = useState(false);

  const isPointInRect = (px, py, rect) => {
    return (
      px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
    );
  };

  const handleIdeaDrag = (event, idea, index, source) => {
    const from_index = index;
    let to_index = index;
    let drop_target = null;

    let ghost = { idea, x: event.clientX, y: event.clientY };

    setDragging(ghost);
    setPrevIndex(index);
    setDragSource(source);

    let sourceDomElements = [];
    if (source.type === "unassigned" && IdeaListRef.current) {
      sourceDomElements = [
        ...IdeaListRef.current.querySelectorAll("[data-idea-item]"),
      ];
    } else if (
      source.type === "category" &&
      categoryRefs.current[source.id]
    ) {
      sourceDomElements = [
        ...categoryRefs.current[source.id].querySelectorAll("[data-idea-item]"),
      ];
    }

    const onMouseMove = (e) => {
      ghost = { ...ghost, x: e.clientX, y: e.clientY };
      setDragging(ghost);

      let foundUnassigned = false;
      if (IdeaListRef.current) {
        const listRect = IdeaListRef.current.getBoundingClientRect();
        if (isPointInRect(e.clientX, e.clientY, listRect)) {
          foundUnassigned = true;
        }
      }

      let foundCategory = null;
      if (!foundUnassigned && categoryContainerRef.current) {
        const containerRect =
          categoryContainerRef.current.getBoundingClientRect();
        for (const [catId, catData] of Object.entries(categories)) {
          if (catData.archived) continue;
          const catRect = {
            left: containerRect.left + catData.x,
            top: containerRect.top + catData.y,
            right: containerRect.left + catData.x + catData.width,
            bottom: containerRect.top + catData.y + catData.height,
          };
          if (isPointInRect(e.clientX, e.clientY, catRect)) {
            foundCategory = catId;
            break;
          }
        }
      }

      setHoverCategory(foundCategory);
      setHoverUnassigned(foundUnassigned);
      drop_target = foundCategory
        ? { type: "category", id: foundCategory }
        : foundUnassigned
        ? { type: "unassigned" }
        : null;

      const isOverSource =
        (source.type === "unassigned" && foundUnassigned) ||
        (source.type === "category" &&
          foundCategory === String(source.id));

      if (isOverSource && sourceDomElements.length > 1) {
        for (let i = 0; i < sourceDomElements.length - 1; i++) {
          const rect = sourceDomElements[i].getBoundingClientRect();
          const next_rect =
            sourceDomElements[i + 1].getBoundingClientRect();
          if (ghost.y > rect.y && ghost.y < next_rect.y) {
            setHoverIndex(i);
            to_index = i;
          }
        }
      } else {
        setHoverIndex(null);
      }
    };

    const onMouseUp = () => {
      const sameSource =
        drop_target &&
        ((drop_target.type === source.type &&
          drop_target.type === "unassigned") ||
          (drop_target.type === "category" &&
            source.type === "category" &&
            String(drop_target.id) === String(source.id)));

      if (sameSource) {
        if (source.type === "unassigned") {
          const newOrder = [...unassignedOrder];
          const [movedId] = newOrder.splice(from_index, 1);
          newOrder.splice(to_index, 0, movedId);
          setUnassignedOrder(newOrder);
          safe_order(newOrder, null);
        } else if (source.type === "category") {
          const newOrder = [...(categoryOrders[source.id] || [])];
          const [movedId] = newOrder.splice(from_index, 1);
          newOrder.splice(to_index, 0, movedId);
          setCategoryOrders((prev) => ({ ...prev, [source.id]: newOrder }));
          safe_order(newOrder, source.id);
        }
      } else if (drop_target) {
        const target_category_id =
          drop_target.type === "category" ? parseInt(drop_target.id) : null;
        assign_idea_to_category(idea.id, target_category_id);
      }

      setDragging(null);
      setPrevIndex(null);
      setHoverIndex(null);
      setDragSource(null);
      setHoverCategory(null);
      setHoverUnassigned(false);

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return {
    dragging,
    dragSource,
    prevIndex,
    hoverIndex,
    hoverCategory,
    hoverUnassigned,
    handleIdeaDrag,
  };
}
