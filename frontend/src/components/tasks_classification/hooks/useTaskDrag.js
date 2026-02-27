import { useState, useCallback, useEffect } from "react";

/**
 * Manages drag & drop for the Task Structure page.
 *
 * Supports:
 *  - Dragging tasks within the sidebar list to reorder
 *  - Dragging tasks onto team containers to assign
 *  - Dragging tasks out of a team → Unassigned
 *
 * Single-team rule: dropping onto a team replaces any prior assignment.
 */
export default function useTaskDrag({
  tasks,
  taskOrder,
  setTaskOrder,
  assignTaskToTeam,
  teams,
  teamPositions,
  windowRef,
  taskListRef,
  teamCanvasRef,
}) {
  const [dragging, setDragging] = useState(null);        // { task, x, y }
  const [dragSource, setDragSource] = useState(null);    // { type: "unassigned"|"team", teamId? }
  const [hoverTeamId, setHoverTeamId] = useState(null);  // team being hovered
  const [hoverUnassigned, setHoverUnassigned] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);    // index in list for reorder indicator
  const [prevIndex, setPrevIndex] = useState(null);

  const isPointInRect = (px, py, r) =>
    px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;

  const handleTaskDrag = useCallback((e, task, index, source) => {
    let ghost = { task, x: e.clientX, y: e.clientY };
    let dropTarget = null;

    setDragging(ghost);
    setPrevIndex(index);
    setDragSource(source);

    // Collect source list elements for reorder tracking
    let srcElements = [];
    if (taskListRef.current && (source.type === "unassigned")) {
      srcElements = [...taskListRef.current.querySelectorAll("[data-task-item]")];
    }

    const onMove = (ev) => {
      ghost = { ...ghost, x: ev.clientX, y: ev.clientY };
      setDragging(ghost);

      // Check if hovering over any team container
      let foundTeam = null;
      if (teamCanvasRef?.current) {
        const canvasRect = teamCanvasRef.current.getBoundingClientRect();
        for (const [teamId, pos] of Object.entries(teamPositions)) {
          const rect = {
            left: canvasRect.left + pos.x,
            top: canvasRect.top + pos.y,
            right: canvasRect.left + pos.x + (pos.w || 240),
            bottom: canvasRect.top + pos.y + (pos.h || 300),
          };
          if (isPointInRect(ev.clientX, ev.clientY, rect)) {
            foundTeam = teamId;
            break;
          }
        }
      }

      // Check if hovering over unassigned list
      let foundUnassigned = false;
      if (taskListRef.current) {
        const listRect = taskListRef.current.getBoundingClientRect();
        if (isPointInRect(ev.clientX, ev.clientY, listRect)) {
          foundUnassigned = true;
        }
      }

      setHoverTeamId(foundTeam);
      setHoverUnassigned(foundUnassigned);
      dropTarget = foundTeam
        ? { type: "team", teamId: foundTeam }
        : foundUnassigned
        ? { type: "unassigned" }
        : null;

      // Track reorder index within source list
      const isOverSrc = source.type === "unassigned" && foundUnassigned;
      if (isOverSrc && srcElements.length > 1) {
        for (let i = 0; i < srcElements.length; i++) {
          const r = srcElements[i].getBoundingClientRect();
          const midY = r.top + r.height / 2;
          if (ev.clientY < midY) {
            setHoverIndex(i);
            break;
          }
          if (i === srcElements.length - 1) setHoverIndex(i + 1);
        }
      } else {
        setHoverIndex(null);
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (dropTarget?.type === "team") {
        // Assign task to team
        const teamId = parseInt(dropTarget.teamId, 10);
        assignTaskToTeam(task.id, teamId);
      } else if (dropTarget?.type === "unassigned" && source.type === "team") {
        // Move task back to unassigned
        assignTaskToTeam(task.id, null);
      } else if (
        dropTarget?.type === "unassigned" &&
        source.type === "unassigned" &&
        hoverIndex !== null &&
        hoverIndex !== index
      ) {
        // Reorder within unassigned
        setTaskOrder((prev) => {
          const next = [...prev];
          const [item] = next.splice(index, 1);
          const insertAt = hoverIndex > index ? hoverIndex - 1 : hoverIndex;
          next.splice(insertAt, 0, item);
          return next;
        });
      }

      setDragging(null);
      setDragSource(null);
      setHoverTeamId(null);
      setHoverUnassigned(false);
      setHoverIndex(null);
      setPrevIndex(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tasks, taskOrder, setTaskOrder, assignTaskToTeam, teamPositions, taskListRef, teamCanvasRef, hoverIndex]);

  return {
    dragging,
    dragSource,
    hoverTeamId,
    hoverUnassigned,
    hoverIndex,
    prevIndex,
    handleTaskDrag,
  };
}
