import { useRef } from "react";
import { useParams } from "react-router-dom";
import { BASE_URL } from '../../config/api';

// Hooks
import { useIdeasData } from "./ideas/useIdeasData";
import { useIdeaUIState } from "./ideas/useIdeaUIState.jsx";
import { useCategoryLayout } from "./ideas/useCategoryLayout";
import { useIdeaDrag } from "./ideas/useIdeaDrag";
import { useLegendInteraction } from "./ideas/useLegendInteraction";

// Components
import IdeasModals from "../../components/ideas/IdeasModals";
import IdeasSidebar from "../../components/ideas/IdeasSidebar";
import CategoryCanvas from "../../components/ideas/CategoryCanvas";

export default function Ideas() {
  const { projectId } = useParams();
  const apiBase = `${BASE_URL}/api/projects/${projectId}`;

  // Refs shared across hooks / components
  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});

  // ===== HOOKS =====

  const data = useIdeasData(projectId);
  const uiState = useIdeaUIState();

  const layout = useCategoryLayout({
    categories: data.categories,
    setCategories: data.setCategories,
    set_position_category: data.set_position_category,
    set_area_category: data.set_area_category,
    bring_to_front_category: data.bring_to_front_category,
  });

  const drag = useIdeaDrag({
    categories: data.categories,
    unassignedOrder: data.unassignedOrder,
    setUnassignedOrder: data.setUnassignedOrder,
    categoryOrders: data.categoryOrders,
    setCategoryOrders: data.setCategoryOrders,
    safe_order: data.safe_order,
    assign_idea_to_category: data.assign_idea_to_category,
    categoryContainerRef: layout.categoryContainerRef,
    IdeaListRef,
    categoryRefs,
  });

  const legendInteraction = useLegendInteraction({
    legendTypes: data.legendTypes,
    assign_idea_legend_type: data.assign_idea_legend_type,
    ideaRefs,
  });

  // ===== DERIVED DATA =====

  const archivedCategories = Object.values(data.categories).filter((c) => c.archived);
  const activeCategories = Object.entries(data.categories).filter(([, c]) => !c.archived);

  // Convenience object passed to child components
  const dataActions = {
    create_idea: data.create_idea,
    delete_idea: data.delete_idea,
    update_idea_title_api: data.update_idea_title_api,
    rename_category_api: data.rename_category_api,
    toggle_archive_category: data.toggle_archive_category,
    delete_category: data.delete_category,
    set_area_category: data.set_area_category,
    create_legend_type: data.create_legend_type,
    update_legend_type: data.update_legend_type,
    delete_legend_type: data.delete_legend_type,
  };

  // ===== JSX =====

  return (
    <>
      <div className="h-screen w-screen p-10 flex justify-center items-center select-none">
        {/* Modals layer (create-category overlay + confirm modal) */}
        <IdeasModals
          confirmModal={uiState.confirmModal}
          displayForm={uiState.displayForm}
          setDisplayForm={uiState.setDisplayForm}
          fetch_categories={data.fetch_categories}
          apiBase={apiBase}
        />

        <div className="h-full w-full bg-white shadow-2xl border border-gray-300 rounded flex">
          {/* Left sidebar */}
          <IdeasSidebar
            sidebarWidth={layout.sidebarWidth}
            ideas={data.ideas}
            unassignedOrder={data.unassignedOrder}
            legendTypes={data.legendTypes}
            dragging={drag.dragging}
            dragSource={drag.dragSource}
            prevIndex={drag.prevIndex}
            hoverIndex={drag.hoverIndex}
            hoverUnassigned={drag.hoverUnassigned}
            handleIdeaDrag={drag.handleIdeaDrag}
            legendInteraction={legendInteraction}
            uiState={uiState}
            dataActions={dataActions}
            IdeaListRef={IdeaListRef}
            ideaRefs={ideaRefs}
          />

          {/* Resize handle */}
          <div
            onMouseDown={layout.handleSidebarResize}
            className="w-1.5 h-full bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors duration-150"
          />

          {/* Category canvas */}
          <CategoryCanvas
            categoryContainerRef={layout.categoryContainerRef}
            categories={data.categories}
            ideas={data.ideas}
            categoryOrders={data.categoryOrders}
            legendTypes={data.legendTypes}
            activeCategories={activeCategories}
            archivedCategories={archivedCategories}
            dragging={drag.dragging}
            dragSource={drag.dragSource}
            prevIndex={drag.prevIndex}
            hoverIndex={drag.hoverIndex}
            hoverCategory={drag.hoverCategory}
            handleIdeaDrag={drag.handleIdeaDrag}
            handleCategoryDrag={layout.handleCategoryDrag}
            bring_to_front_category={data.bring_to_front_category}
            minimizedCategories={layout.minimizedCategories}
            toggleMinimizeCategory={layout.toggleMinimizeCategory}
            uiState={uiState}
            dataActions={dataActions}
            categoryRefs={categoryRefs}
            ideaRefs={ideaRefs}
          />
        </div>
      </div>

      {/* GHOST (dragging indicator - always on top) */}
      {drag.dragging && (
        <div
          style={{
            top: `${drag.dragging.y}px`,
            left: `${drag.dragging.x}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="fixed max-w-60 shadow-lg border border-gray-200 bg-white rounded text-gray-800 px-2 py-1.5 flex items-center text-xs"
        >
          <span className="whitespace-pre-wrap line-clamp-2">
            {drag.dragging.idea.headline && <span className="font-semibold">{drag.dragging.idea.headline}: </span>}
            {drag.dragging.idea.title}
          </span>
        </div>
      )}

      {/* LEGEND DRAG GHOST */}
      {legendInteraction.draggingLegend && (
        <div
          style={{
            top: `${legendInteraction.draggingLegend.y}px`,
            left: `${legendInteraction.draggingLegend.x}px`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 9999,
            backgroundColor: legendInteraction.draggingLegend.color,
          }}
          className="fixed w-8 h-8 rounded-full shadow-lg border-2 border-white"
        />
      )}
    </>
  );
}
