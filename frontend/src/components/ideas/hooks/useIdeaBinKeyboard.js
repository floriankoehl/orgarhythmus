import { useState, useEffect, useCallback } from "react";

/**
 * Manages keyboard shortcuts & focus tracking for IdeaBin.
 * - Focus tracking (mousedown inside/outside)
 * - R key: toggle refactor mode
 * - H key: toggle headline mode
 * - Ctrl+V: paste copied idea
 */
export default function useIdeaBinKeyboard(deps) {
  const {
    isOpen, windowRef,
    copiedIdeaId, selectedCategoryIds, setSelectedCategoryIds, paste_idea,
    selectedIdeaIds, setSelectedIdeaIds, ideas, categories,
    headlineModeCategoryId, setHeadlineModeCategoryId,
    headlineModeIdeaId, setHeadlineModeIdeaId,
    delete_idea, remove_idea_from_category, toggle_archive_idea,
    setConfirmModal,
    paintType, setPaintType,
    // Ctrl+A / Ctrl+Shift+A deps
    categoryOrders, unassignedOrder, metaIdeaList,
    listFilter, viewMode, dockedCategories, activeContext,
    legendFilters, filterCombineMode, stackedFilters, stackCombineMode,
    globalTypeFilter, dims,
    sidebarFocused,
    undo, redo,
  } = deps;

  const [isFocused, setIsFocused] = useState(false);
  const [refactorMode, setRefactorMode] = useState(false);

  // ── Focus tracking: mousedown inside = focused, outside = unfocused ──
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalMouseDown = (e) => {
      const win = windowRef.current;
      if (win && win.contains(e.target)) {
        setIsFocused(true);
      } else {
        setIsFocused(false);
        setRefactorMode(false);
      }
    };
    document.addEventListener("mousedown", handleGlobalMouseDown, true);
    return () => document.removeEventListener("mousedown", handleGlobalMouseDown, true);
  }, [isOpen]);

  // ── Ctrl+V to paste copied idea ──
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey && e.key === "v" && copiedIdeaId) {
        e.preventDefault();
        paste_idea([...selectedCategoryIds][0] || null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, copiedIdeaId, selectedCategoryIds]);

  // ── "R" key toggles refactor mode when focused ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const handleRefactorKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setRefactorMode(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleRefactorKey);
    return () => window.removeEventListener("keydown", handleRefactorKey);
  }, [isOpen, isFocused]);

  // ── "H" key toggles headline mode ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const handleHeadlineKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "h" || e.key === "H") {
        // If already in headline mode (idea or category), toggle OFF and exit
        if (headlineModeIdeaId || headlineModeCategoryId) {
          e.preventDefault();
          setHeadlineModeIdeaId(null);
          setHeadlineModeCategoryId(null);
          return;
        }
        if (selectedIdeaIds.size === 1) {
          const theId = [...selectedIdeaIds][0];
          e.preventDefault();
          const idea = ideas[theId];
          const catId = idea?.category ? String(idea.category) : null;
          setHeadlineModeIdeaId(theId);
          setHeadlineModeCategoryId(catId);
          return;
        }
        if (selectedCategoryIds.size === 1) {
          const theCatId = [...selectedCategoryIds][0];
          e.preventDefault();
          setHeadlineModeIdeaId(null);
          setHeadlineModeCategoryId(String(theCatId));
        }
      }
    };
    window.addEventListener("keydown", handleHeadlineKey);
    return () => window.removeEventListener("keydown", handleHeadlineKey);
  }, [isOpen, isFocused, selectedCategoryIds, selectedIdeaIds, ideas, headlineModeIdeaId, headlineModeCategoryId]);

  // ── shared handler for Delete & Backspace ──
  const deleteHandler = useCallback((e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (selectedIdeaIds.size === 0) return;
    e.preventDefault();

    const count = selectedIdeaIds.size;
    const ideaIds = [...selectedIdeaIds];
    const metaIds = [...new Set(ideaIds.map(id => ideas[id]?.idea_id).filter(Boolean))];

    // Check which selected ideas are in a category (have a placement that can be removed)
    const inCategory = ideaIds.filter(id => ideas[id]?.category);
    const inCategoryCount = inCategory.length;

    if (inCategoryCount > 0) {
      // Primary action: unassign from category, secondary: archive
      setConfirmModal({
        message: count === 1
          ? `Remove this idea from its category?`
          : `Remove ${count} idea${count !== 1 ? "s" : ""} from ${inCategoryCount === count ? "their categories" : "categories"}?`,
        confirmLabel: "Unassign",
        confirmColor: "bg-amber-500 hover:bg-amber-600",
        onConfirm: () => {
          for (const id of inCategory) {
            remove_idea_from_category(id);
          }
          setSelectedIdeaIds(new Set());
          setConfirmModal(null);
        },
        middleLabel: "Archive",
        middleColor: "bg-indigo-500 hover:bg-indigo-600",
        onMiddle: () => {
          toggle_archive_idea(metaIds);
          setSelectedIdeaIds(new Set());
          setConfirmModal(null);
        },
        onCancel: () => setConfirmModal(null),
      });
    } else {
      // Not in any category — archive is the only meaningful action
      setConfirmModal({
        message: count === 1
          ? `Archive this idea?`
          : `Archive ${count} ideas?`,
        confirmLabel: "Archive",
        confirmColor: "bg-indigo-500 hover:bg-indigo-600",
        onConfirm: () => {
          toggle_archive_idea(metaIds);
          setSelectedIdeaIds(new Set());
          setConfirmModal(null);
        },
        onCancel: () => setConfirmModal(null),
      });
    }
  }, [selectedIdeaIds, ideas, toggle_archive_idea, remove_idea_from_category, setConfirmModal, setSelectedIdeaIds]);

  // ── Delete key – unassign / archive selected ideas ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    window.addEventListener("keydown", deleteHandler);
    return () => window.removeEventListener("keydown", deleteHandler);
  }, [isOpen, isFocused, deleteHandler]);

  // ── Backspace key – same handler (keeps hook count stable) ──
  useEffect(() => {
    // intentionally empty – deleteHandler above handles both keys
  }, [isOpen, isFocused, deleteHandler]);

  // ── Escape key – exit paint mode ──
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === "Escape" && paintType) {
        e.preventDefault();
        setPaintType(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, paintType, setPaintType]);

  // ── Ctrl+Z = undo, Ctrl+Y = redo ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const handleUndoRedo = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [isOpen, isFocused, undo, redo]);

  // ── Helper: compute passesAllFilters inside this hook ──
  // Evaluate a single group of rules against an idea
  const evalFilterGroup = useCallback((rules, combineMode, idea) => {
    if (rules.length === 0) return true;
    const results = rules.map(f => {
      const legId = String(f.legendId);
      const dt = idea.legend_types?.[legId];
      const typeId = dt?.legend_type_id;
      const hasType = !!dt;
      const matchesSelected = f.typeIds.includes("unassigned")
        ? (!hasType || f.typeIds.includes(typeId))
        : (hasType && f.typeIds.includes(typeId));
      return f.mode === "exclude" ? !matchesSelected : matchesSelected;
    });
    return combineMode === "and" ? results.every(Boolean) : results.some(Boolean);
  }, []);

  const passesAllFilters = useCallback((idea) => {
    if (!idea) return false;
    const hasLF = legendFilters.length > 0 || stackedFilters.length > 0;
    if (hasLF) {
      const groups = [];
      if (legendFilters.length > 0) {
        groups.push({ rules: legendFilters, combineMode: filterCombineMode });
      }
      for (const sg of stackedFilters) {
        if (sg.rules.length > 0) groups.push(sg);
      }
      if (groups.length === 0) return true;
      const groupResults = groups.map(g => evalFilterGroup(g.rules, g.combineMode, idea));
      return stackCombineMode === "and"
        ? groupResults.every(Boolean)
        : groupResults.some(Boolean);
    }
    if (globalTypeFilter.length > 0) {
      const dimId = String(dims?.activeLegendId || "");
      const dt = idea.legend_types?.[dimId];
      if (globalTypeFilter.includes("unassigned") && !dt) return true;
      if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
      return false;
    }
    return true;
  }, [legendFilters, filterCombineMode, stackedFilters, stackCombineMode, evalFilterGroup, globalTypeFilter, dims?.activeLegendId]);

  // ── Helper: get active (visible on canvas) categories ──
  const getActiveCategories = useCallback(() => {
    return Object.entries(categories).filter(([k, c]) => {
      if (c.archived || (dockedCategories || []).includes(String(k))) return false;
      if (activeContext) {
        return (activeContext.category_ids || []).includes(Number(k));
      }
      return true;
    });
  }, [categories, dockedCategories, activeContext]);

  // ── Ctrl+A = select all displayed ideas · Ctrl+Shift+A = select all displayed categories ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const handleSelectAll = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "a") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();

      if (e.shiftKey) {
        // Ctrl+Shift+A → select all currently displayed (active) categories
        const activeCats = getActiveCategories();
        setSelectedCategoryIds(new Set(activeCats.map(([k]) => k)));
        setSelectedIdeaIds(new Set());
      } else {
        // Ctrl+A → select ideas
        // If categories are selected, only select ideas within those categories;
        // otherwise select all ideas across all active categories.
        const hasSelectedCats = selectedCategoryIds && selectedCategoryIds.size > 0;
        const catsToScan = hasSelectedCats
          ? [...selectedCategoryIds].map(k => [String(k), categories[k]]).filter(([, c]) => c)
          : getActiveCategories();
        const allIds = new Set();
        for (const [catKey] of catsToScan) {
          for (const pid of (categoryOrders[catKey] || [])) {
            if (passesAllFilters(ideas[pid])) allIds.add(pid);
          }
        }
        setSelectedIdeaIds(allIds);
        // Don't clear category selection when scoped to selected categories
        if (!hasSelectedCats) setSelectedCategoryIds(new Set());
      }
    };
    window.addEventListener("keydown", handleSelectAll);
    return () => window.removeEventListener("keydown", handleSelectAll);
  }, [isOpen, isFocused, categories, categoryOrders, ideas,
      passesAllFilters, getActiveCategories, selectedCategoryIds,
      setSelectedIdeaIds, setSelectedCategoryIds]);

  return {
    isFocused, setIsFocused,
    refactorMode, setRefactorMode,
  };
}
