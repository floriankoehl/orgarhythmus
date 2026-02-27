import { useMemo } from "react";

/**
 * Derives context-aware collections from the raw ideas/category data.
 *
 * When inside a context, filters unassigned order, meta idea list, and
 * category orders to only include ideas related to the active context.
 * When outside a context, passes the raw data through unchanged.
 *
 * @param {object} deps
 * @param {object|null} deps.activeContext – currently entered context, or null
 * @param {object} deps.contextIdeaOrders – { contextId: [ideaId, ...] }
 * @param {object} deps.ideas – { placementId: idea }
 * @param {Array} deps.unassignedOrder – raw unassigned placement IDs
 * @param {Array} deps.metaIdeaList – de-duped all-ideas list
 * @param {object} deps.categoryOrders – { catKey: [placementId, ...] }
 * @returns {{ effectiveUnassignedOrder, effectiveUnassignedCount, effectiveMetaIdeaList, effectiveCategoryOrders }}
 */
export default function useIdeaBinDerivedState({
  activeContext,
  contextIdeaOrders,
  ideas,
  unassignedOrder,
  metaIdeaList,
  categoryOrders,
}) {
  // ── Context-aware unassigned: when inside a context, show ideas linked to the
  //    context that are NOT placed in any category within the context. ──
  const effectiveUnassignedOrder = useMemo(() => {
    if (!activeContext) return unassignedOrder;
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    if (ctxIdeaIds.size === 0) return [];
    const ctxCatIds = new Set((activeContext.category_ids || []).map(Number));
    // Find all placements for context-linked ideas that are in no context category
    const matching = Object.values(ideas)
      .filter(p => p && ctxIdeaIds.has(p.idea_id) && (p.category == null || !ctxCatIds.has(Number(p.category))))
      .sort((a, b) => a.order_index - b.order_index)
      .map(p => p.id);
    return matching;
  }, [activeContext, contextIdeaOrders, ideas, unassignedOrder]);

  const effectiveUnassignedCount = effectiveUnassignedOrder.length;

  // ── Context-aware "All Ideas" list: when inside a context, show ideas
  //    that relate to this context in ANY way:
  //    1) directly linked via IdeaContextPlacement (context-unassigned), OR
  //    2) placed in a category that belongs to this context. ──
  const effectiveMetaIdeaList = useMemo(() => {
    if (!activeContext) return metaIdeaList;
    // 1) ideas linked directly to the context
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    // 2) ideas sitting in any of the context's categories
    const ctxCatIds = new Set((activeContext.category_ids || []).map(String));
    for (const p of Object.values(ideas)) {
      if (p && p.idea_id && p.category != null && ctxCatIds.has(String(p.category))) {
        ctxIdeaIds.add(p.idea_id);
      }
    }
    if (ctxIdeaIds.size === 0) return [];
    return metaIdeaList.filter(p => ctxIdeaIds.has(p.idea_id));
  }, [activeContext, contextIdeaOrders, metaIdeaList, ideas]);

  // ── Context-aware category orders: when inside a context, filter each
  //    category's idea list to only include context-linked ideas. ──
  const effectiveCategoryOrders = useMemo(() => {
    if (!activeContext) return categoryOrders;
    const ctxIdeaIds = new Set(contextIdeaOrders[activeContext.id] || []);
    if (ctxIdeaIds.size === 0) {
      const empty = {};
      for (const k of Object.keys(categoryOrders)) empty[k] = [];
      return empty;
    }
    const filtered = {};
    for (const [catKey, order] of Object.entries(categoryOrders)) {
      filtered[catKey] = order.filter(ideaId => {
        const p = ideas[ideaId];
        return p && ctxIdeaIds.has(p.idea_id);
      });
    }
    return filtered;
  }, [activeContext, contextIdeaOrders, categoryOrders, ideas]);

  return {
    effectiveUnassignedOrder,
    effectiveUnassignedCount,
    effectiveMetaIdeaList,
    effectiveCategoryOrders,
  };
}
