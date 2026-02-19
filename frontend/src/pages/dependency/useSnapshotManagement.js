// Project-snapshot management application service.
// Extracted from Dependencies.jsx to keep the component a thin composition root.

import { useState, useCallback, useEffect } from 'react';
import {
  list_snapshots,
  create_snapshot,
  restore_snapshot as restore_snapshot_api,
  delete_snapshot,
  rename_snapshot,
  get_all_views,
} from '../../api/dependencies_api';
import { playSound } from '../../assets/sound_registry';

/**
 * Manages project snapshots (full data + view state backups).
 *
 * @param {{ projectId, setReloadData, applyViewState, setActiveViewId, setActiveViewName, setSavedViews }} params
 */
export function useSnapshotManagement({
  projectId,
  setReloadData,
  applyViewState,
  setActiveViewId,
  setActiveViewName,
  setSavedViews,
}) {
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // ── Load on mount ──

  useEffect(() => {
    if (!projectId) return;
    list_snapshots(projectId)
      .then(data => setSnapshots(data.snapshots || []))
      .catch(err => console.error('Failed to load snapshots:', err));
  }, [projectId]);

  // ── CRUD ──

  const handleCreateSnapshot = useCallback(async (name, description) => {
    if (!name?.trim()) return;
    setSnapshotsLoading(true);
    try {
      const data = await create_snapshot(projectId, {
        name: name.trim(),
        description: description || '',
      });
      const created = data.snapshot || data;
      setSnapshots(prev => [created, ...prev]);
      playSound('snapshotSave');
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      alert('Failed to create snapshot: ' + (err.message || err));
    } finally {
      setSnapshotsLoading(false);
    }
  }, [projectId]);

  const handleQuickSaveSnapshot = useCallback(async () => {
    if (snapshots.length > 0) {
      const latest = snapshots[0];
      setSnapshotsLoading(true);
      try {
        const data = await create_snapshot(projectId, {
          name: latest.name,
          description: latest.description || '',
        });
        const created = data.snapshot || data;
        setSnapshots(prev => [created, ...prev]);
        playSound('snapshotSave');
      } catch (err) {
        console.error('Quick-save snapshot failed:', err);
      } finally {
        setSnapshotsLoading(false);
      }
    } else {
      await handleCreateSnapshot('Quick Save', '');
    }
  }, [projectId, snapshots, handleCreateSnapshot]);

  const handleRestoreSnapshot = useCallback(async (snapshotId) => {
    setSnapshotsLoading(true);
    try {
      await restore_snapshot_api(projectId, snapshotId);
      playSound('snapshotRestore');
      setReloadData(true);
      // Also reload views since they were restored too
      const viewData = await get_all_views(projectId);
      const views = viewData || [];
      setSavedViews(views);
      setActiveViewId(null);
      setActiveViewName('Default');
      const defaultView = views.find(v => v.is_default);
      if (defaultView) {
        applyViewState(defaultView.state);
        setActiveViewId(defaultView.id);
        setActiveViewName(defaultView.name);
      }
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
      alert('Failed to restore snapshot: ' + (err.message || err));
    } finally {
      setSnapshotsLoading(false);
    }
  }, [projectId, setReloadData, applyViewState, setSavedViews, setActiveViewId, setActiveViewName]);

  const handleDeleteSnapshot = useCallback(async (snapshotId) => {
    try {
      await delete_snapshot(projectId, snapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
      alert('Failed to delete snapshot: ' + (err.message || err));
    }
  }, [projectId]);

  const handleRenameSnapshot = useCallback(async (snapshotId, name, description) => {
    try {
      const data = await rename_snapshot(projectId, snapshotId, { name, description });
      const updated = data.snapshot || data;
      setSnapshots(prev => prev.map(s => (s.id === snapshotId ? { ...s, ...updated } : s)));
    } catch (err) {
      console.error('Failed to rename snapshot:', err);
      alert('Failed to rename snapshot: ' + (err.message || err));
    }
  }, [projectId]);

  return {
    snapshots,
    setSnapshots,
    snapshotsLoading,
    handleCreateSnapshot,
    handleQuickSaveSnapshot,
    handleRestoreSnapshot,
    handleDeleteSnapshot,
    handleRenameSnapshot,
  };
}
