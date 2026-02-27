import { useState, useCallback, useRef } from "react";
import { fetchContextsApi, saveContextFilterStateApi, setContextColorApi } from "../api/contextApi";

/**
 * Manages context enter/exit, context list fetching, context filter persistence,
 * and canvas scroll-to-context.
 *
 * Because this hook is called early (before useLegends / useIdeaBinCategories),
 * it reads late-bound values (dims, categories, categoryContainerRef) through
 * `lateRef` — the caller updates `lateRef.current` every render.
 *
 * @param {object} deps
 * @returns context state + actions
 */
export default function useIdeaBinContext(deps) {
  const {
    // ── Setters it must call when entering/exiting context ──
    setViewMode,
    setLegendFilters,
    setFilterCombineMode,
    setStackedFilters,
    setStackCombineMode,
    setGlobalTypeFilter,
    setFilterPresets,
    setLegendPanelCollapsed,
    // ── ref so formations hook can call enterContext ──
    enterContextRef,
  } = deps;

  // ───── Context state ─────
  const [activeContext, setActiveContext] = useState(null);
  const [contextsList, setContextsList] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [showContextColorPicker, setShowContextColorPicker] = useState(false);

  /**
   * Late-bind ref — the parent keeps this in sync every render with:
   *   { dims, categories, categoryContainerRef, legendFilters, filterCombineMode,
   *     stackedFilters, stackCombineMode, globalTypeFilter, legendPanelCollapsed, filterPresets }
   */
  const lateRef = useRef({});

  // ── Fetch contexts list for selector dropdown ──
  const fetch_contexts_for_selector = async () => {
    try {
      const list = await fetchContextsApi();
      setContextsList(list);
    } catch (e) { console.error("Failed to fetch contexts list", e); }
  };

  // ── Scroll canvas to show all context categories ──
  const scrollCanvasToContextCategories = useCallback((categoryIds) => {
    const { categories, categoryContainerRef } = lateRef.current;
    const container = categoryContainerRef?.current;
    if (!container || !categoryIds?.length) return;

    let minX = Infinity, minY = Infinity;
    for (const catId of categoryIds) {
      const cat = categories?.[catId];
      if (!cat || cat.archived) continue;
      if (cat.x < minX) minX = cat.x;
      if (cat.y < minY) minY = cat.y;
    }

    if (minX === Infinity) return;

    container.scrollLeft = Math.max(0, minX - 12);
    container.scrollTop = Math.max(0, minY - 12);
  }, []);

  // ── Save current filter state to context backend ──
  const saveContextFilterState = async (contextId) => {
    const lb = lateRef.current;
    try {
      await saveContextFilterStateApi(contextId, {
        legend_filters: lb.legendFilters,
        filter_combine_mode: lb.filterCombineMode,
        stacked_filters: lb.stackedFilters || [],
        stack_combine_mode: lb.stackCombineMode || "or",
        global_type_filter: lb.globalTypeFilter || [],
        active_legend_id: lb.dims?.activeLegendId || null,
        legend_panel_collapsed: lb.legendPanelCollapsed,
        filter_presets: lb.filterPresets || [],
      });
    } catch (e) { console.error("Failed to save context filter state", e); }
  };

  // ── Enter context mode ──
  const enterContext = async (ctx) => {
    // Save current context's filter state before switching
    if (activeContext) {
      saveContextFilterState(activeContext.id);
    }
    // Re-fetch fresh context data to get latest category_ids and legend_ids
    try {
      const freshList = await fetchContextsApi();
      const freshCtx = freshList.find(c => c.id === ctx.id);
      if (freshCtx) {
        ctx = freshCtx;
      }
    } catch (e) { /* fall back to the passed ctx */ }
    setActiveContext(ctx);
    setViewMode("ideas");
    // Restore full filter + legend state from the entered context
    if (ctx.filter_state) {
      setLegendFilters(ctx.filter_state.legend_filters || []);
      setFilterCombineMode(ctx.filter_state.filter_combine_mode || "and");
      setStackedFilters(ctx.filter_state.stacked_filters || []);
      setStackCombineMode(ctx.filter_state.stack_combine_mode || "or");
      setGlobalTypeFilter(ctx.filter_state.global_type_filter || []);
      setFilterPresets(ctx.filter_state.filter_presets || []);
      const lb = lateRef.current;
      if (ctx.filter_state.active_legend_id !== undefined && lb.dims) {
        lb.dims.setActiveLegendId(ctx.filter_state.active_legend_id);
      }
      if (ctx.filter_state.legend_panel_collapsed !== undefined) {
        setLegendPanelCollapsed(ctx.filter_state.legend_panel_collapsed);
      }
    } else {
      setLegendFilters([]);
      setFilterCombineMode("and");
      setStackedFilters([]);
      setStackCombineMode("or");
      setGlobalTypeFilter([]);
      setFilterPresets([]);
    }
  };
  // Keep ref in sync so the formations hook can call enterContext
  if (enterContextRef) enterContextRef.current = enterContext;

  // ── Exit context mode ──
  const exitContext = () => {
    if (activeContext) {
      saveContextFilterState(activeContext.id);
    }
    setActiveContext(null);
    setLegendFilters([]);
    setFilterCombineMode("and");
    setStackedFilters([]);
    setStackCombineMode("or");
    setGlobalTypeFilter([]);
    setFilterPresets([]);
  };

  // ── Update context color ──
  const updateActiveContextColor = async (color) => {
    if (!activeContext) return;
    setActiveContext(prev => ({ ...prev, color }));
    try {
      await setContextColorApi(activeContext.id, color);
    } catch (err) { console.error("IdeaBin: set context color failed", err); }
  };

  return {
    // state
    activeContext, setActiveContext,
    contextsList, setContextsList,
    showContextSelector, setShowContextSelector,
    showContextColorPicker, setShowContextColorPicker,
    // late-bind ref — caller must update every render
    lateRef,
    // actions
    fetch_contexts_for_selector,
    scrollCanvasToContextCategories,
    saveContextFilterState,
    enterContext,
    exitContext,
    updateActiveContextColor,
  };
}
