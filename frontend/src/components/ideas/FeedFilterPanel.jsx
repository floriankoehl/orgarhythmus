import { useState, useCallback, useMemo } from "react";
import { RefreshCw, Radio, Filter, X, Trash2, Save } from "lucide-react";
import { renderLegendTypeIcon } from "./legendTypeIcons";

/**
 * Feed Filter dropdown panel – shown when the Rss icon on a category header is clicked.
 *
 * Full inline filter builder:
 *   • Per-legend type selectors with include/exclude toggle
 *   • AND/OR combiner when ≥2 legends have selections
 *   • Save / Refetch / Live / Clear actions
 *
 * For adopted (non-owned) categories it shows a read-only summary.
 */
export default function FeedFilterPanel({
  catKey,
  catData,
  isOwner,
  dims,
  feedFilterTypes,        // {legendId: {typeId: typeObj}}
  legendFilters,          // current global legend filters (unused for local draft, but kept for "assign global")
  filterCombineMode,      // "and" | "or"
  globalTypeFilter,       // current global type filter array
  setCategoryFilterConfig,
  refetchCategoryByFilter,
  toggleLiveCategory,
  liveCategoryIds,
  ideas,
  onClose,
}) {
  const fc = catData.filter_config;
  const isLive = liveCategoryIds.has(catKey);
  const hasGlobalFilter = legendFilters.length > 0 || globalTypeFilter.length > 0;

  /* ── Local draft state (initialised from stored filter_config) ── */
  const [draftRules, setDraftRules] = useState(() => {
    return fc?.legend_filters ? JSON.parse(JSON.stringify(fc.legend_filters)) : [];
  });
  const [draftCombine, setDraftCombine] = useState(() => fc?.filter_combine_mode || "and");

  /* Has the user changed anything from the stored config? */
  const isDirty = useMemo(() => {
    const storedRules = fc?.legend_filters || [];
    const storedCombine = fc?.filter_combine_mode || "and";
    if (draftCombine !== storedCombine) return true;
    if (JSON.stringify(draftRules) !== JSON.stringify(storedRules)) return true;
    return false;
  }, [draftRules, draftCombine, fc]);

  const hasDraftFilter = draftRules.some(r => r.typeIds?.length > 0);

  /* ── Draft manipulation helpers ── */
  const toggleType = useCallback((legendId, typeId) => {
    setDraftRules(prev => {
      const existing = prev.find(r => r.legendId === legendId);
      if (existing) {
        const has = existing.typeIds.includes(typeId);
        const newTypeIds = has
          ? existing.typeIds.filter(t => t !== typeId)
          : [...existing.typeIds, typeId];
        if (newTypeIds.length === 0) {
          return prev.filter(r => r.legendId !== legendId);
        }
        return prev.map(r => r.legendId === legendId ? { ...r, typeIds: newTypeIds } : r);
      }
      return [...prev, { legendId, typeIds: [typeId], mode: "include" }];
    });
  }, []);

  const toggleMode = useCallback((legendId) => {
    setDraftRules(prev =>
      prev.map(r =>
        r.legendId === legendId
          ? { ...r, mode: r.mode === "include" ? "exclude" : "include" }
          : r
      )
    );
  }, []);

  /* ── Save draft as category filter_config ── */
  const saveDraft = useCallback(() => {
    if (!hasDraftFilter) return;
    const newConfig = {
      legend_filters: JSON.parse(JSON.stringify(draftRules)),
      filter_combine_mode: draftCombine,
      global_type_filter: [],
      active_legend_id: dims.activeLegendId || null,
    };
    setCategoryFilterConfig(catKey, newConfig);
  }, [catKey, draftRules, draftCombine, dims.activeLegendId, setCategoryFilterConfig, hasDraftFilter]);

  /* ── Assign global filter (copy toolbar filter into this category) ── */
  const assignGlobal = useCallback(() => {
    const newConfig = {
      legend_filters: JSON.parse(JSON.stringify(legendFilters)),
      filter_combine_mode: filterCombineMode,
      global_type_filter: [...globalTypeFilter],
      active_legend_id: dims.activeLegendId || null,
    };
    setCategoryFilterConfig(catKey, newConfig);
    // Also sync draft state
    setDraftRules(JSON.parse(JSON.stringify(legendFilters)));
    setDraftCombine(filterCombineMode);
  }, [catKey, legendFilters, filterCombineMode, globalTypeFilter, dims.activeLegendId, setCategoryFilterConfig]);

  const clearFilter = useCallback(() => {
    setCategoryFilterConfig(catKey, null);
    setDraftRules([]);
    setDraftCombine("and");
  }, [catKey, setCategoryFilterConfig]);

  /* ── All legends to show ── */
  const allLegends = dims.legends || [];

  /* ── panel ── */
  return (
    <div
      className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-[61] py-2 px-3"
      style={{ width: 300, maxHeight: "70vh", overflowY: "auto", scrollbarWidth: "thin" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
          <Filter size={11} className="text-blue-500" />
          Feed Filter
        </span>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="text-[9px] font-bold text-green-600 flex items-center gap-0.5">
              <Radio size={9} className="animate-pulse" /> LIVE
            </span>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Filter builder (owner only) ── */}
      {isOwner && (
        <>
          {/* AND/OR toggle */}
          {draftRules.filter(r => r.typeIds?.length > 0).length >= 2 && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <span className="text-[10px] text-gray-500 font-medium">Combine:</span>
              <button
                onClick={() => setDraftCombine("and")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                  draftCombine === "and" ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >AND</button>
              <button
                onClick={() => setDraftCombine("or")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                  draftCombine === "or" ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >OR</button>
            </div>
          )}

          {/* Per-legend type selectors */}
          <div className="space-y-2 mb-2">
            {allLegends.map(legend => {
              const types = feedFilterTypes[legend.id] || (legend.id === dims.activeLegendId ? dims.legendTypes : {});
              const rule = draftRules.find(r => r.legendId === legend.id);
              const selectedIds = rule?.typeIds || [];
              const mode = rule?.mode || "include";
              const hasSelection = selectedIds.length > 0;

              return (
                <div key={legend.id} className={`p-2 rounded-lg border transition-colors ${hasSelection ? "bg-blue-50/50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                  {/* Legend name + mode toggle */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-bold text-gray-700 flex-1 truncate">{legend.name}</span>
                    {hasSelection && (
                      <button
                        onClick={() => toggleMode(legend.id)}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                          mode === "exclude"
                            ? "bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
                            : "bg-green-100 text-green-600 hover:bg-green-200 border border-green-200"
                        }`}
                      >
                        {mode === "exclude" ? "EXCLUDE" : "INCLUDE"}
                      </button>
                    )}
                    {!hasSelection && (
                      <span className="text-[8px] text-gray-400 italic">no filter</span>
                    )}
                  </div>

                  {/* Type chips */}
                  <div className="flex flex-wrap gap-1">
                    {/* Unassigned */}
                    {(() => {
                      const isSel = selectedIds.includes("unassigned");
                      return (
                        <button
                          onClick={() => toggleType(legend.id, "unassigned")}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all cursor-pointer border ${
                            isSel
                              ? "bg-gray-700 text-white border-gray-700 shadow-sm"
                              : "bg-white text-gray-400 border-gray-300 hover:border-gray-500 hover:text-gray-600"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSel ? "bg-white/50" : "bg-gray-500"}`} />
                          Unassigned
                        </button>
                      );
                    })()}
                    {/* Legend types */}
                    {Object.values(types).map(lt => {
                      const isSel = selectedIds.includes(lt.id);
                      return (
                        <button
                          key={lt.id}
                          onClick={() => toggleType(legend.id, lt.id)}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all cursor-pointer border ${
                            isSel ? "shadow-sm" : "bg-white hover:opacity-80"
                          }`}
                          style={isSel
                            ? { backgroundColor: lt.color + "30", color: lt.color, borderColor: lt.color }
                            : { color: "#9ca3af", borderColor: "#d1d5db" }
                          }
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: isSel ? lt.color : lt.color + "60" }}
                          />
                          {lt.icon && renderLegendTypeIcon(lt.icon, { style: { fontSize: 9, color: isSel ? lt.color : "#9ca3af" } })}
                          {lt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {allLegends.length === 0 && (
              <span className="text-[10px] text-gray-400 italic">No legends created yet</span>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {/* Save draft filter */}
            {hasDraftFilter && isDirty && (
              <button
                onClick={saveDraft}
                className="w-full text-left px-2 py-1.5 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded flex items-center gap-2 transition-colors font-semibold"
              >
                <Save size={11} />
                Save filter
              </button>
            )}

            {/* Assign global filter (from toolbar) */}
            {hasGlobalFilter && (
              <button
                onClick={assignGlobal}
                className="w-full text-left px-2 py-1.5 text-[11px] text-indigo-700 hover:bg-indigo-50 rounded flex items-center gap-2 transition-colors"
              >
                <Filter size={11} />
                {fc ? "Copy toolbar filter here" : "Use toolbar filter"}
              </button>
            )}

            {/* Refetch */}
            {fc && (
              <button
                onClick={() => refetchCategoryByFilter(catKey, ideas)}
                className="w-full text-left px-2 py-1.5 text-[11px] text-blue-700 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={11} />
                Refetch by filter
              </button>
            )}

            {/* Live toggle */}
            {fc && (
              <button
                onClick={() => toggleLiveCategory(catKey)}
                className={`w-full text-left px-2 py-1.5 text-[11px] rounded flex items-center gap-2 transition-colors ${
                  isLive
                    ? "text-green-700 bg-green-50 hover:bg-green-100"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Radio size={11} className={isLive ? "animate-pulse" : ""} />
                {isLive ? "Live ● ON" : "Go Live"}
              </button>
            )}

            {/* Clear */}
            {fc && (
              <button
                onClick={clearFilter}
                className="w-full text-left px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-50 rounded flex items-center gap-2 transition-colors"
              >
                <Trash2 size={11} />
                Clear filter
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Read-only summary for adopted categories ── */}
      {!isOwner && fc && (
        <div className="p-2 bg-gray-50 rounded border border-gray-200">
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Stored filter</span>
          {(() => {
            const rules = fc.legend_filters || [];
            if (rules.length === 0) return <span className="text-[10px] text-gray-400 italic">Empty filter</span>;
            return (
              <div className="space-y-1">
                {rules.map((rule, i) => {
                  const legend = dims.legends?.find(l => l.id === rule.legendId);
                  const types = feedFilterTypes[rule.legendId] || {};
                  return (
                    <div key={i} className="text-[10px] text-gray-600">
                      <span className={`font-bold ${rule.mode === "exclude" ? "text-red-500" : "text-green-600"}`}>
                        {rule.mode === "exclude" ? "EXCL" : "INCL"}
                      </span>{" "}
                      {legend?.name || "Legend"}:{" "}
                      {(rule.typeIds || []).map(tid => tid === "unassigned" ? "Unassigned" : (types[tid]?.name || `#${tid}`)).join(", ")}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      {!isOwner && !fc && (
        <span className="text-[10px] text-gray-400 italic">Owner has not assigned a filter.</span>
      )}
    </div>
  );
}
