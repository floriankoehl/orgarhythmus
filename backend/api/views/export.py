"""
IdeaBin JSON backup export.

GET /api/ideabin/export/           → global export (all user data)
GET /api/ideabin/export/?context_id=<id>  → context-scoped export
"""

import json
from datetime import datetime

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from ..models import (
    Category,
    CategoryContextPlacement,
    Context,
    Formation,
    Idea,
    IdeaComment,
    IdeaLegendType,
    IdeaPlacement,
    IdeaUpvote,
    Legend,
    LegendContextPlacement,
    LegendType,
    UserCategoryAdoption,
    UserContextAdoption,
    UserLegendAdoption,
    UserShortcuts,
)


# ─── tiny serialisation helpers ───────────────────────────

def _ser_legend_type(lt):
    return {
        "id": lt.id,
        "legend_id": lt.legend_id,
        "name": lt.name,
        "color": lt.color,
        "icon": lt.icon,
        "order_index": lt.order_index,
    }


def _ser_legend(legend, types_qs=None):
    types = types_qs if types_qs is not None else legend.types.all()
    return {
        "id": legend.id,
        "owner_id": legend.owner_id,
        "context_id": legend.context_id,
        "name": legend.name,
        "created_at": legend.created_at.isoformat(),
        "types": [_ser_legend_type(t) for t in types],
    }


def _ser_idea(idea, placements_qs=None, legend_types_qs=None,
              upvotes_qs=None, comments_qs=None):
    placements = placements_qs if placements_qs is not None else idea.placements.all()
    legend_types = legend_types_qs if legend_types_qs is not None else idea.legend_types.all()
    upvotes = upvotes_qs if upvotes_qs is not None else idea.upvotes.all()
    comments = comments_qs if comments_qs is not None else idea.comments.all()

    return {
        "id": idea.id,
        "owner_id": idea.owner_id,
        "title": idea.title,
        "description": idea.description,
        "archived": idea.archived,
        "created_at": idea.created_at.isoformat() if idea.created_at else None,
        "placements": [
            {
                "id": p.id,
                "category_id": p.category_id,
                "order_index": p.order_index,
            }
            for p in placements
        ],
        "legend_type_assignments": [
            {
                "id": lt.id,
                "legend_id": lt.legend_id,
                "legend_type_id": lt.legend_type_id,
            }
            for lt in legend_types
        ],
        "upvotes": [
            {
                "id": uv.id,
                "user_id": uv.user_id,
                "created_at": uv.created_at.isoformat(),
            }
            for uv in upvotes
        ],
        "comments": [
            {
                "id": c.id,
                "user_id": c.user_id,
                "text": c.text,
                "created_at": c.created_at.isoformat(),
            }
            for c in comments
        ],
    }


def _ser_category(cat):
    return {
        "id": cat.id,
        "owner_id": cat.owner_id,
        "name": cat.name,
        "x": cat.x,
        "y": cat.y,
        "width": cat.width,
        "height": cat.height,
        "z_index": cat.z_index,
        "archived": cat.archived,
        "is_public": cat.is_public,
        "filter_config": cat.filter_config,
    }


def _ser_context(ctx):
    return {
        "id": ctx.id,
        "owner_id": ctx.owner_id,
        "name": ctx.name,
        "x": ctx.x,
        "y": ctx.y,
        "width": ctx.width,
        "height": ctx.height,
        "z_index": ctx.z_index,
        "is_public": ctx.is_public,
        "is_default": ctx.is_default,
        "color": ctx.color,
        "filter_state": ctx.filter_state,
        "created_at": ctx.created_at.isoformat(),
    }


def _ser_formation(f):
    return {
        "id": f.id,
        "owner_id": f.owner_id,
        "context_id": f.context_id,
        "name": f.name,
        "state": f.state,
        "is_default": f.is_default,
        "created_at": f.created_at.isoformat(),
        "updated_at": f.updated_at.isoformat(),
    }


# ─── main export view ────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_ideabin(request):
    user = request.user
    context_id = request.query_params.get("context_id")

    if context_id:
        return _export_context(user, int(context_id))
    else:
        return _export_global(user)


# ─── context-scoped export ───────────────────────────────

def _export_context(user, context_id):
    try:
        ctx = Context.objects.get(id=context_id, owner=user)
    except Context.DoesNotExist:
        return JsonResponse({"error": "Context not found"}, status=404)

    # categories linked to this context
    cat_placements = CategoryContextPlacement.objects.filter(context=ctx)
    category_ids = list(cat_placements.values_list("category_id", flat=True))
    categories = Category.objects.filter(id__in=category_ids)

    # legends linked to this context
    leg_placements = LegendContextPlacement.objects.filter(context=ctx)
    legend_ids = list(leg_placements.values_list("legend_id", flat=True))
    legends = Legend.objects.filter(id__in=legend_ids)
    legend_types = LegendType.objects.filter(legend_id__in=legend_ids)

    # idea placements inside those categories (+ unassigned owned by user)
    idea_placements = IdeaPlacement.objects.filter(category_id__in=category_ids)
    idea_ids_from_cats = set(idea_placements.values_list("idea_id", flat=True))

    # also include unassigned ideas (placement with category=null) owned by user
    unassigned_placements = IdeaPlacement.objects.filter(
        idea__owner=user, category__isnull=True
    )
    idea_ids_unassigned = set(unassigned_placements.values_list("idea_id", flat=True))

    all_idea_ids = idea_ids_from_cats | idea_ids_unassigned
    ideas = Idea.objects.filter(id__in=all_idea_ids)

    # legend type assignments for those ideas
    idea_legend_types = IdeaLegendType.objects.filter(idea_id__in=all_idea_ids)
    upvotes = IdeaUpvote.objects.filter(idea_id__in=all_idea_ids)
    comments = IdeaComment.objects.filter(idea_id__in=all_idea_ids)

    # formations for this context
    formations = Formation.objects.filter(owner=user, context=ctx)

    # build export
    data = {
        "schema_version": 1,
        "export_type": "context",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user_id": user.id,
        "username": user.username,

        "context": _ser_context(ctx),

        "category_context_placements": [
            {
                "id": cp.id,
                "category_id": cp.category_id,
                "context_id": cp.context_id,
                "order_index": cp.order_index,
            }
            for cp in cat_placements
        ],

        "categories": [_ser_category(c) for c in categories],

        "legend_context_placements": [
            {
                "id": lp.id,
                "legend_id": lp.legend_id,
                "context_id": lp.context_id,
                "order_index": lp.order_index,
            }
            for lp in leg_placements
        ],

        "legends": [_ser_legend(l, legend_types.filter(legend=l)) for l in legends],

        "ideas": [_ser_idea(i) for i in ideas],

        "formations": [_ser_formation(f) for f in formations],
    }

    return JsonResponse(data, json_dumps_params={"indent": 2})


# ─── global export ───────────────────────────────────────

def _export_global(user):
    # all contexts owned by user
    contexts = Context.objects.filter(owner=user)

    # all categories owned (or adopted) by user
    owned_cat_ids = set(Category.objects.filter(owner=user).values_list("id", flat=True))
    adopted_cat_ids = set(
        UserCategoryAdoption.objects.filter(user=user).values_list("category_id", flat=True)
    )
    all_cat_ids = owned_cat_ids | adopted_cat_ids
    categories = Category.objects.filter(id__in=all_cat_ids)

    # all category-context placements for user's contexts
    cat_ctx_placements = CategoryContextPlacement.objects.filter(
        context__owner=user
    )

    # all legends owned (or adopted) by user
    owned_legend_ids = set(Legend.objects.filter(owner=user).values_list("id", flat=True))
    adopted_legend_ids = set(
        UserLegendAdoption.objects.filter(user=user).values_list("legend_id", flat=True)
    )
    all_legend_ids = owned_legend_ids | adopted_legend_ids
    legends = Legend.objects.filter(id__in=all_legend_ids)
    legend_types = LegendType.objects.filter(legend_id__in=all_legend_ids)

    # legend-context placements
    leg_ctx_placements = LegendContextPlacement.objects.filter(
        context__owner=user
    )

    # all ideas owned by user
    ideas = Idea.objects.filter(owner=user)
    idea_ids = set(ideas.values_list("id", flat=True))

    # legend type assignments, upvotes, comments
    idea_legend_types = IdeaLegendType.objects.filter(idea_id__in=idea_ids)
    upvotes = IdeaUpvote.objects.filter(idea_id__in=idea_ids)
    comments_qs = IdeaComment.objects.filter(idea_id__in=idea_ids)

    # formations
    formations = Formation.objects.filter(owner=user)

    # adoptions (for reference)
    category_adoptions = UserCategoryAdoption.objects.filter(user=user)
    legend_adoptions = UserLegendAdoption.objects.filter(user=user)
    context_adoptions = UserContextAdoption.objects.filter(user=user)

    # user shortcuts
    try:
        shortcuts_obj = UserShortcuts.objects.get(user=user)
        shortcuts = shortcuts_obj.shortcuts
    except UserShortcuts.DoesNotExist:
        shortcuts = {}

    data = {
        "schema_version": 1,
        "export_type": "global",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user_id": user.id,
        "username": user.username,

        "contexts": [_ser_context(c) for c in contexts],

        "category_context_placements": [
            {
                "id": cp.id,
                "category_id": cp.category_id,
                "context_id": cp.context_id,
                "order_index": cp.order_index,
            }
            for cp in cat_ctx_placements
        ],

        "categories": [_ser_category(c) for c in categories],

        "legend_context_placements": [
            {
                "id": lp.id,
                "legend_id": lp.legend_id,
                "context_id": lp.context_id,
                "order_index": lp.order_index,
            }
            for lp in leg_ctx_placements
        ],

        "legends": [_ser_legend(l, legend_types.filter(legend=l)) for l in legends],

        "ideas": [_ser_idea(i) for i in ideas],

        "formations": [_ser_formation(f) for f in formations],

        "adoptions": {
            "categories": [
                {"id": a.id, "category_id": a.category_id, "adopted_at": a.adopted_at.isoformat()}
                for a in category_adoptions
            ],
            "legends": [
                {"id": a.id, "legend_id": a.legend_id, "adopted_at": a.adopted_at.isoformat()}
                for a in legend_adoptions
            ],
            "contexts": [
                {"id": a.id, "context_id": a.context_id, "adopted_at": a.adopted_at.isoformat()}
                for a in context_adoptions
            ],
        },

        "shortcuts": shortcuts,
    }

    return JsonResponse(data, json_dumps_params={"indent": 2})
