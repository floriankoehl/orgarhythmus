import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { Lightbulb, Minus, Maximize2, Minimize2, Zap } from "lucide-react";
import { BASE_URL } from "../../config/api";
import { createTaskForProject, fetchTeamsForProject } from "../../api/org_API";
import { add_milestone, fetch_project_tasks, delete_task, delete_team, delete_milestone } from "../../api/dependencies_api";
import { playSound } from "../../assets/sound_registry";
import { useDimensions } from "../../pages/general/ideas/useDimensions";

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

// ───────────────────── Confirm Modal ─────────────────────
function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = "Delete", confirmColor = "bg-red-500 hover:bg-red-600" }) {
  return (
    <>
      <div className="absolute inset-0 bg-black/30 z-[50] rounded-b-lg" onClick={onCancel} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-5 z-[51] min-w-[240px] max-w-[90%]">
        <div className="text-sm mb-4">{message}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 text-xs">
            Cancel
          </button>
          <button onClick={onConfirm} className={`px-3 py-1.5 rounded text-white text-xs ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════  IDEA BIN COMPONENT  ═════════════════
// ═══════════════════════════════════════════════════════════
export default function IdeaBin() {
  const { projectId } = useParams();
  const API = `${BASE_URL}/api/projects/${projectId}`;

  // ───── Window state ─────
  const [isOpen, setIsOpen] = useState(false);
  const [windowPos, setWindowPos] = useState(() => ({
    x: Math.max(0, window.innerWidth - DEFAULT_W - 24),
    y: Math.max(0, window.innerHeight - DEFAULT_H - 80),
  }));
  const [windowSize, setWindowSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [iconPos, setIconPos] = useState(() => ({
    x: Math.max(0, window.innerWidth - 68),
    y: Math.max(0, window.innerHeight - 68),
  }));
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxState, setPreMaxState] = useState(null);
  const windowRef = useRef(null);
  const headlineInputRef = useRef(null);
  const iconRef = useRef(null);

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
  const [listFilter, setListFilter] = useState("unassigned"); // "unassigned" | category id
  const [showListFilterDropdown, setShowListFilterDropdown] = useState(false);

  // ───── Sidebar resize ─────
  const [sidebarWidth, setSidebarWidth] = useState(240);

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
  // ═══════════  WINDOW MANAGEMENT  ═══════════════════════
  // ═══════════════════════════════════════════════════════

  const openWindow = useCallback(() => {
    setWindowPos({
      x: Math.max(0, Math.min(iconPos.x - windowSize.w + 48, window.innerWidth - windowSize.w)),
      y: Math.max(0, Math.min(iconPos.y - windowSize.h + 48, window.innerHeight - windowSize.h)),
    });
    setIsOpen(true);
    playSound('ideaOpen');
    setTimeout(() => headlineInputRef.current?.focus(), 100);
  }, [iconPos, windowSize]);

  const minimizeWindow = useCallback(() => {
    setIconPos({
      x: Math.min(window.innerWidth - 56, Math.max(0, windowPos.x + windowSize.w - 48)),
      y: Math.min(window.innerHeight - 56, Math.max(0, windowPos.y + windowSize.h - 48)),
    });
    setIsOpen(false);
    setIsMaximized(false);
    setPreMaxState(null);
    playSound('ideaClose');
  }, [windowPos, windowSize]);

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      if (preMaxState) {
        setWindowPos(preMaxState.pos);
        setWindowSize(preMaxState.size);
      }
      setIsMaximized(false);
      setPreMaxState(null);
    } else {
      setPreMaxState({ pos: { ...windowPos }, size: { ...windowSize } });
      setWindowPos({ x: 8, y: 60 });
      setWindowSize({ w: window.innerWidth - 16, h: window.innerHeight - 68 });
      setIsMaximized(true);
    }
  }, [isMaximized, preMaxState, windowPos, windowSize]);

  // ── Icon drag (direct DOM for performance) ──
  const handleIconDrag = useCallback((e) => {
    e.preventDefault();
    const el = iconRef.current;
    if (!el) return;
    const startX = e.clientX - iconPos.x;
    const startY = e.clientY - iconPos.y;
    let moved = false;
    let curX = iconPos.x;
    let curY = iconPos.y;

    // Disable CSS transitions during drag for instant feedback
    el.style.transition = 'none';

    const onMove = (ev) => {
      moved = true;
      curX = Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 56));
      curY = Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 56));
      el.style.left = curX + 'px';
      el.style.top = curY + 'px';
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.style.transition = '';
      // Sync React state once
      setIconPos({ x: curX, y: curY });
      if (!moved) openWindow();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [iconPos, openWindow]);

  // ── Window title bar drag ──
  const handleWindowDrag = useCallback((e) => {
    if (isMaximized) return;
    e.preventDefault();
    const startX = e.clientX - windowPos.x;
    const startY = e.clientY - windowPos.y;

    const onMove = (ev) => {
      setWindowPos({
        x: Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 60)),
        y: Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 40)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowPos, isMaximized]);

  // ── Window resize (bottom-right corner) ──
  const handleWindowResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = windowSize.w;
    const startH = windowSize.h;

    const onMove = (ev) => {
      setWindowSize({
        w: Math.max(MIN_W, startW + (ev.clientX - startX)),
        h: Math.max(MIN_H, startH + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowSize, isMaximized]);

  // ── Window resize edges ──
  const handleEdgeResize = useCallback((e, edge) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = windowSize.w;
    const startH = windowSize.h;
    const startPosX = windowPos.x;
    const startPosY = windowPos.y;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (edge === "right") {
        setWindowSize(s => ({ ...s, w: Math.max(MIN_W, startW + dx) }));
      } else if (edge === "bottom") {
        setWindowSize(s => ({ ...s, h: Math.max(MIN_H, startH + dy) }));
      } else if (edge === "left") {
        const newW = Math.max(MIN_W, startW - dx);
        setWindowSize(s => ({ ...s, w: newW }));
        setWindowPos(p => ({ ...p, x: startPosX + startW - newW }));
      } else if (edge === "top") {
        const newH = Math.max(MIN_H, startH - dy);
        setWindowSize(s => ({ ...s, h: newH }));
        setWindowPos(p => ({ ...p, y: startPosY + startH - newH }));
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowSize, windowPos, isMaximized]);

  // ═══════════════════════════════════════════════════════
  // ═══════════  CATEGORY API  ════════════════════════════
  // ═══════════════════════════════════════════════════════

  const fetch_categories = async () => {
    if (!projectId) return;
    try {
      const res = await authFetch(`${API}/get_all_categories/`);
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
    await authFetch(`${API}/create_category/`, {
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
    await authFetch(`${API}/set_position_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, position: pos }),
    });
  };

  const set_area_category = async (id, width, height) => {
    await authFetch(`${API}/set_area_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, width, height }),
    });
  };

  const bring_to_front_category = async (id) => {
    await authFetch(`${API}/bring_to_front_category/`, {
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
      const res = await authFetch(`${API}/delete_category/`, {
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
    await authFetch(`${API}/rename_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: newName }),
    });
    setCategories(prev => ({ ...prev, [id]: { ...prev[id], name: newName } }));
  };

  const toggle_archive_category = async (id) => {
    const res = await authFetch(`${API}/toggle_archive_category/`, {
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
    if (!projectId) return;
    try {
      const res = await authFetch(`${API}/get_all_ideas/`);
      const data = await res.json();
      const list = data?.data || [];
      const obj = {};
      for (const idea of list) obj[idea.id] = { ...idea };
      setIdeas(obj);
      setUnassignedOrder(data?.order || []);
      setCategoryOrders(data?.category_orders || {});
    } catch (err) { console.error("IdeaBin: fetch ideas failed", err); }
  };

  const create_idea = async () => {
    if (!ideaName.trim() && !ideaHeadline.trim()) return;
    await authFetch(`${API}/create_idea/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea_name: ideaName.trim() || ideaHeadline.trim(),
        description: "",
        headline: ideaHeadline,
      }),
    });
    setIdeaName("");
    setIdeaHeadline("");
    playSound('ideaCreate');
    fetch_all_ideas();
  };

  const delete_idea = async (id) => {
    await authFetch(`${API}/delete_idea/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    playSound('ideaDelete');
    fetch_all_ideas();
  };

  const update_idea_title_api = async (id, title, headline = null) => {
    if (!title.trim()) return;
    await authFetch(`${API}/update_idea_title/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (headline !== null) {
      await authFetch(`${API}/update_idea_headline/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, headline }),
      });
    }
    setIdeas(prev => ({
      ...prev,
      [id]: { ...prev[id], title, headline: headline !== null ? headline : prev[id].headline },
    }));
  };

  const safe_order = async (order, categoryId = null) => {
    await authFetch(`${API}/safe_order/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, category_id: categoryId }),
    });
  };

  const assign_idea_to_category = async (ideaId, categoryId) => {
    await authFetch(`${API}/assign_idea_to_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId, category_id: categoryId }),
    });
    fetch_all_ideas();
  };

  // ═══════════════════════════════════════════════════════
  // ═══════════  DRAG HANDLERS  ═══════════════════════════
  // ═══════════════════════════════════════════════════════

  const assign_idea_legend_type = async (ideaId, legendTypeId) => {
    await authFetch(`${API}/assign_idea_legend_type/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea_id: ideaId, legend_type_id: legendTypeId }),
    });
    setIdeas(prev => ({ ...prev, [ideaId]: { ...prev[ideaId], legend_type_id: legendTypeId } }));
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
    if (source.type === "unassigned" && IdeaListRef.current) {
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
          assign_idea_to_category(idea.id, targetCatId);
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
      for (const [ideaId, ref] of Object.entries(ideaRefs.current)) {
        if (ref) {
          const r = ref.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            found = parseInt(ideaId); break;
          }
        }
      }
      currentHoverIdeaId = found;
      setHoverIdeaForLegend(found);
    };
    const onUp = () => {
      if (currentHoverIdeaId) assign_idea_legend_type(currentHoverIdeaId, legendTypeId);
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
    if (projectId && isOpen) {
      fetch_categories();
      fetch_all_ideas();
    }
  }, [projectId, isOpen]);

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
              await authFetch(`${API}/create_idea/`, {
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
              await authFetch(`${API}/create_idea/`, {
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
              await authFetch(`${API}/create_idea/`, {
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
  }, [projectId, API]);

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

  const renderIdeaItem = (ideaId, arrayIndex, source) => {
    const idea = ideas[ideaId];
    if (!idea) return null;

    const isSource = dragSource &&
      dragSource.type === source.type &&
      (source.type === "unassigned" || String(dragSource.id) === String(source.id));
    const isEditing = editingIdeaId === ideaId;
    const legendType = idea.legend_type_id ? dims.dimensionTypes[idea.legend_type_id] : null;
    const isHoveredForLegend = hoverIdeaForLegend === ideaId;
    const isIdeaCollapsed = collapsedIdeas[ideaId] ?? false;

    const getDisplayText = () => {
      if (idea.headline) return <span className="font-semibold text-xs">{idea.headline}</span>;
      const words = idea.title.split(/\s+/);
      return words.length > 5
        ? <span className="font-semibold text-[11px]">{words.slice(0, 5).join(" ")}...</span>
        : <span className="font-semibold text-[11px]">{idea.title}</span>;
    };

    return (
      <div key={`idea_${ideaId}`} data-idea-item="true">
        <div
          style={{
            opacity: isSource && arrayIndex === hoverIndex ? 1 : 0,
            transition: "opacity 100ms ease",
          }}
          className="w-full h-0.5 my-[1px] rounded bg-gray-700"
        />
        {isEditing ? (
          <div className="w-full rounded bg-blue-50 text-blue-600 px-2 py-1 text-[10px] mb-0.5 border border-blue-200 italic">
            Editing above...
          </div>
        ) : (
          <div
            ref={el => (ideaRefs.current[ideaId] = el)}
            onMouseDown={(e) => { e.stopPropagation(); handleIdeaDrag(e, idea, arrayIndex, source); }}
            style={{
              backgroundColor: isHoveredForLegend
                ? (draggingLegend?.color || "#e0e7ff")
                : isSource && arrayIndex === prevIndex ? "#e5e7eb"
                : legendType ? `${legendType.color}20` : "#ffffff4b",
              borderLeftColor: legendType ? legendType.color : "#374151",
              borderLeftWidth: "3px",
              transform: isSource && hoverIndex !== null && arrayIndex >= hoverIndex && arrayIndex !== prevIndex
                ? "translateY(4px)" : "translateY(0px)",
              transition: "transform 150ms ease, background-color 150ms ease",
            }}
            className={`w-full rounded text-gray-800 px-1.5 py-1 flex justify-between items-start text-[11px] mb-0.5 cursor-grab leading-tight shadow-sm border border-gray-200 hover:shadow-md ${isHoveredForLegend ? "ring-2 ring-offset-1" : ""}`}
          >
            <div className="flex items-start gap-1 flex-1 mr-1">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedIdeas(prev => ({ ...prev, [ideaId]: !prev[ideaId] }));
                }}
                className="cursor-pointer flex-shrink-0"
                style={{
                  width: 0, height: 0, display: "inline-block", borderStyle: "solid", marginTop: "3px",
                  ...(isIdeaCollapsed
                    ? { borderWidth: "5px 0 5px 8px", borderColor: `transparent transparent transparent ${legendType?.color || "#374151"}` }
                    : { borderWidth: "8px 5px 0 5px", borderColor: `${legendType?.color || "#374151"} transparent transparent transparent` }),
                }}
              />
              <div className="break-words whitespace-pre-wrap">
                {isIdeaCollapsed ? getDisplayText() : (
                  <>
                    {idea.headline && <div className="font-semibold text-xs mb-0.5">{idea.headline}</div>}
                    <span className="text-[10px] text-gray-600">{idea.title}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 mt-0.5 flex items-center gap-0.5 text-gray-400">
              <Zap
                size={12}
                onClick={(e) => {
                  e.stopPropagation();
                  openTransform(idea);
                }}
                className="hover:text-amber-500! cursor-pointer"
                title="Transform to Task or Milestone"
              />
              <EditIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingIdeaId(ideaId);
                  setEditingIdeaTitle(idea.title);
                  setEditingIdeaHeadline(idea.headline || "");
                }}
                className="hover:text-blue-500! cursor-pointer"
                style={{ fontSize: 12 }}
              />
              <DeleteForeverIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmModal({
                    message: (
                      <div>
                        <p className="mb-1 text-sm">Delete this idea?</p>
                        {idea.headline && <p className="font-semibold text-xs">{idea.headline}</p>}
                        <p className="text-xs text-gray-600 mt-0.5">{idea.title.length > 80 ? idea.title.slice(0, 80) + "..." : idea.title}</p>
                      </div>
                    ),
                    onConfirm: () => { delete_idea(idea.id); setConfirmModal(null); },
                    onCancel: () => setConfirmModal(null),
                  });
                }}
                className="hover:text-red-500! cursor-pointer"
                style={{ fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const archivedCategories = Object.values(categories).filter(c => c.archived);
  const activeCategories = Object.entries(categories).filter(([, c]) => !c.archived);
  const unassignedCount = unassignedOrder.length;

  // ═══════════════════════════════════════════════════════
  // ═══════════  JSX  ═════════════════════════════════════
  // ═══════════════════════════════════════════════════════

  if (!projectId) return null;

  return (
    <>
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
              <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={confirmModal.onCancel} confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} />
            )}

            {/* Transform modal overlay */}
            {transformModal && (
              <>
                <div className="absolute inset-0 bg-black/30 z-[50] rounded-b-lg" onClick={closeTransform} />
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[51] min-w-[260px] max-w-[90%] overflow-hidden"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-amber-400 to-yellow-400 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                      <Zap size={14} /> Transform Idea
                    </span>
                    <button onClick={closeTransform} className="text-amber-800 hover:text-amber-950 text-sm font-bold">✕</button>
                  </div>

                  {/* Idea preview */}
                  <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50">
                    {transformModal.idea.headline && (
                      <p className="text-xs font-semibold text-gray-700">{transformModal.idea.headline}</p>
                    )}
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{transformModal.idea.title}</p>
                  </div>

                  <div className="p-4">
                    {/* Step: Choose */}
                    {transformModal.step === 'choose' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-gray-500 mb-1">Transform this idea into:</p>
                        <button
                          onClick={() => setTransformModal(prev => ({ ...prev, step: 'task' }))}
                          className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group"
                        >
                          <span className="text-sm font-medium text-gray-800 group-hover:text-amber-800">📋 Task</span>
                          <p className="text-[10px] text-gray-400 mt-0.5">Create a new task assigned to a team</p>
                        </button>
                        <button
                          onClick={() => { setTransformTeamId(null); setTransformTaskId(null); setTransformModal(prev => ({ ...prev, step: 'milestone' })); }}                          className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                        >
                          <span className="text-sm font-medium text-gray-800 group-hover:text-blue-800">🏁 Milestone</span>
                          <p className="text-[10px] text-gray-400 mt-0.5">Create a milestone on an existing task</p>
                        </button>
                      </div>
                    )}

                    {/* Step: Task */}
                    {transformModal.step === 'task' && (
                      <div className="flex flex-col gap-2.5">
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Task Name</label>
                          <input
                            autoFocus
                            value={transformName}
                            onChange={(e) => setTransformName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") closeTransform(); }}
                            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded outline-none focus:border-amber-400"
                            placeholder="Task name..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Select Team</label>
                          <div className="max-h-[140px] overflow-y-auto border border-gray-200 rounded">
                            {projectTeams.length === 0 && (
                              <p className="text-[10px] text-gray-400 p-2 italic">No teams found...</p>
                            )}
                            {projectTeams.map(team => (
                              <div
                                key={team.id}
                                onClick={() => setTransformTeamId(team.id)}
                                className={`px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
                                  transformTeamId === team.id
                                    ? "bg-amber-100 text-amber-900 font-medium"
                                    : "hover:bg-gray-50 text-gray-700"
                                }`}
                              >
                                {team.color && (
                                  <span className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300" style={{ backgroundColor: team.color }} />
                                )}
                                {team.name}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <button
                            onClick={() => setTransformModal(prev => ({ ...prev, step: 'choose' }))}
                            className="text-[10px] text-gray-500 hover:text-gray-700"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={executeTransformToTask}
                            disabled={!transformName.trim() || !transformTeamId || transformLoading}
                            className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            {transformLoading ? "Creating..." : "Create Task"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step: Milestone */}
                    {transformModal.step === 'milestone' && (
                      <div className="flex flex-col gap-2.5">
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Milestone Name</label>
                          <input
                            autoFocus
                            value={transformName}
                            onChange={(e) => setTransformName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") closeTransform(); }}
                            className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded outline-none focus:border-blue-400"
                            placeholder="Milestone name..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium mb-0.5 block">Select Task</label>
                          <input
                            value={transformTaskSearch}
                            onChange={(e) => setTransformTaskSearch(e.target.value)}
                            className="w-full text-[10px] px-2 py-1 border border-gray-200 rounded outline-none focus:border-blue-300 mb-1"
                            placeholder="Search tasks..."
                          />
                          <div className="max-h-[160px] overflow-y-auto border border-gray-200 rounded">
                            {(() => {
                              const filtered = projectTasks.filter(t => {
                                if (!transformTaskSearch) return true;
                                const q = transformTaskSearch.toLowerCase();
                                const teamObj = projectTeams.find(tm => tm.id === (t.team || t.team_id));
                                return (
                                  (t.name || '').toLowerCase().includes(q) ||
                                  (teamObj?.name || '').toLowerCase().includes(q)
                                );
                              });
                              if (filtered.length === 0) return (
                                <p className="text-[10px] text-gray-400 p-2 italic">No tasks found...</p>
                              );
                              return filtered.map(task => {
                                const teamObj = projectTeams.find(tm => tm.id === (task.team || task.team_id));
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() => setTransformTaskId(task.id)}
                                    className={`px-2 py-1.5 text-xs cursor-pointer transition-colors flex items-center gap-1.5 ${
                                      transformTaskId === task.id
                                        ? "bg-blue-100 text-blue-900 font-medium"
                                        : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    {teamObj?.color && (
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamObj.color }} />
                                    )}
                                    <span>{task.name}</span>
                                    {teamObj?.name && <span className="text-[10px] text-gray-400 ml-auto">{teamObj.name}</span>}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <button
                            onClick={() => setTransformModal(prev => ({ ...prev, step: 'choose' }))}
                            className="text-[10px] text-gray-500 hover:text-gray-700"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={executeTransformToMilestone}
                            disabled={!transformName.trim() || !transformTaskId || transformLoading}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            {transformLoading ? "Creating..." : "Create Milestone"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

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
                  minRows={1}
                  maxRows={3}
                  fullWidth
                  sx={{ backgroundColor: "white", borderRadius: 1, "& .MuiInputBase-input": { fontSize: 12, caretColor: "#1f2937", color: "#1f2937" } }}
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
                        Create
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
                  <button
                    onClick={() => setShowListFilterDropdown(p => !p)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {listFilter === "unassigned"
                      ? `Unassigned (${unassignedCount})`
                      : `${categories[listFilter]?.name || "Category"} (${(categoryOrders[listFilter] || []).length})`
                    }
                    <span className="text-[9px]">▼</span>
                  </button>
                  {showListFilterDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowListFilterDropdown(false)} />
                      <div className="absolute left-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-[61] min-w-[140px] max-h-[200px] overflow-y-auto py-0.5">
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
                {listFilter === "unassigned"
                  ? unassignedOrder
                      .filter(ideaId => {
                        if (globalTypeFilter.length === 0) return true;
                        const idea = ideas[ideaId];
                        if (!idea) return false;
                        if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) return true;
                        if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) return true;
                        return false;
                      })
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "unassigned" }))
                  : (categoryOrders[listFilter] || [])
                      .filter(ideaId => {
                        if (globalTypeFilter.length === 0) return true;
                        const idea = ideas[ideaId];
                        if (!idea) return false;
                        if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) return true;
                        if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) return true;
                        return false;
                      })
                      .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "category", id: listFilter }))
                }              </div>

              {/* ── Dimensions panel (selector only — types managed on Ideas page) ── */}
              <div className="bg-white border-t border-gray-200 p-2 flex-shrink-0">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setDimPanelCollapsed(!dimPanelCollapsed)}
                >
                  <h3 className="text-[10px] font-semibold text-gray-500">
                    Dimensions {globalTypeFilter.length > 0 && <span className="text-blue-500">(filtered)</span>}
                  </h3>
                  <span className="text-gray-400 text-[10px]">{dimPanelCollapsed ? "▲" : "▼"}</span>
                </div>
                {!dimPanelCollapsed && (
                  <div className="mt-1">
                    {/* Dimension selector */}
                    {dims.dimensions.length > 0 && (
                      <div className="mb-1">
                        {editingDimensionId ? (
                          <div className="flex gap-1">
                            <input
                              autoFocus
                              value={editingDimensionNameLocal}
                              onChange={(e) => setEditingDimensionNameLocal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingDimensionNameLocal.trim()) {
                                  dims.update_dimension(editingDimensionId, editingDimensionNameLocal.trim());
                                  setEditingDimensionId(null);
                                } else if (e.key === "Escape") setEditingDimensionId(null);
                              }}
                              onBlur={() => {
                                if (editingDimensionNameLocal.trim()) dims.update_dimension(editingDimensionId, editingDimensionNameLocal.trim());
                                setEditingDimensionId(null);
                              }}
                              className="flex-1 text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none"
                            />
                            <button onClick={() => setEditingDimensionId(null)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <select
                              value={dims.activeDimensionId || ""}
                              onChange={(e) => dims.setActiveDimensionId(e.target.value ? parseInt(e.target.value) : null)}
                              className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none bg-white"
                            >
                              {dims.dimensions.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const dim = dims.dimensions.find(d => d.id === dims.activeDimensionId);
                                if (dim) { setEditingDimensionId(dim.id); setEditingDimensionNameLocal(dim.name); }
                              }}
                              title="Rename"
                              className="text-[10px] text-gray-400 hover:text-blue-500 px-0.5"
                            >✎</button>
                            <button
                              onClick={() => {
                                if (dims.activeDimensionId && window.confirm("Delete this dimension?")) {
                                  dims.delete_dimension(dims.activeDimensionId);
                                }
                              }}
                              title="Delete"
                              className="text-[10px] text-gray-400 hover:text-red-500 px-0.5"
                            >✕</button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Create dimension */}
                    {showCreateDimension ? (
                      <div className="flex gap-1 mb-1">
                        <input
                          autoFocus
                          value={newDimensionName}
                          onChange={(e) => setNewDimensionName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newDimensionName.trim()) {
                              dims.create_dimension(newDimensionName.trim());
                              setNewDimensionName(""); setShowCreateDimension(false);
                            } else if (e.key === "Escape") setShowCreateDimension(false);
                          }}
                          placeholder="Dimension name..."
                          className="flex-1 text-[10px] px-1 py-0.5 border border-gray-300 rounded outline-none focus:border-blue-400"
                        />
                        <button
                          onClick={() => {
                            if (newDimensionName.trim()) {
                              dims.create_dimension(newDimensionName.trim());
                              setNewDimensionName("");
                              setShowCreateDimension(false);
                            }
                          }}
                          className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >+</button>
                        <button onClick={() => setShowCreateDimension(false)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCreateDimension(true)}
                        className="w-full mb-1 text-[10px] px-1.5 py-0.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:bg-gray-50"
                      >
                        + New Dimension
                      </button>
                    )}
                    {globalTypeFilter.length > 0 && (
                      <button
                        onClick={() => setGlobalTypeFilter([])}
                        className="w-full mb-1 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                      >
                        Clear Filter
                      </button>
                    )}
                    {/* Unassigned type */}
                    <div
                      className={`flex items-center gap-1.5 mb-1 cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes("unassigned") ? "bg-gray-200" : "hover:bg-gray-100"}`}
                      onClick={() => setGlobalTypeFilter(prev => prev.includes("unassigned") ? prev.filter(t => t !== "unassigned") : [...prev, "unassigned"])}
                    >
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, null); }}
                        className="w-4 h-4 rounded-full cursor-grab bg-gray-700 border border-gray-300 hover:scale-110 transition-transform"
                      />
                      <span className="text-gray-500 italic flex-1">Unassigned</span>
                      {globalTypeFilter.includes("unassigned") && <span className="text-blue-500">✓</span>}
                    </div>
                    {/* Dimension types */}
                    {Object.values(dims.dimensionTypes).map(lt => (
                      <div
                        key={lt.id}
                        className={`flex items-center gap-1.5 mb-1 group cursor-pointer rounded px-1 py-0.5 text-[10px] ${globalTypeFilter.includes(lt.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                        onClick={() => setGlobalTypeFilter(prev => prev.includes(lt.id) ? prev.filter(t => t !== lt.id) : [...prev, lt.id])}
                      >
                        <div
                          onMouseDown={(e) => { e.stopPropagation(); handleLegendDrag(e, lt.id); }}
                          className="w-4 h-4 rounded-full cursor-grab border border-gray-200 hover:scale-110 transition-transform"
                          style={{ backgroundColor: lt.color }}
                        />
                        {editingLegendId === lt.id ? (
                          <input
                            autoFocus
                            value={editingLegendName}
                            onChange={e => setEditingLegendName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") { dims.update_dimension_type(lt.id, { name: editingLegendName }); setEditingLegendId(null); }
                              else if (e.key === "Escape") setEditingLegendId(null);
                            }}
                            onBlur={() => { dims.update_dimension_type(lt.id, { name: editingLegendName }); setEditingLegendId(null); }}
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] px-1 py-0.5 border border-blue-400 rounded outline-none flex-1 min-w-0"
                          />
                        ) : (
                          <span
                            onDoubleClick={e => { e.stopPropagation(); setEditingLegendId(lt.id); setEditingLegendName(lt.name); }}
                            className="text-gray-700 cursor-text flex-1"
                          >
                            {lt.name}
                          </span>
                        )}
                        {globalTypeFilter.includes(lt.id) && <span className="text-blue-500">✓</span>}
                        <label
                          className="relative w-4 h-4 rounded cursor-pointer border border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
                          style={{ backgroundColor: lt.color }}
                          title="Pick color"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="color" value={lt.color}
                            onChange={e => dims.update_dimension_type(lt.id, { color: e.target.value })}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </label>
                        <DeleteForeverIcon
                          onClick={e => { e.stopPropagation(); dims.delete_dimension_type(lt.id); }}
                          className="text-gray-300 hover:text-red-500! cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ fontSize: 13 }}
                        />
                      </div>
                    ))}
                    {/* Create type */}
                    {showCreateLegend ? (
                      <div className="mt-1 p-1.5 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-center gap-1 mb-1">
                          <label
                            className="relative w-5 h-5 rounded cursor-pointer border border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
                            style={{ backgroundColor: newLegendColor }}
                            title="Pick color"
                          >
                            <input type="color" value={newLegendColor} onChange={e => setNewLegendColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          </label>
                          <input
                            autoFocus value={newLegendName} onChange={e => setNewLegendName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && newLegendName.trim()) {
                                dims.create_dimension_type(newLegendName, newLegendColor);
                                setNewLegendName(""); setNewLegendColor("#6366f1"); setShowCreateLegend(false);
                              } else if (e.key === "Escape") setShowCreateLegend(false);
                            }}
                            placeholder="Type name..."
                            className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded outline-none flex-1 focus:border-blue-400"
                          />
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (newLegendName.trim()) {
                                dims.create_dimension_type(newLegendName, newLegendColor);
                                setNewLegendName(""); setNewLegendColor("#6366f1"); setShowCreateLegend(false);
                              }
                            }}
                            className="flex-1 text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Create
                          </button>
                          <button onClick={() => setShowCreateLegend(false)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded hover:bg-gray-300">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowCreateLegend(true)}
                        className="w-full mt-1 text-[10px] px-1.5 py-1 border border-dashed border-gray-300 rounded text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        + Add Type
                      </button>
                    )}
                  </div>
                )}
              </div>
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
              <div
                ref={categoryContainerRef}
                className="flex-1 relative overflow-auto bg-gray-50"
              >
                {/* Toolbar */}
                <div className="sticky top-0 z-30 flex items-center gap-2 p-2 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
                  {displayCategoryForm ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        autoFocus
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") create_category_api();
                          else if (e.key === "Escape") { setDisplayCategoryForm(false); setNewCategoryName(""); }
                        }}
                        placeholder="Category name..."
                        className="text-xs px-2 py-1 border border-gray-300 rounded outline-none flex-1 focus:border-amber-400"
                      />
                      <button onClick={create_category_api} className="text-[10px] px-2 py-1 bg-amber-400 rounded hover:bg-amber-500 font-medium">
                        Create
                      </button>
                      <button onClick={() => { setDisplayCategoryForm(false); setNewCategoryName(""); }} className="text-[10px] px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDisplayCategoryForm(true)}
                      className="text-[10px] px-2 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded hover:bg-amber-200 font-medium"
                    >
                      + Category
                    </button>
                  )}
                  {archivedCategories.length > 0 && (
                    <button
                      onClick={() => setShowArchive(!showArchive)}
                      className="text-[10px] px-2 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1"
                    >
                      <ArchiveIcon style={{ fontSize: 12 }} />
                      {archivedCategories.length}
                    </button>
                  )}
                </div>

                {/* Archive dropdown */}
                {showArchive && archivedCategories.length > 0 && (
                  <div className="absolute top-10 right-2 z-40 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[180px] max-h-[200px] overflow-y-auto">
                    <h3 className="text-[10px] font-semibold mb-1 text-gray-500">Archived</h3>
                    {archivedCategories.map(cat => (
                      <div key={cat.id} className="flex justify-between items-center p-1 rounded hover:bg-gray-50 mb-0.5 text-[10px]">
                        <span className="font-medium truncate flex-1">{cat.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <UnarchiveIcon
                            onClick={() => toggle_archive_category(cat.id)}
                            className="hover:text-green-600! cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                          <DeleteForeverIcon
                            onClick={() => setConfirmModal({
                              message: `Delete "${cat.name}"?`,
                              onConfirm: () => { delete_category(cat.id); setConfirmModal(null); },
                              onCancel: () => setConfirmModal(null),
                            })}
                            className="hover:text-red-500! cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Category cards */}
                {activeCategories.map(([catKey, catData]) => {
                  const catIdeas = categoryOrders[catKey] || [];
                  const isHovered = dragging && String(hoverCategory) === String(catKey);

                  return (
                    <div
                      key={catKey}
                      style={{
                        left: catData.x, top: catData.y + 36,
                        width: catData.width, height: catData.height,
                        zIndex: catData.z_index || 0,
                        backgroundColor: isHovered ? "#fde68a" : "#fef08a",
                        transition: "background-color 150ms ease",
                      }}
                      className="absolute shadow-lg rounded p-1.5 flex flex-col"
                      onMouseDown={() => bring_to_front_category(catKey)}
                    >
                      {/* Category header */}
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); handleCategoryDrag(e, catKey); }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCategoryId(catKey);
                          setEditingCategoryName(catData.name);
                        }}
                        className="flex justify-between items-center mb-0.5 flex-shrink-0 bg-amber-300/50 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b border-amber-400/40"
                      >
                        {editingCategoryId === catKey ? (
                          <input
                            autoFocus
                            value={editingCategoryName}
                            onChange={e => setEditingCategoryName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") { rename_category_api(catKey, editingCategoryName); setEditingCategoryId(null); }
                              else if (e.key === "Escape") setEditingCategoryId(null);
                            }}
                            onBlur={() => { rename_category_api(catKey, editingCategoryName); setEditingCategoryId(null); }}
                            onMouseDown={e => e.stopPropagation()}
                            className="bg-white text-[11px] font-semibold px-1 py-0.5 rounded outline-none border border-blue-400 flex-1 mr-1"
                          />
                        ) : (
                          <span className="font-semibold text-[11px] truncate">{catData.name}</span>
                        )}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {/* Collapse all ideas toggle */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const allCollapsed = catIdeas.every(id => collapsedIdeas[id]);
                              const newState = {};
                              catIdeas.forEach(id => { newState[id] = !allCollapsed; });
                              setCollapsedIdeas(prev => ({ ...prev, ...newState }));
                            }}
                            className="text-[10px] text-amber-700 hover:text-amber-900 cursor-pointer px-0.5"
                          >
                            <span style={{
                              display: "inline-block", width: 0, height: 0, borderStyle: "solid",
                              ...(catIdeas.every(id => collapsedIdeas[id])
                                ? { borderWidth: "5px 3px 0 3px", borderColor: "currentColor transparent transparent transparent" }
                                : { borderWidth: "0 3px 5px 3px", borderColor: "transparent transparent currentColor transparent" })
                            }} />
                          </span>
                          {/* Minimize */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (minimizedCategories[catKey]) {
                                const orig = minimizedCategories[catKey];
                                setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], width: orig.width, height: orig.height } }));
                                set_area_category(catKey, orig.width, orig.height);
                                setMinimizedCategories(prev => { const u = { ...prev }; delete u[catKey]; return u; });
                              } else {
                                const minW = Math.max(80, catData.name.length * 9 + 60);
                                setMinimizedCategories(prev => ({ ...prev, [catKey]: { width: catData.width, height: catData.height } }));
                                setCategories(prev => ({ ...prev, [catKey]: { ...prev[catKey], width: minW, height: 30 } }));
                                set_area_category(catKey, minW, 30);
                              }
                            }}
                            className="text-[10px] text-amber-700 hover:text-amber-900 cursor-pointer px-0.5"
                          >
                            {minimizedCategories[catKey] ? "◻" : "—"}
                          </span>
                          <ArchiveIcon
                            onClick={(e) => { e.stopPropagation(); toggle_archive_category(catKey); }}
                            className="hover:text-amber-700! cursor-pointer" style={{ fontSize: 13 }}
                          />
                          <DeleteForeverIcon
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                message: `Delete "${catData.name}"? Its ideas become unassigned.`,
                                onConfirm: () => { delete_category(catKey); setConfirmModal(null); },
                                onCancel: () => setConfirmModal(null),
                              });
                            }}
                            className="hover:text-red-500! cursor-pointer" style={{ fontSize: 14 }}
                          />
                        </div>
                      </div>

                      {/* Ideas inside category */}
                      <div
                        ref={el => (categoryRefs.current[catKey] = el)}
                        className="flex-1 overflow-y-auto overflow-x-hidden"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        {catIdeas
                          .filter(ideaId => {
                            if (globalTypeFilter.length === 0) return true;
                            const idea = ideas[ideaId];
                            if (!idea) return false;
                            if (globalTypeFilter.includes("unassigned") && !idea.legend_type_id) return true;
                            if (idea.legend_type_id && globalTypeFilter.includes(idea.legend_type_id)) return true;
                            return false;
                          })
                          .map((ideaId, idx) => renderIdeaItem(ideaId, idx, { type: "category", id: catKey }))
                        }
                      </div>

                      {/* Resize grip */}
                      <div
                        onMouseDown={(e) => handleCategoryResize(e, catKey)}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center"
                      >
                        <span className="text-amber-600/60 text-[8px] leading-none select-none">◢</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* ── Drag ghosts (fixed, above everything) ── */}
      {dragging && !externalGhost && (
        <div
          style={{
            top: dragging.y, left: dragging.x,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none", zIndex: 99999,
          }}
          className="fixed max-w-48 shadow-lg border border-gray-200 bg-white rounded text-gray-800 px-2 py-1 flex items-center text-[10px]"
        >
          <span className="whitespace-pre-wrap line-clamp-2">
            {dragging.idea.headline && <span className="font-semibold">{dragging.idea.headline}: </span>}
            {dragging.idea.title}
          </span>
        </div>
      )}
      {draggingLegend && (
        <div
          style={{
            top: draggingLegend.y, left: draggingLegend.x,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none", zIndex: 99999,
            backgroundColor: draggingLegend.color,
          }}
          className="fixed w-6 h-6 rounded-full shadow-lg border-2 border-white"
        />
      )}

      {/* External drag ghost — visible when dragging an idea outside the IdeaBin window */}
      {externalGhost && (
        <div
          id="ideabin-external-ghost"
          style={{
            position: "fixed",
            left: externalGhost.x + 12,
            top: externalGhost.y - 8,
            zIndex: 99999,
            pointerEvents: "none",
            maxWidth: 220,
          }}
        >
          <div
            className="rounded-lg shadow-xl border-2 px-2.5 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined
                ? "#ede9fe"
                : externalGhost.teamId
                  ? (externalGhost.taskId ? "#dbeafe" : "#fef3c7")
                  : "#ffffff",
              borderColor: externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined
                ? "#7c3aed"
                : externalGhost.teamId
                  ? (externalGhost.taskId ? "#3b82f6" : (externalGhost.teamColor || "#f59e0b"))
                  : "#d1d5db",
              color: "#1f2937",
            }}
          >
            <div className="truncate">
              {externalGhost.idea.headline || externalGhost.idea.title.split(/\s+/).slice(0, 5).join(" ")}
            </div>
            {externalGhost.dayIndex !== null && externalGhost.dayIndex !== undefined && externalGhost.taskId ? (
              <div className="text-[10px] mt-0.5 opacity-80">
                🏁 {externalGhost.dayLabel ? `${externalGhost.dayWeekday || ''} ${externalGhost.dayLabel}`.trim() : `Day ${parseInt(externalGhost.dayIndex) + 1}`}
              </div>
            ) : externalGhost.teamId ? (
              <div className="text-[10px] mt-0.5 opacity-80">
                {externalGhost.taskId
                  ? <>🏁 → <span className="font-semibold">{externalGhost.taskName}</span></>
                  : <>📋 → <span className="font-semibold" style={{ color: externalGhost.teamColor }}>{externalGhost.teamName}</span></>
                }
              </div>
            ) : (
              <div className="text-[10px] mt-0.5 text-gray-400 italic">Drag onto a team or task...</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
