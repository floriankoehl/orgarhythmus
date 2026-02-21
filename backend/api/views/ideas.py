from django.db import models as db_models
from django.db.models import Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Category, Idea, LegendType, LegendVariant
from .serializers import IdeaSerializer, CategorySerializer, LegendTypeSerializer, LegendVariantSerializer
from .helpers import user_has_project_access


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_idea(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    title = request.data.get("idea_name", "").strip()
    description = request.data.get("description", "")
    headline = request.data.get("headline", "").strip()
    if not title:
        return Response({"error": "Title is required"}, status=400)

    max_order = Idea.objects.filter(project=project).aggregate(Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    idea = Idea.objects.create(
        project=project,
        owner=request.user,
        title=title,
        description=description,
        headline=headline,
        order_index=next_order,
    )
    return Response({"created": True, "idea": IdeaSerializer(idea).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_idea(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("id")
    Idea.objects.filter(id=idea_id, project=project).delete()
    return Response({"deleted": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def safe_order(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    new_order = request.data.get("order", [])
    category_id = request.data.get("category_id")  # None for unassigned list

    for index, idea_id in enumerate(new_order):
        updates = {"order_index": index}
        if category_id is not None:
            # ensure category is in this project
            if not Category.objects.filter(id=category_id, project=project).exists():
                return Response({"error": "Category not in project"}, status=400)
            updates["category_id"] = category_id
        else:
            updates["category"] = None
        Idea.objects.filter(id=idea_id, project=project).update(**updates)
    return Response({"successful": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_to_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    category_id = request.data.get("category_id")  # None to unassign

    idea = get_object_or_404(Idea, id=idea_id, project=project)

    if category_id is not None:
        category = get_object_or_404(Category, id=category_id, project=project)
        idea.category = category
        max_order = Idea.objects.filter(project=project, category=category).aggregate(
            db_models.Max('order_index')
        )['order_index__max']
        idea.order_index = (max_order + 1) if max_order is not None else 0
    else:
        idea.category = None
        max_order = Idea.objects.filter(project=project, category__isnull=True).aggregate(
            db_models.Max('order_index')
        )['order_index__max']
        idea.order_index = (max_order + 1) if max_order is not None else 0
    idea.save()
    return Response({"updated": True})


# get_all_ideas
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_ideas(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    all_ideas = Idea.objects.filter(project=project)
    all_ideas_serialized = IdeaSerializer(all_ideas, many=True).data

    unassigned_order = list(
        Idea.objects.filter(project=project, category__isnull=True)
        .order_by('order_index')
        .values_list('id', flat=True)
    )
    category_orders = {}
    for cat in Category.objects.filter(project=project):
        category_orders[cat.id] = list(
            Idea.objects.filter(project=project, category=cat)
            .order_by('order_index')
            .values_list('id', flat=True)
        )
    return Response({
        "data": all_ideas_serialized,
        "order": unassigned_order,
        "category_orders": category_orders,
    })


# get_all_categories
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_categories(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    all_categories = Category.objects.filter(project=project)
    all_cats_ready = CategorySerializer(all_categories, many=True).data
    return Response({"categories": all_cats_ready})


# create_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get("name", "New Category").strip()
    max_z = Category.objects.filter(project=project).aggregate(db_models.Max('z_index'))['z_index__max']
    next_z = (max_z + 1) if max_z is not None else 0

    category = Category.objects.create(
        project=project,
        name=name,
        x=50,
        y=50,
        width=max(250, len(name) * 9 + 80),
        height=200,
        z_index=next_z,
    )
    return Response({"created": True, "category": CategorySerializer(category).data})


# set_position_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_position_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, project=project)
    new_position = request.data.get("position")
    category.x = new_position["x"]
    category.y = new_position["y"]
    category.save()
    return Response({"updated": True})


# set_area_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_area_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, project=project)
    category.width = request.data.get("width", category.width)
    category.height = request.data.get("height", category.height)
    category.save()
    return Response({"updated": True})


# delete_category
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    Idea.objects.filter(project=project, category_id=category_id).update(category=None)
    Category.objects.filter(id=category_id, project=project).delete()
    return Response({"deleted": True})


# bring_to_front_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bring_to_front_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    max_z = Category.objects.filter(project=project).aggregate(db_models.Max('z_index'))['z_index__max'] or 0
    Category.objects.filter(id=category_id, project=project).update(z_index=max_z + 1)
    return Response({"updated": True})


# rename_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rename_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    new_name = request.data.get("name", "").strip()
    if not new_name:
        return Response({"error": "Name is required"}, status=400)
    Category.objects.filter(id=category_id, project=project).update(name=new_name)
    return Response({"updated": True})


# update_idea_title
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_idea_title(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("id")
    new_title = request.data.get("title", "").strip()
    if not new_title:
        return Response({"error": "Title is required"}, status=400)
    Idea.objects.filter(id=idea_id, project=project).update(title=new_title)
    return Response({"updated": True})


# update_idea_headline
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_idea_headline(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("id")
    new_headline = request.data.get("headline", "").strip()
    # Headline can be empty (optional)
    Idea.objects.filter(id=idea_id, project=project).update(headline=new_headline)
    return Response({"updated": True})


# toggle_archive_category
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_archive_category(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    category = get_object_or_404(Category, id=category_id, project=project)
    category.archived = not category.archived
    # When restoring from archive, assign the highest z-index so it appears on top
    if not category.archived:
        max_z = Category.objects.filter(project=project).aggregate(db_models.Max('z_index'))['z_index__max'] or 0
        category.z_index = max_z + 1
    category.save()
    return Response({"archived": category.archived, "z_index": category.z_index})


# ===== LEGEND TYPE ENDPOINTS =====


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_legend_types(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    legend_types = LegendType.objects.filter(project=project)
    return Response({"legend_types": LegendTypeSerializer(legend_types, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_legend_type(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get("name", "New Type").strip()
    color = request.data.get("color", "#cccccc")
    max_order = LegendType.objects.filter(project=project).aggregate(db_models.Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0
    legend_type = LegendType.objects.create(project=project, name=name, color=color, order_index=next_order)
    return Response({"created": True, "legend_type": LegendTypeSerializer(legend_type).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_legend_type(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    legend_type_id = request.data.get("id")
    legend_type = get_object_or_404(LegendType, id=legend_type_id, project=project)
    if "name" in request.data:
        legend_type.name = request.data.get("name", "").strip()
    if "color" in request.data:
        legend_type.color = request.data.get("color")
    legend_type.save()
    return Response({"updated": True, "legend_type": LegendTypeSerializer(legend_type).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_legend_type(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    legend_type_id = request.data.get("id")
    Idea.objects.filter(project=project, legend_type_id=legend_type_id).update(legend_type=None)
    LegendType.objects.filter(id=legend_type_id, project=project).delete()
    return Response({"deleted": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_legend_type(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    legend_type_id = request.data.get("legend_type_id")  # None to unassign

    idea = get_object_or_404(Idea, id=idea_id, project=project)
    if legend_type_id is not None:
        legend = get_object_or_404(LegendType, id=legend_type_id, project=project)
        idea.legend_type = legend
    else:
        idea.legend_type = None
    idea.save()
    return Response({"updated": True})


# ===== LEGEND VARIANT ENDPOINTS =====


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_legend_variants(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    variants = LegendVariant.objects.filter(project=project).prefetch_related('legend_types')
    return Response({"legend_variants": LegendVariantSerializer(variants, many=True).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_legend_variant(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    name = request.data.get("name", "New Variant").strip()
    if not name:
        return Response({"error": "Name is required"}, status=400)

    max_order = LegendVariant.objects.filter(project=project).aggregate(Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    variant = LegendVariant.objects.create(
        project=project,
        name=name,
        created_by=request.user,
        order_index=next_order,
    )
    return Response({"created": True, "legend_variant": LegendVariantSerializer(variant).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_legend_variant(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    variant_id = request.data.get("id")
    variant = get_object_or_404(LegendVariant, id=variant_id, project=project)
    if "name" in request.data:
        variant.name = request.data["name"].strip()
    variant.save()
    return Response({"updated": True, "legend_variant": LegendVariantSerializer(variant).data})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_legend_variant(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    variant_id = request.data.get("id")
    # Deleting a variant cascades to its legend types
    LegendVariant.objects.filter(id=variant_id, project=project).delete()
    return Response({"deleted": True})


# ===== MULTI-LEGEND-TYPE ASSIGNMENT =====


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_legend_types(request, project_id):
    """Assign multiple legend types to an idea (across variants)."""
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    legend_type_ids = request.data.get("legend_type_ids", [])
    primary_legend_type_id = request.data.get("primary_legend_type_id")

    idea = get_object_or_404(Idea, id=idea_id, project=project)
    types = LegendType.objects.filter(id__in=legend_type_ids, project=project)
    idea.legend_types.set(types)

    if primary_legend_type_id is not None:
        primary = LegendType.objects.filter(id=primary_legend_type_id, project=project).first()
        idea.primary_legend_type = primary
    else:
        idea.primary_legend_type = None

    # Also update legacy single legend_type for backward compat
    if types.exists():
        idea.legend_type = idea.primary_legend_type or types.first()
    else:
        idea.legend_type = None
        idea.primary_legend_type = None

    idea.save()
    return Response({"updated": True, "idea": IdeaSerializer(idea).data})


# ===== MULTI-CATEGORY MEMBERSHIP =====


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_categories(request, project_id):
    """Assign an idea to multiple categories."""
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    category_ids = request.data.get("category_ids", [])

    idea = get_object_or_404(Idea, id=idea_id, project=project)
    cats = Category.objects.filter(id__in=category_ids, project=project)
    idea.categories.set(cats)

    # Also update legacy single category FK
    if cats.exists():
        idea.category = cats.first()
    else:
        idea.category = None
    idea.save()

    return Response({"updated": True, "idea": IdeaSerializer(idea).data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_idea_to_category(request, project_id):
    """Add an idea to a category (additive, does not remove from others)."""
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    category_id = request.data.get("category_id")

    idea = get_object_or_404(Idea, id=idea_id, project=project)
    category = get_object_or_404(Category, id=category_id, project=project)
    idea.categories.add(category)
    return Response({"updated": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_idea_from_category(request, project_id):
    """Remove an idea from a category (does NOT delete the idea)."""
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    idea_id = request.data.get("idea_id")
    category_id = request.data.get("category_id")

    idea = get_object_or_404(Idea, id=idea_id, project=project)
    category = get_object_or_404(Category, id=category_id, project=project)
    idea.categories.remove(category)
    return Response({"updated": True})


# ===== CATEGORY VISIBILITY =====


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_category_visibility(request, project_id):
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    category_id = request.data.get("id")
    visibility = request.data.get("visibility", "private")

    if visibility not in ("private", "public"):
        return Response({"error": "Invalid visibility"}, status=400)

    category = get_object_or_404(Category, id=category_id, project=project)
    category.visibility = visibility
    category.save()
    return Response({"updated": True, "visibility": category.visibility})


# ===== VARIANT-SCOPED LEGEND TYPE CRUD =====


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_variant_legend_type(request, project_id):
    """Create a legend type inside a specific variant."""
    project = get_object_or_404(Project, id=project_id)
    if not user_has_project_access(request.user, project):
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    variant_id = request.data.get("variant_id")
    variant = get_object_or_404(LegendVariant, id=variant_id, project=project)

    name = request.data.get("name", "New Type").strip()
    color = request.data.get("color", "#cccccc")
    max_order = LegendType.objects.filter(variant=variant).aggregate(Max('order_index'))['order_index__max']
    next_order = (max_order + 1) if max_order is not None else 0

    legend_type = LegendType.objects.create(
        project=project,
        variant=variant,
        name=name,
        color=color,
        order_index=next_order,
    )
    return Response({"created": True, "legend_type": LegendTypeSerializer(legend_type).data})