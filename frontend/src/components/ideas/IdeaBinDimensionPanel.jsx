import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * Dimensions panel at the bottom of the IdeaBin sidebar.
 * Shows dimension selector, legend types, and filter controls.
 */
export default function IdeaBinDimensionPanel({
  dims,
  dimPanelCollapsed, setDimPanelCollapsed,
  showCreateDimension, setShowCreateDimension,
  newDimensionName, setNewDimensionName,
  editingDimensionId, setEditingDimensionId,
  editingDimensionNameLocal, setEditingDimensionNameLocal,
  globalTypeFilter, setGlobalTypeFilter,
  handleLegendDrag,
  editingLegendId, setEditingLegendId,
  editingLegendName, setEditingLegendName,
  showCreateLegend, setShowCreateLegend,
  newLegendColor, setNewLegendColor,
  newLegendName, setNewLegendName,
}) {
  return (
    <div className="bg-white border-t border-gray-200 p-2 flex-shrink-0">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setDimPanelCollapsed(!dimPanelCollapsed)}
      >
        <div className="flex items-center gap-1">
          <h3 className="text-[10px] font-semibold text-gray-500">
            Dimensions {globalTypeFilter.length > 0 && <span className="text-blue-500">(filtered)</span>}
          </h3>
          {!dimPanelCollapsed && !showCreateDimension && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateDimension(true); }}
              className="w-4 h-4 flex items-center justify-center rounded text-[11px] font-bold text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="New Dimension"
            >+</button>
          )}
        </div>
        <span className="text-gray-400 text-[10px]">{dimPanelCollapsed ? "▲" : "▼"}</span>
      </div>
      {!dimPanelCollapsed && (
        <div className="mt-1">
          {/* Dimension selector — hidden while creating */}
          {dims.dimensions.length > 0 && !showCreateDimension && (
            <div className="mb-1">
              {editingDimensionId ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={editingDimensionNameLocal}
                    onChange={(e) => setEditingDimensionNameLocal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingDimensionNameLocal.trim()) {
                        dims.update_dimension(editingDimensionId, editingDimensionNameLocal.trim());
                        setEditingDimensionId(null);
                      } else if (e.key === "Escape") setEditingDimensionId(null);
                    }}
                    onBlur={() => {
                      if (editingDimensionNameLocal.trim()) dims.update_dimension(editingDimensionId, editingDimensionNameLocal.trim());
                      setEditingDimensionId(null);
                    }}
                    className="flex-1 text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none"
                  />
                  <button onClick={() => setEditingDimensionId(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    value={dims.activeDimensionId || ""}
                    onChange={(e) => dims.setActiveDimensionId(e.target.value ? parseInt(e.target.value) : null)}
                    className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none bg-white"
                  >
                    {dims.dimensions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const dim = dims.dimensions.find(d => d.id === dims.activeDimensionId);
                      if (dim) { setEditingDimensionId(dim.id); setEditingDimensionNameLocal(dim.name); }
                    }}
                    title="Rename"
                    className="text-[10px] text-gray-400 hover:text-blue-500 px-0.5"
                  >✎</button>
                  <button
                    onClick={() => {
                      if (dims.activeDimensionId && window.confirm("Delete this dimension?")) {
                        dims.delete_dimension(dims.activeDimensionId);
                      }
                    }}
                    title="Delete"
                    className="text-[10px] text-gray-400 hover:text-red-500 px-0.5"
                  >✕</button>
                </div>
              )}
            </div>
          )}
          {/* Create dimension */}
          {showCreateDimension ? (
            <div className="flex gap-1 mb-1">
              <input
                autoFocus
                value={newDimensionName}
                onChange={(e) => setNewDimensionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDimensionName.trim()) {
                    dims.create_dimension(newDimensionName.trim());
                    setNewDimensionName(""); setShowCreateDimension(false);
                  } else if (e.key === "Escape") setShowCreateDimension(false);
                }}
                placeholder="Dimension name..."
                className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none focus:border-blue-400"
              />
              <button
                onClick={() => {
                  if (newDimensionName.trim()) {
                    dims.create_dimension(newDimensionName.trim());
                    setNewDimensionName("");
                    setShowCreateDimension(false);
                  }
                }}
                className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              >+</button>
              <button onClick={() => setShowCreateDimension(false)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
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
              onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, null); }}
              className="w-4 h-4 rounded-full cursor-grab bg-gray-700 border border-gray-300 hover:scale-110 transition-transform"
            />
            <span className="text-gray-500 italic flex-1">Unassigned</span>
            {globalTypeFilter.includes("unassigned") && <span className="text-blue-500">✓</span>}
          </div>
          {/* Dimension types */}
          {Object.values(dims.dimensionTypes).map(lt => (
            <div
              key={lt.id}
              className={`flex items-center gap-1.5 mb-1 group cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
              onClick={() => setGlobalTypeFilter(prev => prev.includes(lt.id) ? prev.filter(t => t !== lt.id) : [...prev, lt.id])}
            >
              <div
                onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, lt.id); }}
                className="w-4 h-4 rounded-full cursor-grab border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: lt.color }}
              />
              {editingLegendId === lt.id ? (
                <input
                  autoFocus
                  value={editingLegendName}
                  onChange={e => setEditingLegendName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { dims.update_dimension_type(lt.id, { name: editingLegendName }); setEditingLegendId(null); }
                    else if (e.key === "Escape") setEditingLegendId(null);
                  }}
                  onBlur={() => { dims.update_dimension_type(lt.id, { name: editingLegendName }); setEditingLegendId(null); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none flex-1 min-w-0"
                />
              ) : (
                <span
                  onDoubleClick={e => { e.stopPropagation(); setEditingLegendId(lt.id); setEditingLegendName(lt.name); }}
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
                  onChange={e => dims.update_dimension_type(lt.id, { color: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
              <DeleteForeverIcon
                onClick={e => { e.stopPropagation(); dims.delete_dimension_type(lt.id); }}
                className="text-gray-300 hover:text-red-500! cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ fontSize: 13 }}
              />
            </div>
          ))}
          {/* Create type */}
          {showCreateLegend ? (
            <div className="mt-1 p-1.5 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-1 mb-1">
                <label
                  className="relative w-5 h-5 rounded cursor-pointer border border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
                  style={{ backgroundColor: newLegendColor }}
                  title="Pick color"
                >
                  <input type="color" value={newLegendColor} onChange={e => setNewLegendColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </label>
                <input
                  autoFocus value={newLegendName} onChange={e => setNewLegendName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newLegendName.trim()) {
                      dims.create_dimension_type(newLegendName, newLegendColor);
                      setNewLegendName(""); setNewLegendColor("#6366f1"); setShowCreateLegend(false);
                    } else if (e.key === "Escape") setShowCreateLegend(false);
                  }}
                  placeholder="Type name..."
                  className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (newLegendName.trim()) {
                      dims.create_dimension_type(newLegendName, newLegendColor);
                      setNewLegendName(""); setNewLegendColor("#6366f1"); setShowCreateLegend(false);
                    }
                  }}
                  className="flex-1 text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create
                </button>
                <button onClick={() => setShowCreateLegend(false)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateLegend(true)}
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
