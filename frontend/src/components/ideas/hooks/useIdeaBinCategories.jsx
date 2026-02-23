import { useState, useRef, useCallback } from "react";
import { playSound } from "../../../assets/sound_registry";
import {
  fetchCategories as fetchCategoriesApi,
  createCategoryApi,
  setPositionCategory,
  setAreaCategory,
  bringToFrontCategory as bringToFrontCategoryApi,
  deleteCategoryApi,
  mergeCategoriesApi,
  renameCategoryApi,
  toggleArchiveCategory as toggleArchiveCategoryApiCall,
  togglePublicCategory as togglePublicCategoryApiCall,
  dropAdoptedCategoryApi,
  createCategoryWithIdeas,
} from "../api/categoryApi";
import {
  assignCategoryToContextApi,
} from "../api/contextApi";

export default function useIdeaBinCategories({ activeContext, setActiveContext, fetchAllIdeas, selectedCategoryIds }) {
  const [categories, setCategories] = useState({});
  const [displayCategoryForm, setDisplayCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPublic, setNewCategoryPublic] = useState(false);
  const categoryContainerRef = useRef(null);

  // ── Edit state ──
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // ── Category settings dropdown ──
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(null);

  // ── Docked categories ──
  const [dockedCategories, setDockedCategories] = useState([]);

  // ── Minimized categories ──
  const [minimizedCategories, setMinimizedCategories] = useState({});

  // ── Merge target ──
  const [mergeCategoryTarget, setMergeCategoryTarget] = useState(null);

  const fetch_categories = useCallback(async () => {
    try {
      const serialized = await fetchCategoriesApi();
      setCategories(serialized);
    } catch (err) { console.error("IdeaBin: fetch categories failed", err); }
  }, []);

  const create_category_api = useCallback(async () => {
    if (!newCategoryName.trim()) return;
    const data = await createCategoryApi(newCategoryName.trim(), newCategoryPublic);
    setNewCategoryName("");
    setNewCategoryPublic(false);
    setDisplayCategoryForm(false);
    playSound('ideaCategoryCreate');
    await fetch_categories();
    // Auto-assign to active context if inside one
    if (activeContext && data.category?.id) {
      try {
        await assignCategoryToContextApi(data.category.id, activeContext.id);
        setActiveContext(prev => prev ? { ...prev, category_ids: [...(prev.category_ids || []), data.category.id] } : prev);
      } catch (err) { console.error("Auto-assign category to context failed", err); }
    }
  }, [newCategoryName, newCategoryPublic, activeContext, setActiveContext, fetch_categories]);

  const set_position_category = useCallback(async (id, pos) => {
    await setPositionCategory(id, pos);
  }, []);

  const set_area_category = useCallback(async (id, width, height) => {
    await setAreaCategory(id, width, height);
  }, []);

  const bring_to_front_category = useCallback(async (id) => {
    await bringToFrontCategoryApi(id);
    setCategories(prev => {
      const maxZ = Math.max(0, ...Object.values(prev).map(c => c.z_index || 0));
      return { ...prev, [id]: { ...prev[id], z_index: maxZ + 1 } };
    });
  }, []);

  const delete_category = useCallback(async (id) => {
    try {
      const res = await deleteCategoryApi(id);
      if (res.ok) {
        setCategories(prev => { const u = { ...prev }; delete u[id]; return u; });
        playSound('ideaCategoryDelete');
        await fetchAllIdeas();
      }
    } catch (err) { console.error("IdeaBin: delete category failed", err); }
  }, [fetchAllIdeas]);

  const merge_categories_api = useCallback(async (sourceId, targetId) => {
    try {
      const res = await mergeCategoriesApi(sourceId, targetId);
      if (res.ok) {
        setCategories(prev => { const u = { ...prev }; delete u[sourceId]; return u; });
        setDockedCategories(prev => prev.filter(id => id !== String(sourceId)));
        playSound('ideaDragDrop');
        await fetchAllIdeas();
        fetch_categories();
      }
    } catch (err) { console.error("IdeaBin: merge categories failed", err); }
  }, [fetchAllIdeas, fetch_categories]);

  const rename_category_api = useCallback(async (id, newName) => {
    await renameCategoryApi(id, newName);
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], name: newName } }));
  }, []);

  const toggle_archive_category = useCallback(async (id) => {
    const data = await toggleArchiveCategoryApiCall(id);
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], archived: data.archived } }));
    playSound('ideaCategoryArchive');
  }, []);

  const toggle_public_category = useCallback(async (id) => {
    const data = await togglePublicCategoryApiCall(id);
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], is_public: data.is_public } }));
  }, []);

  const drop_adopted_category = useCallback(async (id) => {
    await dropAdoptedCategoryApi(id);
    setCategories(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const createCategoryFromFilter = useCallback(async (name, passesAllFilters, ideas) => {
    const seen = new Set();
    const matchedIdeaIds = [];
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      if (passesAllFilters(p)) {
        matchedIdeaIds.push(p.idea_id);
      }
    }
    if (matchedIdeaIds.length === 0) return;
    try {
      await createCategoryWithIdeas(name, matchedIdeaIds, activeContext?.id);
      playSound('ideaCategoryCreate');
      await fetch_categories();
      await fetchAllIdeas();
      // Auto-assign to context
      if (activeContext) {
        const serialized = await fetchCategoriesApi();
        const allCats = Object.values(serialized);
        const latest = allCats.sort((a, b) => b.id - a.id)[0];
        if (latest) {
          setActiveContext(prev => prev ? { ...prev, category_ids: [...(prev.category_ids || []), latest.id] } : prev);
        }
      }
    } catch (err) { console.error("Create category from filter failed:", err); }
  }, [activeContext, setActiveContext, fetch_categories, fetchAllIdeas]);

  // ── Category drag (with merge support in refactor mode, multi-move) ──
  const handleCategoryDrag = useCallback((e, catKey, { refactorMode, setConfirmModal }) => {
    e.stopPropagation();
    const cat = categories[catKey];
    if (!categoryContainerRef.current) return;
    const rect = categoryContainerRef.current.getBoundingClientRect();
    bring_to_front_category(catKey);

    // Determine which categories move together
    const isMulti = selectedCategoryIds && selectedCategoryIds.size > 1 && (selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey)));
    const movingKeys = isMulti ? [...selectedCategoryIds] : [catKey];

    // Capture start positions for all moving categories
    const startPositions = {};
    movingKeys.forEach(k => {
      const c = categories[k];
      if (c) startPositions[k] = { x: c.x, y: c.y, width: c.width, height: c.height };
    });

    const startX = e.clientX;
    const startY = e.clientY;
    let currentMergeTarget = null;
    let lastDx = 0, lastDy = 0;

    const onMove = (ev) => {
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;

      setCategories(prev => {
        const next = { ...prev };
        for (const k of movingKeys) {
          const sp = startPositions[k];
          if (!sp || !next[k]) continue;
          const nx = Math.max(0, sp.x + lastDx);
          const ny = Math.max(0, sp.y + lastDy);
          next[k] = { ...next[k], x: nx, y: ny };
        }
        return next;
      });

      // Merge detection only for single-drag in refactor mode
      if (refactorMode && !isMulti) {
        const nx = Math.max(0, startPositions[catKey].x + lastDx);
        const ny = Math.max(0, startPositions[catKey].y + lastDy);
        const dragCenterX = nx + cat.width / 2;
        const dragCenterY = ny + cat.height / 2;
        let found = null;
        for (const [ck, cd] of Object.entries(categories)) {
          if (ck === catKey || cd.archived || dockedCategories.includes(String(ck))) continue;
          if (dragCenterX >= cd.x && dragCenterX <= cd.x + cd.width &&
              dragCenterY >= cd.y && dragCenterY <= cd.y + cd.height) {
            found = ck;
            break;
          }
        }
        currentMergeTarget = found;
        setMergeCategoryTarget(found);
      }
    };
    const onUp = () => {
      if (refactorMode && !isMulti && currentMergeTarget && currentMergeTarget !== catKey) {
        const targetCat = categories[currentMergeTarget];
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">Merge categories?</p>
              <p className="text-xs text-gray-600">
                Move all ideas from <span className="font-semibold">"{cat.name}"</span> into{" "}
                <span className="font-semibold">"{targetCat?.name}"</span>.{" "}
                <span className="text-red-600 font-semibold">"{cat.name}" will be deleted.</span>
              </p>
            </div>
          ),
          confirmLabel: "Merge",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: () => {
            merge_categories_api(catKey, currentMergeTarget);
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      } else {
        // Persist final positions for all moved categories
        for (const k of movingKeys) {
          const sp = startPositions[k];
          if (!sp) continue;
          const finalX = Math.max(0, sp.x + lastDx);
          const finalY = Math.max(0, sp.y + lastDy);
          set_position_category(k, { x: finalX, y: finalY });
        }
      }
      setMergeCategoryTarget(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [categories, dockedCategories, bring_to_front_category, merge_categories_api, set_position_category, selectedCategoryIds]);

  // ── Category resize (multi-resize when multiple selected) ──
  const handleCategoryResize = useCallback((e, catKey, edge = "se") => {
    e.preventDefault();
    e.stopPropagation();
    bring_to_front_category(catKey);
    if (!categoryContainerRef.current) return;

    // Determine which categories resize together
    const isMulti = selectedCategoryIds && selectedCategoryIds.size > 1 && (selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey)));
    const resizingKeys = isMulti ? [...selectedCategoryIds] : [catKey];

    // Capture start state for all resizing categories
    const startStates = {};
    resizingKeys.forEach(k => {
      const c = categories[k];
      if (c) {
        startStates[k] = {
          x: c.x, y: c.y, width: c.width, height: c.height,
          minW: Math.max(80, (c.name?.length || 5) * 9 + 60),
          minH: 50,
        };
      }
    });

    const startX = e.clientX;
    const startY = e.clientY;

    const resizeW = edge.includes("w");
    const resizeE = edge.includes("e");
    const resizeN = edge.includes("n");
    const resizeS = edge.includes("s") || edge === "s";

    // Track final states for persistence
    const finalStates = {};

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      setCategories(prev => {
        const next = { ...prev };
        for (const k of resizingKeys) {
          const ss = startStates[k];
          if (!ss || !next[k]) continue;
          let fw = ss.width, fh = ss.height, fx = ss.x, fy = ss.y;

          if (resizeE) {
            fw = Math.max(ss.minW, ss.width + dx);
          } else if (resizeW) {
            const newW = Math.max(ss.minW, ss.width - dx);
            fx = ss.x + (ss.width - newW);
            fw = newW;
          }

          if (resizeS) {
            fh = Math.max(ss.minH, ss.height + dy);
          } else if (resizeN) {
            const newH = Math.max(ss.minH, ss.height - dy);
            fy = ss.y + (ss.height - newH);
            fh = newH;
          }

          // Clamp position to canvas (don't go negative)
          fx = Math.max(0, fx);
          fy = Math.max(0, fy);

          finalStates[k] = { x: fx, y: fy, width: fw, height: fh };
          next[k] = { ...next[k], width: fw, height: fh, x: fx, y: fy };
        }
        return next;
      });
    };
    const onUp = () => {
      // Persist all resized categories
      for (const k of resizingKeys) {
        const fs = finalStates[k];
        const ss = startStates[k];
        if (!fs || !ss) continue;
        set_area_category(k, fs.width, fs.height);
        if (fs.x !== ss.x || fs.y !== ss.y) {
          set_position_category(k, { x: fs.x, y: fs.y });
        }
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [categories, bring_to_front_category, set_area_category, set_position_category, selectedCategoryIds]);

  return {
    categories, setCategories,
    displayCategoryForm, setDisplayCategoryForm,
    newCategoryName, setNewCategoryName,
    newCategoryPublic, setNewCategoryPublic,
    categoryContainerRef,
    editingCategoryId, setEditingCategoryId,
    editingCategoryName, setEditingCategoryName,
    categorySettingsOpen, setCategorySettingsOpen,
    dockedCategories, setDockedCategories,
    minimizedCategories, setMinimizedCategories,
    mergeCategoryTarget, setMergeCategoryTarget,

    fetch_categories,
    create_category_api,
    set_position_category,
    set_area_category,
    bring_to_front_category,
    delete_category,
    merge_categories_api,
    rename_category_api,
    toggle_archive_category,
    toggle_public_category,
    drop_adopted_category,
    createCategoryFromFilter,
    handleCategoryDrag,
    handleCategoryResize,
  };
}
