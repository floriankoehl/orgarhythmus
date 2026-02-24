import { useEffect, useState, useCallback } from "react";
import { Lightbulb, Layers, Filter, Plus, X, ChevronDown, ChevronUp, Trash2, Pencil, Check, LogIn, FolderPlus, Save, Tag, Palette, Download, Upload } from "lucide-react";
import { BASE_URL } from "../../config/api";
import { useAuth } from "../../auth/AuthContext";
import { useLegends } from "../../components/ideas/useLegends";
import { exportIdeabinApi, importIdeabinApi } from "../../components/ideas/api/exportApi";

// ─── Auth fetch helper ───
function authFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ═══════════════════════════════════════════════
// ═══════════  MOBILE IDEA BIN  ════════════════
// ═══════════════════════════════════════════════
export default function MobileIdeaBin() {
  const { user } = useAuth();
  const API = `${BASE_URL}/api`;
  const [activeContext, setActiveContext] = useState(null);
  const dims = useLegends(activeContext?.id);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState("ideas"); // "ideas" | "contexts"

  // ── Data state ──
  const [categories, setCategories] = useState({});
  const [ideas, setIdeas] = useState({});
  const [unassignedOrder, setUnassignedOrder] = useState([]);
  const [categoryOrders, setCategoryOrders] = useState({});

  // ── Form state ──
  const [formMode, setFormMode] = useState("idea"); // "idea" | "category"
  const [ideaName, setIdeaName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPublic, setNewCategoryPublic] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // ── Edit state ──
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");
  const [editingIdeaDescription, setEditingIdeaDescription] = useState("");

  // ── List filter ──
  const [listFilter, setListFilter] = useState("all");
  const [showListDropdown, setShowListDropdown] = useState(false);

  // ── Context state ──
  const [contexts, setContexts] = useState({});
  const [newContextName, setNewContextName] = useState("");
  const [showContextForm, setShowContextForm] = useState(false);
  const [editingContextId, setEditingContextId] = useState(null);
  const [editingContextName, setEditingContextName] = useState("");

  // ── Filter state ──
  const [legendFilters, setLegendFilters] = useState([]);
  const [filterCombineMode, setFilterCombineMode] = useState("and");
  const [globalTypeFilter, setGlobalTypeFilter] = useState([]);
  const [filterPresets, setFilterPresets] = useState([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [allLegendTypes, setAllLegendTypes] = useState({});
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [appliedPresetName, setAppliedPresetName] = useState("");

  // ── Legend management ──
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendName, setNewLegendName] = useState("");
  const [showCreateType, setShowCreateType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#6366f1");

  // ── Expanded idea cards ──
  const [expandedIdeas, setExpandedIdeas] = useState({});

  // ═══════════════════════════════════════════════
  // ═══════════  API CALLS  ══════════════════════
  // ═══════════════════════════════════════════════

  const fetch_categories = async () => {
    try {
      const res = await authFetch(`${API}/user/categories/`);
      const data = await res.json();
      const all = data.categories || [];
      const serialized = {};
      for (const c of all) {
        serialized[c.id] = {
          id: c.id, name: c.name, archived: c.archived || false,
          is_public: c.is_public || false,
        };
      }
      setCategories(serialized);
    } catch (err) { console.error("Mobile: fetch categories failed", err); }
  };

  const fetch_all_ideas = async () => {
    try {
      const res = await authFetch(`${API}/user/ideas/all/`);
      const data = await res.json();
      const list = data?.data || [];
      const obj = {};
      for (const p of list) {
        obj[p.id] = {
          placement_id: p.id,
          id: p.id,
          idea_id: p.idea?.id,
          title: p.idea?.title || "",
          description: p.idea?.description || "",
          legend_types: p.idea?.legend_types || {},
          owner: p.idea?.owner,
          owner_username: p.idea?.owner_username,
          created_at: p.idea?.created_at,
          placement_count: p.idea?.placement_count || 1,
          placement_categories: p.idea?.placement_categories || [],
          upvote_count: p.idea?.upvote_count || 0,
          comment_count: p.idea?.comment_count || 0,
          user_has_upvoted: p.idea?.user_has_upvoted || false,
          category: p.category,
          order_index: p.order_index,
        };
      }
      setIdeas(obj);
      setUnassignedOrder(data?.order || []);
      setCategoryOrders(data?.category_orders || {});
    } catch (err) { console.error("Mobile: fetch ideas failed", err); }
  };

  const create_idea = async () => {
    if (!ideaName.trim()) return;
    await authFetch(`${API}/user/ideas/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea_name: ideaName.trim(),
        description: "",
        ...(selectedCategoryId ? { category_id: parseInt(selectedCategoryId) } : {}),
      }),
    });
    setIdeaName("");
    fetch_all_ideas();
  };

  const create_category_api = async () => {
    if (!newCategoryName.trim()) return;
    const res = await authFetch(`${API}/user/categories/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName, is_public: newCategoryPublic }),
    });
    const data = await res.json();
    setNewCategoryName("");
    setNewCategoryPublic(false);
    await fetch_categories();
    // Auto-assign to active context
    if (activeContext && data.category?.id) {
      try {
        await authFetch(`${API}/user/contexts/assign_category/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: data.category.id, context_id: activeContext.id }),
        });
        setActiveContext(prev => prev ? { ...prev, category_ids: [...(prev.category_ids || []), data.category.id] } : prev);
      } catch (err) { console.error("Auto-assign category to context failed", err); }
    }
  };

  const delete_idea = async (placementId) => {
    await authFetch(`${API}/user/ideas/delete/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: placementId }),
    });
    fetch_all_ideas();
  };

  const update_idea_title_api = async (placementId, title) => {
    if (!title.trim()) return;
    const idea = ideas[placementId];
    const ideaId = idea?.idea_id || placementId;
    await authFetch(`${API}/user/ideas/update_title/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ideaId, title }),
    });
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          updated[pid] = { ...p, title };
        }
      }
      return updated;
    });
    setEditingIdeaId(null);
    setEditingIdeaTitle("");
    setEditingIdeaDescription("");
  };

  const assign_idea_to_category = async (placementId, categoryId) => {
    await authFetch(`${API}/user/ideas/assign_to_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement_id: placementId, category_id: categoryId }),
    });
    fetch_all_ideas();
  };

  const update_idea_description_api = async (ideaId, description) => {
    await authFetch(`${API}/user/ideas/update_description/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ideaId, description }),
    });
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          updated[pid] = { ...p, description };
        }
      }
      return updated;
    });
  };

  const assign_idea_legend_type_api = async (ideaId, legendId, typeId) => {
    await authFetch(`${API}/user/ideas/assign_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId, legend_id: legendId, legend_type_id: typeId }),
    });
    fetch_all_ideas();
  };

  const handleExportBackup = async () => {
    try {
      const blob = await exportIdeabinApi(activeContext?.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ideabin_backup_${activeContext ? activeContext.name : "global"}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error("Export failed", err); }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Import backup from "${file.name}"? This will REPLACE all current data${activeContext ? ` in context "${activeContext.name}"` : ""}.`)) {
      e.target.value = "";
      return;
    }
    try {
      await importIdeabinApi(file, activeContext?.id);
      await fetch_categories();
      await fetch_all_ideas();
      await fetch_contexts();
    } catch (err) { console.error("Import failed", err); }
    e.target.value = "";
  };

  // ── Context API ──
  const fetch_contexts = async () => {
    try {
      const res = await authFetch(`${API}/user/contexts/`);
      if (!res.ok) return;
      const data = await res.json();
      const ctxMap = {};
      data.forEach(ctx => { ctxMap[ctx.id] = ctx; });
      setContexts(ctxMap);
    } catch (e) { console.error("Failed to fetch contexts", e); }
  };

  const create_context_api = async () => {
    if (!newContextName.trim()) return;
    try {
      const res = await authFetch(`${API}/user/contexts/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newContextName.trim() }),
      });
      if (!res.ok) return;
      const ctx = await res.json();
      setContexts(prev => ({ ...prev, [ctx.id]: ctx }));
      setNewContextName("");
      setShowContextForm(false);
    } catch (e) { console.error("Failed to create context", e); }
  };

  const delete_context_api = async (ctxId) => {
    try {
      await authFetch(`${API}/user/contexts/${ctxId}/delete/`, { method: "DELETE" });
      setContexts(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
    } catch (e) { console.error("Failed to delete context", e); }
  };

  const rename_context_api = async (ctxId, name) => {
    if (!name.trim()) return;
    try {
      await authFetch(`${API}/user/contexts/rename/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_id: ctxId, name: name.trim() }),
      });
      setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], name: name.trim() } }));
    } catch (e) { console.error("Failed to rename context", e); }
  };

  const saveContextFilterState = async (contextId, filters, combineMode, presets) => {
    try {
      await authFetch(`${API}/user/contexts/set_filter_state/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: contextId,
          filter_state: {
            legend_filters: filters,
            filter_combine_mode: combineMode,
            filter_presets: presets || [],
          },
        }),
      });
    } catch (e) { console.error("Failed to save context filter state", e); }
  };

  const enterContext = (ctx) => {
    if (activeContext) {
      saveContextFilterState(activeContext.id, legendFilters, filterCombineMode, filterPresets);
    }
    setActiveContext(ctx);
    setActiveTab("ideas");
    if (ctx.filter_state) {
      setLegendFilters(ctx.filter_state.legend_filters || []);
      setFilterCombineMode(ctx.filter_state.filter_combine_mode || "and");
      setFilterPresets(ctx.filter_state.filter_presets || []);
      setGlobalTypeFilter([]);
    } else {
      setLegendFilters([]);
      setFilterCombineMode("and");
      setFilterPresets([]);
      setGlobalTypeFilter([]);
    }
  };

  const exitContext = () => {
    if (activeContext) {
      saveContextFilterState(activeContext.id, legendFilters, filterCombineMode, filterPresets);
    }
    setActiveContext(null);
    setLegendFilters([]);
    setFilterCombineMode("and");
    setFilterPresets([]);
    setGlobalTypeFilter([]);
  };

  // ── Filter presets ──
  const saveFilterPreset = (name) => {
    if (!name?.trim()) return;
    setFilterPresets(prev => [...prev, {
      name: name.trim(),
      legend_filters: JSON.parse(JSON.stringify(legendFilters)),
      filter_combine_mode: filterCombineMode,
    }]);
  };

  const applyFilterPreset = (preset) => {
    setLegendFilters(preset.legend_filters || []);
    setFilterCombineMode(preset.filter_combine_mode || "and");
    setAppliedPresetName(preset.name);
  };

  const deleteFilterPreset = (idx) => {
    setFilterPresets(prev => prev.filter((_, i) => i !== idx));
  };

  // ═══════════════════════════════════════════════
  // ═══════════  FILTERS  ════════════════════════
  // ═══════════════════════════════════════════════

  const hasLegendFilters = legendFilters.length > 0;

  const passesLegendFilters = useCallback((idea) => {
    if (!idea) return false;
    if (legendFilters.length === 0) return true;
    const results = legendFilters.map(f => {
      const legId = String(f.legendId);
      const dt = idea.legend_types?.[legId];
      const typeId = dt?.legend_type_id;
      const hasType = !!dt;
      const matchesSelected = f.typeIds.includes("unassigned")
        ? (!hasType || f.typeIds.includes(typeId))
        : (hasType && f.typeIds.includes(typeId));
      return f.mode === "exclude" ? !matchesSelected : matchesSelected;
    });
    return filterCombineMode === "and" ? results.every(Boolean) : results.some(Boolean);
  }, [legendFilters, filterCombineMode]);

  const passesGlobalTypeFilter = useCallback((idea) => {
    if (globalTypeFilter.length === 0) return true;
    if (!idea) return false;
    const dimId = String(dims.activeLegendId || "");
    const dt = idea.legend_types?.[dimId];
    if (globalTypeFilter.includes("unassigned") && !dt) return true;
    if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
    return false;
  }, [globalTypeFilter, dims.activeLegendId]);

  const passesAllFilters = useCallback((idea) => {
    if (hasLegendFilters) return passesLegendFilters(idea);
    return passesGlobalTypeFilter(idea);
  }, [hasLegendFilters, passesLegendFilters, passesGlobalTypeFilter]);

  const hasAnyFilter = legendFilters.length > 0 || globalTypeFilter.length > 0;

  // ── Computed lists ──
  const metaIdeaList = (() => {
    const seen = new Set();
    const result = [];
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      result.push(p);
    }
    return result;
  })();

  const filteredIdeas = (() => {
    if (listFilter === "all") return metaIdeaList.filter(i => passesAllFilters(i));
    if (listFilter === "unassigned") return unassignedOrder.map(id => ideas[id]).filter(Boolean).filter(i => passesAllFilters(i));
    return (categoryOrders[listFilter] || []).map(id => ideas[id]).filter(Boolean).filter(i => passesAllFilters(i));
  })();

  const unassignedCount = unassignedOrder.filter(id => ideas[id]).length;

  const filteredIdeaCount = (() => {
    const seen = new Set();
    let count = 0;
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      if (passesAllFilters(p)) count++;
    }
    return count;
  })();

  // Filter legends to those assigned to the active context (if any)
  const displayLegends = activeContext
    ? dims.legends.filter(l => (activeContext.legend_ids || []).includes(l.id))
    : dims.legends;

  // Active non-archived categories
  const activeCategories = Object.values(categories).filter(c => !c.archived);
  const visibleCategories = activeContext
    ? activeCategories.filter(c => (activeContext.category_ids || []).includes(c.id))
    : activeCategories;

  // ── Toggle type for filter modal ──
  const toggleTypeForLegend = (legendId, typeId) => {
    setAppliedPresetName("");
    setLegendFilters(prev => {
      const existingIdx = prev.findIndex(f => f.legendId === legendId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const f = { ...updated[existingIdx] };
        f.typeIds = f.typeIds.includes(typeId) ? f.typeIds.filter(t => t !== typeId) : [...f.typeIds, typeId];
        if (f.typeIds.length === 0) { updated.splice(existingIdx, 1); } else { updated[existingIdx] = f; }
        return updated;
      }
      return [...prev, { legendId, typeIds: [typeId], mode: "include" }];
    });
  };

  const toggleModeForLegend = (legendId) => {
    setLegendFilters(prev => {
      const existingIdx = prev.findIndex(f => f.legendId === legendId);
      if (existingIdx < 0) return prev;
      const updated = [...prev];
      updated[existingIdx] = { ...updated[existingIdx], mode: updated[existingIdx].mode === "include" ? "exclude" : "include" };
      return updated;
    });
  };

  const clearAllFilters = () => {
    setLegendFilters([]);
    setGlobalTypeFilter([]);
    setAppliedPresetName("");
  };

  const openFilterModal = async () => {
    setShowFilterModal(true);
    const result = {};
    for (const leg of displayLegends) {
      if (leg.id === dims.activeLegendId) {
        result[leg.id] = { ...dims.legendTypes };
      } else if (dims.fetchTypesRaw) {
        result[leg.id] = await dims.fetchTypesRaw(leg.id);
      }
    }
    setAllLegendTypes(result);
  };

  // ── Effects ──
  useEffect(() => {
    fetch_categories();
    fetch_all_ideas();
    fetch_contexts();
  }, []);

  // ═══════════════════════════════════════════════
  // ═══════════  RENDER  ═════════════════════════
  // ═══════════════════════════════════════════════

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 max-w-lg mx-auto">
      {/* ── Context bar (if active) ── */}
      {activeContext && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: activeContext.color || "#6366f1" }}
        >
          <Layers size={16} />
          <span className="flex-1 truncate">{activeContext.name}</span>
          <button onClick={handleExportBackup} className="p-1 rounded hover:bg-white/20" title="Export backup">
            <Download size={15} />
          </button>
          <label className="p-1 rounded hover:bg-white/20 cursor-pointer" title="Import backup">
            <Upload size={15} />
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
          <button onClick={exitContext} className="p-1 rounded hover:bg-white/20">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => setActiveTab("ideas")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "ideas"
              ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Lightbulb size={16} />
          Ideas
        </button>
        <button
          onClick={() => setActiveTab("contexts")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "contexts"
              ? "text-indigo-700 border-b-2 border-indigo-500 bg-indigo-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers size={16} />
          Contexts
        </button>
        {/* Global export/import (when no context) */}
        {!activeContext && (
          <div className="flex items-center gap-1 px-2">
            <button onClick={handleExportBackup} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Export backup">
              <Download size={16} />
            </button>
            <label className="p-1.5 text-gray-400 hover:text-indigo-600 rounded cursor-pointer" title="Import backup">
              <Upload size={16} />
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {/* ═══════ IDEAS TAB ═══════ */}
      {activeTab === "ideas" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Switchable form ── */}
          <div className="px-3 pt-3 pb-2 bg-white border-b border-gray-200 flex-shrink-0">
            {/* Form mode toggle */}
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setFormMode("idea")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  formMode === "idea"
                    ? "bg-amber-100 text-amber-800 shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <Lightbulb size={13} className="inline mr-1" />
                New Idea
              </button>
              <button
                onClick={() => setFormMode("category")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  formMode === "category"
                    ? "bg-yellow-100 text-yellow-800 shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <FolderPlus size={13} className="inline mr-1" />
                New Category
              </button>
            </div>

            {formMode === "idea" ? (
              /* ── Idea form ── */
              <div className="space-y-2">
                <textarea
                  value={editingIdeaId ? editingIdeaTitle : ideaName}
                  onChange={(e) => editingIdeaId ? setEditingIdeaTitle(e.target.value) : setIdeaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (editingIdeaId) {
                        const idea = ideas[editingIdeaId];
                        update_idea_title_api(editingIdeaId, editingIdeaTitle);
                        if (idea) update_idea_description_api(idea.idea_id, editingIdeaDescription);
                      } else {
                        create_idea();
                      }
                    }
                  }}
                  placeholder={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
                  rows={2}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 bg-white resize-none"
                />

                {/* Category picker for idea */}
                <div className="relative">
                  <button
                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-colors ${
                      selectedCategoryId
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 bg-white text-gray-500"
                    }`}
                  >
                    <span className="truncate">
                      {selectedCategoryId && categories[selectedCategoryId]
                        ? `📂 ${categories[selectedCategoryId].name}`
                        : "Add to category (optional)"}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                  {showCategoryPicker && (
                    <>
                      <div className="fixed inset-0 z-[40]" onClick={() => setShowCategoryPicker(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[41] max-h-[200px] overflow-y-auto">
                        <div
                          onClick={() => { setSelectedCategoryId(""); setShowCategoryPicker(false); }}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                            !selectedCategoryId ? "bg-amber-50 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-600"
                          }`}
                        >
                          No category (unassigned)
                        </div>
                        {visibleCategories.map(cat => (
                          <div
                            key={cat.id}
                            onClick={() => { setSelectedCategoryId(cat.id); setShowCategoryPicker(false); }}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                              String(selectedCategoryId) === String(cat.id) ? "bg-amber-50 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            📂 {cat.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Description field (edit mode) */}
                {editingIdeaId && (
                  <textarea
                    value={editingIdeaDescription}
                    onChange={(e) => setEditingIdeaDescription(e.target.value)}
                    placeholder="Description (optional)..."
                    rows={3}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 bg-white resize-none"
                  />
                )}

                {/* Form buttons */}
                <div className="flex gap-2">
                  {editingIdeaId ? (
                    <>
                      <button
                        onClick={() => {
                          const idea = ideas[editingIdeaId];
                          update_idea_title_api(editingIdeaId, editingIdeaTitle);
                          if (idea) update_idea_description_api(idea.idea_id, editingIdeaDescription);
                        }}
                        className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => { setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    ideaName.trim() && (
                      <button
                        onClick={create_idea}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                      >
                        Create{selectedCategoryId && categories[selectedCategoryId] ? ` → ${categories[selectedCategoryId].name}` : ""}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              /* ── Category form ── */
              <div className="space-y-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") create_category_api(); }}
                  placeholder="Category name..."
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-200 bg-white"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCategoryPublic}
                    onChange={(e) => setNewCategoryPublic(e.target.checked)}
                    className="rounded accent-yellow-500"
                  />
                  Public category
                </label>
                {newCategoryName.trim() && (
                  <button
                    onClick={create_category_api}
                    className="w-full py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors"
                  >
                    Create Category
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── List filter header ── */}
          <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="relative flex-1">
              <button
                onClick={() => setShowListDropdown(!showListDropdown)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-600"
              >
                {listFilter === "all"
                  ? `All Ideas (${filteredIdeaCount})`
                  : listFilter === "unassigned"
                  ? `Unassigned (${unassignedCount})`
                  : `${categories[listFilter]?.name || "Category"}`
                }
                <ChevronDown size={14} />
              </button>
              {showListDropdown && (
                <>
                  <div className="fixed inset-0 z-[30]" onClick={() => setShowListDropdown(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[31] min-w-[180px] max-h-[250px] overflow-y-auto py-1">
                    <div
                      onClick={() => { setListFilter("all"); setShowListDropdown(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer ${listFilter === "all" ? "bg-amber-50 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                    >
                      All Ideas ({metaIdeaList.length})
                    </div>
                    <div
                      onClick={() => { setListFilter("unassigned"); setShowListDropdown(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer ${listFilter === "unassigned" ? "bg-amber-50 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                    >
                      Unassigned ({unassignedCount})
                    </div>
                    {Object.entries(categories).map(([catKey, catData]) => (
                      <div
                        key={catKey}
                        onClick={() => { setListFilter(catKey); setShowListDropdown(false); }}
                        className={`px-3 py-2 text-sm cursor-pointer ${String(listFilter) === String(catKey) ? "bg-amber-50 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                      >
                        {catData.archived && <span className="mr-1">📦</span>}
                        📂 {catData.name} ({(categoryOrders[catKey] || []).length})
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Idea list ── */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filteredIdeas.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8 italic">
                {hasAnyFilter ? "No ideas match the current filter" : "No ideas yet"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredIdeas.map(idea => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    categories={categories}
                    activeCategories={visibleCategories}
                    expanded={!!expandedIdeas[idea.id]}
                    onToggleExpand={() => setExpandedIdeas(prev => ({ ...prev, [idea.id]: !prev[idea.id] }))}
                    activeLegendId={dims.activeLegendId}
                    legendTypes={dims.legendTypes}
                    onAssignLegendType={(ideaId, legendId, typeId) => assign_idea_legend_type_api(ideaId, legendId, typeId)}
                    onUpdateDescription={(ideaId, desc) => update_idea_description_api(ideaId, desc)}
                    onEdit={() => {
                      setFormMode("idea");
                      setEditingIdeaId(idea.id);
                      setEditingIdeaTitle(idea.title);
                      setEditingIdeaDescription(idea.description || "");
                      setSelectedCategoryId(idea.category || "");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onDelete={() => {
                      if (window.confirm("Delete this idea?")) delete_idea(idea.id);
                    }}
                    onAssignCategory={(catId) => assign_idea_to_category(idea.placement_id, catId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom filter panel ── */}
          <div className="bg-white border-t border-gray-200 flex-shrink-0">
            {/* Filter toggle bar */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="w-full flex items-center justify-between px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Filter size={15} className={hasAnyFilter ? "text-blue-500" : "text-gray-400"} />
                Filters & Legends
                {hasAnyFilter && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {legendFilters.length}
                  </span>
                )}
              </span>
              {showFilterPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>

            {showFilterPanel && (
              <div className="px-3 pb-3 max-h-[40vh] overflow-y-auto">
                {/* Legend selector + management */}
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <select
                      value={dims.activeLegendId || ""}
                      onChange={(e) => dims.setActiveLegendId(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded-lg outline-none bg-white"
                    >
                      {displayLegends.length === 0 && <option value="">No legends</option>}
                      {displayLegends.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {activeContext && (
                      <button
                        onClick={() => setShowCreateLegend(!showCreateLegend)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                        title="Create legend"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>

                  {/* Create legend form */}
                  {showCreateLegend && activeContext && (
                    <div className="flex gap-1 mb-2">
                      <input
                        autoFocus
                        value={newLegendName}
                        onChange={(e) => setNewLegendName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newLegendName.trim()) {
                            dims.create_legend(newLegendName.trim());
                            setNewLegendName("");
                            setShowCreateLegend(false);
                          }
                        }}
                        placeholder="Legend name..."
                        className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={() => {
                          if (newLegendName.trim()) {
                            dims.create_legend(newLegendName.trim());
                            setNewLegendName("");
                            setShowCreateLegend(false);
                          }
                        }}
                        className="px-2 py-1 bg-indigo-500 text-white rounded text-xs"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Create type under active legend */}
                  {dims.activeLegendId && activeContext && (
                    <div className="mb-2">
                      {showCreateType ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="color"
                            value={newTypeColor}
                            onChange={(e) => setNewTypeColor(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            autoFocus
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newTypeName.trim()) {
                                dims.create_type(newTypeName.trim(), newTypeColor);
                                setNewTypeName("");
                                setNewTypeColor("#6366f1");
                                setShowCreateType(false);
                              }
                            }}
                            placeholder="Type name..."
                            className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded outline-none focus:border-indigo-400"
                          />
                          <button
                            onClick={() => {
                              if (newTypeName.trim()) {
                                dims.create_type(newTypeName.trim(), newTypeColor);
                                setNewTypeName("");
                                setNewTypeColor("#6366f1");
                                setShowCreateType(false);
                              }
                            }}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setShowCreateType(false)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowCreateType(true)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                        >
                          <Palette size={11} />
                          Add type to &ldquo;{displayLegends.find(l => l.id === dims.activeLegendId)?.name || "legend"}&rdquo;
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick type filter pills */}
                {dims.activeLegendId && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      onClick={() => {
                        setGlobalTypeFilter(prev => prev.includes("unassigned") ? prev.filter(t => t !== "unassigned") : [...prev, "unassigned"]);
                        toggleTypeForLegend(dims.activeLegendId, "unassigned");
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        legendFilters.some(f => f.legendId === dims.activeLegendId && f.typeIds.includes("unassigned"))
                          ? "bg-gray-700 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Unassigned
                    </button>
                    {Object.values(dims.legendTypes).map(lt => {
                      const isActive = legendFilters.some(f => f.legendId === dims.activeLegendId && f.typeIds.includes(lt.id));
                      return (
                        <button
                          key={lt.id}
                          onClick={() => toggleTypeForLegend(dims.activeLegendId, lt.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                            isActive
                              ? "text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          style={isActive ? { backgroundColor: lt.color } : {}}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/30"
                            style={{ backgroundColor: lt.color }}
                          />
                          {lt.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Advanced filter button */}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={openFilterModal}
                    className="flex-1 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Filter size={13} />
                    Advanced Filter
                  </button>
                  {hasAnyFilter && (
                    <button
                      onClick={clearAllFilters}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Active filter rules summary */}
                {legendFilters.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {legendFilters.map((f, idx) => {
                      const legend = displayLegends.find(l => l.id === f.legendId) || dims.legends.find(l => l.id === f.legendId);
                      return (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg text-xs">
                          <span className={`font-semibold ${f.mode === "exclude" ? "text-red-600" : "text-blue-600"}`}>
                            {f.mode === "exclude" ? "EXCL" : "INCL"}
                          </span>
                          <span className="text-gray-600 font-medium">{legend?.name || "Legend"}:</span>
                          <span className="text-gray-700 flex-1 truncate">
                            {f.typeIds.map(tid => {
                              if (tid === "unassigned") return "Unassigned";
                              const types = allLegendTypes[f.legendId] || (f.legendId === dims.activeLegendId ? dims.legendTypes : {});
                              return types[tid]?.name || "Type";
                            }).join(", ")}
                          </span>
                          <button onClick={() => setLegendFilters(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {legendFilters.length > 1 && (
                      <button
                        onClick={() => setFilterCombineMode(prev => prev === "and" ? "or" : "and")}
                        className="text-xs text-indigo-600 font-semibold px-2"
                      >
                        Mode: {filterCombineMode.toUpperCase()}
                      </button>
                    )}
                  </div>
                )}

                {/* Presets */}
                {(filterPresets.length > 0 || activeContext) && (
                  <div className="border-t border-gray-100 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-500">Presets</span>
                      {activeContext && (
                        <button
                          onClick={() => setShowSavePreset(!showSavePreset)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5"
                        >
                          <Save size={11} /> Save
                        </button>
                      )}
                    </div>
                    {showSavePreset && (
                      <div className="flex gap-1 mb-2">
                        <input
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && presetName.trim()) {
                              saveFilterPreset(presetName);
                              setPresetName("");
                              setShowSavePreset(false);
                            }
                          }}
                          placeholder="Preset name..."
                          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={() => { if (presetName.trim()) { saveFilterPreset(presetName); setPresetName(""); setShowSavePreset(false); } }}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                        >
                          Save
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {filterPresets.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-0.5">
                          <button
                            onClick={() => applyFilterPreset(p)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              appliedPresetName === p.name
                                ? "bg-indigo-500 text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {p.name}
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Delete preset "${p.name}"?`)) deleteFilterPreset(idx); }}
                            className="text-gray-300 hover:text-red-500"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ CONTEXTS TAB ═══════ */}
      {activeTab === "contexts" && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            {/* Create context */}
            <div className="mb-4">
              {showContextForm ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newContextName}
                    onChange={(e) => setNewContextName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create_context_api();
                      else if (e.key === "Escape") setShowContextForm(false);
                    }}
                    placeholder="Context name..."
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={create_context_api}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowContextForm(false)}
                    className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowContextForm(true)}
                  className="w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 border border-indigo-200"
                >
                  <Plus size={16} />
                  New Context
                </button>
              )}
            </div>

            {/* Context list */}
            {Object.keys(contexts).length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8 italic">No contexts yet</p>
            ) : (
              <div className="space-y-2">
                {Object.values(contexts).map(ctx => (
                  <div
                    key={ctx.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-3"
                      style={{ borderLeft: `4px solid ${ctx.color || "#6366f1"}` }}
                    >
                      <Layers size={16} className="text-gray-400 flex-shrink-0" />
                      {editingContextId === ctx.id ? (
                        <input
                          autoFocus
                          value={editingContextName}
                          onChange={(e) => setEditingContextName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { rename_context_api(ctx.id, editingContextName); setEditingContextId(null); }
                            else if (e.key === "Escape") setEditingContextId(null);
                          }}
                          onBlur={() => { rename_context_api(ctx.id, editingContextName); setEditingContextId(null); }}
                          className="flex-1 text-sm px-2 py-1 border border-indigo-300 rounded outline-none"
                        />
                      ) : (
                        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{ctx.name}</span>
                      )}

                      <button
                        onClick={() => enterContext(ctx)}
                        className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 transition-colors flex items-center gap-1"
                      >
                        <LogIn size={12} />
                        Enter
                      </button>
                      <button
                        onClick={() => { setEditingContextId(ctx.id); setEditingContextName(ctx.name); }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete context "${ctx.name}"?`)) delete_context_api(ctx.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Context details */}
                    <div className="px-3 pb-2 flex gap-3 text-xs text-gray-400">
                      {(ctx.category_ids || []).length > 0 && (
                        <span>📂 {ctx.category_ids.length} categories</span>
                      )}
                      {(ctx.legend_ids || []).length > 0 && (
                        <span>🏷 {ctx.legend_ids.length} legends</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ ADVANCED FILTER MODAL ═══════ */}
      {showFilterModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[100]" onClick={() => setShowFilterModal(false)} />
          <div className="fixed inset-x-2 bottom-2 top-[15vh] bg-white rounded-2xl shadow-2xl z-[101] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h3 className="text-sm font-bold text-gray-800">Advanced Filter</h3>
              <div className="flex items-center gap-2">
                {legendFilters.length > 1 && (
                  <button
                    onClick={() => setFilterCombineMode(prev => prev === "and" ? "or" : "and")}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      filterCombineMode === "and"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {filterCombineMode.toUpperCase()}
                  </button>
                )}
                <button onClick={() => setShowFilterModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {displayLegends.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8 italic">No legends available</p>
              ) : (
                displayLegends.map(leg => {
                  const typesObj = allLegendTypes[leg.id] || (leg.id === dims.activeLegendId ? dims.legendTypes : {});
                  const types = Object.values(typesObj);
                  const filterRule = legendFilters.find(f => f.legendId === leg.id);

                  return (
                    <div key={leg.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-700">{leg.name}</span>
                        {filterRule && (
                          <button
                            onClick={() => toggleModeForLegend(leg.id)}
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              filterRule.mode === "exclude"
                                ? "bg-red-100 text-red-600"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {filterRule.mode === "exclude" ? "EXCLUDE" : "INCLUDE"}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* Unassigned pill */}
                        <button
                          onClick={() => toggleTypeForLegend(leg.id, "unassigned")}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            filterRule?.typeIds.includes("unassigned")
                              ? "bg-gray-700 text-white shadow-sm"
                              : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Unassigned
                        </button>
                        {/* Type pills */}
                        {types.map(lt => {
                          const isSelected = filterRule?.typeIds.includes(lt.id);
                          return (
                            <button
                              key={lt.id}
                              onClick={() => toggleTypeForLegend(leg.id, lt.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? "text-white shadow-sm"
                                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                              }`}
                              style={isSelected ? { backgroundColor: lt.color } : {}}
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: lt.color, border: isSelected ? "2px solid rgba(255,255,255,0.5)" : "1px solid #e5e7eb" }}
                              />
                              {lt.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={clearAllFilters}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-300 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors"
              >
                Apply ({filteredIdeaCount} ideas)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// ═══════════  IDEA CARD  ════════════════════════
// ═══════════════════════════════════════════════
function IdeaCard({ idea, categories, activeCategories, expanded, onToggleExpand, onEdit, onDelete, onAssignCategory, activeLegendId, legendTypes, onAssignLegendType, onUpdateDescription }) {
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState(idea.description || "");

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 flex items-start gap-2" onClick={onToggleExpand}>
        {/* Legend type dots */}
        {idea.legend_types && Object.keys(idea.legend_types).length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1 flex-shrink-0">
            {Object.values(idea.legend_types).map((lt, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: lt.color || "#9ca3af" }}
                title={lt.name}
              />
            ))}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-gray-800 ${expanded ? "" : "line-clamp-2"}`}>{idea.title}</p>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-300 flex-shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 border-t border-gray-100 pt-2 space-y-2">
          {/* Category badge */}
          {idea.placement_categories && idea.placement_categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.placement_categories.map(c => (
                <span key={c.id} className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  📂 {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {editingDesc ? (
            <div className="space-y-1">
              <textarea
                autoFocus
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                rows={3}
                placeholder="Add a description..."
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg outline-none focus:border-blue-400 resize-none bg-white"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => { onUpdateDescription(idea.idea_id, localDesc); setEditingDesc(false); }}
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => { setLocalDesc(idea.description || ""); setEditingDesc(false); }}
                  className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-left w-full"
            >
              {idea.description ? (
                <p className="text-xs text-gray-500 italic line-clamp-3">{idea.description}</p>
              ) : (
                <p className="text-xs text-gray-300 italic">Tap to add description...</p>
              )}
            </button>
          )}

          {/* Legend type assignment */}
          {activeLegendId && legendTypes && Object.keys(legendTypes).length > 0 && (
            <div>
              <span className="text-xs font-semibold text-gray-500 mb-1 block">
                <Tag size={11} className="inline mr-1" />
                Legend Type
              </span>
              <div className="flex flex-wrap gap-1">
                {Object.values(legendTypes).map(lt => {
                  const currentType = idea.legend_types?.[String(activeLegendId)];
                  const isAssigned = currentType?.legend_type_id === lt.id;
                  return (
                    <button
                      key={lt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssignLegendType(idea.idea_id, activeLegendId, isAssigned ? null : lt.id);
                      }}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                        isAssigned
                          ? "text-white shadow-sm ring-2 ring-offset-1"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      style={isAssigned ? { backgroundColor: lt.color, ringColor: lt.color } : {}}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lt.color }}
                      />
                      {lt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assign to category */}
          <div className="relative">
            <button
              onClick={() => setShowCatDropdown(!showCatDropdown)}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              <FolderPlus size={12} />
              {idea.category ? "Move to category" : "Add to category"}
            </button>
            {showCatDropdown && (
              <>
                <div className="fixed inset-0 z-[50]" onClick={() => setShowCatDropdown(false)} />
                <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[51] min-w-[180px] max-h-[200px] overflow-y-auto py-1">
                  <div
                    onClick={() => { onAssignCategory(null); setShowCatDropdown(false); }}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-500"
                  >
                    Unassigned
                  </div>
                  {activeCategories.map(cat => (
                    <div
                      key={cat.id}
                      onClick={() => { onAssignCategory(cat.id); setShowCatDropdown(false); }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-700 ${
                        idea.category === cat.id ? "bg-amber-50 font-medium text-amber-700" : ""
                      }`}
                    >
                      📂 {cat.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
