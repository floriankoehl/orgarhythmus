import { useState, useCallback, useEffect } from "react";

/**
 * Manages saved views for the Task Structure page.
 *
 * A "view" stores grouping mode, active filters, and panel states.
 * Persisted per-project in localStorage.
 *
 * Terminology: always "View", never "Perspective" (per SRS §5).
 */
const VIEWS_KEY = (projectId) => `ts_views_${projectId}`;

function loadViews(projectId) {
  try {
    const raw = localStorage.getItem(VIEWS_KEY(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistViews(projectId, views) {
  try {
    localStorage.setItem(VIEWS_KEY(projectId), JSON.stringify(views));
  } catch { /* ignore */ }
}

export default function useTaskViews({ projectId }) {
  const [views, setViews] = useState([]);
  const [activeViewIdx, setActiveViewIdx] = useState(null);
  const [groupBy, setGroupBy] = useState("team"); // "team" | legendId

  // Load views on mount / project change
  useEffect(() => {
    const loaded = loadViews(projectId);
    setViews(loaded);
    // Restore last active view
    if (loaded.length > 0) {
      const lastIdx = loaded.findIndex((v) => v.isActive);
      if (lastIdx >= 0) {
        setActiveViewIdx(lastIdx);
        setGroupBy(loaded[lastIdx].groupBy || "team");
      }
    }
  }, [projectId]);

  // ── Save view ──
  const saveView = useCallback((name, state) => {
    const view = {
      name: name || `View ${new Date().toLocaleTimeString()}`,
      groupBy: state.groupBy || groupBy,
      filters: state.filters || {},
      createdAt: new Date().toISOString(),
      isActive: false,
    };
    setViews((prev) => {
      const next = [...prev, view];
      persistViews(projectId, next);
      return next;
    });
  }, [projectId, groupBy]);

  // ── Load / activate view ──
  const loadView = useCallback((idx) => {
    const view = views[idx];
    if (!view) return null;
    setActiveViewIdx(idx);
    setGroupBy(view.groupBy || "team");
    // Mark as active
    setViews((prev) => {
      const next = prev.map((v, i) => ({ ...v, isActive: i === idx }));
      persistViews(projectId, next);
      return next;
    });
    return view;
  }, [views, projectId]);

  // ── Delete view ──
  const deleteView = useCallback((idx) => {
    setViews((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      persistViews(projectId, next);
      return next;
    });
    if (activeViewIdx === idx) setActiveViewIdx(null);
  }, [projectId, activeViewIdx]);

  // ── Rename view ──
  const renameView = useCallback((idx, newName) => {
    setViews((prev) => {
      const next = prev.map((v, i) => i === idx ? { ...v, name: newName } : v);
      persistViews(projectId, next);
      return next;
    });
  }, [projectId]);

  return {
    views,
    activeViewIdx,
    groupBy,
    setGroupBy,
    saveView,
    loadView,
    deleteView,
    renameView,
  };
}
