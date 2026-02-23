import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { Lightbulb, Minus, Maximize2, Minimize2, Copy, List, X, Settings, Layers, Save, FolderOpen, Trash2, Pencil, Check, Palette, ChevronDown, Star, Paintbrush } from "lucide-react";
import { BASE_URL } from "../../config/api";
import { createTaskForProject, fetchTeamsForProject } from "../../api/org_API";
import { add_milestone, fetch_project_tasks, delete_task, delete_team, delete_milestone } from "../../api/dependencies_api";
import { playSound } from "../../assets/sound_registry";
import { useLegends } from "./useLegends";
import { renderLegendTypeIcon } from "./legendTypeIcons";
import IdeaBinConfirmModal from "./IdeaBinConfirmModal";
import useIdeaBinWindow from "./useIdeaBinWindow";
import IdeaBinTransformModal from "./IdeaBinTransformModal";
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
import { fetchContextsApi, saveContextFilterStateApi, setContextColorApi, assignLegendToContextApi } from "./api/contextApi";

// ───────────────────── Constants ─────────────────────
const CATEGORY_THRESHOLD = 560; // show categories when wider than this
const MIN_SIDEBAR_W = 180;
const MAX_SIDEBAR_W = 400;

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

  // ───── Legends ─────
  const dims = useLegends();
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

  // ───── View mode ─────
  const [viewMode, setViewMode] = useState("ideas"); // "ideas" | "contexts"

  // ───── Active context (entered context mode) ─────
  const [activeContext, setActiveContext] = useState(null); // null or {id, name, color, category_ids, legend_ids}
  const [showContextColorPicker, setShowContextColorPicker] = useState(false);
  const [contextsList, setContextsList] = useState([]); // [{id, name, color, category_ids, legend_ids}, ...]
  const [showContextSelector, setShowContextSelector] = useState(false);

  // ───── Headline mode ─────
  const [headlineModeCategoryId, setHeadlineModeCategoryId] = useState(null); // catKey or null
  const [headlineModeIdeaId, setHeadlineModeIdeaId] = useState(null); // placement id or null

  // ───── Paint mode (legend type brush) ─────
  // null or { typeId, color, icon, name }  – when set, clicking an idea paints it with this type
  const [paintType, setPaintType] = useState(null);

  // ───── List view filter ─────
  const [listFilter, setListFilter] = useState("all"); // "all" | "unassigned" | category id
  const [showListFilterDropdown, setShowListFilterDropdown] = useState(false);
  const [showSidebarMeta, setShowSidebarMeta] = useState(false);   // show meta info in sidebar
  const [sidebarHeadlineOnly, setSidebarHeadlineOnly] = useState(false); // collapse all in sidebar
  const [showListSettings, setShowListSettings] = useState(false); // settings dropdown

  // ───── Sidebar resize ─────
  const [sidebarWidth, setSidebarWidth] = useState(240);

  // ───── Archive ─────
  const [showArchive, setShowArchive] = useState(false);

  // ───── Transform modal ─────
  const [transformModal, setTransformModal] = useState(null); // { idea, step: 'choose' | 'task' | 'milestone' }
  const [transformName, setTransformName] = useState("");
  const [transformTeamId, setTransformTeamId] = useState(null);
  const [transformTaskId, setTransformTaskId] = useState(null);
  const [transformTaskSearch, setTransformTaskSearch] = useState("");
  const [projectTeams, setProjectTeams] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [transformLoading, setTransformLoading] = useState(false);

  // Refs
  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});
  const contextViewRef = useRef(null);

  const showCategories = windowSize.w >= CATEGORY_THRESHOLD;

  // ═══════════════════════════════════════════════════════
  // ═══════════  HOOKS  ═══════════════════════════════════
  // ═══════════════════════════════════════════════════════

  // ── Ideas hook ──
  const {
    ideas, setIdeas,
    unassignedOrder, setUnassignedOrder,
    categoryOrders, setCategoryOrders,
    ideaName, setIdeaName,
    ideaHeadline, setIdeaHeadline,
    editingIdeaId, setEditingIdeaId,
    editingIdeaTitle, setEditingIdeaTitle,
    editingIdeaHeadline, setEditingIdeaHeadline,
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
    batchRemoveLegendType,
    toggle_upvote,
    fetch_comments,
    add_comment,
    delete_comment,
    fetch_meta_ideas,
  } = useIdeaBinIdeas({ selectedCategoryIds });

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
    liveCategoryIds,
    setCategoryFilterConfig,
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
    copiedIdeaId, selectedCategoryIds, paste_idea,
    selectedIdeaIds, setSelectedIdeaIds, ideas, categories,
    headlineModeCategoryId, setHeadlineModeCategoryId,
    headlineModeIdeaId, setHeadlineModeIdeaId,
    delete_idea, remove_idea_from_category,
    setConfirmModal,
    paintType, setPaintType,
  });

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
  } = useIdeaBinFormations({
    windowPos, windowSize, isMaximized, viewMode, sidebarWidth,
    sidebarHeadlineOnly, showSidebarMeta, listFilter, showArchive,
    dims, legendPanelCollapsed, globalTypeFilter, legendFilters,
    filterCombineMode, activeContext, minimizedCategories,
    collapsedIdeas, selectedCategoryIds, showMetaList, dockedCategories,
    categories, contextViewRef,
    setWindowPos, setWindowSize, setIsMaximized, setViewMode,
    setSidebarWidth, setSidebarHeadlineOnly, setShowSidebarMeta,
    setListFilter, setShowArchive, setLegendPanelCollapsed,
    setGlobalTypeFilter, setLegendFilters, setFilterCombineMode,
    setActiveContext, setMinimizedCategories, setCollapsedIdeas,
    setSelectedCategoryIds, setShowMetaList, setDockedCategories,
    setCategories,
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

  // ── Enter / exit context mode ──
  const saveContextFilterState = async (contextId, filters, combineMode, presets) => {
    try {
      await saveContextFilterStateApi(contextId, {
        legend_filters: filters,
        filter_combine_mode: combineMode,
        filter_presets: presets || [],
      });
    } catch (e) { console.error("Failed to save context filter state", e); }
  };
  const enterContext = async (ctx) => {
    // ctx = {id, name, color, category_ids, legend_ids, filter_state}
    // Save current context's filter state before switching
    if (activeContext) {
      saveContextFilterState(activeContext.id, legendFilters, filterCombineMode, filterPresets);
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
    // Restore filter state from the entered context
    if (ctx.filter_state) {
      setLegendFilters(ctx.filter_state.legend_filters || []);
      setFilterCombineMode(ctx.filter_state.filter_combine_mode || "and");
      setFilterPresets(ctx.filter_state.filter_presets || []);
      setGlobalTypeFilter([]);
    } else {
      setLegendFilters([]);
      setFilterCombineMode("and");
      setFilterPresets([]);
      setGlobalTypeFilter([]);
    }
  };
  const exitContext = () => {
    // Save current context's filter state before exiting
    if (activeContext) {
      saveContextFilterState(activeContext.id, legendFilters, filterCombineMode, filterPresets);
    }
    setActiveContext(null);
    setLegendFilters([]);
    setFilterCombineMode("and");
    setFilterPresets([]);
    setGlobalTypeFilter([]);
  };
  const updateActiveContextColor = async (color) => {
    if (!activeContext) return;
    setActiveContext(prev => ({ ...prev, color }));
    try {
      await setContextColorApi(activeContext.id, color);
    } catch (err) { console.error("IdeaBin: set context color failed", err); }
  };

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

  // ── Live filter: periodically refetch categories that have live mode on ──
  useEffect(() => {
    if (liveCategoryIds.size === 0) return;
    const interval = setInterval(() => {
      for (const catKey of liveCategoryIds) {
        refetchCategoryByFilter(catKey, ideas);
      }
    }, 5000); // every 5 seconds
    return () => clearInterval(interval);
  }, [liveCategoryIds, ideas, refetchCategoryByFilter]);

  // ── Auto-save filter state when filters change while inside a context ──
  useEffect(() => {
    if (!activeContext) return;
    const timer = setTimeout(() => {
      saveContextFilterState(activeContext.id, legendFilters, filterCombineMode, filterPresets);
    }, 600);
    return () => clearTimeout(timer);
  }, [legendFilters, filterCombineMode, filterPresets]);

  // ── Filter preset management ──
  const saveFilterPreset = (name) => {
    if (!activeContext) return;
    const preset = {
      name: name || `Filter ${new Date().toLocaleString()}`,
      legend_filters: JSON.parse(JSON.stringify(legendFilters)),
      filter_combine_mode: filterCombineMode,
    };
    setFilterPresets(prev => [...prev, preset]);
  };
  const applyFilterPreset = (preset) => {
    setLegendFilters(JSON.parse(JSON.stringify(preset.legend_filters)));
    setFilterCombineMode(preset.filter_combine_mode || "and");
  };
  const stackFilterPreset = (preset) => {
    // Merge preset rules into current filters (additive / stackable)
    setLegendFilters(prev => {
      const merged = [...prev];
      for (const rule of (preset.legend_filters || [])) {
        const existingIdx = merged.findIndex(r => r.legendId === rule.legendId);
        if (existingIdx >= 0) {
          // Merge typeIds (union)
          const existing = merged[existingIdx];
          const unionIds = [...new Set([...existing.typeIds, ...rule.typeIds])];
          merged[existingIdx] = { ...existing, typeIds: unionIds, mode: rule.mode };
        } else {
          merged.push(JSON.parse(JSON.stringify(rule)));
        }
      }
      return merged;
    });
  };
  const deleteFilterPreset = (index) => {
    setFilterPresets(prev => prev.filter((_, i) => i !== index));
  };
  const renameFilterPreset = (index, newName) => {
    setFilterPresets(prev => prev.map((p, i) => i === index ? { ...p, name: newName } : p));
  };

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
                  headline: mName,
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
                  headline: tName,
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
                  headline: teamName,
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
    setTransformName(idea.headline || idea.title.split(/\s+/).slice(0, 6).join(" "));
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
        description: transformModal.idea.title,
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
        description: transformModal.idea.title,
      });
      await delete_idea(transformModal.idea.id);
      playSound('ideaTransform');
      closeTransform();
    } catch (err) {
      console.error("Transform to milestone failed:", err);
      setTransformLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  RENDER HELPERS  ══════════════════════════
  // ═══════════════════════════════════════════════════════

  const renderIdeaItem = (ideaId, arrayIndex, source) => (
    <IdeaBinIdeaCard
      key={`idea_${ideaId}`}
      ideaId={ideaId} arrayIndex={arrayIndex} source={source}
      ideas={ideas} dims={dims} draggingType={draggingType}
      dragSource={dragSource} hoverIndex={hoverIndex} prevIndex={prevIndex}
      editingIdeaId={editingIdeaId} setEditingIdeaId={setEditingIdeaId}
      setEditingIdeaTitle={setEditingIdeaTitle} setEditingIdeaHeadline={setEditingIdeaHeadline}
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

  // Filtered legends for legend panel when inside a context
  const filteredLegends = activeContext
    ? dims.legends.filter(l => (activeContext.legend_ids || []).includes(l.id))
    : dims.legends;

  // ── Advanced idea filter (multi-legend, stackable, AND/OR, include/exclude) ──
  const hasLegendFilters = legendFilters.length > 0;
  const passesLegendFilters = useCallback((idea) => {
    if (!idea) return false;
    if (legendFilters.length === 0) return true;

    const results = legendFilters.map(f => {
      const legId = String(f.legendId);
      const dt = idea.legend_types?.[legId];
      const typeId = dt?.legend_type_id;
      const hasType = !!dt;
      // Does the idea's type for this legend match any of the selected typeIds?
      const matchesSelected = f.typeIds.includes("unassigned")
        ? (!hasType || f.typeIds.includes(typeId))
        : (hasType && f.typeIds.includes(typeId));

      return f.mode === "exclude" ? !matchesSelected : matchesSelected;
    });

    // Combine results with AND/OR
    return filterCombineMode === "and"
      ? results.every(Boolean)
      : results.some(Boolean);
  }, [legendFilters, filterCombineMode]);

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
          {unassignedCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow border border-white">
              {unassignedCount > 9 ? "9+" : unassignedCount}
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
                        <button
                          key={ctx.id}
                          onClick={() => { enterContext(ctx); setShowContextSelector(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                            activeContext?.id === ctx.id ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200"
                            style={{ backgroundColor: ctx.color || "#94a3b8" }}
                          />
                          <span className="truncate">{ctx.name}</span>
                        </button>
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

              {unassignedCount > 0 && viewMode === "ideas" && (
                <span
                  className="text-[10px] px-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 20%, transparent)` : "rgba(217,119,6,0.2)",
                    color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 70%, #333)` : "#92400e",
                  }}
                >
                  {unassignedCount}
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
                      <div className="px-3 pb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Formations</div>
                      {/* Save new */}
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
          />

          {/* ── Content area ── */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Confirm modal overlay */}
            {confirmModal && (
              <IdeaBinConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} middleLabel={confirmModal.middleLabel} middleColor={confirmModal.middleColor} onMiddle={confirmModal.onMiddle} />
            )}

            {/* ── Meta Ideas list overlay ── */}
            {showMetaList && (
              <>
                <div className="absolute inset-0 bg-black/20 z-[48]" onClick={() => setShowMetaList(false)} />
                <div className="absolute inset-2 bg-white rounded-lg shadow-2xl z-[49] flex flex-col overflow-hidden border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <List size={14} /> All Ideas ({metaIdeaList.length})
                    </span>
                    <button onClick={() => setShowMetaList(false)} className="text-white/80 hover:text-white text-sm font-bold">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {metaIdeaList.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No ideas yet</p>
                    )}
                    {metaIdeaList.map((idea, idx) => renderIdeaItem(idea.id, idx, { type: "meta" }))}
                  </div>
                </div>
              </>
            )}

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

            {/* ══════ IDEAS MODE ══════ */}
            {viewMode === "ideas" && (
            <>
            {/* ── LEFT: Sidebar (always visible) ── */}
            <div
              className="flex flex-col flex-shrink-0 bg-white"
              style={{ width: showCategories ? sidebarWidth : "100%" }}
            >
              {/* ── Input form ── */}
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-xs font-semibold text-gray-500 mb-1.5">
                  {editingIdeaId ? "Edit Idea" : "New Idea"}
                </h2>
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
                <TextField
                  inputRef={headlineInputRef}
                  value={editingIdeaId ? editingIdeaHeadline : ideaHeadline}
                  onChange={(e) => {
                    if (editingIdeaId) setEditingIdeaHeadline(e.target.value);
                    else setIdeaHeadline(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (editingIdeaId) {
                        update_idea_title_api(editingIdeaId, editingIdeaTitle || editingIdeaHeadline, editingIdeaHeadline);
                        setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline("");
                      } else { create_idea(); }
                    } else if (e.key === "Escape" && editingIdeaId) {
                      setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline("");
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  label="Headline (optional)"
                  variant="outlined"
                  size="small"
                  fullWidth
                  sx={{ backgroundColor: "white", borderRadius: 1, marginBottom: 0.5, "& .MuiInputLabel-root": { fontSize: 11 }, "& .MuiInputLabel-shrink": { fontSize: 12 }, "& .MuiInputBase-input": { fontSize: 12, padding: "6px 10px", caretColor: "#1f2937", color: "#1f2937" } }}
                />
                <TextField
                  value={editingIdeaId ? editingIdeaTitle : ideaName}
                  onChange={(e) => {
                    if (editingIdeaId) setEditingIdeaTitle(e.target.value);
                    else setIdeaName(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (editingIdeaId) {
                        update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
                        setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline("");
                      } else { create_idea(); }
                    } else if (e.key === "Escape" && editingIdeaId) {
                      setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline("");
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  label={editingIdeaId ? "Edit your idea..." : "What's your idea?"}
                  variant="outlined"
                  multiline
                  minRows={2}
                  maxRows={20}
                  fullWidth
                  sx={{
                    backgroundColor: "white", borderRadius: 1,
                    "& .MuiInputBase-root": { resize: "vertical", overflow: "auto", maxHeight: 400, alignItems: "flex-start" },
                    "& .MuiInputBase-input": { fontSize: 12, caretColor: "#1f2937", color: "#1f2937" },
                  }}
                />
                <div className="flex gap-1.5 mt-1.5">
                  {editingIdeaId ? (
                    <>
                      <button
                        onClick={() => {
                          update_idea_title_api(editingIdeaId, editingIdeaTitle, editingIdeaHeadline);
                          setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline("");
                        }}
                        className="px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px]"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => { setEditingIdeaId(null); setEditingIdeaTitle(""); setEditingIdeaHeadline(""); }}
                        className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-[11px]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    (ideaName.trim() || ideaHeadline.trim()) && (
                      <button
                        onClick={create_idea}
                        className="px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 text-[11px]"
                      >
                        Create{selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` → ${categories[[...selectedCategoryIds][0]].name}` : ""}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ── Ideas list (switchable) ── */}
              <div
                ref={IdeaListRef}
                data-idea-list
                style={{
                  backgroundColor: dragging && hoverUnassigned ? "#f3f4f6" : "#ffffff",
                  transition: "background-color 150ms ease",
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
                        ? `All Ideas (${metaIdeaList.length})`
                        : listFilter === "unassigned"
                        ? `Unassigned (${unassignedCount})`
                        : `${categories[listFilter]?.name || "Category"} (${(categoryOrders[listFilter] || []).length})`
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
                          All Ideas ({metaIdeaList.length})
                        </div>
                        <div
                          onClick={() => { setListFilter("unassigned"); setShowListFilterDropdown(false); }}
                          className={`px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors ${listFilter === "unassigned" ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                        >
                          Unassigned ({unassignedCount})
                        </div>
                        {Object.entries(categories).map(([catKey, catData]) => (
                          <div
                            key={catKey}
                            onClick={() => { setListFilter(catKey); setShowListFilterDropdown(false); }}
                            className={`px-2.5 py-1.5 text-[11px] cursor-pointer transition-colors flex items-center gap-1.5 ${String(listFilter) === String(catKey) ? "bg-amber-100 text-amber-800 font-medium" : "hover:bg-gray-50 text-gray-700"}`}
                          >
                            {catData.archived && <span className="text-[9px] text-gray-400">📦</span>}
                            {catData.name} ({(categoryOrders[catKey] || []).length})
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Idea items for current filter */}
                {listFilter === "all"
                  ? metaIdeaList
                      .filter(idea => passesAllFilters(idea))
                      .map((idea, idx) => renderIdeaItem(idea.id, idx, { type: "all" }))
                  : listFilter === "unassigned"
                  ? unassignedOrder
                      .filter(ideaId => passesAllFilters(ideas[ideaId]))
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "unassigned" }))
                  : (categoryOrders[listFilter] || [])
                      .filter(ideaId => passesAllFilters(ideas[ideaId]))
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "category", id: listFilter }))
                }              </div>

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
                handleTypeDrag={handleTypeDrag}
                editingTypeId={editingTypeId} setEditingTypeId={setEditingTypeId}
                editingTypeName={editingTypeName} setEditingTypeName={setEditingTypeName}
                showCreateType={showCreateType} setShowCreateType={setShowCreateType}
                newTypeColor={newTypeColor} setNewTypeColor={setNewTypeColor}
                newTypeName={newTypeName} setNewTypeName={setNewTypeName}
                legendsList={activeContext ? filteredLegends : undefined}
                createCategoryFromFilter={createCategoryFromFilter}
                batchRemoveLegendType={batchRemoveLegendType}
                activeContext={activeContext}
                ideas={ideas}
                selectedIdeaIds={selectedIdeaIds}
                assign_idea_legend_type={assign_idea_legend_type}
                passesAllFilters={passesAllFilters}
                paintType={paintType}
                setPaintType={setPaintType}
                filterPresets={filterPresets}
                saveFilterPreset={saveFilterPreset}
                applyFilterPreset={applyFilterPreset}
                stackFilterPreset={stackFilterPreset}
                deleteFilterPreset={deleteFilterPreset}
                renameFilterPreset={renameFilterPreset}
                onLegendCreated={activeContext ? async () => {
                  // After legend creation, assign the newest legend to the active context
                  const latest = dims.legends[dims.legends.length - 1];
                  if (latest) {
                    try {
                      await assignLegendToContextApi(latest.id, activeContext.id);
                      setActiveContext(prev => prev ? { ...prev, legend_ids: [...(prev.legend_ids || []), latest.id] } : prev);
                    } catch (err) { console.error("Auto-assign legend to context failed", err); }
                  }
                } : undefined}
              />
            </div>

            {/* ── Sidebar resize handle ── */}
            {showCategories && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startW = sidebarWidth;
                  const onMove = (ev) => {
                    const newW = Math.min(MAX_SIDEBAR_W, Math.max(MIN_SIDEBAR_W, startW + (ev.clientX - startX)));
                    setSidebarWidth(newW);
                  };
                  const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
                className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-150"
              />
            )}

            {/* ── RIGHT: Category canvas (only when wide enough) ── */}
            {showCategories && (
              <IdeaBinCategoryCanvas
                categoryContainerRef={categoryContainerRef}
                displayCategoryForm={displayCategoryForm} setDisplayCategoryForm={setDisplayCategoryForm}
                newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
                newCategoryPublic={newCategoryPublic} setNewCategoryPublic={setNewCategoryPublic}
                create_category_api={create_category_api}
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
                liveCategoryIds={liveCategoryIds}
                setCategoryFilterConfig={setCategoryFilterConfig}
                legendFilters={legendFilters}
                filterCombineMode={filterCombineMode}
                globalTypeFilter={globalTypeFilter}
                paintType={paintType}
                setPaintType={setPaintType}
                assign_idea_legend_type={assign_idea_legend_type}
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
