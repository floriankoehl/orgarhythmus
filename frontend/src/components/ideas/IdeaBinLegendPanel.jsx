import { useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { Filter, X, Plus } from "lucide-react";
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
}) {
  const displayLegends = legendsList || dims.legends;
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [iconPickerTypeId, setIconPickerTypeId] = useState(null); // type id with open icon picker
  const [newTypeIcon, setNewTypeIcon] = useState(null); // icon for create-type form

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
  };
  return (
    <div className="bg-white border-t border-gray-200 p-2 flex-shrink-0">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setLegendPanelCollapsed(!legendPanelCollapsed)}
      >
        <div className="flex items-center gap-1">
          <h3 className="text-[10px] font-semibold text-gray-500">
            Legends {hasAnyFilter && <span className="text-blue-500">(filtered)</span>}
          </h3>
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
            className={`flex items-center gap-1.5 mb-1 cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
            onClick={() => {
              setGlobalTypeFilter(prev => prev.includes("unassigned") ? prev.filter(t => t !== "unassigned") : [...prev, "unassigned"]);
              addFilterForActiveLegend("unassigned");
            }}
          >
            <div
              onMouseDown={(e) => { e.stopPropagation(); handleTypeDrag(e, null); }}
              className="w-4 h-4 rounded-full cursor-grab bg-gray-700 border border-gray-300 hover:scale-110 transition-transform"
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
                  setGlobalTypeFilter(prev => prev.includes(lt.id) ? prev.filter(t => t !== lt.id) : [...prev, lt.id]);
                  addFilterForActiveLegend(lt.id);
                }}
              >
                {/* Icon or color circle */}
                <div
                  onMouseDown={(e) => { e.stopPropagation(); handleTypeDrag(e, lt.id); }}
                  className="w-4 h-4 rounded-full cursor-grab border border-gray-200 hover:scale-110 transition-transform flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: lt.icon ? "transparent" : lt.color }}
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

          {/* ═══ Advanced Filters Section ═══ */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Filter size={12} className="text-gray-500" />
                <span className="text-[11px] font-bold text-gray-600">Active Filters</span>
                {legendFilters.length > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">{legendFilters.length}</span>
                )}
              </div>
              {hasAnyFilter && (
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* ── Human-readable filter summary ── */}
            {legendFilters.length > 0 && (
              <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200 text-[11px] text-gray-700 leading-relaxed">
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

            {/* AND/OR toggle — only shown when 2+ filter rules */}
            {legendFilters.length >= 2 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Combine rules:</span>
                <button
                  onClick={() => setFilterCombineMode("and")}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-colors ${
                    filterCombineMode === "and"
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  AND
                </button>
                <button
                  onClick={() => setFilterCombineMode("or")}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-colors ${
                    filterCombineMode === "or"
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  OR
                </button>
              </div>
            )}

            {/* Active filter rules */}
            {legendFilters.map((f, idx) => {
              const legend = displayLegends.find(l => l.id === f.legendId) || dims.legends.find(l => l.id === f.legendId);
              const legendName = legend?.name || `Legend #${f.legendId}`;
              const isActiveLegend = dims.activeLegendId === f.legendId;
              const types = isActiveLegend ? dims.legendTypes : {};

              return (
                <div key={`${f.legendId}-${idx}`} className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[11px] font-bold text-blue-600 truncate max-w-[90px] cursor-pointer hover:underline"
                        onClick={() => dims.setActiveLegendId(f.legendId)}
                        title="Click to switch to this legend"
                      >
                        {legendName}
                      </span>
                      <button
                        onClick={() => toggleFilterMode(idx)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                          f.mode === "exclude"
                            ? "bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
                            : "bg-green-100 text-green-600 hover:bg-green-200 border border-green-200"
                        }`}
                        title={f.mode === "include" ? "Click to switch to EXCLUDE" : "Click to switch to INCLUDE"}
                      >
                        {f.mode === "exclude" ? "EXCLUDE" : "INCLUDE"}
                      </button>
                    </div>
                    <button
                      onClick={() => removeFilter(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {/* Selected type chips */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.typeIds.map(tid => {
                      const typeName = tid === "unassigned"
                        ? "Unassigned"
                        : types[tid]?.name || `Type ${tid}`;
                      const typeColor = tid === "unassigned"
                        ? "#374151"
                        : types[tid]?.color || "#94a3b8";
                      return (
                        <span
                          key={tid}
                          onClick={() => toggleTypeInFilter(idx, tid)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity"
                          style={{ backgroundColor: typeColor + "25", color: typeColor, border: `1px solid ${typeColor}40` }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor }} />
                          {typeName}
                          <X size={8} className="ml-0.5" />
                        </span>
                      );
                    })}
                  </div>
                  {/* If this legend is active, show addable types */}
                  {isActiveLegend && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {!f.typeIds.includes("unassigned") && (
                        <button
                          onClick={() => toggleTypeInFilter(idx, "unassigned")}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                          + Unassigned
                        </button>
                      )}
                      {Object.values(types).filter(t => !f.typeIds.includes(t.id)).map(t => (
                        <button
                          key={t.id}
                          onClick={() => toggleTypeInFilter(idx, t.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: t.color + "15", color: t.color, border: `1px solid ${t.color}30` }}
                        >
                          + {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add filter rule for another legend */}
            {showAddFilter ? (
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 mb-1.5">
                <div className="text-[11px] font-bold text-blue-600 mb-1">Choose legend to filter:</div>
                {displayLegends
                  .filter(l => !legendFilters.some(f => f.legendId === l.id))
                  .map(l => (
                    <button
                      key={l.id}
                      onClick={() => addFilterForLegend(l.id)}
                      className="w-full text-left px-2 py-1.5 text-[11px] text-gray-700 hover:bg-blue-100 rounded-md transition-colors font-medium"
                    >
                      {l.name}
                    </button>
                  ))
                }
                {displayLegends.filter(l => !legendFilters.some(f => f.legendId === l.id)).length === 0 && (
                  <div className="text-[10px] text-gray-400 italic px-1">All legends have filters</div>
                )}
                <button
                  onClick={() => setShowAddFilter(false)}
                  className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              displayLegends.length > 0 && (
                <button
                  onClick={() => setShowAddFilter(true)}
                  className="w-full text-[10px] px-2 py-1.5 border border-dashed border-blue-300 rounded-md text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 font-medium"
                >
                  <Plus size={10} />
                  Add filter rule
                </button>
              )
            )}
          </div>        </div>
      )}
    </div>
  );
}