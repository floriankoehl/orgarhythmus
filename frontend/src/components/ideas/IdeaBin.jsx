import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { Lightbulb, Minus, Maximize2, Minimize2, Copy, List, X } from "lucide-react";
import { BASE_URL } from "../../config/api";
import { createTaskForProject, fetchTeamsForProject } from "../../api/org_API";
import { add_milestone, fetch_project_tasks, delete_task, delete_team, delete_milestone } from "../../api/dependencies_api";
import { playSound } from "../../assets/sound_registry";
import { useDimensions } from "./useDimensions";
import IdeaBinConfirmModal from "./IdeaBinConfirmModal";
import useIdeaBinWindow from "./useIdeaBinWindow";
import IdeaBinTransformModal from "./IdeaBinTransformModal";
import IdeaBinDimensionPanel from "./IdeaBinDimensionPanel";
import IdeaBinDragGhosts from "./IdeaBinDragGhosts";
import IdeaBinIdeaCard from "./IdeaBinIdeaCard";
import IdeaBinCategoryCanvas from "./IdeaBinCategoryCanvas";

// ───────────────────── Constants ─────────────────────
const MIN_W = 290;
const MIN_H = 220;
const DEFAULT_W = 340;
const DEFAULT_H = 460;
const CATEGORY_THRESHOLD = 560; // show categories when wider than this
const MIN_SIDEBAR_W = 180;
const MAX_SIDEBAR_W = 400;

function authFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════  IDEA BIN COMPONENT  ═════════════════
// ═══════════════════════════════════════════════════════════
export default function IdeaBin() {
  const { projectId } = useParams();   // optional — only present inside a project
  const API = `${BASE_URL}/api`;

  // ───── Window state (extracted) ─────
  const headlineInputRef = useRef(null);
  const {
    isOpen, setIsOpen,
    windowPos, windowSize,
    iconPos,
    isMaximized,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag, handleWindowResize, handleEdgeResize,
  } = useIdeaBinWindow(headlineInputRef);

  // ───── Category state ─────
  const [categories, setCategories] = useState({});
  const [displayCategoryForm, setDisplayCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const categoryContainerRef = useRef(null);

  // ───── Idea state ─────
  const [ideas, setIdeas] = useState({});
  const [unassignedOrder, setUnassignedOrder] = useState([]);
  const [categoryOrders, setCategoryOrders] = useState({});
  const [ideaName, setIdeaName] = useState("");
  const [ideaHeadline, setIdeaHeadline] = useState("");

  // ───── Collapse state ─────
  const [collapsedIdeas, setCollapsedIdeas] = useState({});
  const [minimizedCategories, setMinimizedCategories] = useState({});
  const [ideaSettingsOpen, setIdeaSettingsOpen] = useState(null); // ideaId or null

  // ───── Wiggle state ─────
  const [wigglingIdeaId, setWigglingIdeaId] = useState(null); // idea_id (meta) to wiggle

  // ───── Drag state ─────
  const [dragging, setDragging] = useState(null);
  const [dragSource, setDragSource] = useState(null);
  const [prevIndex, setPrevIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverCategory, setHoverCategory] = useState(null);
  const [hoverUnassigned, setHoverUnassigned] = useState(false);

  // ───── Edit state ─────
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");
  const [editingIdeaHeadline, setEditingIdeaHeadline] = useState("");

  // ───── Confirm modal ─────
  const [confirmModal, setConfirmModal] = useState(null);

  // ───── Transform modal ─────
  const [transformModal, setTransformModal] = useState(null); // { idea, step: 'choose' | 'task' | 'milestone' }
  const [transformName, setTransformName] = useState("");
  const [transformTeamId, setTransformTeamId] = useState(null);
  const [transformTaskId, setTransformTaskId] = useState(null);
  const [transformTaskSearch, setTransformTaskSearch] = useState("");
  const [projectTeams, setProjectTeams] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [transformLoading, setTransformLoading] = useState(false);

  // ───── Archive ─────
  const [showArchive, setShowArchive] = useState(false);

  // ───── List view filter ─────
  const [listFilter, setListFilter] = useState("all"); // "all" | "unassigned" | category id
  const [showListFilterDropdown, setShowListFilterDropdown] = useState(false);
  const [showSidebarMeta, setShowSidebarMeta] = useState(false);   // show meta info in sidebar
  const [sidebarHeadlineOnly, setSidebarHeadlineOnly] = useState(false); // collapse all in sidebar

  // ───── Sidebar resize ─────
  const [sidebarWidth, setSidebarWidth] = useState(240);

  // ───── Selected category for paste ─────
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  // ───── Category settings dropdown ─────
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(null); // catKey or null

  // ───── Dimensions (replaces per-project legend) ─────
  const dims = useDimensions();
  const [dimPanelCollapsed, setDimPanelCollapsed] = useState(true);
  const [showCreateDimension, setShowCreateDimension] = useState(false);
  const [newDimensionName, setNewDimensionName] = useState("");
  const [editingDimensionId, setEditingDimensionId] = useState(null);
  const [editingDimensionNameLocal, setEditingDimensionNameLocal] = useState("");
  const [showCreateLegend, setShowCreateLegend] = useState(false);
  const [newLegendColor, setNewLegendColor] = useState("#6366f1");
  const [newLegendName, setNewLegendName] = useState("");
  const [editingLegendId, setEditingLegendId] = useState(null);
  const [editingLegendName, setEditingLegendName] = useState("");
  const [globalTypeFilter, setGlobalTypeFilter] = useState([]);
  const [draggingLegend, setDraggingLegend] = useState(null);
  const [hoverIdeaForLegend, setHoverIdeaForLegend] = useState(null);

  // Refs
  const IdeaListRef = useRef(null);
  const categoryRefs = useRef({});
  const ideaRefs = useRef({});

  const showCategories = windowSize.w >= CATEGORY_THRESHOLD;

  // ═══════════════════════════════════════════════════════
  // ═══════════  CATEGORY API  ════════════════════════════
  // ═══════════════════════════════════════════════════════

  const fetch_categories = async () => {
    try {
      const res = await authFetch(`${API}/user/categories/`);
      const data = await res.json();
      const all = data.categories || [];
      const serialized = {};
      for (const c of all) {
        const minW = Math.max(80, c.name.length * 9 + 60);
        serialized[c.id] = {
          id: c.id, name: c.name, x: c.x, y: c.y,
          width: Math.max(c.width, minW), height: c.height,
          z_index: c.z_index || 0, archived: c.archived || false,
        };
      }
      setCategories(serialized);
    } catch (err) { console.error("IdeaBin: fetch categories failed", err); }
  };

  const create_category_api = async () => {
    if (!newCategoryName.trim()) return;
    await authFetch(`${API}/user/categories/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    setNewCategoryName("");
    setDisplayCategoryForm(false);
    playSound('ideaCategoryCreate');
    fetch_categories();
  };

  const set_position_category = async (id, pos) => {
    await authFetch(`${API}/user/categories/set_position/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, position: pos }),
    });
  };

  const set_area_category = async (id, width, height) => {
    await authFetch(`${API}/user/categories/set_area/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, width, height }),
    });
  };

  const bring_to_front_category = async (id) => {
    await authFetch(`${API}/user/categories/bring_to_front/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCategories(prev => {
      const maxZ = Math.max(0, ...Object.values(prev).map(c => c.z_index || 0));
      return { ...prev, [id]: { ...prev[id], z_index: maxZ + 1 } };
    });
  };

  const delete_category = async (id) => {
    try {
      const res = await authFetch(`${API}/user/categories/delete/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCategories(prev => { const u = { ...prev }; delete u[id]; return u; });
        setCategoryOrders(prev => { const u = { ...prev }; delete u[id]; return u; });
        playSound('ideaCategoryDelete');
        await fetch_all_ideas();
      }
    } catch (err) { console.error("IdeaBin: delete category failed", err); }
  };

  const rename_category_api = async (id, newName) => {
    await authFetch(`${API}/user/categories/rename/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: newName }),
    });
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], name: newName } }));
  };

  const toggle_archive_category = async (id) => {
    const res = await authFetch(`${API}/user/categories/toggle_archive/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], archived: data.archived } }));
    playSound('ideaCategoryArchive');
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  IDEA API  ════════════════════════════════
  // ═══════════════════════════════════════════════════════

  const fetch_all_ideas = async () => {
    try {
      const res = await authFetch(`${API}/user/ideas/all/`);
      const data = await res.json();
      const list = data?.data || [];
      const obj = {};
      // Flatten placement + nested idea into a single object keyed by placement id
      for (const p of list) {
        obj[p.id] = {
          placement_id: p.id,
          id: p.id,                          // for ordering / drag — this is the placement id
          idea_id: p.idea?.id,               // the meta idea id
          title: p.idea?.title || "",
          headline: p.idea?.headline || "",
          description: p.idea?.description || "",
          dimension_types: p.idea?.dimension_types || {},  // {dim_id: {legend_type_id, name, color}}
          owner: p.idea?.owner,
          owner_username: p.idea?.owner_username,
          created_at: p.idea?.created_at,
          placement_count: p.idea?.placement_count || 1,
          placement_categories: p.idea?.placement_categories || [],
          category: p.category,
          order_index: p.order_index,
        };
      }
      setIdeas(obj);
      setUnassignedOrder(data?.order || []);
      setCategoryOrders(data?.category_orders || {});
    } catch (err) { console.error("IdeaBin: fetch ideas failed", err); }
  };

  // Compute unique meta ideas from placements (deduplicated by idea_id)
  const metaIdeaList = (() => {
    const seen = new Set();
    const result = [];
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      result.push(p);
    }
    return result;
  })();

  const create_idea = async () => {
    if (!ideaName.trim() && !ideaHeadline.trim()) return;
    await authFetch(`${API}/user/ideas/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea_name: ideaName.trim() || ideaHeadline.trim(),
        description: "",
        headline: ideaHeadline,
        ...(selectedCategoryId ? { category_id: parseInt(selectedCategoryId) } : {}),
      }),
    });
    setIdeaName("");
    setIdeaHeadline("");
    playSound('ideaCreate');
    fetch_all_ideas();
  };

  const delete_idea = async (id) => {
    await authFetch(`${API}/user/ideas/delete/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    playSound('ideaDelete');
    fetch_all_ideas();
  };

  const update_idea_title_api = async (placementId, title, headline = null) => {
    if (!title.trim()) return;
    const idea = ideas[placementId];
    const ideaId = idea?.idea_id || placementId;
    await authFetch(`${API}/user/ideas/update_title/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ideaId, title }),
    });
    if (headline !== null) {
      await authFetch(`${API}/user/ideas/update_headline/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ideaId, headline }),
      });
    }
    // Update all placements of the same idea in local state
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          updated[pid] = { ...p, title, headline: headline !== null ? headline : p.headline };
        }
      }
      return updated;
    });
  };

  const safe_order = async (order, categoryId = null) => {
    await authFetch(`${API}/user/ideas/safe_order/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, category_id: categoryId }),
    });
  };

  const assign_idea_to_category = async (placementId, categoryId) => {
    await authFetch(`${API}/user/ideas/assign_to_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement_id: placementId, category_id: categoryId }),
    });
    fetch_all_ideas();
  };

  // ── Copy idea to another category ──
  const [copiedIdeaId, setCopiedIdeaId] = useState(null);  // meta idea id for Ctrl+C

  const copy_idea = (placementId) => {
    const idea = ideas[placementId];
    if (idea) {
      setCopiedIdeaId(idea.idea_id);
      playSound('ideaCopy');
    }
  };

  const pasteGuard = useRef(false);
  const paste_idea = async (categoryId = null) => {
    if (!copiedIdeaId || pasteGuard.current) return;
    pasteGuard.current = true;
    try {
      await authFetch(`${API}/user/ideas/copy/`, {
      });
      playSound('ideaCreate');
      await fetch_all_ideas();
    } finally {
      pasteGuard.current = false;
    }
  };

  const delete_meta_idea = async (ideaId) => {
    await authFetch(`${API}/user/ideas/delete_meta/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ideaId }),
    });
    playSound('ideaDelete');
    fetch_all_ideas();
  };

  const remove_idea_from_category = async (placementId) => {
    await authFetch(`${API}/user/ideas/remove_from_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement_id: placementId }),
    });
    fetch_all_ideas();
  };

  const remove_all_idea_categories = async (ideaId) => {
    await authFetch(`${API}/user/ideas/remove_all_categories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId }),
    });
    fetch_all_ideas();
  };

  const remove_all_idea_dimension_types = async (ideaId) => {
    await authFetch(`${API}/user/ideas/remove_all_dimension_types/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId }),
    });
    fetch_all_ideas();
  };

  const remove_idea_dimension_type = async (ideaId, dimensionId) => {
    await authFetch(`${API}/user/ideas/assign_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId, dimension_id: dimensionId, legend_type_id: null }),
    });
    fetch_all_ideas();
  };

  // ── Meta ideas list ──
  const [showMetaList, setShowMetaList] = useState(false);
  const [metaIdeas, setMetaIdeas] = useState([]);

  const fetch_meta_ideas = async () => {
    try {
      const res = await authFetch(`${API}/user/ideas/meta/`);
      const data = await res.json();
      setMetaIdeas(data?.ideas || []);
    } catch (err) { console.error("IdeaBin: fetch meta ideas failed", err); }
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  DRAG HANDLERS  ═══════════════════════════
  // ═══════════════════════════════════════════════════════

  const assign_idea_legend_type = async (placementId, legendTypeId) => {
    const idea = ideas[placementId];
    const ideaId = idea?.idea_id || placementId;
    const dimensionId = dims.activeDimensionId;
    if (!dimensionId) return;
    await authFetch(`${API}/user/ideas/assign_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId, dimension_id: dimensionId, legend_type_id: legendTypeId }),
    });
    // Update all placements of the same idea in local state
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          const newDt = { ...p.dimension_types };
          if (legendTypeId) {
            const lt = dims.dimensionTypes[legendTypeId];
            newDt[String(dimensionId)] = { legend_type_id: legendTypeId, name: lt?.name || "", color: lt?.color || "#ccc" };
          } else {
            delete newDt[String(dimensionId)];
          }
          updated[pid] = { ...p, dimension_types: newDt };
        }
      }
      return updated;
    });
  };

  // ── Category drag ──
  const handleCategoryDrag = (e, catKey) => {
    e.stopPropagation();
    const cat = categories[catKey];
    if (!categoryContainerRef.current) return;
    const rect = categoryContainerRef.current.getBoundingClientRect();
    bring_to_front_category(catKey);

    const startX = e.clientX - cat.x;
    const startY = e.clientY - cat.y;
    let nx = cat.x, ny = cat.y;

    const onMove = (ev) => {
      nx = Math.max(0, Math.min(ev.clientX - startX, rect.width - cat.width));
      ny = Math.max(0, Math.min(ev.clientY - startY, rect.height - cat.height));
      setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], x: nx, y: ny } }));
    };
    const onUp = () => {
      set_position_category(catKey, { x: nx, y: ny });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Category resize ──
  const handleCategoryResize = (e, catKey) => {
    e.preventDefault();
    e.stopPropagation();
    const cat = categories[catKey];
    if (!categoryContainerRef.current) return;
    const rect = categoryContainerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = cat.width;
    const startH = cat.height;
    let fw = startW, fh = startH;

    const onMove = (ev) => {
      const minW = Math.max(80, cat.name.length * 9 + 60);
      fw = Math.max(minW, Math.min(startW + (ev.clientX - startX), rect.width - cat.x));
      fh = Math.max(50, Math.min(startH + (ev.clientY - startY), rect.height - cat.y));
      setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], width: fw, height: fh } }));
    };
    const onUp = () => {
      set_area_category(catKey, fw, fh);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Idea drag (between unassigned ↔ categories ↔ external Dependencies) ──
  const isPointInRect = (px, py, r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;

  // External drag ghost state
  const [externalGhost, setExternalGhost] = useState(null); // { idea, x, y, teamId, teamName, teamColor, taskId, taskName }

  const handleIdeaDrag = (e, idea, index, source) => {
    const fromIdx = index;
    let toIdx = index;
    let dropTarget = null;
    let ghost = { idea, x: e.clientX, y: e.clientY };
    let isExternal = false;
    let extInfo = { teamId: null, teamName: null, teamColor: null, taskId: null, taskName: null, dayIndex: null, dayLabel: null, dayWeekday: null };
    let lastHighlightedCell = null;

    setDragging(ghost);
    setPrevIndex(index);
    setDragSource(source);

    let srcElements = [];
    if ((source.type === "unassigned" || source.type === "all") && IdeaListRef.current) {
      srcElements = [...IdeaListRef.current.querySelectorAll("[data-idea-item]")];
    } else if (source.type === "category" && categoryRefs.current[source.id]) {
      srcElements = [...categoryRefs.current[source.id].querySelectorAll("[data-idea-item]")];
    }

    const onMove = (ev) => {
      ghost = { ...ghost, x: ev.clientX, y: ev.clientY };
      setDragging(ghost);

      // Check if cursor is outside the IdeaBin window
      const winRect = windowRef.current?.getBoundingClientRect();
      const outsideWindow = winRect && !isPointInRect(ev.clientX, ev.clientY, winRect);

      if (outsideWindow) {
        isExternal = true;
        // Detect Dependencies team/task elements under cursor
        // Hide ghost temporarily to get element underneath
        const ghostEl = document.getElementById("ideabin-external-ghost");
        if (ghostEl) ghostEl.style.pointerEvents = "none";
        const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
        if (ghostEl) ghostEl.style.pointerEvents = "auto";

        // Walk up to find data-dep-team-id, data-dep-task-id, or data-dep-day-index
        let teamEl = elUnder?.closest?.("[data-dep-team-id]");
        let taskEl = elUnder?.closest?.("[data-dep-task-id]");
        let dayEl = elUnder?.closest?.("[data-dep-day-index]");
        extInfo = {
          teamId: teamEl?.dataset?.depTeamId || dayEl?.dataset?.depDayTeamId || null,
          teamName: teamEl?.dataset?.depTeamName || null,
          teamColor: teamEl?.dataset?.depTeamColor || null,
          taskId: taskEl?.dataset?.depTaskId || dayEl?.dataset?.depDayTaskId || null,
          taskName: taskEl?.dataset?.depTaskName || dayEl?.dataset?.depDayTaskName || null,
          dayIndex: dayEl?.dataset?.depDayIndex ?? null,
          dayLabel: dayEl?.dataset?.depDayLabel || null,
          dayWeekday: dayEl?.dataset?.depDayWeekday || null,
        };

        // Highlight the hovered day cell
        if (lastHighlightedCell && lastHighlightedCell !== dayEl) {
          lastHighlightedCell.style.backgroundColor = '';
          lastHighlightedCell.style.outline = '';
        }
        if (dayEl) {
          dayEl.style.backgroundColor = '#ddd6fe';
          dayEl.style.outline = '2px solid #7c3aed';
          lastHighlightedCell = dayEl;
        } else if (lastHighlightedCell) {
          lastHighlightedCell.style.backgroundColor = '';
          lastHighlightedCell.style.outline = '';
          lastHighlightedCell = null;
        }

        setExternalGhost({
          idea,
          x: ev.clientX,
          y: ev.clientY,
          ...extInfo,
          dayLabel: extInfo.dayLabel,
          dayWeekday: extInfo.dayWeekday,
        });
        setHoverCategory(null);
        setHoverUnassigned(false);
        dropTarget = null;
        return;
      }

      // Inside IdeaBin — clear external ghost
      isExternal = false;
      extInfo = { teamId: null, teamName: null, teamColor: null, taskId: null, taskName: null, dayIndex: null, dayLabel: null, dayWeekday: null };
      setExternalGhost(null);
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell.style.outline = '';
        lastHighlightedCell = null;
      }

      let foundUnassigned = false;
      if (IdeaListRef.current) {
        const listRect = IdeaListRef.current.getBoundingClientRect();
        if (isPointInRect(ev.clientX, ev.clientY, listRect)) foundUnassigned = true;
      }

      let foundCategory = null;
      if (!foundUnassigned && categoryContainerRef.current) {
        const cRect = categoryContainerRef.current.getBoundingClientRect();
        for (const [catId, catData] of Object.entries(categories)) {
          if (catData.archived) continue;
          const catRect = {
            left: cRect.left + catData.x, top: cRect.top + catData.y,
            right: cRect.left + catData.x + catData.width,
            bottom: cRect.top + catData.y + catData.height,
          };
          if (isPointInRect(ev.clientX, ev.clientY, catRect)) { foundCategory = catId; break; }
        }
      }

      setHoverCategory(foundCategory);
      setHoverUnassigned(foundUnassigned);
      dropTarget = foundCategory
        ? { type: "category", id: foundCategory }
        : foundUnassigned
        ? { type: "unassigned" }
        : null;

      const isOverSrc =
        (source.type === "unassigned" && foundUnassigned) ||
        (source.type === "category" && foundCategory === String(source.id));
      if (isOverSrc && srcElements.length > 1) {
        for (let i = 0; i < srcElements.length - 1; i++) {
          const r = srcElements[i].getBoundingClientRect();
          const nr = srcElements[i + 1].getBoundingClientRect();
          if (ghost.y > r.y && ghost.y < nr.y) { setHoverIndex(i); toIdx = i; }
        }
      } else {
        setHoverIndex(null);
      }
    };

    const onUp = () => {
      // Clear any highlighted day cell
      if (lastHighlightedCell) {
        lastHighlightedCell.style.backgroundColor = '';
        lastHighlightedCell.style.outline = '';
        lastHighlightedCell = null;
      }
      setExternalGhost(null);

      // External drop — onto Dependencies team, task, or day grid
      // Skip drops on virtual (unassigned) team header - can't create tasks there
      const isVirtualTeamDrop = extInfo.teamId && isNaN(parseInt(extInfo.teamId));
      if (isExternal && (extInfo.teamId || extInfo.dayIndex !== null) && !isVirtualTeamDrop) {
        const ideaName = idea.headline || idea.title.split(/\s+/).slice(0, 6).join(" ");
        const truncatedName = ideaName.length > 30 ? ideaName.slice(0, 27) + "..." : ideaName;

        if (extInfo.dayIndex !== null && extInfo.taskId) {
          // Dropped on a day grid cell → create milestone at this day position
          const dayDateStr = extInfo.dayLabel
            ? `${extInfo.dayWeekday || ''} ${extInfo.dayLabel}`.trim()
            : `Day ${parseInt(extInfo.dayIndex) + 1}`;
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Milestone?</p>
                <p className="text-xs text-gray-600">
                  Place milestone <span className="font-semibold">"{truncatedName}"</span>{" "}
                  on <span className="font-semibold">{dayDateStr}</span>{" "}
                  of task <span className="font-semibold">"{extInfo.taskName || "task"}"</span>
                </p>
              </div>
            ),
            confirmLabel: "Create Milestone",
            confirmColor: "bg-blue-500 hover:bg-blue-600",
            onConfirm: async () => {
              try {
                await add_milestone(projectId, parseInt(extInfo.taskId), {
                  name: truncatedName,
                  description: idea.title,
                  start_index: parseInt(extInfo.dayIndex),
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create milestone from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        } else if (extInfo.taskId) {
          // Dropped on a task row → ask: create milestone on this task?
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Milestone?</p>
                <p className="text-xs text-gray-600">
                  Add milestone <span className="font-semibold">"{truncatedName}"</span> to task{" "}
                  <span className="font-semibold">"{extInfo.taskName}"</span>
                  {extInfo.teamName && <> in <span className="font-semibold" style={{ color: extInfo.teamColor }}>{extInfo.teamName}</span></>}
                </p>
              </div>
            ),
            confirmLabel: "Create Milestone",
            confirmColor: "bg-blue-500 hover:bg-blue-600",
            onConfirm: async () => {
              try {
                await add_milestone(projectId, parseInt(extInfo.taskId), {
                  name: truncatedName,
                  description: idea.title,
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create milestone from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        } else {
          // Dropped on a team → ask: create task in this team?
          setConfirmModal({
            message: (
              <div>
                <p className="mb-1 text-sm font-medium">Create Task?</p>
                <p className="text-xs text-gray-600">
                  Create task <span className="font-semibold">"{truncatedName}"</span> in team{" "}
                  <span className="font-semibold" style={{ color: extInfo.teamColor }}>{extInfo.teamName}</span>
                </p>
              </div>
            ),
            confirmLabel: "Create Task",
            confirmColor: "bg-amber-500 hover:bg-amber-600",
            onConfirm: async () => {
              try {
                await createTaskForProject(projectId, {
                  name: truncatedName,
                  description: idea.title,
                  team_id: parseInt(extInfo.teamId),
                });
                await delete_idea(idea.id);
                playSound('ideaExternalDrop');
                window.dispatchEvent(new CustomEvent("ideabin-dep-refresh"));
              } catch (err) {
                console.error("Failed to create task from idea:", err);
              }
              setConfirmModal(null);
            },
            onCancel: () => setConfirmModal(null),
          });
        }
      } else {
        // Internal drop logic (within IdeaBin)
        const sameSrc = dropTarget && (
          (dropTarget.type === source.type && dropTarget.type === "unassigned") ||
          (dropTarget.type === "category" && source.type === "category" && String(dropTarget.id) === String(source.id))
        );
        if (sameSrc) {
          if (source.type === "unassigned") {
            const newOrd = [...unassignedOrder];
            const [moved] = newOrd.splice(fromIdx, 1);
            newOrd.splice(toIdx, 0, moved);
            setUnassignedOrder(newOrd);
            safe_order(newOrd, null);
            playSound('ideaDragDrop');
          } else if (source.type === "category") {
            const newOrd = [...(categoryOrders[source.id] || [])];
            const [moved] = newOrd.splice(fromIdx, 1);
            newOrd.splice(toIdx, 0, moved);
            setCategoryOrders(prev => ({ ...prev, [source.id]: newOrd }));
            safe_order(newOrd, source.id);
            playSound('ideaDragDrop');
          }
        } else if (dropTarget) {
          const targetCatId = dropTarget.type === "category" ? parseInt(dropTarget.id) : null;
          if (targetCatId !== null || dropTarget.type === "unassigned") {
            if (source.type === "all") {
              // Drag from "All Ideas" → category = ADD reference (copy)
              authFetch(`${API}/user/ideas/copy/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea_id: idea.idea_id, category_id: targetCatId }),
              })
                .then(() => { playSound('ideaCreate'); fetch_all_ideas(); })
                .catch(err => console.error("Copy on drag failed:", err));
            } else {
              // Drag from category/unassigned → another category = MOVE placement
              authFetch(`${API}/user/ideas/assign_to_category/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ placement_id: idea.placement_id, category_id: targetCatId }),
              })
                .then(() => { playSound('ideaDragDrop'); fetch_all_ideas(); })
                .catch(err => console.error("Move on drag failed:", err));
            }
          }
        }
      }

      setDragging(null);
      setPrevIndex(null);
      setHoverIndex(null);
      setDragSource(null);
      setHoverCategory(null);
      setHoverUnassigned(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Legend drag handler ──
  const handleLegendDrag = (e, legendTypeId) => {
    e.preventDefault();
    e.stopPropagation();
    let currentHoverIdeaId = null;
    setDraggingLegend({
      id: legendTypeId, x: e.clientX, y: e.clientY,
      color: legendTypeId ? dims.dimensionTypes[legendTypeId]?.color : "#374151",
    });
    const onMove = (ev) => {
      setDraggingLegend(prev => ({ ...prev, x: ev.clientX, y: ev.clientY }));
      let found = null;
      for (const [refKey, ref] of Object.entries(ideaRefs.current)) {
        if (ref) {
          const r = ref.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            found = refKey.startsWith("meta_") ? refKey : parseInt(refKey); break;
          }
        }
      }
      currentHoverIdeaId = found;
      setHoverIdeaForLegend(found);
    };
    const onUp = () => {
      if (currentHoverIdeaId) {
        // Resolve the actual placement ID from the ref key (strip "meta_" prefix)
        const actualId = String(currentHoverIdeaId).startsWith("meta_")
          ? parseInt(String(currentHoverIdeaId).replace("meta_", ""))
          : currentHoverIdeaId;
        assign_idea_legend_type(actualId, legendTypeId);
      }
      setDraggingLegend(null);
      setHoverIdeaForLegend(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  EFFECTS  ═════════════════════════════════
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    if (isOpen) {
      fetch_categories();
      fetch_all_ideas();
    }
  }, [isOpen]);

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

  // ── Ctrl+V to paste copied idea ──
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      // Only handle if IdeaBin window is visible and no text input is focused
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey && e.key === "v" && copiedIdeaId) {
        e.preventDefault();
        paste_idea(selectedCategoryId || null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, copiedIdeaId, selectedCategoryId]);

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
      ideas={ideas} dims={dims} draggingLegend={draggingLegend}
      dragSource={dragSource} hoverIndex={hoverIndex} prevIndex={prevIndex}
      editingIdeaId={editingIdeaId} setEditingIdeaId={setEditingIdeaId}
      setEditingIdeaTitle={setEditingIdeaTitle} setEditingIdeaHeadline={setEditingIdeaHeadline}
      hoverIdeaForLegend={hoverIdeaForLegend} sidebarHeadlineOnly={sidebarHeadlineOnly}
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
      remove_all_idea_dimension_types={remove_all_idea_dimension_types}
      remove_idea_dimension_type={remove_idea_dimension_type}
    />
  );

  const archivedCategories = Object.values(categories).filter(c => c.archived);
  const activeCategories = Object.entries(categories).filter(([, c]) => !c.archived);
  const unassignedCount = unassignedOrder.length;

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
          }}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150
            border-2 border-amber-300"
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
          <div onMouseDown={(e) => handleEdgeResize(e, "top")} className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom")} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "left")} className="absolute left-0 top-2 bottom-2 w-1.5 cursor-ew-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "right")} className="absolute right-0 top-2 bottom-2 w-1.5 cursor-ew-resize z-10" />

          {/* ── Title bar ── */}
          <div
            onMouseDown={handleWindowDrag}
            onDoubleClick={toggleMaximize}
            className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-400
              cursor-grab active:cursor-grabbing flex-shrink-0 border-b border-amber-500/30"
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-800" />
              <span className="text-sm font-semibold text-amber-900">
                Ideas
              </span>
              {unassignedCount > 0 && (
                <span className="text-[10px] bg-amber-600/20 text-amber-800 px-1.5 rounded-full font-medium">
                  {unassignedCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { setShowMetaList(v => !v); if (!showMetaList) fetch_meta_ideas(); }}
                className={`p-1 rounded transition-colors ${showMetaList ? "bg-amber-600/30" : "hover:bg-amber-500/30"}`}
                title="All Ideas (Meta View)"
              >
                <List size={13} className="text-amber-800" />
              </button>
              {copiedIdeaId && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => paste_idea(selectedCategoryId || null)}
                  className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-semibold hover:bg-indigo-200 transition-colors"
                  title={`Paste copied idea${selectedCategoryId && categories[selectedCategoryId] ? ` into "${categories[selectedCategoryId].name}"` : " (unassigned)"} (Ctrl+V)`}
                >
                  Paste{selectedCategoryId && categories[selectedCategoryId] ? ` → ${categories[selectedCategoryId].name}` : ""}
                </button>
              )}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={toggleMaximize}
                className="p-1 rounded hover:bg-amber-500/30 transition-colors"
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? <Minimize2 size={13} className="text-amber-800" /> : <Maximize2 size={13} className="text-amber-800" />}
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={minimizeWindow}
                className="p-1 rounded hover:bg-amber-500/30 transition-colors"
                title="Minimize to icon"
              >
                <Minus size={13} className="text-amber-800" />
              </button>
            </div>
          </div>

          {/* ── Content area ── */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Confirm modal overlay */}
            {confirmModal && (
              <IdeaBinConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} />
            )}

            {/* ── Meta Ideas list overlay ── */}
            {showMetaList && (
              <>
                <div className="absolute inset-0 bg-black/20 z-[48]" onClick={() => setShowMetaList(false)} />
                <div className="absolute inset-2 bg-white rounded-lg shadow-2xl z-[49] flex flex-col overflow-hidden border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <List size={14} /> All Ideas
                    </span>
                    <button onClick={() => setShowMetaList(false)} className="text-white/80 hover:text-white text-sm font-bold">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {metaIdeas.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No ideas yet</p>
                    )}
                    {metaIdeas.map(idea => (
                      <div key={idea.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-gray-800 truncate">{idea.headline || idea.title}</span>
                            {idea.placement_count > 1 && (
                              <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded flex-shrink-0">×{idea.placement_count}</span>
                            )}
                          </div>
                          {idea.headline && <p className="text-[10px] text-gray-500 truncate">{idea.title}</p>}
                          <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-400">
                            {idea.owner_username && <span>by {idea.owner_username}</span>}
                            {idea.created_at && <span>{new Date(idea.created_at).toLocaleDateString()}</span>}
                          </div>
                          {idea.placement_categories?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {idea.placement_categories.map((cat, i) => (
                                <span key={i} className="text-[8px] bg-gray-100 text-gray-500 px-1 rounded">{cat.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Copy
                            size={12}
                            onClick={() => { setCopiedIdeaId(idea.id); playSound('ideaCopy'); }}
                            className={`cursor-pointer ${copiedIdeaId === idea.id ? "text-indigo-500" : "text-gray-400 hover:text-indigo-500"}`}
                            title="Copy idea"
                          />
                          <DeleteForeverIcon
                            onClick={() => {
                              setConfirmModal({
                                message: (
                                  <div>
                                    <p className="mb-1 text-sm font-medium">Delete this idea and ALL its copies?</p>
                                    <p className="text-xs text-gray-600">{idea.headline || idea.title}</p>
                                    {idea.placement_count > 1 && (
                                      <p className="text-[10px] text-red-500 mt-1">{idea.placement_count} copies will be removed</p>
                                    )}
                                  </div>
                                ),
                                onConfirm: () => { delete_meta_idea(idea.id); setShowMetaList(false); setConfirmModal(null); },
                                onCancel: () => setConfirmModal(null),
                              });
                            }}
                            className="text-gray-400 hover:text-red-500! cursor-pointer"
                            style={{ fontSize: 13 }}
                          />
                        </div>
                      </div>
                    ))}
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
                {!editingIdeaId && selectedCategoryId && categories[selectedCategoryId] && (
                  <div className="flex items-center gap-1 mb-1.5 px-1.5 py-1 bg-indigo-50 border border-indigo-200 rounded text-[10px] text-indigo-700">
                    <span className="font-medium">Auto-add to:</span>
                    <span className="font-semibold truncate">{categories[selectedCategoryId].name}</span>
                    <button
                      onClick={() => setSelectedCategoryId(null)}
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
                    "& .MuiInputBase-root": { resize: "vertical", overflow: "auto", maxHeight: 400 },
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
                        Create{selectedCategoryId && categories[selectedCategoryId] ? ` → ${categories[selectedCategoryId].name}` : ""}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ── Ideas list (switchable) ── */}
              <div
                ref={IdeaListRef}
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
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const newVal = !sidebarHeadlineOnly;
                          setSidebarHeadlineOnly(newVal);
                          // reset individual collapse states for sidebar items
                          setCollapsedIdeas(prev => {
                            const next = { ...prev };
                            // keep meta_ keys, reset others
                            Object.keys(next).forEach(k => { if (!k.startsWith('meta_')) next[k] = newVal; });
                            return next;
                          });
                        }}
                        className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors"
                        title={sidebarHeadlineOnly ? "Show full ideas" : "Show headlines only"}
                      >
                        {sidebarHeadlineOnly ? "▶ Full" : "▼ Headlines"}
                      </button>
                      <label className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-gray-600 cursor-pointer" title="Show meta info (categories, dimensions)">
                        <input
                          type="checkbox"
                          checked={showSidebarMeta}
                          onChange={(e) => setShowSidebarMeta(e.target.checked)}
                          className="w-2.5 h-2.5 accent-indigo-500"
                        />
                        Meta
                      </label>
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
                      .filter(idea => {
                        if (globalTypeFilter.length === 0) return true;
                        if (!idea) return false;
                        const dimId = String(dims.activeDimensionId || "");
                        const dt = idea.dimension_types?.[dimId];
                        if (globalTypeFilter.includes("unassigned") && !dt) return true;
                        if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
                        return false;
                      })
                      .map((idea, idx) => renderIdeaItem(idea.id, idx, { type: "all" }))
                  : listFilter === "unassigned"
                  ? unassignedOrder
                      .filter(ideaId => {
                        if (globalTypeFilter.length === 0) return true;
                        const idea = ideas[ideaId];
                        if (!idea) return false;
                        const dimId = String(dims.activeDimensionId || "");
                        const dt = idea.dimension_types?.[dimId];
                        if (globalTypeFilter.includes("unassigned") && !dt) return true;
                        if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
                        return false;
                      })
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "unassigned" }))
                  : (categoryOrders[listFilter] || [])
                      .filter(ideaId => {
                        if (globalTypeFilter.length === 0) return true;
                        const idea = ideas[ideaId];
                        if (!idea) return false;
                        const dimId = String(dims.activeDimensionId || "");
                        const dt = idea.dimension_types?.[dimId];
                        if (globalTypeFilter.includes("unassigned") && !dt) return true;
                        if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
                        return false;
                      })
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "category", id: listFilter }))
                }              </div>

              {/* ── Dimensions panel (extracted) ── */}
              <IdeaBinDimensionPanel
                dims={dims}
                dimPanelCollapsed={dimPanelCollapsed} setDimPanelCollapsed={setDimPanelCollapsed}
                showCreateDimension={showCreateDimension} setShowCreateDimension={setShowCreateDimension}
                newDimensionName={newDimensionName} setNewDimensionName={setNewDimensionName}
                editingDimensionId={editingDimensionId} setEditingDimensionId={setEditingDimensionId}
                editingDimensionNameLocal={editingDimensionNameLocal} setEditingDimensionNameLocal={setEditingDimensionNameLocal}
                globalTypeFilter={globalTypeFilter} setGlobalTypeFilter={setGlobalTypeFilter}
                handleLegendDrag={handleLegendDrag}
                editingLegendId={editingLegendId} setEditingLegendId={setEditingLegendId}
                editingLegendName={editingLegendName} setEditingLegendName={setEditingLegendName}
                showCreateLegend={showCreateLegend} setShowCreateLegend={setShowCreateLegend}
                newLegendColor={newLegendColor} setNewLegendColor={setNewLegendColor}
                newLegendName={newLegendName} setNewLegendName={setNewLegendName}
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
                create_category_api={create_category_api}
                archivedCategories={archivedCategories}
                showArchive={showArchive} setShowArchive={setShowArchive}
                toggle_archive_category={toggle_archive_category}
                delete_category={delete_category}
                setConfirmModal={setConfirmModal}
                activeCategories={activeCategories}
                categoryOrders={categoryOrders}
                dragging={dragging}
                hoverCategory={hoverCategory}
                selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId}
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
                ideas={ideas} dims={dims}
                renderIdeaItem={renderIdeaItem}
                handleCategoryResize={handleCategoryResize}
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

      {/* ── Drag ghosts (extracted) ── */}
      <IdeaBinDragGhosts dragging={dragging} externalGhost={externalGhost} draggingLegend={draggingLegend} />
    </>
  );
}
