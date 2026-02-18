// Team drag, task drag, and marquee (lasso) selection handlers.
import { useState, useRef } from 'react';
import { playSound, startLoopSound, stopLoopSound } from '../../assets/sound_registry';
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
  // Phase row offset
  getTeamPhaseRowHeight,
  // Layout constants (includes effective HEADER_HEIGHT)
  layoutConstants,
  // Day layout
  dayColumnLayout,
  collapsedDays,
}) {
  const {
    projectId,
    teamContainerRef,
    selectedMilestones,
    setSelectedMilestones,
    setSelectedConnections,
    pushAction,
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

    // Compute team Y offset and ghost offset within team for accurate positioning
    const teamYOffset = getTeamYOffset(teamId);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const teamTopY = teamYOffset + dropHighlightOffset + headerOffset;
    const cursorY = e.clientY - containerRect.top;
    const offsetY = cursorY - teamTopY;
    const teamHeight = getTeamHeight(teamId);

    // Collect milestones belonging to this team for ghost rendering
    const teamMilestones = [];
    for (const [mId, m] of Object.entries(milestones)) {
      const task = tasks[m.task];
      if (!task || !team.tasks.includes(m.task)) continue;
      teamMilestones.push({ ...m, id: parseInt(mId) });
    }

    setGhost({
      id: teamId,
      name: team.name,
      color: team.color,
      y: cursorY,
      offsetY,
      height: teamHeight,
      teamTasks: team.tasks,
      milestones: teamMilestones,
      teamYOffset: teamTopY,
    });
    setDropIndex(orderIndex);

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y: deltaY } : null);

      // Per-team overhead: drop highlight area + header line
      const perTeamOverhead =
        TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      let cumulativeY = layoutConstants?.HEADER_HEIGHT || 0;
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
      stopLoopSound('dragLoop');

      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      const currentVisibleIndex = visibleTeams.indexOf(teamId);
      const finalDropIndex = dropIndexRef.current;

      if (finalDropIndex !== null && finalDropIndex !== currentVisibleIndex) {
        const newVisibleTeams = visibleTeams.filter(tid => tid !== teamId);
        newVisibleTeams.splice(finalDropIndex, 0, teamId);

        const hiddenTeams = teamOrder.filter(tid => !isTeamVisible(tid));
        const newOrder = [...newVisibleTeams, ...hiddenTeams];

        // Capture old order for undo
        const oldOrder = [...teamOrder];

        setTeamOrder(newOrder);
        try {
          // Filter out virtual teams (like __unassigned__) before saving to backend
          const persistOrder = newOrder.filter(tid => !teams[tid]?._virtual);
          await safe_team_order(projectId, persistOrder);
          playSound('teamDragDrop');

          pushAction({
            description: 'Reorder teams',
            undo: async () => {
              setTeamOrder(oldOrder);
              const oldPersistOrder = oldOrder.filter(tid => !teams[tid]?._virtual);
              await safe_team_order(projectId, oldPersistOrder);
            },
            redo: async () => {
              setTeamOrder(newOrder);
              await safe_team_order(projectId, persistOrder);
            },
          });
        } catch (err) {
          console.error("Failed to save team order:", err);
        }
      }

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
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

    // Collect milestones for this task
    const taskMilestones = [];
    for (const [mId, m] of Object.entries(milestones)) {
      if (m.task === taskId) {
        taskMilestones.push({ ...m, id: parseInt(mId) });
      }
    }

    // Compute task Y offset for connection tracking
    const teamYOffset = getTeamYOffset(teamId);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const phaseRowH = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(teamId) : 0;
    const taskYOff = getTaskYOffset(taskId, teamId);
    const taskTopY = teamYOffset + dropHighlightOffset + headerOffset + phaseRowH + taskYOff;
    const cursorY = e.clientY - containerRect.top;

    setTaskGhost({
      taskKey: taskId,
      teamKey: teamId,
      name: task.name,
      height: taskHeight,
      width: TASKWIDTH,
      x: e.clientX - containerRect.left,
      y: cursorY,
      milestones: taskMilestones,
      taskTopY,
      offsetY: cursorY - taskTopY,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setTaskGhost(prev => prev ? { ...prev, x, y } : null);

      // Find target team and insert position
      let targetTeamId = null;
      let insertIndex = 0;

      // Per-team overhead before task rows begin
      const taskAreaOverhead =
        TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        const teamYOff = getTeamYOffset(tid);
        const teamH = getTeamHeight(tid);
        // Total region occupied by this team including overhead
        const totalTeamH = taskAreaOverhead + teamH;

        if (y >= teamYOff && y <= teamYOff + totalTeamH) {
          targetTeamId = tid;
          const visibleTasks = getVisibleTasks(tid);
          // Tasks start after the overhead area
          let taskCumY = teamYOff + taskAreaOverhead;

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
      stopLoopSound('dragLoop');

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

            // Capture old order for undo
            const oldFullOrder = [...team.tasks];

            setTeams(prev => ({
              ...prev,
              [teamId]: { ...prev[teamId], tasks: fullOrder }
            }));

            // Skip API call for virtual teams (like unassigned) — local reorder only
            if (!teams[teamId]?._virtual) {
              try {
                await reorder_team_tasks(projectId, taskId, teamId, fullOrder);
                playSound('taskDragDrop');

                pushAction({
                  description: 'Reorder tasks',
                  undo: async () => {
                    setTeams(prev => ({ ...prev, [teamId]: { ...prev[teamId], tasks: oldFullOrder } }));
                    await reorder_team_tasks(projectId, taskId, teamId, oldFullOrder);
                  },
                  redo: async () => {
                    setTeams(prev => ({ ...prev, [teamId]: { ...prev[teamId], tasks: fullOrder } }));
                    await reorder_team_tasks(projectId, taskId, teamId, fullOrder);
                  },
                });
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
    startLoopSound('dragLoop');
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

    const container = teamContainerRef.current;
    const scrollContainer = container?.parentElement;
    if (!container || !scrollContainer) return;

    // Content-space coordinates via fresh getBoundingClientRect —
    // this naturally accounts for the current scrollLeft because the
    // inner container shifts in the viewport as the parent scrolls.
    const initRect = container.getBoundingClientRect();
    const startX = e.clientX - initRect.left;
    const startY = e.clientY - initRect.top;

    setMarqueeRect({ x: startX, y: startY, width: 0, height: 0 });

    const DRAG_THRESHOLD = 4;
    let hasDragged = false;
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;

    // Always use a fresh rect so horizontal scroll during drag is handled
    const getContentCoords = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const updateMarquee = () => {
      const { x: currentX, y: currentY } = getContentCoords(lastClientX, lastClientY);
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

    const onMouseMove = (moveEvent) => {
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      updateMarquee();
    };

    // Update marquee when scroll happens (e.g. shift+wheel) without mouse movement
    const onScroll = () => {
      if (hasDragged) updateMarquee();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      scrollContainer.removeEventListener('scroll', onScroll);

      if (!hasDragged) {
        setMarqueeRect(null);
        return;
      }

      const { x: endX, y: endY } = getContentCoords(lastClientX, lastClientY);
      const rect = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
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
        const phaseRowOff = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(task.team) : 0;
        const milestoneY = teamYOff + dropHighlightOffset + headerOffset + phaseRowOff + taskYOff + 2;
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
        setSelectedConnections([]);
        playSound('marqueeSelect');
        // Prevent the page-wrapper onClick from clearing selection
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }

      setMarqueeRect(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    scrollContainer.addEventListener('scroll', onScroll);
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
