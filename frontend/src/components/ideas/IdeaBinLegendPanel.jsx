import { useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { Filter, X, Plus, FolderPlus, Save, Pencil, Trash2, Layers } from "lucide-react";
import { LEGEND_TYPE_ICONS, ICON_CATEGORIES, renderLegendTypeIcon } from "./legendTypeIcons";

/**
 * Legends panel at the bottom of the IdeaBin sidebar.
 * Shows legend selector, types, filter controls, and advanced multi-legend filters.
 *
 * Advanced filter system:
 *   legendFilters = [{legendId, typeIds: [...], mode: "include"|"exclude"}, ...]
 *   filterCombineMode = "and" | "or"
 *
 * When legendFilters is non-empty, it takes precedence over the simple globalTypeFilter.
 */
export default function IdeaBinLegendPanel({
  dims,
  legendPanelCollapsed, setLegendPanelCollapsed,
  showCreateLegend, setShowCreateLegend,
  newLegendName, setNewLegendName,
  editingLegendId, setEditingLegendId,
  editingLegendNameLocal, setEditingLegendNameLocal,
  globalTypeFilter, setGlobalTypeFilter,
  legendFilters, setLegendFilters,
  filterCombineMode, setFilterCombineMode,
  handleTypeDrag,
  editingTypeId, setEditingTypeId,
  editingTypeName, setEditingTypeName,
  showCreateType, setShowCreateType,
  newTypeColor, setNewTypeColor,
  newTypeName, setNewTypeName,
  onLegendCreated,
  legendsList,
  createCategoryFromFilter,
  batchRemoveLegendType,
  activeContext,
  ideas,
  selectedIdeaIds,
  assign_idea_legend_type,
  passesAllFilters,
  filterPresets,
  saveFilterPreset,
  applyFilterPreset,
  stackFilterPreset,
  deleteFilterPreset,
  renameFilterPreset,
  paintType,
  setPaintType,
}) {
  const displayLegends = legendsList?.length ? legendsList : dims.legends;
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [iconPickerTypeId, setIconPickerTypeId] = useState(null); // type id with open icon picker
  const [newTypeIcon, setNewTypeIcon] = useState(null); // icon for create-type form
  const [createCatName, setCreateCatName] = useState(""); // name for "create category from filter"
  const [showCreateCatInput, setShowCreateCatInput] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [editingPresetIdx, setEditingPresetIdx] = useState(null);
  const [editingPresetName, setEditingPresetName] = useState("");
  const [appliedPresetName, setAppliedPresetName] = useState("");
  const [allLegendTypes, setAllLegendTypes] = useState({}); // {legendId: {typeId: typeObj}}
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(true);

  // Count ideas matching filter (for display)
  const filteredIdeaCount = (() => {
    if (!ideas || !passesAllFilters) return 0;
    const seen = new Set();
    let count = 0;
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      if (passesAllFilters(p)) count++;
    }
    return count;
  })();

  // Count ideas with a specific legend type assigned (in current context's ideas only)
  const countIdeasWithType = (legendId, typeId) => {
    if (!ideas) return 0;
    const seen = new Set();
    let count = 0;
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      const dt = p.legend_types?.[String(legendId)];
      if (typeId === null) {
        // Count all ideas with any type assigned for this legend
        if (dt) count++;
      } else {
        if (dt && dt.legend_type_id === typeId) count++;
      }
    }
    return count;
  };

  const handleCreateLegend = async (name) => {
    await dims.create_legend(name);
    if (onLegendCreated) onLegendCreated();
  };

  const hasAnyFilter = legendFilters.length > 0 || globalTypeFilter.length > 0;

  // Toggle a type in a specific filter rule
  const toggleTypeInFilter = (filterIndex, typeId) => {
    setLegendFilters(prev => {
      const updated = [...prev];
      const f = { ...updated[filterIndex] };
      f.typeIds = f.typeIds.includes(typeId)
        ? f.typeIds.filter(t => t !== typeId)
        : [...f.typeIds, typeId];
      if (f.typeIds.length === 0) {
        updated.splice(filterIndex, 1);
      } else {
        updated[filterIndex] = f;
      }
      return updated;
    });
  };

  // Toggle filter mode for a rule (include <-> exclude)
  const toggleFilterMode = (filterIndex) => {
    setLegendFilters(prev => {
      const updated = [...prev];
      updated[filterIndex] = {
        ...updated[filterIndex],
        mode: updated[filterIndex].mode === "include" ? "exclude" : "include",
      };
      return updated;
    });
  };

  // Remove a filter rule
  const removeFilter = (filterIndex) => {
    setLegendFilters(prev => prev.filter((_, i) => i !== filterIndex));
  };

  // Add a new filter for the currently active legend with a specific type
  const addFilterForActiveLegend = (typeId) => {
    if (!dims.activeLegendId) return;
    const existingIdx = legendFilters.findIndex(f => f.legendId === dims.activeLegendId);
    if (existingIdx >= 0) {
      toggleTypeInFilter(existingIdx, typeId);
    } else {
      setLegendFilters(prev => [...prev, {
        legendId: dims.activeLegendId,
        typeIds: [typeId],
        mode: "include",
      }]);
    }
  };

  // Add new filter for a chosen legend
  const addFilterForLegend = (legendId) => {
    const existing = legendFilters.findIndex(f => f.legendId === legendId);
    if (existing >= 0) return;
    setLegendFilters(prev => [...prev, {
      legendId,
      typeIds: ["unassigned"],
      mode: "include",
    }]);
    setShowAddFilter(false);
    dims.setActiveLegendId(legendId);
  };

  const clearAllFilters = () => {
    setLegendFilters([]);
    setGlobalTypeFilter([]);
    setAppliedPresetName("");
  };

  // Toggle a type in a filter for a specific legend (used in modal)
  const toggleTypeForLegend = (legendId, typeId) => {
    setAppliedPresetName("");
    setLegendFilters(prev => {
      const existingIdx = prev.findIndex(f => f.legendId === legendId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const f = { ...updated[existingIdx] };
        f.typeIds = f.typeIds.includes(typeId)
          ? f.typeIds.filter(t => t !== typeId)
          : [...f.typeIds, typeId];
        if (f.typeIds.length === 0) {
          updated.splice(existingIdx, 1);
        } else {
          updated[existingIdx] = f;
        }
        return updated;
      } else {
        return [...prev, { legendId, typeIds: [typeId], mode: "include" }];
      }
    });
  };

  // Toggle include/exclude for a legend's filter rule
  const toggleModeForLegend = (legendId) => {
    setLegendFilters(prev => {
      const existingIdx = prev.findIndex(f => f.legendId === legendId);
      if (existingIdx < 0) return prev;
      const updated = [...prev];
      updated[existingIdx] = {
        ...updated[existingIdx],
        mode: updated[existingIdx].mode === "include" ? "exclude" : "include",
      };
      return updated;
    });
  };

  // Open filter modal and fetch types for all context legends
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

  // Build a filter description for the category name
  const getFilterDisplayName = () => {
    if (appliedPresetName) return appliedPresetName;
    // Build from filter rules
    const parts = legendFilters.map(f => {
      const legend = displayLegends.find(l => l.id === f.legendId) || dims.legends.find(l => l.id === f.legendId);
      const legendName = legend?.name || "Legend";
      const types = allLegendTypes[f.legendId] || (f.legendId === dims.activeLegendId ? dims.legendTypes : {});
      const typeNames = f.typeIds.map(tid => {
        if (tid === "unassigned") return "Unassigned";
        return types[tid]?.name || "Type";
      });
      return `${f.mode === "exclude" ? "excl" : "incl"} ${typeNames.join(", ")} (${legendName})`;
    });
    return parts.join(` ${filterCombineMode} `) || "filter";
  };
  return (
    <div className="bg-white border-t border-gray-200 flex-shrink-0">
      {/* ═══════════════ SECTION 1: LEGENDS ═══════════════ */}
      <div className="p-2 pb-0">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setLegendPanelCollapsed(!legendPanelCollapsed)}
        >
          <div className="flex items-center gap-1">
            <Layers size={12} className="text-gray-500" />
            <h3 className="text-[10px] font-semibold text-gray-500">Legends</h3>
            {!legendPanelCollapsed && !showCreateLegend && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowCreateLegend(true); }}
              className="w-4 h-4 flex items-center justify-center rounded text-[11px] font-bold text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="New Legend"
            >+</button>
          )}
        </div>
        <span className="text-gray-400 text-[10px]">{legendPanelCollapsed ? "▲" : "▼"}</span>
      </div>
      {!legendPanelCollapsed && (
        <div className="mt-1">
          {/* Legend selector — hidden while creating */}
          {displayLegends.length > 0 && !showCreateLegend && (
            <div className="mb-1">
              {editingLegendId ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={editingLegendNameLocal}
                    onChange={(e) => setEditingLegendNameLocal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingLegendNameLocal.trim()) {
                        dims.update_legend(editingLegendId, editingLegendNameLocal.trim());
                        setEditingLegendId(null);
                      } else if (e.key === "Escape") setEditingLegendId(null);
                    }}
                    onBlur={() => {
                      if (editingLegendNameLocal.trim()) dims.update_legend(editingLegendId, editingLegendNameLocal.trim());
                      setEditingLegendId(null);
                    }}
                    className="flex-1 text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none"
                  />
                  <button onClick={() => setEditingLegendId(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    value={dims.activeLegendId || ""}
                    onChange={(e) => dims.setActiveLegendId(e.target.value ? parseInt(e.target.value) : null)}
                    className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none bg-white"
                  >
                    {displayLegends.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const leg = displayLegends.find(d => d.id === dims.activeLegendId);
                      if (leg) { setEditingLegendId(leg.id); setEditingLegendNameLocal(leg.name); }
                    }}
                    title="Rename"
                    className="text-[10px] text-gray-400 hover:text-blue-500 px-0.5"
                  >✎</button>
                  {/* Unselect all ideas from this legend */}
                  {batchRemoveLegendType && dims.activeLegendId && countIdeasWithType(dims.activeLegendId, null) > 0 && (
                    <button
                      onClick={() => {
                        const count = countIdeasWithType(dims.activeLegendId, null);
                        const legName = displayLegends.find(l => l.id === dims.activeLegendId)?.name || "this legend";
                        if (window.confirm(`Remove all "${legName}" type assignments from ${count} idea${count !== 1 ? "s" : ""}${activeContext ? ` in "${activeContext.name}"` : ""}?`)) {
                          batchRemoveLegendType(dims.activeLegendId);
                        }
                      }}
                      title={`Unassign all types from ideas${activeContext ? ` in "${activeContext.name}"` : ""}`}
                      className="text-[8px] text-orange-400 hover:text-orange-600 px-0.5"
                    >✕all</button>
                  )}
                  <button
                    onClick={() => {
                      if (dims.activeLegendId && window.confirm("Delete this legend?")) {
                        dims.delete_legend(dims.activeLegendId);
                      }
                    }}
                    title="Delete"
                    className="text-[10px] text-gray-400 hover:text-red-500 px-0.5"
                  >✕</button>
                </div>
              )}
            </div>
          )}
          {/* Create legend */}
          {showCreateLegend ? (
            <div className="flex gap-1 mb-1">
              <input
                autoFocus
                value={newLegendName}
                onChange={(e) => setNewLegendName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLegendName.trim()) {
                    handleCreateLegend(newLegendName.trim());
                    setNewLegendName(""); setShowCreateLegend(false);
                  } else if (e.key === "Escape") setShowCreateLegend(false);
                }}
                placeholder="Legend name..."
                className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none focus:border-blue-400"
              />
              <button
                onClick={() => {
                  if (newLegendName.trim()) {
                    handleCreateLegend(newLegendName.trim());
                    setNewLegendName("");
                    setShowCreateLegend(false);
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              >+</button>
              <button onClick={() => setShowCreateLegend(false)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
            </div>
          ) : null}
          {/* ═══ Types for active legend ═══ */}
          {/* Unassigned type */}
          <div
            className={`flex items-center gap-1.5 mb-1 cursor-pointer rounded px-1 py-0.5 text-[10px] ${paintType && paintType.typeId === null ? "ring-2 ring-gray-500 bg-gray-100" : ""} ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
            onClick={() => {
              if (selectedIdeaIds?.size > 0 && assign_idea_legend_type) {
                // Bulk-assign: remove legend type from all selected ideas
                for (const pid of selectedIdeaIds) {
                  assign_idea_legend_type(pid, null, dims);
                }
                return;
              }
              setGlobalTypeFilter(prev => prev.includes("unassigned") ? prev.filter(t => t !== "unassigned") : [...prev, "unassigned"]);
              addFilterForActiveLegend("unassigned");
            }}
          >
            <div
              onMouseDown={(e) => { e.stopPropagation(); handleTypeDrag(e, null); }}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedIdeaIds?.size > 0 && assign_idea_legend_type) {
                  for (const pid of selectedIdeaIds) {
                    assign_idea_legend_type(pid, null, dims);
                  }
                  return;
                }
                if (paintType && paintType.typeId === null) {
                  setPaintType(null); // deactivate
                } else {
                  setPaintType({ typeId: null, color: "#374151", icon: null, name: "Unassigned" });
                }
              }}
              className={`w-4 h-4 rounded-full cursor-pointer bg-gray-700 border border-gray-300 hover:scale-110 transition-transform ${paintType && paintType.typeId === null ? "ring-2 ring-offset-1 ring-gray-500" : ""}`}
            />
            <span className="text-gray-500 italic flex-1">Unassigned</span>
            {globalTypeFilter.includes("unassigned") && <span className="text-blue-500">✓</span>}
          </div>
          {/* Types */}
          {Object.values(dims.legendTypes).map(lt => (
            <div key={lt.id} className="relative">
              <div
                className={`flex items-center gap-1.5 mb-1 group cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                onClick={() => {
                  if (selectedIdeaIds?.size > 0 && assign_idea_legend_type) {
                    // Bulk-assign this legend type to all selected ideas
                    for (const pid of selectedIdeaIds) {
                      assign_idea_legend_type(pid, lt.id, dims);
                    }
                    return;
                  }
                  setGlobalTypeFilter(prev => prev.includes(lt.id) ? prev.filter(t => t !== lt.id) : [...prev, lt.id]);
                  addFilterForActiveLegend(lt.id);
                }}
              >
                {/* Icon or color circle */}
                <div
                  onMouseDown={(e) => { e.stopPropagation(); handleTypeDrag(e, lt.id); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedIdeaIds?.size > 0 && assign_idea_legend_type) {
                      for (const pid of selectedIdeaIds) {
                        assign_idea_legend_type(pid, lt.id, dims);
                      }
                      return;
                    }
                    if (paintType && paintType.typeId === lt.id) {
                      setPaintType(null); // deactivate
                    } else {
                      setPaintType({ typeId: lt.id, color: lt.color, icon: lt.icon, name: lt.name });
                    }
                  }}
                  className={`w-4 h-4 rounded-full cursor-pointer border border-gray-200 hover:scale-110 transition-transform flex items-center justify-center flex-shrink-0 ${paintType && paintType.typeId === lt.id ? "ring-2 ring-offset-1" : ""}`}
                  style={{ backgroundColor: lt.icon ? "transparent" : lt.color, ...(paintType && paintType.typeId === lt.id ? { ringColor: lt.color } : {}) }}
                >
                  {lt.icon && renderLegendTypeIcon(lt.icon, { style: { fontSize: 14, color: lt.color } })}
                </div>
                {editingTypeId === lt.id ? (
                  <input
                    autoFocus
                    value={editingTypeName}
                    onChange={e => setEditingTypeName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { dims.update_type(lt.id, { name: editingTypeName }); setEditingTypeId(null); }
                      else if (e.key === "Escape") setEditingTypeId(null);
                    }}
                    onBlur={() => { dims.update_type(lt.id, { name: editingTypeName }); setEditingTypeId(null); }}
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none flex-1 min-w-0"
                  />
                ) : (
                  <span
                    onDoubleClick={e => { e.stopPropagation(); setEditingTypeId(lt.id); setEditingTypeName(lt.name); }}
                    className="text-gray-700 cursor-text flex-1"
                  >
                    {lt.name}
                  </span>
                )}
                {globalTypeFilter.includes(lt.id) && <span className="text-blue-500">✓</span>}
                {/* Icon picker button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setIconPickerTypeId(iconPickerTypeId === lt.id ? null : lt.id); }}
                  className="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Choose icon"
                >
                  {lt.icon
                    ? renderLegendTypeIcon(lt.icon, { style: { fontSize: 11, color: "inherit" } })
                    : <span className="text-[9px]">☆</span>
                  }
                </button>
                <label
                  className="relative w-4 h-4 rounded cursor-pointer border border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
                  style={{ backgroundColor: lt.color }}
                  title="Pick color"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="color" value={lt.color}
                    onChange={e => dims.update_type(lt.id, { color: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </label>
                {/* Unselect all ideas from this type */}
                {batchRemoveLegendType && countIdeasWithType(dims.activeLegendId, lt.id) > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const count = countIdeasWithType(dims.activeLegendId, lt.id);
                      if (window.confirm(`Remove "${lt.name}" from ${count} idea${count !== 1 ? "s" : ""}${activeContext ? ` in "${activeContext.name}"` : ""}?`)) {
                        batchRemoveLegendType(dims.activeLegendId, lt.id);
                      }
                    }}
                    className="text-[8px] text-orange-400 hover:text-orange-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title={`Unassign "${lt.name}" from all ideas${activeContext ? ` in "${activeContext.name}"` : ""}`}
                  >
                    ✕all
                  </button>
                )}
                <DeleteForeverIcon
                  onClick={e => { e.stopPropagation(); dims.delete_type(lt.id); }}
                  className="text-gray-300 hover:text-red-500! cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize: 13 }}
                />
              </div>
              {/* Icon picker dropdown */}
              {iconPickerTypeId === lt.id && (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setIconPickerTypeId(null)} />
                  <div className="absolute left-0 top-full z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-[200px] max-h-[260px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-gray-600">Choose Icon</span>
                      <button
                        onClick={() => { dims.update_type(lt.id, { icon: null }); setIconPickerTypeId(null); }}
                        className="text-[9px] text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    {ICON_CATEGORIES.map(cat => (
                      <div key={cat} className="mb-1.5">
                        <div className="text-[9px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wider">{cat}</div>
                        <div className="flex flex-wrap gap-0.5">
                          {Object.entries(LEGEND_TYPE_ICONS)
                            .filter(([, v]) => v.category === cat)
                            .map(([key, v]) => {
                              const IconComp = v.component;
                              const isSelected = lt.icon === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => { dims.update_type(lt.id, { icon: key }); setIconPickerTypeId(null); }}
                                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                    isSelected
                                      ? "bg-blue-100 ring-1 ring-blue-400"
                                      : "hover:bg-gray-100"
                                  }`}
                                  title={v.label}
                                >
                                  <IconComp style={{ fontSize: 15, color: isSelected ? lt.color : "#6b7280" }} />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
          {/* Create type */}
          {showCreateType ? (
            <div className="mt-1 p-1.5 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-1 mb-1">
                <label
                  className="relative w-5 h-5 rounded cursor-pointer border border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
                  style={{ backgroundColor: newTypeColor }}
                  title="Pick color"
                >
                  <input type="color" value={newTypeColor} onChange={e => setNewTypeColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </label>
                <input
                  autoFocus value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTypeName.trim()) {
                      dims.create_type(newTypeName, newTypeColor, newTypeIcon);
                      setNewTypeName(""); setNewTypeColor("#6366f1"); setNewTypeIcon(null); setShowCreateType(false);
                    } else if (e.key === "Escape") setShowCreateType(false);
                  }}
                  placeholder="Type name..."
                  className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                />
              </div>
              {/* Icon selector for new type */}
              <div className="mb-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] text-gray-400">Icon:</span>
                  {newTypeIcon ? (
                    <span className="flex items-center gap-0.5">
                      {renderLegendTypeIcon(newTypeIcon, { style: { fontSize: 13, color: newTypeColor } })}
                      <button onClick={() => setNewTypeIcon(null)} className="text-[9px] text-red-400 hover:text-red-600">✕</button>
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400 italic">None</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-0.5 max-h-[60px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                  {Object.entries(LEGEND_TYPE_ICONS).slice(0, 20).map(([key, v]) => {
                    const IconComp = v.component;
                    return (
                      <button
                        key={key}
                        onClick={() => setNewTypeIcon(key)}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          newTypeIcon === key ? "bg-blue-100 ring-1 ring-blue-400" : "hover:bg-gray-100"
                        }`}
                        title={v.label}
                      >
                        <IconComp style={{ fontSize: 13, color: newTypeIcon === key ? newTypeColor : "#9ca3af" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (newTypeName.trim()) {
                      dims.create_type(newTypeName, newTypeColor, newTypeIcon);
                      setNewTypeName(""); setNewTypeColor("#6366f1"); setNewTypeIcon(null); setShowCreateType(false);
                    }
                  }}
                  className="flex-1 text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create
                </button>
                <button onClick={() => { setShowCreateType(false); setNewTypeIcon(null); }} className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateType(true)}
              className="w-full mt-1 text-[10px] px-1.5 py-1 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              + Add Type
            </button>
          )}
        </div>
      )}
      </div>

      {/* ═══════════════ SECTION 2: FILTERS ═══════════════ */}
      <div className="p-2 pt-0 mt-1 border-t border-gray-100">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setFilterPanelCollapsed(!filterPanelCollapsed)}
        >
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-gray-500" />
            <h3 className="text-[10px] font-semibold text-gray-500">
              Filters {hasAnyFilter && <span className="text-blue-500">({legendFilters.length})</span>}
            </h3>
          </div>
          <span className="text-gray-400 text-[10px]">{filterPanelCollapsed ? "▲" : "▼"}</span>
        </div>
        {!filterPanelCollapsed && (
          <div className="mt-1">
            <div className="flex items-center justify-end gap-1.5 mb-1.5">
                {hasAnyFilter && (
                  <button
                    onClick={clearAllFilters}
                    className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-medium"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={openFilterModal}
                  className="text-[10px] px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-600 hover:bg-blue-100 transition-colors font-medium flex items-center gap-1"
                >
                  <Pencil size={9} />
                  {hasAnyFilter ? "Edit" : "Define"}
                </button>
            </div>

            {/* ── Human-readable filter summary (draggable) ── */}
            {legendFilters.length > 0 && (
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/ideabin-filter", JSON.stringify({
                    legend_filters: legendFilters,
                    filter_combine_mode: filterCombineMode,
                  }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200 text-[11px] text-gray-700 leading-relaxed cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors"
                title="Drag to a category to apply this filter"
              >
                <div className="font-semibold text-blue-700 mb-1">Showing ideas where:</div>
                {legendFilters.map((f, idx) => {
                  const legend = displayLegends.find(l => l.id === f.legendId) || dims.legends.find(l => l.id === f.legendId);
                  const legendName = legend?.name || `Legend #${f.legendId}`;
                  const isActiveLeg = dims.activeLegendId === f.legendId;
                  const typeNames = f.typeIds.map(tid => {
                    if (tid === "unassigned") return "Unassigned";
                    if (isActiveLeg && dims.legendTypes[tid]) return dims.legendTypes[tid].name;
                    return `Type ${tid}`;
                  });
                  return (
                    <div key={`${f.legendId}-${idx}`} className="flex items-start gap-1">
                      {idx > 0 && (
                        <span className="font-bold text-blue-600 mr-0.5">{filterCombineMode.toUpperCase()}</span>
                      )}
                      <span className={`font-bold ${f.mode === "exclude" ? "text-red-600" : "text-green-600"}`}>
                        {f.mode === "exclude" ? "EXCLUDE" : "INCLUDE"}
                      </span>
                      <span className="text-gray-500">
                        {typeNames.join(", ")}
                      </span>
                      <span className="text-gray-400 italic">
                        from {legendName}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ Filter Presets ═══ */}
            {activeContext && saveFilterPreset && (
              <div className="mb-2 space-y-1">
                {/* Save current filter as preset */}
                {hasAnyFilter && (
                  <div className="mb-1">
                    {showSavePreset ? (
                      <div className="flex gap-1 items-center">
                        <input
                          autoFocus
                          value={presetName}
                          onChange={e => setPresetName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && presetName.trim()) {
                              saveFilterPreset(presetName.trim());
                              setPresetName(""); setShowSavePreset(false);
                            } else if (e.key === "Escape") { setShowSavePreset(false); setPresetName(""); }
                          }}
                          placeholder="Preset name..."
                          className="flex-1 text-[10px] px-1.5 py-1 border border-blue-300 rounded outline-none focus:border-blue-500 min-w-0"
                        />
                        <button
                          onClick={() => {
                            if (presetName.trim()) {
                              saveFilterPreset(presetName.trim());
                              setPresetName(""); setShowSavePreset(false);
                            }
                          }}
                          className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                        >Save</button>
                        <button
                          onClick={() => { setShowSavePreset(false); setPresetName(""); }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSavePreset(true)}
                        className="w-full text-[10px] px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 font-medium"
                      >
                        <Save size={11} />
                        Save as preset
                      </button>
                    )}
                  </div>
                )}
                {/* Preset list */}
                {filterPresets && filterPresets.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-gray-500 mb-0.5">Presets</div>
                {filterPresets.map((preset, idx) => (
                  <div key={idx}>
                    {editingPresetIdx === idx ? (
                      <div className="flex gap-1 items-center p-1 bg-gray-50 rounded border border-blue-300">
                        <input
                          autoFocus
                          value={editingPresetName}
                          onChange={e => setEditingPresetName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && editingPresetName.trim()) {
                              renameFilterPreset(idx, editingPresetName.trim());
                              setEditingPresetIdx(null);
                            } else if (e.key === "Escape") setEditingPresetIdx(null);
                          }}
                          onBlur={() => {
                            if (editingPresetName.trim()) renameFilterPreset(idx, editingPresetName.trim());
                            setEditingPresetIdx(null);
                          }}
                          className="flex-1 text-[10px] px-1 py-0.5 border border-blue-300 rounded outline-none min-w-0"
                        />
                      </div>
                    ) : (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/ideabin-filter", JSON.stringify({
                            legend_filters: preset.legend_filters || [],
                            filter_combine_mode: preset.filter_combine_mode || "and",
                          }));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => { applyFilterPreset(preset); setAppliedPresetName(preset.name); }}
                        className="flex items-center gap-1 group p-1.5 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-colors"
                        title="Drag to a category to apply this filter"
                      >
                        <span className="flex-1 text-[10px] font-medium text-gray-700 truncate">{preset.name}</span>
                        <span className="text-[9px] text-gray-400 flex-shrink-0">{preset.legend_filters?.length || 0}r</span>
                        {stackFilterPreset && legendFilters.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); stackFilterPreset(preset); }}
                            className="text-indigo-400 hover:text-indigo-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Stack — merge into current filter"
                          >
                            <Layers size={10} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingPresetIdx(idx); setEditingPresetName(preset.name); }}
                          className="text-gray-400 hover:text-gray-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFilterPreset(idx); }}
                          className="text-gray-400 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                  </div>
                )}
              </div>
            )}

            {/* Create category from current filter */}
            {hasAnyFilter && createCategoryFromFilter && filteredIdeaCount > 0 && (
              <div className="mb-2">
                {showCreateCatInput ? (
                  <div className="flex gap-1 items-center">
                    <input
                      autoFocus
                      value={createCatName}
                      onChange={e => setCreateCatName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && createCatName.trim()) {
                          createCategoryFromFilter(createCatName.trim());
                          setCreateCatName(""); setShowCreateCatInput(false);
                        } else if (e.key === "Escape") { setShowCreateCatInput(false); setCreateCatName(""); }
                      }}
                      placeholder="Category name..."
                      className="flex-1 text-[10px] px-1.5 py-1 border border-green-300 rounded outline-none focus:border-green-500 min-w-0"
                    />
                    <button
                      onClick={() => {
                        if (createCatName.trim()) {
                          createCategoryFromFilter(createCatName.trim());
                          setCreateCatName(""); setShowCreateCatInput(false);
                        }
                      }}
                      className="text-[10px] px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 flex-shrink-0"
                    >Create</button>
                    <button
                      onClick={() => { setShowCreateCatInput(false); setCreateCatName(""); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const now = new Date();
                      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                      setCreateCatName(`${getFilterDisplayName()} ${ts}`);
                      setShowCreateCatInput(true);
                    }}
                    className="w-full text-[10px] px-2 py-1.5 bg-green-50 border border-green-300 rounded-md text-green-700 hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5 font-medium"
                  >
                    <FolderPlus size={12} />
                    Create category from filter ({filteredIdeaCount} ideas)
                  </button>
                )}
              </div>
            )}

          </div>
        )}

        {/* ═══ Filter Rules Modal ═══ */}
        {showFilterModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center">
              <div className="fixed inset-0 bg-black/30" onClick={() => setShowFilterModal(false)} />
              <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-[420px] max-h-[80vh] flex flex-col">
                {/* Modal header */}
                <div className="flex items-center justify-between p-4 pb-2 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-blue-500" />
                    <span className="text-sm font-bold text-gray-700">Define Filters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAnyFilter && (
                      <button
                        onClick={clearAllFilters}
                        className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-medium"
                      >Clear all</button>
                    )}
                    <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div className="p-4 overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
                  {/* AND/OR toggle */}
                  {legendFilters.length >= 2 && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                      <span className="text-[11px] text-gray-500 font-medium">Combine rules:</span>
                      <button
                        onClick={() => setFilterCombineMode("and")}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-colors ${
                          filterCombineMode === "and" ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >AND</button>
                      <button
                        onClick={() => setFilterCombineMode("or")}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-colors ${
                          filterCombineMode === "or" ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >OR</button>
                    </div>
                  )}

                  {/* All legends with their types */}
                  <div className="space-y-3">
                    {displayLegends.map(legend => {
                      const legendTypes = allLegendTypes[legend.id] || (legend.id === dims.activeLegendId ? dims.legendTypes : {});
                      const filterRule = legendFilters.find(f => f.legendId === legend.id);
                      const selectedTypeIds = filterRule?.typeIds || [];
                      const filterMode = filterRule?.mode || "include";
                      const hasSelection = selectedTypeIds.length > 0;

                      return (
                        <div key={legend.id} className={`p-3 rounded-lg border transition-colors ${hasSelection ? "bg-blue-50/50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                          {/* Legend name + mode toggle */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-bold text-gray-700 flex-1 truncate">{legend.name}</span>
                            {hasSelection && (
                              <button
                                onClick={() => toggleModeForLegend(legend.id)}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                                  filterMode === "exclude"
                                    ? "bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
                                    : "bg-green-100 text-green-600 hover:bg-green-200 border border-green-200"
                                }`}
                              >
                                {filterMode === "exclude" ? "EXCLUDE" : "INCLUDE"}
                              </button>
                            )}
                            {!hasSelection && (
                              <span className="text-[9px] text-gray-400 italic">no filter</span>
                            )}
                          </div>

                          {/* Type circles – horizontal, wrap */}
                          <div className="flex flex-wrap gap-1.5">
                            {/* Unassigned circle */}
                            {(() => {
                              const isSelected = selectedTypeIds.includes("unassigned");
                              return (
                                <button
                                  onClick={() => toggleTypeForLegend(legend.id, "unassigned")}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
                                    isSelected
                                      ? "bg-gray-700 text-white border-gray-700 shadow-sm"
                                      : "bg-white text-gray-400 border-gray-300 hover:border-gray-500 hover:text-gray-600"
                                  }`}
                                >
                                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isSelected ? "bg-white/50" : "bg-gray-500"}`} />
                                  Unassigned
                                </button>
                              );
                            })()}
                            {/* Legend types */}
                            {Object.values(legendTypes).map(lt => {
                              const isSelected = selectedTypeIds.includes(lt.id);
                              return (
                                <button
                                  key={lt.id}
                                  onClick={() => toggleTypeForLegend(legend.id, lt.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
                                    isSelected
                                      ? "shadow-sm"
                                      : "bg-white hover:opacity-80"
                                  }`}
                                  style={isSelected
                                    ? { backgroundColor: lt.color + "30", color: lt.color, borderColor: lt.color }
                                    : { color: "#9ca3af", borderColor: "#d1d5db" }
                                  }
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: isSelected ? lt.color : lt.color + "60" }}
                                  />
                                  {lt.icon && renderLegendTypeIcon(lt.icon, { style: { fontSize: 11, color: isSelected ? lt.color : "#9ca3af" } })}
                                  {lt.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Stack presets section ── */}
                  {filterPresets && filterPresets.length > 0 && stackFilterPreset && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="text-[10px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                        <Layers size={10} className="text-indigo-500" />
                        Stack a preset
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {filterPresets.map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => stackFilterPreset(preset)}
                            className="text-[10px] px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors font-medium flex items-center gap-1"
                            title={`Merge "${preset.name}" rules into current filter`}
                          >
                            <Plus size={9} />
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save as preset */}
                  {activeContext && saveFilterPreset && hasAnyFilter && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      {showSavePreset ? (
                        <div className="flex gap-1 items-center">
                          <input
                            autoFocus
                            value={presetName}
                            onChange={e => setPresetName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && presetName.trim()) {
                                saveFilterPreset(presetName.trim());
                                setPresetName(""); setShowSavePreset(false);
                              } else if (e.key === "Escape") { setShowSavePreset(false); setPresetName(""); }
                            }}
                            placeholder="Preset name..."
                            className="flex-1 text-[10px] px-1.5 py-1 border border-blue-300 rounded outline-none focus:border-blue-500 min-w-0"
                          />
                          <button
                            onClick={() => {
                              if (presetName.trim()) {
                                saveFilterPreset(presetName.trim());
                                setPresetName(""); setShowSavePreset(false);
                              }
                            }}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                          >Save</button>
                          <button
                            onClick={() => { setShowSavePreset(false); setPresetName(""); }}
                            className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSavePreset(true)}
                          className="w-full text-[10px] px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 font-medium"
                        >
                          <Save size={11} />
                          Save as preset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}