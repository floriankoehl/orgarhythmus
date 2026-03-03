import { useState, useCallback, useEffect, useRef } from "react";
import { playSound } from "../../../assets/sound_registry";
import {
  fetchTsViewsApi,
  createTsViewApi,
  getTsViewApi,
  updateTsViewApi,
  deleteTsViewApi,
  toggleDefaultTsViewApi,
  getDefaultTsViewApi,
} from "../api/tsViewApi";

/**
 * Manages saved "views" (formations) for the Task Structure page.
 *
 * A view stores the complete visual layout: team positions, collapsed state,
 * docked state, view mode, sidebar width, window position/size, etc.
 *
 * Persisted via API (TaskStructureView model).
 * On first open, loads the default view for the project (if any).
 */
export default function useTaskViews({ projectId, deps }) {
  const {
    // read
    windowPos, windowSize, isMaximized, viewMode, teamViewOverrides,
    sidebarWidth, legendPanelCollapsed, groupBy,
    collapsedTeamIds, teamPositions,
    leftCollapsed, rightCollapsed,
    // write
    setWindowPos, setWindowSize, setIsMaximized, setViewMode,
    setTeamViewOverrides, setSidebarWidth, setLegendPanelCollapsed,
    setGroupBy, setCollapsedTeamIds, setTeamPositions,
    setLeftCollapsed, setRightCollapsed,
  } = deps || {};

  const [views, setViews] = useState([]);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewName, setViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState(null);
  const [editingViewName, setEditingViewName] = useState("");

  // ── Fetch views for current project ──
  const fetchViews = useCallback(async () => {
    if (!projectId) { setViews([]); return; }
    try {
      const list = await fetchTsViewsApi(projectId);
      setViews(list);
    } catch (err) {
      console.error("Fetch TS views failed", err);
      setViews([]);
    }
  }, [projectId]);

  // Fetch on mount / project change
  useEffect(() => { fetchViews(); }, [fetchViews]);

  // ── Collect current state ──
  const collectViewState = useCallback(() => {
    return {
      version: 1,
      window_pos: windowPos,
      window_size: windowSize,
      is_maximized: isMaximized,
      view_mode: viewMode,
      team_view_overrides: teamViewOverrides || {},
      sidebar_width: sidebarWidth,
      legend_panel_collapsed: legendPanelCollapsed,
      group_by: groupBy,
      collapsed_team_ids: collapsedTeamIds ? [...collapsedTeamIds] : [],
      team_positions: teamPositions || {},
      left_collapsed: !!leftCollapsed,
      right_collapsed: !!rightCollapsed,
    };
  }, [
    windowPos, windowSize, isMaximized, viewMode, teamViewOverrides,
    sidebarWidth, legendPanelCollapsed, groupBy,
    collapsedTeamIds, teamPositions, leftCollapsed, rightCollapsed,
  ]);

  // ── Apply a saved state ──
  const applyViewState = useCallback((state) => {
    if (!state) return;
    if (state.window_pos && setWindowPos) setWindowPos(state.window_pos);
    if (state.window_size && setWindowSize) setWindowSize(state.window_size);
    if (state.is_maximized !== undefined && setIsMaximized) setIsMaximized(state.is_maximized);
    if (state.view_mode && setViewMode) setViewMode(state.view_mode);
    if (state.team_view_overrides && setTeamViewOverrides) setTeamViewOverrides(state.team_view_overrides);
    if (state.sidebar_width && setSidebarWidth) setSidebarWidth(state.sidebar_width);
    if (state.legend_panel_collapsed !== undefined && setLegendPanelCollapsed) setLegendPanelCollapsed(state.legend_panel_collapsed);
    if (state.group_by && setGroupBy) setGroupBy(state.group_by);
    if (state.collapsed_team_ids && setCollapsedTeamIds) setCollapsedTeamIds(new Set(state.collapsed_team_ids));
    if (state.team_positions && setTeamPositions) setTeamPositions(state.team_positions);
    if (state.left_collapsed !== undefined && setLeftCollapsed) setLeftCollapsed(state.left_collapsed);
    if (state.right_collapsed !== undefined && setRightCollapsed) setRightCollapsed(state.right_collapsed);
    playSound("ideaOpen");
  }, [
    setWindowPos, setWindowSize, setIsMaximized, setViewMode,
    setTeamViewOverrides, setSidebarWidth, setLegendPanelCollapsed,
    setGroupBy, setCollapsedTeamIds, setTeamPositions,
    setLeftCollapsed, setRightCollapsed,
  ]);

  // ── Save new view ──
  const saveView = useCallback(async (name) => {
    if (!projectId) return;
    const state = collectViewState();
    try {
      await createTsViewApi(projectId, name || "Unnamed View", state);
      setViewName("");
      fetchViews();
      playSound("ideaCategoryCreate");
    } catch (err) { console.error("Save TS view failed", err); }
  }, [projectId, collectViewState, fetchViews]);

  // ── Update existing view state ──
  const updateViewState = useCallback(async (viewId) => {
    const state = collectViewState();
    try {
      await updateTsViewApi(viewId, { state });
      playSound("ideaCategoryCreate");
    } catch (err) { console.error("Update TS view failed", err); }
  }, [collectViewState]);

  // ── Rename view ──
  const renameView = useCallback(async (viewId, name) => {
    try {
      await updateTsViewApi(viewId, { name });
      fetchViews();
    } catch (err) { console.error("Rename TS view failed", err); }
  }, [fetchViews]);

  // ── Load a view ──
  const loadView = useCallback(async (viewId) => {
    try {
      const data = await getTsViewApi(viewId);
      if (data?.state) applyViewState(data.state);
    } catch (err) { console.error("Load TS view failed", err); }
  }, [applyViewState]);

  // ── Delete a view ──
  const deleteView = useCallback(async (viewId) => {
    try {
      await deleteTsViewApi(viewId);
      fetchViews();
      playSound("ideaDelete");
    } catch (err) { console.error("Delete TS view failed", err); }
  }, [fetchViews]);

  // ── Toggle default ──
  const toggleDefault = useCallback(async (viewId) => {
    try {
      const data = await toggleDefaultTsViewApi(viewId);
      setViews((prev) =>
        prev.map((v) => ({
          ...v,
          is_default: v.id === viewId ? data.is_default : false,
        }))
      );
    } catch (err) { console.error("Toggle default TS view failed", err); }
  }, []);

  // ── Load default view on first mount ──
  const defaultLoaded = useRef(false);
  const loadDefaultView = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await getDefaultTsViewApi(projectId);
      if (data?.view?.state) {
        applyViewState(data.view.state);
      }
    } catch (err) { /* no default — that's fine */ }
  }, [projectId, applyViewState]);

  useEffect(() => {
    if (defaultLoaded.current) return;
    defaultLoaded.current = true;
    loadDefaultView();
  }, [loadDefaultView]);

  return {
    views, setViews,
    showViewPanel, setShowViewPanel,
    viewName, setViewName,
    editingViewId, setEditingViewId,
    editingViewName, setEditingViewName,

    fetchViews,
    collectViewState,
    applyViewState,
    saveView,
    updateViewState,
    renameView,
    loadView,
    deleteView,
    toggleDefault,
    loadDefaultView,
    groupBy, setGroupBy: deps?.setGroupBy,
  };
}
