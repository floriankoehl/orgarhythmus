/**
 * ═══════════════════════════════════════════════════════════
 *  Prompt Engine — Default Prompts
 *  ────────────────────────────────
 *  Single source of truth for every default prompt text.
 *  Edit this file to fine-tune what the AI receives by default.
 *
 *  Structure:
 *    DEFAULT_SYSTEM_PROMPT  – global system message (prepended to all prompts)
 *    DEFAULT_END_PROMPT     – global closing message (appended to all prompts)
 *    IDEABIN_DEFAULTS       – per-scenario defaults for the IdeaBin domain
 *    TASK_DEFAULTS          – per-scenario defaults for the Task Structure domain
 *    DEP_DEFAULTS           – per-scenario defaults for the Dependencies domain
 * ═══════════════════════════════════════════════════════════
 */


// ── Global prompts ───────────────────────────────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT =
  "You are an expert project management AI embedded in Orgarhythmus — a structured planning tool for organising tasks, teams, milestones, dependencies, ideas, categories, and legends.\n\n" +
  "You receive a JSON payload with live project data and scenario-specific instructions. Your job is to generate or refine project content accordingly.\n\n" +
  "Output rules:\n" +
  "- Respond with valid JSON only — no markdown fences, no prose, no explanations outside the JSON.\n" +
  "- Match the expected JSON schema exactly; do not add, rename, or omit fields.\n" +
  "- Ground suggestions in the provided data; avoid inventing names or structures that contradict existing context.\n" +
  "- Keep all names and descriptions concise, specific, and actionable.";

export const DEFAULT_END_PROMPT = "";


// ── IdeaBin defaults ─────────────────────────────────────────────────────────

export const IDEABIN_DEFAULTS = {

  // Ideas — Add
  ideas_add:
    "Generate 10-15 creative and diverse ideas for this project. Each idea should have a clear, concise title and a brief description explaining the concept. Think broadly — include both obvious and unexpected angles.",

  ideas_add_for_teams:
    "Given the teams and their current tasks below, generate 5-8 ideas per team that align with each team's domain and capabilities. Ideas should be actionable and relevant.",

  // Ideas — Finetune
  ideas_finetune_selected:
    "Improve the following ideas. Make titles more concise and impactful, expand descriptions to be clearer and more actionable. Keep the original intent but elevate the quality. Include the original title so changes can be tracked.",

  ideas_finetune_all:
    "Improve ALL of the following ideas. Make titles more concise, expand descriptions for clarity, and ensure consistency across the set. Include the original title for each so changes can be tracked.",

  // Ideas / Categories — Assign
  assign_unassigned_existing:
    "Review the unassigned ideas and categories below. For each unassigned idea, assign it to the most fitting existing category. Group assignments by target category using exact category names.",

  assign_unassigned_new:
    "Review the unassigned ideas and categories below. Assign each idea to the most fitting existing category. For ideas that don't fit any current category, propose new categories. Group assignments by target category.",

  assign_selected_existing:
    "Move each selected idea to the most fitting existing category. Only list moves that genuinely improve the organisation. Group assignments by target category using exact category names.",

  assign_selected_new:
    "Move the selected ideas into the most suitable existing categories. For ideas that don't fit any current category, propose new categories to hold them. Group by target category name.",

  // Categories — Add
  categories_add:
    "Suggest 5-8 meaningful categories for organising ideas in this project and populate each with 3-5 relevant ideas. Each category should have a clear, distinct focus area.",

  categories_add_for_ideas:
    "Based on the selected ideas below, suggest 2-5 categories that would best organise them. Assign each idea to its best-fit new category.",

  // Categories — Finetune
  categories_finetune_selected:
    "Improve the selected categories: suggest better names, review and improve their ideas. Include original names so changes can be tracked.",

  categories_finetune_all:
    "Review all categories and suggest improvements: better names, merges, splits, or reorganisation. Return the improved structure with original names so changes can be tracked.",

  // Legends & Filters — Add
  legends_add:
    "Suggest 2-4 legend dimensions for categorising ideas in this project. Each legend should have 3-6 types with distinct names and hex colors. Legends are cross-cutting dimensions (e.g., \"Priority\", \"Effort\", \"Domain\"). Types are the values within each (e.g., \"High\", \"Medium\", \"Low\").",

  filters_add:
    "Based on the legend types below, suggest 3-5 useful filter preset configurations. Each preset should have a descriptive name and specify which legend types to include or exclude. Think about common workflows — what combinations of filters would be most useful?",

  // Legends & Filters — Finetune
  legends_finetune_all:
    "Review the current legends and their types. Suggest improvements: better names, more useful colour coding, additional missing types, or types to merge. Return the improved structure.",

  legends_finetune_single:
    "Review this specific legend and its types. Suggest improvements: better type names, colours, missing types, or types to merge. Return the improved structure.",

  // Legends — Assign
  legends_assign_one_selected:
    "Analyse each idea below and assign the most fitting type from this legend. Only use types from the provided list — do not invent new ones.",

  legends_assign_one_all:
    "Analyse every idea below and assign the most fitting type from this legend. Only use types from the provided list — do not invent new ones.",

  legends_assign_all_selected:
    "Analyse each idea below and assign the most fitting legend types from the provided list. Each assignment is one legend-type pair. An idea can have multiple assignments across different legends. Only use types from the provided list — do not invent new ones.",

  legends_assign_all_all:
    "Analyse every idea below and assign the most fitting legend types from the provided list. Each assignment is one legend-type pair. An idea can have multiple assignments across different legends. Only use types from the provided list — do not invent new ones.",

  // Specials
  special_context_add:
    "Review the entire project context below (categories, ideas, legends, filters). Then generate additions: new ideas for existing categories, new categories with ideas, and any missing legend types. Do NOT modify existing content — only ADD new things.",

  special_context_suggestions:
    "Perform a comprehensive review of the entire project context below. Improve EVERYTHING: category names, idea titles and descriptions, categorisation, legend types. Include original names/titles so changes can be tracked.",

  special_gap_analysis:
    "Analyse the current idea landscape (categories and ideas) and identify gaps: what areas are underrepresented, what perspectives are missing, what obvious topics haven't been covered? Suggest concrete ideas to fill each gap.",

  special_dedup_merge:
    "Analyse the following ideas and identify groups of similar, overlapping, or duplicate ideas. For each group, suggest a merged version that combines the best parts. Return both the duplicate groups and the suggested merged versions.",

  special_taskify_ideas:
    "Convert these ideas into well-defined tasks. Each idea should become one or more tasks with clear names, descriptions, priority, difficulty, and 2-4 acceptance criteria. Group them into teams if logical groupings emerge.",
};


// ── Task Structure defaults ──────────────────────────────────────────────────

export const TASK_DEFAULTS = {

  // Tasks — Add
  tasks_add:
    "Generate 8-12 well-defined tasks for this project. Each task should have a clear name, description, and 2-4 acceptance criteria. Also suggest a priority (high/medium/low) and difficulty (easy/medium/hard).",

  tasks_add_for_teams:
    "Generate 3-5 well-defined tasks for each team. Each task should fit the team's area of responsibility. Include name, description, priority, difficulty, and acceptance criteria.",

  // Tasks — Assign
  tasks_assign_unassigned_existing:
    "For each unassigned task, suggest the most appropriate existing team to assign it to. Return assignments as a JSON array.",

  tasks_assign_unassigned_new:
    "Suggest new team groupings for the unassigned tasks. Group them logically by domain or function. Return new teams with their assigned tasks.",

  tasks_assign_selected_existing:
    "Assign each selected task to the most appropriate existing team. Consider each team's current workload and domain.",

  tasks_assign_selected_new:
    "Group the selected tasks into new teams based on logical categories. Suggest a team name and color for each group.",

  // Tasks — Finetune
  tasks_finetune_selected:
    "Improve these tasks: refine the names to be clearer and more actionable, enhance descriptions, adjust priority/difficulty if appropriate, and improve or add acceptance criteria. Return the full updated tasks.",

  tasks_finetune_all:
    "Review and improve all tasks: refine names, enhance descriptions, adjust priority/difficulty, and improve acceptance criteria. Return the full updated set of tasks.",

  // Teams — Add
  teams_add:
    "Suggest 3-5 well-defined teams for this project. Each team should have a clear name, purpose description, and a suggested color. Also suggest 3-5 tasks per team.",

  teams_add_for_tasks:
    "Analyse the existing tasks and suggest new teams to group them logically. Include team name, color, and which existing tasks belong to each team.",

  // Teams — Finetune
  teams_finetune_selected:
    "Improve these teams: refine team names, suggest better colours, and review their task assignments. Return the updated teams with any suggested changes.",

  teams_finetune_all:
    "Review and improve all teams: refine names, suggest better colours, and review task distribution across teams.",

  // Specials
  special_tasks_and_teams:
    "Generate a complete project structure from scratch (or extending what exists). Create 3-6 teams, each with 3-5 well-defined tasks. Also add 3-5 unassigned tasks that don't fit neatly into a single team. Every task should have a name, description, priority, difficulty, and 2-4 acceptance criteria.",

  special_acceptance_criteria_selected:
    "For each task, generate 3-5 clear, testable acceptance criteria. Each criterion should be specific and verifiable. Return using the original_name to match tasks.",

  special_acceptance_criteria_all:
    "For each task, generate 3-5 clear, testable acceptance criteria. Focus on tasks that don't have any criteria yet. Return using the original_name to match tasks.",

  special_task_suggestions:
    "Analyse the current task structure and provide suggestions for improvement. Consider: missing tasks, team balance, task clarity, priority distribution, and acceptance criteria quality.",

  // Classification Systems
  classification_add:
    "Analyse this project and suggest 2-4 classification systems for labelling tasks along different cross-cutting dimensions. " +
    "Each system should have a clear purpose and 3-6 categories with distinct hex colors. " +
    "Think beyond generic priority/difficulty — suggest dimensions specific to this project. " +
    "Examples: an 'Importance' system (Critical / Should Have / Nice to Have), a 'Process' system tied to a real workflow (Booking / On-site / Post-event), " +
    "a 'Risk' system (High Risk / Moderate / Low Risk), or anything else that helps this team filter and navigate their work. " +
    "Do NOT duplicate any existing classification systems listed in the payload.",

  classification_assign_selected:
    "You are given a list of tasks and ONE active classification system with its named categories. " +
    "For every task, assign the single most fitting category from this classification system. " +
    "Use only the category names exactly as provided — do not invent new ones. " +
    "If a task genuinely does not fit any category, omit it rather than forcing a bad fit. " +
    "Return a single entry in label_assignments using the classification system's exact name.",

  classification_assign_all:
    "You are given all tasks in the project and ONE active classification system with its named categories. " +
    "For every task, assign the single most fitting category from this classification system. " +
    "Use only the category names exactly as provided — do not invent new ones. " +
    "If a task genuinely does not fit any category, omit it rather than forcing a bad fit. " +
    "Return a single entry in label_assignments using the classification system's exact name.",
};


// ── Dependencies defaults ────────────────────────────────────────────────────

export const DEP_DEFAULTS = {

  // Milestones — Add
  dep_milestones_add:
    "For each task, create one or more milestones. Each milestone needs a name, description, and suggested start_index (day number, 0-based). Keep milestone durations at 1 unless a task clearly needs more time.",

  // Milestones — Finetune
  dep_milestones_finetune:
    "Review the existing milestones. Suggest improvements to names, descriptions, and scheduling positions. Return updated milestones using their original_name for matching.",

  // Connections — Add
  dep_connections_add:
    "Analyse these milestones and create dependency connections. A dependency means the source must finish before the target can start. Use milestone IDs for source and target. " +
    "For each dependency, provide a short 'reason' (a concise label/headline, max ~5 words) and a longer 'description' (a detailed explanation of why this dependency exists). " +
    "Use weight 'strong' for hard dependencies and 'weak' for soft ones.",

  dep_connections_add_selected:
    "Analyse ONLY the selected milestones (listed under 'selected_milestones') and create dependency connections between them and other milestones. A dependency means the source must finish before the target can start. Use milestone IDs for source and target. " +
    "For each dependency, provide a short 'reason' (a concise label/headline, max ~5 words) and a longer 'description' (a detailed explanation of why this dependency exists). " +
    "Use weight 'strong' for hard dependencies and 'weak' for soft ones.",

  // Durations — Finetune
  dep_durations_finetune:
    "Review each milestone and suggest a realistic duration in days based on the task description. " +
    "CRITICAL SCHEDULING RULE: A predecessor's end day (start_index + duration) must be less than or equal to the successor's start_index — the predecessor must fully finish before the successor can start. " +
    "After adjusting durations, verify all existing dependencies still satisfy this rule. Return only milestones where the duration should change.",

  // Connections — Finetune
  dep_connections_finetune:
    "Review these dependency connections. Suggest improvements: change weights (strong/weak/suggestion), add or improve reasons and descriptions, and identify any dependencies that should be removed or added. " +
    "For each dependency, provide a short 'reason' (a concise label/headline, max ~5 words) and a longer 'description' (a detailed explanation).",

  // Schedule — Add
  dep_schedule_add:
    "Re-schedule all milestones so that every dependency constraint is satisfied. A predecessor must end (start_index + duration) before or at the successor's start_index. Return the updated start_index for each milestone.",

  // Schedule — Finetune
  dep_schedule_finetune:
    "Optimise this schedule. Compress the timeline where possible, identify bottlenecks, and suggest better positioning. Ensure all dependency constraints remain satisfied.",

  // Specials
  special_full_dependency_graph:
    "For the given tasks, create milestones and dependency connections. Determine which tasks logically depend on each other. Each task should have at least one milestone. " +
    "Schedule milestones so predecessors finish before successors start. " +
    "For each dependency, provide a short 'reason' (a concise label/headline, max ~5 words) and a longer 'description' (a detailed explanation of why this dependency exists).",

  special_dep_suggestions:
    "Analyse the existing milestones and dependencies. Suggest any missing dependency connections that should exist. " +
    "For each dependency, provide a short 'reason' (a concise label/headline, max ~5 words) and a longer 'description' (a detailed explanation of why it is important).",
};
