// Single category window — header (drag, edit, minimize, collapse, filter, archive, delete) + idea list
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import IdeaItem from "./IdeaItem";

/**
 * Renders one category window positioned absolutely inside the canvas.
 * Contains draggable header, inline rename, idea type‑filter dropdown,
 * collapse/minimize toggles, archive/delete, and a scrollable idea list.
 */
export default function CategoryWindow({
  category_key,
  category_data,
  // Data
  ideas,
  categoryOrders,
  legendTypes,
  // Drag
  dragging,
  dragSource,
  prevIndex,
  hoverIndex,
  hoverCategory,
  handleIdeaDrag,
  // Layout actions
  handleCategoryDrag,
  bring_to_front_category,
  minimizedCategories,
  toggleMinimizeCategory,
  // UI state
  uiState,
  // Data actions
  dataActions,
  // Refs
  categoryRefs,
  ideaRefs,
}) {
  const {
    editingCategoryId,
    editingCategoryName,
    setEditingCategoryName,
    startEditCategory,
    cancelEditCategory,
    collapsedIdeas,
    setCollapsedIdeas,
    showCategoryFilter,
    setShowCategoryFilter,
    categoryTypeFilters,
    setCategoryTypeFilters,
    passesGlobalFilter,
    passesCategoryFilter,
    toggleCollapseAllInCategory,
    confirm_delete_category,
    confirm_delete_idea,
    editingIdeaId,
    startEditIdea,
  } = uiState;

  const {
    rename_category_api,
    toggle_archive_category,
    delete_category,
    delete_idea,
    set_area_category,
  } = dataActions;

  const catIdeas = categoryOrders[category_key] || [];
  const isHovered = dragging && String(hoverCategory) === String(category_key);

  return (
    <div
      onMouseDown={(e) => {
        if (!e.ctrlKey) {
          bring_to_front_category(category_key);
        }
      }}
      style={{
        left: category_data.x,
        top: category_data.y,
        width: category_data.width,
        height: category_data.height,
        zIndex: category_data.z_index || 0,
        backgroundColor: isHovered ? "#fde68a" : "#fef08a",
        transition: "background-color 150ms ease",
      }}
      className="absolute shadow-xl rounded p-2 flex flex-col"
    >
      {/* Category header (drag handle) */}
      <div
        onMouseDown={(e) => {
          if (!e.ctrlKey) {
            e.stopPropagation();
            handleCategoryDrag(e, category_key);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startEditCategory(category_key, category_data.name);
        }}
        className="flex justify-between items-center mb-1 flex-shrink-0 bg-amber-300/50 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b border-amber-400/40"
      >
        {editingCategoryId === category_key ? (
          <input
            autoFocus
            value={editingCategoryName}
            onChange={(e) => setEditingCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                rename_category_api(category_key, editingCategoryName);
                cancelEditCategory();
              } else if (e.key === "Escape") {
                cancelEditCategory();
              }
            }}
            onBlur={() => {
              rename_category_api(category_key, editingCategoryName);
              cancelEditCategory();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="bg-white text-sm font-semibold px-1 py-0.5 rounded outline-none border border-blue-400 flex-1 mr-1"
          />
        ) : (
          <span className="font-semibold text-sm truncate">
            {category_data.name}
          </span>
        )}
        <div className="flex items-center gap-1">
          {/* Minimize / Restore */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimizeCategory(category_key, category_data);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="text-xs text-amber-700 hover:text-amber-900 cursor-pointer px-0.5"
            title={minimizedCategories[category_key] ? "Restore size" : "Minimize"}
          >
            {minimizedCategories[category_key] ? '◻' : '—'}
          </span>
          {/* Collapse all ideas toggle */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapseAllInCategory(categoryOrders, category_key);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="text-xs text-amber-700 hover:text-amber-900 cursor-pointer px-1"
            title={catIdeas.every((id) => collapsedIdeas[id]) ? "Expand all ideas" : "Collapse all ideas"}
          >
            <span style={{
              display: 'inline-block',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              ...(catIdeas.every((id) => collapsedIdeas[id])
                ? { borderWidth: '6px 4px 0 4px', borderColor: 'currentColor transparent transparent transparent' }
                : { borderWidth: '0 4px 6px 4px', borderColor: 'transparent transparent currentColor transparent' }),
            }} />
          </span>
          {/* Type filter button */}
          <span
            data-filter-dropdown
            onClick={(e) => {
              e.stopPropagation();
              setShowCategoryFilter(showCategoryFilter === category_key ? null : category_key);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className={`text-xs cursor-pointer px-1 ${(categoryTypeFilters[category_key]?.length > 0) ? "text-blue-600" : "text-amber-700 hover:text-amber-900"}`}
            title="Filter by type"
          >
            ⚙
          </span>
          <ArchiveIcon
            onClick={(e) => {
              e.stopPropagation();
              toggle_archive_category(category_key);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="hover:text-amber-700! cursor-pointer"
            style={{ fontSize: 16 }}
            titleAccess="Archive"
          />
          <DeleteForeverIcon
            onClick={(e) => {
              e.stopPropagation();
              confirm_delete_category(category_key, category_data.name, delete_category);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="hover:text-red-500! cursor-pointer"
            style={{ fontSize: 18 }}
          />
        </div>
      </div>

      {/* Filter dropdown */}
      {showCategoryFilter === category_key && (
        <div
          data-filter-dropdown
          className="absolute top-8 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[140px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">Filter by Type</div>
          {categoryTypeFilters[category_key]?.length > 0 && (
            <button
              onClick={() => setCategoryTypeFilters((prev) => ({ ...prev, [category_key]: [] }))}
              className="w-full text-xs px-2 py-1 mb-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
            >
              Clear
            </button>
          )}
          <div
            className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer text-xs ${categoryTypeFilters[category_key]?.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
            onClick={() => {
              setCategoryTypeFilters((prev) => {
                const current = prev[category_key] || [];
                return {
                  ...prev,
                  [category_key]: current.includes("unassigned")
                    ? current.filter((t) => t !== "unassigned")
                    : [...current, "unassigned"],
                };
              });
            }}
          >
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <span className="flex-1 text-gray-500 italic">Unassigned</span>
            {categoryTypeFilters[category_key]?.includes("unassigned") && <span className="text-blue-500">✓</span>}
          </div>
          {Object.values(legendTypes).map((lt) => (
            <div
              key={lt.id}
              className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer text-xs ${categoryTypeFilters[category_key]?.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
              onClick={() => {
                setCategoryTypeFilters((prev) => {
                  const current = prev[category_key] || [];
                  return {
                    ...prev,
                    [category_key]: current.includes(lt.id)
                      ? current.filter((t) => t !== lt.id)
                      : [...current, lt.id],
                  };
                });
              }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
              <span className="flex-1">{lt.name}</span>
              {categoryTypeFilters[category_key]?.includes(lt.id) && <span className="text-blue-500">✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* Ideas inside category (scrollable) */}
      <div
        ref={(el) => (categoryRefs.current[category_key] = el)}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {catIdeas
          .filter((ideaId) => {
            const idea = ideas[ideaId];
            if (!idea) return false;
            if (!passesGlobalFilter(idea)) return false;
            if (!passesCategoryFilter(idea, category_key)) return false;
            return true;
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
                source={{ type: "category", id: category_key }}
                dragSource={dragSource}
                prevIndex={prevIndex}
                hoverIndex={hoverIndex}
                handleIdeaDrag={handleIdeaDrag}
                legendTypes={legendTypes}
                hoverIdeaForLegend={null}
                draggingLegend={null}
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
    </div>
  );
}
