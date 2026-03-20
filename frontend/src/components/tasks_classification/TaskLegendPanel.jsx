import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Palette, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { LEGEND_TYPE_ICONS, ICON_CATEGORIES, renderLegendTypeIcon } from "../ideas/legendTypeIcons";

/**
 * Legend panel for the Task Structure sidebar.
 *
 * Mirrors IdeaBinLegendPanel's core UX:
 *   – Legend selector (switch / create / rename / delete)
 *   – Type list with color dots, names, icons
 *   – Create / edit / delete types (color picker + icon picker)
 *   – Paint mode: click a type, then click tasks to assign
 *   – Ctrl+click type to batch-assign to selected tasks
 */
export default function TaskLegendPanel({
  collapsed,
  setCollapsed,
  // legend state from useTaskLegends
  legends,
  activeLegendId,
  setActiveLegendId,
  legendTypes,
  createLegend,
  updateLegend,
  deleteLegend,
  createType,
  updateType,
  deleteType,
  // task data
  tasks,
  selectedTaskIds,
  // assignment
  onAssignType,        // (taskId, legendId, legendTypeId) => void
  onBatchAssignType,   // (taskIds, legendId, legendTypeId) => void
  onBatchRemoveType,   // (taskIds, legendId) => void
  onRemoveAllTypes,    // (taskId) => void
  // paint mode
  paintType,
  setPaintType,
  // filter mode
  filterTypeId,
  setFilterTypeId,
}) {
  // ── Local UI state ──
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendName, setNewLegendName] = useState("");
  const [editingLegendId, setEditingLegendId] = useState(null);
  const [editingLegendName, setEditingLegendName] = useState("");
  const [showCreateType, setShowCreateType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#6366f1");
  const [newTypeIcon, setNewTypeIcon] = useState(null);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [editingTypeColor, setEditingTypeColor] = useState("");
  const [editingTypeIcon, setEditingTypeIcon] = useState(null);
  const [iconPickerTypeId, setIconPickerTypeId] = useState(null); // "new" or type id
  const createLegendRef = useRef(null);
  const createTypeRef = useRef(null);

  // Focus inputs when shown
  useEffect(() => {
    if (showCreateLegend && createLegendRef.current) createLegendRef.current.focus();
  }, [showCreateLegend]);
  useEffect(() => {
    if (showCreateType && createTypeRef.current) createTypeRef.current.focus();
  }, [showCreateType]);

  const activeLeg = legends?.find(l => l.id === activeLegendId);
  const typesArr = Object.values(legendTypes || {}).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Count tasks with a specific type assigned
  const countTasksWithType = (typeId) => {
    if (!tasks) return 0;
    let count = 0;
    for (const t of Object.values(tasks)) {
      const dt = t.legend_types?.[String(activeLegendId)];
      if (typeId === "unassigned") {
        if (!dt) count++;
      } else {
        if (dt && dt.legend_type_id === typeId) count++;
      }
    }
    return count;
  };

  // ── Handlers ──
  const handleCreateLegend = async () => {
    const name = newLegendName.trim();
    if (!name) return;
    await createLegend(name);
    setNewLegendName("");
    setShowCreateLegend(false);
  };

  const handleRenameLegend = async () => {
    const name = editingLegendName.trim();
    if (!name || !editingLegendId) return;
    await updateLegend(editingLegendId, name);
    setEditingLegendId(null);
  };

  const handleDeleteLegend = async (legendId) => {
    await deleteLegend(legendId);
  };

  const handleCreateType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    await createType(name, newTypeColor, newTypeIcon);
    setNewTypeName("");
    setNewTypeColor("#6366f1");
    setNewTypeIcon(null);
    setShowCreateType(false);
  };

  const handleUpdateType = async (typeId) => {
    const updates = {};
    if (editingTypeName.trim()) updates.name = editingTypeName.trim();
    if (editingTypeColor) updates.color = editingTypeColor;
    if (editingTypeIcon !== undefined) updates.icon = editingTypeIcon;
    if (Object.keys(updates).length) await updateType(typeId, updates);
    setEditingTypeId(null);
  };

  const handleDeleteType = async (typeId) => {
    await deleteType(typeId);
    if (paintType?.typeId === typeId) setPaintType(null);
  };

  // Click the row label → toggle filter
  const handleTypeClick = (typeId, e) => {
    // Ctrl+click: batch assign to selected tasks
    if ((e.ctrlKey || e.metaKey) && selectedTaskIds?.size > 0 && onBatchAssignType) {
      onBatchAssignType([...selectedTaskIds], activeLegendId, typeId);
      return;
    }
    // Normal click: toggle filter
    setFilterTypeId?.(prev => prev === typeId ? null : typeId);
  };

  // Click the color dot/icon → toggle paint mode
  const handleColorClick = (typeId, typeName, typeColor, typeIcon, e) => {
    e.stopPropagation();
    if (paintType?.typeId === typeId && paintType?.legendId === activeLegendId) {
      setPaintType(null);
    } else {
      setPaintType({ typeId, legendId: activeLegendId, color: typeColor, name: typeName, icon: typeIcon });
    }
  };

  const handleUnassignedClick = (e) => {
    // Ctrl+click: batch remove from selected tasks
    if ((e.ctrlKey || e.metaKey) && selectedTaskIds?.size > 0 && onBatchRemoveType) {
      onBatchRemoveType([...selectedTaskIds], activeLegendId);
      return;
    }
    // Normal click: toggle filter for unassigned
    setFilterTypeId?.(prev => prev === "unassigned" ? null : "unassigned");
  };

  // Click the unassigned dot → toggle paint-remove mode
  const handleUnassignedColorClick = (e) => {
    e.stopPropagation();
    if (paintType?.typeId === null && paintType?.legendId === activeLegendId) {
      setPaintType(null);
    } else {
      setPaintType({ typeId: null, legendId: activeLegendId, color: null, name: "Unassigned", icon: null });
    }
  };

  // Palette of quick-pick colors
  const COLOR_PALETTE = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
    "#10b981", "#14b8a6", "#8b5cf6", "#f43f5e", "#78716c",
  ];

  const renderColorPicker = (color, setColor) => (
    <div className="flex flex-wrap gap-1 mb-1">
      {COLOR_PALETTE.map(c => (
        <button
          key={c}
          onClick={() => setColor(c)}
          className={`w-4 h-4 rounded-full border-2 transition-all ${color === c ? "border-gray-800 scale-110" : "border-transparent hover:border-gray-400"}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="w-4 h-4 rounded cursor-pointer border-0 p-0"
        title="Custom color"
      />
    </div>
  );

  const renderIconPicker = (selectedIcon, setIcon, close) => (
    <div className="bg-white border border-gray-200 rounded-md shadow-lg p-2 max-h-48 overflow-y-auto absolute z-50 w-56 left-0 top-full mt-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-medium text-gray-500">Pick icon</span>
        <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
      </div>
      {/* No icon option */}
      <button
        onClick={() => { setIcon(null); close(); }}
        className={`px-1 py-0.5 rounded text-[9px] mb-1 ${!selectedIcon ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100 text-gray-500"}`}
      >
        No icon
      </button>
      {Object.entries(ICON_CATEGORIES).map(([cat, icons]) => (
        <div key={cat} className="mb-1">
          <div className="text-[8px] text-gray-400 font-medium mb-0.5">{cat}</div>
          <div className="flex flex-wrap gap-0.5">
            {icons.map(key => {
              const entry = LEGEND_TYPE_ICONS[key];
              if (!entry) return null;
              return (
                <button
                  key={key}
                  onClick={() => { setIcon(key); close(); }}
                  title={entry.label}
                  className={`p-0.5 rounded transition-colors ${selectedIcon === key ? "bg-indigo-100 text-indigo-700" : "hover:bg-gray-100 text-gray-600"}`}
                >
                  {renderLegendTypeIcon(key, { style: { fontSize: 14 } })}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="border-t border-gray-200 flex-shrink-0">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      >
        <Palette size={10} />
        Legends
        {activeLeg && <span className="text-gray-400 ml-1">— {activeLeg.name}</span>}
        {filterTypeId && (
          <span className="ml-1 text-[9px] text-amber-600 font-medium">filtered</span>
        )}
        {paintType && (
          <span className="ml-1 flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: paintType.color || "#ccc" }} />
            <span className="text-[9px] text-indigo-600 font-medium">painting</span>
          </span>
        )}
        <span className="ml-auto">
          {collapsed ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-2 py-1 space-y-1 max-h-[300px] overflow-y-auto">

          {/* ── Legend selector ── */}
          <div className="flex items-center gap-1 flex-wrap">
            <select
              value={activeLegendId || ""}
              onChange={e => setActiveLegendId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 min-w-0 text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-indigo-300"
            >
              <option value="">No legend</option>
              {(legends || []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            {/* Rename active legend */}
            {activeLeg && !editingLegendId && (
              <button
                onClick={() => { setEditingLegendId(activeLeg.id); setEditingLegendName(activeLeg.name); }}
                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="Rename legend"
              >
                <Pencil size={10} />
              </button>
            )}

            {/* Delete active legend */}
            {activeLeg && (
              <button
                onClick={() => handleDeleteLegend(activeLeg.id)}
                className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                title="Delete legend"
              >
                <Trash2 size={10} />
              </button>
            )}

            {/* Create legend */}
            <button
              onClick={() => { setShowCreateLegend(true); setNewLegendName(""); }}
              className="p-0.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
              title="New legend"
            >
              <Plus size={10} />
            </button>
          </div>

          {/* Rename legend inline */}
          {editingLegendId && (
            <div className="flex items-center gap-1">
              <input
                value={editingLegendName}
                onChange={e => setEditingLegendName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRenameLegend(); if (e.key === "Escape") setEditingLegendId(null); }}
                className="flex-1 text-[10px] border border-indigo-300 rounded px-1 py-0.5 focus:outline-none"
                autoFocus
              />
              <button onClick={handleRenameLegend} className="text-green-600 hover:text-green-700"><Check size={10} /></button>
              <button onClick={() => setEditingLegendId(null)} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
            </div>
          )}

          {/* Create legend inline */}
          {showCreateLegend && (
            <div className="flex items-center gap-1">
              <input
                ref={createLegendRef}
                value={newLegendName}
                onChange={e => setNewLegendName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateLegend(); if (e.key === "Escape") setShowCreateLegend(false); }}
                placeholder="Legend name…"
                className="flex-1 text-[10px] border border-indigo-300 rounded px-1 py-0.5 focus:outline-none"
              />
              <button onClick={handleCreateLegend} className="text-green-600 hover:text-green-700"><Check size={10} /></button>
              <button onClick={() => setShowCreateLegend(false)} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
            </div>
          )}

          {/* ── Types list ── */}
          {activeLeg && (
            <div className="space-y-0.5">
              {typesArr.map(t => {
                const isEditing = editingTypeId === t.id;
                const isPainting = paintType?.typeId === t.id && paintType?.legendId === activeLegendId;
                const count = countTasksWithType(t.id);

                if (isEditing) {
                  return (
                    <div key={t.id} className="space-y-1 bg-gray-50 rounded p-1">
                      <input
                        value={editingTypeName}
                        onChange={e => setEditingTypeName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleUpdateType(t.id); if (e.key === "Escape") setEditingTypeId(null); }}
                        className="w-full text-[10px] border rounded px-1 py-0.5"
                        autoFocus
                      />
                      {renderColorPicker(editingTypeColor, setEditingTypeColor)}
                      <div className="relative">
                        <button
                          onClick={() => setIconPickerTypeId(iconPickerTypeId === t.id ? null : t.id)}
                          className="text-[9px] text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
                        >
                          {editingTypeIcon ? renderLegendTypeIcon(editingTypeIcon, { style: { fontSize: 12 } }) : "No icon"}
                          <ChevronDown size={8} />
                        </button>
                        {iconPickerTypeId === t.id && renderIconPicker(editingTypeIcon, setEditingTypeIcon, () => setIconPickerTypeId(null))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdateType(t.id)} className="text-[9px] text-green-600 hover:text-green-700 font-medium">Save</button>
                        <button onClick={() => setEditingTypeId(null)} className="text-[9px] text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    </div>
                  );
                }

                const isFiltering = filterTypeId === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={(e) => handleTypeClick(t.id, e)}
                    className={`group flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-all text-[10px]
                      ${isFiltering ? "bg-amber-50 ring-1 ring-amber-400" : isPainting ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                    title="Click to filter · Click color to paint · Ctrl+click to assign to selected"
                  >
                    {/* Color dot or icon — click to toggle paint mode */}
                    {t.icon ? (
                      <span
                        onClick={(e) => handleColorClick(t.id, t.name, t.color, t.icon, e)}
                        className={`flex-shrink-0 rounded p-0.5 cursor-pointer transition-all hover:opacity-80 ${isPainting ? "ring-2 ring-indigo-400" : ""}`}
                        style={{ color: t.color }}
                        title="Click to paint"
                      >
                        {renderLegendTypeIcon(t.icon, { style: { fontSize: 14 } })}
                      </span>
                    ) : (
                      <span
                        onClick={(e) => handleColorClick(t.id, t.name, t.color, t.icon, e)}
                        className={`w-3 h-3 rounded-full flex-shrink-0 cursor-pointer transition-all hover:scale-125 ${isPainting ? "ring-2 ring-offset-1 ring-indigo-400" : "border border-gray-200"}`}
                        style={{ backgroundColor: t.color }}
                        title="Click to paint"
                      />
                    )}

                    <span className={`flex-1 truncate ${isFiltering ? "text-amber-700 font-medium" : "text-gray-700"}`}>{t.name}</span>
                    <span className="text-[8px] text-gray-400">{count}</span>

                    {/* Edit / Delete (hidden until hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTypeId(t.id);
                        setEditingTypeName(t.name);
                        setEditingTypeColor(t.color);
                        setEditingTypeIcon(t.icon);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity"
                    >
                      <Pencil size={9} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteType(t.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                );
              })}

              {/* Unassigned row */}
              {typesArr.length > 0 && (() => {
                const isFilteringUnassigned = filterTypeId === "unassigned";
                const isPaintingUnassigned = paintType?.typeId === null && paintType?.legendId === activeLegendId;
                return (
                  <div
                    onClick={handleUnassignedClick}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-all text-[10px]
                      ${isFilteringUnassigned ? "bg-amber-50 ring-1 ring-amber-400" : isPaintingUnassigned ? "bg-gray-100" : "hover:bg-gray-50"}`}
                    title="Click to filter unassigned · Click dot to paint-remove · Ctrl+click to remove from selected"
                  >
                    <span
                      onClick={handleUnassignedColorClick}
                      className={`w-3 h-3 rounded-full flex-shrink-0 border-dashed bg-white cursor-pointer transition-all hover:scale-125 ${isPaintingUnassigned ? "border-2 border-gray-600" : "border border-gray-300"}`}
                      title="Click to paint-remove"
                    />
                    <span className={`flex-1 italic ${isFilteringUnassigned ? "text-amber-700 font-medium not-italic" : "text-gray-400"}`}>Unassigned</span>
                    <span className="text-[8px] text-gray-400">{countTasksWithType("unassigned")}</span>
                  </div>
                );
              })()}

              {/* Create type form */}
              {showCreateType ? (
                <div className="space-y-1 bg-gray-50 rounded p-1 mt-1">
                  <input
                    ref={createTypeRef}
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleCreateType(); if (e.key === "Escape") setShowCreateType(false); }}
                    placeholder="Type name…"
                    className="w-full text-[10px] border rounded px-1 py-0.5"
                  />
                  {renderColorPicker(newTypeColor, setNewTypeColor)}
                  <div className="relative">
                    <button
                      onClick={() => setIconPickerTypeId(iconPickerTypeId === "new" ? null : "new")}
                      className="text-[9px] text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
                    >
                      {newTypeIcon ? renderLegendTypeIcon(newTypeIcon, { style: { fontSize: 12 } }) : "No icon"}
                      <ChevronDown size={8} />
                    </button>
                    {iconPickerTypeId === "new" && renderIconPicker(newTypeIcon, setNewTypeIcon, () => setIconPickerTypeId(null))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handleCreateType} className="text-[9px] text-green-600 hover:text-green-700 font-medium">Create</button>
                    <button onClick={() => setShowCreateType(false)} className="text-[9px] text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowCreateType(true); setNewTypeName(""); setNewTypeColor("#6366f1"); setNewTypeIcon(null); }}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 px-1.5 py-1 w-full"
                >
                  <Plus size={10} /> Add type
                </button>
              )}
            </div>
          )}

          {/* No legend selected hint */}
          {!activeLeg && (legends || []).length === 0 && !showCreateLegend && (
            <div className="text-[10px] text-gray-400 italic text-center py-2">
              Create a legend to classify tasks by type.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
