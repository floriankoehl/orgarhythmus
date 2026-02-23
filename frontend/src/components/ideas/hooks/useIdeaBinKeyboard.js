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
    selectedIdeaIds, ideas, categories,
    headlineModeCategoryId, setHeadlineModeCategoryId,
    headlineModeIdeaId, setHeadlineModeIdeaId,
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

  return {
    isFocused, setIsFocused,
    refactorMode, setRefactorMode,
  };
}
