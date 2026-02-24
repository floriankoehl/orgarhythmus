import { useState, useEffect, useCallback } from "react";
import { authFetch } from '../../auth';

/**
 * Manages legends and legend types, now scoped to a Context.
 * Accepts `contextId` — when it changes, legends are re-fetched for the new context.
 * When contextId is null (no context active), legends list is cleared.
 */
export function useLegends(contextId) {
  const [legends, setLegends] = useState([]);
  const [activeLegendId, setActiveLegendId] = useState(null);
  const [legendTypes, setLegendTypes] = useState({});
  const [hasUserSelected, setHasUserSelected] = useState(false);

  // Wrap setActiveLegendId to track explicit user selection
  const setActiveLegendIdWrapped = (val) => {
    setHasUserSelected(true);
    setActiveLegendId(val);
  };

  const fetch_legends = useCallback(async (ctxId) => {
    const id = ctxId ?? contextId;
    if (!id) { setLegends([]); setActiveLegendId(null); setLegendTypes({}); return; }
    try {
      const res = await authFetch(`/api/user/contexts/${id}/legends/`);
      const data = await res.json();
      const legs = data.legends || [];
      setLegends(legs);
      // Auto-select first legend if none selected and user hasn't explicitly deselected
      setActiveLegendId(prev => {
        // If the previously active legend still exists in the new list, keep it
        if (prev && legs.some(l => l.id === prev)) return prev;
        // Otherwise auto-select first (unless user explicitly chose "No Legend")
        return (legs.length > 0 && !hasUserSelected) ? legs[0].id : null;
      });
    } catch (err) {
      console.error("Failed to fetch legends:", err);
    }
  }, [contextId, hasUserSelected]);

  const fetch_types = useCallback(async (legendId) => {
    if (!legendId) return;
    try {
      const res = await authFetch(`/api/user/legends/${legendId}/types/`);
      const data = await res.json();
      const typeArr = data.types || [];
      const typeObj = {};
      for (const t of typeArr) typeObj[t.id] = t;
      setLegendTypes(typeObj);
    } catch (err) {
      console.error("Failed to fetch legend types:", err);
    }
  }, []);

  const create_legend = useCallback(async (name) => {
    if (!contextId) return;
    const res = await authFetch(`/api/user/contexts/${contextId}/legends/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.legend) {
      setLegends(prev => [...prev, data.legend]);
      setActiveLegendId(data.legend.id);
    }
    return data;
  }, [contextId]);

  const update_legend = useCallback(async (legendId, name) => {
    await authFetch(`/api/user/legends/${legendId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLegends(prev => prev.map(d => d.id === legendId ? { ...d, name } : d));
  }, []);

  const delete_legend = useCallback(async (legendId) => {
    await authFetch(`/api/user/legends/${legendId}/delete/`, { method: "DELETE" });
    setLegends(prev => {
      const updated = prev.filter(d => d.id !== legendId);
      if (activeLegendId === legendId) {
        setActiveLegendId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  }, [activeLegendId]);

  const create_type = useCallback(async (name, color, icon = null) => {
    if (!activeLegendId) return;
    const res = await authFetch(`/api/user/legends/${activeLegendId}/types/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, icon }),
    });
    const data = await res.json();
    if (data.type) {
      setLegendTypes(prev => ({ ...prev, [data.type.id]: data.type }));
    }
    return data;
  }, [activeLegendId]);

  const update_type = useCallback(async (typeId, updates) => {
    if (!activeLegendId) return;
    await authFetch(`/api/user/legends/${activeLegendId}/types/${typeId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setLegendTypes(prev => ({ ...prev, [typeId]: { ...prev[typeId], ...updates } }));
  }, [activeLegendId]);

  const delete_type = useCallback(async (typeId) => {
    if (!activeLegendId) return;
    await authFetch(`/api/user/legends/${activeLegendId}/types/${typeId}/delete/`, {
      method: "DELETE",
    });
    setLegendTypes(prev => {
      const updated = { ...prev };
      delete updated[typeId];
      return updated;
    });
  }, [activeLegendId]);

  // Fetch types for a legend without setting state (for filter modal)
  const fetchTypesRaw = useCallback(async (legendId) => {
    if (!legendId) return {};
    try {
      const res = await authFetch(`/api/user/legends/${legendId}/types/`);
      const data = await res.json();
      const typeArr = data.types || [];
      const typeObj = {};
      for (const t of typeArr) typeObj[t.id] = t;
      return typeObj;
    } catch (err) {
      console.error("Failed to fetch legend types:", err);
      return {};
    }
  }, []);

  // Re-fetch legends when contextId changes
  useEffect(() => {
    setHasUserSelected(false); // reset on context switch
    fetch_legends(contextId);
  }, [contextId]);

  // Fetch types when active legend changes
  useEffect(() => {
    if (activeLegendId) {
      fetch_types(activeLegendId);
    } else {
      setLegendTypes({});
    }
  }, [activeLegendId]);

  return {
    legends,
    activeLegendId,
    setActiveLegendId: setActiveLegendIdWrapped,
    legendTypes,
    fetch_legends,
    fetch_types,
    fetchTypesRaw,
    create_legend,
    update_legend,
    delete_legend,
    create_type,
    update_type,
    delete_type,
  };
}
