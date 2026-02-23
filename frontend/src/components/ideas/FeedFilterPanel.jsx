import { useCallback } from "react";
import { RefreshCw, Radio, Filter, X, Trash2, Layers } from "lucide-react";

/**
 * Feed Filter dropdown panel – shown when the Rss icon on a category header is clicked.
 *
 * Simple preset picker:
 *   • Lists saved filter presets
 *   • Click one to assign it to the category (only ONE at a time)
 *   • Refetch / Live / Clear actions
 *
 * The filter EFFECT (details) is visible in the bottom-left legend panel,
 * so no hover descriptions are needed here — only the filter name.
 */
export default function FeedFilterPanel({
  catKey,
  catData,
  isOwner,
  dims,
  setCategoryFilterConfig,
  refetchCategoryByFilter,
  toggleLiveCategory,
  liveCategoryIds,
  ideas,
  filterPresets,
  onClose,
}) {
  const fc = catData.filter_config;
  const isLive = liveCategoryIds.has(catKey);
  const assignedName = fc?.name || null;

  const clearFilter = useCallback(() => {
    setCategoryFilterConfig(catKey, null);
  }, [catKey, setCategoryFilterConfig]);

  const assignPreset = useCallback((preset) => {
    const newConfig = {
      name: preset.name,
      legend_filters: JSON.parse(JSON.stringify(preset.legend_filters || [])),
      filter_combine_mode: preset.filter_combine_mode || "and",
      stacked_filters: preset.stacked_filters ? JSON.parse(JSON.stringify(preset.stacked_filters)) : [],
      stack_combine_mode: preset.stack_combine_mode || "or",
      global_type_filter: [],
      active_legend_id: dims.activeLegendId || null,
    };
    setCategoryFilterConfig(catKey, newConfig);
  }, [catKey, dims.activeLegendId, setCategoryFilterConfig]);

  return (
    <div
      className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-[61] py-2 px-3"
      style={{ width: 240, maxHeight: "60vh", overflowY: "auto", scrollbarWidth: "thin" }}
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

      {isOwner ? (
        <>
          {/* ── Currently assigned filter ── */}
          {assignedName ? (
            <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-1.5">
              <Filter size={10} className="text-blue-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-blue-700 truncate flex-1">{assignedName}</span>
              <button
                onClick={clearFilter}
                className="text-gray-400 hover:text-red-500 flex-shrink-0"
                title="Remove filter"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="mb-2 text-[10px] text-gray-400 italic">No filter assigned</div>
          )}

          {/* ── Actions ── */}
          <div className="space-y-0.5 mb-2">
            {fc && (
              <button
                onClick={() => refetchCategoryByFilter(catKey, ideas)}
                className="w-full text-left px-2 py-1.5 text-[11px] text-blue-700 hover:bg-blue-50 rounded flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={11} />
                Refetch by filter
              </button>
            )}
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

          {/* ── Available presets ── */}
          {filterPresets && filterPresets.length > 0 && (
            <div className="border-t border-gray-100 pt-2">
              <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Assign a filter
              </div>
              <div className="space-y-0.5">
                {filterPresets.map((preset, idx) => {
                  const isAssigned = assignedName === preset.name;
                  const isGroup = preset.stacked_filters?.length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => assignPreset(preset)}
                      className={`w-full text-left px-2 py-1.5 text-[11px] rounded flex items-center gap-2 transition-colors ${
                        isAssigned
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "text-gray-700 hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      {isGroup
                        ? <Layers size={10} className="text-purple-400 flex-shrink-0" />
                        : <Filter size={10} className={`flex-shrink-0 ${isAssigned ? "text-blue-500" : "text-gray-400"}`} />
                      }
                      <span className="truncate">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(!filterPresets || filterPresets.length === 0) && !fc && (
            <div className="text-[10px] text-gray-400 italic border-t border-gray-100 pt-2">
              Save presets in the Filters panel to assign them here.
            </div>
          )}
        </>
      ) : (
        /* ── Read-only for adopted categories ── */
        assignedName ? (
          <div className="p-2 bg-gray-50 rounded border border-gray-200 flex items-center gap-1.5">
            <Filter size={10} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-600">{assignedName}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 italic">No filter assigned.</span>
        )
      )}
    </div>
  );
}
