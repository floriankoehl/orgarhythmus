// Category canvas: container for all category windows + archive drawer + create button
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CategoryWindow from "./CategoryWindow";

function Button({ text, handleButtonClick }) {
  return (
    <div
      onClick={() => handleButtonClick()}
      className="bg-white select-none shadow-xl border border-gray-200 rounded-full h-10 w-40
        flex justify-center items-center hover:bg-gray-100 active:bg-gray-300 cursor-pointer"
    >
      {text}
    </div>
  );
}

/**
 * Right-hand area of the Ideas page.
 * Holds the absolutely-positioned category windows, the "Create Category"
 * button, and the archive drawer.
 */
export default function CategoryCanvas({
  // Layout
  categoryContainerRef,
  // Data
  categories,
  ideas,
  categoryOrders,
  legendTypes,
  activeCategories,
  archivedCategories,
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
    displayForm,
    setDisplayForm,
    showArchive,
    setShowArchive,
    confirm_delete_category,
  } = uiState;

  const {
    toggle_archive_category,
    delete_category,
  } = dataActions;

  return (
    <div
      ref={categoryContainerRef}
      className="flex-1 h-full shadow-xl border border-gray-200 relative overflow-hidden"
    >
      {/* Create Category Button — always on top */}
      <div className="absolute top-4 right-4 z-[9999] flex gap-2">
        <Button
          text={"Create Category"}
          handleButtonClick={() => setDisplayForm(true)}
        />
        {archivedCategories.length > 0 && (
          <div
            onClick={() => setShowArchive(!showArchive)}
            className="bg-white select-none shadow-xl border border-gray-200 rounded-full h-10 px-4
              flex justify-center items-center hover:bg-gray-100 active:bg-gray-300 cursor-pointer gap-1"
          >
            <ArchiveIcon style={{ fontSize: 18 }} />
            <span className="text-sm">{archivedCategories.length}</span>
          </div>
        )}
      </div>

      {/* Archive drawer */}
      {showArchive && archivedCategories.length > 0 && (
        <div className="absolute top-16 right-4 z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 p-3 min-w-[220px] max-h-[400px] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2 text-gray-500">Archived Categories</h3>
          {archivedCategories.map((cat) => {
            const catIdeas = categoryOrders[cat.id] || [];
            return (
              <div
                key={cat.id}
                className="flex justify-between items-center p-2 rounded hover:bg-gray-50 mb-1 border border-gray-100"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({catIdeas.length} ideas)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <UnarchiveIcon
                    onClick={() => toggle_archive_category(cat.id)}
                    className="hover:text-green-600! cursor-pointer"
                    style={{ fontSize: 18 }}
                    titleAccess="Restore"
                  />
                  <DeleteForeverIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      confirm_delete_category(cat.id, cat.name, delete_category);
                    }}
                    className="hover:text-red-500! cursor-pointer"
                    style={{ fontSize: 18 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Windows (only non-archived) */}
      {activeCategories.map(([category_key, category_data]) => (
        <CategoryWindow
          key={category_key}
          category_key={category_key}
          category_data={category_data}
          ideas={ideas}
          categoryOrders={categoryOrders}
          legendTypes={legendTypes}
          dragging={dragging}
          dragSource={dragSource}
          prevIndex={prevIndex}
          hoverIndex={hoverIndex}
          hoverCategory={hoverCategory}
          handleIdeaDrag={handleIdeaDrag}
          handleCategoryDrag={handleCategoryDrag}
          bring_to_front_category={bring_to_front_category}
          minimizedCategories={minimizedCategories}
          toggleMinimizeCategory={toggleMinimizeCategory}
          uiState={uiState}
          dataActions={dataActions}
          categoryRefs={categoryRefs}
          ideaRefs={ideaRefs}
        />
      ))}
    </div>
  );
}
