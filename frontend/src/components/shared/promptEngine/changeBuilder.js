/**
 * ═══════════════════════════════════════════════════════════
 *  Change Builder
 *  ──────────────
 *  Decomposes detected AI response items (from responseApplier)
 *  into individual atomic change items that can be
 *  independently accepted or declined, with dependency
 *  tracking (declining a parent auto-declines its children).
 *
 *  Exports:
 *    buildChangeItems(detected) → ChangeItem[]
 *    recomposeDetected(detected, changeItems) → filtered detected[]
 *
 *  A "change item" is the smallest unit the user reviews:
 *    - create one idea
 *    - rename one category
 *    - move one idea into a category
 *    - etc.
 *
 *  The recompose function rebuilds the detected array by
 *  filtering out declined items, so the existing
 *  `applyDetected()` can be reused as-is.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Execution order (imported conceptually from responseApplier) ──
const TYPE_ORDER = [
  "update_categories", "update_ideas", "legend_assignments",
  "new_cat_assignments", "categories", "assignments",
  "ideas", "teams", "insert_into_existing",
  "gap_ideas", "dedup_merged",
  "legends", "new_legend_types", "filter_presets",
];
const TYPE_ORDER_MAP = {};
TYPE_ORDER.forEach((t, i) => { TYPE_ORDER_MAP[t] = i; });

// ─── Helpers ───────────────────────────────────────────

function truncate(str, len = 50) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

// ─── Change-type meta (icons, colours for the UI) ──────

export const CHANGE_TYPE_META = {
  create_idea:         { color: "text-green-600",  dotColor: "bg-green-500" },
  create_category:     { color: "text-blue-600",   dotColor: "bg-blue-500" },
  update_idea:         { color: "text-amber-600",  dotColor: "bg-amber-500" },
  rename_category:     { color: "text-amber-600",  dotColor: "bg-amber-500" },
  move_idea:           { color: "text-teal-600",   dotColor: "bg-teal-500" },
  assign_legend:       { color: "text-purple-600", dotColor: "bg-purple-500" },
  create_legend:       { color: "text-purple-600", dotColor: "bg-purple-500" },
  create_legend_type:  { color: "text-purple-600", dotColor: "bg-purple-400" },
  create_filter_preset:{ color: "text-gray-600",   dotColor: "bg-gray-500" },
};


// ═══════════════════════════════════════════════════════════
//  Build Change Items
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChangeItem
 * @property {string}       id          – unique identifier (ch-1, ch-2, …)
 * @property {string|null}  parentId    – functional dependency parent
 * @property {boolean}      accepted    – user's accept/decline decision
 * @property {string}       label       – primary display text
 * @property {string|null}  sublabel    – secondary detail
 * @property {string}       changeType  – semantic type (see CHANGE_TYPE_META)
 * @property {string}       group       – visual group heading
 * @property {number}       depth       – 0 = root, 1 = child (for indentation)
 * @property {number}       _sortOrder  – for group ordering
 * @property {Object}       _ref        – back-reference into detected[]
 */

/**
 * Decompose `detected` (from detectResponseContent) into
 * an array of atomic, toggleable change items.
 */
export function buildChangeItems(detected) {
  const items = [];
  let nextId = 1;
  const makeId = () => `ch-${nextId++}`;

  for (let detIdx = 0; detIdx < detected.length; detIdx++) {
    const item = detected[detIdx];
    const sortOrder = TYPE_ORDER_MAP[item.type] ?? 999;

    switch (item.type) {

      // ── Update existing ideas (matched by original_title) ──
      case "update_ideas": {
        for (let di = 0; di < item.data.length; di++) {
          const idea = item.data[di];
          const titleChanged = idea.title && idea.title !== idea.original_title;
          const hasDesc = idea.description != null;

          const parts = [];
          if (titleChanged) parts.push(`Title → "${truncate(idea.title, 35)}"`);
          if (hasDesc) parts.push("Description updated");

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update: "${truncate(idea.original_title, 40)}"`,
            sublabel: parts.join(" · ") || null,
            changeType: "update_idea",
            group: "Update Ideas",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Rename categories + nested idea updates ──
      case "update_categories": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const newName = entry.category_name || entry.original_name;
          const renamed = newName !== entry.original_name;

          const catItemId = makeId();
          items.push({
            id: catItemId, parentId: null, accepted: true,
            label: renamed
              ? `Rename: "${truncate(entry.original_name, 28)}" → "${truncate(newName, 28)}"`
              : `Category: "${truncate(entry.original_name, 40)}"`,
            sublabel: entry.updated_ideas?.length
              ? `+ ${entry.updated_ideas.length} idea update${entry.updated_ideas.length > 1 ? "s" : ""}`
              : null,
            changeType: "rename_category",
            group: "Rename Categories",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });

          // Nested idea updates are independent of the rename
          // (the ideas exist already) but visually grouped underneath
          for (let ci = 0; ci < (entry.updated_ideas || []).length; ci++) {
            const idea = entry.updated_ideas[ci];
            const titleChanged = idea.title && idea.title !== idea.original_title;
            const hasDesc = idea.description != null;
            const parts = [];
            if (titleChanged) parts.push(`Title → "${truncate(idea.title, 35)}"`);
            if (hasDesc) parts.push("Description updated");

            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Update: "${truncate(idea.original_title, 38)}"`,
              sublabel: parts.join(" · ") || null,
              changeType: "update_idea",
              group: "Rename Categories",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "updated_ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Legend type assignments ──
      case "legend_assignments": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Assign "${truncate(entry.type_name, 25)}" to "${truncate(entry.idea_title, 25)}"`,
            sublabel: `Legend: ${entry.legend_name}`,
            changeType: "assign_legend",
            group: "Legend Assignments",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create unassigned ideas ──
      case "ideas": {
        const groupLabel = item.label
          ? item.label.charAt(0).toUpperCase() + item.label.slice(1)
          : "New Ideas";
        for (let di = 0; di < item.data.length; di++) {
          const idea = item.data[di];
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Create: "${truncate(idea.title, 45)}"`,
            sublabel: idea.description ? truncate(idea.description, 60) : null,
            changeType: "create_idea",
            group: groupLabel,
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create categories (with or without ideas) ──
      case "categories": {
        const groupLabel = item.label
          ? item.label.charAt(0).toUpperCase() + item.label.slice(1)
          : "New Categories";
        for (let di = 0; di < item.data.length; di++) {
          const cat = item.data[di];
          const name = cat.category_name || "Untitled";
          const hasIdeas = cat.ideas?.length > 0;

          const catItemId = makeId();
          items.push({
            id: catItemId, parentId: null, accepted: true,
            label: `Create category: "${truncate(name, 38)}"`,
            sublabel: hasIdeas ? `${cat.ideas.length} idea${cat.ideas.length > 1 ? "s" : ""}` : "Empty",
            changeType: "create_category",
            group: groupLabel,
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });

          // Ideas inside depend on the category being created
          for (let ci = 0; ci < (cat.ideas || []).length; ci++) {
            const idea = cat.ideas[ci];
            items.push({
              id: makeId(), parentId: catItemId, accepted: true,
              label: `Create: "${truncate(idea.title, 42)}"`,
              sublabel: idea.description ? truncate(idea.description, 55) : null,
              changeType: "create_idea",
              group: groupLabel,
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Teams → categories ──
      case "teams": {
        for (let di = 0; di < item.data.length; di++) {
          const team = item.data[di];
          const name = team.team_name || team.name || "Unnamed team";

          const teamItemId = makeId();
          items.push({
            id: teamItemId, parentId: null, accepted: true,
            label: `Create team-category: "${truncate(name, 33)}"`,
            sublabel: team.ideas?.length
              ? `${team.ideas.length} idea${team.ideas.length > 1 ? "s" : ""}`
              : "Empty",
            changeType: "create_category",
            group: "Teams",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });

          for (let ci = 0; ci < (team.ideas || []).length; ci++) {
            const idea = team.ideas[ci];
            items.push({
              id: makeId(), parentId: teamItemId, accepted: true,
              label: `Create: "${truncate(idea.title, 42)}"`,
              sublabel: idea.description ? truncate(idea.description, 55) : null,
              changeType: "create_idea",
              group: "Teams",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Insert ideas into existing categories ──
      case "insert_into_existing": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          for (let ci = 0; ci < (entry.ideas || []).length; ci++) {
            const idea = entry.ideas[ci];
            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Insert: "${truncate(idea.title, 40)}"`,
              sublabel: `Into "${truncate(entry.category_name, 35)}"`,
              changeType: "create_idea",
              group: "Insert into Existing",
              depth: 0,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Create new categories + move existing ideas in ──
      case "new_cat_assignments": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const catName = (entry.category_name || "New Category").trim();

          const catItemId = makeId();
          items.push({
            id: catItemId, parentId: null, accepted: true,
            label: `Create category: "${truncate(catName, 38)}"`,
            sublabel: entry.ideas?.length
              ? `+ move ${entry.ideas.length} idea${entry.ideas.length > 1 ? "s" : ""}`
              : null,
            changeType: "create_category",
            group: "New Categories + Move Ideas",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });

          for (let ci = 0; ci < (entry.ideas || []).length; ci++) {
            const ideaRef = entry.ideas[ci];
            const title = typeof ideaRef === "string" ? ideaRef : ideaRef?.title || "";
            items.push({
              id: makeId(), parentId: catItemId, accepted: true,
              label: `Move: "${truncate(title, 42)}"`,
              sublabel: null,
              changeType: "move_idea",
              group: "New Categories + Move Ideas",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Move ideas to existing categories ──
      case "assignments": {
        for (let di = 0; di < item.data.length; di++) {
          const assignment = item.data[di];
          for (let ci = 0; ci < (assignment.ideas || []).length; ci++) {
            const ideaRef = assignment.ideas[ci];
            const title = typeof ideaRef === "string" ? ideaRef : ideaRef?.title || "";
            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Move: "${truncate(title, 40)}"`,
              sublabel: `To "${truncate(assignment.category_name, 35)}"`,
              changeType: "move_idea",
              group: "Reassign Ideas",
              depth: 0,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "ideas", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Gap analysis ideas ──
      case "gap_ideas": {
        for (let di = 0; di < item.data.length; di++) {
          const idea = item.data[di];
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Gap idea: "${truncate(idea.title, 40)}"`,
            sublabel: idea._gap_area ? `Area: ${idea._gap_area}` : null,
            changeType: "create_idea",
            group: "Gap Analysis Ideas",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Dedup merged ideas ──
      case "dedup_merged": {
        for (let di = 0; di < item.data.length; di++) {
          const idea = item.data[di];
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Merged: "${truncate(idea.title, 42)}"`,
            sublabel: idea.description ? truncate(idea.description, 55) : null,
            changeType: "create_idea",
            group: "Merged Ideas",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create legends + types ──
      case "legends": {
        for (let di = 0; di < item.data.length; di++) {
          const legend = item.data[di];

          const legendItemId = makeId();
          items.push({
            id: legendItemId, parentId: null, accepted: true,
            label: `Create legend: "${truncate(legend.name, 38)}"`,
            sublabel: legend.types?.length
              ? `${legend.types.length} type${legend.types.length > 1 ? "s" : ""}`
              : null,
            changeType: "create_legend",
            group: "Legends",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });

          for (let ci = 0; ci < (legend.types || []).length; ci++) {
            const type = legend.types[ci];
            items.push({
              id: makeId(), parentId: legendItemId, accepted: true,
              label: `Type: "${truncate(type.name, 42)}"`,
              sublabel: type.color ? `Color: ${type.color}` : null,
              changeType: "create_legend_type",
              group: "Legends",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "types", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Add types to existing legends ──
      case "new_legend_types": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          for (let ci = 0; ci < (entry.types || []).length; ci++) {
            const type = entry.types[ci];
            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Add type: "${truncate(type.name, 38)}"`,
              sublabel: `To legend "${truncate(entry.legend_name, 30)}"`,
              changeType: "create_legend_type",
              group: "New Legend Types",
              depth: 0,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "types", childIdx: ci },
            });
          }
        }
        break;
      }

      // ── Filter presets ──
      case "filter_presets": {
        for (let di = 0; di < item.data.length; di++) {
          const preset = item.data[di];
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Filter preset: "${truncate(preset.name || "AI Preset", 38)}"`,
            sublabel: preset.rules?.length
              ? `${preset.rules.length} rule${preset.rules.length > 1 ? "s" : ""}`
              : null,
            changeType: "create_filter_preset",
            group: "Filter Presets",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // Skip non-actionable types (analysis_text, suggestions)
      default:
        break;
    }
  }

  return items;
}


// ═══════════════════════════════════════════════════════════
//  Recompose Detected
// ═══════════════════════════════════════════════════════════

const RECOMPOSABLE_TYPES = new Set([
  "update_ideas", "update_categories", "legend_assignments",
  "ideas", "categories", "teams",
  "insert_into_existing", "new_cat_assignments", "assignments",
  "gap_ideas", "dedup_merged",
  "legends", "new_legend_types", "filter_presets",
]);

/**
 * Rebuild the `detected` array by filtering out items the
 * user has declined.  The result can be passed directly
 * to `applyDetected()`.
 */
export function recomposeDetected(detected, changeItems) {
  // Index accepted refs by detectedIdx
  const acceptedRoots   = {};   // detectedIdx → Set<dataIdx>
  const acceptedChildren = {};  // detectedIdx → { dataIdx → Set<childIdx> }

  for (const ci of changeItems) {
    if (!ci.accepted) continue;
    const { detectedIdx, dataIdx, childField, childIdx } = ci._ref;

    if (childField === null && childIdx === null) {
      // Root-level item
      if (!acceptedRoots[detectedIdx]) acceptedRoots[detectedIdx] = new Set();
      acceptedRoots[detectedIdx].add(dataIdx);
    } else {
      // Child item
      if (!acceptedChildren[detectedIdx]) acceptedChildren[detectedIdx] = {};
      if (!acceptedChildren[detectedIdx][dataIdx]) acceptedChildren[detectedIdx][dataIdx] = new Set();
      acceptedChildren[detectedIdx][dataIdx].add(childIdx);
    }
  }

  const result = [];

  for (let detIdx = 0; detIdx < detected.length; detIdx++) {
    const item = detected[detIdx];

    // Non-actionable items (analysis_text, suggestions) pass through
    if (!RECOMPOSABLE_TYPES.has(item.type)) {
      result.push(item);
      continue;
    }

    const roots    = acceptedRoots[detIdx];
    const children = acceptedChildren[detIdx];

    // If nothing was accepted for this detected item, skip it
    if (!roots && !children) continue;

    const filteredData = filterItemData(item, roots, children);
    if (!filteredData || filteredData.length === 0) continue;

    result.push({ ...item, data: filteredData });
  }

  return result;
}


// ─── Internal: filter a single detected item's data ────

function filterItemData(item, acceptedRoots, acceptedChildren) {
  const rootSet  = acceptedRoots  || new Set();
  const childMap = acceptedChildren || {};

  switch (item.type) {

    // ── Flat arrays: one change per data entry ──
    case "update_ideas":
    case "legend_assignments":
    case "ideas":
    case "gap_ideas":
    case "dedup_merged":
    case "filter_presets": {
      return item.data.filter((_, idx) => rootSet.has(idx));
    }

    // ── Categories / teams: parent + child ideas ──
    case "categories":
    case "teams": {
      return item.data
        .map((entry, idx) => {
          if (!rootSet.has(idx)) return null;  // parent declined → skip

          const childSet = childMap[idx];
          const childField = item.type === "teams" ? "ideas" : "ideas";

          if (!entry[childField]?.length) return entry; // no children to filter
          if (!childSet) return { ...entry, [childField]: [] }; // all children declined

          const filtered = entry[childField].filter((_, ci) => childSet.has(ci));
          return { ...entry, [childField]: filtered };
        })
        .filter(Boolean);
    }

    // ── update_categories: rename (root) + idea updates (children) ──
    case "update_categories": {
      return item.data
        .map((entry, idx) => {
          const catAccepted = rootSet.has(idx);
          const childSet    = childMap[idx];

          if (!catAccepted && !childSet) return null;

          const out = { ...entry };

          // If rename not accepted, preserve original name so the
          // handler's `if (newName !== cat.name)` comparison skips it
          if (!catAccepted) {
            out.category_name = out.original_name;
          }

          // Filter updated_ideas
          if (childSet) {
            out.updated_ideas = (entry.updated_ideas || []).filter((_, ci) => childSet.has(ci));
          } else {
            out.updated_ideas = [];
          }

          // If rename skipped AND no ideas left → nothing to do
          if (!catAccepted && out.updated_ideas.length === 0) return null;

          return out;
        })
        .filter(Boolean);
    }

    // ── insert_into_existing: children only (ideas), grouped by category ──
    case "insert_into_existing": {
      return item.data
        .map((entry, idx) => {
          const childSet = childMap[idx];
          if (!childSet) return null;

          const filtered = (entry.ideas || []).filter((_, ci) => childSet.has(ci));
          return filtered.length > 0 ? { ...entry, ideas: filtered } : null;
        })
        .filter(Boolean);
    }

    // ── new_cat_assignments: parent category + child idea moves ──
    case "new_cat_assignments": {
      return item.data
        .map((entry, idx) => {
          if (!rootSet.has(idx)) return null; // parent declined

          const childSet = childMap[idx];
          if (!childSet) return { ...entry, ideas: [] }; // no moves accepted

          const filtered = (entry.ideas || []).filter((_, ci) => childSet.has(ci));
          return { ...entry, ideas: filtered };
        })
        .filter(Boolean);
    }

    // ── assignments: children only (moves), grouped by category ──
    case "assignments": {
      return item.data
        .map((entry, idx) => {
          const childSet = childMap[idx];
          if (!childSet) return null;

          const filtered = (entry.ideas || []).filter((_, ci) => childSet.has(ci));
          return filtered.length > 0 ? { ...entry, ideas: filtered } : null;
        })
        .filter(Boolean);
    }

    // ── legends: parent legend + child types ──
    case "legends": {
      return item.data
        .map((entry, idx) => {
          if (!rootSet.has(idx)) return null;

          const childSet = childMap[idx];
          if (!childSet) return { ...entry, types: [] };

          const filtered = (entry.types || []).filter((_, ci) => childSet.has(ci));
          return { ...entry, types: filtered };
        })
        .filter(Boolean);
    }

    // ── new_legend_types: children only (types), grouped by legend ──
    case "new_legend_types": {
      return item.data
        .map((entry, idx) => {
          const childSet = childMap[idx];
          if (!childSet) return null;

          const filtered = (entry.types || []).filter((_, ci) => childSet.has(ci));
          return filtered.length > 0 ? { ...entry, types: filtered } : null;
        })
        .filter(Boolean);
    }

    default:
      return item.data;
  }
}
