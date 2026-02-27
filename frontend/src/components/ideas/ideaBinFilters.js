/**
 * Pure filter utilities for IdeaBin.
 *
 * These functions evaluate whether an idea passes the current filter
 * configuration (legend filters, stacked filters, global type filter).
 * They are stateless — all inputs are passed explicitly.
 */

/**
 * Evaluate a single group of filter rules against an idea.
 * @param {Array} rules – [{legendId, typeIds, mode: "include"|"exclude"}, ...]
 * @param {string} combineMode – "and" | "or"
 * @param {object} idea – placement object with `legend_types`
 * @returns {boolean}
 */
export function evalFilterGroup(rules, combineMode, idea) {
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
}

/**
 * Check whether an idea passes the advanced legend filters (multi-legend + stacked groups).
 * @param {object} idea
 * @param {Array} legendFilters – primary filter rules
 * @param {string} filterCombineMode – "and" | "or"
 * @param {Array} stackedFilters – [{name, rules, combineMode}, ...]
 * @param {string} stackCombineMode – "and" | "or"
 * @returns {boolean}
 */
export function passesLegendFilters(idea, legendFilters, filterCombineMode, stackedFilters, stackCombineMode) {
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
}

/**
 * Check whether an idea passes the simple global type filter (single active legend).
 * @param {object} idea
 * @param {Array} globalTypeFilter – array of type IDs (or "unassigned")
 * @param {*} activeLegendId
 * @returns {boolean}
 */
export function passesGlobalTypeFilter(idea, globalTypeFilter, activeLegendId) {
  if (globalTypeFilter.length === 0) return true;
  if (!idea) return false;
  const dimId = String(activeLegendId || "");
  const dt = idea.legend_types?.[dimId];
  if (globalTypeFilter.includes("unassigned") && !dt) return true;
  if (dt && globalTypeFilter.includes(dt.legend_type_id)) return true;
  return false;
}

/**
 * Combined filter: use advanced legend filters if active, else fall back to simple global type filter.
 * @param {object} idea
 * @param {object} filterState – { legendFilters, filterCombineMode, stackedFilters, stackCombineMode, globalTypeFilter, activeLegendId }
 * @returns {boolean}
 */
export function passesAllFiltersCheck(idea, filterState) {
  const { legendFilters, filterCombineMode, stackedFilters, stackCombineMode, globalTypeFilter, activeLegendId } = filterState;
  const hasAdvanced = legendFilters.length > 0 || stackedFilters.length > 0;
  if (hasAdvanced) {
    return passesLegendFilters(idea, legendFilters, filterCombineMode, stackedFilters, stackCombineMode);
  }
  return passesGlobalTypeFilter(idea, globalTypeFilter, activeLegendId);
}
