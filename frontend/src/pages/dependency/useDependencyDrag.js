// Team drag, task drag, and marquee (lasso) selection handlers.
import { useState, useRef } from 'react';
import { playSound } from '../../assets/sound_registry';
import {
  safe_team_order,
  reorder_team_tasks,
} from '../../api/dependencies_api.js';
import { isTaskVisible } from './layoutMath';
import {
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
} from './layoutMath';
import { useDependency } from './DependencyContext.jsx';

/**
 * Hook for team reordering drag, task reordering/cross-team drag,
 * and marquee (lasso) multi-select on the canvas background.
 */
export function useDependencyDrag({
  // Data
  milestones,
  teams,
  tasks,
  teamOrder,
  taskDisplaySettings,
  teamDisplaySettings,
  // Setters
  setTeams,
  setTeamOrder,
  // Layout
  DAYWIDTH,
  TEAMWIDTH,
  TASKWIDTH,
  getTaskHeight,
  getTeamHeight,
  isTeamVisible,
  getTeamYOffset,
  getTaskYOffset,
  getVisibleTasks,
  // Ref from orchestrator
  justDraggedRef,
}) {
  const {
    projectId,
    teamContainerRef,
    selectedMilestones,
    setSelectedMilestones,
    setSelectedConnection,
  } = useDependency();

  // ── Team drag state ──
  const [ghost, setGhost] = useState(null);
  const [dropIndex, _setDropIndex] = useState(null);
  const dropIndexRef = useRef(null);
  const setDropIndex = (val) => { dropIndexRef.current = val; _setDropIndex(val); };

  // ── Task drag state ──
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, _setTaskDropTarget] = useState(null);
  const taskDropTargetRef = useRef(null);
  const setTaskDropTarget = (val) => { taskDropTargetRef.current = val; _setTaskDropTarget(val); };
  const [moveModal, setMoveModal] = useState(null);

  // ── Marquee state ──
  const [marqueeRect, setMarqueeRect] = useState(null);

  // ────────────────────────────────────────
  // Handle team drag — allowed in all modes (reordering is non-destructive)
  // ────────────────────────────────────────
  const handleTeamDrag = (e, teamId, orderIndex) => {
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const team = teams[teamId];
    if (!team) return;

    const startY = e.clientY;
    let currentOrderIndex = orderIndex;

    setGhost({
      id: teamId,
      name: team.name,
      color: team.color,
      y: e.clientY - containerRect.top,
    });
    setDropIndex(orderIndex);

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y: deltaY } : null);

      // Per-team overhead: drop highlight area + header line
      const perTeamOverhead =
        TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      let cumulativeY = 0;
      let newDropIndex = 0;
      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));

      for (let i = 0; i < visibleTeams.length; i++) {
        const tid = visibleTeams[i];
        const totalH = perTeamOverhead + getTeamHeight(tid);
        if (deltaY < cumulativeY + totalH / 2) {
          newDropIndex = i;
          break;
        }
        cumulativeY += totalH;
        newDropIndex = i + 1;
      }
      setDropIndex(newDropIndex);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      const currentVisibleIndex = visibleTeams.indexOf(teamId);
      const finalDropIndex = dropIndexRef.current;

      if (finalDropIndex !== null && finalDropIndex !== currentVisibleIndex) {
        const newVisibleTeams = visibleTeams.filter(tid => tid !== teamId);
        newVisibleTeams.splice(finalDropIndex, 0, teamId);

        const hiddenTeams = teamOrder.filter(tid => !isTeamVisible(tid));
        const newOrder = [...newVisibleTeams, ...hiddenTeams];

        setTeamOrder(newOrder);
        try {
          // Filter out virtual teams (like __unassigned__) before saving to backend
          const persistOrder = newOrder.filter(tid => !teams[tid]?._virtual);
          await safe_team_order(projectId, persistOrder);
          playSound('teamDragDrop');
        } catch (err) {
          console.error("Failed to save team order:", err);
        }
      }

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ────────────────────────────────────────
  // Handle task drag — allowed in all modes (reordering is non-destructive)
  // ────────────────────────────────────────
  const handleTaskDrag = (e, taskId, teamId, taskIndex) => {
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const task = tasks[taskId];
    if (!task) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const taskHeight = getTaskHeight(taskId, taskDisplaySettings);

    setTaskGhost({
      taskKey: taskId,
      teamKey: teamId,
      name: task.name,
      height: taskHeight,
      width: TASKWIDTH,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setTaskGhost(prev => prev ? { ...prev, x, y } : null);

      // Find target team and insert position
      let targetTeamId = null;
      let insertIndex = 0;

      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        const teamYOff = getTeamYOffset(tid);
        const teamH = getTeamHeight(tid);

        if (y >= teamYOff && y <= teamYOff + teamH) {
          targetTeamId = tid;
          const visibleTasks = getVisibleTasks(tid);
          let taskCumY = teamYOff;

          for (let i = 0; i < visibleTasks.length; i++) {
            const th = getTaskHeight(visibleTasks[i], taskDisplaySettings);
            if (y < taskCumY + th / 2) {
              insertIndex = i;
              break;
            }
            taskCumY += th;
            insertIndex = i + 1;
          }
          break;
        }
      }

      if (targetTeamId) {
        setTaskDropTarget({ teamId: targetTeamId, insertIndex });
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const finalTaskDropTarget = taskDropTargetRef.current;
      if (finalTaskDropTarget) {
        const { teamId: targetTeamId, insertIndex } = finalTaskDropTarget;

        if (targetTeamId === teamId) {
          // Same team reorder
          const visibleTasks = getVisibleTasks(teamId);
          const currentIndex = visibleTasks.indexOf(taskId);

          if (currentIndex !== -1 && insertIndex !== currentIndex) {
            const newOrder = [...visibleTasks];
            newOrder.splice(currentIndex, 1);
            const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
            newOrder.splice(adjustedIndex, 0, taskId);

            // Rebuild full order including hidden tasks
            const team = teams[teamId];
            const hiddenTasks = team.tasks.filter(tid => !isTaskVisible(tid, taskDisplaySettings));
            const fullOrder = [...newOrder, ...hiddenTasks];

            setTeams(prev => ({
              ...prev,
              [teamId]: { ...prev[teamId], tasks: fullOrder }
            }));

            // Skip API call for virtual teams (like unassigned) — local reorder only
            if (!teams[teamId]?._virtual) {
              try {
                await reorder_team_tasks(projectId, taskId, teamId, fullOrder);
                playSound('taskDragDrop');
              } catch (err) {
                console.error("Failed to reorder tasks:", err);
              }
            } else {
              playSound('taskDragDrop');
            }
          }
        } else if (teams[targetTeamId]?._virtual || teams[teamId]?._virtual) {
          // Cross-team move involving a virtual team — not supported yet
        } else {
          // Cross-team move — show modal
          setMoveModal({
            taskId,
            sourceTeamId: teamId,
            targetTeamId,
            insertIndex,
          });
        }
      }

      setTaskGhost(null);
      setTaskDropTarget(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ────────────────────────────────────────
  // Marquee (Lasso) Selection
  // ────────────────────────────────────────

  /**
   * Start a marquee selection drag on the canvas background.
   * Called from onMouseDown on the teamContainerRef.
   * Only activates when clicking on empty space (not on milestones/UI).
   */
  const handleMarqueeStart = (e) => {
    // Only left-click
    if (e.button !== 0) return;

    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const scrollLeft = teamContainerRef.current.parentElement?.scrollLeft || 0;
    const startX = e.clientX - containerRect.left + scrollLeft;
    const startY = e.clientY - containerRect.top;

    setMarqueeRect({ x: startX, y: startY, width: 0, height: 0 });

    const DRAG_THRESHOLD = 4;
    let hasDragged = false;
    let lastMoveX = startX;
    let lastMoveY = startY;

    const onMouseMove = (moveEvent) => {
      const sl = teamContainerRef.current?.parentElement?.scrollLeft || 0;
      const currentX = moveEvent.clientX - containerRect.left + sl;
      const currentY = moveEvent.clientY - containerRect.top;

      lastMoveX = currentX;
      lastMoveY = currentY;

      const dx = currentX - startX;
      const dy = currentY - startY;

      if (!hasDragged && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDragged = true;

      setMarqueeRect({
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!hasDragged) {
        setMarqueeRect(null);
        return;
      }

      const rect = {
        x: Math.min(startX, lastMoveX),
        y: Math.min(startY, lastMoveY),
        width: Math.abs(lastMoveX - startX),
        height: Math.abs(lastMoveY - startY),
      };

      // Hit-test all visible milestones
      const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      const newSelection = new Set();

      for (const [id, milestone] of Object.entries(milestones)) {
        const mId = parseInt(id);
        const task = tasks[milestone.task];
        if (!task) continue;

        const team = teams[task.team];
        if (!team || !isTeamVisible(task.team)) continue;
        if (!isTaskVisible(milestone.task, taskDisplaySettings)) continue;

        // Skip milestones in collapsed teams
        const teamSettings = teamDisplaySettings[task.team];
        if (teamSettings?.collapsed) continue;

        const taskHeightVal = getTaskHeight(milestone.task, taskDisplaySettings);
        const teamYOff = getTeamYOffset(task.team);
        const taskYOff = getTaskYOffset(milestone.task, task.team);

        const milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
        const milestoneY = teamYOff + dropHighlightOffset + headerOffset + taskYOff + 2;
        const milestoneW = DAYWIDTH * (milestone.duration || 1);
        const milestoneH = taskHeightVal - 4;

        // AABB intersection check
        if (
          milestoneX < rect.x + rect.width &&
          milestoneX + milestoneW > rect.x &&
          milestoneY < rect.y + rect.height &&
          milestoneY + milestoneH > rect.y
        ) {
          newSelection.add(mId);
        }
      }

      if (newSelection.size > 0) {
        if (e.ctrlKey || e.metaKey) {
          // Add to existing selection
          setSelectedMilestones(prev => {
            const merged = new Set(prev);
            for (const mId of newSelection) merged.add(mId);
            return merged;
          });
        } else {
          setSelectedMilestones(newSelection);
        }
        setSelectedConnection(null);
        playSound('marqueeSelect');
        // Prevent the page-wrapper onClick from clearing selection
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }

      setMarqueeRect(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return {
    // Team drag state
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    // Task drag state
    taskGhost,
    setTaskGhost,
    taskDropTarget,
    setTaskDropTarget,
    moveModal,
    setMoveModal,
    // Marquee
    marqueeRect,
    // Handlers
    handleTeamDrag,
    handleTaskDrag,
    handleMarqueeStart,
  };
}
