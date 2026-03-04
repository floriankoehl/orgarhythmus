from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import PromptSettings


VALID_SCENARIO_KEYS = {
    # ── Legacy keys (kept for backwards compatibility) ──
    "ideabin_single_category",
    "ideabin_multi_categories",
    "task_single_team",
    "task_multi_teams",
    "task_single_task",
    "dep_selected_tasks",
    # Legacy v1 prompt-engine keys (superseded by grid v2)
    "ideas_add_blank",
    "ideas_add_with_context",
    "ideas_add_to_categories",
    "ideas_add_with_new_teams",
    "ideas_overwork_selected",
    "ideas_overwork_with_teams",
    "ideas_overwork_assign_legends",
    "ideas_overwork_all",
    "categories_add_blank",
    "categories_add_with_ideas",
    "categories_overwork_structure",
    "ideas_reassign_existing",
    "ideas_reassign_with_new",
    "combined_overwork_all",
    "combined_add_ideas_only",
    "combined_add_ideas_and_categories",
    "legends_add_new",
    "filters_add_for_existing",
    "filters_add_with_legends",
    "filters_overwork_all",
    "context_add_to_existing",
    "context_overwork_all",
    "ideas_deduplicate",
    "ideas_auto_categorize",
    "ideas_gap_analysis",

    # ── IdeaBin prompt-engine v2 (grid layout) ──
    # Ideas — Add
    "ideas_add",
    "ideas_add_for_teams",
    # Ideas — Finetune
    "ideas_finetune_selected",
    "ideas_finetune_all",
    # Assign (Ideas ↔ Categories)
    "assign_unassigned_existing",
    "assign_unassigned_new",
    "assign_selected_existing",
    "assign_selected_new",
    # Categories — Add
    "categories_add",
    "categories_add_for_ideas",
    # Categories — Finetune
    "categories_finetune_selected",
    "categories_finetune_all",
    # Legends & Filters — Add
    "legends_add",
    "filters_add",
    # Legends & Filters — Finetune
    "legends_finetune_all",
    "legends_finetune_single",
    "legends_overwork_all",
    # Legends & Filters — Assign
    "legends_assign_one_selected",
    "legends_assign_one_all",
    "legends_assign_all_selected",
    "legends_assign_all_all",
    # Specials
    "special_context_add",
    "special_context_suggestions",
    "special_gap_analysis",
    "special_dedup_merge",

    # ── Task Structure prompt-engine v2 (grid layout) ──
    # Tasks — Add
    "tasks_add",
    "tasks_add_for_teams",
    # Tasks — Assign
    "tasks_assign_unassigned_existing",
    "tasks_assign_unassigned_new",
    "tasks_assign_selected_existing",
    "tasks_assign_selected_new",
    # Tasks — Finetune
    "tasks_finetune_selected",
    "tasks_finetune_all",
    # Teams — Add
    "teams_add",
    "teams_add_for_tasks",
    # Teams — Finetune
    "teams_finetune_selected",
    "teams_finetune_all",
    # Task Specials
    "special_taskify_ideas",
    "special_acceptance_criteria_selected",
    "special_acceptance_criteria_all",
    "special_task_suggestions",
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_prompt_settings(request):
    """Return the current user's prompt settings (auto-created if missing)."""
    obj, _ = PromptSettings.objects.get_or_create(user=request.user)
    return Response({
        "auto_add_system_prompt": obj.auto_add_system_prompt,
        "auto_add_json_format": obj.auto_add_json_format,
        "auto_add_scenario_prompt": obj.auto_add_scenario_prompt,
        "auto_add_project_description": obj.auto_add_project_description,
        "auto_add_end_prompt": obj.auto_add_end_prompt,
        "system_prompt": obj.system_prompt,
        "end_prompt": obj.end_prompt,
        "scenario_prompts": obj.scenario_prompts,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_prompt_settings(request):
    """
    Update the current user's prompt settings.
    Body: any subset of {
        auto_add_system_prompt, auto_add_json_format, auto_add_scenario_prompt,
        system_prompt, scenario_prompts
    }
    """
    obj, _ = PromptSettings.objects.get_or_create(user=request.user)

    for bool_field in ("auto_add_system_prompt", "auto_add_json_format", "auto_add_scenario_prompt", "auto_add_project_description", "auto_add_end_prompt"):
        if bool_field in request.data:
            setattr(obj, bool_field, bool(request.data[bool_field]))

    if "system_prompt" in request.data:
        obj.system_prompt = str(request.data["system_prompt"])

    if "end_prompt" in request.data:
        obj.end_prompt = str(request.data["end_prompt"])

    if "scenario_prompts" in request.data:
        incoming = request.data["scenario_prompts"]
        if not isinstance(incoming, dict):
            return Response({"detail": "scenario_prompts must be a JSON object"}, status=status.HTTP_400_BAD_REQUEST)
        # Merge — only allow valid keys
        merged = dict(obj.scenario_prompts or {})
        for key, value in incoming.items():
            if key in VALID_SCENARIO_KEYS:
                merged[key] = str(value) if value else ""
        obj.scenario_prompts = merged

    obj.save()

    return Response({
        "auto_add_system_prompt": obj.auto_add_system_prompt,
        "auto_add_json_format": obj.auto_add_json_format,
        "auto_add_scenario_prompt": obj.auto_add_scenario_prompt,
        "auto_add_project_description": obj.auto_add_project_description,
        "auto_add_end_prompt": obj.auto_add_end_prompt,
        "system_prompt": obj.system_prompt,
        "end_prompt": obj.end_prompt,
        "scenario_prompts": obj.scenario_prompts,
    })
