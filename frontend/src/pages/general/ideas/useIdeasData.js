// Data loading and CRUD logic for the Ideas page
import { useState, useEffect } from "react";
import { authFetch } from '../../../auth';

/**
 * Hook for loading and managing ideas, categories, and legend types.
 * Handles all API fetching, creation, deletion, and state management.
 */
export function useIdeasData(projectId) {
  const API = `/api/projects/${projectId}`;

  // Categories
  const [categories, setCategories] = useState({});

  // Ideas
  const [ideas, setIdeas] = useState({});
  const [unassignedOrder, setUnassignedOrder] = useState([]);
  const [categoryOrders, setCategoryOrders] = useState({});

  // Legend types
  const [legendTypes, setLegendTypes] = useState({});

  // ===== CATEGORY API =====

  const fetch_categories = async () => {
    try {
      const res = await authFetch(`${API}/get_all_categories/`);
      const data = await res.json();
      const all_categories = data.categories;

      const serialized = {};
      for (let i = 0; i < all_categories.length; i++) {
        const c = all_categories[i];
        const minWidth = Math.max(80, c.name.length * 9 + 60);
        serialized[c.id] = {
          id: c.id,
          name: c.name,
          x: c.x,
          y: c.y,
          width: Math.max(c.width, minWidth),
          height: c.height,
          z_index: c.z_index || 0,
          archived: c.archived || false,
        };
      }
      setCategories(serialized);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const set_position_category = async (category_id, new_position) => {
    await authFetch(`${API}/set_position_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, position: new_position }),
    });
  };

  const set_area_category = async (category_id, width, height) => {
    await authFetch(`${API}/set_area_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, width, height }),
    });
  };

  const delete_category = async (category_id) => {
    try {
      const res = await authFetch(`${API}/delete_category/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category_id }),
      });
      if (res.ok) {
        setCategories((prev) => {
          const updated = { ...prev };
          delete updated[category_id];
          return updated;
        });
        setCategoryOrders((prev) => {
          const updated = { ...prev };
          delete updated[category_id];
          return updated;
        });
        await fetch_all_ideas();
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const bring_to_front_category = async (category_id) => {
    await authFetch(`${API}/bring_to_front_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id }),
    });
    setCategories((prev) => {
      const maxZ = Math.max(
        0,
        ...Object.values(prev).map((c) => c.z_index || 0)
      );
      return {
        ...prev,
        [category_id]: { ...prev[category_id], z_index: maxZ + 1 },
      };
    });
  };

  const rename_category_api = async (category_id, new_name) => {
    await authFetch(`${API}/rename_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id, name: new_name }),
    });
    setCategories((prev) => ({
      ...prev,
      [category_id]: { ...prev[category_id], name: new_name },
    }));
  };

  const toggle_archive_category = async (category_id) => {
    const res = await authFetch(`${API}/toggle_archive_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category_id }),
    });
    const data = await res.json();
    setCategories((prev) => ({
      ...prev,
      [category_id]: { ...prev[category_id], archived: data.archived },
    }));
  };

  // ===== IDEA API =====

  const fetch_all_ideas = async () => {
    try {
      const res = await authFetch(`${API}/get_all_ideas/`);
      const data = await res.json();
      const idea_list = data?.data || [];
      const order = data?.order || [];
      const cat_orders = data?.category_orders || {};

      const idea_object = {};
      for (let i = 0; i < idea_list.length; i++) {
        const idea = idea_list[i];
        idea_object[idea.id] = { ...idea };
      }

      setIdeas(idea_object);
      setUnassignedOrder(order);
      setCategoryOrders(cat_orders);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
    }
  };

  const create_idea = async (ideaName, ideaHeadline) => {
    if (!ideaName.trim() && !ideaHeadline.trim()) return;
    await authFetch(`${API}/create_idea/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea_name: ideaName.trim() || ideaHeadline.trim(),
        description: "",
        headline: ideaHeadline,
      }),
    });
    fetch_all_ideas();
  };

  const delete_idea = async (idea_id) => {
    await authFetch(`${API}/delete_idea/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea_id }),
    });
    fetch_all_ideas();
  };

  const update_idea_title_api = async (idea_id, new_title, new_headline = null) => {
    if (!new_title.trim()) return;
    await authFetch(`${API}/update_idea_title/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea_id, title: new_title }),
    });
    if (new_headline !== null) {
      await authFetch(`${API}/update_idea_headline/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idea_id, headline: new_headline }),
      });
    }
    setIdeas((prev) => ({
      ...prev,
      [idea_id]: {
        ...prev[idea_id],
        title: new_title,
        headline: new_headline !== null ? new_headline : prev[idea_id].headline,
      },
    }));
  };

  const safe_order = async (new_order, category_id = null) => {
    await authFetch(`${API}/safe_order/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: new_order, category_id }),
    });
  };

  const assign_idea_to_category = async (idea_id, category_id) => {
    await authFetch(`${API}/assign_idea_to_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id, category_id }),
    });
    fetch_all_ideas();
  };

  // ===== LEGEND TYPE API =====

  const fetch_legend_types = async () => {
    try {
      const res = await authFetch(`${API}/get_all_legend_types/`);
      const data = await res.json();
      const legend_list = data?.legend_types || [];
      const legend_object = {};
      for (const lt of legend_list) {
        legend_object[lt.id] = lt;
      }
      setLegendTypes(legend_object);
    } catch (err) {
      console.error("Failed to fetch legend types:", err);
    }
  };

  const create_legend_type = async (name, color) => {
    const res = await authFetch(`${API}/create_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const data = await res.json();
    if (data.legend_type) {
      setLegendTypes((prev) => ({
        ...prev,
        [data.legend_type.id]: data.legend_type,
      }));
    }
    return data;
  };

  const update_legend_type = async (id, updates) => {
    await authFetch(`${API}/update_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    setLegendTypes((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  };

  const delete_legend_type = async (id) => {
    await authFetch(`${API}/delete_legend_type/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLegendTypes((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    setIdeas((prev) => {
      const updated = { ...prev };
      for (const [key, idea] of Object.entries(updated)) {
        if (idea.legend_type_id === id) {
          updated[key] = { ...idea, legend_type_id: null };
        }
      }
      return updated;
    });
  };

  const assign_idea_legend_type = async (idea_id, legend_type_id) => {
    await authFetch(`${API}/assign_idea_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id, legend_type_id }),
    });
    setIdeas((prev) => ({
      ...prev,
      [idea_id]: { ...prev[idea_id], legend_type_id },
    }));
  };

  // ===== INIT =====

  useEffect(() => {
    fetch_categories();
    fetch_all_ideas();
    fetch_legend_types();
  }, [projectId]);

  return {
    // Categories
    categories,
    setCategories,
    fetch_categories,
    set_position_category,
    set_area_category,
    delete_category,
    bring_to_front_category,
    rename_category_api,
    toggle_archive_category,

    // Ideas
    ideas,
    setIdeas,
    unassignedOrder,
    setUnassignedOrder,
    categoryOrders,
    setCategoryOrders,
    fetch_all_ideas,
    create_idea,
    delete_idea,
    update_idea_title_api,
    safe_order,
    assign_idea_to_category,

    // Legend types
    legendTypes,
    setLegendTypes,
    fetch_legend_types,
    create_legend_type,
    update_legend_type,
    delete_legend_type,
    assign_idea_legend_type,
  };
}
