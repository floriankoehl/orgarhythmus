/**
 * ═══════════════════════════════════════════════════════════
 *  Response Applier
 *  ────────────────
 *  Parses AI responses, detects what they contain,
 *  builds a human-readable preview, and applies actionable
 *  content to the IdeaBin via the provided `applyCtx`.
 *
 *  Detection is format-driven (inspects JSON keys) rather
 *  than scenario-driven, so it handles slight format
 *  deviations gracefully.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Detection ─────────────────────────────────────────

/**
 * Analyse a parsed JSON response and return an array of
 * detected content items, each with { type, count?, data }.
 */
export function detectResponseContent(json) {
  if (!json || typeof json !== "object") return [];

  const found = [];

  // Bare array → treat as ideas
  if (Array.isArray(json)) {
    if (json.length > 0) {
      found.push({ type: "ideas", count: json.length, data: json });
    }
    return found;
  }

  // ── Ideas ──
  if (Array.isArray(json.ideas) && json.ideas.length > 0) {
    found.push({ type: "ideas", count: json.ideas.length, data: json.ideas });
  }
  if (Array.isArray(json.unassigned_ideas) && json.unassigned_ideas.length > 0) {
    found.push({
      type: "ideas", count: json.unassigned_ideas.length,
      data: json.unassigned_ideas, label: "unassigned ideas",
    });
  }

  // ── Categories ──
  if (Array.isArray(json.categories) && json.categories.length > 0) {
    const total = json.categories.reduce((s, c) => s + (c.ideas?.length || 0), 0);
    found.push({ type: "categories", count: json.categories.length, ideaCount: total, data: json.categories });
  }
  if (Array.isArray(json.new_categories) && json.new_categories.length > 0) {
    const total = json.new_categories.reduce((s, c) => s + (c.ideas?.length || 0), 0);
    found.push({
      type: "categories", count: json.new_categories.length,
      ideaCount: total, data: json.new_categories, label: "new categories",
    });
  }

  // ── Teams → imported as categories ──
  if (Array.isArray(json.teams) && json.teams.length > 0) {
    const total = json.teams.reduce((s, t) => s + (t.ideas?.length || 0), 0);
    found.push({ type: "teams", count: json.teams.length, ideaCount: total, data: json.teams });
  }

  // ── Ideas for existing categories ──
  if (Array.isArray(json.new_ideas_for_existing) && json.new_ideas_for_existing.length > 0) {
    const total = json.new_ideas_for_existing.reduce((s, c) => s + (c.ideas?.length || 0), 0);
    found.push({ type: "insert_into_existing", count: json.new_ideas_for_existing.length, ideaCount: total, data: json.new_ideas_for_existing });
  }

  // ── Legends ──
  // Handle both { legends: [...] } and { legends: { legends: [...] } }
  const legendsArr = Array.isArray(json.legends)
    ? json.legends
    : Array.isArray(json.legends?.legends) ? json.legends.legends : null;
  if (legendsArr && legendsArr.length > 0) {
    const totalTypes = legendsArr.reduce((s, l) => s + (l.types?.length || 0), 0);
    found.push({ type: "legends", count: legendsArr.length, typeCount: totalTypes, data: legendsArr });
  }
  if (Array.isArray(json.new_legend_types) && json.new_legend_types.length > 0) {
    found.push({ type: "new_legend_types", count: json.new_legend_types.length, data: json.new_legend_types });
  }

  // ── Filter presets ──
  if (Array.isArray(json.filter_presets) && json.filter_presets.length > 0) {
    found.push({ type: "filter_presets", count: json.filter_presets.length, data: json.filter_presets });
  }

  // ── Assignments (move existing ideas into categories) ──
  if (Array.isArray(json.assignments) && json.assignments.length > 0) {
    const totalIdeas = json.assignments.reduce((s, a) => s + (a.ideas?.length || 0), 0);
    found.push({ type: "assignments", count: json.assignments.length, ideaCount: totalIdeas, data: json.assignments });
  }

  // ── New category suggestions (from auto-categorise / gap analysis) ──
  // These contain string idea titles that reference EXISTING ideas to move,
  // not full idea objects to create — so we use a dedicated type.
  if (Array.isArray(json.new_category_suggestions) && json.new_category_suggestions.length > 0) {
    const total = json.new_category_suggestions.reduce((s, c) => s + (c.ideas?.length || 0), 0);
    found.push({
      type: "new_cat_assignments", count: json.new_category_suggestions.length,
      ideaCount: total, data: json.new_category_suggestions,
    });
  }

  // ── Gap analysis (suggested ideas are actionable) ──
  if (Array.isArray(json.gaps) && json.gaps.length > 0) {
    const suggestedIdeas = json.gaps.flatMap(g => (g.suggested_ideas || []).map(i => ({
      ...i,
      _gap_area: g.area,
      _gap_category: g.suggested_category,
    })));
    if (suggestedIdeas.length > 0) {
      found.push({ type: "gap_ideas", count: suggestedIdeas.length, data: suggestedIdeas, gapCount: json.gaps.length });
    }
    if (json.overall_assessment) {
      found.push({ type: "analysis_text", label: "Gap assessment", data: json.overall_assessment });
    }
  }

  // ── Duplicate analysis (merged versions are actionable) ──
  if (Array.isArray(json.duplicate_groups) && json.duplicate_groups.length > 0) {
    const merged = json.duplicate_groups.filter(g => g.merged_version).map(g => g.merged_version);
    if (merged.length > 0) {
      found.push({ type: "dedup_merged", count: merged.length, data: merged, groupCount: json.duplicate_groups.length });
    } else {
      found.push({ type: "analysis_text", label: "Duplicate analysis", data: JSON.stringify(json.duplicate_groups, null, 2) });
    }
  }

  // ── Analysis (truly read-only) ──
  if (json.tiers)   found.push({ type: "analysis_text", label: "Priority tiers", data: JSON.stringify(json.tiers, null, 2) });
  if (json.summary) found.push({ type: "analysis_text", label: "Context summary", data: JSON.stringify(json.summary, null, 2) });

  // ── Suggestions text ──
  if (json.suggestions && typeof json.suggestions === "string") {
    found.push({ type: "suggestions", data: json.suggestions });
  }

  return found;
}


// ─── Preview labels ────────────────────────────────────

/** Turn a detected-items array into human-readable label strings. */
export function buildPreviewLabels(detected) {
  return detected.map(item => {
    switch (item.type) {
      case "ideas":
        return `${item.count} ${item.label || "ideas"}`;
      case "categories":
        return `${item.count} ${item.label || "categories"}${item.ideaCount ? ` (${item.ideaCount} ideas)` : ""}`;
      case "teams":
        return `${item.count} teams${item.ideaCount ? ` (${item.ideaCount} ideas)` : ""} → created as categories`;
      case "insert_into_existing":
        return `Ideas for ${item.count} existing categories (${item.ideaCount} total)`;
      case "new_cat_assignments":
        return `${item.count} new ${item.count > 1 ? "categories" : "category"} + move ${item.ideaCount} ideas into them`;
      case "assignments":
        return `Move ideas into ${item.count} existing ${item.count > 1 ? "categories" : "category"} (${item.ideaCount} ideas)`;
      case "gap_ideas":
        return `${item.count} suggested ideas from ${item.gapCount} gap${item.gapCount > 1 ? "s" : ""}`;
      case "dedup_merged":
        return `${item.count} merged ideas from ${item.groupCount} duplicate groups`;
      case "legends":
        return `${item.count} legend${item.count > 1 ? "s" : ""} with ${item.typeCount} types`;
      case "new_legend_types":
        return `New types for ${item.count} legend${item.count > 1 ? "s" : ""}`;
      case "filter_presets":
        return `${item.count} filter preset${item.count > 1 ? "s" : ""}`;
      case "analysis_text":
        return `${item.label || "Analysis"} (read-only)`;
      case "suggestions":
        return "Suggestions";
      default:
        return "Unknown content";
    }
  });
}


// ─── Actionable check ──────────────────────────────────

const ACTIONABLE_TYPES = new Set([
  "ideas", "categories", "teams", "insert_into_existing",
  "new_cat_assignments", "assignments", "gap_ideas", "dedup_merged",
  "legends", "new_legend_types", "filter_presets",
]);

/** Ensure new-category-assignments run before assignments to existing cats. */
const TYPE_ORDER = [
  "new_cat_assignments", "categories", "assignments",
  "ideas", "teams", "insert_into_existing",
  "gap_ideas", "dedup_merged",
  "legends", "new_legend_types", "filter_presets",
];

/** True if any detected item can be applied (not just analysis). */
export function hasActionableContent(detected) {
  return detected.some(item => ACTIONABLE_TYPES.has(item.type));
}


// ─── Apply ─────────────────────────────────────────────

/**
 * Apply all actionable items to IdeaBin.
 *
 * @param {Array}  detected  – from detectResponseContent()
 * @param {Object} applyCtx  – functions & state provided by IdeaBin:
 *   createIdea(title, desc, categoryId, contextId)
 *   importCategories(jsonData, contextId) → result
 *   insertIdeas(categoryId, jsonData, contextId) → result
 *   createCategory(name) → result
 *   createLegend(name) → { legend: { id, … } }
 *   createTypeOnLegend(legendId, name, color, icon) → type
 *   assignIdeaToCategory(placementId, categoryId) – move idea
 *   setFilterPresets(updater)  – React setState-style
 *   refreshAll() → Promise
 *   activeContextId  – number | null
 *   ideas            – current { [placementId]: { title, … } }
 *   categories       – current { [id]: { id, name, … } }
 *   dims             – { legends, legendTypes, … }
 *
 * @returns {{ created: string[], errors: string[] }}
 */
export async function applyDetected(detected, applyCtx) {
  const {
    createIdea,
    importCategories,
    insertIdeas,
    createCategory,
    createLegend,
    createTypeOnLegend,
    assignIdeaToCategory,
    setFilterPresets,
    refreshAll,
    activeContextId,
    ideas,
    categories,
    dims,
  } = applyCtx;

  const result = { created: [], errors: [] };

  // Sort so new-cat-assignments happen before regular assignments
  const sorted = [...detected].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type);
    const bi = TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  // Track categories created during this apply call (name → id)
  const newCatIds = {};

  for (const item of sorted) {
    if (!ACTIONABLE_TYPES.has(item.type)) continue;

    try {
      switch (item.type) {

        // ── Create unassigned ideas ──
        case "ideas": {
          for (const idea of item.data) {
            await createIdea(
              idea.title || "Untitled",
              idea.description || "",
              null,           // no category (unassigned)
              activeContextId,
            );
          }
          result.created.push(`${item.data.length} ideas`);
          break;
        }

        // ── Import categories (with or without ideas) ──
        case "categories": {
          const withIdeas = item.data.filter(c => c.ideas?.length > 0);
          const empty     = item.data.filter(c => !c.ideas?.length);

          if (withIdeas.length > 0) {
            if (withIdeas.length === 1) {
              await importCategories(withIdeas[0], activeContextId);
            } else {
              await importCategories({ categories: withIdeas }, activeContextId);
            }
            const n = withIdeas.reduce((s, c) => s + c.ideas.length, 0);
            result.created.push(`${withIdeas.length} categories (${n} ideas)`);
          }

          for (const cat of empty) {
            await createCategory(cat.category_name || "Untitled");
          }
          if (empty.length) result.created.push(`${empty.length} empty categories`);
          break;
        }

        // ── Teams → categories ──
        case "teams": {
          const teamCats = item.data.map(t => ({
            category_name: t.team_name || t.name || "Unnamed team",
            ideas: (t.ideas || []).map(i => ({
              title: i.title || "Untitled",
              description: i.description || "",
            })),
          }));
          if (teamCats.length === 1) {
            await importCategories(teamCats[0], activeContextId);
          } else {
            await importCategories({ categories: teamCats }, activeContextId);
          }
          result.created.push(`${teamCats.length} team-categories`);
          break;
        }

        // ── Insert ideas into existing categories (matched by name) ──
        case "insert_into_existing": {
          const catByName = {};
          for (const c of Object.values(categories || {})) {
            catByName[c.name.toLowerCase()] = c;
          }

          let insertedCount = 0;
          const notFound = [];

          for (const entry of item.data) {
            const match = catByName[(entry.category_name || "").toLowerCase()];
            if (match) {
              await insertIdeas(match.id, { ideas: entry.ideas }, activeContextId);
              insertedCount += entry.ideas.length;
            } else {
              notFound.push(entry.category_name);
              // Fallback: create as new category
              await importCategories(
                { category_name: entry.category_name, ideas: entry.ideas },
                activeContextId,
              );
            }
          }

          if (insertedCount) result.created.push(`${insertedCount} ideas inserted`);
          if (notFound.length) result.created.push(`${notFound.length} categories not found — created as new`);
          break;
        }

        // ── Create new categories and move existing ideas into them ──
        case "new_cat_assignments": {
          const ideaByTitle = {};
          for (const [pid, idea] of Object.entries(ideas || {})) {
            const key = (idea.title || "").toLowerCase();
            if (key) ideaByTitle[key] = parseInt(pid);
          }

          let catsCreated = 0;
          let moved = 0;
          let notFoundIdeas = 0;

          for (const entry of item.data) {
            const catName = (entry.category_name || "New Category").trim();
            const res = await createCategory(catName);
            const catId = res?.category?.id;
            if (!catId) {
              result.errors.push(`Failed to create category "${catName}"`);
              continue;
            }
            catsCreated++;
            // Track for subsequent assignment steps
            newCatIds[catName.toLowerCase()] = catId;

            for (const ideaRef of (entry.ideas || [])) {
              const title = typeof ideaRef === "string" ? ideaRef : ideaRef?.title || "";
              const pid = ideaByTitle[title.toLowerCase()];
              if (pid && assignIdeaToCategory) {
                await assignIdeaToCategory(pid, catId);
                moved++;
              } else {
                notFoundIdeas++;
              }
            }
          }

          if (catsCreated) result.created.push(`${catsCreated} new categories`);
          if (moved) result.created.push(`${moved} ideas moved into new categories`);
          if (notFoundIdeas) result.errors.push(`${notFoundIdeas} ideas not matched by title`);
          break;
        }

        // ── Assign existing ideas to categories (matched by title) ──
        case "assignments": {
          // Build lookup: category name → id (includes both existing + just-created)
          const catByName = {};
          for (const c of Object.values(categories || {})) {
            catByName[c.name.toLowerCase()] = c;
          }

          // Build lookup: idea title → placement id
          const ideaByTitle2 = {};
          for (const [pid, idea] of Object.entries(ideas || {})) {
            const key = (idea.title || "").toLowerCase();
            if (key) ideaByTitle2[key] = parseInt(pid);
          }

          let moved = 0;
          let notFoundIdeas = 0;
          let notFoundCats = 0;

          for (const assignment of item.data) {
            const name = (assignment.category_name || "").toLowerCase();
            // Check existing categories first, then newly-created ones
            const catId = catByName[name]?.id || newCatIds[name];
            if (!catId) { notFoundCats++; continue; }

            for (const ideaRef of (assignment.ideas || [])) {
              const title = typeof ideaRef === "string" ? ideaRef : ideaRef?.title || "";
              const pid = ideaByTitle2[title.toLowerCase()];
              if (pid && assignIdeaToCategory) {
                await assignIdeaToCategory(pid, catId);
                moved++;
              } else {
                notFoundIdeas++;
              }
            }
          }

          if (moved) result.created.push(`${moved} ideas moved to categories`);
          if (notFoundIdeas) result.errors.push(`${notFoundIdeas} ideas not matched by title`);
          if (notFoundCats) result.errors.push(`${notFoundCats} target categories not found`);
          break;
        }

        // ── Gap analysis suggested ideas → create as unassigned ──
        case "gap_ideas": {
          for (const idea of item.data) {
            await createIdea(
              idea.title || "Untitled",
              idea.description || "",
              null,
              activeContextId,
            );
          }
          result.created.push(`${item.data.length} ideas from gap analysis`);
          break;
        }

        // ── Deduplicate merged versions → create as new ideas ──
        case "dedup_merged": {
          for (const idea of item.data) {
            await createIdea(
              idea.title || "Merged idea",
              idea.description || "",
              null,
              activeContextId,
            );
          }
          result.created.push(`${item.data.length} merged ideas`);
          break;
        }

        // ── Create legends + types ──
        case "legends": {
          let createdLegends = 0;
          let createdTypes   = 0;

          for (const legend of item.data) {
            const res = await createLegend(legend.name || "Unnamed");
            const legendId = res?.legend?.id;
            createdLegends++;

            if (legendId && legend.types?.length) {
              for (const t of legend.types) {
                await createTypeOnLegend(legendId, t.name, t.color || "#6366f1", t.icon || null);
                createdTypes++;
              }
            }
          }

          result.created.push(`${createdLegends} legends, ${createdTypes} types`);
          break;
        }

        // ── Add types to existing legends (matched by name) ──
        case "new_legend_types": {
          const legByName = {};
          for (const l of (dims?.legends || [])) {
            legByName[l.name.toLowerCase()] = l;
          }

          let addedTypes = 0;
          for (const entry of item.data) {
            const leg = legByName[(entry.legend_name || "").toLowerCase()];
            if (leg && entry.types?.length) {
              for (const t of entry.types) {
                await createTypeOnLegend(leg.id, t.name, t.color || "#6366f1", t.icon || null);
                addedTypes++;
              }
            }
          }

          result.created.push(`${addedTypes} legend types`);
          break;
        }

        // ── Filter presets ──
        case "filter_presets": {
          if (setFilterPresets) {
            setFilterPresets(prev => [
              ...prev,
              ...item.data.map(p => ({
                name: p.name || "AI Preset",
                rules: p.rules || [],
                combineMode: p.combine_mode || "and",
              })),
            ]);
            result.created.push(`${item.data.length} filter presets`);
          }
          break;
        }
      }
    } catch (e) {
      result.errors.push(`${item.type}: ${e.message || "Unknown error"}`);
    }
  }

  // Refresh all data after applying
  if (result.created.length > 0 && refreshAll) {
    try { await refreshAll(); } catch { /* swallow refresh errors */ }
  }

  return result;
}
