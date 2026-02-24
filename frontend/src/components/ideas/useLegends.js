import { useState, useEffect } from "react";
import { authFetch } from '../../auth';

export function useLegends() {
  const [legends, setLegends] = useState([]);
  const [activeLegendId, setActiveLegendId] = useState(null);
  const [legendTypes, setLegendTypes] = useState({});
  const [hasUserSelected, setHasUserSelected] = useState(false);

  // Wrap setActiveLegendId to track explicit user selection
  const setActiveLegendIdWrapped = (val) => {
    setHasUserSelected(true);
    setActiveLegendId(val);
  };

  const fetch_legends = async () => {
    try {
      const res = await authFetch("/api/user/legends/");
      const data = await res.json();
      const legs = data.legends || [];
      setLegends(legs);
      // Only auto-select first legend on initial load, not after user explicitly chose "No Legend"
      setActiveLegendId(prev => (legs.length > 0 && !prev && !hasUserSelected) ? legs[0].id : prev);
    } catch (err) {
      console.error("Failed to fetch legends:", err);
    }
  };

  const fetch_types = async (legendId) => {
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
  };

  const create_legend = async (name) => {
    const res = await authFetch("/api/user/legends/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.legend) {
      setLegends(prev => [...prev, data.legend]);
      setActiveLegendId(data.legend.id);
    }
  };

  const update_legend = async (legendId, name) => {
    await authFetch(`/api/user/legends/${legendId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLegends(prev => prev.map(d => d.id === legendId ? { ...d, name } : d));
  };

  const delete_legend = async (legendId) => {
    await authFetch(`/api/user/legends/${legendId}/delete/`, { method: "DELETE" });
    setLegends(prev => {
      const updated = prev.filter(d => d.id !== legendId);
      if (activeLegendId === legendId) {
        setActiveLegendId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const create_type = async (name, color, icon = null) => {
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
  };

  const update_type = async (typeId, updates) => {
    if (!activeLegendId) return;
    await authFetch(`/api/user/legends/${activeLegendId}/types/${typeId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setLegendTypes(prev => ({ ...prev, [typeId]: { ...prev[typeId], ...updates } }));
  };

  const delete_type = async (typeId) => {
    if (!activeLegendId) return;
    await authFetch(`/api/user/legends/${activeLegendId}/types/${typeId}/delete/`, {
      method: "DELETE",
    });
    setLegendTypes(prev => {
      const updated = { ...prev };
      delete updated[typeId];
      return updated;
    });
  };

  // Fetch types for a legend without setting state (for filter modal)
  const fetchTypesRaw = async (legendId) => {
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
  };

  useEffect(() => {
    fetch_legends();
  }, []);

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
