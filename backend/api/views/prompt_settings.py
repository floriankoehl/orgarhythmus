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

    # ── IdeaBin prompt-engine scenarios ──
    # Ideas — Add
    "ideas_add_blank",
    "ideas_add_with_context",
    "ideas_add_to_categories",
    "ideas_add_for_teams",
    "ideas_add_with_new_teams",
    # Ideas — Overwork
    "ideas_overwork_selected",
    "ideas_overwork_with_teams",
    "ideas_overwork_assign_legends",
    "ideas_overwork_all",
    # Categories — Add
    "categories_add_blank",
    "categories_add_with_ideas",
    # Categories — Overwork
    "categories_overwork_structure",
    "ideas_reassign_existing",
    "ideas_reassign_with_new",
    # Categories & Ideas
    "combined_overwork_all",
    "combined_add_ideas_only",
    "combined_add_ideas_and_categories",
    # Legends & Filters
    "legends_add_new",
    "legends_overwork_all",
    "filters_add_for_existing",
    "filters_add_with_legends",
    "filters_overwork_all",
    # Entire Context
    "context_add_to_existing",
    "context_overwork_all",
    # Analysis
    "ideas_deduplicate",
    "ideas_auto_categorize",
    "ideas_gap_analysis",
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
