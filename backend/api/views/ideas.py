from django.db import models as db_models
from django.db.models import Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Category, Context, Idea, IdeaPlacement, IdeaLegendType, IdeaUpvote, IdeaComment, LegendType, Legend, UserCategoryAdoption, UserContextAdoption, CategoryContextPlacement
from .serializers import IdeaSerializer, IdeaPlacementSerializer, CategorySerializer, LegendTypeSerializer, LegendSerializer


# ═══════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════

def _get_accessible_category(user, category_id):
    """Return a Category the user either owns, has adopted, or has access to
    via an adopted context.  Returns None when not accessible."""
    cat = Category.objects.filter(id=category_id).first()
    if cat is None:
        return None
    if cat.owner == user:
        return cat
    if UserCategoryAdoption.objects.filter(user=user, category=cat).exists():
        return cat
    # Check if category belongs to any context the user has adopted
    adopted_ctx_ids = UserContextAdoption.objects.filter(user=user).values_list('context_id', flat=True)
    if CategoryContextPlacement.objects.filter(category=cat, context_id__in=adopted_ctx_ids).exists():
        return cat
    return None


# ═══════════════════════════════════════════════════════
#  IDEA ENDPOINTS  (user-scoped)
# ═══════════════════════════════════════════════════════


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_idea(request):
    title = request.data.get("idea_name", "").strip()
    description = request.data.get("description", "")
    headline = request.data.get("headline", "").strip()
    category_id = request.data.get("category_id")  # optional — place into category
    if not title:
        return Response({"error": "Title is required"}, status=400)

    idea = Idea.objects.create(
        owner=request.user,
        title=title,
        description=description,
        headline=headline,
    )

    # Auto-create one placement (own OR adopted category)
    category = None
    if category_id:
        category = _get_accessible_category(request.user, category_id)

    max_order = IdeaPlacement.objects.filter(idea__owner=request.user, category=category).aggregate(
        Max('order_index')
    )['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    placement = IdeaPlacement.objects.create(
        idea=idea,
        category=category,
        order_index=next_order,
    )
    ctx = {'request': request}
    return Response({
        "created": True,
        "idea": IdeaSerializer(idea, context=ctx).data,
        "placement": IdeaPlacementSerializer(placement, context=ctx).data,
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_idea(request):
    """Delete a single placement.  If it's the last placement, the meta idea is also deleted."""
    placement_id = request.data.get("id")
    placement = IdeaPlacement.objects.filter(id=placement_id, idea__owner=request.user).first()
    if not placement:
        return Response({"deleted": False, "error": "Not found"}, status=404)

    idea = placement.idea
    placement.delete()

    # If no more placements exist, also delete the meta idea
    if not idea.placements.exists():
        idea.delete()

    return Response({"deleted": True})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_meta_idea(request):
    """Delete a meta idea and ALL its placements (cascade)."""
    idea_id = request.data.get("id")
    Idea.objects.filter(id=idea_id, owner=request.user).delete()
    return Response({"deleted": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def copy_idea_to_category(request):
    """Copy an existing idea into a (possibly different) category — creates a new placement."""
    idea_id = request.data.get("idea_id")
    category_id = request.data.get("category_id")  # None for unassigned

    idea = get_object_or_404(Idea, id=idea_id, owner=request.user)

    category = None
    if category_id:
        category = _get_accessible_category(request.user, category_id)
        if not category:
            return Response({"error": "Category not found"}, status=404)

    # Prevent duplicate
    if IdeaPlacement.objects.filter(idea=idea, category=category).exists():
        return Response({"created": False, "error": "Idea already in this category"}, status=400)

    max_order = IdeaPlacement.objects.filter(idea__owner=request.user, category=category).aggregate(
        Max('order_index')
    )['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    placement = IdeaPlacement.objects.create(
        idea=idea,
        category=category,
        order_index=next_order,
    )
    return Response({
        "created": True,
        "placement": IdeaPlacementSerializer(placement, context={'request': request}).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def safe_order(request):
    new_order = request.data.get("order", [])  # list of placement ids
    category_id = request.data.get("category_id")  # None for unassigned list

    for index, placement_id in enumerate(new_order):
        updates = {"order_index": index}
        if category_id is not None:
            if not _get_accessible_category(request.user, category_id):
                return Response({"error": "Category not found"}, status=400)
            updates["category_id"] = category_id
        else:
            updates["category"] = None
        IdeaPlacement.objects.filter(id=placement_id, idea__owner=request.user).update(**updates)
    return Response({"successful": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_to_category(request):
    """Move a placement to a different category."""
    placement_id = request.data.get("placement_id") or request.data.get("idea_id")
    category_id = request.data.get("category_id")  # None to unassign

    placement = get_object_or_404(IdeaPlacement, id=placement_id, idea__owner=request.user)

    if category_id is not None:
        category = _get_accessible_category(request.user, category_id)
        if not category:
            return Response({"error": "Category not found"}, status=404)
        existing = IdeaPlacement.objects.filter(idea=placement.idea, category=category).exclude(id=placement.id).first()
        if existing:
            placement.delete()
            return Response({"updated": True, "merged": True})
        placement.category = category
        max_order = IdeaPlacement.objects.filter(idea__owner=request.user, category=category).aggregate(
            db_models.Max('order_index')
        )['order_index__max']
        placement.order_index = (max_order + 1) if max_order is not None else 0
    else:
        placement.category = None
        max_order = IdeaPlacement.objects.filter(idea__owner=request.user, category__isnull=True).aggregate(
            db_models.Max('order_index')
        )['order_index__max']
        placement.order_index = (max_order + 1) if max_order is not None else 0
    placement.save()
    return Response({"updated": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_ideas(request):
    """Return all idea placements for the current user, grouped by category.
    Also includes placements from adopted categories (read-only)."""
    # Own placements (exclude archived ideas)
    placements = IdeaPlacement.objects.filter(idea__owner=request.user, idea__archived=False).select_related('idea', 'idea__owner', 'category').prefetch_related('idea__legend_types__legend_type', 'idea__legend_types__legend')
    ctx = {'request': request}
    all_placements_serialized = IdeaPlacementSerializer(placements, many=True, context=ctx).data

    unassigned_order = list(
        IdeaPlacement.objects.filter(idea__owner=request.user, idea__archived=False, category__isnull=True)
        .order_by('order_index')
        .values_list('id', flat=True)
    )
    category_orders = {}
    for cat in Category.objects.filter(owner=request.user):
        category_orders[cat.id] = list(
            IdeaPlacement.objects.filter(idea__owner=request.user, idea__archived=False, category=cat)
            .order_by('order_index')
            .values_list('id', flat=True)
        )

    # Adopted category placements
    adopted_cat_ids = list(UserCategoryAdoption.objects.filter(user=request.user).values_list('category_id', flat=True))
    if adopted_cat_ids:
        adopted_placements = IdeaPlacement.objects.filter(category_id__in=adopted_cat_ids).select_related('idea', 'idea__owner', 'category').prefetch_related('idea__legend_types__legend_type', 'idea__legend_types__legend')
        adopted_data = IdeaPlacementSerializer(adopted_placements, many=True, context=ctx).data
        all_placements_serialized += adopted_data
        for cat_id in adopted_cat_ids:
            category_orders[cat_id] = list(
                IdeaPlacement.objects.filter(category_id=cat_id)
                .order_by('order_index')
                .values_list('id', flat=True)
            )

    # Categories from adopted contexts
    adopted_ctx_ids = list(UserContextAdoption.objects.filter(user=request.user).values_list('context_id', flat=True))
    if adopted_ctx_ids:
        ctx_cat_ids = list(CategoryContextPlacement.objects.filter(context_id__in=adopted_ctx_ids).values_list('category_id', flat=True))
        already_included = set(Category.objects.filter(owner=request.user).values_list('id', flat=True)) | set(adopted_cat_ids)
        new_ctx_cat_ids = [cid for cid in ctx_cat_ids if cid not in already_included]
        if new_ctx_cat_ids:
            ctx_placements = IdeaPlacement.objects.filter(category_id__in=new_ctx_cat_ids).select_related('idea', 'idea__owner', 'category').prefetch_related('idea__legend_types__legend_type', 'idea__legend_types__legend')
            ctx_data = IdeaPlacementSerializer(ctx_placements, many=True, context=ctx).data
            all_placements_serialized += ctx_data
            for cat_id in new_ctx_cat_ids:
                category_orders[cat_id] = list(
                    IdeaPlacement.objects.filter(category_id=cat_id)
                    .order_by('order_index')
                    .values_list('id', flat=True)
                )

    return Response({
        "data": all_placements_serialized,
        "order": unassigned_order,
        "category_orders": category_orders,
    })


# ═══════════════════════════════════════════════════════
#  CATEGORY ENDPOINTS  (user-scoped)
# ═══════════════════════════════════════════════════════


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_categories(request):
    owned = Category.objects.filter(owner=request.user).select_related('owner')
    adopted_ids = list(UserCategoryAdoption.objects.filter(user=request.user).values_list('category_id', flat=True))
    adopted = Category.objects.filter(id__in=adopted_ids).select_related('owner')

    # Categories accessible via adopted contexts
    adopted_ctx_ids = list(UserContextAdoption.objects.filter(user=request.user).values_list('context_id', flat=True))
    ctx_cat_ids = list(CategoryContextPlacement.objects.filter(context_id__in=adopted_ctx_ids).values_list('category_id', flat=True))
    owned_id_set = set(owned.values_list('id', flat=True))
    adopted_id_set = set(adopted_ids)
    new_ctx_cat_ids = [cid for cid in ctx_cat_ids if cid not in owned_id_set and cid not in adopted_id_set]
    context_cats = Category.objects.filter(id__in=new_ctx_cat_ids).select_related('owner')

    owned_data = CategorySerializer(owned, many=True).data
    for c in owned_data:
        c['adopted'] = False

    adopted_data = CategorySerializer(adopted, many=True).data
    for c in adopted_data:
        c['adopted'] = True

    ctx_cat_data = CategorySerializer(context_cats, many=True).data
    for c in ctx_cat_data:
        c['adopted'] = True
        c['from_adopted_context'] = True

    return Response({"categories": owned_data + adopted_data + ctx_cat_data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_category(request):
    name = request.data.get("name", "New Category").strip()
    is_public = request.data.get("is_public", False)
    max_z = Category.objects.filter(owner=request.user).aggregate(db_models.Max('z_index'))['z_index__max']
    next_z = (max_z + 1) if max_z is not None else 0

    category = Category.objects.create(
        owner=request.user,
        name=name,
        is_public=is_public,
        x=50,
        y=50,
        width=max(250, len(name) * 9 + 80),
        height=200,
        z_index=next_z,
    )
    return Response({"created": True, "category": CategorySerializer(category).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_position_category(request):
    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, owner=request.user)
    new_position = request.data.get("position")
    category.x = new_position["x"]
    category.y = new_position["y"]
    category.save()
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_area_category(request):
    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, owner=request.user)
    category.width = request.data.get("width", category.width)
    category.height = request.data.get("height", category.height)
    category.save()
    return Response({"updated": True})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_category(request):
    category_id = request.data.get("id")
    IdeaPlacement.objects.filter(category_id=category_id, idea__owner=request.user).update(category=None)
    Category.objects.filter(id=category_id, owner=request.user).delete()
    return Response({"deleted": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def merge_categories(request):
    """Merge source_id into target_id: move all placements, then delete source."""
    source_id = request.data.get("source_id")
    target_id = request.data.get("target_id")
    if not source_id or not target_id or str(source_id) == str(target_id):
        return Response({"error": "Invalid source/target"}, status=400)

    source = _get_accessible_category(request.user, source_id)
    target = _get_accessible_category(request.user, target_id)
    if not source or not target:
        return Response({"error": "Category not found"}, status=404)

    # Max order in target to append after existing ideas
    max_order = IdeaPlacement.objects.filter(
        idea__owner=request.user, category=target
    ).aggregate(db_models.Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    # Move all placements from source → target
    source_placements = IdeaPlacement.objects.filter(
        category=source, idea__owner=request.user
    )
    for p in source_placements:
        # If idea already has a placement in target, delete duplicate
        if IdeaPlacement.objects.filter(idea=p.idea, category=target).exists():
            p.delete()
        else:
            p.category = target
            p.order_index = next_order
            p.save()
            next_order += 1

    # Delete source category (only if user owns it)
    Category.objects.filter(id=source_id, owner=request.user).delete()
    return Response({"merged": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bring_to_front_category(request):
    category_id = request.data.get("id")
    max_z = Category.objects.filter(owner=request.user).aggregate(db_models.Max('z_index'))['z_index__max'] or 0
    Category.objects.filter(id=category_id, owner=request.user).update(z_index=max_z + 1)
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rename_category(request):
    category_id = request.data.get("id")
    new_name = request.data.get("name", "").strip()
    if not new_name:
        return Response({"error": "Name is required"}, status=400)
    Category.objects.filter(id=category_id, owner=request.user).update(name=new_name)
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_idea_title(request):
    idea_id = request.data.get("id")
    new_title = request.data.get("title", "").strip()
    if not new_title:
        return Response({"error": "Title is required"}, status=400)
    idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
    if not idea:
        placement = IdeaPlacement.objects.filter(id=idea_id, idea__owner=request.user).first()
        if placement:
            idea = placement.idea
    if idea:
        idea.title = new_title
        idea.save()
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_idea_headline(request):
    idea_id = request.data.get("id")
    new_headline = request.data.get("headline", "").strip()
    idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
    if not idea:
        placement = IdeaPlacement.objects.filter(id=idea_id, idea__owner=request.user).first()
        if placement:
            idea = placement.idea
    if idea:
        idea.headline = new_headline
        idea.save()
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_archive_category(request):
    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, owner=request.user)
    category.archived = not category.archived
    category.save()
    return Response({"archived": category.archived})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_public_category(request):
    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, owner=request.user)
    category.is_public = not category.is_public
    category.save()
    return Response({"is_public": category.is_public})


# ═══════════════════════════════════════════════════════
#  LEGEND TYPE ENDPOINTS
# ═══════════════════════════════════════════════════════


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_legend_type(request):
    idea_id = request.data.get("idea_id")
    legend_id = request.data.get("legend_id")
    legend_type_id = request.data.get("legend_type_id")  # None to unassign

    idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
    if not idea:
        placement = IdeaPlacement.objects.filter(id=idea_id, idea__owner=request.user).first()
        if placement:
            idea = placement.idea
    if not idea:
        return Response({"error": "Not found"}, status=404)
    if not legend_id:
        return Response({"error": "legend_id required"}, status=400)

    leg = get_object_or_404(Legend, id=legend_id)

    if legend_type_id is not None:
        lt = get_object_or_404(LegendType, id=legend_type_id)
        IdeaLegendType.objects.update_or_create(
            idea=idea, legend=leg,
            defaults={"legend_type": lt},
        )
    else:
        IdeaLegendType.objects.filter(idea=idea, legend=leg).delete()
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_idea_from_category(request):
    """Remove a specific placement (idea from a specific category)."""
    placement_id = request.data.get("placement_id")
    placement = IdeaPlacement.objects.filter(id=placement_id, idea__owner=request.user).first()
    if not placement:
        return Response({"error": "Not found"}, status=404)

    idea = placement.idea
    placement.delete()

    # If no more placements exist, create an unassigned one so the idea isn't lost
    if not idea.placements.exists():
        IdeaPlacement.objects.create(idea=idea, category=None, order_index=0)

    return Response({"removed": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_all_idea_categories(request):
    """Remove idea from ALL categories, keeping one unassigned placement."""
    idea_id = request.data.get("idea_id")
    idea = get_object_or_404(Idea, id=idea_id, owner=request.user)

    IdeaPlacement.objects.filter(idea=idea).delete()
    IdeaPlacement.objects.create(idea=idea, category=None, order_index=0)

    return Response({"removed": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_all_idea_legend_types(request):
    """Remove idea from ALL legend type assignments."""
    idea_id = request.data.get("idea_id")
    idea = get_object_or_404(Idea, id=idea_id, owner=request.user)
    IdeaLegendType.objects.filter(idea=idea).delete()

    return Response({"removed": True})

# ---- LEGEND ENDPOINTS (context-scoped) ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_context_legends(request, context_id):
    """Get all legends that belong to a specific context."""
    ctx = get_object_or_404(Context, id=context_id, owner=request.user)
    legends = Legend.objects.filter(context=ctx)
    return Response({"legends": LegendSerializer(legends, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_legend(request, context_id):
    """Create a new legend inside a context."""
    ctx = get_object_or_404(Context, id=context_id, owner=request.user)
    name = request.data.get("name", "New Legend").strip()
    leg = Legend.objects.create(owner=request.user, context=ctx, name=name)
    return Response({"created": True, "legend": LegendSerializer(leg).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_legend(request, legend_id):
    """Update a legend's name."""
    leg = get_object_or_404(Legend, id=legend_id, owner=request.user)
    name = request.data.get("name", "").strip()
    if name:
        leg.name = name
        leg.save()
    return Response({"updated": True, "legend": LegendSerializer(leg).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_legend(request, legend_id):
    """Delete a legend (and its types)."""
    leg = get_object_or_404(Legend, id=legend_id, owner=request.user)
    leg.delete()
    return Response({"deleted": True})


# ---- TYPE (LegendType) ENDPOINTS ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_legend_types(request, legend_id):
    """Get all types for a specific legend."""
    leg = get_object_or_404(Legend, id=legend_id)
    # Access check: user must own the context the legend belongs to
    if leg.context and leg.context.owner != request.user:
        return Response({"detail": "Forbidden"}, status=403)
    elif not leg.context and leg.owner != request.user:
        return Response({"detail": "Forbidden"}, status=403)
    types = LegendType.objects.filter(legend=leg)
    return Response({"types": LegendTypeSerializer(types, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_legend_type(request, legend_id):
    """Create a type inside a specific legend."""
    leg = get_object_or_404(Legend, id=legend_id, owner=request.user)
    name = request.data.get("name", "New Type").strip()
    color = request.data.get("color", "#cccccc")
    icon = request.data.get("icon", None)
    max_order = LegendType.objects.filter(legend=leg).aggregate(db_models.Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0
    lt = LegendType.objects.create(legend=leg, name=name, color=color, icon=icon, order_index=next_order)
    return Response({"created": True, "type": LegendTypeSerializer(lt).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_legend_type(request, legend_id, type_id):
    """Update a type inside a specific legend."""
    leg = get_object_or_404(Legend, id=legend_id, owner=request.user)
    lt = get_object_or_404(LegendType, id=type_id, legend=leg)
    if "name" in request.data:
        lt.name = request.data.get("name", "").strip()
    if "color" in request.data:
        lt.color = request.data.get("color")
    if "icon" in request.data:
        lt.icon = request.data.get("icon") or None
    lt.save()
    return Response({"updated": True, "type": LegendTypeSerializer(lt).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_legend_type(request, legend_id, type_id):
    """Delete a type inside a specific legend."""
    leg = get_object_or_404(Legend, id=legend_id, owner=request.user)
    LegendType.objects.filter(id=type_id, legend=leg).delete()
    return Response({"deleted": True})


# ---- ADOPTION ENDPOINTS FOR CATEGORIES ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_public_categories(request):
    """Get all public categories from all users, with adoption status."""
    cats = Category.objects.filter(is_public=True).select_related('owner')
    adopted_ids = set(UserCategoryAdoption.objects.filter(user=request.user).values_list('category_id', flat=True))
    data = CategorySerializer(cats, many=True).data
    for c in data:
        c['is_adopted'] = c['id'] in adopted_ids
        c['is_own'] = c['owner_id'] == request.user.id
    return Response({"categories": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def adopt_category(request, category_id):
    """Adopt a category from another user."""
    cat = get_object_or_404(Category, id=category_id)
    if cat.owner == request.user:
        return Response({"error": "Cannot adopt your own category"}, status=400)
    UserCategoryAdoption.objects.get_or_create(user=request.user, category=cat)
    return Response({"adopted": True})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def drop_category(request, category_id):
    """Drop (unadopt) a category."""
    UserCategoryAdoption.objects.filter(user=request.user, category_id=category_id).delete()
    return Response({"dropped": True})


# ---- USER-LEVEL IDEAS ----

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def spinoff_idea(request):
    """Create a personal copy (spinoff) of another user's idea.
    Copies title, headline, description, and all legend-type assignments.
    The new idea is owned by the requesting user with a fresh timestamp."""
    idea_id = request.data.get("idea_id")
    if not idea_id:
        return Response({"error": "idea_id is required"}, status=400)

    original = Idea.objects.filter(id=idea_id).prefetch_related('legend_types').first()
    if not original:
        return Response({"error": "Idea not found"}, status=404)

    if original.owner == request.user:
        return Response({"error": "Cannot spinoff your own idea — use copy instead"}, status=400)

    # Create the new idea owned by the current user
    new_idea = Idea.objects.create(
        owner=request.user,
        title=original.title,
        headline=original.headline,
        description=original.description,
    )

    # Copy all legend-type assignments
    for dt in original.legend_types.all():
        IdeaLegendType.objects.create(
            idea=new_idea,
            legend=dt.legend,
            legend_type=dt.legend_type,
        )

    # Create an unassigned placement
    max_order = IdeaPlacement.objects.filter(
        idea__owner=request.user, category__isnull=True
    ).aggregate(Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    placement = IdeaPlacement.objects.create(
        idea=new_idea,
        category=None,
        order_index=next_order,
    )

    ctx = {'request': request}
    return Response({
        "created": True,
        "idea": IdeaSerializer(new_idea, context=ctx).data,
        "placement": IdeaPlacementSerializer(placement, context=ctx).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_ideas(request):
    """Get all ideas owned by the current user — the meta view."""
    ideas = Idea.objects.filter(owner=request.user, archived=False).prefetch_related('placements__category', 'legend_types__legend_type', 'legend_types__legend')
    return Response({"ideas": IdeaSerializer(ideas, many=True, context={'request': request}).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_meta_ideas(request):
    """Get all unique ideas for the current user (meta view — no placement duplicates)."""
    ideas = Idea.objects.filter(owner=request.user, archived=False).select_related('owner').prefetch_related('placements__category', 'legend_types__legend_type', 'legend_types__legend')
    return Response({
        "ideas": IdeaSerializer(ideas, many=True, context={'request': request}).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_archive_idea(request):
    """Toggle the archived flag on one or more ideas."""
    idea_ids = request.data.get("idea_ids", [])
    single_id = request.data.get("idea_id")
    if single_id:
        idea_ids = [single_id]
    if not idea_ids:
        return Response({"error": "No idea_ids provided"}, status=400)
    ideas = Idea.objects.filter(id__in=idea_ids, owner=request.user)
    for idea in ideas:
        idea.archived = not idea.archived
        idea.save(update_fields=["archived"])
    return Response({"toggled": True, "count": ideas.count()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_set_archive(request):
    """Explicitly set the archived flag on one or more ideas (for undo/redo)."""
    idea_ids = request.data.get("idea_ids", [])
    archived = request.data.get("archived", True)
    if not idea_ids:
        return Response({"error": "No idea_ids provided"}, status=400)
    updated = Idea.objects.filter(id__in=idea_ids, owner=request.user).update(archived=archived)
    return Response({"updated": updated, "archived": archived})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_archived_ideas(request):
    """Return all archived ideas for the current user."""
    ideas = Idea.objects.filter(owner=request.user, archived=True).select_related('owner').prefetch_related(
        'placements__category', 'legend_types__legend_type', 'legend_types__legend'
    )
    return Response({
        "ideas": IdeaSerializer(ideas, many=True, context={'request': request}).data,
    })


# ═══════════════════════════════════════════════════════
#  UPVOTES
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_upvote_idea(request, idea_id):
    """Toggle upvote on an idea. Returns the new upvote state and count."""
    idea = get_object_or_404(Idea, pk=idea_id)
    upvote, created = IdeaUpvote.objects.get_or_create(user=request.user, idea=idea)
    if not created:
        upvote.delete()
    return Response({
        "upvoted": created,
        "upvote_count": idea.upvotes.count(),
    })


# ═══════════════════════════════════════════════════════
#  COMMENTS
# ═══════════════════════════════════════════════════════

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def idea_comments(request, idea_id):
    """GET: list comments for an idea.  POST: add a new comment."""
    idea = get_object_or_404(Idea, pk=idea_id)

    if request.method == "GET":
        comments = idea.comments.select_related('user').all()
        data = [
            {
                "id": c.id,
                "user": c.user.username,
                "text": c.text,
                "created_at": c.created_at.isoformat(),
                "is_own": c.user == request.user,
            }
            for c in comments
        ]
        return Response({"comments": data})

    # POST
    text = request.data.get("text", "").strip()
    if not text:
        return Response({"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
    comment = IdeaComment.objects.create(user=request.user, idea=idea, text=text)
    return Response({
        "id": comment.id,
        "user": comment.user.username,
        "text": comment.text,
        "created_at": comment.created_at.isoformat(),
        "is_own": True,
    }, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_idea_comment(request, comment_id):
    """Delete a comment (only by its author)."""
    comment = get_object_or_404(IdeaComment, pk=comment_id, user=request.user)
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---- BATCH OPERATIONS ----

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_category_with_ideas(request):
    """Create a new category and copy given ideas into it."""
    name = request.data.get("name", "Filtered Ideas").strip()
    idea_ids = request.data.get("idea_ids", [])  # list of idea primary ids
    context_id = request.data.get("context_id")   # optional: auto-assign to context
    filter_config = request.data.get("filter_config")  # optional: store filter for refetch/live

    max_z = Category.objects.filter(owner=request.user).aggregate(db_models.Max('z_index'))['z_index__max']
    next_z = (max_z + 1) if max_z is not None else 0

    category = Category.objects.create(
        owner=request.user,
        name=name,
        x=50,
        y=50,
        width=max(250, len(name) * 9 + 80),
        height=200,
        z_index=next_z,
        filter_config=filter_config if filter_config else None,
    )

    # Copy ideas into the new category
    placed = 0
    for idx, idea_id in enumerate(idea_ids):
        idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
        if not idea:
            continue
        if IdeaPlacement.objects.filter(idea=idea, category=category).exists():
            continue
        IdeaPlacement.objects.create(idea=idea, category=category, order_index=idx)
        placed += 1

    # Auto-assign to context if provided
    if context_id:
        from ..models import Context
        ctx = Context.objects.filter(id=context_id, owner=request.user).first()
        if ctx:
            CategoryContextPlacement.objects.get_or_create(category=category, context=ctx)

    return Response({
        "created": True,
        "category": CategorySerializer(category).data,
        "placed_count": placed,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_remove_legend_type(request):
    """Remove legend type assignment for a specific legend from multiple ideas at once."""
    idea_ids = request.data.get("idea_ids", [])   # list of idea primary ids
    legend_id = request.data.get("legend_id")

    if not legend_id:
        return Response({"error": "legend_id required"}, status=400)

    legend = get_object_or_404(Legend, id=legend_id)
    removed = IdeaLegendType.objects.filter(
        idea__id__in=idea_ids,
        idea__owner=request.user,
        legend=legend,
    ).delete()[0]

    return Response({"removed": removed})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def batch_assign_legend_type(request):
    """Assign (or unassign) a legend type for a specific legend to multiple ideas at once."""
    idea_ids = request.data.get("idea_ids", [])
    legend_id = request.data.get("legend_id")
    legend_type_id = request.data.get("legend_type_id")  # None to unassign

    if not legend_id:
        return Response({"error": "legend_id required"}, status=400)

    legend = get_object_or_404(Legend, id=legend_id)
    ideas = Idea.objects.filter(id__in=idea_ids, owner=request.user)

    if legend_type_id is not None:
        lt = get_object_or_404(LegendType, id=legend_type_id)
        updated = 0
        for idea in ideas:
            IdeaLegendType.objects.update_or_create(
                idea=idea, legend=legend,
                defaults={"legend_type": lt},
            )
            updated += 1
        return Response({"updated": updated})
    else:
        removed = IdeaLegendType.objects.filter(
            idea__in=ideas, legend=legend,
        ).delete()[0]
        return Response({"removed": removed})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sync_category_ideas(request):
    """Sync a category's ideas from a list of idea IDs (used by refetch/live).
    Adds new ideas and optionally removes ideas no longer matching the filter.
    If collect_and_remove is True, matched ideas are also removed from all OTHER categories."""
    category_id = request.data.get("category_id")
    idea_ids = request.data.get("idea_ids", [])
    remove_old = request.data.get("remove_old", False)  # if True, remove ideas not in the new list
    collect_and_remove = request.data.get("collect_and_remove", False)

    category = get_object_or_404(Category, id=category_id, owner=request.user)

    existing_idea_ids = set(IdeaPlacement.objects.filter(
        category=category, idea__owner=request.user
    ).values_list('idea_id', flat=True))

    new_ids = set(idea_ids)
    added = 0
    removed = 0
    detached = 0

    # Add new ones
    max_order = IdeaPlacement.objects.filter(
        category=category, idea__owner=request.user
    ).aggregate(db_models.Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    newly_added_ids = []
    for idea_id in new_ids - existing_idea_ids:
        idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
        if idea and not IdeaPlacement.objects.filter(idea=idea, category=category).exists():
            IdeaPlacement.objects.create(idea=idea, category=category, order_index=next_order)
            next_order += 1
            added += 1
            newly_added_ids.append(idea_id)

    # Remove old ones not in the new list
    if remove_old:
        to_remove = existing_idea_ids - new_ids
        if to_remove:
            removed = IdeaPlacement.objects.filter(
                category=category, idea__owner=request.user, idea_id__in=to_remove
            ).delete()[0]

    # Collect & remove: detach matched ideas from other categories,
    # BUT protect categories that also have collect_and_remove enabled
    # (prevents ping-pong between competing C&R categories).
    if collect_and_remove and new_ids:
        protected_cat_ids = set()
        for other_cat in Category.objects.filter(owner=request.user).exclude(id=category.id):
            fc = other_cat.filter_config
            if isinstance(fc, dict) and fc.get('collect_and_remove'):
                protected_cat_ids.add(other_cat.id)

        detach_qs = IdeaPlacement.objects.filter(
            idea_id__in=new_ids,
            idea__owner=request.user,
        ).exclude(category=category)
        if protected_cat_ids:
            detach_qs = detach_qs.exclude(category_id__in=protected_cat_ids)
        detached = detach_qs.delete()[0]

    return Response({"added": added, "removed": removed, "detached": detached})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_category_filter_config(request):
    """Set or clear the filter_config JSON on a category."""
    category_id = request.data.get("category_id")
    filter_config = request.data.get("filter_config")  # dict or None

    category = get_object_or_404(Category, id=category_id, owner=request.user)
    category.filter_config = filter_config
    category.save(update_fields=["filter_config"])
    return Response({"updated": True, "filter_config": category.filter_config})

