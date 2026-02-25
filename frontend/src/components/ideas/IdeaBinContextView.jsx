import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Settings, Globe, Plus, Layers, Tag, Lock, LinkIcon, LogIn, Crosshair, Users as UsersIcon, Folder as FolderIcon } from "lucide-react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { BASE_URL } from "../../config/api";

/**
 * IdeaBinContextView — "Categories & Contexts" mode.
 *
 * Layout mirrors the Ideas view:
 *   LEFT  – switchable sidebar showing either Categories or Legends (with creation + drag)
 *   RIGHT – canvas of draggable/resizable context windows containing placed categories AND legends
 *
 * Sidebar has a mode switcher ("Categories" / "Legends").
 * Items are dragged from the sidebar into context cards on the right.
 * Context cards display both placed categories and placed legends in separate sections.
 */

function authFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

export default forwardRef(function IdeaBinContextView({
  categories,          // {[id]: {id, name, ...}} — all user categories (non-archived)
  legends,             // [{id, name, ...}] — all user legends
  showCanvas,          // bool — whether the right canvas is visible (width-based)
  sidebarWidth,        // number — left sidebar width in px
  onCategoryCreated,   // callback — refresh categories after creating one
  onEnterContext,      // callback — enter a context (switch to ideas view filtered by context)
}, ref) {
  // ── Context state ──
  const [contexts, setContexts] = useState({});          // {[id]: {id, name, x, y, width, height, z_index, category_ids, legend_ids}}
  const [contextCatOrders, setContextCatOrders] = useState({}); // {[ctxId]: [catId, ...]}
  const [contextLegOrders, setContextLegOrders] = useState({}); // {[ctxId]: [legId, ...]}

  // ── Sidebar mode ──
  // (legends sidebar removed — only categories now)

  // ── Draw-to-create context mode ──
  const [drawContextMode, setDrawContextMode] = useState(false);
  const drawModeRef = useRef(false);
  useEffect(() => { drawModeRef.current = drawContextMode; }, [drawContextMode]);
  const [marquee, setMarquee] = useState(null);
  const marqueeRef = useRef(null);

  // ── Category creation (inside this view) ──
  const [displayCategoryForm, setDisplayCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPublic, setNewCategoryPublic] = useState(false);

  // ── UI state ──
  const [displayContextForm, setDisplayContextForm] = useState(false);
  const [newContextName, setNewContextName] = useState("");
  const [editingContextId, setEditingContextId] = useState(null);
  const [editingContextName, setEditingContextName] = useState("");
  const [contextSettingsOpen, setContextSettingsOpen] = useState(null);
  const [minimizedContexts, setMinimizedContexts] = useState({});

  // ── Expose formation-relevant state to parent via ref ──
  useImperativeHandle(ref, () => ({
    getFormationState: () => ({
      minimized_contexts: minimizedContexts,
      context_positions: Object.fromEntries(
        Object.entries(contexts).map(([id, ctx]) => [id, { x: ctx.x, y: ctx.y, width: ctx.width, height: ctx.height, z_index: ctx.z_index }])
      ),
    }),
    applyFormationState: (s) => {
      if (s.minimized_contexts) setMinimizedContexts(s.minimized_contexts);
    },
  }), [minimizedContexts, contexts]);

  // ── Drag state ──
  const [draggingItem, setDraggingItem] = useState(null); // {itemId, type: "category"|"legend", x, y}
  const [hoverContext, setHoverContext] = useState(null);
  const hoverContextRef = useRef(null);

  const contextContainerRef = useRef(null);
  const contextRefs = useRef({});

  // ── Fetch contexts on mount ──
  useEffect(() => {
    fetch_contexts();
  }, []);

  async function fetch_contexts() {
    try {
      const res = await authFetch(`${BASE_URL}/api/user/contexts/`);
      if (!res.ok) return;
      const data = await res.json();
      const ctxMap = {};
      const catOrderMap = {};
      const legOrderMap = {};
      data.forEach(ctx => {
        ctxMap[ctx.id] = ctx;
        catOrderMap[ctx.id] = ctx.category_ids || [];
        legOrderMap[ctx.id] = ctx.legend_ids || [];
      });
      setContexts(ctxMap);
      setContextCatOrders(catOrderMap);
      setContextLegOrders(legOrderMap);
    } catch (e) {
      console.error("Failed to fetch contexts", e);
    }
  }

  // ── Context CRUD ──
  async function create_context_api() {
    if (!newContextName.trim()) return;
    try {
      const res = await authFetch(`${BASE_URL}/api/user/contexts/create/`, {
        method: "POST",
        body: JSON.stringify({ name: newContextName.trim() }),
      });
      if (!res.ok) return;
      const ctx = await res.json();
      setContexts(prev => ({ ...prev, [ctx.id]: ctx }));
      setContextCatOrders(prev => ({ ...prev, [ctx.id]: [] }));
      setContextLegOrders(prev => ({ ...prev, [ctx.id]: [] }));
      setNewContextName("");
      setDisplayContextForm(false);
    } catch (e) {
      console.error("Failed to create context", e);
    }
  }

  async function create_context_at({ x, y, width, height }) {
    try {
      const res = await authFetch(`${BASE_URL}/api/user/contexts/create/`, {
        method: "POST",
        body: JSON.stringify({ name: "New Context", x, y, width: Math.max(120, width), height: Math.max(60, height) }),
      });
      if (!res.ok) return null;
      const ctx = await res.json();
      setContexts(prev => ({ ...prev, [ctx.id]: ctx }));
      setContextCatOrders(prev => ({ ...prev, [ctx.id]: [] }));
      setContextLegOrders(prev => ({ ...prev, [ctx.id]: [] }));
      return ctx.id;
    } catch (e) {
      console.error("Failed to create context at position", e);
      return null;
    }
  }

  async function rename_context_api(ctxId, name) {
    if (!name.trim()) return;
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/rename/`, {
        method: "POST",
        body: JSON.stringify({ context_id: ctxId, name: name.trim() }),
      });
      setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], name: name.trim() } }));
    } catch (e) {
      console.error("Failed to rename context", e);
    }
  }

  async function delete_context_api(ctxId) {
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/${ctxId}/delete/`, { method: "DELETE" });
      setContexts(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
      setContextCatOrders(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
      setContextLegOrders(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
    } catch (e) {
      console.error("Failed to delete context", e);
    }
  }

  async function set_context_position(ctxId, x, y) {
    setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], x, y } }));
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/set_position/`, {
        method: "POST",
        body: JSON.stringify({ context_id: ctxId, x, y }),
      });
    } catch (e) {
      console.error("Failed to set context position", e);
    }
  }

  async function set_context_area(ctxId, width, height) {
    setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], width, height } }));
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/set_area/`, {
        method: "POST",
        body: JSON.stringify({ context_id: ctxId, width, height }),
      });
    } catch (e) {
      console.error("Failed to set context area", e);
    }
  }

  async function bring_to_front_context(ctxId) {
    try {
      const res = await authFetch(`${BASE_URL}/api/user/contexts/bring_to_front/`, {
        method: "POST",
        body: JSON.stringify({ context_id: ctxId }),
      });
      if (!res.ok) return;
      const d = await res.json();
      setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], z_index: d.z_index } }));
    } catch (e) {
      console.error("Failed to bring context to front", e);
    }
  }

  // ── Category ↔ Context placement ──
  async function assign_category_to_context(catId, ctxId) {
    setContextCatOrders(prev => {
      const list = prev[ctxId] || [];
      if (list.includes(catId)) return prev;
      return { ...prev, [ctxId]: [...list, catId] };
    });
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/assign_category/`, {
        method: "POST",
        body: JSON.stringify({ category_id: catId, context_id: ctxId }),
      });
    } catch (e) {
      console.error("Failed to assign category to context", e);
      setContextCatOrders(prev => ({
        ...prev, [ctxId]: (prev[ctxId] || []).filter(id => id !== catId),
      }));
    }
  }

  async function remove_category_from_context(catId, ctxId) {
    setContextCatOrders(prev => ({
      ...prev, [ctxId]: (prev[ctxId] || []).filter(id => id !== catId),
    }));
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/remove_category/`, {
        method: "POST",
        body: JSON.stringify({ category_id: catId, context_id: ctxId }),
      });
    } catch (e) {
      console.error("Failed to remove category from context", e);
    }
  }

  // ── Legend ↔ Context placement ──
  async function assign_legend_to_context(legId, ctxId) {
    setContextLegOrders(prev => {
      const list = prev[ctxId] || [];
      if (list.includes(legId)) return prev;
      return { ...prev, [ctxId]: [...list, legId] };
    });
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/assign_legend/`, {
        method: "POST",
        body: JSON.stringify({ legend_id: legId, context_id: ctxId }),
      });
    } catch (e) {
      console.error("Failed to assign legend to context", e);
      setContextLegOrders(prev => ({
        ...prev, [ctxId]: (prev[ctxId] || []).filter(id => id !== legId),
      }));
    }
  }

  async function remove_legend_from_context(legId, ctxId) {
    setContextLegOrders(prev => ({
      ...prev, [ctxId]: (prev[ctxId] || []).filter(id => id !== legId),
    }));
    try {
      await authFetch(`${BASE_URL}/api/user/contexts/remove_legend/`, {
        method: "POST",
        body: JSON.stringify({ legend_id: legId, context_id: ctxId }),
      });
    } catch (e) {
      console.error("Failed to remove legend from context", e);
    }
  }

  // ── Toggle public / drop adopted ──
  async function toggle_public_context(ctxId) {
    try {
      const res = await authFetch(`${BASE_URL}/api/user/contexts/toggle_public/`, {
        method: "POST",
        body: JSON.stringify({ id: ctxId }),
      });
      if (res.ok) {
        const data = await res.json();
        setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], is_public: data.is_public } }));
      }
    } catch (e) {
      console.error("Failed to toggle public context", e);
    }
  }

  async function drop_adopted_context(ctxId) {
    try {
      await authFetch(`${BASE_URL}/api/contexts/${ctxId}/drop/`, { method: "DELETE" });
      setContexts(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
      setContextCatOrders(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
      setContextLegOrders(prev => { const u = { ...prev }; delete u[ctxId]; return u; });
    } catch (e) {
      console.error("Failed to drop adopted context", e);
    }
  }

  // ── Category creation ──
  async function create_category_api() {
    if (!newCategoryName.trim()) return;
    try {
      await authFetch(`${BASE_URL}/api/user/categories/create/`, {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName.trim(), is_public: newCategoryPublic }),
      });
      setNewCategoryName("");
      setNewCategoryPublic(false);
      setDisplayCategoryForm(false);
      if (onCategoryCreated) onCategoryCreated();
    } catch (e) {
      console.error("Failed to create category", e);
    }
  }

  // ── Drag handlers ──
  function handleContextDrag(e, ctxId) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const ctx = contexts[ctxId];
    const origX = ctx.x;
    const origY = ctx.y;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], x: origX + dx, y: origY + dy } }));
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      set_context_position(ctxId, origX + dx, origY + dy);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleContextResize(e, ctxId) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const ctx = contexts[ctxId];
    const origW = ctx.width;
    const origH = ctx.height;

    const onMove = (ev) => {
      const newW = Math.max(120, origW + (ev.clientX - startX));
      const newH = Math.max(60, origH + (ev.clientY - startY));
      setContexts(prev => ({ ...prev, [ctxId]: { ...prev[ctxId], width: newW, height: newH } }));
    };
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const newW = Math.max(120, origW + (ev.clientX - startX));
      const newH = Math.max(60, origH + (ev.clientY - startY));
      set_context_area(ctxId, newW, newH);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleItemDragFromSidebar(e, itemId, type) {
    e.preventDefault();
    setDraggingItem({ itemId, type, x: e.clientX, y: e.clientY });

    const onMove = (ev) => {
      setDraggingItem(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);
      // Detect hover over context cards — check highest z_index first
      let foundCtx = null;
      const sortedCtxs = Object.entries(contexts)
        .sort(([, a], [, b]) => (b.z_index || 0) - (a.z_index || 0));
      for (const [ctxId] of sortedCtxs) {
        const el = contextRefs.current[ctxId];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
            foundCtx = ctxId;
            break;
          }
        }
      }
      setHoverContext(foundCtx);
      hoverContextRef.current = foundCtx;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (hoverContextRef.current) {
        const targetCtxId = parseInt(hoverContextRef.current);
        const targetCtx = contexts[targetCtxId];
        // Only allow dropping into owned contexts, not adopted ones
        if (targetCtx && !targetCtx.adopted) {
          if (type === "category") {
            assign_category_to_context(itemId, targetCtxId);
          } else if (type === "legend") {
            assign_legend_to_context(itemId, targetCtxId);
          }
        }
      }
      setDraggingItem(null);
      setHoverContext(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Draw-to-create marquee handler ──
  const handleCanvasMarqueeStart = useCallback((e) => {
    if (e.target.closest('[data-context-card]')) return;
    if (e.button !== 0) return;
    if (!drawModeRef.current) return;
    const rect = contextContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = contextContainerRef.current.scrollLeft;
    const scrollTop = contextContainerRef.current.scrollTop;
    const startX = e.clientX - rect.left + scrollLeft;
    const startY = e.clientY - rect.top + scrollTop;
    setMarquee({ startX, startY, currentX: startX, currentY: startY });
    marqueeRef.current = { startX, startY };
    let lastX = startX;
    let lastY = startY;

    const handleMouseMove = (moveE) => {
      const cx = moveE.clientX - rect.left + contextContainerRef.current.scrollLeft;
      const cy = moveE.clientY - rect.top + contextContainerRef.current.scrollTop;
      lastX = cx;
      lastY = cy;
      setMarquee(prev => prev ? { ...prev, currentX: cx, currentY: cy } : null);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setMarquee(null);

      const mx1 = Math.min(startX, lastX);
      const my1 = Math.min(startY, lastY);
      const mx2 = Math.max(startX, lastX);
      const my2 = Math.max(startY, lastY);
      const area = (mx2 - mx1) * (my2 - my1);
      if (area < 100) return;

      const w = mx2 - mx1;
      const h = my2 - my1;
      if (w >= 80 && h >= 50) {
        create_context_at({ x: Math.round(mx1), y: Math.round(my1 - 36), width: Math.round(w), height: Math.round(h) })
          .then((newCtxId) => {
            if (newCtxId) {
              setEditingContextId(String(newCtxId));
              setEditingContextName("New Context");
              setDrawContextMode(false);
              setDisplayContextForm(false);
            }
          })
          .catch(err => console.error("Draw-to-create context failed:", err));
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  // ── Computed ──
  const allPlacedCategoryIds = new Set();
  Object.values(contextCatOrders).forEach(ids => ids.forEach(id => allPlacedCategoryIds.add(id)));

  const allPlacedLegendIds = new Set();
  Object.values(contextLegOrders).forEach(ids => ids.forEach(id => allPlacedLegendIds.add(id)));

  const allCategories = Object.values(categories).filter(c => !c.archived);
  const unplacedCategories = allCategories.filter(c => !allPlacedCategoryIds.has(c.id));
  const placedCategories = allCategories.filter(c => allPlacedCategoryIds.has(c.id));

  const allLegends = legends || [];
  const unplacedLegends = allLegends.filter(l => !allPlacedLegendIds.has(l.id));
  const placedLegends = allLegends.filter(l => allPlacedLegendIds.has(l.id));

  const activeContexts = Object.entries(contexts);

  // Build legend lookup
  const legendMap = {};
  allLegends.forEach(l => { legendMap[l.id] = l; });

  return (
    <>
      {/* ── LEFT: Sidebar ── */}
      <div
        className="flex flex-col flex-shrink-0 bg-white"
        style={{ width: showCanvas ? sidebarWidth : "100%" }}
      >
        {/* Sidebar header */}
        <div className="p-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-1 mb-1">
            <Layers size={12} className="text-teal-600" />
            <span className="text-[11px] font-semibold text-teal-800">Categories</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Drag categories into contexts on the right
          </p>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto p-1.5">

            <>
              {/* Create category button / form */}
              <div className="mb-2">
                {displayCategoryForm ? (
                  <div className="flex flex-col gap-1 p-1.5 bg-amber-50 border border-amber-200 rounded">
                    <input
                      autoFocus
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") create_category_api();
                        else if (e.key === "Escape") { setDisplayCategoryForm(false); setNewCategoryName(""); }
                      }}
                      placeholder="Category name..."
                      className="text-xs px-2 py-1 border border-gray-300 rounded outline-none focus:border-amber-400"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCategoryPublic}
                          onChange={e => setNewCategoryPublic(e.target.checked)}
                          className="w-3 h-3"
                        />
                        <Globe size={9} /> Public
                      </label>
                      <div className="flex gap-1">
                        <button onClick={create_category_api} className="text-[10px] px-2 py-0.5 bg-amber-400 text-white rounded hover:bg-amber-500 font-medium">Create</button>
                        <button onClick={() => { setDisplayCategoryForm(false); setNewCategoryName(""); }} className="text-[10px] px-2 py-0.5 bg-gray-200 rounded hover:bg-gray-300">✕</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setDisplayCategoryForm(true)}
                    className="w-full text-[10px] px-2 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded hover:bg-amber-100 font-medium flex items-center justify-center gap-1"
                  >
                    <Plus size={10} /> New Category
                  </button>
                )}
              </div>

              {/* Unplaced categories */}
              {unplacedCategories.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold text-gray-400 mb-1 px-1">
                    Unassigned ({unplacedCategories.length})
                  </div>
                  {unplacedCategories.map(cat => (
                    <div
                      key={cat.id}
                      onMouseDown={(e) => handleItemDragFromSidebar(e, cat.id, "category")}
                      className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5 rounded cursor-grab active:cursor-grabbing
                        bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-[11px]"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="truncate font-medium text-gray-700">{cat.name}</span>
                      {cat.is_public && <Globe size={9} className="text-emerald-600 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Placed categories */}
              {placedCategories.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 mb-1 px-1">
                    In Contexts ({placedCategories.length})
                  </div>
                  {placedCategories.map(cat => {
                    const inContexts = Object.entries(contextCatOrders)
                      .filter(([, ids]) => ids.includes(cat.id))
                      .map(([ctxId]) => contexts[ctxId]?.name)
                      .filter(Boolean);
                    return (
                      <div
                        key={cat.id}
                        onMouseDown={(e) => handleItemDragFromSidebar(e, cat.id, "category")}
                        className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5 rounded cursor-grab active:cursor-grabbing
                          bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors text-[11px]"
                      >
                        <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                        <span className="truncate font-medium text-gray-700 flex-1">{cat.name}</span>
                        <span className="text-[9px] text-teal-600 truncate max-w-[80px]">
                          {inContexts.join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {allCategories.length === 0 && (
                <p className="text-[10px] text-gray-400 text-center py-4">
                  No categories yet. Use "+ New Category" above.
                </p>
              )}
            </>
        </div>
      </div>

      {/* ── RIGHT: Context canvas ── */}
      {showCanvas && (
        <>
          <div
            ref={contextContainerRef}
            className={`flex-1 relative overflow-auto bg-gray-50 ${drawContextMode ? "cursor-crosshair" : ""}`}
            onMouseDown={handleCanvasMarqueeStart}
          >
            {/* Draw mode hint */}
            {drawContextMode && (
              <div className="absolute inset-0 border-2 border-dashed border-teal-400/40 pointer-events-none z-[5]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-100/80 text-teal-700 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap select-none">
                  Draw a rectangle to create a context
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="sticky top-0 z-30 flex items-center gap-2 p-2 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
              {displayContextForm ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    autoFocus
                    value={newContextName}
                    onChange={e => setNewContextName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") create_context_api();
                      else if (e.key === "Escape") { setDisplayContextForm(false); setNewContextName(""); }
                    }}
                    placeholder="Context name..."
                    className="text-xs px-2 py-1 border border-gray-300 rounded outline-none flex-1 focus:border-teal-400"
                  />
                  <button onClick={create_context_api} className="text-[10px] px-2 py-1 bg-teal-400 text-white rounded hover:bg-teal-500 font-medium">
                    Create
                  </button>
                  <button onClick={() => { setDisplayContextForm(false); setNewContextName(""); }} className="text-[10px] px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setDisplayContextForm(true)}
                    className="text-[10px] px-2 py-1 bg-teal-100 text-teal-800 border border-teal-300 rounded hover:bg-teal-200 font-medium"
                  >
                    + Context
                  </button>
                  <button
                    onClick={() => setDrawContextMode(prev => !prev)}
                    className={`text-[10px] px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                      drawContextMode
                        ? "bg-teal-500 text-white border border-teal-600"
                        : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                    }`}
                    title={drawContextMode ? "Exit draw mode (Esc)" : "Draw context on canvas"}
                  >
                    <Crosshair size={11} />
                    {drawContextMode ? "Drawing..." : "Draw"}
                  </button>
                </>
              )}
            </div>

            {/* Draw marquee rectangle */}
            {marquee && (() => {
              const mx = Math.min(marquee.startX, marquee.currentX);
              const my = Math.min(marquee.startY, marquee.currentY);
              const mw = Math.abs(marquee.currentX - marquee.startX);
              const mh = Math.abs(marquee.currentY - marquee.startY);
              return (
                <div
                  style={{ position: "absolute", left: mx, top: my, width: mw, height: mh, zIndex: 50 }}
                  className="border-2 border-dashed border-teal-500 bg-teal-200/20 pointer-events-none rounded"
                />
              );
            })()}

            {/* Context cards */}
            {activeContexts.map(([ctxKey, ctxData]) => {
              const catIds = contextCatOrders[ctxKey] || [];
              const legIds = contextLegOrders[ctxKey] || [];
              const isHovered = draggingItem && String(hoverContext) === String(ctxKey);

              return (
                <div
                  key={ctxKey}
                  ref={el => (contextRefs.current[ctxKey] = el)}
                  style={{
                    left: ctxData.x,
                    top: ctxData.y + 36,
                    width: ctxData.width,
                    height: ctxData.height,
                    zIndex: ctxData.z_index || 0,
                    backgroundColor: isHovered
                      ? (ctxData.adopted ? "#c7d2fe" : "#99f6e4")
                      : (ctxData.adopted ? "#e0e7ff" : "#ccfbf1"),
                    transition: "background-color 150ms ease",
                  }}
                  className="absolute shadow-lg rounded p-1.5 flex flex-col"
                  data-context-card
                  onMouseDown={() => bring_to_front_context(ctxKey)}
                >
                  {/* Context header */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      bring_to_front_context(ctxKey);
                      handleContextDrag(e, ctxKey);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!ctxData.adopted) {
                        setEditingContextId(ctxKey);
                        setEditingContextName(ctxData.name);
                      }
                    }}
                    className={`flex justify-between items-center mb-0.5 flex-shrink-0 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b ${
                      ctxData.adopted
                        ? "bg-indigo-300/50 border-indigo-400/40"
                        : "bg-teal-300/50 border-teal-400/40"
                    }`}
                  >
                    {editingContextId === ctxKey ? (
                      <input
                        autoFocus
                        value={editingContextName}
                        onChange={e => setEditingContextName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { rename_context_api(ctxKey, editingContextName); setEditingContextId(null); }
                          else if (e.key === "Escape") setEditingContextId(null);
                        }}
                        onBlur={() => { rename_context_api(ctxKey, editingContextName); setEditingContextId(null); }}
                        onMouseDown={e => e.stopPropagation()}
                        className="bg-white text-[11px] font-semibold px-1 py-0.5 rounded outline-none border border-blue-400 flex-1 mr-1"
                      />
                    ) : (
                      <span className="font-semibold text-[11px] truncate flex items-center gap-1">
                        {ctxData.is_public && <Globe size={9} className="text-emerald-600 flex-shrink-0" />}
                        {ctxData.name}
                        {ctxData.adopted && (
                          <span className="text-[8px] text-indigo-500 font-normal ml-0.5">({ctxData.owner_username})</span>
                        )}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <div className="relative">
                        <Settings
                          size={12}
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextSettingsOpen(prev => prev === ctxKey ? null : ctxKey);
                          }}
                          className="text-teal-700 hover:text-teal-900 cursor-pointer"
                        />
                        {contextSettingsOpen === ctxKey && (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setContextSettingsOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-xl border border-gray-200 z-[61] min-w-[140px] py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (minimizedContexts[ctxKey]) {
                                    const orig = minimizedContexts[ctxKey];
                                    setContexts(prev => ({ ...prev, [ctxKey]: { ...prev[ctxKey], width: orig.width, height: orig.height } }));
                                    set_context_area(ctxKey, orig.width, orig.height);
                                    setMinimizedContexts(prev => { const u = { ...prev }; delete u[ctxKey]; return u; });
                                  } else {
                                    const minW = Math.max(80, ctxData.name.length * 9 + 60);
                                    setMinimizedContexts(prev => ({ ...prev, [ctxKey]: { width: ctxData.width, height: ctxData.height } }));
                                    setContexts(prev => ({ ...prev, [ctxKey]: { ...prev[ctxKey], width: minW, height: 30 } }));
                                    set_context_area(ctxKey, minW, 30);
                                  }
                                  setContextSettingsOpen(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <span className="text-[10px]">{minimizedContexts[ctxKey] ? "◻" : "—"}</span>
                                {minimizedContexts[ctxKey] ? "Restore size" : "Collapse card"}
                              </button>
                              {/* Enter context */}
                              {onEnterContext && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContextSettingsOpen(null);
                                    onEnterContext({
                                      id: parseInt(ctxKey),
                                      name: ctxData.name,
                                      color: ctxData.color || null,
                                      category_ids: contextCatOrders[ctxKey] || [],
                                      legend_ids: contextLegOrders[ctxKey] || [],
                                      filter_state: ctxData.filter_state || null,
                                    });
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[11px] text-teal-700 hover:bg-teal-50 flex items-center gap-2 font-medium"
                                >
                                  <LogIn size={11} />
                                  Enter context
                                </button>
                              )}
                              {/* Toggle public — only for owned contexts */}
                              {!ctxData.adopted && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggle_public_context(ctxKey);
                                    setContextSettingsOpen(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {ctxData.is_public ? <Lock size={11} /> : <Globe size={11} />}
                                  {ctxData.is_public ? "Make private" : "Make public"}
                                </button>
                              )}
                              {/* Delete — only for owned contexts */}
                              {!ctxData.adopted && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContextSettingsOpen(null);
                                    delete_context_api(ctxKey);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <DeleteForeverIcon style={{ fontSize: 13 }} />
                                  Delete context
                                </button>
                              )}
                              {/* Unadopt — only for adopted contexts */}
                              {ctxData.adopted && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContextSettingsOpen(null);
                                    drop_adopted_context(ctxKey);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <LinkIcon size={11} />
                                  Unadopt context
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content inside context card: categories + legends */}
                  <div
                    className="flex-1 overflow-y-auto overflow-x-hidden"
                    onMouseDown={e => e.stopPropagation()}
                  >
                    {/* Categories section */}
                    {catIds.length > 0 && (
                      <div className="mb-1">
                        <div className="text-[9px] font-semibold text-amber-600/70 uppercase tracking-wide px-1 mb-0.5">
                          Categories
                        </div>
                        {catIds.map((catId) => {
                          const cat = categories[catId];
                          if (!cat) return null;
                          return (
                            <div
                              key={catId}
                              className="flex items-center justify-between px-1.5 py-1 mb-0.5 rounded
                                bg-amber-50 border border-amber-200 text-[11px] group"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="truncate font-medium text-gray-700">{cat.name}</span>
                                {cat.is_public && <Globe size={9} className="text-emerald-600 flex-shrink-0" />}
                              </div>
                              {!ctxData.adopted && (
                                <button
                                  onClick={() => remove_category_from_context(catId, parseInt(ctxKey))}
                                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  title="Remove from context"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Legends section */}
                    {legIds.length > 0 && (
                      <div className="mb-1">
                        <div className="text-[9px] font-semibold text-indigo-600/70 uppercase tracking-wide px-1 mb-0.5">
                          Legends
                        </div>
                        {legIds.map((legId) => {
                          const leg = legendMap[legId];
                          if (!leg) return null;
                          return (
                            <div
                              key={legId}
                              className="flex items-center justify-between px-1.5 py-1 mb-0.5 rounded
                                bg-indigo-50 border border-indigo-200 text-[11px] group"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Tag size={10} className="text-indigo-400 flex-shrink-0" />
                                <span className="truncate font-medium text-gray-700">{leg.name}</span>
                              </div>
                              {!ctxData.adopted && (
                                <button
                                  onClick={() => remove_legend_from_context(legId, parseInt(ctxKey))}
                                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  title="Remove from context"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {catIds.length === 0 && legIds.length === 0 && (
                      <p className="text-[10px] text-gray-400 text-center py-3">
                        {ctxData.adopted ? "No categories or legends" : "Drag categories or legends here"}
                      </p>
                    )}

                    {/* Contributors footer — projects & users */}
                    {((ctxData.included_projects && ctxData.included_projects.length > 0) ||
                      (ctxData.contributing_users && ctxData.contributing_users.length > 1)) && (
                      <div className="mt-auto pt-1 border-t border-gray-300/30">
                        {ctxData.included_projects && ctxData.included_projects.length > 0 && (
                          <div className="flex items-center gap-1 px-1 py-0.5">
                            <FolderIcon size={8} className="text-gray-400 flex-shrink-0" />
                            <span className="text-[8px] text-gray-400 truncate" title={ctxData.included_projects.map(p => p.name).join(", ")}>
                              {ctxData.included_projects.map(p => p.name).join(", ")}
                            </span>
                          </div>
                        )}
                        {ctxData.contributing_users && ctxData.contributing_users.length > 1 && (
                          <div className="flex items-center gap-1 px-1 py-0.5">
                            <UsersIcon size={8} className="text-gray-400 flex-shrink-0" />
                            <span className="text-[8px] text-gray-400 truncate" title={ctxData.contributing_users.map(u => u.username).join(", ")}>
                              {ctxData.contributing_users.map(u => u.username).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resize grip */}
                  <div
                    onMouseDown={(e) => handleContextResize(e, ctxKey)}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center"
                  >
                    <span className="text-[8px] leading-none select-none text-teal-600/60">◢</span>
                  </div>
                </div>
              );
            })}

            {activeContexts.length === 0 && !displayContextForm && (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-gray-400">
                  Click "+ Context" to create your first context
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Drag ghost */}
      {draggingItem && (
        <div
          style={{
            position: "fixed",
            left: draggingItem.x,
            top: draggingItem.y,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 99999,
          }}
          className={`px-2 py-1 rounded shadow-lg text-[10px] font-semibold whitespace-nowrap ${
            draggingItem.type === "category"
              ? "bg-amber-200 border border-amber-400 text-amber-800"
              : "bg-indigo-200 border border-indigo-400 text-indigo-800"
          }`}
        >
          {draggingItem.type === "category"
            ? categories[draggingItem.itemId]?.name || "Category"
            : legendMap[draggingItem.itemId]?.name || "Legend"
          }
        </div>
      )}
    </>
  );
})
