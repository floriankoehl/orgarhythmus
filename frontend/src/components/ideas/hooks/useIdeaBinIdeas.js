import { useState, useRef, useCallback } from "react";
import { playSound } from "../../../assets/sound_registry";
import {
  fetchAllIdeas as fetchAllIdeasApi,
  createIdeaApi,
  deleteIdeaApi,
  updateIdeaTitleApi,
  updateIdeaHeadlineApi,
  safeOrderApi,
  assignIdeaToCategoryApi,
  pasteIdeaApi,
  spinoffIdeaApi,
  deleteMetaIdeaApi,
  removeIdeaFromCategoryApi,
  removeAllIdeaCategoriesApi,
  removeAllIdeaLegendTypesApi,
  assignIdeaLegendTypeApi,
  batchRemoveLegendTypeApi,
  batchAssignLegendTypeApi,
  batchSetArchiveApi,
  toggleUpvoteApi,
  fetchCommentsApi,
  addCommentApi,
  deleteCommentApi,
  fetchMetaIdeasApi,
  toggleArchiveIdeaApi,
} from "../api/ideaApi";

export default function useIdeaBinIdeas({ selectedCategoryIds }) {
  const [ideas, setIdeas] = useState({});
  const [unassignedOrder, setUnassignedOrder] = useState([]);
  const [categoryOrders, setCategoryOrders] = useState({});
  const [ideaName, setIdeaName] = useState("");
  const [ideaHeadline, setIdeaHeadline] = useState("");

  // ── Edit state ──
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");
  const [editingIdeaHeadline, setEditingIdeaHeadline] = useState("");

  // ── Collapse state ──
  const [collapsedIdeas, setCollapsedIdeas] = useState({});
  const [ideaSettingsOpen, setIdeaSettingsOpen] = useState(null);

  // ── Wiggle state ──
  const [wigglingIdeaId, setWigglingIdeaId] = useState(null);

  // ── Copy / Paste ──
  const [copiedIdeaId, setCopiedIdeaId] = useState(null);
  const pasteGuard = useRef(false);

  // ── Meta ideas list ──
  const [showMetaList, setShowMetaList] = useState(false);
  const [metaIdeas, setMetaIdeas] = useState([]);

  // ── Undo / Redo history (max 10 moves) ──
  const historyRef = useRef({ undo: [], redo: [] });
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });

  const pushMove = useCallback((move) => {
    const h = historyRef.current;
    h.undo = [...h.undo.slice(-9), move]; // keep last 10
    h.redo = [];
    setHistoryCount({ undo: h.undo.length, redo: 0 });
  }, []);

  // ── Computed: unique meta ideas from placements (exclude archived) ──
  const metaIdeaList = (() => {
    const seen = new Set();
    const result = [];
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      if (p.archived) continue;
      seen.add(p.idea_id);
      result.push(p);
    }
    return result;
  })();

  const fetch_all_ideas = useCallback(async () => {
    try {
      const { ideas: obj, order, categoryOrders: catOrders } = await fetchAllIdeasApi();
      setIdeas(obj);
      setUnassignedOrder(order);
      setCategoryOrders(catOrders);
    } catch (err) { console.error("IdeaBin: fetch ideas failed", err); }
  }, []);

  // ── Execute a move in the given direction ──
  const executeMoveRef = useRef(null);
  executeMoveRef.current = async (move, direction) => {
    switch (move.type) {
      case 'batch_assign_legend_type': {
        if (direction === 'undo') {
          // Group ideas by previous type to minimise API calls
          const byType = {};
          for (const [ideaId, prevTypeId] of Object.entries(move.previousStates)) {
            const key = String(prevTypeId ?? 'null');
            if (!byType[key]) byType[key] = [];
            byType[key].push(Number(ideaId));
          }
          for (const [typeKey, ids] of Object.entries(byType)) {
            await batchAssignLegendTypeApi(ids, move.legendId, typeKey === 'null' ? null : Number(typeKey));
          }
        } else {
          await batchAssignLegendTypeApi(move.ideaIds, move.legendId, move.newTypeId);
        }
        await fetch_all_ideas();
        break;
      }
      case 'archive_ideas': {
        // undo = unarchive, redo = archive
        await batchSetArchiveApi(move.ideaIds, direction === 'redo');
        await fetch_all_ideas();
        break;
      }
    }
  };

  const undo = useCallback(async () => {
    const h = historyRef.current;
    if (h.undo.length === 0) return;
    const move = h.undo[h.undo.length - 1];
    h.undo = h.undo.slice(0, -1);
    h.redo = [...h.redo, move];
    setHistoryCount({ undo: h.undo.length, redo: h.redo.length });
    await executeMoveRef.current(move, 'undo');
  }, []);

  const redo = useCallback(async () => {
    const h = historyRef.current;
    if (h.redo.length === 0) return;
    const move = h.redo[h.redo.length - 1];
    h.redo = h.redo.slice(0, -1);
    h.undo = [...h.undo, move];
    setHistoryCount({ undo: h.undo.length, redo: h.redo.length });
    await executeMoveRef.current(move, 'redo');
  }, []);

  const create_idea = useCallback(async () => {
    if (!ideaName.trim() && !ideaHeadline.trim()) return;
    const catId = selectedCategoryIds.size === 1 ? [...selectedCategoryIds][0] : null;
    await createIdeaApi(
      ideaName.trim() || ideaHeadline.trim(),
      "",
      ideaHeadline,
      catId
    );
    setIdeaName("");
    setIdeaHeadline("");
    playSound('ideaCreate');
    fetch_all_ideas();
  }, [ideaName, ideaHeadline, selectedCategoryIds, fetch_all_ideas]);

  const delete_idea = useCallback(async (id) => {
    await deleteIdeaApi(id);
    playSound('ideaDelete');
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const update_idea_title_api = useCallback(async (placementId, title, headline = null) => {
    if (!title.trim()) return;
    const idea = ideas[placementId];
    const ideaId = idea?.idea_id || placementId;
    await updateIdeaTitleApi(ideaId, title);
    if (headline !== null) {
      await updateIdeaHeadlineApi(ideaId, headline);
    }
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          updated[pid] = { ...p, title, headline: headline !== null ? headline : p.headline };
        }
      }
      return updated;
    });
  }, [ideas]);

  const safe_order = useCallback(async (order, categoryId = null) => {
    await safeOrderApi(order, categoryId);
  }, []);

  const assign_idea_to_category = useCallback(async (placementId, categoryId) => {
    await assignIdeaToCategoryApi(placementId, categoryId);
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const copy_idea = useCallback((placementId) => {
    const idea = ideas[placementId];
    if (idea) {
      setCopiedIdeaId(idea.idea_id);
      playSound('ideaCopy');
    }
  }, [ideas]);

  const paste_idea = useCallback(async (categoryId = null) => {
    if (!copiedIdeaId || pasteGuard.current) return;
    pasteGuard.current = true;
    try {
      await pasteIdeaApi(copiedIdeaId, categoryId);
      playSound('ideaCreate');
      await fetch_all_ideas();
    } finally {
      pasteGuard.current = false;
    }
  }, [copiedIdeaId, fetch_all_ideas]);

  const spinoff_idea = useCallback(async (metaIdeaId) => {
    if (!metaIdeaId) return;
    try {
      await spinoffIdeaApi(metaIdeaId);
      playSound('ideaCreate');
      await fetch_all_ideas();
    } catch (err) { console.error("Spinoff failed:", err); }
  }, [fetch_all_ideas]);

  const delete_meta_idea = useCallback(async (ideaId) => {
    await deleteMetaIdeaApi(ideaId);
    playSound('ideaDelete');
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const remove_idea_from_category = useCallback(async (placementId) => {
    await removeIdeaFromCategoryApi(placementId);
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const remove_all_idea_categories = useCallback(async (ideaId) => {
    await removeAllIdeaCategoriesApi(ideaId);
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const remove_all_idea_legend_types = useCallback(async (ideaId) => {
    await removeAllIdeaLegendTypesApi(ideaId);
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const remove_idea_legend_type = useCallback(async (ideaId, legendId) => {
    await assignIdeaLegendTypeApi(ideaId, legendId, null);
    fetch_all_ideas();
  }, [fetch_all_ideas]);

  const assign_idea_legend_type = useCallback(async (placementId, legendTypeId, dims) => {
    const idea = ideas[placementId];
    const ideaId = idea?.idea_id || placementId;
    const legendId = dims.activeLegendId;
    if (!legendId) return;
    // Record move for undo
    const prevDt = idea?.legend_types?.[String(legendId)];
    pushMove({
      type: 'batch_assign_legend_type',
      legendId,
      previousStates: { [ideaId]: prevDt?.legend_type_id ?? null },
      newTypeId: legendTypeId,
      ideaIds: [ideaId],
    });
    await assignIdeaLegendTypeApi(ideaId, legendId, legendTypeId);
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (p.idea_id === ideaId) {
          const newDt = { ...p.legend_types };
          if (legendTypeId) {
            const lt = dims.legendTypes[legendTypeId];
            newDt[String(legendId)] = { legend_type_id: legendTypeId, name: lt?.name || "", color: lt?.color || "#ccc", icon: lt?.icon || null };
          } else {
            delete newDt[String(legendId)];
          }
          updated[pid] = { ...p, legend_types: newDt };
        }
      }
      return updated;
    });
  }, [ideas, pushMove]);

  const batchRemoveLegendType = useCallback(async (legendId, typeId = null) => {
    const seen = new Set();
    const ideaIds = [];
    for (const p of Object.values(ideas)) {
      if (!p.idea_id || seen.has(p.idea_id)) continue;
      seen.add(p.idea_id);
      const dt = p.legend_types?.[String(legendId)];
      if (!dt) continue;
      if (typeId !== null && dt.legend_type_id !== typeId) continue;
      ideaIds.push(p.idea_id);
    }
    if (ideaIds.length === 0) return;
    try {
      await batchRemoveLegendTypeApi(ideaIds, legendId);
      await fetch_all_ideas();
    } catch (err) { console.error("Batch remove legend type failed:", err); }
  }, [ideas, fetch_all_ideas]);

  const batch_assign_idea_legend_type = useCallback(async (placementIds, legendTypeId, dims) => {
    const legendId = dims.activeLegendId;
    if (!legendId) return;
    // Collect unique idea IDs and capture previous states
    const seen = new Set();
    const ideaIds = [];
    const previousStates = {};
    for (const pid of placementIds) {
      const idea = ideas[pid];
      const ideaId = idea?.idea_id || pid;
      if (!seen.has(ideaId)) {
        seen.add(ideaId);
        ideaIds.push(ideaId);
        const prevDt = idea?.legend_types?.[String(legendId)];
        previousStates[ideaId] = prevDt?.legend_type_id ?? null;
      }
    }
    if (ideaIds.length === 0) return;
    // Record move for undo
    pushMove({
      type: 'batch_assign_legend_type',
      legendId,
      previousStates,
      newTypeId: legendTypeId,
      ideaIds,
    });
    // Optimistic UI update
    setIdeas(prev => {
      const updated = { ...prev };
      for (const [pid, p] of Object.entries(updated)) {
        if (seen.has(p.idea_id)) {
          const newDt = { ...p.legend_types };
          if (legendTypeId) {
            const lt = dims.legendTypes[legendTypeId];
            newDt[String(legendId)] = { legend_type_id: legendTypeId, name: lt?.name || "", color: lt?.color || "#ccc", icon: lt?.icon || null };
          } else {
            delete newDt[String(legendId)];
          }
          updated[pid] = { ...p, legend_types: newDt };
        }
      }
      return updated;
    });
    // Single API call
    await batchAssignLegendTypeApi(ideaIds, legendId, legendTypeId);
  }, [ideas, pushMove]);

  // ── Upvote & Comments ──
  const toggle_upvote = useCallback(async (ideaId) => {
    try {
      const data = await toggleUpvoteApi(ideaId);
      setIdeas(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].idea_id === ideaId) {
            next[key] = { ...next[key], upvote_count: data.upvote_count, user_has_upvoted: data.upvoted };
          }
        }
        return next;
      });
    } catch (err) { console.error("Upvote failed:", err); }
  }, []);

  const fetch_comments = useCallback(async (ideaId) => {
    try {
      return await fetchCommentsApi(ideaId);
    } catch (err) { console.error("Fetch comments failed:", err); return []; }
  }, []);

  const add_comment = useCallback(async (ideaId, text) => {
    try {
      const data = await addCommentApi(ideaId, text);
      if (!data) return null;
      setIdeas(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].idea_id === ideaId) {
            next[key] = { ...next[key], comment_count: (next[key].comment_count || 0) + 1 };
          }
        }
        return next;
      });
      return data;
    } catch (err) { console.error("Add comment failed:", err); return null; }
  }, []);

  const delete_comment = useCallback(async (commentId, ideaId) => {
    try {
      await deleteCommentApi(commentId);
      setIdeas(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].idea_id === ideaId) {
            next[key] = { ...next[key], comment_count: Math.max(0, (next[key].comment_count || 1) - 1) };
          }
        }
        return next;
      });
    } catch (err) { console.error("Delete comment failed:", err); }
  }, []);

  const fetch_meta_ideas = useCallback(async () => {
    try {
      const list = await fetchMetaIdeasApi();
      setMetaIdeas(list);
    } catch (err) { console.error("IdeaBin: fetch meta ideas failed", err); }
  }, []);

  const toggle_archive_idea = useCallback(async (ideaIds) => {
    const ids = Array.isArray(ideaIds) ? ideaIds : [ideaIds];
    // Record move for undo
    pushMove({
      type: 'archive_ideas',
      ideaIds: ids,
    });
    // Optimistically remove archived ideas from local state
    setIdeas(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (ids.includes(next[key].idea_id)) delete next[key];
      }
      return next;
    });
    await toggleArchiveIdeaApi(ids);
    fetch_all_ideas();
  }, [fetch_all_ideas, pushMove]);

  return {
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
    batch_assign_idea_legend_type,
    batchRemoveLegendType,
    toggle_upvote,
    fetch_comments,
    add_comment,
    delete_comment,
    fetch_meta_ideas,
    toggle_archive_idea,
    undo,
    redo,
    historyCount,
  };
}
