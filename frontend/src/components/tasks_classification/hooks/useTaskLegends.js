import { useState, useEffect, useCallback } from "react";
import {
  fetchTaskLegendsApi,
  fetchTaskLegendTypesApi,
  createTaskLegendApi,
  updateTaskLegendApi,
  deleteTaskLegendApi,
  createTaskLegendTypeApi,
  updateTaskLegendTypeApi,
  deleteTaskLegendTypeApi,
} from "../api/taskLegendApi";

/**
 * Manages task legends and legend types, scoped to a Project.
 * Mirrors useLegends (context-scoped) but uses project-scoped endpoints.
 */
export default function useTaskLegends(projectId) {
  const [legends, setLegends] = useState([]);
  const [activeLegendId, setActiveLegendId] = useState(null);
  const [legendTypes, setLegendTypes] = useState({});
  const [hasUserSelected, setHasUserSelected] = useState(false);

  const setActiveLegendIdWrapped = (val) => {
    setHasUserSelected(true);
    setActiveLegendId(val);
  };

  // ── Fetch all legends for project ──
  const fetchLegends = useCallback(async (pid) => {
    const id = pid ?? projectId;
    if (!id) { setLegends([]); setActiveLegendId(null); setLegendTypes({}); return; }
    try {
      const legs = await fetchTaskLegendsApi(id);
      setLegends(legs);
      setActiveLegendId(prev => {
        if (prev && legs.some(l => l.id === prev)) return prev;
        return (legs.length > 0 && !hasUserSelected) ? legs[0].id : null;
      });
    } catch (err) {
      console.error("Failed to fetch task legends:", err);
    }
  }, [projectId, hasUserSelected]);

  // ── Fetch types for a legend ──
  const fetchTypes = useCallback(async (legendId) => {
    if (!legendId || !projectId) return;
    try {
      const typeArr = await fetchTaskLegendTypesApi(projectId, legendId);
      const typeObj = {};
      for (const t of typeArr) typeObj[t.id] = t;
      setLegendTypes(typeObj);
    } catch (err) {
      console.error("Failed to fetch task legend types:", err);
    }
  }, [projectId]);

  // ── Fetch types without setting state (for modals) ──
  const fetchTypesRaw = useCallback(async (legendId) => {
    if (!legendId || !projectId) return {};
    try {
      const typeArr = await fetchTaskLegendTypesApi(projectId, legendId);
      const typeObj = {};
      for (const t of typeArr) typeObj[t.id] = t;
      return typeObj;
    } catch (err) {
      console.error("Failed to fetch task legend types:", err);
      return {};
    }
  }, [projectId]);

  // ── Legend CRUD ──
  const createLegend = useCallback(async (name) => {
    if (!projectId) return;
    const data = await createTaskLegendApi(projectId, name);
    if (data.legend) {
      setLegends(prev => [...prev, data.legend]);
      setActiveLegendId(data.legend.id);
    }
    return data;
  }, [projectId]);

  const updateLegend = useCallback(async (legendId, name) => {
    if (!projectId) return;
    await updateTaskLegendApi(projectId, legendId, name);
    setLegends(prev => prev.map(d => d.id === legendId ? { ...d, name } : d));
  }, [projectId]);

  const deleteLegend = useCallback(async (legendId) => {
    if (!projectId) return;
    await deleteTaskLegendApi(projectId, legendId);
    setLegends(prev => {
      const updated = prev.filter(d => d.id !== legendId);
      if (activeLegendId === legendId) {
        setActiveLegendId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  }, [projectId, activeLegendId]);

  // ── Type CRUD ──
  const createType = useCallback(async (name, color, icon = null) => {
    if (!activeLegendId || !projectId) return;
    const data = await createTaskLegendTypeApi(projectId, activeLegendId, name, color, icon);
    if (data.type) {
      setLegendTypes(prev => ({ ...prev, [data.type.id]: data.type }));
    }
    return data;
  }, [projectId, activeLegendId]);

  const updateType = useCallback(async (typeId, updates) => {
    if (!activeLegendId || !projectId) return;
    await updateTaskLegendTypeApi(projectId, activeLegendId, typeId, updates);
    setLegendTypes(prev => ({ ...prev, [typeId]: { ...prev[typeId], ...updates } }));
  }, [projectId, activeLegendId]);

  const deleteType = useCallback(async (typeId) => {
    if (!activeLegendId || !projectId) return;
    await deleteTaskLegendTypeApi(projectId, activeLegendId, typeId);
    setLegendTypes(prev => {
      const updated = { ...prev };
      delete updated[typeId];
      return updated;
    });
  }, [projectId, activeLegendId]);

  // ── Auto-fetch on projectId / activeLegendId changes ──
  useEffect(() => {
    setHasUserSelected(false);
    fetchLegends(projectId);
  }, [projectId]);

  useEffect(() => {
    if (activeLegendId) {
      fetchTypes(activeLegendId);
    } else {
      setLegendTypes({});
    }
  }, [activeLegendId]);

  return {
    legends,
    activeLegendId,
    setActiveLegendId: setActiveLegendIdWrapped,
    legendTypes,
    fetchLegends,
    fetchTypes,
    fetchTypesRaw,
    createLegend,
    updateLegend,
    deleteLegend,
    createType,
    updateType,
    deleteType,
  };
}
