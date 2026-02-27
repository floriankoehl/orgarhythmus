import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { Lightbulb, Minus, Maximize2, Minimize2, Copy, List, X, Settings, Layers, Save, FolderOpen, Trash2, Pencil, Check, Palette, ChevronDown, Star, Paintbrush, RotateCcw, ArrowDownUp, BookOpenText, Type, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { BASE_URL } from "../../config/api";
import { createTaskForProject, createTeamForProject, fetchTeamsForProject, fetch_all_projects } from "../../api/org_API";
import { add_milestone, fetch_project_tasks, delete_task, delete_team, delete_milestone } from "../../api/dependencies_api";
import { playSound } from "../../assets/sound_registry";
import { useLegends } from "./useLegends";
import { renderLegendTypeIcon } from "./legendTypeIcons";
import IdeaBinConfirmModal from "./IdeaBinConfirmModal";
import CollectConflictModal from "./CollectConflictModal";
import IdeaBinMergeModal from "./IdeaBinMergeModal";
import useIdeaBinWindow from "./useIdeaBinWindow";
import IdeaBinTransformModal from "./IdeaBinTransformModal";
import IdeaBinReformCategoryModal from "./IdeaBinReformCategoryModal";
import IdeaBinCategoryExportModal from "./IdeaBinCategoryExportModal";
import IdeaBinCategoryImportModal from "./IdeaBinCategoryImportModal";
import IdeaBinInsertIdeasModal from "./IdeaBinInsertIdeasModal";
import IdeaBinLegendPanel from "./IdeaBinLegendPanel";
import IdeaBinDragGhosts from "./IdeaBinDragGhosts";
import IdeaBinIdeaCard from "./IdeaBinIdeaCard";
import IdeaBinCategoryCanvas from "./IdeaBinCategoryCanvas";
import IdeaBinContextView from "./IdeaBinContextView";
import IdeaBinToolbar from "./IdeaBinToolbar";
import { useAuth } from "../../auth/AuthContext";

// Extracted hooks
import useIdeaBinCategories from "./hooks/useIdeaBinCategories";
import useIdeaBinIdeas from "./hooks/useIdeaBinIdeas";
import useIdeaBinFormations from "./hooks/useIdeaBinFormations";
import useIdeaBinDrag from "./hooks/useIdeaBinDrag";
import useIdeaBinKeyboard from "./hooks/useIdeaBinKeyboard";

// Extracted API helpers
import { authFetch, API } from "./api/authFetch";
import { fetchContextsApi, saveContextFilterStateApi, setContextColorApi } from "./api/contextApi";
import { mergeIdeasApi, batchSetArchiveApi } from "./api/ideaApi";
import { exportIdeabinApi, importIdeabinApi, exportCategoryApi, importCategoryApi, insertIdeasIntoCategoryApi } from "./api/exportApi";

// ───────────────────── Constants ─────────────────────
const CATEGORY_THRESHOLD = 560; // show categories when wider than this
const MIN_SIDEBAR_W = 180;
const COLLAPSED_STRIP_W = 28;
const MIN_FORM_H = 80;
const MAX_FORM_H = 600;
const DEFAULT_FORM_H = 180;

// ═══════════════════════════════════════════════════════════
// ═══════════════════  IDEA BIN COMPONENT  ═════════════════
// ═══════════════════════════════════════════════════════════
export default function IdeaBin() {
  const { projectId } = useParams();   // optional — only present inside a project
  const { user } = useAuth();
  const currentUserId = user?.id;

  // ───── Window state (extracted) ─────
  const headlineInputRef = useRef(null);
  const {
    isOpen, setIsOpen,
    windowPos, setWindowPos, windowSize, setWindowSize,
    iconPos,
    isMaximized, setIsMaximized,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag, handleWindowResize, handleEdgeResize,
  } = useIdeaBinWindow(headlineInputRef);

  // ───── Selected idea(s) ─────
  const [selectedIdeaIds, setSelectedIdeaIds] = useState(new Set());
  const lastSelectedIdeaRef = useRef(null); // for shift-click range selection

  // ───── Selected category/ies for paste ─────
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set());

  // ───── Confirm modal ─────
  const [confirmModal, setConfirmModal] = useState(null);

  // ───── Merge ideas ─────
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [autoMerge, setAutoMerge] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ideabin_auto_merge") || "false"); } catch { return false; }
  });

  // ───── Legends (context-scoped) — state only, hook call is below after activeContext ─────
  const [legendPanelCollapsed, setLegendPanelCollapsed] = useState(true);
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendName, setNewLegendName] = useState("");
  const [editingLegendId, setEditingLegendId] = useState(null);
  const [editingLegendNameLocal, setEditingLegendNameLocal] = useState("");
  const [showCreateType, setShowCreateType] = useState(false);
  const [newTypeColor, setNewTypeColor] = useState("#6366f1");
  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [globalTypeFilter, setGlobalTypeFilter] = useState([]);
  // ───── Advanced legend filters (multi-legend, stackable, AND/OR, include/exclude) ─────
  // Array of {legendId, typeIds: [...], mode: "include"|"exclude"}
  const [legendFilters, setLegendFilters] = useState([]);
  const [filterCombineMode, setFilterCombineMode] = useState("and"); // "and" | "or"
  const [filterPresets, setFilterPresets] = useState([]); // [{name, legend_filters, filter_combine_mode}, ...]
  // ───── Stacked filter groups (each preset stacked is evaluated as its own group) ─────
  const [stackedFilters, setStackedFilters] = useState([]); // [{name, rules: [...], combineMode: "and"|"or"}, ...]
  const [stackCombineMode, setStackCombineMode] = useState("or"); // how groups combine: "or" | "and"

  // ───── View mode ─────
  const [viewMode, setViewMode] = useState("ideas"); // "ideas" | "contexts"

  // ───── Active context (entered context mode) ─────
  const [activeContext, setActiveContext] = useState(null); // null or {id, name, color, category_ids, legend_ids}

  // ───── Legends (context-scoped) ─────
  const dims = useLegends(activeContext?.id);
  const [showContextColorPicker, setShowContextColorPicker] = useState(false);
  const [contextsList, setContextsList] = useState([]); // [{id, name, color, category_ids, legend_ids}, ...]
  const [showContextSelector, setShowContextSelector] = useState(false);

  // ───── Headline mode ─────
  const [headlineModeCategoryId, setHeadlineModeCategoryId] = useState(null); // catKey or null
  const [headlineModeIdeaId, setHeadlineModeIdeaId] = useState(null); // placement id or null

  // ───── Create-form title mode ─────
  const [createFormTitleMode, setCreateFormTitleMode] = useState(false);
  const [createFormOrderMode, setCreateFormOrderMode] = useState("define"); // "define" | "description"

  // ───── Edit-form title mode ─────
  const [editFormTitleMode, setEditFormTitleMode] = useState(false);
  const [editFormOrderMode, setEditFormOrderMode] = useState("define"); // "define" | "description"

  // ───── Sidebar title mode (for H key on sidebar ideas) ─────
  const [sidebarDraftTitle, setSidebarDraftTitle] = useState("");
  const [sidebarTitleOrderMode, setSidebarTitleOrderMode] = useState("define");
  const sidebarSaveTimerRef = useRef(null);

  // ───── Paint mode (legend type brush) ─────
  // null or { typeId, color, icon, name }  – when set, clicking an idea paints it with this type
  const [paintType, setPaintType] = useState(null);

  // ───── List view filter ─────
  const [listFilter, setListFilter] = useState("unassigned"); // "all" | "unassigned" | category id
  const [showListFilterDropdown, setShowListFilterDropdown] = useState(false);
  const [showSidebarMeta, setShowSidebarMeta] = useState(false);   // show meta info in sidebar
  const [sidebarHeadlineOnly, setSidebarHeadlineOnly] = useState(false); // collapse all in sidebar
  const [showListSettings, setShowListSettings] = useState(false); // settings dropdown
  const [formHeight, setFormHeight] = useState(DEFAULT_FORM_H); // vertical splitter height

  // ───── Sidebar resize ─────
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // ───── Archive ─────
  const [showArchive, setShowArchive] = useState(false);

  // ───── Draw-to-create category mode ─────
  const [drawCategoryMode, setDrawCategoryMode] = useState(false);

  // ───── Order numbers (lifted from canvas) ─────
  const [showOrderNumbers, setShowOrderNumbers] = useState(new Set());

  // ───── Sidebar marquee selection ─────
  const [sidebarMarquee, setSidebarMarquee] = useState(null); // { x1, y1, x2, y2 } in client coords
  const sidebarMarqueeRef = useRef(null);

  // ───── Sidebar focus tracking (for Ctrl+A context) ─────
  const [sidebarFocused, setSidebarFocused] = useState(false);

  // ───── Transform modal ─────
  const [transformModal, setTransformModal] = useState(null); // { idea, step: 'choose' | 'task' | 'milestone' }
  const [transformName, setTransformName] = useState("");
  const [transformTeamId, setTransformTeamId] = useState(null);
  const [transformTaskId, setTransformTaskId] = useState(null);
  const [transformTaskSearch, setTransformTaskSearch] = useState("");
  const [projectTeams, setProjectTeams] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [transformLoading, setTransformLoading] = useState(false);

  // ───── Reform category → team modal ─────
  const [reformCategoryModal, setReformCategoryModal] = useState(null); // { categories: [{id,name}], step, autoProjectId, selectedProjectId, projects }
  const [reformLoading, setReformLoading] = useState(false);

  // ───── Category export / import modals ─────
  const [categoryExportJson, setCategoryExportJson] = useState(null); // JSON object or null
  const [showCategoryImport, setShowCategoryImport] = useState(false);
  const [insertIdeasTarget, setInsertIdeasTarget] = useState(null); // { id, name } or null

  // Refs
  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});
  const contextViewRef = useRef(null);

  // Create-form title-mode drag refs
  const cfDragItemRef = useRef(null);   // { index }
  const cfDragOverRef = useRef(null);   // { index }
  const [cfDropIdx, setCfDropIdx] = useState(null); // drop indicator position

  // Edit form ref for click-outside auto-save
  const editFormRef = useRef(null);

  const showCategories = windowSize.w >= CATEGORY_THRESHOLD;
  // Dynamic max sidebar width: leave at least COLLAPSED_STRIP_W + 6 (resize handle) for the right side when not collapsed
  const maxSidebarW = rightCollapsed
    ? windowSize.w - COLLAPSED_STRIP_W
    : windowSize.w - COLLAPSED_STRIP_W - 6;

  // ═══════════════════════════════════════════════════════
  // ═══════════  HOOKS  ═══════════════════════════════════
  // ═══════════════════════════════════════════════════════

  // ── Ideas hook ──
  const {
    ideas, setIdeas,
    unassignedOrder, setUnassignedOrder,
    categoryOrders, setCategoryOrders,
    ideaName, setIdeaName,
    newIdeaDescription, setNewIdeaDescription,
    editingIdeaId, setEditingIdeaId,
    editingIdeaTitle, setEditingIdeaTitle,
    editingIdeaDescription, setEditingIdeaDescription,
    collapsedIdeas, setCollapsedIdeas,
    ideaSettingsOpen, setIdeaSettingsOpen,
    wigglingIdeaId, setWigglingIdeaId,
    copiedIdeaId, setCopiedIdeaId,
    showMetaList, setShowMetaList,
    metaIdeas,
    metaIdeaList,
    fetch_all_ideas,
    create_idea,
    delete_idea,
    update_idea_title_api,
    safe_order,
    assign_idea_to_category,
    copy_idea,
    paste_idea,
    spinoff_idea,
    delete_meta_idea,
    remove_idea_from_category,
    remove_all_idea_categories,
    remove_all_idea_legend_types,
    remove_idea_legend_type,
    assign_idea_legend_type,
    batch_assign_idea_legend_type,
    batchRemoveLegendType,
    toggle_upvote,
    fetch_comments,
    add_comment,
    delete_comment,
    fetch_meta_ideas,
    toggle_archive_idea,
    undo,
    redo,
    historyCount,
    pushMove,
    contextIdeaOrders,
  } = useIdeaBinIdeas({ selectedCategoryIds, activeContext });

  // ── Categories hook ──
  const {
    categories, setCategories,
    displayCategoryForm, setDisplayCategoryForm,
    newCategoryName, setNewCategoryName,
    newCategoryPublic, setNewCategoryPublic,
    categoryContainerRef,
    editingCategoryId, setEditingCategoryId,
    editingCategoryName, setEditingCategoryName,
    categorySettingsOpen, setCategorySettingsOpen,
    dockedCategories, setDockedCategories,
    minimizedCategories, setMinimizedCategories,
    mergeCategoryTarget, setMergeCategoryTarget,
    fetch_categories,
    create_category_api,
    create_category_at,
    set_position_category,
    set_area_category,
    bring_to_front_category,
    delete_category,
    merge_categories_api,
    rename_category_api,
    toggle_archive_category,
    toggle_public_category,
    drop_adopted_category,
    createCategoryFromFilter: createCategoryFromFilterRaw,
    handleCategoryDrag: handleCategoryDragRaw,
    handleCategoryResize,
    refetchCategoryByFilter,
    toggleLiveCategory,
    requestToggleLive,
    liveCategoryIds,
    setCategoryFilterConfig,
    crConflictData,
    setCrConflictData,
    resolveCRConflicts,
    detectCRConflicts,
    crConflictsByCat,
    runConflictScan,
  } = useIdeaBinCategories({ activeContext, setActiveContext, fetchAllIdeas: fetch_all_ideas, selectedCategoryIds });

  // ── Drag hook ──
  const {
    dragging, hoverUnassigned,
    dragSource, prevIndex, hoverIndex,
    hoverCategory,
    externalGhost, draggingType, hoverIdeaForType,
    handleIdeaDrag, handleTypeDrag,
  } = useIdeaBinDrag({
    ideas, unassignedOrder, setUnassignedOrder, categoryOrders, setCategoryOrders,
    safe_order, fetch_all_ideas, delete_idea,
    categories, categoryContainerRef,
    windowRef, IdeaListRef, categoryRefs, ideaRefs,
    dims,
    selectedIdeaIds,
    assign_idea_legend_type,
    projectId, setConfirmModal,
  });

  // ── Keyboard hook ──
  const { isFocused, refactorMode, setRefactorMode } = useIdeaBinKeyboard({
    isOpen, windowRef,
    copiedIdeaId, selectedCategoryIds, setSelectedCategoryIds, paste_idea,
    selectedIdeaIds, setSelectedIdeaIds, ideas, categories,
    headlineModeCategoryId, setHeadlineModeCategoryId,
    headlineModeIdeaId, setHeadlineModeIdeaId,
    delete_idea, delete_category, remove_idea_from_category, toggle_archive_idea,
    setConfirmModal,
    paintType, setPaintType,
    // Ctrl+A / Ctrl+Shift+A deps
    categoryOrders, unassignedOrder, metaIdeaList,
    listFilter, viewMode, dockedCategories, activeContext,
    legendFilters, filterCombineMode, stackedFilters, stackCombineMode,
    globalTypeFilter, dims,
    sidebarFocused,
    undo, redo,
  });

  // Ref so the formations hook can call enterContext (defined below)
  const enterContextRef = useRef(null);

  // ── Formations hook ──
  const {
    formations,
    showFormationPanel, setShowFormationPanel,
    formationName, setFormationName,
    editingFormationId, setEditingFormationId,
    editingFormationName, setEditingFormationName,
    fetch_formations,
    save_formation,
    update_formation_state,
    rename_formation,
    load_formation,
    delete_formation,
    toggle_default_formation,
    toggle_default_context,
  } = useIdeaBinFormations({
    windowPos, windowSize, isMaximized, viewMode, sidebarWidth,
    sidebarHeadlineOnly, showSidebarMeta, listFilter, showArchive,
    dims, legendPanelCollapsed, globalTypeFilter, legendFilters,
    filterCombineMode, activeContext, minimizedCategories,
    collapsedIdeas, selectedCategoryIds, showMetaList, dockedCategories,
    categories, contextViewRef, formHeight,
    setWindowPos, setWindowSize, setIsMaximized, setViewMode,
    setSidebarWidth, setSidebarHeadlineOnly, setShowSidebarMeta,
    setListFilter, setShowArchive, setLegendPanelCollapsed,
    setGlobalTypeFilter, setLegendFilters, setFilterCombineMode,
    setActiveContext, setMinimizedCategories, setCollapsedIdeas,
    setSelectedCategoryIds, setShowMetaList, setDockedCategories,
    setCategories, setFormHeight,
    enterContext: enterContextRef,
  });

  // ═══════════════════════════════════════════════════════
  // ═══════════  WRAPPER CALLBACKS  ═══════════════════════
  // ═══════════════════════════════════════════════════════

  // Wrap createCategoryFromFilter to inject runtime deps
  const createCategoryFromFilter = useCallback((name) => {
    // Capture the current filter state to store on the category
    const filterState = {
      legend_filters: JSON.parse(JSON.stringify(legendFilters)),
      filter_combine_mode: filterCombineMode,
      global_type_filter: [...globalTypeFilter],
      active_legend_id: dims.activeLegendId || null,
    };
    return createCategoryFromFilterRaw(name, passesAllFilters, ideas, filterState);
  }, [createCategoryFromFilterRaw, ideas, legendFilters, filterCombineMode, globalTypeFilter, dims.activeLegendId]);

  // Wrap handleCategoryDrag to inject runtime deps
  const handleCategoryDrag = useCallback((e, catKey) => {
    return handleCategoryDragRaw(e, catKey, { refactorMode, setConfirmModal });
  }, [handleCategoryDragRaw, refactorMode, setConfirmModal]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  CONTEXT LOGIC  ═══════════════════════════
  // ═══════════════════════════════════════════════════════

  // ── Fetch contexts list for selector dropdown ──
  const fetch_contexts_for_selector = async () => {
    try {
      const list = await fetchContextsApi();
      setContextsList(list);
    } catch (e) { console.error("Failed to fetch contexts list", e); }
  };

  // ── Scroll canvas to show all context categories ──
  const scrollCanvasToContextCategories = useCallback((categoryIds) => {
    const container = categoryContainerRef.current;
    if (!container || !categoryIds?.length) return;

    // Compute bounding box of all context categories
    let minX = Infinity, minY = Infinity;
    for (const catId of categoryIds) {
      const cat = categories[catId];
      if (!cat || cat.archived) continue;
      if (cat.x < minX) minX = cat.x;
      if (cat.y < minY) minY = cat.y;
    }

    if (minX === Infinity) return; // no visible categories

    // Scroll so the top-left of the bounding box is near the top-left of the container,
    // with a small margin
    container.scrollLeft = Math.max(0, minX - 12);
    container.scrollTop = Math.max(0, minY - 12);
  }, [categories, categoryContainerRef]);

  // ── Enter / exit context mode ──
  const saveContextFilterState = async (contextId) => {
    try {
      await saveContextFilterStateApi(contextId, {
        legend_filters: legendFilters,
        filter_combine_mode: filterCombineMode,
        stacked_filters: stackedFilters || [],
        stack_combine_mode: stackCombineMode || "or",
        global_type_filter: globalTypeFilter || [],
        active_legend_id: dims.activeLegendId || null,
        legend_panel_collapsed: legendPanelCollapsed,
        filter_presets: filterPresets || [],
      });
    } catch (e) { console.error("Failed to save context filter state", e); }
  };
  const enterContext = async (ctx) => {
    // ctx = {id, name, color, category_ids, legend_ids, idea_ids, filter_state}
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
      if (ctx.filter_state.active_legend_id !== undefined) {
        dims.setActiveLegendId(ctx.filter_state.active_legend_id);
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
  enterContextRef.current = enterContext;

  const exitContext = () => {
    // Save current context's filter state before exiting
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
  const updateActiveContextColor = async (color) => {
    if (!activeContext) return;
    setActiveContext(prev => ({ ...prev, color }));
    try {
      await setContextColorApi(activeContext.id, color);
    } catch (err) { console.error("IdeaBin: set context color failed", err); }
  };

  // ── Sidebar marquee selection handler ──
  const handleSidebarMarqueeStart = useCallback((e) => {
    // Only start on empty space (not on idea cards or buttons)
    if (e.target.closest('[data-idea-item]') || e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    setSidebarMarquee({ x1: startX, y1: startY, x2: startX, y2: startY });
    sidebarMarqueeRef.current = { ctrlKey: e.ctrlKey || e.metaKey };

    const onMove = (moveE) => {
      setSidebarMarquee(prev => prev ? { ...prev, x2: moveE.clientX, y2: moveE.clientY } : null);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSidebarMarquee(prev => {
        if (!prev || !IdeaListRef.current) return null;
        const mx1 = Math.min(prev.x1, prev.x2);
        const my1 = Math.min(prev.y1, prev.y2);
        const mx2 = Math.max(prev.x1, prev.x2);
        const my2 = Math.max(prev.y1, prev.y2);
        const area = (mx2 - mx1) * (my2 - my1);
        if (area < 100) {
          // Tiny drag = click on empty space → deselect all & exit paint mode
          setSelectedIdeaIds(new Set());
          if (paintType) setPaintType(null);
          return null;
        }
        const ideaElements = IdeaListRef.current.querySelectorAll('[data-idea-id]');
        const hitIds = [];
        ideaElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > mx1 && rect.left < mx2 && rect.bottom > my1 && rect.top < my2) {
            const id = el.getAttribute('data-idea-id');
            hitIds.push(Number(id) || id);
          }
        });
        if (hitIds.length > 0) {
          if (paintType && assign_idea_legend_type) {
            for (const id of hitIds) {
              assign_idea_legend_type(id, paintType.typeId, dims);
            }
          } else if (sidebarMarqueeRef.current?.ctrlKey) {
            setSelectedIdeaIds(old => {
              const next = new Set(old);
              hitIds.forEach(id => next.add(id));
              return next;
            });
          } else {
            setSelectedIdeaIds(new Set(hitIds));
          }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [paintType, assign_idea_legend_type, dims, setSelectedIdeaIds, setPaintType]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  EXPORT BACKUP  ═══════════════════════════
  // ═══════════════════════════════════════════════════════

  const handleExportBackup = useCallback(async () => {
    try {
      const data = await exportIdeabinApi(activeContext?.id ?? null);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `ideabin_backup_${ts}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    }
  }, [activeContext?.id]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  IMPORT BACKUP  ═══════════════════════════
  // ═══════════════════════════════════════════════════════

  const handleImportBackup = useCallback(async (file) => {
    const label = activeContext ? `context "${activeContext.name}"` : "ALL IdeaBin data";
    if (!window.confirm(
      `This will replace ${label} with the contents of "${file.name}".\n\nThis cannot be undone. Continue?`
    )) return;

    try {
      const result = await importIdeabinApi(file, activeContext?.id ?? null);
      window.alert(result.message || "Import successful!");
      // Refresh everything
      fetch_categories();
      fetch_all_ideas();
      fetch_contexts_for_selector();
      fetch_formations();
    } catch (e) {
      console.error("Import failed", e);
      window.alert(`Import failed: ${e.message}`);
    }
  }, [activeContext?.id, activeContext?.name, fetch_categories, fetch_all_ideas]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  CATEGORY EXPORT / IMPORT  ════════════════
  // ═══════════════════════════════════════════════════════

  const handleExportCategory = useCallback(async (categoryId) => {
    try {
      const data = await exportCategoryApi(categoryId);
      setCategoryExportJson(data);
    } catch (e) {
      console.error("Category export failed", e);
      window.alert(`Export failed: ${e.message}`);
    }
  }, []);

  const handleImportCategory = useCallback(async (jsonData) => {
    try {
      const result = await importCategoryApi(jsonData, activeContext?.id ?? null);
      setShowCategoryImport(false);

      // Update activeContext.category_ids so the new categories are visible immediately
      const newIds = result.category_ids || (result.category_id ? [result.category_id] : []);
      if (activeContext && newIds.length > 0) {
        setActiveContext(prev => prev ? {
          ...prev,
          category_ids: [...(prev.category_ids || []), ...newIds],
        } : prev);
      }

      // Refresh categories & ideas
      await fetch_categories();
      await fetch_all_ideas();
      playSound?.("success");
    } catch (e) {
      throw e; // let the modal display the error
    }
  }, [activeContext, setActiveContext, fetch_categories, fetch_all_ideas]);

  const handleInsertIdeas = useCallback(async (jsonData) => {
    if (!insertIdeasTarget) return;
    try {
      await insertIdeasIntoCategoryApi(insertIdeasTarget.id, jsonData, activeContext?.id ?? null);
      setInsertIdeasTarget(null);
      await fetch_categories();
      await fetch_all_ideas();
      playSound?.("success");
    } catch (e) {
      throw e; // let the modal display the error
    }
  }, [insertIdeasTarget, activeContext, fetch_categories, fetch_all_ideas]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  EFFECTS  ═════════════════════════════════
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    if (isOpen) {
      fetch_categories();
      fetch_all_ideas();
      fetch_contexts_for_selector();
      fetch_formations();
    }
  }, [isOpen]);

  // ── When active context changes, scroll canvas to show all its categories ──
  useEffect(() => {
    if (!activeContext?.category_ids?.length) return;
    // Small delay to ensure React has rendered the filtered categories
    const timer = setTimeout(() => {
      scrollCanvasToContextCategories(activeContext.category_ids);
    }, 80);
    return () => clearTimeout(timer);
  }, [activeContext?.id]);

  // ── Live filter: periodically refetch categories that have live mode on ──
  useEffect(() => {
    if (liveCategoryIds.size === 0) return;
    const interval = setInterval(() => {
      for (const catKey of liveCategoryIds) {
        refetchCategoryByFilter(catKey, ideas);
      }
      // Re-scan for C&R conflicts every tick
      runConflictScan(ideas);
    }, 5000); // every 5 seconds
    return () => clearInterval(interval);
  }, [liveCategoryIds, ideas, refetchCategoryByFilter, runConflictScan]);

  // ── Refresh activeContext when switching back to ideas view ──
  // (picks up category/legend changes made in the Contexts view)
  useEffect(() => {
    if (viewMode === "ideas" && activeContext) {
      (async () => {
        try {
          const freshList = await fetchContextsApi();
          const freshCtx = freshList.find(c => c.id === activeContext.id);
          if (freshCtx) {
            setActiveContext(prev => ({
              ...prev,
              category_ids: freshCtx.category_ids,
              legend_ids: freshCtx.legend_ids,
            }));
          }
        } catch (e) { /* ignore */ }
      })();
    }
  }, [viewMode]);

  // ── Auto-save filter state (including presets) when anything changes inside a context ──
  const presetsLoadedRef = useRef(false);
  useEffect(() => {
    if (!activeContext) return;
    // Skip the very first render to avoid overwriting freshly-loaded state
    if (!presetsLoadedRef.current) { presetsLoadedRef.current = true; return; }
    const timer = setTimeout(() => {
      saveContextFilterState(activeContext.id);
    }, 600);
    return () => clearTimeout(timer);
  }, [legendFilters, filterCombineMode, stackedFilters, stackCombineMode, globalTypeFilter, dims.activeLegendId, legendPanelCollapsed, filterPresets]);

  // ── Sync sidebar draft title when headline mode changes ──
  useEffect(() => {
    if (headlineModeIdeaId) {
      const idea = ideas[headlineModeIdeaId];
      setSidebarDraftTitle(idea?.title || "");
    } else {
      setSidebarDraftTitle("");
    }
  }, [headlineModeIdeaId]); // intentionally only on id change

  // ── Auto-save on click-outside when editing an idea ──
  useEffect(() => {
    if (!editingIdeaId) return;
    const handler = (e) => {
      if (editFormRef.current && !editFormRef.current.contains(e.target)) {
        // Click was outside the edit form – auto-save & close
        update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
        setEditingIdeaId(null);
        setEditingIdeaTitle("");
        setEditingIdeaDescription("");
        setEditFormTitleMode(false);
      }
    };
    // Use mousedown so we capture before other click handlers
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingIdeaId, editingIdeaTitle, editingIdeaDescription, update_idea_title_api]);

  // ── Filter preset management ──
  const saveFilterPreset = (name) => {
    const preset = {
      name: name || `Filter ${new Date().toLocaleString()}`,
      legend_filters: JSON.parse(JSON.stringify(legendFilters)),
      filter_combine_mode: filterCombineMode,
      stacked_filters: JSON.parse(JSON.stringify(stackedFilters)),
      stack_combine_mode: stackCombineMode,
    };
    setFilterPresets(prev => [...prev, preset]);
  };
  const applyFilterPreset = (preset) => {
    setLegendFilters(JSON.parse(JSON.stringify(preset.legend_filters || [])));
    setFilterCombineMode(preset.filter_combine_mode || "and");
    setStackedFilters(JSON.parse(JSON.stringify(preset.stacked_filters || [])));
    setStackCombineMode(preset.stack_combine_mode || "or");
  };
  const stackFilterPreset = (preset) => {
    // Add preset as a separate filter group (not merged into the primary)
    // If the preset itself has stacked groups, add them all
    const newGroups = [];
    if (preset.legend_filters?.length > 0) {
      newGroups.push({
        name: preset.name || "Stacked",
        rules: JSON.parse(JSON.stringify(preset.legend_filters)),
        combineMode: preset.filter_combine_mode || "and",
      });
    }
    if (preset.stacked_filters?.length > 0) {
      for (const sg of preset.stacked_filters) {
        newGroups.push(JSON.parse(JSON.stringify(sg)));
      }
    }
    if (newGroups.length > 0) {
      setStackedFilters(prev => [...prev, ...newGroups]);
    }
  };
  const deleteFilterPreset = (index) => {
    setFilterPresets(prev => prev.filter((_, i) => i !== index));
  };
  const renameFilterPreset = (index, newName) => {
    setFilterPresets(prev => prev.map((p, i) => i === index ? { ...p, name: newName } : p));
  };

  // ── Merge ideas ──
  const handleAutoMergeChange = useCallback((val) => {
    setAutoMerge(val);
    try { localStorage.setItem("ideabin_auto_merge", JSON.stringify(val)); } catch {}
  }, []);

  const executeMerge = useCallback(async (targetIdeaId, sourceIdeaIds) => {
    try {
      // Capture state for undo before merging
      const targetIdea = Object.values(ideas).find(p => p.idea_id === targetIdeaId);
      const sourceIdeas = sourceIdeaIds.map(sid => {
        const src = Object.values(ideas).find(p => p.idea_id === sid);
        return src ? { ideaId: sid, title: src.title, description: src.description || "" } : null;
      }).filter(Boolean);
      pushMove({
        type: 'merge_ideas',
        targetIdeaId,
        targetOldTitle: targetIdea?.title || "",
        targetOldDescription: targetIdea?.description || "",
        sourceIdeas,
      });
      await mergeIdeasApi(targetIdeaId, sourceIdeaIds);
      setSelectedIdeaIds(new Set());
      setShowMergeModal(false);
      fetch_all_ideas();
    } catch (e) {
      console.error("Merge failed", e);
    }
  }, [fetch_all_ideas, ideas, pushMove]);

  const handleMergeClick = useCallback(() => {
    if (selectedIdeaIds.size < 2) return;

    // Gather unique meta-idea info for the selected placements
    const seen = new Set();
    const selectedIdeas = [];
    for (const pid of selectedIdeaIds) {
      const idea = ideas[pid];
      if (!idea || seen.has(idea.idea_id)) continue;
      seen.add(idea.idea_id);
      selectedIdeas.push({
        placement_id: pid,
        idea_id: idea.idea_id,
        title: idea.title,
        order_index: idea.order_index,
      });
    }
    if (selectedIdeas.length < 2) return;

    if (autoMerge) {
      // Auto-merge: higher order_index = target
      const target = selectedIdeas.reduce((best, cur) =>
        cur.order_index > best.order_index ? cur : best
      );
      const sourceIds = selectedIdeas
        .filter(i => i.idea_id !== target.idea_id)
        .map(i => i.idea_id);
      executeMerge(target.idea_id, sourceIds);
    } else {
      setShowMergeModal(selectedIdeas);
    }
  }, [selectedIdeaIds, ideas, autoMerge, executeMerge]);

  // Fetch teams & tasks when transform modal opens
  useEffect(() => {
    if (transformModal && projectId) {
      fetchTeamsForProject(projectId).then(data => {
        const teams = data?.teams || data || [];
        setProjectTeams(teams);
      }).catch(() => {});
      fetch_project_tasks(projectId).then(data => {
        const raw = data?.tasks || data || [];
        // API returns tasks as { id: taskObj } dict – convert to array
        const tasks = Array.isArray(raw) ? raw : Object.values(raw);
        setProjectTasks(tasks);
      }).catch(() => {});
    }
  }, [transformModal, projectId]);

  // ── Listen for dep-refactor-drop events (Dependencies → IdeaBin reverse transform) ──
  useEffect(() => {
    const handleRefactorDrop = (e) => {
      const { type, id, name, description, color, taskIds, milestones: milestonesPayload, taskId, taskName } = e.detail || {};
      if (!type || !id) return;

      if (type === "milestone") {
        const mName = name || "Milestone";
        const mDesc = description || "";
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">🏁 Refactor Milestone → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert milestone <span className="font-semibold">"{mName}"</span> into an idea.
                The milestone will be <span className="text-red-600 font-semibold">deleted</span> from the dependency view.
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idea_name: mName,
                  description: mDesc,
                }),
              });
              await delete_milestone(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor milestone failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      } else if (type === "task") {
        const tName = name || "Task";
        const tDesc = description || "";
        const mList = milestonesPayload || [];
        let ideaDesc = tDesc;
        if (mList.length > 0) {
          const msText = mList.map(m => `${m.name || "Milestone"}${m.description ? ": " + m.description : ""}`).join("\n\n");
          ideaDesc = ideaDesc ? `${ideaDesc}\n\nMilestones:\n${msText}` : `Milestones:\n${msText}`;
        }
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">📋 Refactor Task → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert task <span className="font-semibold">"{tName}"</span> into an idea.
                The task and its <span className="font-semibold">{mList.length} milestone{mList.length !== 1 ? "s" : ""}</span> will be <span className="text-red-600 font-semibold">deleted</span>.
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idea_name: tName,
                  description: ideaDesc,
                }),
              });
              await delete_task(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor task failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      } else if (type === "team") {
        const teamName = name || "Team";
        const tIds = taskIds || [];
        setConfirmModal({
          message: (
            <div>
              <p className="mb-1 text-sm font-medium">🏢 Refactor Team → Idea?</p>
              <p className="text-xs text-gray-600">
                Convert team <span className="font-semibold" style={{ color: color || "#94a3b8" }}>"{teamName}"</span> into an idea.
                The team will be <span className="text-red-600 font-semibold">deleted</span>.
                {tIds.length > 0 && <> Its <span className="font-semibold">{tIds.length} task{tIds.length !== 1 ? "s" : ""}</span> will become unassigned.</>}
              </p>
            </div>
          ),
          confirmLabel: "Convert to Idea",
          confirmColor: "bg-orange-500 hover:bg-orange-600",
          onConfirm: async () => {
            try {
              await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idea_name: teamName,
                  description: tIds.length > 0 ? `Team with ${tIds.length} task(s)` : "",
                }),
              });
              await delete_team(projectId, id);
              playSound('ideaRefactor');
              window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              fetch_all_ideas();
            } catch (err) {
              console.error("Refactor team failed:", err);
            }
            setConfirmModal(null);
          },
          onCancel: () => setConfirmModal(null),
        });
      }
    };
    window.addEventListener("dep-refactor-drop", handleRefactorDrop);
    return () => window.removeEventListener("dep-refactor-drop", handleRefactorDrop);
  }, [projectId]);

  // ── Transform handlers ──
  const openTransform = (idea) => {
    setTransformModal({ idea, step: 'choose' });
    setTransformName(idea.title.split(/\s+/).slice(0, 6).join(" "));
    setTransformTeamId(null);
    setTransformTaskId(null);
    setTransformTaskSearch("");
  };

  const closeTransform = () => {
    setTransformModal(null);
    setTransformName("");
    setTransformTeamId(null);
    setTransformTaskId(null);
    setTransformTaskSearch("");
    setTransformLoading(false);
  };

  const executeTransformToTask = async () => {
    if (!transformName.trim() || !transformTeamId) return;
    setTransformLoading(true);
    try {
      await createTaskForProject(projectId, {
        name: transformName.trim(),
        description: transformModal.idea.description || "",
        team_id: transformTeamId,
      });
      // Optionally delete the idea after transform
      await delete_idea(transformModal.idea.id);
      playSound('ideaTransform');
      closeTransform();
    } catch (err) {
      console.error("Transform to task failed:", err);
      setTransformLoading(false);
    }
  };

  const executeTransformToMilestone = async () => {
    if (!transformName.trim() || !transformTaskId) return;
    setTransformLoading(true);
    try {
      await add_milestone(projectId, transformTaskId, {
        name: transformName.trim(),
        description: transformModal.idea.description || "",
      });
      await delete_idea(transformModal.idea.id);
      playSound('ideaTransform');
      closeTransform();
    } catch (err) {
      console.error("Transform to milestone failed:", err);
      setTransformLoading(false);
    }
  };

  // ───── Reform category → team logic ─────
  // Accepts single (catKey, catData) or multi (when catKey is part of a multi-selection).
  const openReformCategory = async (catKey, catData) => {
    // Build the list of categories to reform
    const isInSelection = selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey));
    let catList;
    if (isInSelection && selectedCategoryIds.size > 1) {
      // Multi-category reform: include all selected categories
      catList = [...selectedCategoryIds].map(id => {
        const cat = categories[id];
        return cat ? { id, name: cat.name } : null;
      }).filter(Boolean);
    } else {
      // Single category
      catList = [{ id: catKey, name: catData.name }];
    }

    // Fetch project list depending on context
    let autoProjectId = null;
    let projects = null;

    if (projectId) {
      // Inside a project page → auto-select this project
      autoProjectId = projectId;
    } else {
      // Fetch all projects the user is a member of (always show full list)
      try {
        const allProjects = await fetch_all_projects();
        projects = (allProjects || []).map(p => ({ id: p.id, name: p.name }));
      } catch {
        projects = [];
      }
    }

    setReformCategoryModal({
      categories: catList,
      step: 'confirm',
      autoProjectId,
      selectedProjectId: null,
      projects,
    });
  };

  const closeReformCategory = () => {
    setReformCategoryModal(null);
    setReformLoading(false);
  };

  const executeReformCategory = async ({ takeIdeas, deleteAndArchive }) => {
    if (!reformCategoryModal) return;
    const { categories: catList, autoProjectId, selectedProjectId } = reformCategoryModal;
    const targetProjectId = autoProjectId || selectedProjectId;
    if (!targetProjectId) return;
    if (!catList || catList.length === 0) return;
    setReformLoading(true);
    try {
      for (const cat of catList) {
        // 1. Create a team per category
        const team = await createTeamForProject(targetProjectId, { name: cat.name });

        // 2. If taking ideas → create a task per idea, assigned to the new team
        if (takeIdeas) {
          const ideaIds = categoryOrders[cat.id] || [];
          for (const ideaId of ideaIds) {
            const idea = ideas[ideaId];
            if (idea) {
              await createTaskForProject(targetProjectId, {
                name: idea.title || "Untitled",
                description: idea.description || "",
                team_id: team.id,
              });
            }
          }
        }

        // 3. If deleting category & archiving ideas
        if (deleteAndArchive) {
          const ideaIds = categoryOrders[cat.id] || [];
          if (ideaIds.length > 0) {
            await batchSetArchiveApi(ideaIds, true);
          }
          await delete_category(cat.id);
        }
      }

      playSound('ideaTransform');
      closeReformCategory();
      // Refresh ideas so archived / removed items disappear
      await fetch_all_ideas();
    } catch (err) {
      console.error("Reform category to team failed:", err);
      setReformLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  RENDER HELPERS  ══════════════════════════
  // ═══════════════════════════════════════════════════════

  // Sidebar title mode: debounced auto-save
  const sidebarUpdateDraftAndSave = useCallback((ideaId, newTitle) => {
    setSidebarDraftTitle(newTitle);
    if (sidebarSaveTimerRef.current) clearTimeout(sidebarSaveTimerRef.current);
    sidebarSaveTimerRef.current = setTimeout(() => {
      update_idea_title_api(ideaId, newTitle);
    }, 400);
  }, [update_idea_title_api]);

  // Sidebar title mode: render the title builder inline for an idea
  const renderSidebarTitleBuilder = (ideaId) => {
    const idea = ideas[ideaId];
    if (!idea) return null;
    const draft = sidebarDraftTitle;
    const draftWords = draft.split(/\s+/).filter(w => w.length > 0);
    const descWords = (idea.description || "").split(/\s+/).filter(w => w.length > 0);
    const sortByDescription = (wordsArr) => {
      const lowerDesc = descWords.map(w => w.toLowerCase());
      return [...wordsArr].sort((a, b) => {
        const idxA = lowerDesc.indexOf(a.toLowerCase());
        const idxB = lowerDesc.indexOf(b.toLowerCase());
        return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
      });
    };
    return (
      <div key={`idea_${ideaId}`} className="bg-white rounded border border-purple-200 shadow-sm p-1.5 mb-0.5" onClick={(e) => e.stopPropagation()}>
        {/* Idea title preview */}
        <div className="text-[10px] font-semibold text-gray-600 mb-1">{idea.title || "Untitled"}</div>
        {/* Order toggle + clear */}
        <div className="flex items-center gap-1 mb-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMode = sidebarTitleOrderMode === "define" ? "description" : "define";
              setSidebarTitleOrderMode(newMode);
              if (newMode === "description" && draftWords.length > 1) {
                sidebarUpdateDraftAndSave(ideaId, sortByDescription(draftWords).join(" "));
              }
            }}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              sidebarTitleOrderMode === "define"
                ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
            }`}
          >
            {sidebarTitleOrderMode === "define" ? <ArrowDownUp size={10} /> : <BookOpenText size={10} />}
            {sidebarTitleOrderMode === "define" ? "Define Order" : "Order from Desc"}
          </button>
          <RotateCcw
            size={12}
            onClick={(e) => { e.stopPropagation(); sidebarUpdateDraftAndSave(ideaId, ""); }}
            className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 ml-auto"
            title="Clear title"
          />
        </div>
        {/* Current title as chips */}
        <div className="min-h-[20px] px-1.5 py-0.5 rounded border text-[11px] font-semibold bg-purple-50 border-purple-300 text-purple-900 flex items-center flex-wrap gap-0.5 mb-1">
          {draftWords.length > 0 ? draftWords.map((w, i) => (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                const newWords = [...draftWords];
                newWords.splice(i, 1);
                sidebarUpdateDraftAndSave(ideaId, newWords.join(" "));
              }}
              className="inline-flex items-center bg-purple-200 text-purple-800 rounded px-1 py-0.5 cursor-pointer hover:bg-red-200 hover:text-red-700 transition-colors text-[10px]"
              title="Click to remove"
            >
              {w}
              <X size={8} className="ml-0.5 opacity-60" />
            </span>
          )) : (
            <span className="text-purple-400 italic text-[10px]">Click words below to build title…</span>
          )}
        </div>
        {/* Word chips from description, preserving line breaks */}
        <div className="text-[10px]">
          {(idea.description || "").split("\n").map((line, li) => {
            if (line.trim() === "") return <div key={`line-${li}`} className="h-2" />;
            const lineWords = line.split(/\s+/).filter(w => w.length > 0);
            return (
              <div key={`line-${li}`} className="flex flex-wrap gap-[3px]" style={{ lineHeight: "18px" }}>
                {lineWords.map((word, wi) => {
                  const isUsed = draftWords.some(dw => dw.toLowerCase() === word.toLowerCase());
                  return (
                    <span
                      key={wi}
                      onClick={(e) => {
                        e.stopPropagation();
                        let newTitle;
                        if (sidebarTitleOrderMode === "description") {
                          const currentWords = draft ? draft.split(/\s+/).filter(w => w.length > 0) : [];
                          currentWords.push(word);
                          newTitle = sortByDescription(currentWords).join(" ");
                        } else {
                          newTitle = draft ? `${draft} ${word}` : word;
                        }
                        sidebarUpdateDraftAndSave(ideaId, newTitle);
                      }}
                      className={`inline-block rounded px-[3px] py-[1px] cursor-pointer transition-all select-none ${
                        isUsed
                          ? "bg-purple-100 text-purple-400 border border-purple-200"
                          : "text-gray-700 hover:bg-purple-100 hover:text-purple-700 border border-transparent hover:border-purple-300"
                      }`}
                      title={`Add "${word}" to title`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            );
          })}
          {descWords.length === 0 && (
            <span className="text-gray-400 italic text-[10px]">No description to extract words from</span>
          )}
        </div>
      </div>
    );
  };

  const renderIdeaItem = (ideaId, arrayIndex, source) => (
    <IdeaBinIdeaCard
      key={`idea_${ideaId}`}
      ideaId={ideaId} arrayIndex={arrayIndex} source={source}
      ideas={ideas} dims={dims} draggingType={draggingType}
      dragSource={dragSource} hoverIndex={hoverIndex} prevIndex={prevIndex}
      editingIdeaId={editingIdeaId} setEditingIdeaId={setEditingIdeaId}
      setEditingIdeaTitle={setEditingIdeaTitle} setEditingIdeaDescription={setEditingIdeaDescription}
      hoverIdeaForType={hoverIdeaForType} sidebarHeadlineOnly={sidebarHeadlineOnly}
      showSidebarMeta={showSidebarMeta}
      collapsedIdeas={collapsedIdeas} setCollapsedIdeas={setCollapsedIdeas}
      wigglingIdeaId={wigglingIdeaId} setWigglingIdeaId={setWigglingIdeaId}
      handleIdeaDrag={handleIdeaDrag}
      copiedIdeaId={copiedIdeaId} copy_idea={copy_idea}
      showCategories={showCategories}
      ideaSettingsOpen={ideaSettingsOpen} setIdeaSettingsOpen={setIdeaSettingsOpen}
      openTransform={openTransform} setConfirmModal={setConfirmModal}
      delete_meta_idea={delete_meta_idea} delete_idea={delete_idea}
      ideaRefs={ideaRefs}
      remove_all_idea_categories={remove_all_idea_categories}
      remove_idea_from_category={remove_idea_from_category}
      remove_all_idea_legend_types={remove_all_idea_legend_types}
      remove_idea_legend_type={remove_idea_legend_type}
      spinoff_idea={spinoff_idea}
      categories={categories}
      currentUserId={currentUserId}
      toggle_upvote={toggle_upvote}
      fetch_comments={fetch_comments}
      add_comment={add_comment}
      delete_comment={delete_comment}
      selectedIdeaIds={selectedIdeaIds}
      setSelectedIdeaIds={setSelectedIdeaIds}
      lastSelectedIdeaRef={lastSelectedIdeaRef}
      paintType={paintType}
      setPaintType={setPaintType}
      assign_idea_legend_type={assign_idea_legend_type}
    />
  );

  const archivedCategories = Object.values(categories).filter(c => c.archived);
  const activeCategories = Object.entries(categories).filter(([k, c]) => {
    if (c.archived || dockedCategories.includes(String(k))) return false;
    // When inside a context, only show categories belonging to that context
    if (activeContext) {
      return (activeContext.category_ids || []).includes(Number(k));
    }
    return true;
  });
  const unassignedCount = unassignedOrder.length;

  // ── Context-aware unassigned: when inside a context, show ideas linked to the
  //    context that are NOT placed in any category within the context. ──
  const effectiveUnassignedOrder = useMemo(() => {
    if (!activeContext) return unassignedOrder;
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    if (ctxIdeaIds.size === 0) return [];
    const ctxCatIds = new Set((activeContext.category_ids || []).map(Number));
    // Find all placements for context-linked ideas that are in no context category
    const matching = Object.values(ideas)
      .filter(p => p && ctxIdeaIds.has(p.idea_id) && (p.category == null || !ctxCatIds.has(Number(p.category))))
      .sort((a, b) => a.order_index - b.order_index)
      .map(p => p.id);
    return matching;
  }, [activeContext, contextIdeaOrders, ideas, unassignedOrder]);
  const effectiveUnassignedCount = effectiveUnassignedOrder.length;

  // ── Context-aware "All Ideas" list: when inside a context, show ideas
  //    that relate to this context in ANY way:
  //    1) directly linked via IdeaContextPlacement (context-unassigned), OR
  //    2) placed in a category that belongs to this context. ──
  const effectiveMetaIdeaList = useMemo(() => {
    if (!activeContext) return metaIdeaList;
    // 1) ideas linked directly to the context
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    // 2) ideas sitting in any of the context's categories
    const ctxCatIds = new Set((activeContext.category_ids || []).map(String));
    for (const p of Object.values(ideas)) {
      if (p && p.idea_id && p.category != null && ctxCatIds.has(String(p.category))) {
        ctxIdeaIds.add(p.idea_id);
      }
    }
    if (ctxIdeaIds.size === 0) return [];
    return metaIdeaList.filter(p => ctxIdeaIds.has(p.idea_id));
  }, [activeContext, contextIdeaOrders, metaIdeaList, ideas]);

  // ── Context-aware category orders: when inside a context, filter each
  //    category's idea list to only include context-linked ideas. ──
  const effectiveCategoryOrders = useMemo(() => {
    if (!activeContext) return categoryOrders;
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    if (ctxIdeaIds.size === 0) {
      const empty = {};
      for (const k of Object.keys(categoryOrders)) empty[k] = [];
      return empty;
    }
    const filtered = {};
    for (const [catKey, order] of Object.entries(categoryOrders)) {
      filtered[catKey] = order.filter(ideaId => {
        const p = ideas[ideaId];
        return p && ctxIdeaIds.has(p.idea_id);
      });
    }
    return filtered;
  }, [activeContext, contextIdeaOrders, categoryOrders, ideas]);

  // ── Advanced idea filter (multi-legend, stackable, AND/OR, include/exclude) ──
  const hasLegendFilters = legendFilters.length > 0 || stackedFilters.length > 0;

  // Evaluate a single group of rules against an idea
  const evalFilterGroup = useCallback((rules, combineMode, idea) => {
    if (rules.length === 0) return true;
    const results = rules.map(f => {
      const legId = String(f.legendId);
      const dt = idea.legend_types?.[legId];
      const typeId = dt?.legend_type_id;
      const hasType = !!dt;
      // Coerce to strings for safe comparison (typeIds may be int or string after JSON round-trip)
      const typeIdStr = typeId != null ? String(typeId) : null;
      const selectedStrs = (f.typeIds || []).map(String);
      const matchesSelected = selectedStrs.includes("unassigned")
        ? (!hasType || (typeIdStr != null && selectedStrs.includes(typeIdStr)))
        : (hasType && typeIdStr != null && selectedStrs.includes(typeIdStr));
      return f.mode === "exclude" ? !matchesSelected : matchesSelected;
    });
    return combineMode === "and" ? results.every(Boolean) : results.some(Boolean);
  }, []);

  const passesLegendFilters = useCallback((idea) => {
    if (!idea) return false;

    // Build list of groups to evaluate
    const groups = [];
    if (legendFilters.length > 0) {
      groups.push({ rules: legendFilters, combineMode: filterCombineMode });
    }
    for (const sg of stackedFilters) {
      if (sg.rules.length > 0) {
        groups.push(sg);
      }
    }
    if (groups.length === 0) return true;

    // Evaluate each group, then combine with stackCombineMode
    const groupResults = groups.map(g => evalFilterGroup(g.rules, g.combineMode, idea));
    return stackCombineMode === "and"
      ? groupResults.every(Boolean)
      : groupResults.some(Boolean);
  }, [legendFilters, filterCombineMode, stackedFilters, stackCombineMode, evalFilterGroup]);

  // Also keep the old globalTypeFilter working as fallback (single active legend filter)
  const passesGlobalTypeFilter = useCallback((idea) => {
    if (globalTypeFilter.length === 0) return true;
    if (!idea) return false;
    const dimId = String(dims.activeLegendId || "");
    const dt = idea.legend_types?.[dimId];
    if (globalTypeFilter.includes("unassigned") && !dt) return true;
    if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
    return false;
  }, [globalTypeFilter, dims.activeLegendId]);

  // Combined filter: use advanced if active, else fall back to simple
  const passesAllFilters = useCallback((idea) => {
    if (hasLegendFilters) return passesLegendFilters(idea);
    return passesGlobalTypeFilter(idea);
  }, [hasLegendFilters, passesLegendFilters, passesGlobalTypeFilter]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  JSX  ═════════════════════════════════════
  // ═══════════════════════════════════════════════════════

  return (
    <>
      {/* Wiggle animation */}
      <style>{`
        @keyframes ideabin-wiggle-anim {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-3px) rotate(-1deg); }
          20% { transform: translateX(3px) rotate(1deg); }
          30% { transform: translateX(-3px) rotate(-1deg); }
          40% { transform: translateX(3px) rotate(1deg); }
          50% { transform: translateX(-2px) rotate(-0.5deg); }
          60% { transform: translateX(2px) rotate(0.5deg); }
          70% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
          90% { transform: translateX(0); }
        }
        .ideabin-wiggle {
          animation: ideabin-wiggle-anim 0.6s ease-in-out 2;
          box-shadow: 0 0 8px 2px rgba(16, 185, 129, 0.4) !important;
        }
      `}</style>
      {/* ───── COLLAPSED: Floating icon ───── */}
      {!isOpen && (
        <div
          ref={iconRef}
          onMouseDown={handleIconDrag}
          style={{
            position: "fixed",
            left: iconPos.x,
            top: iconPos.y,
            zIndex: 9980,
            background: activeContext?.color
              ? `linear-gradient(135deg, ${activeContext.color}, color-mix(in srgb, ${activeContext.color} 70%, #333))`
              : undefined,
            borderColor: activeContext?.color
              ? `color-mix(in srgb, ${activeContext.color} 60%, #fff)`
              : undefined,
          }}
          className={`w-12 h-12 rounded-full shadow-lg
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150
            border-2 ${
              activeContext?.color
                ? ""
                : "bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300"
            }`}
          title="Open Idea Bin"
        >
          <Lightbulb size={22} className="text-white drop-shadow" />
          {effectiveUnassignedCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow border border-white">
              {effectiveUnassignedCount > 9 ? "9+" : effectiveUnassignedCount}
            </span>
          )}
        </div>
      )}

      {/* ───── EXPANDED: Floating window ───── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-ideabin-window
          style={{
            position: "fixed",
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.w,
            height: windowSize.h,
            zIndex: 9980,
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden select-none"
        >
          {/* ── Resize edges ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top")} className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom")} className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "left")} className="absolute left-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "right")} className="absolute right-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          {/* ── Resize corners ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top-left")} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "top-right")} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-left")} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-right")} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-20" />

          {/* ── Title bar ── */}
          <div
            onMouseDown={handleWindowDrag}
            onDoubleClick={toggleMaximize}
            className={`flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing flex-shrink-0 border-b ${
              activeContext?.color
                ? "border-gray-300/50"
                : "bg-gradient-to-r from-amber-400 to-yellow-400 border-amber-500/30"
            }`}
            style={activeContext?.color ? {
              background: `linear-gradient(to right, ${activeContext.color}88, ${activeContext.color}55)`,
            } : undefined}
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className={activeContext?.color ? "text-gray-800" : "text-amber-800"} />
              <span className={`text-sm font-semibold ${activeContext?.color ? "text-gray-900" : "text-amber-900"}`}>
                Ideas
              </span>

              {/* ── Context selector dropdown ── */}
              <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setShowContextSelector(p => !p); if (!showContextSelector) fetch_contexts_for_selector(); }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    activeContext
                      ? "bg-white/30 text-gray-800 hover:bg-white/50"
                      : "bg-amber-600/15 text-amber-800 hover:bg-amber-600/25"
                  }`}
                  title="Select context"
                >
                  <Layers size={10} />
                  {activeContext ? activeContext.name : "All"}
                  <ChevronDown size={10} />
                </button>
                {showContextSelector && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowContextSelector(false)} />
                    <div className="absolute left-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px] max-h-[240px] overflow-y-auto">
                      {/* "All" option (no context) */}
                      <button
                        onClick={() => { exitContext(); setShowContextSelector(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                          !activeContext ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
                        All (no context)
                      </button>
                      {contextsList.map(ctx => (
                        <div
                          key={ctx.id}
                          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                            activeContext?.id === ctx.id ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {/* Default-context star toggle */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const result = await toggle_default_context(ctx.id);
                              if (result) {
                                setContextsList(prev => prev.map(c => ({ ...c, is_default: c.id === ctx.id ? result.is_default : false })));
                              }
                            }}
                            className="flex-shrink-0"
                            title={ctx.is_default ? "Remove as default context" : "Set as default context"}
                          >
                            <Star size={10} className={ctx.is_default ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-400"} />
                          </button>
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200"
                            style={{ backgroundColor: ctx.color || "#94a3b8" }}
                          />
                          <button
                            className="truncate flex-1 text-left"
                            onClick={() => { enterContext(ctx); setShowContextSelector(false); }}
                          >
                            {ctx.name}
                          </button>
                        </div>
                      ))}
                      {contextsList.length === 0 && (
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">No contexts yet</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Color picker — only when inside a context */}
              {activeContext && (
                <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setShowContextColorPicker(p => !p)}
                    className="p-0.5 rounded hover:bg-white/30 transition-colors"
                    title="Context color"
                  >
                    <Palette size={12} style={{ color: activeContext.color || "#6b7280" }} />
                  </button>
                  {showContextColorPicker && (
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setShowContextColorPicker(false)} />
                      <div className="absolute left-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[140px]">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5">Context Color</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"].map(c => (
                            <button
                              key={c}
                              onClick={() => { updateActiveContextColor(c); setShowContextColorPicker(false); }}
                              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${activeContext.color === c ? "border-gray-800 scale-110" : "border-gray-200"}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        {activeContext.color && (
                          <button
                            onClick={() => { updateActiveContextColor(null); setShowContextColorPicker(false); }}
                            className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Remove color
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {effectiveUnassignedCount > 0 && viewMode === "ideas" && (
                <span
                  className="text-[10px] px-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 20%, transparent)` : "rgba(217,119,6,0.2)",
                    color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 70%, #333)` : "#92400e",
                  }}
                >
                  {effectiveUnassignedCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {viewMode === "ideas" && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setShowMetaList(v => !v)}
                  className={`p-1 rounded transition-colors ${showMetaList ? "bg-black/10" : "hover:bg-black/10"}`}
                  title="All Ideas (Meta View)"
                >
                  <List size={13} style={{ color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e" }} />
                </button>
              )}
              {viewMode === "ideas" && copiedIdeaId && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => paste_idea([...selectedCategoryIds][0] || null)}
                  className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-semibold hover:bg-indigo-200 transition-colors"
                  title={`Paste copied idea${selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` into "${categories[[...selectedCategoryIds][0]].name}"` : " (unassigned)"} (Ctrl+V)`}
                >
                  Paste{selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` → ${categories[[...selectedCategoryIds][0]].name}` : ""}
                </button>
              )}
              {/* ── Formations dropdown ── */}
              <div className="relative">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setShowFormationPanel(v => !v)}
                  className={`p-1 rounded transition-colors ${showFormationPanel ? "bg-black/10" : "hover:bg-black/10"}`}
                  title="Formations — save / load layout"
                >
                  <Save size={13} style={{ color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e" }} />
                </button>
                {showFormationPanel && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => { setShowFormationPanel(false); setEditingFormationId(null); }} />
                    <div
                      className="absolute right-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[220px] max-h-[340px] overflow-y-auto"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 pb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Formations{activeContext ? ` — ${activeContext.name}` : ""}</div>
                      {/* Save new */}
                      {!activeContext ? (
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">Enter a context to manage formations</div>
                      ) : (
                      <div className="px-2 pb-1.5 flex items-center gap-1">
                        <input
                          type="text"
                          value={formationName}
                          onChange={(e) => setFormationName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && formationName.trim()) { save_formation(formationName.trim()); } }}
                          placeholder="New formation name…"
                          className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => { if (formationName.trim()) save_formation(formationName.trim()); }}
                          disabled={!formationName.trim()}
                          className="p-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 transition-colors"
                          title="Save current layout"
                        >
                          <Save size={12} />
                        </button>
                      </div>
                      )}
                      {formations.length === 0 && (
                        <div className="px-3 py-2 text-[10px] text-gray-400 italic">No saved formations yet</div>
                      )}
                      {formations.map(f => (
                        <div key={f.id} className="group flex items-center gap-1 px-2 py-1 hover:bg-gray-50 transition-colors">
                          {editingFormationId === f.id ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={editingFormationName}
                                onChange={(e) => setEditingFormationName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editingFormationName.trim()) {
                                    rename_formation(f.id, editingFormationName.trim());
                                    setEditingFormationId(null);
                                  }
                                  if (e.key === "Escape") setEditingFormationId(null);
                                }}
                                className="flex-1 text-[11px] px-1.5 py-0.5 rounded border border-gray-200 focus:outline-none focus:border-amber-400"
                              />
                              <Check
                                size={12}
                                onClick={() => { if (editingFormationName.trim()) { rename_formation(f.id, editingFormationName.trim()); setEditingFormationId(null); } }}
                                className="cursor-pointer text-green-500 hover:text-green-700 flex-shrink-0"
                              />
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => { load_formation(f.id); setShowFormationPanel(false); }}
                                className="flex-1 text-left text-[11px] text-gray-700 hover:text-amber-700 truncate"
                                title={`Load "${f.name}"`}
                              >
                                <FolderOpen size={11} className="inline mr-1 text-amber-500" />
                                {f.name}
                              </button>
                              <Star
                                size={11}
                                onClick={() => toggle_default_formation(f.id)}
                                className={`cursor-pointer flex-shrink-0 transition-opacity ${f.is_default ? "text-amber-400 fill-amber-400 opacity-100" : "text-gray-300 hover:text-amber-400! opacity-0 group-hover:opacity-100"}`}
                                title={f.is_default ? "Remove as default" : "Set as default (auto-load on open)"}
                              />
                              <Save
                                size={11}
                                onClick={() => update_formation_state(f.id)}
                                className="cursor-pointer text-gray-300 hover:text-amber-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Overwrite with current layout"
                              />
                              <Pencil
                                size={11}
                                onClick={() => { setEditingFormationId(f.id); setEditingFormationName(f.name); }}
                                className="cursor-pointer text-gray-300 hover:text-blue-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Rename"
                              />
                              <Trash2
                                size={11}
                                onClick={() => delete_formation(f.id)}
                                className="cursor-pointer text-gray-300 hover:text-red-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete"
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={toggleMaximize}
                className="p-1 rounded hover:bg-black/10 transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized
                  ? <Minimize2 size={13} style={{ color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e" }} />
                  : <Maximize2 size={13} style={{ color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e" }} />
                }
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={minimizeWindow}
                className="p-1 rounded hover:bg-black/10 transition-colors"
                title="Minimize to icon"
              >
                <Minus size={13} style={{ color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e" }} />
              </button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <IdeaBinToolbar
            refactorMode={refactorMode} setRefactorMode={setRefactorMode}
            headlineModeCategoryId={headlineModeCategoryId} setHeadlineModeCategoryId={setHeadlineModeCategoryId}
            headlineModeIdeaId={headlineModeIdeaId} setHeadlineModeIdeaId={setHeadlineModeIdeaId}
            viewMode={viewMode} setViewMode={setViewMode}
            ideas={ideas} categories={categories}
            activeContext={activeContext}
            displayCategoryForm={displayCategoryForm} setDisplayCategoryForm={setDisplayCategoryForm}
            newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
            newCategoryPublic={newCategoryPublic} setNewCategoryPublic={setNewCategoryPublic}
            create_category_api={create_category_api}
            drawCategoryMode={drawCategoryMode} setDrawCategoryMode={setDrawCategoryMode}
            showOrderNumbers={showOrderNumbers} setShowOrderNumbers={setShowOrderNumbers}
            activeCategories={activeCategories}
            toggle_archive_idea={toggle_archive_idea}
            delete_meta_idea={delete_meta_idea}
            fetch_all_ideas={fetch_all_ideas}
            selectedIdeaCount={selectedIdeaIds.size}
            onMergeClick={handleMergeClick}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />

          {/* ── Content area ── */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Confirm modal overlay */}
            {confirmModal && (
              <IdeaBinConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} middleLabel={confirmModal.middleLabel} middleColor={confirmModal.middleColor} onMiddle={confirmModal.onMiddle} />
            )}

            {/* C&R conflict resolution modal */}
            {crConflictData && (
              <CollectConflictModal
                conflictData={crConflictData}
                onResolve={(resolution) => resolveCRConflicts(resolution)}
                onCancel={() => setCrConflictData(null)}
              />
            )}

            {/* Merge ideas modal */}
            {showMergeModal && Array.isArray(showMergeModal) && (
              <IdeaBinMergeModal
                selectedIdeas={showMergeModal}
                onMerge={executeMerge}
                onCancel={() => setShowMergeModal(false)}
                autoMerge={autoMerge}
                setAutoMerge={handleAutoMergeChange}
              />
            )}

            {/* ── Meta Ideas list overlay ── */}
            {showMetaList && (
              <>
                <div className="absolute inset-0 bg-black/20 z-[48]" onClick={() => setShowMetaList(false)} />
                <div className="absolute inset-2 bg-white rounded-lg shadow-2xl z-[49] flex flex-col overflow-hidden border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <List size={14} /> All Ideas ({effectiveMetaIdeaList.length})
                    </span>
                    <button onClick={() => setShowMetaList(false)} className="text-white/80 hover:text-white text-sm font-bold">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {effectiveMetaIdeaList.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No ideas yet</p>
                    )}
                    {effectiveMetaIdeaList.map((idea, idx) => renderIdeaItem(idea.id, idx, { type: "meta" }))}
                  </div>
                </div>
              </>
            )}

            {/* Reform category → team modal overlay */}
            <IdeaBinReformCategoryModal
              reformModal={reformCategoryModal}
              setReformModal={setReformCategoryModal}
              onClose={closeReformCategory}
              onExecute={executeReformCategory}
              reformLoading={reformLoading}
            />

            {/* Transform modal overlay */}
            <IdeaBinTransformModal
              transformModal={transformModal} setTransformModal={setTransformModal} closeTransform={closeTransform}
              transformName={transformName} setTransformName={setTransformName}
              transformTeamId={transformTeamId} setTransformTeamId={setTransformTeamId}
              transformTaskId={transformTaskId} setTransformTaskId={setTransformTaskId}
              transformTaskSearch={transformTaskSearch} setTransformTaskSearch={setTransformTaskSearch}
              projectTeams={projectTeams} projectTasks={projectTasks} transformLoading={transformLoading}
              executeTransformToTask={executeTransformToTask} executeTransformToMilestone={executeTransformToMilestone}
            />

            {/* Category export modal */}
            {categoryExportJson && (
              <IdeaBinCategoryExportModal
                json={categoryExportJson}
                onClose={() => setCategoryExportJson(null)}
              />
            )}

            {/* Category import modal */}
            {showCategoryImport && (
              <IdeaBinCategoryImportModal
                onImport={handleImportCategory}
                onClose={() => setShowCategoryImport(false)}
              />
            )}

            {/* Insert ideas into category modal */}
            {insertIdeasTarget && (
              <IdeaBinInsertIdeasModal
                categoryName={insertIdeasTarget.name}
                onInsert={handleInsertIdeas}
                onClose={() => setInsertIdeasTarget(null)}
              />
            )}

            {/* ══════ IDEAS MODE ══════ */}
            {viewMode === "ideas" && (
            <>
            {/* ── LEFT: Collapsed strip when sidebar is hidden ── */}
            {leftCollapsed && showCategories && (
              <div className="flex flex-col items-center flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: COLLAPSED_STRIP_W }}>
                <button
                  onClick={() => setLeftCollapsed(false)}
                  className="mt-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Expand idea panel"
                >
                  <PanelLeftOpen size={16} />
                </button>
              </div>
            )}

            {/* ── LEFT: Sidebar (visible when not collapsed, or when categories not shown) ── */}
            {(!leftCollapsed || !showCategories) && (
            <div
              className="flex flex-col flex-shrink-0 bg-white relative"
              style={{ width: showCategories ? (rightCollapsed ? `calc(100% - ${COLLAPSED_STRIP_W}px)` : sidebarWidth) : "100%" }}
              onMouseDown={() => setSidebarFocused(true)}
            >
              {/* Collapse idea panel button — top-right corner */}
              {showCategories && !rightCollapsed && (
                <button
                  onClick={() => setLeftCollapsed(true)}
                  className="absolute top-1.5 right-0 z-30 bg-white border border-gray-300 rounded-l px-1 py-1 flex items-center justify-center shadow-sm hover:bg-gray-100 hover:border-gray-400 transition-colors"
                  title="Collapse idea panel"
                >
                  <PanelLeftClose size={12} className="text-gray-500" />
                </button>
              )}
              {/* ── Input form ── */}
              <div
                ref={editFormRef}
                className="p-2 bg-gray-50 flex-shrink-0 flex flex-col"
                style={{ height: formHeight, overflow: "hidden" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <h2 className="text-xs font-semibold text-gray-500">
                    {editingIdeaId ? "Edit Idea" : "New Idea"}
                  </h2>
                  <button
                    onClick={() => {
                      if (editingIdeaId) setEditFormTitleMode(prev => !prev);
                      else setCreateFormTitleMode(prev => !prev);
                    }}
                    className={`flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded border transition-colors ${
                      (editingIdeaId ? editFormTitleMode : createFormTitleMode)
                        ? "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200"
                        : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                    }`}
                    title="Toggle Title Mode (Ctrl+Alt)"
                  >
                    <Type size={9} />
                    Title Mode
                  </button>
                </div>
                {!editingIdeaId && selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] && (
                  <div className="flex items-center gap-1 mb-1.5 px-1.5 py-1 bg-indigo-50 border border-indigo-200 rounded text-[10px] text-indigo-700">
                    <span className="font-medium">Auto-add to:</span>
                    <span className="font-semibold truncate">{categories[[...selectedCategoryIds][0]].name}</span>
                    <button
                      onClick={() => setSelectedCategoryIds(new Set())}
                      className="ml-auto flex-shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors"
                      title="Remove category selection"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* ── Title section ── */}
                {(editingIdeaId ? editFormTitleMode : createFormTitleMode) ? (() => {
                  const cfTitleWords = (editingIdeaId ? editingIdeaTitle : ideaName) ? (editingIdeaId ? editingIdeaTitle : ideaName).split(/\s+/).filter(w => w.length > 0) : [];
                  const cfDescWords = ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split(/\s+/).filter(w => w.length > 0);
                  const cfSortByDescription = (wordsArr) => {
                    const lowerDesc = cfDescWords.map(w => w.toLowerCase());
                    return [...wordsArr].sort((a, b) => {
                      const idxA = lowerDesc.indexOf(a.toLowerCase());
                      const idxB = lowerDesc.indexOf(b.toLowerCase());
                      return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
                    });
                  };
                  // Drag handlers for reordering title words
                  const cfHandleDragStart = (e, wordIdx) => {
                    cfDragItemRef.current = { index: wordIdx };
                    e.dataTransfer.effectAllowed = "move";
                    e.target.style.opacity = "0.4";
                  };
                  const cfHandleDragEnd = (e) => {
                    e.target.style.opacity = "1";
                    cfDragItemRef.current = null;
                    cfDragOverRef.current = null;
                    setCfDropIdx(null);
                  };
                  const cfHandleDragOver = (e, wordIdx) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    const gapIdx = e.clientX < midX ? wordIdx : wordIdx + 1;
                    cfDragOverRef.current = { index: gapIdx };
                    setCfDropIdx(gapIdx);
                  };
                  const cfHandleDrop = (e) => {
                    e.preventDefault();
                    if (!cfDragItemRef.current || cfDragOverRef.current == null) return;
                    const fromIdx = cfDragItemRef.current.index;
                    const toIdx = cfDragOverRef.current.index;
                    if (fromIdx === toIdx || fromIdx + 1 === toIdx) { setCfDropIdx(null); return; }
                    const reordered = [...cfTitleWords];
                    const [moved] = reordered.splice(fromIdx, 1);
                    const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
                    reordered.splice(insertAt, 0, moved);
                    if (editingIdeaId) setEditingIdeaTitle(reordered.join(" "));
                    else setIdeaName(reordered.join(" "));
                    cfDragItemRef.current = null;
                    cfDragOverRef.current = null;
                    setCfDropIdx(null);
                  };
                  return (
                    <div className="bg-white rounded border border-purple-200 shadow-sm p-1.5 mb-1" onClick={(e) => e.stopPropagation()}>
                      {/* Order toggle + clear */}
                      <div className="flex items-center gap-1 mb-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentOrderMode = editingIdeaId ? editFormOrderMode : createFormOrderMode;
                            const newMode = currentOrderMode === "define" ? "description" : "define";
                            if (editingIdeaId) setEditFormOrderMode(newMode);
                            else setCreateFormOrderMode(newMode);
                            if (newMode === "description" && cfTitleWords.length > 1) {
                              const sorted = cfSortByDescription(cfTitleWords).join(" ");
                              if (editingIdeaId) setEditingIdeaTitle(sorted);
                              else setIdeaName(sorted);
                            }
                          }}
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            (editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define"
                              ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                              : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                          }`}
                          title={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Switch to auto-order by description position" : "Switch to manual drag-to-reorder"}
                        >
                          {(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? <ArrowDownUp size={10} /> : <BookOpenText size={10} />}
                          {(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Define Order" : "Order from Description"}
                        </button>
                        <RotateCcw
                          size={12}
                          onClick={(e) => { e.stopPropagation(); if (editingIdeaId) setEditingIdeaTitle(""); else setIdeaName(""); }}
                          className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 ml-auto"
                          title="Clear title"
                        />
                      </div>
                      {/* Current title as chips */}
                      <div className="flex items-center gap-1 mb-1">
                        <div
                          className="flex-1 min-h-[22px] px-1.5 py-0.5 rounded border text-[11px] font-semibold bg-purple-50 border-purple-300 text-purple-900 flex items-center flex-wrap gap-0.5"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={cfHandleDrop}
                        >
                          {cfTitleWords.length > 0 ? cfTitleWords.map((w, i) => (
                            <React.Fragment key={i}>
                              {cfDropIdx === i && cfDragItemRef.current && cfDragItemRef.current.index !== i && cfDragItemRef.current.index !== i - 1 && (
                                <div className="w-0.5 self-stretch bg-purple-500 rounded-full min-h-[16px] flex-shrink-0 animate-pulse" />
                              )}
                              <span
                                draggable={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define"}
                                onDragStart={(e) => cfHandleDragStart(e, i)}
                                onDragEnd={cfHandleDragEnd}
                                onDragOver={(e) => cfHandleDragOver(e, i)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newWords = [...cfTitleWords];
                                  newWords.splice(i, 1);
                                  if (editingIdeaId) setEditingIdeaTitle(newWords.join(" "));
                                  else setIdeaName(newWords.join(" "));
                                }}
                                className={`inline-flex items-center bg-purple-200 text-purple-800 rounded px-1 py-0.5 cursor-pointer hover:bg-red-200 hover:text-red-700 transition-colors text-[10px] ${
                                  (editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "cursor-grab active:cursor-grabbing" : ""
                                }`}
                                title={(editingIdeaId ? editFormOrderMode : createFormOrderMode) === "define" ? "Drag to reorder · Click to remove" : "Click to remove"}
                              >
                                {w}
                                <X size={8} className="ml-0.5 opacity-60" />
                              </span>
                            </React.Fragment>
                          )) : (
                            <span className="text-purple-400 italic text-[10px]">Click words below to build title…</span>
                          )}
                          {cfDropIdx === cfTitleWords.length && cfDragItemRef.current && (
                            <div className="w-0.5 self-stretch bg-purple-500 rounded-full min-h-[16px] flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <TextField
                    inputRef={headlineInputRef}
                    value={editingIdeaId ? editingIdeaTitle : ideaName}
                    onChange={(e) => {
                      if (editingIdeaId) setEditingIdeaTitle(e.target.value);
                      else setIdeaName(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
                        e.preventDefault();
                        if (editingIdeaId) setEditFormTitleMode(prev => !prev);
                        else setCreateFormTitleMode(prev => !prev);
                      } else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editingIdeaId) {
                          update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                          setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                        } else if (ideaName.trim() || newIdeaDescription.trim()) { create_idea(); setCreateFormTitleMode(false); }
                      } else if (e.key === "Escape" && editingIdeaId) {
                        setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    label={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{ backgroundColor: "white", borderRadius: 1, marginBottom: 0.5, "& .MuiInputLabel-root": { fontSize: 11 }, "& .MuiInputLabel-shrink": { fontSize: 12 }, "& .MuiInputBase-input": { fontSize: 12, padding: "6px 10px", caretColor: "#1f2937", color: "#1f2937" } }}
                  />
                )}

                {/* Description area – textarea when off, word chips when title mode is on */}
                {(editingIdeaId ? editFormTitleMode : createFormTitleMode) ? (() => {
                  const cfDescWordsForChips = ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split(/\s+/).filter(w => w.length > 0);
                  const cfTitleWordsForChips = (editingIdeaId ? editingIdeaTitle : ideaName) ? (editingIdeaId ? editingIdeaTitle : ideaName).split(/\s+/).filter(w => w.length > 0) : [];
                  const cfSortByDescForChips = (wordsArr) => {
                    const lowerDesc = cfDescWordsForChips.map(w => w.toLowerCase());
                    return [...wordsArr].sort((a, b) => {
                      const idxA = lowerDesc.indexOf(a.toLowerCase());
                      const idxB = lowerDesc.indexOf(b.toLowerCase());
                      return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
                    });
                  };
                  return (
                    <div
                      className="mt-1 rounded border border-gray-300 bg-white px-2.5 py-2 min-h-[56px] cursor-default transition-colors flex-1 overflow-y-auto"
                      style={{ fontSize: 11, lineHeight: "20px" }}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
                          e.preventDefault();
                          if (editingIdeaId) setEditFormTitleMode(false);
                          else setCreateFormTitleMode(false);
                        } else if (e.key === "Enter" && !e.shiftKey) {
                          if (editingIdeaId) {
                            e.preventDefault();
                            update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                            setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                          } else if (ideaName.trim() || newIdeaDescription.trim()) {
                            e.preventDefault(); create_idea(); setCreateFormTitleMode(false);
                          }
                        }
                      }}
                    >
                      {cfDescWordsForChips.length > 0 ? ((editingIdeaId ? editingIdeaDescription : newIdeaDescription) || "").split("\n").map((line, li) => {
                        if (line.trim() === "") return <div key={`line-${li}`} className="h-3" />;
                        const lineWords = line.split(/\s+/).filter(w => w.length > 0);
                        return (
                          <div key={`line-${li}`} className="flex flex-wrap gap-[4px]" style={{ lineHeight: "20px" }}>
                            {lineWords.map((word, wi) => {
                              const isUsed = cfTitleWordsForChips.some(dw => dw.toLowerCase() === word.toLowerCase());
                              return (
                                <span
                                  key={wi}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentOrderMode = editingIdeaId ? editFormOrderMode : createFormOrderMode;
                                    const currentTitle = editingIdeaId ? editingIdeaTitle : ideaName;
                                    let newTitle;
                                    if (currentOrderMode === "description") {
                                      const currentWords = currentTitle ? currentTitle.split(/\s+/).filter(w => w.length > 0) : [];
                                      currentWords.push(word);
                                      newTitle = cfSortByDescForChips(currentWords).join(" ");
                                    } else {
                                      newTitle = currentTitle ? `${currentTitle} ${word}` : word;
                                    }
                                    if (editingIdeaId) setEditingIdeaTitle(newTitle);
                                    else setIdeaName(newTitle);
                                  }}
                                  className={`inline-block rounded px-[3px] py-[1px] cursor-pointer transition-all select-none ${
                                    isUsed
                                      ? "bg-purple-100 text-purple-400 border border-purple-200"
                                      : "text-gray-600 hover:bg-purple-100 hover:text-purple-700 border border-transparent hover:border-purple-300"
                                  }`}
                                  style={{ fontSize: 11, lineHeight: "18px" }}
                                  title={`Add "${word}" to title`}
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </div>
                        );
                      }) : (
                        <span className="text-gray-400 italic" style={{ fontSize: 11 }}>Write a description first, then press Ctrl+Alt to pick words…</span>
                      )}
                    </div>
                  );
                })() : (
                  <TextField
                    value={editingIdeaId ? editingIdeaDescription : newIdeaDescription}
                    onChange={(e) => {
                      if (editingIdeaId) setEditingIdeaDescription(e.target.value);
                      else setNewIdeaDescription(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Alt" && e.ctrlKey) || (e.key === "Control" && e.altKey)) {
                        e.preventDefault();
                        if (editingIdeaId) setEditFormTitleMode(prev => !prev);
                        else setCreateFormTitleMode(prev => !prev);
                      } else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editingIdeaId) {
                          update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                          setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                        } else if (ideaName.trim() || newIdeaDescription.trim()) {
                          create_idea(); setCreateFormTitleMode(false);
                        }
                      } else if (e.key === "Escape" && editingIdeaId) {
                        setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                      }
                      // Shift+Enter falls through naturally → inserts line break
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    label="Description (optional)"
                    variant="outlined"
                    multiline
                    minRows={2}
                    fullWidth
                    sx={{
                      backgroundColor: "white", borderRadius: 1, marginTop: 0.5, flex: 1, display: "flex",
                      "& .MuiInputBase-root": { flex: 1, overflow: "auto", alignItems: "flex-start" },
                      "& .MuiInputBase-input": { fontSize: 11, caretColor: "#1f2937", color: "#6b7280" },
                      "& .MuiInputLabel-root": { fontSize: 11 },
                      "& .MuiInputLabel-shrink": { fontSize: 12 },
                    }}
                  />
                )}

                <div className="flex gap-1.5 mt-1.5">
                  {editingIdeaId ? (
                    <>
                      <button
                        onClick={() => {
                          update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaDescription);
                          setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false);
                        }}
                        className="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px]"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => { setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaDescription(""); setEditFormTitleMode(false); }}
                        className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-[11px]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    (ideaName.trim() || newIdeaDescription.trim()) && (
                      <button
                        onClick={() => { create_idea(); setCreateFormTitleMode(false); }}
                        className="px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 text-[11px]"
                      >
                        Create{selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` → ${categories[[...selectedCategoryIds][0]].name}` : ""}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ── Vertical splitter between form and list ── */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const startY = e.clientY;
                  const startH = formHeight;
                  const onMove = (ev) => {
                    const newH = Math.min(MAX_FORM_H, Math.max(MIN_FORM_H, startH + (ev.clientY - startY)));
                    setFormHeight(newH);
                  };
                  const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
                className="h-1.5 flex-shrink-0 bg-gray-200 hover:bg-blue-400 cursor-row-resize transition-colors duration-150"
              />

              {/* ── Ideas list (switchable) ── */}
              <div
                ref={IdeaListRef}
                data-idea-list
                onMouseDown={handleSidebarMarqueeStart}
                style={{
                  backgroundColor: dragging && hoverUnassigned ? "#f3f4f6" : "#ffffff",
                  transition: "background-color 150ms ease",
                  position: "relative",
                  userSelect: sidebarMarquee ? "none" : undefined,
                }}
                className="flex-1 p-1.5 overflow-y-auto overflow-x-hidden"
              >
                {/* List filter header */}
                <div className="relative mb-1">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowListFilterDropdown(p => !p)}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {listFilter === "all"
                        ? `All Ideas (${effectiveMetaIdeaList.length})`
                        : listFilter === "unassigned"
                        ? `Unassigned (${effectiveUnassignedCount})`
                        : `${categories[listFilter]?.name || "Category"} (${(effectiveCategoryOrders[listFilter] || []).length})`
                      }
                      <span className="text-[9px]">▼</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowListSettings(p => !p)}
                        className={`p-0.5 rounded transition-colors ${showListSettings ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
                        title="List settings"
                      >
                        <Settings size={13} />
                      </button>
                      {showListSettings && (
                        <>
                          <div className="fixed inset-0 z-[70]" onClick={() => setShowListSettings(false)} />
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[71] min-w-[160px] py-1">
                            <button
                              onClick={() => {
                                const newVal = !sidebarHeadlineOnly;
                                setSidebarHeadlineOnly(newVal);
                                // Reset ALL collapse states so the toggle takes effect everywhere
                                setCollapsedIdeas({});
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <span className="w-3 text-center">{sidebarHeadlineOnly ? "▶" : "▼"}</span>
                              {sidebarHeadlineOnly ? "Show full ideas" : "Headlines only"}
                            </button>
                            <button
                              onClick={() => setShowSidebarMeta(p => !p)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <span className="w-3 text-center">{showSidebarMeta ? "✓" : ""}</span>
                              Show meta info
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <div className="px-3 py-1.5 text-[9px] text-gray-400 italic">
                              Current list view ({listFilter === "all" ? "All Ideas" : listFilter === "unassigned" ? "Unassigned" : categories[listFilter]?.name || "Category"}) will be saved with formations.
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {showListFilterDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowListFilterDropdown(false)} />
                      <div className="absolute left-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-[61] min-w-[140px] max-h-[200px] overflow-y-auto py-0.5">
                        <div
                          onClick={() => { setListFilter("all"); setShowListFilterDropdown(false); }}
                          className={`px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors ${listFilter === "all" ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                        >
                          All Ideas ({effectiveMetaIdeaList.length})
                        </div>
                        <div
                          onClick={() => { setListFilter("unassigned"); setShowListFilterDropdown(false); }}
                          className={`px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors ${listFilter === "unassigned" ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                        >
                          Unassigned ({effectiveUnassignedCount})
                        </div>
                        {Object.entries(categories).map(([catKey, catData]) => {
                          const isFed = !!catData.filter_config;
                          return (
                            <div
                              key={catKey}
                              onClick={() => { setListFilter(catKey); setShowListFilterDropdown(false); }}
                              className={`px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors flex items-center gap-1.5 ${
                                String(listFilter) === String(catKey)
                                  ? isFed ? "bg-blue-100 text-blue-800 font-medium" : "bg-amber-100 text-amber-800 font-medium"
                                  : isFed ? "hover:bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              {catData.archived && <span className="text-[9px] text-gray-400">📦</span>}
                              {isFed && <span className="text-[8px] font-bold text-blue-500 border border-blue-300 rounded px-0.5 flex-shrink-0">FEED</span>}
                              {catData.name} ({(effectiveCategoryOrders[catKey] || []).length})
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                {/* Idea items for current filter */}
                {listFilter === "all"
                  ? effectiveMetaIdeaList
                      .filter(idea => passesAllFilters(idea))
                      .map((idea, idx) =>
                        headlineModeIdeaId === idea.id
                          ? renderSidebarTitleBuilder(idea.id)
                          : renderIdeaItem(idea.id, idx, { type: "all" })
                      )
                  : listFilter === "unassigned"
                  ? effectiveUnassignedOrder
                      .filter(ideaId => passesAllFilters(ideas[ideaId]))
                      .map((ideaId, idx) =>
                        headlineModeIdeaId === ideaId
                          ? renderSidebarTitleBuilder(ideaId)
                          : renderIdeaItem(ideaId, idx, { type: "unassigned" })
                      )
                  : (effectiveCategoryOrders[listFilter] || [])
                      .filter(ideaId => passesAllFilters(ideas[ideaId]))
                      .map((ideaId, idx) =>
                        headlineModeIdeaId === ideaId
                          ? renderSidebarTitleBuilder(ideaId)
                          : renderIdeaItem(ideaId, idx, { type: "category", id: listFilter })
                      )
                }
                {/* Sidebar marquee overlay */}
                {sidebarMarquee && (() => {
                  const mx1 = Math.min(sidebarMarquee.x1, sidebarMarquee.x2);
                  const my1 = Math.min(sidebarMarquee.y1, sidebarMarquee.y2);
                  const mw = Math.abs(sidebarMarquee.x2 - sidebarMarquee.x1);
                  const mh = Math.abs(sidebarMarquee.y2 - sidebarMarquee.y1);
                  if (mw < 2 && mh < 2) return null;
                  return (
                    <div
                      style={{
                        position: "fixed",
                        left: mx1, top: my1,
                        width: mw, height: mh,
                        border: "1.5px dashed rgba(99,102,241,0.7)",
                        backgroundColor: "rgba(99,102,241,0.08)",
                        pointerEvents: "none",
                        zIndex: 50,
                        borderRadius: 3,
                      }}
                    />
                  );
                })()}
              </div>

              {/* ── Legends panel (extracted) ── */}
              <IdeaBinLegendPanel
                dims={dims}
                legendPanelCollapsed={legendPanelCollapsed} setLegendPanelCollapsed={setLegendPanelCollapsed}
                showCreateLegend={showCreateLegend} setShowCreateLegend={setShowCreateLegend}
                newLegendName={newLegendName} setNewLegendName={setNewLegendName}
                editingLegendId={editingLegendId} setEditingLegendId={setEditingLegendId}
                editingLegendNameLocal={editingLegendNameLocal} setEditingLegendNameLocal={setEditingLegendNameLocal}
                globalTypeFilter={globalTypeFilter} setGlobalTypeFilter={setGlobalTypeFilter}
                legendFilters={legendFilters} setLegendFilters={setLegendFilters}
                filterCombineMode={filterCombineMode} setFilterCombineMode={setFilterCombineMode}
                stackedFilters={stackedFilters} setStackedFilters={setStackedFilters}
                stackCombineMode={stackCombineMode} setStackCombineMode={setStackCombineMode}
                handleTypeDrag={handleTypeDrag}
                editingTypeId={editingTypeId} setEditingTypeId={setEditingTypeId}
                editingTypeName={editingTypeName} setEditingTypeName={setEditingTypeName}
                showCreateType={showCreateType} setShowCreateType={setShowCreateType}
                newTypeColor={newTypeColor} setNewTypeColor={setNewTypeColor}
                newTypeName={newTypeName} setNewTypeName={setNewTypeName}
                legendsList={dims.legends}
                createCategoryFromFilter={createCategoryFromFilter}
                batchRemoveLegendType={batchRemoveLegendType}
                activeContext={activeContext}
                ideas={ideas}
                selectedIdeaIds={selectedIdeaIds}
                assign_idea_legend_type={assign_idea_legend_type}
                batch_assign_idea_legend_type={batch_assign_idea_legend_type}
                passesAllFilters={passesAllFilters}
                paintType={paintType}
                setPaintType={setPaintType}
                filterPresets={filterPresets}
                saveFilterPreset={saveFilterPreset}
                applyFilterPreset={applyFilterPreset}
                stackFilterPreset={stackFilterPreset}
                deleteFilterPreset={deleteFilterPreset}
                renameFilterPreset={renameFilterPreset}
                onLegendCreated={undefined}
              />
            </div>
            )}

            {/* ── Sidebar resize handle ── */}
            {showCategories && !leftCollapsed && !rightCollapsed && (
              <div className="relative flex-shrink-0" style={{ width: 6 }}>
                {/* Corner anchor — controls both form height AND sidebar width */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startW = sidebarWidth;
                    const startH = formHeight;
                    const onMove = (ev) => {
                      setSidebarWidth(Math.min(maxSidebarW, Math.max(MIN_SIDEBAR_W, startW + (ev.clientX - startX))));
                      setFormHeight(Math.min(MAX_FORM_H, Math.max(MIN_FORM_H, startH + (ev.clientY - startY))));
                    };
                    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                  className="absolute bg-gray-300 hover:bg-blue-500 transition-colors duration-150 z-10 rounded-sm"
                  style={{ width: 10, height: 10, left: -2, top: formHeight - 2, cursor: "nwse-resize" }}
                  title="Drag to resize form and sidebar"
                />
                {/* Normal horizontal resize strip */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startW = sidebarWidth;
                    const onMove = (ev) => {
                      const newW = Math.min(maxSidebarW, Math.max(MIN_SIDEBAR_W, startW + (ev.clientX - startX)));
                      setSidebarWidth(newW);
                    };
                    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                  className="w-full h-full bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-150"
                />
              </div>
            )}

            {/* ── RIGHT: Collapsed strip when category canvas is hidden ── */}
            {showCategories && rightCollapsed && !leftCollapsed && (
              <div className="flex flex-col items-center flex-shrink-0 bg-gray-50 border-l border-gray-200" style={{ width: COLLAPSED_STRIP_W, minWidth: COLLAPSED_STRIP_W, maxWidth: COLLAPSED_STRIP_W }}>
                <button
                  onClick={() => setRightCollapsed(false)}
                  className="mt-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Expand category canvas"
                >
                  <PanelRightOpen size={16} />
                </button>
              </div>
            )}

            {/* ── RIGHT: Category canvas (only when wide enough and not collapsed) ── */}
            {showCategories && !rightCollapsed && (
              <IdeaBinCategoryCanvas
                onCanvasMouseDown={() => setSidebarFocused(false)}
                onCollapseRight={() => setRightCollapsed(true)}
                showCollapseRight={!leftCollapsed}
                categoryContainerRef={categoryContainerRef}
                displayCategoryForm={displayCategoryForm} setDisplayCategoryForm={setDisplayCategoryForm}
                newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
                newCategoryPublic={newCategoryPublic} setNewCategoryPublic={setNewCategoryPublic}
                create_category_api={create_category_api}
                create_category_at={create_category_at}
                drawCategoryMode={drawCategoryMode} setDrawCategoryMode={setDrawCategoryMode}
                archivedCategories={archivedCategories}
                dockedCategories={dockedCategories} setDockedCategories={setDockedCategories}
                showArchive={showArchive} setShowArchive={setShowArchive}
                toggle_archive_category={toggle_archive_category}
                toggle_public_category={toggle_public_category}
                drop_adopted_category={drop_adopted_category}
                delete_category={delete_category}
                setConfirmModal={setConfirmModal}
                activeCategories={activeCategories}
                categoryOrders={categoryOrders}
                dragging={dragging}
                hoverCategory={hoverCategory}
                selectedCategoryIds={selectedCategoryIds} setSelectedCategoryIds={setSelectedCategoryIds}
                bring_to_front_category={bring_to_front_category}
                handleCategoryDrag={handleCategoryDrag}
                editingCategoryId={editingCategoryId} setEditingCategoryId={setEditingCategoryId}
                editingCategoryName={editingCategoryName} setEditingCategoryName={setEditingCategoryName}
                rename_category_api={rename_category_api}
                copiedIdeaId={copiedIdeaId}
                paste_idea={paste_idea}
                categorySettingsOpen={categorySettingsOpen} setCategorySettingsOpen={setCategorySettingsOpen}
                collapsedIdeas={collapsedIdeas} setCollapsedIdeas={setCollapsedIdeas}
                minimizedCategories={minimizedCategories} setMinimizedCategories={setMinimizedCategories}
                categories={categories} setCategories={setCategories}
                set_area_category={set_area_category}
                categoryRefs={categoryRefs}
                globalTypeFilter={globalTypeFilter}
                passesAllFilters={passesAllFilters}
                ideas={ideas} dims={dims}
                renderIdeaItem={renderIdeaItem}
                handleCategoryResize={handleCategoryResize}
                refactorMode={refactorMode}
                mergeCategoryTarget={mergeCategoryTarget}
                contextColor={activeContext?.color || null}
                headlineModeCategoryId={headlineModeCategoryId}
                setHeadlineModeCategoryId={setHeadlineModeCategoryId}
                headlineModeIdeaId={headlineModeIdeaId}
                setHeadlineModeIdeaId={setHeadlineModeIdeaId}
                update_idea_title_api={update_idea_title_api}
                selectedIdeaIds={selectedIdeaIds}
                setSelectedIdeaIds={setSelectedIdeaIds}
                refetchCategoryByFilter={refetchCategoryByFilter}
                toggleLiveCategory={toggleLiveCategory}
                requestToggleLive={requestToggleLive}
                liveCategoryIds={liveCategoryIds}
                setCategoryFilterConfig={setCategoryFilterConfig}
                detectCRConflicts={detectCRConflicts}
                setCrConflictData={setCrConflictData}
                crConflictsByCat={crConflictsByCat}
                legendFilters={legendFilters}
                filterCombineMode={filterCombineMode}
                filterPresets={filterPresets}
                globalTypeFilter={globalTypeFilter}
                paintType={paintType}
                setPaintType={setPaintType}
                assign_idea_legend_type={assign_idea_legend_type}
                batch_assign_idea_legend_type={batch_assign_idea_legend_type}
                showOrderNumbers={showOrderNumbers}
                setShowOrderNumbers={setShowOrderNumbers}
                onReformCategory={openReformCategory}
                onExportCategory={handleExportCategory}
                onImportCategory={() => setShowCategoryImport(true)}
                onInsertIdeas={(catKey) => {
                  const cat = categories[catKey];
                  setInsertIdeasTarget({ id: catKey, name: cat?.name || "Category" });
                }}
              />
            )}
            </>
            )}

            {/* ══════ CONTEXTS MODE ══════ */}
            {viewMode === "contexts" && (
              <IdeaBinContextView
                ref={contextViewRef}
                categories={categories}
                legends={dims.legends}
                showCanvas={showCategories}
                sidebarWidth={sidebarWidth}
                onCategoryCreated={fetch_categories}
                onEnterContext={enterContext}
              />
            )}
          </div>

          {/* ── Window resize grip (bottom-right) ── */}
          {!isMaximized && (
            <div
              onMouseDown={handleWindowResize}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 flex items-center justify-center"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400">
                <path d="M9 1L1 9M9 4L4 9M9 7L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* ── Paint mode cursor overlay ── */}
      {paintType && (
        <PaintCursorOverlay paintType={paintType} />
      )}

      {/* ── Drag ghosts (extracted) ── */}
      <IdeaBinDragGhosts dragging={dragging} externalGhost={externalGhost} draggingType={draggingType} selectedIdeaIds={selectedIdeaIds} />
    </>
  );
}

/**
 * Fixed-position cursor follower that shows the active paint type icon+color.
 * Renders a small badge next to the mouse cursor.
 */
function PaintCursorOverlay({ paintType }) {
  const posRef = useRef({ x: 0, y: 0 });
  const elRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (elRef.current) {
        elRef.current.style.left = `${e.clientX + 14}px`;
        elRef.current.style.top = `${e.clientY + 14}px`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    // Set cursor to crosshair on the whole document while in paint mode
    document.body.style.cursor = "crosshair";
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <div
      ref={elRef}
      className="fixed pointer-events-none z-[99999] flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-lg border border-gray-200 bg-white/90 backdrop-blur-sm"
      style={{ left: -100, top: -100 }}
    >
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200"
        style={{ backgroundColor: paintType.icon ? "transparent" : paintType.color }}
      >
        {paintType.icon && renderLegendTypeIcon(paintType.icon, { style: { fontSize: 12, color: paintType.color } })}
      </div>
      <span className="text-[9px] font-medium text-gray-600 whitespace-nowrap max-w-[80px] truncate">
        {paintType.name}
      </span>
    </div>
  );
}
