import { useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Copy, Locate, MoreVertical, Zap, X, GitBranchPlus } from "lucide-react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";

/**
 * Single idea card rendered in sidebar lists & category cards.
 * This was previously the `renderIdeaItem` inline function in IdeaBin.
 */
export default function IdeaBinIdeaCard({
  ideaId, arrayIndex, source,
  ideas, dims, draggingType,
  dragSource, hoverIndex, prevIndex,
  editingIdeaId, setEditingIdeaId, setEditingIdeaTitle, setEditingIdeaHeadline,
  hoverIdeaForType, sidebarHeadlineOnly, showSidebarMeta,
  collapsedIdeas, setCollapsedIdeas,
  wigglingIdeaId, setWigglingIdeaId,
  handleIdeaDrag,
  copiedIdeaId, copy_idea,
  showCategories,
  ideaSettingsOpen, setIdeaSettingsOpen,
  openTransform, setConfirmModal,
  delete_meta_idea, delete_idea,
  ideaRefs,
  remove_all_idea_categories, remove_idea_from_category,
  remove_all_idea_legend_types, remove_idea_legend_type,
  spinoff_idea, categories, currentUserId,
}) {
  const moreButtonRef = useRef(null);

  const idea = ideas[ideaId];
  if (!idea) return null;

  const isSource = dragSource &&
    dragSource.type === source.type &&
    (source.type === "unassigned" || source.type === "all" || source.type === "meta" || String(dragSource.id) === String(source.id));
  const isEditing = editingIdeaId === ideaId;
  const legendType = (() => {
    const legId = String(dims.activeLegendId || "");
    const dt = idea.legend_types?.[legId];
    if (dt) return { id: dt.legend_type_id, color: dt.color, name: dt.name };
    return null;
  })();
  const isHoveredForType = hoverIdeaForType === ideaId || hoverIdeaForType === `meta_${ideaId}` || hoverIdeaForType === `all_${ideaId}`;
  const isMetaView = source.type === "meta";  // Idea List Overlay
  const isAllView = source.type === "all";    // Overview "All Ideas" filter
  const collapseKey = isMetaView ? `meta_${ideaId}` : isAllView ? `all_${ideaId}` : ideaId;
  const isIdeaCollapsed = isMetaView
    ? (collapsedIdeas[collapseKey] ?? false)   // overlay: expanded by default
    : sidebarHeadlineOnly
    ? (collapsedIdeas[collapseKey] ?? true)     // headline-only mode: collapsed by default
    : (collapsedIdeas[collapseKey] ?? !isAllView); // normal: unassigned/category collapsed, "all" expanded
  const isWiggling = wigglingIdeaId && idea.idea_id === wigglingIdeaId && !isAllView && !isMetaView;
  const isInAdoptedCategory = source.type === "category" && categories?.[source.id]?.adopted;
  const isOwnIdea = idea.owner === currentUserId;
  // Foreign idea = in adopted category AND not owned by current user
  const isForeignIdea = isInAdoptedCategory && !isOwnIdea;

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
          ref={el => {
            ideaRefs.current[collapseKey] = el;
          }}
          onMouseDown={(e) => { e.stopPropagation(); handleIdeaDrag(e, idea, arrayIndex, source); }}
          style={{
            backgroundColor: isHoveredForType
              ? (draggingType?.color || "#e0e7ff")
              : isSource && arrayIndex === prevIndex ? "#e5e7eb"
              : legendType ? `${legendType.color}20` : "#ffffff4b",
            borderLeftColor: legendType ? legendType.color : "#374151",
            borderLeftWidth: "3px",
            transform: isSource && hoverIndex !== null && arrayIndex >= hoverIndex && arrayIndex !== prevIndex
              ? "translateY(4px)" : "translateY(0px)",
            transition: "transform 150ms ease, background-color 150ms ease",
          }}
          className={`w-full rounded text-gray-800 px-1.5 py-1 flex justify-between ${isIdeaCollapsed ? "items-center" : "items-start"} text-[11px] mb-0.5 cursor-grab leading-tight shadow-sm border border-gray-200 hover:shadow-md ${isHoveredForType ? "ring-2 ring-offset-1" : ""} ${isWiggling ? "ideabin-wiggle" : ""}`}
        >
          <div className={`flex ${isIdeaCollapsed ? "items-center" : "items-start"} gap-1 flex-1 mr-1`}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                const currentDefault = !(isAllView || isMetaView);
                setCollapsedIdeas(prev => {
                  const current = prev[collapseKey] ?? currentDefault;
                  return { ...prev, [collapseKey]: !current };
                });
              }}
              className="cursor-pointer flex-shrink-0"
              style={{
                width: 0, height: 0, display: "inline-block", borderStyle: "solid",
                ...(isIdeaCollapsed ? {} : { marginTop: "3px" }),
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
                  {/* Meta info: categories + legends */}
                  {(isMetaView || showSidebarMeta) && (() => {
                    const cats = idea.placement_categories || [];
                    const legendEntries = Object.entries(idea.legend_types || {}).map(([legId, dt]) => {
                      const leg = dims.legends.find(d => String(d.id) === String(legId));
                      return leg ? { legId, legName: leg.name, typeName: dt.name, color: dt.color } : null;
                    }).filter(Boolean);
                    const hasMeta = cats.length > 0 || legendEntries.length > 0;
                    if (!hasMeta) return null;
                    return (
                      <div className="mt-1 pl-1 border-l-2 border-gray-200 space-y-0.5">
                        {cats.length > 0 && (
                          <div className="text-[9px] text-gray-500">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="font-medium text-gray-600">Categories:</span>
                              {isMetaView && cats.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                      message: <p className="text-sm">Remove <strong>{idea.headline || idea.title}</strong> from <strong>all {cats.length} categories</strong>?</p>,
                                      onConfirm: () => { remove_all_idea_categories(idea.idea_id); setConfirmModal(null); },
                                      onCancel: () => setConfirmModal(null),
                                    });
                                  }}
                                  className="text-[8px] text-red-400 hover:text-red-600 transition-colors"
                                  title="Remove from all categories"
                                >✕ all</button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                              {cats.map((cat, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 bg-gray-100 rounded px-1 py-0.5">
                                  {cat.name}
                                  {isMetaView && cat.id && (
                                    <X
                                      size={8}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        remove_idea_from_category(cat.placement_id);
                                      }}
                                      className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                                      title={`Remove from ${cat.name}`}
                                    />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {legendEntries.length > 0 && (
                          <div className="text-[9px] text-gray-500">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="font-medium text-gray-600">Legends:</span>
                              {isMetaView && legendEntries.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({
                                      message: <p className="text-sm">Remove <strong>{idea.headline || idea.title}</strong> from <strong>all {legendEntries.length} types</strong>?</p>,
                                      onConfirm: () => { remove_all_idea_legend_types(idea.idea_id); setConfirmModal(null); },
                                      onCancel: () => setConfirmModal(null),
                                    });
                                  }}
                                  className="text-[8px] text-red-400 hover:text-red-600 transition-colors"
                                  title="Remove all types"
                                >✕ all</button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                              {legendEntries.map((e, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 bg-gray-100 rounded px-1 py-0.5">
                                  {e.legName} = <span style={{ color: e.color }} className="font-medium">{e.typeName}</span>
                                  {isMetaView && (
                                    <X
                                      size={8}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        remove_idea_legend_type(idea.idea_id, parseInt(e.legId));
                                      }}
                                      className="text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                                      title={`Remove ${e.legName} type`}
                                    />
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div className={`flex-shrink-0 flex items-center gap-0.5 text-gray-400 ${isIdeaCollapsed ? "" : "mt-0.5"}`} onMouseDown={(e) => e.stopPropagation()}>
            {isForeignIdea && (
              <GitBranchPlus
                size={12}
                onClick={(e) => {
                  e.stopPropagation();
                  spinoff_idea(idea.idea_id);
                }}
                className="cursor-pointer text-indigo-400 hover:text-indigo-600!"
                title="Spinoff — create your own copy"
              />
            )}
            <Copy
              size={12}
              onClick={(e) => {
                e.stopPropagation();
                copy_idea(ideaId);
              }}
              className={`cursor-pointer ${copiedIdeaId === idea.idea_id ? "text-indigo-500!" : "hover:text-indigo-500!"}`}
              title="Copy idea (Ctrl+C)"
            />
            {(isAllView || isMetaView) && showCategories && (
              <Locate
                size={12}
                onClick={(e) => {
                  e.stopPropagation();
                  setWigglingIdeaId(idea.idea_id);
                  setTimeout(() => setWigglingIdeaId(null), 1500);
                }}
                className="cursor-pointer hover:text-emerald-500!"
                title="Locate in categories"
              />
            )}
            <div className="relative">
              <MoreVertical
                ref={moreButtonRef}
                size={13}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdeaSettingsOpen(prev => prev === ideaId ? null : ideaId);
                }}
                className="cursor-pointer hover:text-gray-600"
                title="More actions"
              />
              {ideaSettingsOpen === ideaId && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setIdeaSettingsOpen(null)} onMouseDown={(e) => e.stopPropagation()} />
                  <div
                    className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[130px]"
                    style={(() => {
                      const r = moreButtonRef.current?.getBoundingClientRect();
                      if (!r) return { top: 0, left: 0 };
                      return { top: r.bottom + 4, left: r.right - 130 };
                    })()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {isForeignIdea ? (
                      /* Foreign idea in adopted category: only Spinoff option */
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIdeaSettingsOpen(null);
                          spinoff_idea(idea.idea_id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-indigo-700 hover:bg-indigo-50 transition-colors"
                      >
                        <GitBranchPlus size={13} className="text-indigo-500" />
                        Spinoff
                      </button>
                    ) : (
                      /* Own idea: full actions */
                      <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIdeaId(ideaId);
                        setEditingIdeaTitle(idea.title);
                        setEditingIdeaHeadline(idea.headline || "");
                        setIdeaSettingsOpen(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <EditIcon style={{ fontSize: 13 }} className="text-blue-500" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openTransform(idea);
                        setIdeaSettingsOpen(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Zap size={13} className="text-amber-500" />
                      Make Task
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIdeaSettingsOpen(null);
                        const isMetaDel = isMetaView;
                        setConfirmModal({
                          message: (
                            <div>
                              <p className="mb-1 text-sm">{isMetaDel ? "Delete this idea and ALL its copies?" : "Delete this idea?"}</p>
                              {idea.headline && <p className="font-semibold text-xs">{idea.headline}</p>}
                              <p className="text-xs text-gray-600 mt-0.5">{idea.title.length > 80 ? idea.title.slice(0, 80) + "..." : idea.title}</p>
                              {isMetaDel && idea.placement_count > 1 && (
                                <p className="text-[10px] text-red-500 mt-1">{idea.placement_count} copies will be removed</p>
                              )}
                            </div>
                          ),
                          onConfirm: () => {
                            if (isMetaDel) { delete_meta_idea(idea.idea_id); }
                            else { delete_idea(idea.id); }
                            setConfirmModal(null);
                          },
                          onCancel: () => setConfirmModal(null),
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <DeleteForeverIcon style={{ fontSize: 13 }} />
                      Delete
                    </button>
                      </>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
