import { useState, useCallback, useRef, useEffect } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { Copy, Settings, Globe, Lock, UserRound, LinkIcon, PanelTopDashed, Pencil, Type, X, RotateCcw, ArrowDownUp, BookOpenText, Rss, ListOrdered, Filter, AlertTriangle } from "lucide-react";
import FeedFilterPanel from "./FeedFilterPanel";

/**
 * RIGHT panel – category toolbar + draggable/resizable category cards.
 * Pure presentational; all mutation callbacks come from props.
 */
export default function IdeaBinCategoryCanvas({
  onCanvasMouseDown,
  categoryContainerRef,
  displayCategoryForm, setDisplayCategoryForm,
  newCategoryName, setNewCategoryName,
  newCategoryPublic, setNewCategoryPublic,
  create_category_api,
  create_category_at,
  drawCategoryMode, setDrawCategoryMode,
  archivedCategories,
  dockedCategories, setDockedCategories,
  showArchive, setShowArchive,
  toggle_archive_category,
  toggle_public_category,
  drop_adopted_category,
  delete_category,
  setConfirmModal,
  activeCategories,
  categoryOrders,
  dragging,
  hoverCategory,
  selectedCategoryIds, setSelectedCategoryIds,
  bring_to_front_category,
  handleCategoryDrag,
  editingCategoryId, setEditingCategoryId,
  editingCategoryName, setEditingCategoryName,
  rename_category_api,
  copiedIdeaId,
  paste_idea,
  categorySettingsOpen, setCategorySettingsOpen,
  collapsedIdeas, setCollapsedIdeas,
  minimizedCategories, setMinimizedCategories,
  categories, setCategories,
  set_area_category,
  categoryRefs,
  globalTypeFilter,
  passesAllFilters,
  ideas,
  dims,
  renderIdeaItem,
  handleCategoryResize,
  refactorMode,
  mergeCategoryTarget,
  contextColor,
  headlineModeCategoryId,
  setHeadlineModeCategoryId,
  headlineModeIdeaId,
  setHeadlineModeIdeaId,
  update_idea_title_api,
  selectedIdeaIds,
  setSelectedIdeaIds,
  refetchCategoryByFilter,
  toggleLiveCategory,
  requestToggleLive,
  liveCategoryIds,
  setCategoryFilterConfig,
  detectCRConflicts,
  setCrConflictData,
  crConflictsByCat,
  legendFilters,
  filterCombineMode,
  filterPresets,
  paintType,
  setPaintType,
  assign_idea_legend_type,
  batch_assign_idea_legend_type,
  showOrderNumbers,
  setShowOrderNumbers,
}) {
  // Local state for headline-mode draft headlines (keyed by ideaId)
  const [draftHeadlines, setDraftHeadlines] = useState({});
  const saveTimerRef = useRef({});

  // Feed Filter panel state – which category key has its panel open (null = closed)
  const [feedFilterOpen, setFeedFilterOpen] = useState(null);

  // "define" = manual order with drag-to-reorder, "description" = auto-sorted by position in description
  const [headlineOrderMode, setHeadlineOrderMode] = useState("define");

  // Filter drag-drop target state
  const [filterDropTarget, setFilterDropTarget] = useState(null); // catKey being hovered with a filter

  // Drag-to-reorder state
  const dragItemRef = useRef(null);   // { ideaId, index }
  const dragOverRef = useRef(null);   // { ideaId, index }

  // Auto-save title with small debounce to batch rapid clicks
  const updateDraftAndSave = useCallback((ideaId, newTitle, idea) => {
    setDraftHeadlines(prev => ({ ...prev, [ideaId]: newTitle }));
    // Debounce the API call
    if (saveTimerRef.current[ideaId]) clearTimeout(saveTimerRef.current[ideaId]);
    saveTimerRef.current[ideaId] = setTimeout(() => {
      update_idea_title_api(ideaId, newTitle);
    }, 400);
  }, [update_idea_title_api]);

  // ── Feed Filter panel helpers ──
  const openFeedFilter = useCallback((catKey) => {
    setFeedFilterOpen(prev => (prev === catKey ? null : catKey));
  }, []);

  // Close feed-filter panel when clicking elsewhere (uses effect)
  const feedFilterRef = useRef(null);
  useEffect(() => {
    if (!feedFilterOpen) return;
    const handler = (e) => {
      if (feedFilterRef.current && !feedFilterRef.current.contains(e.target)) {
        setFeedFilterOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [feedFilterOpen]);

  // ── Marquee selection state ──
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY } or null
  const marqueeRef = useRef(null);
  const marqueeJustFinishedRef = useRef(false);

  // ── Draw-to-create ref (stable ref for the callback) ──
  const drawModeRef = useRef(false);
  useEffect(() => { drawModeRef.current = drawCategoryMode; }, [drawCategoryMode]);

  // ── Idea marquee inside categories ──
  const [ideaMarquee, setIdeaMarquee] = useState(null); // { x1, y1, x2, y2 } in client coords
  const ideaMarqueeRef = useRef(null);

  const handleMarqueeStart = useCallback((e) => {
    // Only start marquee on direct canvas background click (not on cards)
    if (e.target.closest('[data-category-card]') || e.target.closest('[data-headline-builder]')) return;
    if (e.button !== 0) return; // left click only
    const rect = categoryContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = categoryContainerRef.current.scrollLeft;
    const scrollTop = categoryContainerRef.current.scrollTop;
    const startX = e.clientX - rect.left + scrollLeft;
    const startY = e.clientY - rect.top + scrollTop;
    const isDrawMode = drawModeRef.current;
    setMarquee({ startX, startY, currentX: startX, currentY: startY, isDrawMode });
    marqueeRef.current = { startX, startY, ctrlKey: e.ctrlKey || e.metaKey, isDrawMode };

    const handleMouseMove = (moveE) => {
      const cx = moveE.clientX - rect.left + categoryContainerRef.current.scrollLeft;
      const cy = moveE.clientY - rect.top + categoryContainerRef.current.scrollTop;
      setMarquee(prev => prev ? { ...prev, currentX: cx, currentY: cy } : null);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setMarquee(prev => {
        if (!prev) return null;
        const mx1 = Math.min(prev.startX, prev.currentX);
        const my1 = Math.min(prev.startY, prev.currentY);
        const mx2 = Math.max(prev.startX, prev.currentX);
        const my2 = Math.max(prev.startY, prev.currentY);
        const area = (mx2 - mx1) * (my2 - my1);
        if (area < 100) return null; // too small = just a click

        // ── Draw-to-create category mode ──
        if (prev.isDrawMode) {
          const w = mx2 - mx1;
          const h = my2 - my1;
          if (w >= 80 && h >= 50) {
            create_category_at({ x: Math.round(mx1), y: Math.round(my1), width: Math.round(w), height: Math.round(h) })
              .then((newCatId) => {
                if (newCatId) {
                  // Put the new category into edit mode so user can name it
                  setEditingCategoryId(String(newCatId));
                  setEditingCategoryName("New Category");
                  // Exit draw mode
                  setDrawCategoryMode(false);
                  setDisplayCategoryForm(false);
                }
              })
              .catch(err => console.error("Draw-to-create failed:", err));
          }
          return null;
        }

        // ── Normal marquee selection ──
        const hit = [];
        activeCategories.forEach(([catKey, catData]) => {
          const cx = catData.x;
          const cy = catData.y + 36;
          const cw = catData.width;
          const ch = catData.height;
          if (cx + cw > mx1 && cx < mx2 && cy + ch > my1 && cy < my2) {
            hit.push(catKey);
          }
        });
        if (hit.length > 0) {
          marqueeJustFinishedRef.current = true;
          setTimeout(() => { marqueeJustFinishedRef.current = false; }, 0);
          if (marqueeRef.current?.ctrlKey) {
            setSelectedCategoryIds(old => {
              const next = new Set(old);
              hit.forEach(id => next.add(id));
              return next;
            });
          } else {
            setSelectedCategoryIds(new Set(hit));
          }
        }
        return null;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [activeCategories, categoryContainerRef, setSelectedCategoryIds, create_category_at, setDrawCategoryMode, setDisplayCategoryForm, setEditingCategoryId, setEditingCategoryName]);

  // ── Idea marquee start handler ──
  const handleIdeaMarqueeStart = useCallback((e, catKey) => {
    if (e.target.closest('[data-idea-item]') || e.target.closest('[data-headline-builder]')) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    setIdeaMarquee({ x1: startX, y1: startY, x2: startX, y2: startY });
    ideaMarqueeRef.current = { catKey, ctrlKey: e.ctrlKey || e.metaKey };

    const handleMouseMove = (moveE) => {
      setIdeaMarquee(prev => prev ? { ...prev, x2: moveE.clientX, y2: moveE.clientY } : null);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIdeaMarquee(prev => {
        if (!prev) return null;
        const container = categoryRefs.current[ideaMarqueeRef.current?.catKey];
        if (!container) return null;
        const mx1 = Math.min(prev.x1, prev.x2);
        const my1 = Math.min(prev.y1, prev.y2);
        const mx2 = Math.max(prev.x1, prev.x2);
        const my2 = Math.max(prev.y1, prev.y2);
        const area = (mx2 - mx1) * (my2 - my1);
        if (area < 100) {
          // Click on empty space inside category → deselect all ideas & exit paint mode
          setSelectedIdeaIds(new Set());
          if (paintType) setPaintType(null);
          return null;
        }
        const ideaElements = container.querySelectorAll('[data-idea-id]');
        const hitIds = [];
        ideaElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > mx1 && rect.left < mx2 && rect.bottom > my1 && rect.top < my2) {
            const id = el.getAttribute('data-idea-id');
            hitIds.push(Number(id) || id);
          }
        });
        if (hitIds.length > 0) {
          // Paint mode: assign type to all marquee-hit ideas
          if (paintType && batch_assign_idea_legend_type) {
            batch_assign_idea_legend_type(hitIds, paintType.typeId, dims);
          } else if (ideaMarqueeRef.current?.ctrlKey) {
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [categoryRefs, setSelectedIdeaIds, paintType, setPaintType, batch_assign_idea_legend_type, dims]);

  // Click anywhere on the canvas background → deselect everything & exit headline/paint mode
  const handleCanvasClick = useCallback((e) => {
    if (marqueeJustFinishedRef.current) return;
    if (e.target.closest('[data-headline-builder]')) return;
    if (e.target.closest('[data-category-card]')) return;
    // Clear all selections
    setSelectedCategoryIds(new Set());
    setSelectedIdeaIds(new Set());
    // Exit paint mode
    if (paintType) setPaintType(null);
    // Exit headline mode
    if (headlineModeCategoryId || headlineModeIdeaId) {
      setHeadlineModeCategoryId(null);
      setHeadlineModeIdeaId(null);
      setDraftHeadlines({});
    }
  }, [headlineModeCategoryId, headlineModeIdeaId, setHeadlineModeCategoryId, setHeadlineModeIdeaId, setSelectedCategoryIds, setSelectedIdeaIds, paintType, setPaintType]);

  return (
    <div
      ref={categoryContainerRef}
      className={`flex-1 relative overflow-auto bg-gray-50 ${drawCategoryMode ? "cursor-crosshair" : ""}`}
      onClick={handleCanvasClick}
      onMouseDown={(e) => { onCanvasMouseDown?.(); handleMarqueeStart(e); }}
    >
      {/* Draw-mode hint */}
      {drawCategoryMode && !marquee && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[9998] bg-amber-100 text-amber-800 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm pointer-events-none animate-pulse">
          Draw a rectangle to create a category — or use the form above
        </div>
      )}
      {/* Category marquee / draw overlay */}
      {marquee && (() => {
        const x = Math.min(marquee.startX, marquee.currentX);
        const y = Math.min(marquee.startY, marquee.currentY);
        const w = Math.abs(marquee.currentX - marquee.startX);
        const h = Math.abs(marquee.currentY - marquee.startY);
        const isDrawing = marquee.isDrawMode;
        return w * h > 100 ? (
          <div
            style={{ left: x, top: y, width: w, height: h }}
            className={`absolute border-2 rounded pointer-events-none z-[9999] ${
              isDrawing
                ? "border-amber-500 bg-amber-100/30 shadow-lg"
                : "border-indigo-400 bg-indigo-100/20"
            }`}
          >
            {isDrawing && w >= 80 && h >= 50 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50/90 px-2 py-0.5 rounded">
                  {Math.round(w)} × {Math.round(h)}
                </span>
              </div>
            )}
          </div>
        ) : null;
      })()}
      {/* Idea marquee overlay (fixed position, rendered above everything) */}
      {ideaMarquee && (() => {
        const x = Math.min(ideaMarquee.x1, ideaMarquee.x2);
        const y = Math.min(ideaMarquee.y1, ideaMarquee.y2);
        const w = Math.abs(ideaMarquee.x2 - ideaMarquee.x1);
        const h = Math.abs(ideaMarquee.y2 - ideaMarquee.y1);
        return w * h > 100 ? (
          <div
            style={{
              position: 'fixed', left: x, top: y, width: w, height: h,
              ...(paintType ? { borderColor: paintType.color, backgroundColor: `${paintType.color}20` } : {}),
            }}
            className={`border-2 rounded pointer-events-none z-[9999] ${paintType ? "" : "border-blue-400 bg-blue-100/20"}`}
          />
        ) : null;
      })()}
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center gap-2 p-2">
          {archivedCategories.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="text-[10px] px-2 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 flex items-center gap-1"
              >
                <ArchiveIcon style={{ fontSize: 12 }} />
                {archivedCategories.length}
              </button>
              {/* Archive dropdown */}
              {showArchive && (
                <>
                  <div className="fixed inset-0 z-[39]" onClick={() => setShowArchive(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[180px] max-h-[200px] overflow-y-auto">
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
                </>
              )}
            </div>
          )}

          {/* ── Docked categories chips (inline with buttons) ── */}
          {dockedCategories.length > 0 && (
            <div
              className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
              onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY; }}
            >
              {dockedCategories.map(catId => {
                const cat = categories[catId];
                if (!cat || cat.archived) return null;
                const isAdopted = cat.adopted;
                const isFed = !!cat.filter_config;
                return (
                  <button
                    key={catId}
                    onClick={() => setDockedCategories(prev => prev.filter(id => id !== catId))}
                    title={`Click to restore "${cat.name}" to canvas`}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 ${
                      isFed
                        ? "bg-blue-50 text-blue-700 border border-dashed border-blue-400 hover:bg-blue-100"
                        : isAdopted
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-300 hover:bg-indigo-100"
                          : "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                    }`}
                  >
                    {isFed && <Filter size={8} className="text-blue-500 flex-shrink-0" />}
                    {cat.name}
                    {isAdopted && (
                      <span className="text-[8px] text-indigo-400">
                        <UserRound size={7} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category cards */}
      {activeCategories.map(([catKey, catData]) => {
        const catIdeas = categoryOrders[catKey] || [];
        const isHovered = dragging && String(hoverCategory) === String(catKey);
        const isSelected = selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey));
        const isAdopted = catData.adopted;
        const isMergeTarget = refactorMode && mergeCategoryTarget === catKey;
        const hasConstantFilter = !!catData.filter_config;

        return (
          <div
            key={catKey}
            style={{
              left: catData.x, top: catData.y + 36,
              width: catData.width, height: catData.height,
              zIndex: catData.z_index || 0,
              backgroundColor: isMergeTarget
                ? "#fef3e2"
                : hasConstantFilter
                  ? (isHovered ? "#dbeafe" : isSelected ? "#e0f2fe" : "#eff6ff")
                  : contextColor && isSelected
                    ? `color-mix(in srgb, ${contextColor} 18%, #ffffff)`
                    : contextColor && isHovered
                      ? `color-mix(in srgb, ${contextColor} 22%, #ffffff)`
                      : isAdopted
                        ? (isHovered ? "#e8ecff" : isSelected ? "#eef1ff" : "#f4f6ff")
                        : (isHovered ? "#fff59d" : isSelected ? "#fff8b0" : contextColor ? `color-mix(in srgb, ${contextColor} 12%, #ffffff)` : "#fff9c4"),
              transition: "background-color 150ms ease",
            }}
            className={`absolute shadow-lg rounded p-1.5 flex flex-col ${isSelected ? "ring-2 ring-indigo-400 ring-offset-1" : ""} ${isAdopted ? "border border-indigo-300" : ""} ${isMergeTarget ? "ring-2 ring-orange-500 ring-offset-1" : ""} ${filterDropTarget === catKey ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${hasConstantFilter ? "border border-dashed border-blue-400" : ""}`}
            data-category-card
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/ideabin-filter")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setFilterDropTarget(catKey);
              }
            }}
            onDragLeave={(e) => {
              // Only clear if we actually left the card (not entering a child)
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setFilterDropTarget(prev => prev === catKey ? null : prev);
              }
            }}
            onDrop={(e) => {
              const filterData = e.dataTransfer.getData("application/ideabin-filter");
              if (filterData && setCategoryFilterConfig) {
                e.preventDefault();
                try {
                  const parsed = JSON.parse(filterData);
                  const catName = catData.name || `Category #${catKey}`;
                  setConfirmModal({
                    message: `Apply this filter as a constant filter on "${catName}"? The category will auto-populate with matching ideas.`,
                    onConfirm: () => {
                      setCategoryFilterConfig(catKey, parsed);
                      refetchCategoryByFilter(catKey, ideas);
                      setConfirmModal(null);
                    },
                    onCancel: () => setConfirmModal(null),
                  });
                } catch (err) { console.error("Failed to parse dropped filter:", err); }
              }
              setFilterDropTarget(null);
            }}
            onMouseDown={(e) => {
              bring_to_front_category(catKey);
              if (e.ctrlKey || e.metaKey) {
                setSelectedCategoryIds(prev => {
                  const next = new Set(prev);
                  if (next.has(catKey) || next.has(String(catKey))) {
                    next.delete(catKey); next.delete(String(catKey));
                  } else {
                    next.add(catKey);
                  }
                  return next;
                });
              } else {
                // Don't reset multi-selection if this category is already part of it
                const alreadySelected = selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey));
                if (!alreadySelected) {
                  setSelectedCategoryIds(new Set([catKey]));
                }
              }
              setSelectedIdeaIds(new Set());
            }}
          >
            {/* Merge overlay when this category is a merge target */}
            {isMergeTarget && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-orange-500/20 rounded pointer-events-none">
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded shadow">
                  Merge here
                </span>
              </div>
            )}

            {/* ── Floating feed / live / conflict indicator strip ── */}
            {(catData.filter_config || liveCategoryIds.has(catKey)) && (
              <div className="absolute left-1 right-1 flex items-center gap-1 z-10 pointer-events-none" style={{ bottom: '100%', marginBottom: 2 }}>
                {/* Feed badge (when not live) */}
                {catData.filter_config && !liveCategoryIds.has(catKey) && (
                  <span className="pointer-events-auto flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-300 rounded-full px-1.5 py-0 shadow-sm uppercase tracking-wide leading-[16px]">
                    <Rss size={9} className="flex-shrink-0" />
                    Feed
                  </span>
                )}
                {/* Live badge */}
                {liveCategoryIds.has(catKey) && (
                  <span
                    className="pointer-events-auto flex items-center gap-0.5 text-[9px] font-bold text-green-800 bg-green-100 border border-green-400 rounded-full px-1.5 py-0 shadow-sm uppercase tracking-wide leading-[16px] animate-pulse cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); openFeedFilter(catKey); }}
                    title="Live mode active — click to open feed settings"
                  >
                    <Rss size={9} className="flex-shrink-0" />
                    Live
                  </span>
                )}
                {/* Applied filter name */}
                {catData.filter_config?.name && (
                  <span
                    className="pointer-events-auto text-[8px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0 shadow-sm truncate leading-[16px]"
                    title={catData.filter_config.name}
                  >
                    {catData.filter_config.name}
                  </span>
                )}
                {/* C&R conflict indicator */}
                {liveCategoryIds.has(catKey) && catData.filter_config?.collect_and_remove && (() => {
                  const conflict = crConflictsByCat[catKey] || detectCRConflicts(catKey, ideas);
                  if (!conflict) return null;
                  return (
                    <span
                      className="pointer-events-auto flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-100 border border-red-400 rounded-full px-1.5 py-0 shadow-sm leading-[16px] animate-pulse cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setCrConflictData(conflict); }}
                      title={`${conflict.overlappingIdeas.length} idea(s) conflict with other C&R categories — click to resolve`}
                    >
                      <AlertTriangle size={9} className="flex-shrink-0" />
                      {conflict.overlappingIdeas.length}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Category header */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                bring_to_front_category(catKey);
                // Preserve multi-selection if this category is already selected;
                // otherwise select just this one (unless Ctrl/Meta held)
                if (e.ctrlKey || e.metaKey) {
                  setSelectedCategoryIds(prev => {
                    const next = new Set(prev);
                    if (next.has(catKey) || next.has(String(catKey))) {
                      next.delete(catKey); next.delete(String(catKey));
                    } else {
                      next.add(catKey);
                    }
                    return next;
                  });
                  return; // don't start drag on ctrl-click
                }
                const alreadySelected = selectedCategoryIds.has(catKey) || selectedCategoryIds.has(String(catKey));
                if (!alreadySelected) {
                  setSelectedCategoryIds(new Set([catKey]));
                }
                handleCategoryDrag(e, catKey);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                // Double-click → dock to header (most recent = leftmost)
                setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
              }}
              className="flex justify-between items-center mb-0.5 flex-shrink-0 rounded-t px-1 py-0.5 cursor-grab active:cursor-grabbing border-b"
              style={{
                backgroundColor: hasConstantFilter
                  ? "rgba(59,130,246,0.18)"
                  : contextColor
                    ? `color-mix(in srgb, ${contextColor} 25%, #ffffff)`
                    : isAdopted ? "rgba(165,180,252,0.35)" : "rgba(253,216,53,0.55)",
                borderColor: hasConstantFilter
                  ? "rgba(59,130,246,0.25)"
                  : contextColor
                    ? `color-mix(in srgb, ${contextColor} 20%, transparent)`
                    : isAdopted ? "rgba(165,180,252,0.3)" : "rgba(253,216,53,0.4)",
              }}
            >
              {editingCategoryId === catKey && !isAdopted ? (
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
                <span className={`font-semibold text-[11px] truncate flex items-center gap-1 ${hasConstantFilter ? "text-blue-800" : ""}`}>
                  {catData.name}
                  {headlineModeCategoryId === catKey && (
                    <span className="text-[8px] font-medium text-purple-600 bg-purple-100 rounded px-1 py-0.5 flex-shrink-0">TITLE</span>
                  )}
                  {isAdopted && (
                    <span className="text-[9px] font-normal text-indigo-500 flex items-center gap-0.5" title={`By ${catData.owner_username}`}>
                      <UserRound size={8} />{catData.owner_username}
                    </span>
                  )}
                  {catData.is_public && !isAdopted && (
                    <Globe size={9} className="text-emerald-600 flex-shrink-0" title="Public category" />
                  )}
                </span>
              )}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Paste into this category — available for owned AND adopted */}
                {copiedIdeaId && (
                  <Copy
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      paste_idea(parseInt(catKey));
                    }}
                    className="text-indigo-400 hover:text-indigo-600! cursor-pointer"
                    title="Paste copied idea here"
                  />
                )}
                {/* ── Order Numbers toggle (per-category) ── */}
                <ListOrdered
                  size={12}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOrderNumbers(prev => {
                      const next = new Set(prev);
                      if (next.has(catKey)) next.delete(catKey);
                      else next.add(catKey);
                      return next;
                    });
                  }}
                  className={`cursor-pointer ${showOrderNumbers.has(catKey) ? "text-amber-500" : "text-gray-400 hover:text-gray-600"}`}
                  title={showOrderNumbers.has(catKey) ? "Hide order numbers" : "Show order numbers"}
                />
                {/* ── Feed Filter button — available on every category ── */}
                <div className="relative" ref={feedFilterOpen === catKey ? feedFilterRef : undefined}>
                  <Rss
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      openFeedFilter(catKey);
                    }}
                    className={`cursor-pointer ${
                      catData.filter_config
                        ? "text-blue-500 hover:text-blue-700"
                        : "text-gray-400 hover:text-indigo-600"
                    }`}
                    title="Feed Filter"
                  />
                  {feedFilterOpen === catKey && (
                    <FeedFilterPanel
                      catKey={catKey}
                      catData={catData}
                      isOwner={!isAdopted}
                      dims={dims}
                      setCategoryFilterConfig={setCategoryFilterConfig}
                      refetchCategoryByFilter={refetchCategoryByFilter}
                      toggleLiveCategory={toggleLiveCategory}
                      requestToggleLive={requestToggleLive}
                      liveCategoryIds={liveCategoryIds}
                      ideas={ideas}
                      filterPresets={filterPresets}
                      categories={categories}
                      detectCRConflicts={detectCRConflicts}
                      onClose={() => setFeedFilterOpen(null)}
                    />
                  )}
                </div>
                {isAdopted ? (
                  /* Adopted category: settings with unadopt */
                  <div className="relative">
                    <Settings
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategorySettingsOpen(prev => prev === catKey ? null : catKey);
                      }}
                      className="cursor-pointer"
                    style={{ color: contextColor ? `color-mix(in srgb, ${contextColor} 55%, #666)` : "#6366f1" }}
                    />
                    {categorySettingsOpen === catKey && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setCategorySettingsOpen(null)} />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-xl border border-gray-200 z-[61] min-w-[140px] py-1">
                          {/* Collapse all ideas */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const allCollapsed = catIdeas.every(id => collapsedIdeas[id] ?? true);
                              const newState = {};
                              catIdeas.forEach(id => { newState[id] = allCollapsed ? false : true; });
                              setCollapsedIdeas(prev => ({ ...prev, ...newState }));
                              setCategorySettingsOpen(null);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <span style={{
                              display: "inline-block", width: 0, height: 0, borderStyle: "solid",
                              ...(catIdeas.every(id => collapsedIdeas[id] ?? true)
                                ? { borderWidth: "4px 3px 0 3px", borderColor: "currentColor transparent transparent transparent" }
                                : { borderWidth: "0 3px 4px 3px", borderColor: "transparent transparent currentColor transparent" })
                            }} />
                            {catIdeas.every(id => collapsedIdeas[id] ?? true) ? "Show full ideas" : "Show headlines only"}
                          </button>
                          {/* Unadopt */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySettingsOpen(null);
                              setConfirmModal({
                                message: `Stop following "${catData.name}" from ${catData.owner_username}?`,
                                onConfirm: () => { drop_adopted_category(catKey); setConfirmModal(null); },
                                onCancel: () => setConfirmModal(null),
                              });
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <LinkIcon size={11} />
                            Unadopt category
                          </button>
                          {/* Title Mode */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySettingsOpen(null);
                              if (headlineModeCategoryId === catKey) {
                                setHeadlineModeCategoryId(null);
                                setDraftHeadlines({});
                              } else {
                                const drafts = {};
                                catIdeas.forEach(id => {
                                  const idea = ideas[id];
                                  if (idea) drafts[id] = idea.title || "";
                                });
                                setDraftHeadlines(drafts);
                                setHeadlineModeCategoryId(catKey);
                              }
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 ${
                              headlineModeCategoryId === catKey
                                ? "text-purple-700 bg-purple-50 hover:bg-purple-100"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Type size={11} />
                            {headlineModeCategoryId === catKey ? "Exit Title Mode" : "Title Mode"}
                          </button>
                          {/* Dock to header */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategorySettingsOpen(null);
                              setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
                            }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <PanelTopDashed size={11} />
                            Dock to header
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                {/* Archive */}
                <ArchiveIcon
                  onClick={(e) => { e.stopPropagation(); toggle_archive_category(catKey); }}
                  className="cursor-pointer" style={{ fontSize: 13, color: contextColor ? `color-mix(in srgb, ${contextColor} 50%, #666)` : undefined }}
                />
                {/* Settings dropdown */}
                <div className="relative">
                  <Settings
                    size={12}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategorySettingsOpen(prev => prev === catKey ? null : catKey);
                    }}
                    className="cursor-pointer"
                    style={{ color: contextColor ? `color-mix(in srgb, ${contextColor} 55%, #666)` : "#b45309" }}
                  />
                  {categorySettingsOpen === catKey && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setCategorySettingsOpen(null)} />
                      <div className="absolute right-0 top-full mt-1 bg-white rounded shadow-xl border border-gray-200 z-[61] min-w-[140px] py-1">
                        {/* Collapse all ideas */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const allCollapsed = catIdeas.every(id => collapsedIdeas[id] ?? true);
                            const newState = {};
                            catIdeas.forEach(id => { newState[id] = allCollapsed ? false : true; });
                            setCollapsedIdeas(prev => ({ ...prev, ...newState }));
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span style={{
                            display: "inline-block", width: 0, height: 0, borderStyle: "solid",
                            ...(catIdeas.every(id => collapsedIdeas[id] ?? true)
                              ? { borderWidth: "4px 3px 0 3px", borderColor: "currentColor transparent transparent transparent" }
                              : { borderWidth: "0 3px 4px 3px", borderColor: "transparent transparent currentColor transparent" })
                          }} />
                          {catIdeas.every(id => collapsedIdeas[id] ?? true) ? "Show full ideas" : "Show headlines only"}
                        </button>
                        {/* Minimize / Restore */}
                        <button
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
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span className="text-[10px]">{minimizedCategories[catKey] ? "◻" : "—"}</span>
                          {minimizedCategories[catKey] ? "Restore size" : "Collapse card"}
                        </button>
                        {/* Toggle public/private */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle_public_category(catKey);
                            setCategorySettingsOpen(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          {catData.is_public ? <Lock size={11} /> : <Globe size={11} />}
                          {catData.is_public ? "Make private" : "Make public"}
                        </button>
                        {/* Delete */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setConfirmModal({
                              message: `Delete "${catData.name}"? Its ideas become unassigned.`,
                              onConfirm: () => { delete_category(catKey); setConfirmModal(null); },
                              onCancel: () => setConfirmModal(null),
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <DeleteForeverIcon style={{ fontSize: 13 }} />
                          Delete category
                        </button>
                        {/* Rename */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setEditingCategoryId(catKey);
                            setEditingCategoryName(catData.name);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Pencil size={11} />
                          Rename
                        </button>
                        {/* Title Mode */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            if (headlineModeCategoryId === catKey) {
                              setHeadlineModeCategoryId(null);
                              setDraftHeadlines({});
                            } else {
                              // Initialize draft titles from current ideas
                              const drafts = {};
                              catIdeas.forEach(id => {
                                const idea = ideas[id];
                                if (idea) drafts[id] = idea.title || "";
                              });
                              setDraftHeadlines(drafts);
                              setHeadlineModeCategoryId(catKey);
                            }
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 ${
                            headlineModeCategoryId === catKey
                              ? "text-purple-700 bg-purple-50 hover:bg-purple-100"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <Type size={11} />
                          {headlineModeCategoryId === catKey ? "Exit Title Mode" : "Title Mode"}
                        </button>
                        {/* Dock to header */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategorySettingsOpen(null);
                            setDockedCategories(prev => [String(catKey), ...prev.filter(id => id !== String(catKey))]);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <PanelTopDashed size={11} />
                          Dock to header
                        </button>
                      </div>
                    </>
                  )}
                </div>
                  </>
                )}
              </div>
            </div>

            {/* Ideas inside category */}
            <div
              ref={el => (categoryRefs.current[catKey] = el)}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              data-idea-list
              onMouseDown={(e) => {
                e.stopPropagation();
                bring_to_front_category(catKey);
                handleIdeaMarqueeStart(e, catKey);
              }}
            >
              {headlineModeCategoryId === catKey ? (
                /* ── TITLE MODE (full category or single idea) ── */
                <div className="p-1 space-y-1">
                  {catIdeas
                    .filter(ideaId => passesAllFilters(ideas[ideaId]))
                    .map((ideaId, idx) => {
                      const idea = ideas[ideaId];
                      if (!idea) return null;
                      // Single-idea mode: only show title builder for the selected idea
                      const showHeadlineBuilder = headlineModeIdeaId ? headlineModeIdeaId === ideaId : true;
                      if (!showHeadlineBuilder) {
                        return renderIdeaItem(ideaId, idx, { type: "category", id: catKey });
                      }
                      const draft = draftHeadlines[ideaId] ?? idea.title ?? "";
                      const descWords = (idea.description || "").split(/\s+/).filter(w => w.length > 0);
                      const draftWords = draft.split(/\s+/).filter(w => w.length > 0);

                      // Sort helper: reorder words by their position in the description
                      const sortByDescription = (wordsArr) => {
                        const lowerDesc = descWords.map(w => w.toLowerCase());
                        return [...wordsArr].sort((a, b) => {
                          const idxA = lowerDesc.indexOf(a.toLowerCase());
                          const idxB = lowerDesc.indexOf(b.toLowerCase());
                          return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
                        });
                      };

                      // Drag handlers for reordering headline words
                      const handleDragStart = (e, wordIdx) => {
                        dragItemRef.current = { ideaId, index: wordIdx };
                        e.dataTransfer.effectAllowed = "move";
                        e.target.style.opacity = "0.4";
                      };
                      const handleDragEnd = (e) => {
                        e.target.style.opacity = "1";
                        dragItemRef.current = null;
                        dragOverRef.current = null;
                      };
                      const handleDragOver = (e, wordIdx) => {
                        e.preventDefault();
                        dragOverRef.current = { ideaId, index: wordIdx };
                      };
                      const handleDrop = (e) => {
                        e.preventDefault();
                        if (!dragItemRef.current || !dragOverRef.current) return;
                        if (dragItemRef.current.ideaId !== ideaId) return;
                        const fromIdx = dragItemRef.current.index;
                        const toIdx = dragOverRef.current.index;
                        if (fromIdx === toIdx) return;
                        const reordered = [...draftWords];
                        const [moved] = reordered.splice(fromIdx, 1);
                        reordered.splice(toIdx, 0, moved);
                        updateDraftAndSave(ideaId, reordered.join(" "), idea);
                        dragItemRef.current = null;
                        dragOverRef.current = null;
                      };

                      return (
                        <div key={ideaId} className="bg-white rounded border border-purple-200 shadow-sm p-1.5" data-headline-builder onClick={(e) => e.stopPropagation()}>
                          {/* Order toggle */}
                          <div className="flex items-center gap-1 mb-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newMode = headlineOrderMode === "define" ? "description" : "define";
                                setHeadlineOrderMode(newMode);
                                // If switching to description mode, re-sort existing words
                                if (newMode === "description" && draftWords.length > 1) {
                                  const sorted = sortByDescription(draftWords);
                                  updateDraftAndSave(ideaId, sorted.join(" "), idea);
                                }
                              }}
                              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                                headlineOrderMode === "define"
                                  ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                                  : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                              }`}
                              title={headlineOrderMode === "define" ? "Switch to auto-order by description position" : "Switch to manual drag-to-reorder"}
                            >
                              {headlineOrderMode === "define" ? <ArrowDownUp size={10} /> : <BookOpenText size={10} />}
                              {headlineOrderMode === "define" ? "Define Order" : "Order from Description"}
                            </button>
                          </div>
                          {/* Current headline */}
                          <div className="flex items-center gap-1 mb-1">
                            <div
                              className="flex-1 min-h-[22px] px-1.5 py-0.5 rounded border text-[11px] font-semibold bg-purple-50 border-purple-300 text-purple-900 flex items-center flex-wrap gap-0.5"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={handleDrop}
                            >
                              {draftWords.length > 0 ? draftWords.map((w, i) => (
                                <span
                                  key={i}
                                  draggable={headlineOrderMode === "define"}
                                  onDragStart={(e) => handleDragStart(e, i)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(e, i)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newWords = [...draftWords];
                                    newWords.splice(i, 1);
                                    const newHeadline = newWords.join(" ");
                                    updateDraftAndSave(ideaId, newHeadline, idea);
                                  }}
                                  className={`inline-flex items-center bg-purple-200 text-purple-800 rounded px-1 py-0.5 cursor-pointer hover:bg-red-200 hover:text-red-700 transition-colors text-[10px] ${
                                    headlineOrderMode === "define" ? "cursor-grab active:cursor-grabbing" : ""
                                  }`}
                                  title={headlineOrderMode === "define" ? "Drag to reorder · Click to remove" : "Click to remove"}
                                >
                                  {w}
                                  <X size={8} className="ml-0.5 opacity-60" />
                                </span>
                              )) : (
                                <span className="text-purple-400 italic text-[10px]">Click words below to build title…</span>
                              )}
                            </div>
                            <RotateCcw
                              size={12}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateDraftAndSave(ideaId, "", idea);
                              }}
                              className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                              title="Clear title"
                            />
                          </div>
                          {/* Word chips from description */}
                          <div className="flex flex-wrap gap-[3px]">
                            {descWords.map((word, i) => {
                              const isUsed = draftWords.some(dw => dw.toLowerCase() === word.toLowerCase());
                              return (
                                <span
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const current = draftHeadlines[ideaId] ?? idea.title ?? "";
                                    let newHeadline;
                                    if (headlineOrderMode === "description") {
                                      // Insert word and re-sort by description position
                                      const currentWords = current ? current.split(/\s+/).filter(w => w.length > 0) : [];
                                      currentWords.push(word);
                                      newHeadline = sortByDescription(currentWords).join(" ");
                                    } else {
                                      newHeadline = current ? `${current} ${word}` : word;
                                    }
                                    updateDraftAndSave(ideaId, newHeadline, idea);
                                  }}
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] cursor-pointer transition-all select-none ${
                                    isUsed
                                      ? "bg-purple-100 text-purple-400 border border-purple-200"
                                      : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-purple-100 hover:text-purple-700 hover:border-purple-300"
                                  }`}
                                  title={`Add "${word}" to title`}
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              ) : (
                catIdeas
                  .filter(ideaId => passesAllFilters(ideas[ideaId]))
                  .map((ideaId, idx) => (
                    <div key={ideaId} className="flex items-stretch">
                      {showOrderNumbers.has(catKey) && (
                        <div
                          className="flex-shrink-0 w-6 flex items-center justify-center text-[10px] text-gray-400 select-none cursor-default border-r border-gray-100 hover:bg-gray-50"
                          onClick={(e) => { e.stopPropagation(); setSelectedIdeaIds(new Set()); }}
                          title="Click to deselect"
                        >
                          {idx + 1}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {renderIdeaItem(ideaId, idx, { type: "category", id: catKey })}
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Resize handles – all edges and corners */}
            {/* Edges */}
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "n")} className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "s")} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "w")} className="absolute top-2 bottom-2 left-0 w-1.5 cursor-w-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "e")} className="absolute top-2 bottom-2 right-0 w-1.5 cursor-e-resize" />
            {/* Corners */}
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "nw")} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "ne")} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "sw")} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
            <div onMouseDown={(e) => handleCategoryResize(e, catKey, "se")} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize">
              <span className="absolute bottom-0 right-0 text-[8px] leading-none select-none" style={{ color: contextColor ? `color-mix(in srgb, ${contextColor} 40%, transparent)` : isAdopted ? "rgba(129,140,248,0.5)" : "rgba(217,119,6,0.5)" }}>◢</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
