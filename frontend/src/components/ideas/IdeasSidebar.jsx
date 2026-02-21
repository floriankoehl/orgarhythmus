// Left sidebar: form + unassigned idea list + dimensions panel
import { useState } from "react";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import IdeaItem from "./IdeaItem";

/**
 * Left sidebar containing:
 * - Create / edit idea form (with resizable height)
 * - Unassigned idea list
 * - Dimensions panel (dimension selector, type dots, filters, create new)
 */
export default function IdeasSidebar({
  // Layout
  sidebarWidth,
  // Data
  ideas,
  unassignedOrder,
  legendTypes,      // backward-compat
  dimensionTypes,   // preferred: types from active dimension
  // Dimension management
  dimensions = [],
  activeDimensionId,
  setActiveDimensionId,
  dimensionActions = {},
  // Drag
  dragging,
  dragSource,
  prevIndex,
  hoverIndex,
  hoverUnassigned,
  handleIdeaDrag,
  // Legend interaction
  legendInteraction,
  // UI state
  uiState,
  // Data actions
  dataActions,
  // Refs
  IdeaListRef,
  ideaRefs,
}) {
  // Dimension UI state (local)
  const [showCreateDimension, setShowCreateDimension] = useState(false);
  const [newDimensionName, setNewDimensionName] = useState("");
  const [editingDimensionId, setEditingDimensionId] = useState(null);
  const [editingDimensionNameLocal, setEditingDimensionNameLocal] = useState("");

  // Use dimensionTypes if provided, fall back to legendTypes
  const effectiveTypes = dimensionTypes ?? legendTypes ?? {};
  const {
    editingIdeaId,
    editingIdeaTitle,
    setEditingIdeaTitle,
    editingIdeaHeadline,
    setEditingIdeaHeadline,
    startEditIdea,
    cancelEditIdea,
    ideaName,
    setIdeaName,
    ideaHeadline,
    setIdeaHeadline,
    formHeight,
    setFormHeight,
    collapsedIdeas,
    setCollapsedIdeas,
    globalTypeFilter,
    setGlobalTypeFilter,
    passesGlobalFilter,
    confirm_delete_idea,
  } = uiState;

  const {
    create_idea,
    update_idea_title_api,
    delete_idea,
  } = dataActions;

  const {
    draggingLegend,
    hoverIdeaForLegend,
    handleLegendDrag,
    editingLegendId,
    setEditingLegendId,
    editingLegendName,
    setEditingLegendName,
    legendCollapsed,
    setLegendCollapsed,
    showCreateLegend,
    setShowCreateLegend,
    newLegendColor,
    setNewLegendColor,
    newLegendName,
    setNewLegendName,
  } = legendInteraction;

  const {
    create_dimension_type = dataActions.create_legend_type,
    update_dimension_type = dataActions.update_legend_type,
    delete_dimension_type = dataActions.delete_legend_type,
  } = dimensionActions;

  const handleSubmitIdea = () => {
    if (editingIdeaId) {
      update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
      cancelEditIdea();
    } else {
      create_idea(ideaName, ideaHeadline);
      setIdeaName("");
      setIdeaHeadline("");
    }
  };

  return (
    <div
      style={{ width: `${sidebarWidth}px`, minWidth: 200 }}
      className="h-full shadow-xl bg-white border border-gray-200 select-none flex flex-col flex-shrink-0"
    >
      {/* ===== Create/Edit Idea Form ===== */}
      <div className="bg-gray-50 p-3 flex-shrink-0 relative border-b border-gray-200" style={{ minHeight: formHeight }}>
        <h1 className="text-xl mb-2">
          {editingIdeaId ? "Edit Idea" : "New Idea"}
        </h1>
        {/* Headline field */}
        <TextField
          value={editingIdeaId ? editingIdeaHeadline : ideaHeadline}
          onChange={(e) => {
            if (editingIdeaId) {
              setEditingIdeaHeadline(e.target.value);
            } else {
              setIdeaHeadline(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmitIdea();
            } else if (e.key === "Escape" && editingIdeaId) {
              cancelEditIdea();
            }
          }}
          id="idea-headline"
          label="Headline (optional)"
          variant="outlined"
          size="small"
          fullWidth
          sx={{ backgroundColor: "white", borderRadius: 1, marginBottom: 1 }}
        />
        <TextField
          value={editingIdeaId ? editingIdeaTitle : ideaName}
          onChange={(e) => {
            if (editingIdeaId) {
              setEditingIdeaTitle(e.target.value);
            } else {
              setIdeaName(e.target.value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmitIdea();
            } else if (e.key === "Escape" && editingIdeaId) {
              cancelEditIdea();
            }
          }}
          id="idea-name"
          label={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
          variant="outlined"
          multiline
          minRows={2}
          maxRows={Math.max(2, Math.floor((formHeight - (editingIdeaId ? 100 : 60)) / 24))}
          fullWidth
          sx={{ backgroundColor: "white", borderRadius: 1 }}
        />
        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          {editingIdeaId ? (
            <>
              <button
                onClick={() => {
                  update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
                  cancelEditIdea();
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Update
              </button>
              <button
                onClick={cancelEditIdea}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            (ideaName.trim() || ideaHeadline.trim()) && (
              <button
                onClick={() => {
                  create_idea(ideaName, ideaHeadline);
                  setIdeaName("");
                  setIdeaHeadline("");
                }}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
              >
                Create
              </button>
            )
          )}
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = formHeight;
            const onMouseMove = (ev) => {
              const delta = ev.clientY - startY;
              setFormHeight(Math.max(100, Math.min(startHeight + delta, 400)));
            };
            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
          className="absolute bottom-0 left-0 right-0 h-2 bg-gray-300 hover:bg-blue-400 cursor-ns-resize transition-colors"
        />
      </div>

      {/* ===== Unassigned Idea List ===== */}
      <div
        ref={IdeaListRef}
        style={{
          backgroundColor:
            dragging && hoverUnassigned ? "#f3f4f6" : "#ffffff",
          transition: "background-color 150ms ease",
        }}
        className="flex-1 p-2 relative overflow-y-auto"
      >
        <h1 className="text-xl mb-1">Unassigned Ideas</h1>
        {unassignedOrder
          .filter((ideaId) => {
            const idea = ideas[ideaId];
            if (!idea) return false;
            return passesGlobalFilter(idea);
          })
          .map((ideaId, arrayIndex) => {
            const idea = ideas[ideaId];
            if (!idea) return null;
            return (
              <IdeaItem
                key={ideaId}
                ideaId={ideaId}
                idea={idea}
                arrayIndex={arrayIndex}
                source={{ type: "unassigned" }}
                dragSource={dragSource}
                prevIndex={prevIndex}
                hoverIndex={hoverIndex}
                handleIdeaDrag={handleIdeaDrag}
                legendTypes={effectiveTypes}
                hoverIdeaForLegend={hoverIdeaForLegend}
                draggingLegend={draggingLegend}
                isIdeaCollapsed={collapsedIdeas[ideaId] ?? false}
                onToggleCollapse={(id) =>
                  setCollapsedIdeas((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                isEditing={editingIdeaId === ideaId}
                onStartEdit={startEditIdea}
                onConfirmDelete={(idea) => confirm_delete_idea(idea, delete_idea)}
                ideaRefs={ideaRefs}
              />
            );
          })}
      </div>

      {/* ===== Dimensions Panel ===== */}
      <div className="bg-white border-t border-gray-300 p-3 flex-shrink-0">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setLegendCollapsed(!legendCollapsed)}
        >
          <h3 className="text-sm font-semibold text-gray-600">
            Dimensions {globalTypeFilter.length > 0 && <span className="text-blue-500">(filtered)</span>}
          </h3>
          <span className="text-gray-400 text-xs">{legendCollapsed ? '▲' : '▼'}</span>
        </div>

        {!legendCollapsed && (
          <>
            {/* Dimension selector */}
            {dimensions.length > 0 && (
              <div className="mt-2 mb-1">
                {editingDimensionId ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={editingDimensionNameLocal}
                      onChange={(e) => setEditingDimensionNameLocal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingDimensionNameLocal.trim()) {
                          dimensionActions.update_dimension?.(editingDimensionId, editingDimensionNameLocal.trim());
                          setEditingDimensionId(null);
                        } else if (e.key === "Escape") setEditingDimensionId(null);
                      }}
                      onBlur={() => {
                        if (editingDimensionNameLocal.trim()) {
                          dimensionActions.update_dimension?.(editingDimensionId, editingDimensionNameLocal.trim());
                        }
                        setEditingDimensionId(null);
                      }}
                      className="flex-1 text-xs px-2 py-0.5 border border-blue-400 rounded outline-none"
                    />
                    <button onClick={() => setEditingDimensionId(null)} className="text-xs px-1 text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <select
                      value={activeDimensionId || ""}
                      onChange={(e) => setActiveDimensionId(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 text-xs px-1 py-0.5 border border-gray-300 rounded outline-none focus:border-blue-400 bg-white"
                    >
                      {dimensions.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const dim = dimensions.find(d => d.id === activeDimensionId);
                        if (dim) { setEditingDimensionId(dim.id); setEditingDimensionNameLocal(dim.name); }
                      }}
                      title="Rename dimension"
                      className="text-gray-400 hover:text-blue-500 text-xs px-1 leading-none"
                    >✎</button>
                    <button
                      onClick={() => {
                        if (activeDimensionId && window.confirm("Delete this dimension and all its types?")) {
                          dimensionActions.delete_dimension?.(activeDimensionId);
                        }
                      }}
                      title="Delete dimension"
                      className="text-gray-400 hover:text-red-500 text-xs px-1 leading-none"
                    >✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Create new dimension */}
            {showCreateDimension ? (
              <div className="flex gap-1 mb-2">
                <input
                  autoFocus
                  value={newDimensionName}
                  onChange={(e) => setNewDimensionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newDimensionName.trim()) {
                      dimensionActions.create_dimension?.(newDimensionName.trim());
                      setNewDimensionName("");
                      setShowCreateDimension(false);
                    } else if (e.key === "Escape") setShowCreateDimension(false);
                  }}
                  placeholder="Dimension name..."
                  className="flex-1 text-xs px-2 py-0.5 border border-gray-300 rounded outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => {
                    if (newDimensionName.trim()) {
                      dimensionActions.create_dimension?.(newDimensionName.trim());
                      setNewDimensionName("");
                      setShowCreateDimension(false);
                    }
                  }}
                  className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >+</button>
                <button onClick={() => setShowCreateDimension(false)} className="text-xs px-1 text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateDimension(true)}
                className="w-full mb-2 text-xs px-2 py-1 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                + New Dimension
              </button>
            )}

            {/* Clear filter button */}
            {globalTypeFilter.length > 0 && (
              <button
                onClick={() => setGlobalTypeFilter([])}
                className="w-full mb-2 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
              >
                Clear Filter
              </button>
            )}

            {/* Unassigned type (black) - always first */}
            <div
              className={`flex items-center gap-2 mb-1.5 group mt-1 cursor-pointer rounded px-1 py-0.5 transition-colors ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
              onClick={() => {
                setGlobalTypeFilter((prev) =>
                  prev.includes("unassigned")
                    ? prev.filter((t) => t !== "unassigned")
                    : [...prev, "unassigned"]
                );
              }}
            >
              <div
                onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, null); }}
                className="w-6 h-6 rounded-full cursor-grab hover:scale-110 transition-transform shadow-sm border border-gray-200 bg-gray-700"
                title="Drag to remove type"
              />
              <span className="text-xs text-gray-500 italic flex-1">Unassigned</span>
              {globalTypeFilter.includes("unassigned") && <span className="text-blue-500 text-xs">✓</span>}
            </div>

            {/* Dimension types */}
            {Object.values(effectiveTypes).map((lt) => (
              <div
                key={lt.id}
                className={`flex items-center gap-2 mb-1.5 group cursor-pointer rounded px-1 py-0.5 transition-colors ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                onClick={() => {
                  setGlobalTypeFilter((prev) =>
                    prev.includes(lt.id)
                      ? prev.filter((t) => t !== lt.id)
                      : [...prev, lt.id]
                  );
                }}
              >
                <div
                  onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, lt.id); }}
                  className="w-6 h-6 rounded-full cursor-grab hover:scale-110 transition-transform shadow-sm border border-gray-200"
                  style={{ backgroundColor: lt.color }}
                  title={`Drag to assign: ${lt.name}`}
                />
                {editingLegendId === lt.id ? (
                  <input
                    autoFocus
                    value={editingLegendName}
                    onChange={(e) => setEditingLegendName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        update_dimension_type(lt.id, { name: editingLegendName });
                        setEditingLegendId(null);
                      } else if (e.key === "Escape") {
                        setEditingLegendId(null);
                      }
                    }}
                    onBlur={() => {
                      update_dimension_type(lt.id, { name: editingLegendName });
                      setEditingLegendId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-1 py-0.5 border border-blue-400 rounded outline-none flex-1 min-w-0"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingLegendId(lt.id);
                      setEditingLegendName(lt.name);
                    }}
                    className="text-xs text-gray-700 cursor-text flex-1"
                  >
                    {lt.name}
                  </span>
                )}
                {globalTypeFilter.includes(lt.id) && <span className="text-blue-500 text-xs">✓</span>}
                <input
                  type="color"
                  value={lt.color}
                  onChange={(e) => update_dimension_type(lt.id, { color: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Change color"
                />
                <DeleteForeverIcon
                  onClick={(e) => { e.stopPropagation(); delete_dimension_type(lt.id); }}
                  className="text-gray-300 hover:text-red-500! cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize: 16 }}
                />
              </div>
            ))}

            {/* Create new type */}
            {showCreateLegend ? (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={newLegendColor}
                    onChange={(e) => setNewLegendColor(e.target.value)}
                    className="w-6 h-6 cursor-pointer rounded"
                  />
                  <input
                    autoFocus
                    value={newLegendName}
                    onChange={(e) => setNewLegendName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newLegendName.trim()) {
                        create_dimension_type(newLegendName, newLegendColor);
                        setNewLegendName("");
                        setNewLegendColor("#6366f1");
                        setShowCreateLegend(false);
                      } else if (e.key === "Escape") {
                        setShowCreateLegend(false);
                      }
                    }}
                    placeholder="Type name..."
                    className="text-xs px-2 py-1 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      if (newLegendName.trim()) {
                        create_dimension_type(newLegendName, newLegendColor);
                        setNewLegendName("");
                        setNewLegendColor("#6366f1");
                        setShowCreateLegend(false);
                      }
                    }}
                    className="flex-1 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateLegend(false)}
                    className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateLegend(true)}
                className="w-full mt-2 text-xs px-2 py-1.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              >
                + Add Type
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
