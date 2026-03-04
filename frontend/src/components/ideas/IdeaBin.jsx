import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";

import { Lightbulb, Copy, List, X, Settings, Paintbrush, RotateCcw, ArrowDownUp, BookOpenText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { BASE_URL } from "../../config/api";

import { playSound } from "../../assets/sound_registry";
import { useWindowManager } from "../shared/WindowManager";
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
import IdeaBinTitleBar from "./IdeaBinTitleBar";
import IdeaBinInputForm from "./IdeaBinInputForm";
import IdeaBinIOPopup from "./IdeaBinIOPopup";
import { useAuth } from "../../auth/AuthContext";

// Extracted hooks
import useIdeaBinCategories from "./hooks/useIdeaBinCategories";
import useIdeaBinIdeas from "./hooks/useIdeaBinIdeas";
import useIdeaBinFormations from "./hooks/useIdeaBinFormations";
import useIdeaBinDrag from "./hooks/useIdeaBinDrag";
import useIdeaBinDerivedState from "./hooks/useIdeaBinDerivedState";
import useIdeaBinKeyboard from "./hooks/useIdeaBinKeyboard";
import useIdeaBinContext from "./hooks/useIdeaBinContext";
import useIdeaBinTransform from "./hooks/useIdeaBinTransform.jsx";
import usePromptSettings from "../usePromptSettings";
import { IDEABIN_SCENARIOS, IDEABIN_GROUPS, assemblePrompt } from "../shared/promptEngine";

// Extracted API helpers

import { fetchContextsApi, assignCategoryToContextApi } from "./api/contextApi";
import { mergeIdeasApi, createIdeaApi, assignIdeaToCategoryApi, updateIdeaTitleApi, updateIdeaDescriptionApi, assignIdeaLegendTypeApi } from "./api/ideaApi";
import { authFetch, API } from "./api/authFetch";
import { exportIdeabinApi, importIdeabinApi, exportCategoryApi, exportMultipleCategoriesApi, importCategoryApi, insertIdeasIntoCategoryApi } from "./api/exportApi";
import { delete_task } from "../../api/dependencies_api";
import { deleteTeamForProject } from "../../api/org_API";
import { createCategoryApi, syncCategoryIdeas, renameCategoryApi } from "./api/categoryApi";
import { passesAllFiltersCheck } from "./ideaBinFilters";

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
  const { buildClipboardText, settings: promptSettings, settingsRef: promptSettingsRef, projectDescRef } = usePromptSettings();

  // ───── Window state (extracted) ─────
  const headlineInputRef = useRef(null);
  const {
    isOpen, setIsOpen,
    windowPos, setWindowPos, windowSize, setWindowSize,
    iconPos,
    isMaximized, setIsMaximized,
    zIndex, bringToFront,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag, handleWindowResize, handleEdgeResize,
    managed,
    setExtraStateCollector, setExtraStateApplier,
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

  // Ref so the formations hook can call enterContext (defined inside context hook)
  const enterContextRef = useRef(null);

  // ───── Context (extracted hook) ─────
  const {
    activeContext, setActiveContext,
    contextsList, setContextsList, showContextSelector, setShowContextSelector,
    showContextColorPicker, setShowContextColorPicker,
    lateRef: contextLateRef,
    fetch_contexts_for_selector,
    scrollCanvasToContextCategories,
    saveContextFilterState,
    enterContext, exitContext,
    updateActiveContextColor,
  } = useIdeaBinContext({
    setViewMode,
    setLegendFilters, setFilterCombineMode,
    setStackedFilters, setStackCombineMode,
    setGlobalTypeFilter, setFilterPresets,
    setLegendPanelCollapsed,
    enterContextRef,
  });

  // ───── Legends (context-scoped) ─────
  const dims = useLegends(activeContext?.id);

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

  // ───── Category export / import modals ─────
  const [categoryExportJson, setCategoryExportJson] = useState(null); // JSON object or null
  const [exportScenarioKey, setExportScenarioKey] = useState('ideabin_single_category');
  const [showCategoryImport, setShowCategoryImport] = useState(false);
  const [insertIdeasTarget, setInsertIdeasTarget] = useState(null); // { id, name } or null

  // ───── I/O Prompt panel ─────
  const [showIOPanel, setShowIOPanel] = useState(false);

  // Refs
  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});
  const contextViewRef = useRef(null);

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
  } = useIdeaBinCategories({ activeContext, setActiveContext, fetchAllIdeas: fetch_all_ideas, selectedCategoryIds, categoryOrders, ideas });

  // ── Transform / Reform hook ──
  const {
    transformModal, setTransformModal,
    transformName, setTransformName,
    transformTeamId, setTransformTeamId,
    transformTaskId, setTransformTaskId,
    transformTaskSearch, setTransformTaskSearch,
    projectTeams, projectTasks,
    transformLoading,
    openTransform, closeTransform,
    executeTransformToTask, executeTransformToMilestone,
    reformCategoryModal, setReformCategoryModal,
    reformLoading,
    openReformCategory, closeReformCategory, executeReformCategory,
  } = useIdeaBinTransform({
    projectId, ideas, categories, categoryOrders, selectedCategoryIds,
    setConfirmModal, fetch_all_ideas, delete_idea, delete_category,
  });

  // ── Pipeline: task → idea (listen for drops from TaskStructure) ──
  useEffect(() => {
    const handleTaskToIdea = async (e) => {
      const { taskId, name, description, acceptance_criteria } = e.detail || {};
      if (!name) return;
      try {
        // Build description: original + acceptance criteria as text
        let fullDesc = description || "";
        if (acceptance_criteria?.length) {
          const acLines = acceptance_criteria.map(c => `- ${c.title || c}`).join("\n");
          fullDesc = fullDesc ? `${fullDesc}\n\nAcceptance criteria:\n${acLines}` : `Acceptance criteria:\n${acLines}`;
        }
        await authFetch(`${API}/user/ideas/create/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea_name: name, description: fullDesc }),
        });
        if (taskId && projectId) await delete_task(projectId, taskId);
        playSound("ideaRefactor");
        fetch_all_ideas();
        // Notify TaskStructure to remove the task from state
        window.dispatchEvent(new CustomEvent("pipeline-delete-task", { detail: { taskId } }));
      } catch (err) {
        console.error("Pipeline task→idea failed:", err);
      }
    };
    const handleDeleteIdea = async (e) => {
      const { ideaId, placementId } = e.detail || {};
      if (ideaId) {
        try {
          await delete_idea(ideaId);
          fetch_all_ideas();
        } catch (err) {
          console.error("Pipeline delete idea failed:", err);
        }
      }
    };
    window.addEventListener("pipeline-task-to-idea", handleTaskToIdea);
    window.addEventListener("pipeline-delete-idea", handleDeleteIdea);
    return () => {
      window.removeEventListener("pipeline-task-to-idea", handleTaskToIdea);
      window.removeEventListener("pipeline-delete-idea", handleDeleteIdea);
    };
  }, [projectId, fetch_all_ideas, delete_idea]);

  // ── Pipeline: team → category (listen for drops from TaskStructure) ──
  useEffect(() => {
    const handleTeamToCategory = async (e) => {
      const { teamId, name, tasks: taskData } = e.detail || {};
      if (!name) return;
      try {
        // Create the category
        const data = await createCategoryApi(name, false);
        const catId = data?.category?.id;
        if (!catId) return;

        // If user is inside a context, assign category to that context
        if (activeContext?.id) {
          try {
            await assignCategoryToContextApi(catId, activeContext.id);
            setActiveContext(prev => prev ? { ...prev, category_ids: [...(prev.category_ids || []), catId] } : prev);
          } catch (err) { console.error("Pipeline assign category to context failed:", err); }
        }

        // Create ideas for each task that was in the team, placed directly into the category
        const createdIdeaIds = [];
        if (taskData?.length) {
          for (const t of taskData) {
            try {
              let fullDesc = t.description || "";
              if (t.acceptance_criteria?.length) {
                const acLines = t.acceptance_criteria.map(c => `- ${c.title || c}`).join("\n");
                fullDesc = fullDesc ? `${fullDesc}\n\nAcceptance criteria:\n${acLines}` : `Acceptance criteria:\n${acLines}`;
              }
              const res = await authFetch(`${API}/user/ideas/create/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idea_name: t.name,
                  description: fullDesc,
                  category_id: catId,
                  context_id: activeContext?.id || undefined,
                }),
              });
              const json = await res.json();
              if (json?.idea?.id) createdIdeaIds.push(json.idea.id);
            } catch (_) { /* skip individual failures */ }
          }
        }

        if (teamId && projectId) {
          window.dispatchEvent(new CustomEvent("pipeline-delete-team", { detail: { teamId } }));
        }
        playSound("ideaRefactor");
        await fetch_all_ideas();
        await fetch_categories();
      } catch (err) {
        console.error("Pipeline team→category failed:", err);
      }
    };
    const handleDeleteCategory = async (e) => {
      const { categoryId } = e.detail || {};
      if (categoryId) {
        try {
          await delete_category(categoryId);
          fetch_all_ideas();
        } catch (err) {
          console.error("Pipeline delete category failed:", err);
        }
      }
    };
    window.addEventListener("pipeline-team-to-category", handleTeamToCategory);
    window.addEventListener("pipeline-delete-category", handleDeleteCategory);
    return () => {
      window.removeEventListener("pipeline-team-to-category", handleTeamToCategory);
      window.removeEventListener("pipeline-delete-category", handleDeleteCategory);
    };
  }, [projectId, activeContext, setActiveContext, fetch_all_ideas, fetch_categories, delete_category]);

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

  // ── Formations hook ──
  const {
    formations,
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
    toggle_default_context,
    saveActiveFormation,
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

  // ── Wire formation state into workspace collector/applier ──
  useEffect(() => {
    setExtraStateCollector(() => collectFormationState());
    setExtraStateApplier((state) => applyFormationState(state));
  }, [collectFormationState, applyFormationState, setExtraStateCollector, setExtraStateApplier]);

  // ── Register view saver with WindowManager (for "xy" save shortcut) ──
  const _wm = useWindowManager();
  useEffect(() => {
    if (!_wm || !managed) return;
    _wm.registerViewSaver("ideaBin", saveActiveFormation);
    return () => _wm.unregisterViewSaver("ideaBin");
  }, [_wm, managed, saveActiveFormation]);

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

  // ── Keep context hook's lateRef in sync every render ──
  contextLateRef.current = {
    dims, categories, categoryContainerRef,
    legendFilters, filterCombineMode,
    stackedFilters, stackCombineMode,
    globalTypeFilter, legendPanelCollapsed, filterPresets,
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
  // ═══════════  I/O PROMPT ENGINE CONTEXT  ═══════════════
  // ═══════════════════════════════════════════════════════

  const ioCtx = useMemo(() => ({
    ideas,
    categories,
    categoryOrders,
    unassignedOrder,
    contextIdeaOrders,
    dims,
    selectedIdeaIds,
    selectedCategoryIds,
    legendFilters,
    filterCombineMode,
    stackedFilters,
    stackCombineMode,
    globalTypeFilter,
    filterPresets,
    activeContext,
    projectTeams: projectTeams || [],
    projectDescription: projectDescRef.current || "",
  }), [
    ideas, categories, categoryOrders, unassignedOrder, contextIdeaOrders, dims,
    selectedIdeaIds, selectedCategoryIds,
    legendFilters, filterCombineMode, stackedFilters, stackCombineMode,
    globalTypeFilter, filterPresets, activeContext, projectTeams,
    projectDescRef,
  ]);

  // Helper: create a legend type on any legend (bypasses active-legend restriction)
  const createTypeOnLegend = useCallback(async (legendId, name, color, icon = null) => {
    const res = await authFetch(`${API}/user/legends/${legendId}/types/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, ...(icon ? { icon } : {}) }),
    });
    return (await res.json()).type;
  }, []);

  // Context object with API functions for the response applier
  const applyCtx = useMemo(() => ({
    createIdea: createIdeaApi,
    importCategories: importCategoryApi,
    insertIdeas: insertIdeasIntoCategoryApi,
    createCategory: createCategoryApi,
    renameCategory: renameCategoryApi,
    createLegend: dims.create_legend,
    createTypeOnLegend,
    assignIdeaToCategory: assignIdeaToCategoryApi,
    assignCategoryToContext: assignCategoryToContextApi,
    updateIdeaTitle: updateIdeaTitleApi,
    updateIdeaDescription: updateIdeaDescriptionApi,
    assignLegendType: assignIdeaLegendTypeApi,
    setFilterPresets,
    refreshAll: async () => {
      await fetch_categories();
      await fetch_all_ideas();
      dims.fetch_legends?.(activeContext?.id);
    },
    activeContextId: activeContext?.id ?? null,
    ideas,
    categories,
    dims,
  }), [
    createTypeOnLegend, dims, ideas, categories, activeContext?.id,
    fetch_categories, fetch_all_ideas, setFilterPresets,
  ]);

  const ioPopupContent = useMemo(() => (
    showIOPanel ? (
      <IdeaBinIOPopup
        scenarios={IDEABIN_SCENARIOS}
        groups={IDEABIN_GROUPS}
        ctx={ioCtx}
        settings={promptSettingsRef.current}
        assemblePrompt={assemblePrompt}
        applyCtx={applyCtx}
        onClose={() => setShowIOPanel(false)}
        iconColor={activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e"}
      />
    ) : null
  ), [showIOPanel, ioCtx, applyCtx, activeContext?.color]);

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
      setExportScenarioKey('ideabin_single_category');
      setCategoryExportJson(data);
    } catch (e) {
      console.error("Category export failed", e);
      window.alert(`Export failed: ${e.message}`);
    }
  }, []);

  const handleExportSelectedCategories = useCallback(async () => {
    if (selectedCategoryIds.size === 0) return;
    try {
      const ids = [...selectedCategoryIds];
      const data = await exportMultipleCategoriesApi(ids);
      setExportScenarioKey('ideabin_multi_categories');
      setCategoryExportJson(data);
    } catch (e) {
      console.error("Multi-category export failed", e);
      window.alert(`Export failed: ${e.message}`);
    }
  }, [selectedCategoryIds]);

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

  // ── Context-aware derived state (extracted) ──
  const {
    effectiveUnassignedOrder, effectiveUnassignedCount,
    effectiveMetaIdeaList, effectiveCategoryOrders,
  } = useIdeaBinDerivedState({
    activeContext, contextIdeaOrders, ideas,
    unassignedOrder, metaIdeaList, categoryOrders,
  });

  // ── Idea filter (delegates to pure utility in ideaBinFilters.js) ──
  const passesAllFilters = useCallback((idea) => {
    return passesAllFiltersCheck(idea, {
      legendFilters, filterCombineMode,
      stackedFilters, stackCombineMode,
      globalTypeFilter,
      activeLegendId: dims.activeLegendId,
    });
  }, [legendFilters, filterCombineMode, stackedFilters, stackCombineMode, globalTypeFilter, dims.activeLegendId]);

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
      {/* ───── COLLAPSED: Floating icon (hidden when managed — InventoryBar owns icons) ───── */}
      {!isOpen && !managed && (
        <div
          ref={iconRef}
          onMouseDown={handleIconDrag}
          style={{
            position: "fixed",
            left: iconPos.x,
            top: iconPos.y,
            zIndex: zIndex,
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
          onMouseDown={bringToFront}
          style={{
            position: "fixed",
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.w,
            height: windowSize.h,
            zIndex: zIndex,
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
          <IdeaBinTitleBar
            handleWindowDrag={handleWindowDrag} toggleMaximize={toggleMaximize}
            isMaximized={isMaximized} minimizeWindow={minimizeWindow}
            activeContext={activeContext}
            showContextSelector={showContextSelector} setShowContextSelector={setShowContextSelector}
            fetch_contexts_for_selector={fetch_contexts_for_selector}
            contextsList={contextsList} setContextsList={setContextsList}
            enterContext={enterContext} exitContext={exitContext} toggle_default_context={toggle_default_context}
            showContextColorPicker={showContextColorPicker} setShowContextColorPicker={setShowContextColorPicker}
            updateActiveContextColor={updateActiveContextColor}
            effectiveUnassignedCount={effectiveUnassignedCount} viewMode={viewMode}
            showMetaList={showMetaList} setShowMetaList={setShowMetaList}
            copiedIdeaId={copiedIdeaId} paste_idea={paste_idea}
            selectedCategoryIds={selectedCategoryIds} categories={categories}
            showFormationPanel={showFormationPanel} setShowFormationPanel={setShowFormationPanel}
            formations={formations} formationName={formationName} setFormationName={setFormationName}
            editingFormationId={editingFormationId} setEditingFormationId={setEditingFormationId}
            editingFormationName={editingFormationName} setEditingFormationName={setEditingFormationName}
            save_formation={save_formation} update_formation_state={update_formation_state}
            rename_formation={rename_formation} load_formation={load_formation}
            delete_formation={delete_formation} toggle_default_formation={toggle_default_formation}
            showIOPanel={showIOPanel} setShowIOPanel={setShowIOPanel}
            ioPopupContent={ioPopupContent}
          />

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
            selectedCategoryCount={selectedCategoryIds.size}
            onExportSelectedCategories={handleExportSelectedCategories}
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
                buildClipboardText={buildClipboardText}
                scenarioKey={exportScenarioKey}
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
              <IdeaBinInputForm
                editFormRef={editFormRef} headlineInputRef={headlineInputRef} formHeight={formHeight}
                editingIdeaId={editingIdeaId} setEditingIdeaId={setEditingIdeaId}
                editingIdeaTitle={editingIdeaTitle} setEditingIdeaTitle={setEditingIdeaTitle}
                editingIdeaDescription={editingIdeaDescription} setEditingIdeaDescription={setEditingIdeaDescription}
                ideaName={ideaName} setIdeaName={setIdeaName}
                newIdeaDescription={newIdeaDescription} setNewIdeaDescription={setNewIdeaDescription}
                editFormTitleMode={editFormTitleMode} setEditFormTitleMode={setEditFormTitleMode}
                createFormTitleMode={createFormTitleMode} setCreateFormTitleMode={setCreateFormTitleMode}
                editFormOrderMode={editFormOrderMode} setEditFormOrderMode={setEditFormOrderMode}
                createFormOrderMode={createFormOrderMode} setCreateFormOrderMode={setCreateFormOrderMode}
                selectedCategoryIds={selectedCategoryIds} setSelectedCategoryIds={setSelectedCategoryIds}
                categories={categories}
                update_idea_title_api={update_idea_title_api} create_idea={create_idea}
              />

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
