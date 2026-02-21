import { useState, useEffect } from "react";
import { authFetch } from '../../auth';

export function useDimensions() {
  const [dimensions, setDimensions] = useState([]);
  const [activeDimensionId, setActiveDimensionId] = useState(null);
  const [dimensionTypes, setDimensionTypes] = useState({});

  const fetch_dimensions = async () => {
    try {
      const res = await authFetch("/api/user/dimensions/");
      const data = await res.json();
      const dims = data.dimensions || [];
      setDimensions(dims);
      setActiveDimensionId(prev => (dims.length > 0 && !prev) ? dims[0].id : prev);
    } catch (err) {
      console.error("Failed to fetch dimensions:", err);
    }
  };

  const fetch_dimension_types = async (dimId) => {
    if (!dimId) return;
    try {
      const res = await authFetch(`/api/user/dimensions/${dimId}/types/`);
      const data = await res.json();
      const typeArr = data.types || [];
      const typeObj = {};
      for (const t of typeArr) typeObj[t.id] = t;
      setDimensionTypes(typeObj);
    } catch (err) {
      console.error("Failed to fetch dimension types:", err);
    }
  };

  const create_dimension = async (name) => {
    const res = await authFetch("/api/user/dimensions/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.dimension) {
      setDimensions(prev => [...prev, data.dimension]);
      setActiveDimensionId(data.dimension.id);
    }
  };

  const update_dimension = async (dimId, name) => {
    await authFetch(`/api/user/dimensions/${dimId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setDimensions(prev => prev.map(d => d.id === dimId ? { ...d, name } : d));
  };

  const delete_dimension = async (dimId) => {
    await authFetch(`/api/user/dimensions/${dimId}/delete/`, { method: "DELETE" });
    setDimensions(prev => {
      const updated = prev.filter(d => d.id !== dimId);
      if (activeDimensionId === dimId) {
        setActiveDimensionId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const create_dimension_type = async (name, color) => {
    if (!activeDimensionId) return;
    const res = await authFetch(`/api/user/dimensions/${activeDimensionId}/types/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const data = await res.json();
    if (data.type) {
      setDimensionTypes(prev => ({ ...prev, [data.type.id]: data.type }));
    }
    return data;
  };

  const update_dimension_type = async (typeId, updates) => {
    if (!activeDimensionId) return;
    await authFetch(`/api/user/dimensions/${activeDimensionId}/types/${typeId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setDimensionTypes(prev => ({ ...prev, [typeId]: { ...prev[typeId], ...updates } }));
  };

  const delete_dimension_type = async (typeId) => {
    if (!activeDimensionId) return;
    await authFetch(`/api/user/dimensions/${activeDimensionId}/types/${typeId}/delete/`, {
      method: "DELETE",
    });
    setDimensionTypes(prev => {
      const updated = { ...prev };
      delete updated[typeId];
      return updated;
    });
  };

  useEffect(() => {
    fetch_dimensions();
  }, []);

  useEffect(() => {
    if (activeDimensionId) {
      fetch_dimension_types(activeDimensionId);
    } else {
      setDimensionTypes({});
    }
  }, [activeDimensionId]);

  return {
    dimensions,
    activeDimensionId,
    setActiveDimensionId,
    dimensionTypes,
    fetch_dimensions,
    fetch_dimension_types,
    create_dimension,
    update_dimension,
    delete_dimension,
    create_dimension_type,
    update_dimension_type,
    delete_dimension_type,
  };
}
