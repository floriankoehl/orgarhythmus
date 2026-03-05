/**
 * ═══════════════════════════════════════════════════════════
 *  IdeaBin Prompt Scenarios — Grid Layout v2
 *  ──────────────────────────────────────────
 *  Organised as a 3×3 grid:
 *    Columns: Add | Assign | Finetune
 *    Rows:    Ideas | Categories | Legends & Filters
 *  Plus a "Specials" section for whole-context operations.
 *
 *  Each scenario defines:
 *    id             – unique key (also the scenario_prompts key in backend)
 *    domain         – "ideabin"
 *    grid           – { row, col } grid position
 *    action         – "add" | "assign" | "finetune" | "special"  (icon hint)
 *    label          – short display name
 *    description    – tooltip / explanation
 *    unavailableMsg – function(ctx) => string | null  (null = available)
 *    defaultPrompt  – default scenario-specific prompt text
 *    expectedFormat – expected JSON format string
 *    buildPayload   – function(ctx) => object  (ctx._withContext controls toggle)
 *
 *  Optional flags:
 *    needsLegendPicker – true if scenario requires the legend dropdown selection
 *
 *  Context toggle:  ctx._withContext (boolean, default true)
 *    When true:  payloads include existing ideas/categories/legends for reference
 *    When false: payloads are minimal (blank-slate generation)
 * ═══════════════════════════════════════════════════════════
 */

// ─── Helpers ────────────────────────────────────────────

/** Build a clean idea object for export */
const cleanIdea = (idea, legendTypes) => {
  const obj = { title: idea.title || "" };
  if (idea.description) obj.description = idea.description;
  if (idea.legend_types && typeof idea.legend_types === "object" && !Array.isArray(idea.legend_types)) {
    const typeNames = Object.values(idea.legend_types)
      .map(v => v.name)
      .filter(Boolean);
    if (typeNames.length > 0) obj.legend_types = typeNames;
  }
  return obj;
};

/** Get ideas belonging to a category */
const ideasForCategory = (catId, ideas, categoryOrders) => {
  const order = categoryOrders?.[catId] || [];
  return order
    .filter(pid => ideas[pid])
    .map(pid => ideas[pid]);
};

/** Get unassigned ideas */
const getUnassignedIdeas = (ideas, unassignedOrder) => {
  return (unassignedOrder || [])
    .filter(pid => ideas[pid])
    .map(pid => ideas[pid]);
};

/** Get selected ideas as array */
const getSelectedIdeas = (ideas, selectedIdeaIds) => {
  return [...selectedIdeaIds]
    .filter(pid => ideas[pid])
    .map(pid => ideas[pid]);
};

/** Get selected categories as array */
const getSelectedCategories = (categories, selectedCategoryIds) => {
  return [...selectedCategoryIds]
    .filter(cid => categories[cid])
    .map(cid => categories[cid]);
};

/** Build a full category export object */
const buildCategoryPayload = (cat, ideas, categoryOrders, legendTypes) => ({
  category_name: cat.name,
  ideas: ideasForCategory(cat.id, ideas, categoryOrders)
    .map(i => cleanIdea(i, legendTypes)),
});

/** Check if we have any legend types defined */
const hasLegendTypes = (dims) =>
  dims?.legendTypes && Object.keys(dims.legendTypes).length > 0;

/** Check if we have any legends defined */
const hasLegends = (dims) =>
  dims?.legends && dims.legends.length > 0;

/** Build legend/type structure for export */
const buildLegendPayload = (dims) => {
  if (!dims?.legends) return { legends: [] };
  return {
    legends: dims.legends.map(leg => ({
      name: leg.name,
      types: Object.values(dims.legendTypes || {})
        .filter(t => t.legend === leg.id)
        .map(t => ({
          name: t.name,
          color: t.color,
          ...(t.icon ? { icon: t.icon } : {}),
        })),
    })),
  };
};

/** Build filter state for export */
const buildFilterPayload = (ctx) => {
  const f = {};
  if (ctx.legendFilters?.length) f.legend_filters = ctx.legendFilters;
  if (ctx.filterCombineMode && ctx.filterCombineMode !== "and") f.filter_combine_mode = ctx.filterCombineMode;
  if (ctx.stackedFilters?.length) f.stacked_filters = ctx.stackedFilters;
  if (ctx.stackCombineMode && ctx.stackCombineMode !== "or") f.stack_combine_mode = ctx.stackCombineMode;
  if (ctx.globalTypeFilter?.length) f.global_type_filter = ctx.globalTypeFilter;
  if (ctx.filterPresets?.length) f.filter_presets = ctx.filterPresets;
  return f;
};


// ─── Context-scoping helpers ────────────────────────────

/** Set of idea_ids linked to the active context (direct + in-category). null = no filtering. */
const _ctxIdeaIdSet = (ctx) => {
  if (!ctx.activeContext) return null;
  const ids = new Set(ctx.contextIdeaOrders?.[ctx.activeContext.id] || []);
  const ctxCatIds = new Set((ctx.activeContext.category_ids || []).map(String));
  for (const p of Object.values(ctx.ideas || {})) {
    if (p?.idea_id && p.category != null && ctxCatIds.has(String(p.category))) {
      ids.add(p.idea_id);
    }
  }
  return ids;
};

/** Categories belonging to the active context (or all if no context) */
const ctxCategories = (ctx) => {
  const all = Object.values(ctx.categories || {});
  if (!ctx.activeContext) return all;
  const ids = new Set((ctx.activeContext.category_ids || []).map(Number));
  return all.filter(c => ids.has(Number(c.id)));
};

/** Category orders scoped to context categories & context ideas */
const ctxCategoryOrders = (ctx) => {
  if (!ctx.activeContext) return ctx.categoryOrders || {};
  const ideaIds = _ctxIdeaIdSet(ctx);
  const catIds = new Set((ctx.activeContext.category_ids || []).map(String));
  const out = {};
  for (const [k, order] of Object.entries(ctx.categoryOrders || {})) {
    if (!catIds.has(k)) continue;
    out[k] = ideaIds
      ? order.filter(pid => { const p = ctx.ideas[pid]; return p && ideaIds.has(p.idea_id); })
      : order;
  }
  return out;
};

/** Unassigned ideas within the context */
const ctxUnassigned = (ctx) => {
  if (!ctx.activeContext) return getUnassignedIdeas(ctx.ideas, ctx.unassignedOrder);
  const ideaIds = new Set(ctx.contextIdeaOrders?.[ctx.activeContext.id] || []);
  if (ideaIds.size === 0) return [];
  const catIds = new Set((ctx.activeContext.category_ids || []).map(Number));
  return Object.values(ctx.ideas)
    .filter(p => p && ideaIds.has(p.idea_id) && (p.category == null || !catIds.has(Number(p.category))))
    .sort((a, b) => a.order_index - b.order_index);
};

/** All unique ideas in the context (de-duped by idea_id) */
const ctxAllIdeas = (ctx) => {
  const ideaIds = _ctxIdeaIdSet(ctx);
  const seen = new Set();
  return Object.values(ctx.ideas || {}).filter(p => {
    if (!p || seen.has(p.idea_id)) return false;
    if (ideaIds && !ideaIds.has(p.idea_id)) return false;
    seen.add(p.idea_id);
    return true;
  });
};

/** Count of unique context-scoped ideas */
const ctxIdeaCount = (ctx) => ctxAllIdeas(ctx).length;

/** Count of context-scoped categories */
const ctxCategoryCount = (ctx) => ctxCategories(ctx).length;


// ─── Context toggle shorthand ───────────────────────────
/** Whether context is enabled (default true when not set) */
const wCtx = (ctx) => ctx._withContext !== false;


// ═══════════════════════════════════════════════════════════
//  SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const IDEABIN_SCENARIOS = [

  // ─────────────────────────────────────────────────────────
  //  IDEAS — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "ideas_add",
    domain: "ideabin",
    grid: { row: "ideas", col: "add" },
    action: "add",
    label: "New ideas",
    description: "Generate new ideas. With context: avoids duplicates by referencing existing content.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Generate 10-15 creative and diverse ideas for this project. Each idea should have a clear, concise title and a brief description explaining the concept. Think broadly — include both obvious and unexpected angles.`,
    expectedFormat: `{
  "ideas": [
    { "title": "Idea title", "description": "Brief description" }
  ]
}`,
    buildPayload: (ctx) => {
      if (!wCtx(ctx)) return { ideas: [] };
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        existing_categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "ideas_add_for_teams",
    domain: "ideabin",
    grid: { row: "ideas", col: "add" },
    action: "add",
    label: "New for teams",
    description: "Generate ideas aligned with existing team domains and capabilities.",
    unavailableMsg: (ctx) =>
      !ctx.projectTeams?.length
        ? "No teams — create teams in Task Structure first"
        : null,
    defaultPrompt:
      `Given the teams and their current tasks below, generate 5-8 ideas per team that align with each team's domain and capabilities. Ideas should be actionable and relevant.`,
    expectedFormat: `{
  "teams": [
    {
      "team_name": "Team Name",
      "ideas": [
        { "title": "Idea title", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => ({
      teams: (ctx.projectTeams || []).map(t => ({
        name: t.name,
        tasks: (t.tasks || []).map(tk => ({ name: tk.name, description: tk.description })),
      })),
      ...(wCtx(ctx) ? {
        existing_ideas: ctxUnassigned(ctx)
          .slice(0, 30)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      } : {}),
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  IDEAS — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "ideas_finetune_selected",
    domain: "ideabin",
    grid: { row: "ideas", col: "finetune" },
    action: "finetune",
    label: "Improve selected",
    description: "Refine titles and descriptions of selected ideas.",
    unavailableMsg: (ctx) =>
      ctx.selectedIdeaIds.size === 0
        ? "Select one or more ideas first"
        : null,
    defaultPrompt:
      `Improve the following ideas. Make titles more concise and impactful, expand descriptions to be clearer and more actionable. Keep the original intent but elevate the quality. Include the original title so changes can be tracked.`,
    expectedFormat: `{
  "updated_ideas": [
    {
      "original_title": "Original title (exact match)",
      "title": "Improved title",
      "description": "Improved, more detailed description"
    }
  ]
}`,
    buildPayload: (ctx) => {
      const payload = {
        ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
      if (wCtx(ctx)) {
        const cats = ctxCategories(ctx);
        const orders = ctxCategoryOrders(ctx);
        payload.categories = cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes));
      }
      return payload;
    },
  },

  {
    id: "ideas_finetune_all",
    domain: "ideabin",
    grid: { row: "ideas", col: "finetune" },
    action: "finetune",
    label: "Improve all",
    description: "Refine every idea in the current view.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0
        ? "No ideas to improve"
        : null,
    defaultPrompt:
      `Improve ALL of the following ideas. Make titles more concise, expand descriptions for clarity, and ensure consistency across the set. Include the original title for each so changes can be tracked.`,
    expectedFormat: `{
  "updated_ideas": [
    {
      "original_title": "Original title (exact match)",
      "title": "Improved title",
      "description": "Improved description"
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  IDEAS / CATEGORIES — ASSIGN  (shared column, spans both rows)
  // ─────────────────────────────────────────────────────────

  {
    id: "assign_unassigned_existing",
    domain: "ideabin",
    grid: { row: "ideas", col: "assign" },
    action: "assign",
    label: "Unassigned → existing",
    description: "Assign unassigned ideas to the best-fitting existing categories.",
    unavailableMsg: (ctx) => {
      if (ctxCategoryCount(ctx) < 1) return "Need at least 1 category";
      if (ctxUnassigned(ctx).length === 0) return "No unassigned ideas";
      return null;
    },
    defaultPrompt:
      `Review the unassigned ideas and categories below. For each unassigned idea, assign it to the most fitting existing category. Group assignments by target category using exact category names.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Target Category (exact existing name)",
      "ideas": ["Idea title A", "Idea title B"]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c => wCtx(ctx)
          ? buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)
          : { category_name: c.name }),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "assign_unassigned_new",
    domain: "ideabin",
    grid: { row: "ideas", col: "assign" },
    action: "assign",
    label: "Unassigned → existing + new",
    description: "Assign unassigned ideas to existing categories or suggest new ones for orphans.",
    unavailableMsg: (ctx) => {
      if (ctxUnassigned(ctx).length === 0) return "No unassigned ideas";
      return null;
    },
    defaultPrompt:
      `Review the unassigned ideas and categories below. Assign each idea to the most fitting existing category. For ideas that don't fit any current category, propose new categories. Group assignments by target category.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Existing Category Name",
      "ideas": ["Idea title A"]
    }
  ],
  "new_category_suggestions": [
    {
      "category_name": "Suggested New Category",
      "ideas": ["Idea title B"]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c => wCtx(ctx)
          ? buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)
          : { category_name: c.name }),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "assign_selected_existing",
    domain: "ideabin",
    grid: { row: "ideas", col: "assign" },
    action: "assign",
    label: "Selected → existing",
    description: "Move selected ideas to the most-fitting existing categories.",
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select ideas first";
      if (ctxCategoryCount(ctx) < 1) return "Need at least 1 category";
      return null;
    },
    defaultPrompt:
      `Move each selected idea to the most fitting existing category. Only list moves that genuinely improve the organisation. Group assignments by target category using exact category names.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Target Category (exact existing name)",
      "ideas": ["Idea title A"]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c => wCtx(ctx)
          ? buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)
          : { category_name: c.name }),
        selected_ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "assign_selected_new",
    domain: "ideabin",
    grid: { row: "ideas", col: "assign" },
    action: "assign",
    label: "Selected → existing + new",
    description: "Move selected ideas to existing categories or suggest new ones.",
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select ideas first";
      return null;
    },
    defaultPrompt:
      `Move the selected ideas into the most suitable existing categories. For ideas that don't fit any current category, propose new categories to hold them. Group by target category name.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Existing Category Name",
      "ideas": ["Idea title A"]
    }
  ],
  "new_category_suggestions": [
    {
      "category_name": "Suggested New Category",
      "ideas": ["Idea title B"]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c => wCtx(ctx)
          ? buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)
          : { category_name: c.name }),
        selected_ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  CATEGORIES — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "categories_add",
    domain: "ideabin",
    grid: { row: "categories", col: "add" },
    action: "add",
    label: "New categories",
    description: "Suggest categories. With context: avoids duplicating existing ones.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Suggest 5-8 meaningful categories for organising ideas in this project and populate each with 3-5 relevant ideas. Each category should have a clear, distinct focus area.`,
    expectedFormat: `{
  "categories": [
    {
      "category_name": "Category Name",
      "ideas": [
        { "title": "Idea title", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      if (!wCtx(ctx)) return {};
      const cats = ctxCategories(ctx);
      if (cats.length === 0) return {};
      return {
        existing_categories: cats.map(c => ({ category_name: c.name })),
      };
    },
  },

  {
    id: "categories_add_for_ideas",
    domain: "ideabin",
    grid: { row: "categories", col: "add" },
    action: "add",
    label: "New for selected ideas",
    description: "Create categories that fit the selected ideas and assign them.",
    unavailableMsg: (ctx) =>
      ctx.selectedIdeaIds.size === 0
        ? "Select ideas first"
        : null,
    defaultPrompt:
      `Based on the selected ideas below, suggest 2-5 categories that would best organise them. Assign each idea to its best-fit new category.`,
    expectedFormat: `{
  "categories": [
    {
      "category_name": "Category Name",
      "ideas": [
        { "title": "Idea title (exact match)", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const payload = {
        selected_ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
      if (wCtx(ctx)) {
        const cats = ctxCategories(ctx);
        if (cats.length > 0) {
          payload.existing_categories = cats.map(c => ({ category_name: c.name }));
        }
      }
      return payload;
    },
  },

  // ─────────────────────────────────────────────────────────
  //  CATEGORIES — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "categories_finetune_selected",
    domain: "ideabin",
    grid: { row: "categories", col: "finetune" },
    action: "finetune",
    label: "Improve selected",
    description: "Rename and restructure selected categories and their ideas.",
    unavailableMsg: (ctx) =>
      ctx.selectedCategoryIds.size === 0
        ? "Select categories first"
        : null,
    defaultPrompt:
      `Improve the selected categories: suggest better names, review and improve their ideas. Include original names so changes can be tracked.`,
    expectedFormat: `{
  "updated_categories": [
    {
      "original_name": "Current Category Name",
      "category_name": "Improved Name",
      "updated_ideas": [
        { "original_title": "Original title", "title": "Improved title", "description": "Improved description" }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const orders = ctxCategoryOrders(ctx);
      const selected = getSelectedCategories(ctx.categories, ctx.selectedCategoryIds);
      return {
        categories: selected.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "categories_finetune_all",
    domain: "ideabin",
    grid: { row: "categories", col: "finetune" },
    action: "finetune",
    label: "Improve all",
    description: "Reorganise and rename all categories for better clarity.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0
        ? "Create at least one category first"
        : null,
    defaultPrompt:
      `Review all categories and suggest improvements: better names, merges, splits, or reorganisation. Return the improved structure with original names so changes can be tracked.`,
    expectedFormat: `{
  "updated_categories": [
    {
      "original_name": "Current Category Name",
      "category_name": "Improved Name",
      "updated_ideas": [
        { "original_title": "Original title", "title": "Improved title", "description": "Improved description" }
      ]
    }
  ],
  "suggestions": "Brief explanation of what was changed and why."
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  LEGENDS & FILTERS — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "legends_add",
    domain: "ideabin",
    grid: { row: "legends", col: "add" },
    action: "add",
    label: "New legends + types",
    description: "Suggest legend dimensions with their types based on the project.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Suggest 2-4 legend dimensions for categorising ideas in this project. Each legend should have 3-6 types with distinct names and hex colors. Legends are cross-cutting dimensions (e.g., "Priority", "Effort", "Domain"). Types are the values within each (e.g., "High", "Medium", "Low").`,
    expectedFormat: `{
  "legends": [
    {
      "name": "Dimension Name",
      "types": [
        { "name": "Type A", "color": "#ef4444" },
        { "name": "Type B", "color": "#3b82f6" }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const payload = {};
      if (wCtx(ctx)) {
        const sample = ctxAllIdeas(ctx).slice(0, 20)
          .map(i => ({ title: i.title, description: i.description }));
        if (sample.length) payload.sample_ideas = sample;
        if (hasLegends(ctx.dims)) {
          payload.existing_legends = buildLegendPayload(ctx.dims);
        }
      }
      return payload;
    },
  },

  {
    id: "filters_add",
    domain: "ideabin",
    grid: { row: "legends", col: "add" },
    action: "add",
    label: "New filter presets",
    description: "Generate useful filter configurations based on your legend types.",
    unavailableMsg: (ctx) =>
      !hasLegendTypes(ctx.dims)
        ? "Create legend types first"
        : null,
    defaultPrompt:
      `Based on the legend types below, suggest 3-5 useful filter preset configurations. Each preset should have a descriptive name and specify which legend types to include or exclude. Think about common workflows — what combinations of filters would be most useful?`,
    expectedFormat: `{
  "filter_presets": [
    {
      "name": "Preset name (e.g., 'High Priority Only')",
      "rules": [
        {
          "legend_name": "Legend Name",
          "type_names": ["Type A", "Type B"],
          "mode": "include"
        }
      ],
      "combine_mode": "and"
    }
  ]
}`,
    buildPayload: (ctx) => ({
      ...buildLegendPayload(ctx.dims),
      current_filters: buildFilterPayload(ctx),
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  LEGENDS & FILTERS — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "legends_finetune_all",
    domain: "ideabin",
    grid: { row: "legends", col: "finetune" },
    action: "finetune",
    label: "Improve all legends",
    description: "Refine legend names, types, and colours.",
    unavailableMsg: (ctx) =>
      !hasLegends(ctx.dims)
        ? "Create at least one legend first"
        : null,
    defaultPrompt:
      `Review the current legends and their types. Suggest improvements: better names, more useful colour coding, additional missing types, or types to merge. Return the improved structure.`,
    expectedFormat: `{
  "legends": [
    {
      "name": "Improved Legend Name",
      "types": [
        { "name": "Improved Type", "color": "#hex" }
      ]
    }
  ],
  "suggestions": "What was changed and why."
}`,
    buildPayload: (ctx) => buildLegendPayload(ctx.dims),
  },

  {
    id: "legends_finetune_single",
    domain: "ideabin",
    grid: { row: "legends", col: "finetune" },
    action: "finetune",
    label: "Improve single legend",
    description: "Refine one specific legend — select it from the dropdown.",
    needsLegendPicker: true,
    unavailableMsg: (ctx) =>
      !hasLegends(ctx.dims)
        ? "Create at least one legend first"
        : null,
    defaultPrompt:
      `Review this specific legend and its types. Suggest improvements: better type names, colours, missing types, or types to merge. Return the improved structure.`,
    expectedFormat: `{
  "legends": [
    {
      "name": "Improved Legend Name",
      "types": [
        { "name": "Improved Type", "color": "#hex" }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const legendId = ctx._selectedLegendId;
      if (!legendId || !ctx.dims?.legends) return buildLegendPayload(ctx.dims);
      const legend = ctx.dims.legends.find(l => l.id === legendId);
      if (!legend) return buildLegendPayload(ctx.dims);
      const types = Object.values(ctx.dims.legendTypes || {})
        .filter(t => t.legend === legendId);
      return {
        legend: {
          name: legend.name,
          types: types.map(t => ({
            name: t.name,
            color: t.color,
            ...(t.icon ? { icon: t.icon } : {}),
          })),
        },
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  LEGENDS & FILTERS — ASSIGN
  // ─────────────────────────────────────────────────────────

  {
    id: "legends_assign_one_selected",
    domain: "ideabin",
    grid: { row: "legends", col: "assign" },
    action: "assign",
    label: "1 legend → selected",
    description: "Assign types from one legend to selected ideas.",
    needsLegendPicker: true,
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select ideas first";
      if (!hasLegends(ctx.dims)) return "Create a legend first";
      return null;
    },
    defaultPrompt:
      `Analyse each idea below and assign the most fitting type from this legend. Only use types from the provided list — do not invent new ones.`,
    expectedFormat: `{
  "legend_assignments": [
    {
      "idea_title": "Idea title (exact match)",
      "legend_name": "Legend Name",
      "type_name": "Type Name"
    }
  ]
}`,
    buildPayload: (ctx) => {
      const legendId = ctx._selectedLegendId;
      const legend = ctx.dims?.legends?.find(l => l.id === legendId);
      const types = Object.values(ctx.dims?.legendTypes || {})
        .filter(t => t.legend === legendId);
      return {
        ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
        legend: legend
          ? { name: legend.name, types: types.map(t => ({ name: t.name, color: t.color })) }
          : {},
      };
    },
  },

  {
    id: "legends_assign_one_all",
    domain: "ideabin",
    grid: { row: "legends", col: "assign" },
    action: "assign",
    label: "1 legend → all",
    description: "Assign types from one legend to every idea.",
    needsLegendPicker: true,
    unavailableMsg: (ctx) => {
      if (ctxIdeaCount(ctx) === 0) return "No ideas";
      if (!hasLegends(ctx.dims)) return "Create a legend first";
      return null;
    },
    defaultPrompt:
      `Analyse every idea below and assign the most fitting type from this legend. Only use types from the provided list — do not invent new ones.`,
    expectedFormat: `{
  "legend_assignments": [
    {
      "idea_title": "Idea title (exact match)",
      "legend_name": "Legend Name",
      "type_name": "Type Name"
    }
  ]
}`,
    buildPayload: (ctx) => {
      const legendId = ctx._selectedLegendId;
      const legend = ctx.dims?.legends?.find(l => l.id === legendId);
      const types = Object.values(ctx.dims?.legendTypes || {})
        .filter(t => t.legend === legendId);
      return {
        ideas: ctxAllIdeas(ctx).map(i => cleanIdea(i, ctx.dims?.legendTypes)),
        legend: legend
          ? { name: legend.name, types: types.map(t => ({ name: t.name, color: t.color })) }
          : {},
      };
    },
  },

  {
    id: "legends_assign_all_selected",
    domain: "ideabin",
    grid: { row: "legends", col: "assign" },
    action: "assign",
    label: "All legends → selected",
    description: "Assign types from all legends to selected ideas.",
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select ideas first";
      if (!hasLegendTypes(ctx.dims)) return "Create legend types first";
      return null;
    },
    defaultPrompt:
      `Analyse each idea below and assign the most fitting legend types from the provided list. Each assignment is one legend-type pair. An idea can have multiple assignments across different legends. Only use types from the provided list — do not invent new ones.`,
    expectedFormat: `{
  "legend_assignments": [
    {
      "idea_title": "Idea title (exact match)",
      "legend_name": "Legend Name",
      "type_name": "Type Name"
    }
  ]
}`,
    buildPayload: (ctx) => ({
      ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      available_legend_types: Object.values(ctx.dims?.legendTypes || {})
        .map(t => ({ name: t.name, legend: ctx.dims?.legends?.find(l => l.id === t.legend)?.name })),
    }),
  },

  {
    id: "legends_assign_all_all",
    domain: "ideabin",
    grid: { row: "legends", col: "assign" },
    action: "assign",
    label: "All legends → all",
    description: "Assign types from all legends to every idea.",
    unavailableMsg: (ctx) => {
      if (ctxIdeaCount(ctx) === 0) return "No ideas";
      if (!hasLegendTypes(ctx.dims)) return "Create legend types first";
      return null;
    },
    defaultPrompt:
      `Analyse every idea below and assign the most fitting legend types from the provided list. Each assignment is one legend-type pair. An idea can have multiple assignments across different legends. Only use types from the provided list — do not invent new ones.`,
    expectedFormat: `{
  "legend_assignments": [
    {
      "idea_title": "Idea title (exact match)",
      "legend_name": "Legend Name",
      "type_name": "Type Name"
    }
  ]
}`,
    buildPayload: (ctx) => ({
      ideas: ctxAllIdeas(ctx).map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      available_legend_types: Object.values(ctx.dims?.legendTypes || {})
        .map(t => ({ name: t.name, legend: ctx.dims?.legends?.find(l => l.id === t.legend)?.name })),
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  SPECIALS
  // ─────────────────────────────────────────────────────────

  {
    id: "special_context_add",
    domain: "ideabin",
    grid: { row: "special", col: "special" },
    action: "special",
    label: "Add to entire context",
    description: "Pass everything, get additions: new ideas, categories, legend types.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0 && ctxCategoryCount(ctx) === 0
        ? "Add some content first"
        : null,
    defaultPrompt:
      `Review the entire project context below (categories, ideas, legends, filters). Then generate additions: new ideas for existing categories, new categories with ideas, and any missing legend types. Do NOT modify existing content — only ADD new things.`,
    expectedFormat: `{
  "new_categories": [
    {
      "category_name": "New Category",
      "ideas": [{ "title": "...", "description": "..." }]
    }
  ],
  "new_ideas_for_existing": [
    {
      "category_name": "Existing Category Name",
      "ideas": [{ "title": "...", "description": "..." }]
    }
  ],
  "new_legend_types": [
    { "legend_name": "Existing Legend", "types": [{ "name": "New Type", "color": "#hex" }] }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
        legends: buildLegendPayload(ctx.dims),
        filters: buildFilterPayload(ctx),
      };
    },
  },

  {
    id: "special_context_suggestions",
    domain: "ideabin",
    grid: { row: "special", col: "special" },
    action: "special",
    label: "Suggestions for context",
    description: "Comprehensive review — improvements for everything in the current context.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0 && ctxCategoryCount(ctx) === 0
        ? "Add some content first"
        : null,
    defaultPrompt:
      `Perform a comprehensive review of the entire project context below. Improve EVERYTHING: category names, idea titles and descriptions, categorisation, legend types. Include original names/titles so changes can be tracked.`,
    expectedFormat: `{
  "updated_categories": [
    {
      "original_name": "Current Category Name",
      "category_name": "Improved Category",
      "updated_ideas": [
        { "original_title": "Original title", "title": "Improved title", "description": "Improved description" }
      ]
    }
  ],
  "updated_ideas": [
    { "original_title": "Original title", "title": "Improved title", "description": "Improved description" }
  ],
  "legends": [
    { "name": "Legend", "types": [{ "name": "Type", "color": "#hex" }] }
  ],
  "suggestions": "Summary of key changes made."
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
        legends: buildLegendPayload(ctx.dims),
        filters: buildFilterPayload(ctx),
      };
    },
  },

  {
    id: "special_gap_analysis",
    domain: "ideabin",
    grid: { row: "special", col: "special" },
    action: "special",
    label: "Analyse gaps",
    description: "Identify missing areas and blind spots in the idea landscape.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0 && ctxCategoryCount(ctx) === 0
        ? "Add some content first"
        : null,
    defaultPrompt:
      `Analyse the current idea landscape (categories and ideas) and identify gaps: what areas are underrepresented, what perspectives are missing, what obvious topics haven't been covered? Suggest concrete ideas to fill each gap.`,
    expectedFormat: `{
  "gaps": [
    {
      "area": "Missing area description",
      "reasoning": "Why this gap matters",
      "suggested_ideas": [
        { "title": "Gap-filling idea", "description": "..." }
      ],
      "suggested_category": "Existing or new category name"
    }
  ],
  "overall_assessment": "Brief summary of coverage strengths and weaknesses."
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "special_dedup_merge",
    domain: "ideabin",
    grid: { row: "special", col: "special" },
    action: "special",
    label: "Find & merge duplicates",
    description: "Identify similar or overlapping ideas that could be merged.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) < 3
        ? "Need at least 3 ideas to check for duplicates"
        : null,
    defaultPrompt:
      `Analyse the following ideas and identify groups of similar, overlapping, or duplicate ideas. For each group, suggest a merged version that combines the best parts. Return both the duplicate groups and the suggested merged versions.`,
    expectedFormat: `{
  "duplicate_groups": [
    {
      "ideas": ["Idea title A", "Idea title B"],
      "reason": "These overlap because...",
      "merged_version": {
        "title": "Merged idea title",
        "description": "Combined description"
      }
    }
  ],
  "unique_ideas_count": 42,
  "duplicate_ideas_count": 5
}`,
    buildPayload: (ctx) => ({
      ideas: ctxAllIdeas(ctx)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
    }),
  },

  // ── Taskify ideas (export from IdeaBin, import in TaskStructure) ──
  {
    id: "special_taskify_ideas",
    domain: "ideabin",
    grid: { row: "special", col: "special" },
    group: "Specials",
    action: "special",
    label: "Taskify ideas",
    description:
      "Convert IdeaBin ideas into well-defined tasks with acceptance criteria. " +
      "Copy the prompt, send it to your AI, then import the response in the Task Structure panel.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0 ? "No ideas to taskify" : null,
    defaultPrompt:
      "Convert these ideas into well-defined tasks. " +
      "Each idea should become one or more tasks with clear names, descriptions, " +
      "priority, difficulty, and 2-4 acceptance criteria. " +
      "Group them into teams if logical groupings emerge.",
    expectedFormat:
      '{ "teams": [{ "team_name": "...", "tasks": [{ "name": "...", "description": "...", "priority": "...", "difficulty": "...", "acceptance_criteria": [{ "title": "..." }] }] }], "unassigned_tasks": [...] }',
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx).map(cat => ({
        category_name: cat.name,
        ideas: ideasForCategory(cat.id, ctx.ideas, ctx.categoryOrders)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      })).filter(c => c.ideas.length > 0);

      const unassigned = getUnassignedIdeas(ctx.ideas, ctx.unassignedOrder)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes));

      return {
        categories: cats,
        ...(unassigned.length > 0 ? { unassigned_ideas: unassigned } : {}),
        existing_teams: (ctx.projectTeams || []).map(t => ({ team_name: t.name })),
        project_description: ctx.projectDescription || "",
      };
    },
  },
];


// ─── Grid layout metadata for UI rendering ─────────────

export const IDEABIN_GRID = {
  rows: [
    { key: "ideas", label: "Ideas" },
    { key: "categories", label: "Categories" },
    { key: "legends", label: "Legends & Filters" },
  ],
  columns: [
    { key: "add", label: "Add" },
    { key: "assign", label: "Assign" },
    { key: "finetune", label: "Finetune" },
  ],
  cells: {
    "ideas:add":           ["ideas_add", "ideas_add_for_teams"],
    "ideas:assign":        ["assign_unassigned_existing", "assign_unassigned_new", "assign_selected_existing", "assign_selected_new"],
    "ideas:finetune":      ["ideas_finetune_selected", "ideas_finetune_all"],
    "categories:add":      ["categories_add", "categories_add_for_ideas"],
    "categories:assign":   null, // merged into ideas:assign (the assign column spans both rows)
    "categories:finetune": ["categories_finetune_selected", "categories_finetune_all"],
    "legends:add":         ["legends_add", "filters_add"],
    "legends:assign":      ["legends_assign_one_selected", "legends_assign_one_all", "legends_assign_all_selected", "legends_assign_all_all"],
    "legends:finetune":    ["legends_finetune_all", "legends_finetune_single"],
  },
  specials: ["special_context_add", "special_context_suggestions", "special_gap_analysis", "special_dedup_merge", "special_taskify_ideas"],
};


// ─── Flat group ordering (legacy, kept for registry) ───

export const IDEABIN_GROUPS = [
  "Ideas — Add",
  "Ideas — Finetune",
  "Assign (Ideas ↔ Categories)",
  "Categories — Add",
  "Categories — Finetune",
  "Legends & Filters — Add",
  "Legends & Filters — Finetune",
  "Legends & Filters — Assign",
  "Specials",
];
