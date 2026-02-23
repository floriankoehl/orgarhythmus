import { useState, useEffect, useRef, useCallback } from "react";
import { playSound } from "../../../assets/sound_registry";
import { authFetch, API } from "../api/authFetch";
import {
  fetchFormationsApi,
  saveFormationApi,
  updateFormationStateApi,
  renameFormationApi,
  loadFormationApi,
  deleteFormationApi,
  toggleDefaultFormationApi,
  loadDefaultFormationApi,
} from "../api/formationApi";
import {
  setContextPositionApi,
  setContextAreaApi,
} from "../api/contextApi";
import {
  setPositionCategory,
  setAreaCategory,
} from "../api/categoryApi";

/**
 * Manages formation save/load/delete/rename/default logic.
 *
 * deps — an object containing all the state getters & setters the formation
 * system needs to read from / write to. We thread them through to avoid
 * circular imports while keeping the hook self-contained.
 */
export default function useIdeaBinFormations(deps) {
  const {
    // read
    windowPos, windowSize, isMaximized, viewMode, sidebarWidth,
    sidebarHeadlineOnly, showSidebarMeta, listFilter, showArchive,
    dims, legendPanelCollapsed, globalTypeFilter, legendFilters,
    filterCombineMode, activeContext, minimizedCategories,
    collapsedIdeas, selectedCategoryIds, showMetaList, dockedCategories,
    categories, contextViewRef,
    // write
    setWindowPos, setWindowSize, setIsMaximized, setViewMode,
    setSidebarWidth, setSidebarHeadlineOnly, setShowSidebarMeta,
    setListFilter, setShowArchive, setLegendPanelCollapsed,
    setGlobalTypeFilter, setLegendFilters, setFilterCombineMode,
    setActiveContext, setMinimizedCategories, setCollapsedIdeas,
    setSelectedCategoryIds, setShowMetaList, setDockedCategories,
    setCategories,
  } = deps;

  const [formations, setFormations] = useState([]);
  const [showFormationPanel, setShowFormationPanel] = useState(false);
  const [formationName, setFormationName] = useState("");
  const [editingFormationId, setEditingFormationId] = useState(null);
  const [editingFormationName, setEditingFormationName] = useState("");

  const fetch_formations = useCallback(async () => {
    try {
      const list = await fetchFormationsApi();
      setFormations(list);
    } catch (err) { console.error("Fetch formations failed", err); }
  }, []);

  useEffect(() => { fetch_formations(); }, []);

  /** Collect all saveable visual state into a single JSON-serialisable object. */
  const collectFormationState = useCallback(() => {
    const state = {
      version: 1,
      window_pos: windowPos,
      window_size: windowSize,
      is_maximized: isMaximized,
      view_mode: viewMode,
      sidebar_width: sidebarWidth,
      sidebar_headline_only: sidebarHeadlineOnly,
      show_sidebar_meta: showSidebarMeta,
      list_filter: listFilter,
      show_archive: showArchive,
      active_legend_id: dims.activeLegendId,
      legend_panel_collapsed: legendPanelCollapsed,
      global_type_filter: globalTypeFilter,
      legend_filters: legendFilters,
      filter_combine_mode: filterCombineMode,
      active_context: activeContext,
      minimized_categories: minimizedCategories,
      collapsed_ideas: collapsedIdeas,
      selected_category_ids: [...selectedCategoryIds],
      show_meta_list: showMetaList,
      docked_categories: dockedCategories,
      category_positions: Object.fromEntries(
        Object.entries(categories).map(([id, c]) => [id, { x: c.x, y: c.y, width: c.width, height: c.height, z_index: c.z_index }])
      ),
    };
    if (contextViewRef.current?.getFormationState) {
      const ctxState = contextViewRef.current.getFormationState();
      state.context_sidebar_mode = ctxState.sidebar_mode;
      state.minimized_contexts = ctxState.minimized_contexts;
      state.context_positions = ctxState.context_positions;
    }
    return state;
  }, [windowPos, windowSize, isMaximized, viewMode, sidebarWidth, sidebarHeadlineOnly,
      showSidebarMeta, listFilter, showArchive, dims.activeLegendId, legendPanelCollapsed,
      globalTypeFilter, legendFilters, filterCombineMode, activeContext,
      minimizedCategories, collapsedIdeas, selectedCategoryIds,
      showMetaList, dockedCategories, categories]);

  /** Apply a formation state object — restores all visual settings. */
  const applyFormationState = useCallback(async (state) => {
    if (!state) return;

    if (state.window_pos) setWindowPos(state.window_pos);
    if (state.window_size) setWindowSize(state.window_size);
    if (state.is_maximized !== undefined) setIsMaximized(state.is_maximized);
    if (state.view_mode) setViewMode(state.view_mode);
    if (state.sidebar_width) setSidebarWidth(state.sidebar_width);
    if (state.sidebar_headline_only !== undefined) setSidebarHeadlineOnly(state.sidebar_headline_only);
    if (state.show_sidebar_meta !== undefined) setShowSidebarMeta(state.show_sidebar_meta);
    if (state.list_filter !== undefined) setListFilter(state.list_filter);
    if (state.show_archive !== undefined) setShowArchive(state.show_archive);
    if (state.active_legend_id !== undefined) dims.setActiveLegendId(state.active_legend_id);
    if (state.legend_panel_collapsed !== undefined) setLegendPanelCollapsed(state.legend_panel_collapsed);
    if (state.global_type_filter) setGlobalTypeFilter(state.global_type_filter);
    if (state.legend_filters) setLegendFilters(state.legend_filters);
    if (state.filter_combine_mode) setFilterCombineMode(state.filter_combine_mode);
    if (state.active_context !== undefined) setActiveContext(state.active_context);
    if (state.minimized_categories) setMinimizedCategories(state.minimized_categories);
    if (state.collapsed_ideas) setCollapsedIdeas(state.collapsed_ideas);
    if (state.selected_category_id !== undefined) setSelectedCategoryIds(new Set(state.selected_category_id ? [state.selected_category_id] : []));
    if (state.selected_category_ids) setSelectedCategoryIds(new Set(state.selected_category_ids));
    if (state.show_meta_list !== undefined) setShowMetaList(state.show_meta_list);
    if (state.docked_categories) setDockedCategories(state.docked_categories);

    // Restore category canvas positions via API
    if (state.category_positions) {
      for (const [catId, pos] of Object.entries(state.category_positions)) {
        if (categories[catId]) {
          setPositionCategory(parseInt(catId), { x: pos.x, y: pos.y });
          setAreaCategory(parseInt(catId), pos.width, pos.height);
        }
      }
      setCategories(prev => {
        const next = { ...prev };
        for (const [catId, pos] of Object.entries(state.category_positions)) {
          if (next[catId]) {
            next[catId] = { ...next[catId], ...pos };
          }
        }
        return next;
      });
    }

    // Restore context view state
    if (contextViewRef.current?.applyFormationState) {
      contextViewRef.current.applyFormationState({
        sidebar_mode: state.context_sidebar_mode,
        minimized_contexts: state.minimized_contexts,
      });
    }

    // Restore context canvas positions via API
    if (state.context_positions) {
      for (const [ctxId, pos] of Object.entries(state.context_positions)) {
        setContextPositionApi(ctxId, pos.x, pos.y);
        setContextAreaApi(ctxId, pos.width, pos.height);
      }
    }

    playSound('ideaOpen');
  }, [categories, dims]);

  const save_formation = useCallback(async (name) => {
    const state = collectFormationState();
    try {
      await saveFormationApi(name, state);
      setFormationName("");
      fetch_formations();
      playSound('ideaCategoryCreate');
    } catch (err) { console.error("Save formation failed", err); }
  }, [collectFormationState, fetch_formations]);

  const update_formation_state = useCallback(async (formationId) => {
    const state = collectFormationState();
    try {
      await updateFormationStateApi(formationId, state);
      playSound('ideaCategoryCreate');
    } catch (err) { console.error("Update formation failed", err); }
  }, [collectFormationState]);

  const rename_formation = useCallback(async (formationId, name) => {
    try {
      await renameFormationApi(formationId, name);
      fetch_formations();
    } catch (err) { console.error("Rename formation failed", err); }
  }, [fetch_formations]);

  const load_formation = useCallback(async (formationId) => {
    try {
      const data = await loadFormationApi(formationId);
      await applyFormationState(data.state);
    } catch (err) { console.error("Load formation failed", err); }
  }, [applyFormationState]);

  const delete_formation = useCallback(async (formationId) => {
    try {
      await deleteFormationApi(formationId);
      fetch_formations();
      playSound('ideaDelete');
    } catch (err) { console.error("Delete formation failed", err); }
  }, [fetch_formations]);

  const toggle_default_formation = useCallback(async (formationId) => {
    try {
      const data = await toggleDefaultFormationApi(formationId);
      setFormations(prev => prev.map(f => ({ ...f, is_default: f.id === formationId ? data.is_default : false })));
    } catch (err) { console.error("Toggle default formation failed", err); }
  }, []);

  // Auto-load default formation on first mount
  const defaultFormationLoaded = useRef(false);
  useEffect(() => {
    if (defaultFormationLoaded.current) return;
    defaultFormationLoaded.current = true;
    (async () => {
      try {
        const data = await loadDefaultFormationApi();
        if (data?.formation?.state) {
          await applyFormationState(data.formation.state);
        }
      } catch (err) { console.error("Load default formation failed", err); }
    })();
  }, []);

  return {
    formations, setFormations,
    showFormationPanel, setShowFormationPanel,
    formationName, setFormationName,
    editingFormationId, setEditingFormationId,
    editingFormationName, setEditingFormationName,

    fetch_formations,
    collectFormationState,
    applyFormationState,
    save_formation,
    update_formation_state,
    rename_formation,
    load_formation,
    delete_formation,
    toggle_default_formation,
  };
}
