"""
Category-level JSON export & import, plus idea insertion.

GET  /api/user/categories/<id>/export/        → JSON with category + ideas
POST /api/user/categories/import/             → create new category(ies) from JSON (body, file, or paste)
POST /api/user/categories/<id>/insert-ideas/  → insert ideas into an existing category from JSON

The JSON schema is intentionally simple so it can be copy-pasted,
handed to an AI for refinement, and pasted back in.

Single category schema:
{
  "category_name": "...",
  "ideas": [
    { "title": "...", "description": "..." },
    ...
  ]
}

Multi-category schema:
{
  "categories": [
    {
      "category_name": "...",
      "ideas": [ { "title": "...", "description": "..." }, ... ]
    },
    ...
  ]
}

Idea insertion schema (for insert-ideas endpoint):
{
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
from .ideas import _get_accessible_category


# ─── export ──────────────────────────────────────────────


def _export_single_category(user, category_id):
    """Return a dict for one category + its ideas, or None if not found."""
    cat = _get_accessible_category(user, category_id)
    if not cat:
        return None

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

    return {
        "category_name": cat.name,
        "ideas": ideas_list,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_category(request, category_id):
    """Return a simple JSON blob for one category and its ideas."""
    data = _export_single_category(request.user, category_id)
    if data is None:
        return JsonResponse({"error": "Category not found."}, status=404)
    return JsonResponse(data, json_dumps_params={"indent": 2})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def export_categories_multi(request):
    """
    Export multiple categories at once.

    Body: { "category_ids": [1, 2, 3] }
    Returns: { "categories": [ { "category_name": "...", "ideas": [...] }, ... ] }
    """
    ids = request.data.get("category_ids", [])
    if not isinstance(ids, list) or len(ids) == 0:
        return JsonResponse({"error": "Provide a non-empty 'category_ids' array."}, status=400)

    results = []
    for cid in ids:
        try:
            cid = int(cid)
        except (TypeError, ValueError):
            continue
        cat_data = _export_single_category(request.user, cid)
        if cat_data:
            results.append(cat_data)

    if not results:
        return JsonResponse({"error": "No accessible categories found."}, status=404)

    return JsonResponse({"categories": results}, json_dumps_params={"indent": 2})


# ─── import ──────────────────────────────────────────────


def _resolve_context(user, context_id):
    """Resolve a context_id query param into a Context or None."""
    if not context_id:
        return None
    try:
        ctx = Context.objects.get(id=int(context_id))
        if ctx.owner == user or UserContextAdoption.objects.filter(user=user, context=ctx).exists():
            return ctx
    except (Context.DoesNotExist, ValueError):
        pass
    return None


def _import_single_category(user, cat_data, target_ctx):
    """
    Create one category + its ideas inside a transaction.
    Returns (category_id, created_count).
    """
    category_name = cat_data.get("category_name", "").strip()
    if not category_name:
        category_name = "Imported Category"

    ideas_list = cat_data.get("ideas", [])
    if not isinstance(ideas_list, list):
        ideas_list = []

    cat = Category.objects.create(
        owner=user,
        name=category_name,
    )

    if target_ctx:
        CategoryContextPlacement.objects.create(
            category_id=cat.id,
            context_id=target_ctx.id,
            order_index=0,
        )

    created_count = 0
    for idx, idea_data in enumerate(ideas_list):
        if not isinstance(idea_data, dict):
            continue

        title = idea_data.get("title", "").strip()
        description = idea_data.get("description", "").strip()

        if not title and not description:
            continue

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

    return cat.id, created_count


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_category(request):
    """
    Create new category(ies) from JSON.

    Accepts:
      - multipart file upload (field "file")
      - raw JSON body

    Single-category format:
      { "category_name": "...", "ideas": [...] }

    Multi-category format:
      { "categories": [ { "category_name": "...", "ideas": [...] }, ... ] }

    If a context_id query param is provided, the new categories are placed in that context.
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
        data = request.data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError as exc:
                return JsonResponse({"error": f"Invalid JSON: {exc}"}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({"error": "Expected a JSON object."}, status=400)

    target_ctx = _resolve_context(user, request.query_params.get("context_id"))

    # Detect multi-category vs single-category format
    categories_list = data.get("categories")
    if isinstance(categories_list, list):
        # ── Multi-category import ──
        if len(categories_list) == 0:
            return JsonResponse({"error": "'categories' list is empty."}, status=400)

        try:
            with transaction.atomic():
                results = []
                total_ideas = 0
                for cat_data in categories_list:
                    if not isinstance(cat_data, dict):
                        continue
                    cat_id, count = _import_single_category(user, cat_data, target_ctx)
                    results.append({"category_id": cat_id, "category_name": cat_data.get("category_name", ""), "ideas_created": count})
                    total_ideas += count

            return JsonResponse({
                "status": "ok",
                "message": f"Created {len(results)} categories with {total_ideas} ideas total.",
                "categories": results,
                "category_ids": [r["category_id"] for r in results],
            })
        except Exception as exc:
            return JsonResponse({"error": f"Import failed: {exc}"}, status=500)

    else:
        # ── Single-category import (backward-compatible) ──
        category_name = data.get("category_name", "").strip()
        if not category_name:
            return JsonResponse({"error": "Missing 'category_name'."}, status=400)

        ideas_list = data.get("ideas", [])
        if not isinstance(ideas_list, list):
            return JsonResponse({"error": "'ideas' must be a list."}, status=400)

        try:
            with transaction.atomic():
                cat_id, created_count = _import_single_category(user, data, target_ctx)

            return JsonResponse({
                "status": "ok",
                "message": f"Created category \"{category_name}\" with {created_count} ideas.",
                "category_id": cat_id,
                "category_ids": [cat_id],
            })
        except Exception as exc:
            return JsonResponse({"error": f"Import failed: {exc}"}, status=500)


# ─── insert ideas into existing category ─────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def insert_ideas_into_category(request, category_id):
    """
    Insert ideas from JSON into an existing category.

    Body:
      { "ideas": [ { "title": "...", "description": "..." }, ... ] }

    Ideas are appended after the last existing idea in the category.
    If a context_id query param is provided, ideas are also linked to that context.
    """
    user = request.user

    cat = _get_accessible_category(user, category_id)
    if not cat:
        return JsonResponse({"error": "Category not found."}, status=404)

    data = request.data
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError as exc:
            return JsonResponse({"error": f"Invalid JSON: {exc}"}, status=400)

    if not isinstance(data, dict):
        return JsonResponse({"error": "Expected a JSON object."}, status=400)

    ideas_list = data.get("ideas", [])
    if not isinstance(ideas_list, list):
        return JsonResponse({"error": "'ideas' must be a list."}, status=400)

    if len(ideas_list) == 0:
        return JsonResponse({"error": "'ideas' list is empty."}, status=400)

    target_ctx = _resolve_context(user, request.query_params.get("context_id"))

    # Find the current max order_index in this category
    max_order = IdeaPlacement.objects.filter(
        category=cat,
    ).aggregate(Max("order_index"))["order_index__max"]
    next_order = (max_order + 1) if max_order is not None else 0

    try:
        with transaction.atomic():
            created_count = 0
            for idea_data in ideas_list:
                if not isinstance(idea_data, dict):
                    continue

                title = idea_data.get("title", "").strip()
                description = idea_data.get("description", "").strip()

                if not title and not description:
                    continue

                idea = Idea.objects.create(
                    owner=user,
                    title=title,
                    description=description,
                )

                IdeaPlacement.objects.create(
                    idea=idea,
                    category=cat,
                    order_index=next_order,
                )
                next_order += 1

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
            "message": f"Inserted {created_count} ideas into \"{cat.name}\".",
            "category_id": cat.id,
            "ideas_created": created_count,
        })

    except Exception as exc:
        return JsonResponse({"error": f"Insert failed: {exc}"}, status=500)
