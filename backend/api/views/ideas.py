from django.db import models as db_models
from django.db.models import Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Category, Idea, IdeaPlacement, IdeaDimensionType, LegendType, Dimension, UserDimensionAdoption, UserCategoryAdoption
from .serializers import IdeaSerializer, IdeaPlacementSerializer, CategorySerializer, LegendTypeSerializer, DimensionSerializer


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

    # Auto-create one placement
    category = None
    if category_id:
        category = Category.objects.filter(id=category_id, owner=request.user).first()

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
        "idea": IdeaSerializer(idea).data,
        "placement": IdeaPlacementSerializer(placement).data,
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
        category = get_object_or_404(Category, id=category_id, owner=request.user)

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
        "placement": IdeaPlacementSerializer(placement).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def safe_order(request):
    new_order = request.data.get("order", [])  # list of placement ids
    category_id = request.data.get("category_id")  # None for unassigned list

    for index, placement_id in enumerate(new_order):
        updates = {"order_index": index}
        if category_id is not None:
            if not Category.objects.filter(id=category_id, owner=request.user).exists():
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
        category = get_object_or_404(Category, id=category_id, owner=request.user)
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
    """Return all idea placements for the current user, grouped by category."""
    placements = IdeaPlacement.objects.filter(idea__owner=request.user).select_related('idea', 'idea__owner', 'category').prefetch_related('idea__dimension_types__legend_type', 'idea__dimension_types__dimension')
    all_placements_serialized = IdeaPlacementSerializer(placements, many=True).data

    unassigned_order = list(
        IdeaPlacement.objects.filter(idea__owner=request.user, category__isnull=True)
        .order_by('order_index')
        .values_list('id', flat=True)
    )
    category_orders = {}
    for cat in Category.objects.filter(owner=request.user):
        category_orders[cat.id] = list(
            IdeaPlacement.objects.filter(idea__owner=request.user, category=cat)
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
    all_categories = Category.objects.filter(owner=request.user)
    all_cats_ready = CategorySerializer(all_categories, many=True).data
    return Response({"categories": all_cats_ready})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_category(request):
    name = request.data.get("name", "New Category").strip()
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


# ═══════════════════════════════════════════════════════
#  LEGEND TYPE ENDPOINTS  (kept for backward compat — now dimension-only)
# ═══════════════════════════════════════════════════════


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_legend_type(request):
    idea_id = request.data.get("idea_id")
    dimension_id = request.data.get("dimension_id")
    legend_type_id = request.data.get("legend_type_id")  # None to unassign

    idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
    if not idea:
        placement = IdeaPlacement.objects.filter(id=idea_id, idea__owner=request.user).first()
        if placement:
            idea = placement.idea
    if not idea:
        return Response({"error": "Not found"}, status=404)
    if not dimension_id:
        return Response({"error": "dimension_id required"}, status=400)

    dimension = get_object_or_404(Dimension, id=dimension_id)

    if legend_type_id is not None:
        legend = get_object_or_404(LegendType, id=legend_type_id)
        IdeaDimensionType.objects.update_or_create(
            idea=idea, dimension=dimension,
            defaults={"legend_type": legend},
        )
    else:
        IdeaDimensionType.objects.filter(idea=idea, dimension=dimension).delete()
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
def remove_all_idea_dimension_types(request):
    """Remove idea from ALL dimension type assignments."""
    idea_id = request.data.get("idea_id")
    idea = get_object_or_404(Idea, id=idea_id, owner=request.user)
    IdeaDimensionType.objects.filter(idea=idea).delete()

    return Response({"removed": True})

# ---- DIMENSION ENDPOINTS ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_dimensions(request):
    """Get all dimensions owned by or adopted by the current user."""
    owned = Dimension.objects.filter(owner=request.user)
    adopted_ids = UserDimensionAdoption.objects.filter(user=request.user).values_list('dimension_id', flat=True)
    adopted = Dimension.objects.filter(id__in=adopted_ids).exclude(owner=request.user)
    all_dims = list(owned) + list(adopted)
    return Response({"dimensions": DimensionSerializer(all_dims, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_dimension(request):
    """Create a new dimension for the current user."""
    name = request.data.get("name", "New Dimension").strip()
    dim = Dimension.objects.create(owner=request.user, name=name)
    return Response({"created": True, "dimension": DimensionSerializer(dim).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_dimension(request, dimension_id):
    """Update a dimension's name."""
    dim = get_object_or_404(Dimension, id=dimension_id, owner=request.user)
    name = request.data.get("name", "").strip()
    if name:
        dim.name = name
        dim.save()
    return Response({"updated": True, "dimension": DimensionSerializer(dim).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_dimension(request, dimension_id):
    """Delete a dimension (and its types)."""
    dim = get_object_or_404(Dimension, id=dimension_id, owner=request.user)
    dim.delete()
    return Response({"deleted": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def adopt_dimension(request, dimension_id):
    """Adopt another user's dimension."""
    dim = get_object_or_404(Dimension, id=dimension_id)
    if dim.owner == request.user:
        return Response({"error": "Cannot adopt your own dimension"}, status=400)
    UserDimensionAdoption.objects.get_or_create(user=request.user, dimension=dim)
    return Response({"adopted": True})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def drop_dimension(request, dimension_id):
    """Drop (unadopt) a dimension."""
    UserDimensionAdoption.objects.filter(user=request.user, dimension_id=dimension_id).delete()
    return Response({"dropped": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_public_dimensions(request):
    """Get all dimensions (for browsing and adoption)."""
    dims = Dimension.objects.exclude(owner=request.user)
    return Response({"dimensions": DimensionSerializer(dims, many=True).data})


# ---- DIMENSION TYPE (LegendType) ENDPOINTS ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_dimension_types(request, dimension_id):
    """Get all types for a specific dimension."""
    dim = get_object_or_404(Dimension, id=dimension_id)
    is_owner = dim.owner == request.user
    is_adopter = UserDimensionAdoption.objects.filter(user=request.user, dimension=dim).exists()
    if not is_owner and not is_adopter:
        return Response({"detail": "Forbidden"}, status=403)
    types = LegendType.objects.filter(dimension=dim)
    return Response({"types": LegendTypeSerializer(types, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_dimension_type(request, dimension_id):
    """Create a type inside a specific dimension."""
    dim = get_object_or_404(Dimension, id=dimension_id, owner=request.user)
    name = request.data.get("name", "New Type").strip()
    color = request.data.get("color", "#cccccc")
    max_order = LegendType.objects.filter(dimension=dim).aggregate(db_models.Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0
    lt = LegendType.objects.create(dimension=dim, name=name, color=color, order_index=next_order)
    return Response({"created": True, "type": LegendTypeSerializer(lt).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_dimension_type(request, dimension_id, type_id):
    """Update a type inside a specific dimension."""
    dim = get_object_or_404(Dimension, id=dimension_id, owner=request.user)
    lt = get_object_or_404(LegendType, id=type_id, dimension=dim)
    if "name" in request.data:
        lt.name = request.data.get("name", "").strip()
    if "color" in request.data:
        lt.color = request.data.get("color")
    lt.save()
    return Response({"updated": True, "type": LegendTypeSerializer(lt).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_dimension_type(request, dimension_id, type_id):
    """Delete a type inside a specific dimension."""
    dim = get_object_or_404(Dimension, id=dimension_id, owner=request.user)
    LegendType.objects.filter(id=type_id, dimension=dim).delete()
    return Response({"deleted": True})


# ---- ADOPTION ENDPOINTS FOR CATEGORIES ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_public_categories(request):
    """Get all categories accessible to the user (own + adopted)."""
    owned_ids = list(Category.objects.filter(owner=request.user).values_list('id', flat=True))
    adopted_ids = list(UserCategoryAdoption.objects.filter(user=request.user).values_list('category_id', flat=True))
    all_ids = list(set(owned_ids + adopted_ids))
    cats = Category.objects.filter(id__in=all_ids)
    return Response({"categories": CategorySerializer(cats, many=True).data})


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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_ideas(request):
    """Get all ideas owned by the current user — the meta view."""
    ideas = Idea.objects.filter(owner=request.user).prefetch_related('placements__category', 'dimension_types__legend_type', 'dimension_types__dimension')
    return Response({"ideas": IdeaSerializer(ideas, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_meta_ideas(request):
    """Get all unique ideas for the current user (meta view — no placement duplicates)."""
    ideas = Idea.objects.filter(owner=request.user).select_related('owner').prefetch_related('placements__category', 'dimension_types__legend_type', 'dimension_types__dimension')
    return Response({
        "ideas": IdeaSerializer(ideas, many=True).data,
    })
