import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * Legends panel at the bottom of the IdeaBin sidebar.
 * Shows legend selector, types, and filter controls.
 */
export default function IdeaBinLegendPanel({
  dims,
  legendPanelCollapsed, setLegendPanelCollapsed,
  showCreateLegend, setShowCreateLegend,
  newLegendName, setNewLegendName,
  editingLegendId, setEditingLegendId,
  editingLegendNameLocal, setEditingLegendNameLocal,
  globalTypeFilter, setGlobalTypeFilter,
  handleTypeDrag,
  editingTypeId, setEditingTypeId,
  editingTypeName, setEditingTypeName,
  showCreateType, setShowCreateType,
  newTypeColor, setNewTypeColor,
  newTypeName, setNewTypeName,
  onLegendCreated,  // optional callback(legendId) after a legend is created
  legendsList,      // optional filtered legends array (defaults to dims.legends)
}) {
  const displayLegends = legendsList || dims.legends;
  const handleCreateLegend = async (name) => {
    await dims.create_legend(name);
    // After creation, the latest legend will be at the end of dims.legends (if state updated)
    // We fire the callback with no ID — parent will check dims.legends for the newest
    if (onLegendCreated) onLegendCreated();
  };
  return (
    <div className="bg-white border-t border-gray-200 p-2 flex-shrink-0">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setLegendPanelCollapsed(!legendPanelCollapsed)}
      >
        <div className="flex items-center gap-1">
          <h3 className="text-[10px] font-semibold text-gray-500">
            Legends {globalTypeFilter.length > 0 && <span className="text-blue-500">(filtered)</span>}
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
          {globalTypeFilter.length > 0 && (
            <button
              onClick={() => setGlobalTypeFilter([])}
              className="w-full mb-1 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
            >
              Clear Filter
            </button>
          )}
          {/* Unassigned type */}
          <div
            className={`flex items-center gap-1.5 mb-1 cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
            onClick={() => setGlobalTypeFilter(prev => prev.includes("unassigned") ? prev.filter(t => t !== "unassigned") : [...prev, "unassigned"])}
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
            <div
              key={lt.id}
              className={`flex items-center gap-1.5 mb-1 group cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
              onClick={() => setGlobalTypeFilter(prev => prev.includes(lt.id) ? prev.filter(t => t !== lt.id) : [...prev, lt.id])}
            >
              <div
                onMouseDown={(e) => { e.stopPropagation(); handleTypeDrag(e, lt.id); }}
                className="w-4 h-4 rounded-full cursor-grab border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: lt.color }}
              />
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
                      dims.create_type(newTypeName, newTypeColor);
                      setNewTypeName(""); setNewTypeColor("#6366f1"); setShowCreateType(false);
                    } else if (e.key === "Escape") setShowCreateType(false);
                  }}
                  placeholder="Type name..."
                  className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (newTypeName.trim()) {
                      dims.create_type(newTypeName, newTypeColor);
                      setNewTypeName(""); setNewTypeColor("#6366f1"); setShowCreateType(false);
                    }
                  }}
                  className="flex-1 text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create
                </button>
                <button onClick={() => setShowCreateType(false)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300">
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
  );
}
