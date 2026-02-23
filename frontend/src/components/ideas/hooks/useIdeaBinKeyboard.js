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
    legendFilters, filterCombineMode, globalTypeFilter, dims,
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
        if (selectedIdeaIds.size === 1) {
          const theId = [...selectedIdeaIds][0];
          e.preventDefault();
          const idea = ideas[theId];
          const catId = idea?.category ? String(idea.category) : null;
          setHeadlineModeIdeaId(prev => prev === theId ? null : theId);
          if (catId) setHeadlineModeCategoryId(catId);
          else setHeadlineModeCategoryId(null);
          return;
        }
        if (selectedCategoryIds.size === 1) {
          const theCatId = [...selectedCategoryIds][0];
          e.preventDefault();
          setHeadlineModeIdeaId(null);
          setHeadlineModeCategoryId(prev => {
            if (prev === String(theCatId)) return null;
            return String(theCatId);
          });
        }
      }
    };
    window.addEventListener("keydown", handleHeadlineKey);
    return () => window.removeEventListener("keydown", handleHeadlineKey);
  }, [isOpen, isFocused, selectedCategoryIds, selectedIdeaIds, ideas]);

  // ── shared archive handler for Delete & Backspace ──
  const archiveHandler = useCallback((e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (selectedIdeaIds.size === 0) return;
    e.preventDefault();

    const count = selectedIdeaIds.size;
    const ideaIds = [...selectedIdeaIds];
    const metaIds = [...new Set(ideaIds.map(id => ideas[id]?.idea_id).filter(Boolean))];

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
  }, [selectedIdeaIds, ideas, toggle_archive_idea, setConfirmModal, setSelectedIdeaIds]);

  // ── Delete key – archive selected ideas ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    window.addEventListener("keydown", archiveHandler);
    return () => window.removeEventListener("keydown", archiveHandler);
  }, [isOpen, isFocused, archiveHandler]);

  // ── Backspace key – same archive (keeps hook count stable) ──
  useEffect(() => {
    // intentionally empty – archiveHandler above handles both keys
  }, [isOpen, isFocused, archiveHandler]);

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
  const passesAllFilters = useCallback((idea) => {
    if (!idea) return false;
    const hasLF = legendFilters.length > 0;
    if (hasLF) {
      const results = legendFilters.map(f => {
        const legId = String(f.legendId);
        const dt = idea.legend_types?.[legId];
        const typeId = dt?.legend_type_id;
        const hasType = !!dt;
        const matchesSelected = f.typeIds.includes("unassigned")
          ? (!hasType || f.typeIds.includes(typeId))
          : (hasType && f.typeIds.includes(typeId));
        return f.mode === "exclude" ? !matchesSelected : matchesSelected;
      });
      return filterCombineMode === "and" ? results.every(Boolean) : results.some(Boolean);
    }
    if (globalTypeFilter.length > 0) {
      const dimId = String(dims?.activeLegendId || "");
      const dt = idea.legend_types?.[dimId];
      if (globalTypeFilter.includes("unassigned") && !dt) return true;
      if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
      return false;
    }
    return true;
  }, [legendFilters, filterCombineMode, globalTypeFilter, dims?.activeLegendId]);

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
        // Ctrl+A → select all displayed ideas on the canvas
        const activeCats = getActiveCategories();
        const allIds = new Set();
        for (const [catKey] of activeCats) {
          for (const pid of (categoryOrders[catKey] || [])) {
            if (passesAllFilters(ideas[pid])) allIds.add(pid);
          }
        }
        setSelectedIdeaIds(allIds);
        setSelectedCategoryIds(new Set());
      }
    };
    window.addEventListener("keydown", handleSelectAll);
    return () => window.removeEventListener("keydown", handleSelectAll);
  }, [isOpen, isFocused, categories, categoryOrders, ideas,
      passesAllFilters, getActiveCategories,
      setSelectedIdeaIds, setSelectedCategoryIds]);

  return {
    isFocused, setIsFocused,
    refactorMode, setRefactorMode,
  };
}
