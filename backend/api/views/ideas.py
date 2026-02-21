from django.db import models as db_models
from django.db.models import Max
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Project, Category, Idea, LegendType, Dimension, UserDimensionAdoption, UserCategoryAdoption
from .serializers import IdeaSerializer, CategorySerializer, LegendTypeSerializer, DimensionSerializer
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
        owner=request.user,
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
    category.save()
    return Response({"archived": category.archived})


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


# ---- USER-LEVEL IDEAS (cross-project) ----

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_ideas(request):
    """Get all ideas owned by the current user (across all projects)."""
    ideas = Idea.objects.filter(owner=request.user)
    return Response({"ideas": IdeaSerializer(ideas, many=True).data})
