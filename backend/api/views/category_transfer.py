"""
Category-level JSON export & import.

GET  /api/user/categories/<id>/export/   → JSON with category + ideas
POST /api/user/categories/import/        → create new category from JSON (body, file, or paste)

The JSON schema is intentionally simple so it can be copy-pasted,
handed to an AI for refinement, and pasted back in.

Schema:
{
  "category_name": "...",
  "ideas": [
    { "title": "...", "description": "..." },
    ...
  ]
}
"""

import json
from django.db.models import Max
from django.http import JsonResponse
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Category,
    CategoryContextPlacement,
    Context,
    Idea,
    IdeaContextPlacement,
    IdeaPlacement,
    IdeaLegendType,
    LegendType,
    UserContextAdoption,
)


# ─── export ──────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_category(request, category_id):
    """Return a simple JSON blob for one category and its ideas."""
    user = request.user

    try:
        cat = Category.objects.get(id=category_id, owner=user)
    except Category.DoesNotExist:
        return JsonResponse({"error": "Category not found."}, status=404)

    # Gather ideas placed in this category (ordered)
    placements = (
        IdeaPlacement.objects
        .filter(category=cat)
        .select_related("idea")
        .order_by("order_index")
    )

    ideas_list = []
    for pl in placements:
        idea = pl.idea
        idea_data = {
            "title": idea.title or "",
            "description": idea.description or "",
        }

        # Include legend type assignments (human-readable)
        ltypes = (
            IdeaLegendType.objects
            .filter(idea=idea)
            .select_related("legend", "legend_type")
        )
        if ltypes.exists():
            idea_data["legend_types"] = [
                {
                    "legend_name": lt.legend.name,
                    "type_name": lt.legend_type.name,
                    "type_color": lt.legend_type.color,
                }
                for lt in ltypes
            ]

        ideas_list.append(idea_data)

    data = {
        "category_name": cat.name,
        "ideas": ideas_list,
    }

    return JsonResponse(data, json_dumps_params={"indent": 2})


# ─── import ──────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_category(request):
    """
    Create a new category from JSON.

    Accepts:
      - multipart file upload (field "file")
      - raw JSON body

    The JSON must have:
      { "category_name": "...", "ideas": [ { "title": "...", "description": "..." }, ... ] }

    If a context_id query param is provided, the new category is placed in that context.
    """
    user = request.user

    # Parse JSON from file or body
    if request.FILES.get("file"):
        try:
            raw = request.FILES["file"].read().decode("utf-8")
            data = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return JsonResponse({"error": f"Invalid JSON file: {exc}"}, status=400)
    else:
        # DRF has already parsed the body into request.data
        data = request.data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError as exc:
                return JsonResponse({"error": f"Invalid JSON: {exc}"}, status=400)

    # Validate
    if not isinstance(data, dict):
        return JsonResponse({"error": "Expected a JSON object."}, status=400)

    category_name = data.get("category_name", "").strip()
    if not category_name:
        return JsonResponse({"error": "Missing 'category_name'."}, status=400)

    ideas_list = data.get("ideas", [])
    if not isinstance(ideas_list, list):
        return JsonResponse({"error": "'ideas' must be a list."}, status=400)

    context_id = request.query_params.get("context_id")

    # Resolve context (same check as normal category/idea creation)
    target_ctx = None
    if context_id:
        try:
            ctx = Context.objects.get(id=int(context_id))
            if ctx.owner == user or UserContextAdoption.objects.filter(user=user, context=ctx).exists():
                target_ctx = ctx
        except (Context.DoesNotExist, ValueError):
            pass

    try:
        with transaction.atomic():
            # Create category
            cat = Category.objects.create(
                owner=user,
                name=category_name,
            )

            # If context provided, place category in that context
            if target_ctx:
                CategoryContextPlacement.objects.create(
                    category_id=cat.id,
                    context_id=target_ctx.id,
                    order_index=0,
                )

            # Create ideas + placements
            created_count = 0
            for idx, idea_data in enumerate(ideas_list):
                if not isinstance(idea_data, dict):
                    continue

                title = idea_data.get("title", "").strip()
                description = idea_data.get("description", "").strip()

                if not title and not description:
                    continue  # skip empty

                idea = Idea.objects.create(
                    owner=user,
                    title=title,
                    description=description,
                )

                IdeaPlacement.objects.create(
                    idea=idea,
                    category=cat,
                    order_index=idx,
                )

                # If inside a context, link idea to context as well
                if target_ctx:
                    cp_max = IdeaContextPlacement.objects.filter(
                        context=target_ctx,
                    ).aggregate(Max("order_index"))["order_index__max"]
                    cp_next = (cp_max + 1) if cp_max is not None else 0
                    IdeaContextPlacement.objects.create(
                        idea=idea,
                        context=target_ctx,
                        order_index=cp_next,
                    )

                created_count += 1

        return JsonResponse({
            "status": "ok",
            "message": f"Created category \"{category_name}\" with {created_count} ideas.",
            "category_id": cat.id,
        })

    except Exception as exc:
        return JsonResponse({"error": f"Import failed: {exc}"}, status=500)
