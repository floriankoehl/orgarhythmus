import { useState, useCallback } from "react";
import { playSound } from "../../../assets/sound_registry";
import { authFetch, API } from "../api/authFetch";
import { createTaskForProject } from "../../../api/org_API";
import { add_milestone } from "../../../api/dependencies_api";

/**
 * Manages idea drag (internal reorder, cross-category move, external drop),
 * type drag, and drag-ghost state.
 */
export default function useIdeaBinDrag(deps) {
  const {
    ideas, unassignedOrder, setUnassignedOrder, categoryOrders, setCategoryOrders,
    safe_order, fetch_all_ideas, delete_idea,
    categories, categoryContainerRef,
    windowRef, IdeaListRef, categoryRefs, ideaRefs,
    dims,
    selectedIdeaIds,
    assign_idea_legend_type,
    projectId, setConfirmModal,
  } = deps;

  // ── Drag state ──
  const [dragging, setDragging] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [prevIndex, setPrevIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverCategory, setHoverCategory] = useState(null);
  const [hoverUnassigned, setHoverUnassigned] = useState(false);
  const [externalGhost, setExternalGhost] = useState(null);
  const [draggingType, setDraggingType] = useState(null);
  const [hoverIdeaForType, setHoverIdeaForType] = useState(null);

  const isPointInRect = (px, py, r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;

  const handleIdeaDrag = useCallback((e, idea, index, source) => {
    const fromIdx = index;
    let toIdx = index;
    let dropTarget = null;
    let ghost = { idea, x: e.clientX, y: e.clientY };
    let isExternal = false;
    let overTaskStructure = false;
    let extInfo = { teamId: null, teamName: null, teamColor: null, taskId: null, taskName: null, dayIndex: null, dayLabel: null, dayWeekday: null };
    let lastHighlightedCell = null;

    setDragging(ghost);
    setPrevIndex(index);
    setDragSource(source);

    let srcElements = [];
    if ((source.type === "unassigned" || source.type === "all") && IdeaListRef.current) {
      srcElements = [...IdeaListRef.current.querySelectorAll("[data-idea-item]")];
    } else if (source.type === "category" && categoryRefs.current[source.id]) {
      srcElements = [...categoryRefs.current[source.id].querySelectorAll("[data-idea-item]")];
    }

    const onMove = (ev) => {
      ghost = { ...ghost, x: ev.clientX, y: ev.clientY };
      setDragging(ghost);

      const winRect = windowRef.current?.getBoundingClientRect();
      const outsideWindow = winRect && !isPointInRect(ev.clientX, ev.clientY, winRect);

      if (outsideWindow) {
        isExternal = true;
        const ghostEl = document.getElementById("ideabin-external-ghost");
        if (ghostEl) ghostEl.style.pointerEvents = "none";
        const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
        if (ghostEl) ghostEl.style.pointerEvents = "auto";

        let teamEl = elUnder?.closest?.("[data-dep-team-id]");
        let taskEl = elUnder?.closest?.("[data-dep-task-id]");
        let dayEl = elUnder?.closest?.("[data-dep-day-index]");
        extInfo = {
          teamId: teamEl?.dataset?.depTeamId || dayEl?.dataset?.depDayTeamId || null,
          teamName: teamEl?.dataset?.depTeamName || null,
          teamColor: teamEl?.dataset?.depTeamColor || null,
          taskId: taskEl?.dataset?.depTaskId || dayEl?.dataset?.depDayTaskId || null,
          taskName: taskEl?.dataset?.depTaskName || dayEl?.dataset?.depDayTaskName || null,
          dayIndex: dayEl?.dataset?.depDayIndex ?? null,
          dayLabel: dayEl?.dataset?.depDayLabel || null,
          dayWeekday: dayEl?.dataset?.depDayWeekday || null,
        };

        if (lastHighlightedCell && lastHighlightedCell !== dayEl) {
          lastHighlightedCell.style.backgroundColor = '';
          lastHighlightedCell.style.outline = '';
        }
        if (dayEl) {
          dayEl.style.backgroundColor = '#ddd6fe';
          dayEl.style.outline = '2px solid #7c3aed';
          lastHighlightedCell = dayEl;
        } else if (lastHighlightedCell) {
          lastHighlightedCell.style.backgroundColor = '';
          lastHighlightedCell.style.outline = '';
          lastHighlightedCell = null;
        }

        // ── Pipeline mode: detect TaskStructure window ──
        const tsWin = document.querySelector("[data-taskstructure-window]");
        const pipelineActive = document.querySelector("[data-pipeline-active]");
        if (tsWin && pipelineActive) {
          const tsRect = tsWin.getBoundingClientRect();
          overTaskStructure = isPointInRect(ev.clientX, ev.clientY, tsRect);
          if (overTaskStructure) {
            tsWin.style.outline = "3px solid #10b981";
            tsWin.style.outlineOffset = "-3px";
          } else {
            tsWin.style.outline = "";
            tsWin.style.outlineOffset = "";
          }
        } else {
          overTaskStructure = false;
        }

        setExternalGhost({
          idea,
          x: ev.clientX,
          y: ev.clientY,
          ...extInfo,
          dayLabel: extInfo.dayLabel,
          dayWeekday: extInfo.dayWeekday,
          overTaskStructure,
        });
        setHoverCategory(null);
        setHoverUnassigned(false);
        dropTarget = null;
        return;
      }

      isExternal = false;
      extInfo = { teamId: null, teamName: null, teamColor: null, taskId: null, taskName: null, dayIndex: null, dayLabel: null, dayWeekday: null };
      setExternalGhost(null);
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell.style.outline = '';
        lastHighlightedCell = null;
      }

      let foundUnassigned = false;
      if (IdeaListRef.current) {
        const listRect = IdeaListRef.current.getBoundingClientRect();
        if (isPointInRect(ev.clientX, ev.clientY, listRect)) foundUnassigned = true;
      }

      let foundCategory = null;
      if (!foundUnassigned && categoryContainerRef.current) {
        const cRect = categoryContainerRef.current.getBoundingClientRect();
        const sortedCats = Object.entries(categories)
          .filter(([, d]) => !d.archived)
          .sort(([, a], [, b]) => (b.z_index || 0) - (a.z_index || 0));
        for (const [catId, catData] of sortedCats) {
          const catRect = {
            left: cRect.left + catData.x, top: cRect.top + catData.y,
            right: cRect.left + catData.x + catData.width,
            bottom: cRect.top + catData.y + catData.height,
          };
          if (isPointInRect(ev.clientX, ev.clientY, catRect)) { foundCategory = catId; break; }
        }
      }

      setHoverCategory(foundCategory);
      setHoverUnassigned(foundUnassigned);
      dropTarget = foundCategory
        ? { type: "category", id: foundCategory }
        : foundUnassigned
        ? { type: "unassigned" }
        : null;

      const isOverSrc =
        (source.type === "unassigned" && foundUnassigned) ||
        (source.type === "category" && foundCategory === String(source.id));
      if (isOverSrc && srcElements.length > 1) {
        for (let i = 0; i < srcElements.length - 1; i++) {
          const r = srcElements[i].getBoundingClientRect();
          const nr = srcElements[i + 1].getBoundingClientRect();
          if (ghost.y > r.y && ghost.y < nr.y) { setHoverIndex(i); toIdx = i; }
        }
      } else {
        setHoverIndex(null);
      }
    };

    const onUp = () => {
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell.style.outline = '';
        lastHighlightedCell = null;
      }
      // Clean up TaskStructure highlight
      const tsWinCleanup = document.querySelector("[data-taskstructure-window]");
      if (tsWinCleanup) { tsWinCleanup.style.outline = ""; tsWinCleanup.style.outlineOffset = ""; }
      setExternalGhost(null);

      // ── Pipeline: idea → task ──
      if (isExternal && overTaskStructure) {
        window.dispatchEvent(new CustomEvent("pipeline-idea-to-task", {
          detail: {
            ideaId: idea.id || idea.idea_id,
            placementId: idea.placement_id,
            title: idea.title,
            description: idea.description || "",
          },
        }));
        setDragging(null); setPrevIndex(null); setHoverIndex(null);
        setDragSource(null); setHoverCategory(null); setHoverUnassigned(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        return;
      }

      const isVirtualTeamDrop = extInfo.teamId && isNaN(parseInt(extInfo.teamId));
      if (isExternal && (extInfo.teamId || extInfo.dayIndex !== null) && !isVirtualTeamDrop) {
        const ideaName = idea.title.split(/\s+/).slice(0, 6).join(" ");
        const truncatedName = ideaName.length > 30 ? ideaName.slice(0, 27) + "..." : ideaName;

        if (extInfo.dayIndex !== null && extInfo.taskId) {
          const dayDateStr = extInfo.dayLabel
            ? `${extInfo.dayWeekday || ''} ${extInfo.dayLabel}`.trim()
            : `Day ${parseInt(extInfo.dayIndex) + 1}`;
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Milestone?</p>
                <p className="text-xs text-gray-600">
                  Place milestone <span className="font-semibold">"{truncatedName}"</span>{" "}
                  on <span className="font-semibold">{dayDateStr}</span>{" "}
                  of task <span className="font-semibold">"{extInfo.taskName || "task"}"</span>
                </p>
              </div>
            ),
            confirmLabel: "Create Milestone",
            confirmColor: "bg-blue-500 hover:bg-blue-600",
            onConfirm: async () => {
              try {
                await add_milestone(projectId, parseInt(extInfo.taskId), {
                  name: truncatedName,
                  description: idea.description || "",
                  start_index: parseInt(extInfo.dayIndex),
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create milestone from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        } else if (extInfo.taskId) {
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Milestone?</p>
                <p className="text-xs text-gray-600">
                  Add milestone <span className="font-semibold">"{truncatedName}"</span> to task{" "}
                  <span className="font-semibold">"{extInfo.taskName}"</span>
                  {extInfo.teamName && <> in <span className="font-semibold" style={{ color: extInfo.teamColor }}>{extInfo.teamName}</span></>}
                </p>
              </div>
            ),
            confirmLabel: "Create Milestone",
            confirmColor: "bg-blue-500 hover:bg-blue-600",
            onConfirm: async () => {
              try {
                await add_milestone(projectId, parseInt(extInfo.taskId), {
                  name: truncatedName,
                  description: idea.description || "",
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create milestone from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        } else {
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Task?</p>
                <p className="text-xs text-gray-600">
                  Create task <span className="font-semibold">"{truncatedName}"</span> in team{" "}
                  <span className="font-semibold" style={{ color: extInfo.teamColor }}>{extInfo.teamName}</span>
                </p>
              </div>
            ),
            confirmLabel: "Create Task",
            confirmColor: "bg-amber-500 hover:bg-amber-600",
            onConfirm: async () => {
              try {
                await createTaskForProject(projectId, {
                  name: truncatedName,
                  description: idea.description || "",
                  team_id: parseInt(extInfo.teamId),
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create task from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        }
      } else {
        // Internal drop logic
        const isMultiDrag = selectedIdeaIds.size > 1 && selectedIdeaIds.has(idea.placement_id);
        const getSelectedInOrder = (orderArr) => {
          if (!isMultiDrag) return [idea.placement_id];
          return orderArr.filter(id => selectedIdeaIds.has(id));
        };

        const sameSrc = dropTarget && (
          (dropTarget.type === source.type && dropTarget.type === "unassigned") ||
          (dropTarget.type === "category" && source.type === "category" && String(dropTarget.id) === String(source.id))
        );
        if (sameSrc) {
          if (source.type === "unassigned") {
            const movingIds = getSelectedInOrder(unassignedOrder);
            const newOrd = unassignedOrder.filter(id => !movingIds.includes(id));
            let insertAt = toIdx;
            const removedBefore = unassignedOrder.slice(0, toIdx).filter(id => movingIds.includes(id)).length;
            insertAt -= removedBefore;
            newOrd.splice(insertAt, 0, ...movingIds);
            setUnassignedOrder(newOrd);
            safe_order(newOrd, null);
            playSound('ideaDragDrop');
          } else if (source.type === "category") {
            const srcOrder = categoryOrders[source.id] || [];
            const movingIds = getSelectedInOrder(srcOrder);
            const newOrd = srcOrder.filter(id => !movingIds.includes(id));
            let insertAt = toIdx;
            const removedBefore = srcOrder.slice(0, toIdx).filter(id => movingIds.includes(id)).length;
            insertAt -= removedBefore;
            newOrd.splice(insertAt, 0, ...movingIds);
            setCategoryOrders(prev => ({ ...prev, [source.id]: newOrd }));
            safe_order(newOrd, source.id);
            playSound('ideaDragDrop');
          }
        } else if (dropTarget) {
          const targetCatId = dropTarget.type === "category" ? parseInt(dropTarget.id) : null;
          if (targetCatId !== null || dropTarget.type === "unassigned") {
            if (source.type === "all") {
              const idsToMove = isMultiDrag
                ? [...selectedIdeaIds].map(pid => ideas[pid]).filter(Boolean).map(i => i.idea_id)
                : [idea.idea_id];
              Promise.all(idsToMove.map(ideaId =>
                authFetch(`${API}/user/ideas/copy/`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idea_id: ideaId, category_id: targetCatId }),
                })
              ))
                .then(() => { playSound('ideaCreate'); fetch_all_ideas(); })
                .catch(err => console.error("Multi-copy on drag failed:", err));
            } else {
              const placementIds = isMultiDrag ? [...selectedIdeaIds] : [idea.placement_id];
              Promise.all(placementIds.map(pid =>
                authFetch(`${API}/user/ideas/assign_to_category/`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ placement_id: pid, category_id: targetCatId }),
                })
              ))
                .then(() => { playSound('ideaDragDrop'); fetch_all_ideas(); })
                .catch(err => console.error("Multi-move on drag failed:", err));
            }
          }
        }
      }

      setDragging(null);
      setPrevIndex(null);
      setHoverIndex(null);
      setDragSource(null);
      setHoverCategory(null);
      setHoverUnassigned(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [ideas, unassignedOrder, categoryOrders, categories, selectedIdeaIds,
      safe_order, fetch_all_ideas, delete_idea, projectId, setConfirmModal,
      setUnassignedOrder, setCategoryOrders]);

  // ── Type drag handler ──
  const handleTypeDrag = useCallback((e, legendTypeId) => {
    e.preventDefault();
    e.stopPropagation();
    let currentHoverIdeaId = null;
    setDraggingType({
      id: legendTypeId, x: e.clientX, y: e.clientY,
      color: legendTypeId ? dims.legendTypes[legendTypeId]?.color : "#374151",
    });
    const onMove = (ev) => {
      setDraggingType(prev => ({ ...prev, x: ev.clientX, y: ev.clientY }));
      let found = null;
      for (const [refKey, ref] of Object.entries(ideaRefs.current)) {
        if (ref) {
          const r = ref.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            found = (refKey.startsWith("meta_") || refKey.startsWith("all_")) ? refKey : parseInt(refKey); break;
          }
        }
      }
      currentHoverIdeaId = found;
      setHoverIdeaForType(found);
    };
    const onUp = () => {
      if (currentHoverIdeaId) {
        const actualId = String(currentHoverIdeaId).startsWith("meta_")
          ? parseInt(String(currentHoverIdeaId).replace("meta_", ""))
          : String(currentHoverIdeaId).startsWith("all_")
          ? parseInt(String(currentHoverIdeaId).replace("all_", ""))
          : currentHoverIdeaId;
        assign_idea_legend_type(actualId, legendTypeId, dims);
      }
      setDraggingType(null);
      setHoverIdeaForType(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dims, assign_idea_legend_type]);

  return {
    dragging, setDragging,
    dragSource, setDragSource,
    prevIndex, setPrevIndex,
    hoverIndex, setHoverIndex,
    hoverCategory, setHoverCategory,
    hoverUnassigned, setHoverUnassigned,
    externalGhost, setExternalGhost,
    draggingType, setDraggingType,
    hoverIdeaForType, setHoverIdeaForType,
    handleIdeaDrag,
    handleTypeDrag,
  };
}
