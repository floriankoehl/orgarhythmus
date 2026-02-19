// Saved-view management application service.
// Extracted from Dependencies.jsx to keep the component a thin composition root.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  get_all_views,
  create_view,
  update_view,
  delete_view,
  set_default_view,
} from '../../api/dependencies_api';
import { getDefaultViewState } from './viewDefaults';
import { playSound } from '../../assets/sound_registry';

/**
 * Manages the list of saved views, view transitions, and all view CRUD operations.
 *
 * @param {{ projectId, collectViewState, applyViewState }} params
 *   collectViewState — stable callback that snapshots the current view state
 *   applyViewState  — stable callback that restores a saved view state
 */
export function useViewManagement({ projectId, collectViewState, applyViewState }) {
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [activeViewName, setActiveViewName] = useState('Default');

  // Slide-in / slide-out animation state
  const [viewTransition, setViewTransition] = useState(null); // 'out' | 'in-start' | 'in' | null
  const viewTransitionRef = useRef(null);

  // Momentary "name flash" overlay
  const [viewFlashName, setViewFlashName] = useState(null);
  const viewFlashTimerRef = useRef(null);
  const viewFlashCounterRef = useRef(0);

  // ── Auto-load the default view on mount ──

  useEffect(() => {
    if (!projectId) return;
    get_all_views(projectId)
      .then(data => {
        const views = data || [];
        setSavedViews(views);
        const defaultView = views.find(v => v.is_default);
        if (defaultView) {
          applyViewState(defaultView.state);
          setActiveViewId(defaultView.id);
          setActiveViewName(defaultView.name);
        }
      })
      .catch(err => console.error('Failed to load views:', err));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  // `applyViewState` is created with useCallback in the parent (Dependencies.jsx) and
  // is guaranteed stable for the lifetime of DependenciesContent. Re-running this
  // effect when it changes would trigger an unnecessary second network request on
  // every render cycle where the parent rebuilds the callback reference.

  // ── Load / switch ──

  const handleLoadView = useCallback((view) => {
    setViewTransition('out');
    if (viewTransitionRef.current) clearTimeout(viewTransitionRef.current);

    viewTransitionRef.current = setTimeout(() => {
      const viewName = view ? view.name : 'Default';
      if (!view) {
        applyViewState(getDefaultViewState());
        setActiveViewId(null);
        setActiveViewName('Default');
      } else {
        applyViewState(view.state);
        setActiveViewId(view.id);
        setActiveViewName(view.name);
      }

      if (viewFlashTimerRef.current) clearTimeout(viewFlashTimerRef.current);
      viewFlashCounterRef.current += 1;
      setViewFlashName({ name: viewName, key: viewFlashCounterRef.current });
      viewFlashTimerRef.current = setTimeout(() => setViewFlashName(null), 1200);

      setViewTransition('in-start');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setViewTransition('in');
          viewTransitionRef.current = setTimeout(() => setViewTransition(null), 280);
        });
      });
      playSound('viewLoad');
    }, 220);
  }, [applyViewState]);

  const handleNextView = useCallback(() => {
    const allViews = [null, ...savedViews];
    const currentIdx = activeViewId
      ? allViews.findIndex(v => v && v.id === activeViewId)
      : 0;
    handleLoadView(allViews[(currentIdx + 1) % allViews.length]);
  }, [savedViews, activeViewId, handleLoadView]);

  const handlePrevView = useCallback(() => {
    const allViews = [null, ...savedViews];
    const currentIdx = activeViewId
      ? allViews.findIndex(v => v && v.id === activeViewId)
      : 0;
    handleLoadView(allViews[(currentIdx - 1 + allViews.length) % allViews.length]);
  }, [savedViews, activeViewId, handleLoadView]);

  // ── CRUD ──

  const handleSaveView = useCallback(async () => {
    if (!activeViewId) return;
    try {
      const state = collectViewState();
      const updated = await update_view(projectId, activeViewId, { state });
      setSavedViews(prev => prev.map(v => (v.id === activeViewId ? { ...v, ...updated } : v)));
      playSound('viewSave');
    } catch (err) {
      console.error('Failed to save view:', err);
      alert('Failed to save view: ' + (err.message || err));
    }
  }, [projectId, activeViewId, collectViewState]);

  const handleCreateView = useCallback(async (name) => {
    if (!name?.trim()) return;
    try {
      const state = collectViewState();
      const created = await create_view(projectId, { name: name.trim(), state });
      setSavedViews(prev => [...prev, created]);
      setActiveViewId(created.id);
      setActiveViewName(created.name);
      playSound('viewSave');
    } catch (err) {
      console.error('Failed to create view:', err);
      alert('Failed to create view: ' + (err.message || err));
    }
  }, [projectId, collectViewState]);

  const handleRenameView = useCallback(async (viewId, newName) => {
    if (!newName?.trim()) return;
    try {
      const updated = await update_view(projectId, viewId, { name: newName.trim() });
      setSavedViews(prev => prev.map(v => (v.id === viewId ? { ...v, ...updated } : v)));
      if (viewId === activeViewId) setActiveViewName(newName.trim());
    } catch (err) {
      console.error('Failed to rename view:', err);
      alert('Failed to rename view: ' + (err.message || err));
    }
  }, [projectId, activeViewId]);

  const handleDeleteView = useCallback(async (viewId) => {
    try {
      await delete_view(projectId, viewId);
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
      if (viewId === activeViewId) {
        setActiveViewId(null);
        setActiveViewName('Default');
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
      alert('Failed to delete view: ' + (err.message || err));
    }
  }, [projectId, activeViewId]);

  const handleSetDefaultView = useCallback(async (viewId) => {
    try {
      const updatedViews = await set_default_view(projectId, viewId);
      setSavedViews(updatedViews || []);
    } catch (err) {
      console.error('Failed to set default view:', err);
      alert('Failed to set default view: ' + (err.message || err));
    }
  }, [projectId]);

  const handleUpdateViewShortcut = useCallback(async (viewId, key) => {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;
    try {
      const newState = { ...(view.state || {}), viewShortcutKey: key || null };
      const updated = await update_view(projectId, viewId, { state: newState });
      setSavedViews(prev => prev.map(v => (v.id === viewId ? { ...v, ...updated } : v)));
      playSound('uiClick');
    } catch (err) {
      console.error('Failed to update view shortcut:', err);
    }
  }, [projectId, savedViews]);

  return {
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    activeViewName,
    setActiveViewName,
    viewTransition,
    viewFlashName,
    handleLoadView,
    handleNextView,
    handlePrevView,
    handleSaveView,
    handleCreateView,
    handleRenameView,
    handleDeleteView,
    handleSetDefaultView,
    handleUpdateViewShortcut,
  };
}
