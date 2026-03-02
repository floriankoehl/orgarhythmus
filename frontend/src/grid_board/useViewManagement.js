// Saved-view management application service.
// Generic version — API calls extracted into callbacks.

import { useState, useRef, useCallback, useEffect } from 'react';
import { getDefaultViewState } from './viewDefaults';
import { playSound } from '../assets/sound_registry';

/**
 * Manages the list of saved views, view transitions, and all view CRUD operations.
 *
 * View callbacks (adapter-supplied):
 * @param {Function} params.fetchViews       - async () => views[]
 * @param {Function} params.createViewApi    - async (data) => created
 * @param {Function} params.updateViewApi    - async (viewId, data) => updated
 * @param {Function} params.deleteViewApi    - async (viewId) => void
 * @param {Function} params.setDefaultViewApi - async (viewId) => views[]
 * @param {Function} params.collectViewState - stable callback that snapshots the current view state
 * @param {Function} params.applyViewState   - stable callback that restores a saved view state
 */
export function useViewManagement({
  collectViewState,
  applyViewState,
  // Persist callbacks (adapter-supplied)
  fetchViews,
  createViewApi,
  updateViewApi,
  deleteViewApi,
  setDefaultViewApi,
}) {
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null);
  const [activeViewName, setActiveViewName] = useState('Default');

  // Slide-in / slide-out animation state
  const [viewTransition, setViewTransition] = useState(null);
  const viewTransitionRef = useRef(null);

  // Momentary "name flash" overlay
  const [viewFlashName, setViewFlashName] = useState(null);
  const viewFlashTimerRef = useRef(null);
  const viewFlashCounterRef = useRef(0);

  // ── Auto-load the default view on mount ──

  useEffect(() => {
    if (!fetchViews) return;
    fetchViews()
      .then(views => {
        const data = views || [];
        setSavedViews(data);
        const defaultView = data.find(v => v.is_default);
        if (defaultView) {
          applyViewState(defaultView.state);
          setActiveViewId(defaultView.id);
          setActiveViewName(defaultView.name);
        }
      })
      .catch(err => console.error('Failed to load views:', err));
  }, [fetchViews]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const updated = await updateViewApi(activeViewId, { state });
      setSavedViews(prev => prev.map(v => (v.id === activeViewId ? { ...v, ...updated } : v)));
      playSound('viewSave');
    } catch (err) {
      console.error('Failed to save view:', err);
      alert('Failed to save view: ' + (err.message || err));
    }
  }, [activeViewId, collectViewState, updateViewApi]);

  const handleCreateView = useCallback(async (name) => {
    if (!name?.trim()) return;
    try {
      const state = collectViewState();
      const created = await createViewApi({ name: name.trim(), state });
      setSavedViews(prev => [...prev, created]);
      setActiveViewId(created.id);
      setActiveViewName(created.name);
      playSound('viewSave');
    } catch (err) {
      console.error('Failed to create view:', err);
      alert('Failed to create view: ' + (err.message || err));
    }
  }, [collectViewState, createViewApi]);

  const handleRenameView = useCallback(async (viewId, newName) => {
    if (!newName?.trim()) return;
    try {
      const updated = await updateViewApi(viewId, { name: newName.trim() });
      setSavedViews(prev => prev.map(v => (v.id === viewId ? { ...v, ...updated } : v)));
      if (viewId === activeViewId) setActiveViewName(newName.trim());
    } catch (err) {
      console.error('Failed to rename view:', err);
      alert('Failed to rename view: ' + (err.message || err));
    }
  }, [activeViewId, updateViewApi]);

  const handleDeleteView = useCallback(async (viewId) => {
    try {
      await deleteViewApi(viewId);
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
      if (viewId === activeViewId) {
        setActiveViewId(null);
        setActiveViewName('Default');
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
      alert('Failed to delete view: ' + (err.message || err));
    }
  }, [activeViewId, deleteViewApi]);

  const handleSetDefaultView = useCallback(async (viewId) => {
    try {
      const updatedViews = await setDefaultViewApi(viewId);
      setSavedViews(updatedViews || []);
    } catch (err) {
      console.error('Failed to set default view:', err);
      alert('Failed to set default view: ' + (err.message || err));
    }
  }, [setDefaultViewApi]);

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
  };
}
