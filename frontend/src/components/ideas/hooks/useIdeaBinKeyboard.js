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
    copiedIdeaId, selectedCategoryIds, paste_idea,
    selectedIdeaIds, setSelectedIdeaIds, ideas, categories,
    headlineModeCategoryId, setHeadlineModeCategoryId,
    headlineModeIdeaId, setHeadlineModeIdeaId,
    delete_idea, remove_idea_from_category,
    setConfirmModal,
    paintType, setPaintType,
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

  // ── Delete key – delete selected ideas ──
  useEffect(() => {
    if (!isOpen || !isFocused) return;
    const handleDeleteKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key !== "Delete") return;
      if (selectedIdeaIds.size === 0) return;
      e.preventDefault();

      const count = selectedIdeaIds.size;
      const ideaIds = [...selectedIdeaIds];
      // Check if any selected ideas belong to a category (for "remove reference" option)
      const hasCategory = ideaIds.some(id => {
        const idea = ideas[id];
        return idea && idea.category;
      });

      setConfirmModal({
        message: count === 1
          ? `Delete this idea permanently?`
          : `Delete ${count} ideas permanently?`,
        confirmLabel: "Yes, delete",
        confirmColor: "bg-red-500 hover:bg-red-600",
        onConfirm: () => {
          for (const id of ideaIds) {
            const idea = ideas[id];
            if (idea) delete_idea(idea.idea_id || id);
          }
          setSelectedIdeaIds(new Set());
          setConfirmModal(null);
        },
        onCancel: () => setConfirmModal(null),
        // Show "Remove from category" only if at least one idea has a category
        ...(hasCategory ? {
          middleLabel: count === 1 ? "Remove from category" : "Remove from categories",
          middleColor: "bg-amber-500 hover:bg-amber-600",
          onMiddle: () => {
            for (const id of ideaIds) {
              const idea = ideas[id];
              if (idea && idea.category) {
                remove_idea_from_category(id);
              }
            }
            setSelectedIdeaIds(new Set());
            setConfirmModal(null);
          },
        } : {}),
      });
    };
    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [isOpen, isFocused, selectedIdeaIds, ideas, delete_idea, remove_idea_from_category, setConfirmModal, setSelectedIdeaIds]);

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

  return {
    isFocused, setIsFocused,
    refactorMode, setRefactorMode,
  };
}
