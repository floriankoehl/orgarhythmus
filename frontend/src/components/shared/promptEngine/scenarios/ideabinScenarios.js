/**
 * ═══════════════════════════════════════════════════════════
 *  IdeaBin Prompt Scenarios
 *  ─────────────────────────
 *  Each scenario defines:
 *    id             – unique key (also the scenario_prompts key in backend)
 *    domain         – "ideabin" (used for filtering / grouping)
 *    group          – display group label
 *    action         – "add" | "overwork" | "analyse"  (icon hint)
 *    label          – short display name
 *    description    – tooltip / explanation (shown when grayed out too)
 *    unavailableMsg – function(ctx) => string | null  (null = available)
 *    defaultPrompt  – default scenario-specific prompt text
 *    expectedFormat – expected JSON format string
 *    buildPayload   – function(ctx) => object  (the JSON payload)
 * ═══════════════════════════════════════════════════════════
 */

// ─── Helpers ────────────────────────────────────────────

/** Build a clean idea object for export */
const cleanIdea = (idea, legendTypes) => {
  const obj = { title: idea.title || "" };
  if (idea.description) obj.description = idea.description;
  // idea.legend_types is { [legendId]: { legend_type_id, name, color, icon } }
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

/** Count total ideas across all categories + unassigned */
const totalIdeaCount = (ideas) => Object.keys(ideas || {}).length;

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
// When the user is inside a context, exports should only include
// ideas and categories that belong to that context — not everything.

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

/** Unassigned ideas within the context (ideas linked to context but not in any context category) */
const ctxUnassigned = (ctx) => {
  if (!ctx.activeContext) return getUnassignedIdeas(ctx.ideas, ctx.unassignedOrder);
  const ideaIds = new Set(ctx.contextIdeaOrders?.[ctx.activeContext.id] || []);
  if (ideaIds.size === 0) return [];
  const catIds = new Set((ctx.activeContext.category_ids || []).map(Number));
  return Object.values(ctx.ideas)
    .filter(p => p && ideaIds.has(p.idea_id) && (p.category == null || !catIds.has(Number(p.category))))
    .sort((a, b) => a.order_index - b.order_index);
};

/** All unique ideas in the context (de-duped by idea_id), or all ideas if no context */
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


// ═══════════════════════════════════════════════════════════
//  SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const IDEABIN_SCENARIOS = [

  // ─────────────────────────────────────────────────────────
  //  IDEAS — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "ideas_add_blank",
    domain: "ideabin",
    group: "Ideas — Add",
    action: "add",
    label: "New ideas (blank slate)",
    description: "Generate brand-new ideas with only the project description as context.",
    unavailableMsg: () => null, // always available
    defaultPrompt:
      `Generate 10-15 creative and diverse ideas for this project. Each idea should have a clear, concise title and a brief description explaining the concept. Think broadly — include both obvious and unexpected angles.`,
    expectedFormat: `{
  "ideas": [
    {
      "title": "Idea title",
      "description": "Brief description of the idea"
    }
  ]
}`,
    buildPayload: () => ({ ideas: [] }),
  },

  {
    id: "ideas_add_with_context",
    domain: "ideabin",
    group: "Ideas — Add",
    action: "add",
    label: "New ideas (with existing context)",
    description: "Generate new ideas informed by existing ideas and categories — avoids duplicates.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0 && ctxCategoryCount(ctx) === 0
        ? "No existing ideas or categories to provide context"
        : null,
    defaultPrompt:
      `Based on the existing ideas and categories provided below, generate 10-15 NEW ideas that complement what already exists. Avoid duplicating existing concepts — instead, find gaps, extensions, and fresh angles. Each idea needs a title and a description.`,
    expectedFormat: `{
  "ideas": [
    {
      "title": "New idea title",
      "description": "How this complements existing work"
    }
  ]
}`,
    buildPayload: (ctx) => {
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
    id: "ideas_add_to_categories",
    domain: "ideabin",
    group: "Ideas — Add",
    action: "add",
    label: "New ideas for existing categories",
    description: "Generate ideas that specifically fit into your existing category structure.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0
        ? "Create at least one category first"
        : null,
    defaultPrompt:
      `Given the categories below, generate 3-5 new ideas per category that fit well into each. The ideas should be specific to each category's theme. Return them organised by category using the exact category names provided.`,
    expectedFormat: `{
  "new_ideas_for_existing": [
    {
      "category_name": "Existing Category Name",
      "ideas": [
        { "title": "Idea title", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "ideas_add_for_teams",
    domain: "ideabin",
    group: "Ideas — Add",
    action: "add",
    label: "New ideas for existing teams",
    description: "Generate ideas aligned with existing team domains and capabilities.",
    unavailableMsg: (ctx) =>
      !ctx.projectTeams || ctx.projectTeams.length === 0
        ? "No teams found — create teams in Task Structure first"
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
      existing_ideas: ctxUnassigned(ctx)
        .slice(0, 30)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
    }),
  },

  {
    id: "ideas_add_with_new_teams",
    domain: "ideabin",
    group: "Ideas — Add",
    action: "add",
    label: "New ideas + suggest new teams",
    description: "Generate ideas AND suggest a team structure to execute them.",
    unavailableMsg: (ctx) =>
      ctxIdeaCount(ctx) === 0
        ? "Add some ideas first so the AI can suggest teams based on them"
        : null,
    defaultPrompt:
      `Based on the existing ideas below, suggest 3-5 teams (with names and brief descriptions of their focus areas), then generate 5-8 new ideas per team. The teams should emerge naturally from the idea landscape.`,
    expectedFormat: `{
  "teams": [
    {
      "team_name": "Suggested Team",
      "team_description": "This team focuses on...",
      "ideas": [
        { "title": "Idea title", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
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

  // ─────────────────────────────────────────────────────────
  //  IDEAS — OVERWORK
  // ─────────────────────────────────────────────────────────

  {
    id: "ideas_overwork_selected",
    domain: "ideabin",
    group: "Ideas — Overwork",
    action: "overwork",
    label: "Improve selected ideas",
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
    buildPayload: (ctx) => ({
      ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
    }),
  },

  {
    id: "ideas_overwork_with_teams",
    domain: "ideabin",
    group: "Ideas — Overwork",
    action: "overwork",
    label: "Improve ideas + assign to teams",
    description: "Improve selected ideas and suggest which team should own each.",
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select one or more ideas first";
      if (!ctx.projectTeams || ctx.projectTeams.length === 0) return "No teams found — create teams in Task Structure first";
      return null;
    },
    defaultPrompt:
      `Improve the following ideas (better titles, expanded descriptions) and assign each to the most suitable team from the provided team list. Include the original title so changes can be tracked.`,
    expectedFormat: `{
  "updated_ideas": [
    {
      "original_title": "Original title (exact match)",
      "title": "Improved title",
      "description": "Improved description",
      "suggested_team": "Team Name"
    }
  ]
}`,
    buildPayload: (ctx) => ({
      ideas: getSelectedIdeas(ctx.ideas, ctx.selectedIdeaIds)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      teams: (ctx.projectTeams || []).map(t => ({ name: t.name })),
    }),
  },

  {
    id: "ideas_overwork_assign_legends",
    domain: "ideabin",
    group: "Ideas — Overwork",
    action: "overwork",
    label: "Assign legend types to ideas",
    description: "Analyse selected ideas and assign appropriate legend types to each.",
    unavailableMsg: (ctx) => {
      if (ctx.selectedIdeaIds.size === 0) return "Select one or more ideas first";
      if (!hasLegendTypes(ctx.dims)) return "Create legend types first (in the Legend panel)";
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
    id: "ideas_overwork_all",
    domain: "ideabin",
    group: "Ideas — Overwork",
    action: "overwork",
    label: "Improve all ideas",
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
  //  CATEGORIES — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "categories_add_blank",
    domain: "ideabin",
    group: "Categories — Add",
    action: "add",
    label: "New categories (blank)",
    description: "Suggest a category structure based only on the project description.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Suggest 5-8 meaningful categories for organising ideas in this project. Each category should have a clear, distinct focus area. Just provide category names — no ideas yet.`,
    expectedFormat: `{
  "categories": [
    { "category_name": "Category A" },
    { "category_name": "Category B" }
  ]
}`,
    buildPayload: () => ({ categories: [] }),
  },

  {
    id: "categories_add_with_ideas",
    domain: "ideabin",
    group: "Categories — Add",
    action: "add",
    label: "New categories with ideas",
    description: "Generate new categories pre-populated with ideas.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Create 5-8 categories for this project and populate each with 3-5 relevant ideas. Categories should cover distinct aspects of the project.`,
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
      // Provide existing if any, so AI avoids duplicates
      const cats = ctxCategories(ctx);
      if (cats.length === 0) return {};
      return {
        existing_categories: cats.map(c => ({ category_name: c.name })),
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  CATEGORIES — OVERWORK
  // ─────────────────────────────────────────────────────────

  {
    id: "categories_overwork_structure",
    domain: "ideabin",
    group: "Categories — Overwork",
    action: "overwork",
    label: "Improve category structure",
    description: "Reorganise and rename categories for better clarity.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0
        ? "Create at least one category first"
        : null,
    defaultPrompt:
      `Review the current categories and suggest improvements: better names, merges, splits, or reorganisation. Return the improved structure with original names so changes can be tracked. If two categories overlap significantly, suggest merging them.`,
    expectedFormat: `{
  "updated_categories": [
    { "original_name": "Current Category Name", "category_name": "Improved Name" }
  ],
  "suggestions": "Brief explanation of what was changed and why."
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "ideas_reassign_existing",
    domain: "ideabin",
    group: "Categories — Overwork",
    action: "overwork",
    label: "Reassign ideas to existing categories",
    description: "Move ideas into the most fitting existing category — no renaming, just smarter placement.",
    unavailableMsg: (ctx) => {
      if (ctxCategoryCount(ctx) < 2) return "Need at least 2 categories to reassign between";
      if (ctxIdeaCount(ctx) === 0) return "No ideas to reassign";
      return null;
    },
    defaultPrompt:
      `Review the ideas and categories below. For any ideas that would fit better in a different category, suggest moving them there. Only list moves that genuinely improve the organisation — don't shuffle things around without reason. Group your assignments by target category.`,
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
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
        unassigned_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "ideas_reassign_with_new",
    domain: "ideabin",
    group: "Categories — Overwork",
    action: "overwork",
    label: "Reassign ideas + propose new categories",
    description: "Move ideas into better categories and suggest new ones for ideas that don't fit anywhere.",
    unavailableMsg: (ctx) => {
      if (ctxCategoryCount(ctx) === 0) return "Create at least one category first";
      if (ctxIdeaCount(ctx) === 0) return "No ideas to reassign";
      return null;
    },
    defaultPrompt:
      `Review the ideas and categories below. Move misplaced ideas into the correct existing category, and for ideas that don't fit any current category, propose new categories to hold them. Group assignments by target category name, and list new category suggestions separately.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Existing Category Name",
      "ideas": ["Idea title A", "Idea title B"]
    }
  ],
  "new_category_suggestions": [
    {
      "category_name": "Suggested New Category",
      "ideas": ["Idea title C"]
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
  //  CATEGORIES & IDEAS — COMBINED
  // ─────────────────────────────────────────────────────────

  {
    id: "combined_overwork_all",
    domain: "ideabin",
    group: "Categories & Ideas",
    action: "overwork",
    label: "Overwork all categories & ideas",
    description: "Full restructure — improve categories, ideas, and placement.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0 && ctxIdeaCount(ctx) === 0
        ? "No categories or ideas to overwork"
        : null,
    defaultPrompt:
      `Perform a comprehensive review: improve all category names, improve all idea titles and descriptions, suggest better categorisation if ideas seem misplaced, and note any gaps. Include original names/titles so changes can be tracked.`,
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
  "suggestions": "Overall observations and recommendations."
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
    id: "combined_add_ideas_only",
    domain: "ideabin",
    group: "Categories & Ideas",
    action: "add",
    label: "Add ideas to existing categories",
    description: "Keep existing categories, generate new ideas to fill them.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0
        ? "Create at least one category first"
        : null,
    defaultPrompt:
      `Given the existing categories and their current ideas, generate 3-5 NEW ideas per category that fill gaps and extend coverage. Do NOT repeat existing ideas. Return only the new ideas, organised by their exact existing category name.`,
    expectedFormat: `{
  "new_ideas_for_existing": [
    {
      "category_name": "Existing Category Name",
      "ideas": [
        { "title": "New idea", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c =>
          buildCategoryPayload(c, ctx.ideas, orders, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "combined_add_ideas_and_categories",
    domain: "ideabin",
    group: "Categories & Ideas",
    action: "add",
    label: "Add new categories + ideas",
    description: "Keep existing structure, add new categories with ideas.",
    unavailableMsg: (ctx) =>
      ctxCategoryCount(ctx) === 0
        ? "Create at least one category first"
        : null,
    defaultPrompt:
      `Given the existing categories, suggest 3-5 NEW categories that cover currently missing areas, and populate each with 3-5 ideas. The new categories should complement — not duplicate — what already exists.`,
    expectedFormat: `{
  "new_categories": [
    {
      "category_name": "New Category",
      "ideas": [
        { "title": "Idea title", "description": "..." }
      ]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        existing_categories: cats.map(c => ({
          category_name: c.name,
          idea_count: ideasForCategory(c.id, ctx.ideas, orders).length,
        })),
      };
    },
  },

  // ─────────────────────────────────────────────────────────
  //  LEGENDS & FILTERS
  // ─────────────────────────────────────────────────────────

  {
    id: "legends_add_new",
    domain: "ideabin",
    group: "Legends & Filters",
    action: "add",
    label: "Create new legends + types",
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
      // Provide existing ideas for context
      const sample = ctxAllIdeas(ctx).slice(0, 20)
        .map(i => ({ title: i.title, description: i.description }));
      const payload = {};
      if (sample.length) payload.sample_ideas = sample;
      if (hasLegends(ctx.dims)) {
        payload.existing_legends = buildLegendPayload(ctx.dims);
      }
      return payload;
    },
  },

  {
    id: "legends_overwork_all",
    domain: "ideabin",
    group: "Legends & Filters",
    action: "overwork",
    label: "Improve existing legends",
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
    id: "filters_add_for_existing",
    domain: "ideabin",
    group: "Legends & Filters",
    action: "add",
    label: "Suggest filters for existing legends",
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

  {
    id: "filters_add_with_legends",
    domain: "ideabin",
    group: "Legends & Filters",
    action: "add",
    label: "Create legends + types + filters",
    description: "Full generation: legends, types, and filter presets.",
    unavailableMsg: () => null,
    defaultPrompt:
      `Create a complete legend system for this project: 2-4 legend dimensions with 3-6 types each (with colours), PLUS 3-5 useful filter presets using those types. Design the whole system to be practical for daily use.`,
    expectedFormat: `{
  "legends": [
    {
      "name": "Legend Name",
      "types": [
        { "name": "Type", "color": "#hex" }
      ]
    }
  ],
  "filter_presets": [
    {
      "name": "Preset name",
      "rules": [
        { "legend_name": "Legend Name", "type_names": ["Type"], "mode": "include" }
      ],
      "combine_mode": "and"
    }
  ]
}`,
    buildPayload: (ctx) => {
      const sample = ctxAllIdeas(ctx).slice(0, 20)
        .map(i => ({ title: i.title }));
      return sample.length ? { sample_ideas: sample } : {};
    },
  },

  {
    id: "filters_overwork_all",
    domain: "ideabin",
    group: "Legends & Filters",
    action: "overwork",
    label: "Improve existing filters",
    description: "Review and improve current filter configurations.",
    unavailableMsg: (ctx) => {
      const f = buildFilterPayload(ctx);
      return Object.keys(f).length === 0
        ? "No active filters to improve"
        : null;
    },
    defaultPrompt:
      `Review the current filter configuration and suggest improvements: renamed presets, better rule combinations, additional useful presets, or presets to remove. Return the improved configuration.`,
    expectedFormat: `{
  "filter_presets": [
    {
      "name": "Improved preset name",
      "rules": [
        { "legend_name": "Legend", "type_names": ["Type"], "mode": "include" }
      ],
      "combine_mode": "and"
    }
  ],
  "suggestions": "What was changed and why."
}`,
    buildPayload: (ctx) => ({
      ...buildLegendPayload(ctx.dims),
      current_filters: buildFilterPayload(ctx),
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  ENTIRE CONTEXT
  // ─────────────────────────────────────────────────────────

  {
    id: "context_add_to_existing",
    domain: "ideabin",
    group: "Entire Context",
    action: "add",
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
    id: "context_overwork_all",
    domain: "ideabin",
    group: "Entire Context",
    action: "overwork",
    label: "Overwork entire context",
    description: "Pass everything, get comprehensive improvements.",
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

  // ─────────────────────────────────────────────────────────
  //  ANALYSIS (extras)
  // ─────────────────────────────────────────────────────────

  {
    id: "ideas_deduplicate",
    domain: "ideabin",
    group: "Analysis",
    action: "analyse",
    label: "Find & merge duplicate ideas",
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
    buildPayload: (ctx) => {
      const all = ctxAllIdeas(ctx)
        .map(i => cleanIdea(i, ctx.dims?.legendTypes));
      return { ideas: all };
    },
  },

  {
    id: "ideas_auto_categorize",
    domain: "ideabin",
    group: "Analysis",
    action: "analyse",
    label: "Auto-categorise uncategorised ideas",
    description: "Suggest which categories uncategorised ideas should go into.",
    unavailableMsg: (ctx) => {
      const unassignedCount = ctxUnassigned(ctx).length;
      const catCount = ctxCategoryCount(ctx);
      if (catCount === 0) return "Create at least one category first";
      if (unassignedCount === 0) return "No uncategorised ideas to assign";
      return null;
    },
    defaultPrompt:
      `Given the existing categories and the uncategorised ideas below, suggest the best category for each uncategorised idea. If no existing category fits well, suggest creating a new one. Return assignments grouped by category.`,
    expectedFormat: `{
  "assignments": [
    {
      "category_name": "Existing Category",
      "ideas": ["Idea title A", "Idea title B"]
    }
  ],
  "new_category_suggestions": [
    {
      "category_name": "Suggested New Category",
      "ideas": ["Idea title C"]
    }
  ]
}`,
    buildPayload: (ctx) => {
      const cats = ctxCategories(ctx);
      const orders = ctxCategoryOrders(ctx);
      return {
        categories: cats.map(c => ({
          category_name: c.name,
          ideas: ideasForCategory(c.id, ctx.ideas, orders)
            .map(i => ({ title: i.title })),
        })),
        uncategorised_ideas: ctxUnassigned(ctx)
          .map(i => cleanIdea(i, ctx.dims?.legendTypes)),
      };
    },
  },

  {
    id: "ideas_gap_analysis",
    domain: "ideabin",
    group: "Analysis",
    action: "analyse",
    label: "Gap analysis",
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
];

// ─── Group ordering for UI ─────────────────────────────

export const IDEABIN_GROUPS = [
  "Ideas — Add",
  "Ideas — Overwork",
  "Categories — Add",
  "Categories — Overwork",
  "Categories & Ideas",
  "Legends & Filters",
  "Entire Context",
  "Analysis",
];
