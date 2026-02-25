"""
Views for Context CRUD and category-context placement management.
Contexts classify categories, similar to how categories classify ideas.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models import Category, Context, CategoryContextPlacement, Legend, UserContextAdoption, IdeaContextPlacement, Idea, ProjectContextPlacement, Project
from .serializers import ContextSerializer


# ─────────────────────────────────────────────
#  CONTEXT CRUD
# ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_contexts(request):
    """Return all contexts owned by or adopted by the current user, each with its placed category and legend IDs."""
    owned = Context.objects.filter(owner=request.user).select_related('owner')
    adopted_ids = list(UserContextAdoption.objects.filter(user=request.user).values_list('context_id', flat=True))
    adopted = Context.objects.filter(id__in=adopted_ids).select_related('owner')

    all_ctx_ids = [ctx.id for ctx in owned] + [ctx.id for ctx in adopted]

    # Pre-fetch contributor info
    project_placements = ProjectContextPlacement.objects.filter(context_id__in=all_ctx_ids).select_related('project')
    ctx_projects = {}
    for pp in project_placements:
        ctx_projects.setdefault(pp.context_id, []).append({"id": pp.project.id, "name": pp.project.name})

    adoptions = UserContextAdoption.objects.filter(context_id__in=all_ctx_ids).select_related('user')
    ctx_adopters = {}
    for a in adoptions:
        ctx_adopters.setdefault(a.context_id, []).append({"id": a.user.id, "username": a.user.username})

    data = []
    for ctx in owned:
        d = ContextSerializer(ctx).data
        d["adopted"] = False
        cat_placements = CategoryContextPlacement.objects.filter(context=ctx).order_by("order_index")
        d["category_ids"] = [p.category_id for p in cat_placements]
        d["legend_ids"] = list(Legend.objects.filter(context=ctx).values_list('id', flat=True))
        d["idea_ids"] = list(IdeaContextPlacement.objects.filter(context=ctx).order_by("order_index").values_list('idea_id', flat=True))
        d["project_ids"] = list(ProjectContextPlacement.objects.filter(context=ctx).values_list('project_id', flat=True))
        d["included_projects"] = ctx_projects.get(ctx.id, [])
        d["contributing_users"] = [
            {"id": ctx.owner_id, "username": ctx.owner.username, "is_owner": True}
        ] + [
            {**u, "is_owner": False} for u in ctx_adopters.get(ctx.id, [])
        ]
        data.append(d)

    for ctx in adopted:
        d = ContextSerializer(ctx).data
        d["adopted"] = True
        cat_placements = CategoryContextPlacement.objects.filter(context=ctx).order_by("order_index")
        d["category_ids"] = [p.category_id for p in cat_placements]
        d["legend_ids"] = list(Legend.objects.filter(context=ctx).values_list('id', flat=True))
        d["idea_ids"] = list(IdeaContextPlacement.objects.filter(context=ctx).order_by("order_index").values_list('idea_id', flat=True))
        d["project_ids"] = list(ProjectContextPlacement.objects.filter(context=ctx).values_list('project_id', flat=True))
        d["included_projects"] = ctx_projects.get(ctx.id, [])
        d["contributing_users"] = [
            {"id": ctx.owner_id, "username": ctx.owner.username, "is_owner": True}
        ] + [
            {**u, "is_owner": False} for u in ctx_adopters.get(ctx.id, [])
        ]
        data.append(d)

    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_context(request):
    """Create a new context."""
    name = request.data.get("name", "").strip()
    if not name:
        return Response({"error": "Name required"}, status=400)
    ctx = Context.objects.create(
        owner=request.user,
        name=name,
        x=request.data.get("x", 50),
        y=request.data.get("y", 50),
        width=request.data.get("width", 200),
        height=request.data.get("height", 200),
    )
    d = ContextSerializer(ctx).data
    d["category_ids"] = []
    d["legend_ids"] = []
    return Response(d, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_context(request, context_id):
    """Update context name, position, or size."""
    try:
        ctx = Context.objects.get(pk=context_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    for field in ("name", "x", "y", "width", "height", "z_index", "color"):
        if field in request.data:
            setattr(ctx, field, request.data[field])
    ctx.save()
    d = ContextSerializer(ctx).data
    placements = CategoryContextPlacement.objects.filter(context=ctx).order_by("order_index")
    d["category_ids"] = [p.category_id for p in placements]
    d["legend_ids"] = list(Legend.objects.filter(context=ctx).values_list('id', flat=True))
    return Response(d)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_context(request, context_id):
    """Delete a context. Category placements are cascade-deleted."""
    try:
        ctx = Context.objects.get(pk=context_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.delete()
    return Response({"status": "deleted"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_context_position(request):
    """Update x, y position of a context."""
    ctx_id = request.data.get("context_id")
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.x = request.data.get("x", ctx.x)
    ctx.y = request.data.get("y", ctx.y)
    ctx.save()
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_context_area(request):
    """Update width, height of a context."""
    ctx_id = request.data.get("context_id")
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.width = request.data.get("width", ctx.width)
    ctx.height = request.data.get("height", ctx.height)
    ctx.save()
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def bring_to_front_context(request):
    """Set z_index to max+1 among user's contexts."""
    ctx_id = request.data.get("context_id")
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    max_z = Context.objects.filter(owner=request.user).order_by("-z_index").values_list("z_index", flat=True).first() or 0
    ctx.z_index = max_z + 1
    ctx.save()
    return Response({"status": "ok", "z_index": ctx.z_index})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_context_color(request):
    """Set the color of a context."""
    ctx_id = request.data.get("context_id")
    color = request.data.get("color")  # hex string or null
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.color = color if color else None
    ctx.save()
    return Response({"status": "ok", "color": ctx.color})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_context_filter_state(request):
    """Save filter settings (legendFilters + filterCombineMode) on a context."""
    ctx_id = request.data.get("context_id")
    filter_state = request.data.get("filter_state")  # dict or null
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.filter_state = filter_state
    ctx.save()
    return Response({"status": "ok", "filter_state": ctx.filter_state})


# ─────────────────────────────────────────────
#  CATEGORY ↔ CONTEXT PLACEMENT
# ─────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_category_to_context(request):
    """Place a category into a context. Creates a CategoryContextPlacement."""
    category_id = request.data.get("category_id")
    context_id = request.data.get("context_id")
    try:
        cat = Category.objects.get(pk=category_id, owner=request.user)
        ctx = Context.objects.get(pk=context_id, owner=request.user)
    except (Category.DoesNotExist, Context.DoesNotExist):
        return Response({"error": "Not found"}, status=404)

    placement, created = CategoryContextPlacement.objects.get_or_create(
        category=cat, context=ctx,
        defaults={"order_index": CategoryContextPlacement.objects.filter(context=ctx).count()},
    )
    return Response({"status": "assigned", "created": created})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_category_from_context(request):
    """Remove a category from a context."""
    category_id = request.data.get("category_id")
    context_id = request.data.get("context_id")
    try:
        placement = CategoryContextPlacement.objects.get(
            category_id=category_id,
            context_id=context_id,
            context__owner=request.user,
        )
    except CategoryContextPlacement.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    placement.delete()
    return Response({"status": "removed"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rename_context(request):
    """Rename a context."""
    ctx_id = request.data.get("context_id")
    name = request.data.get("name", "").strip()
    if not name:
        return Response({"error": "Name required"}, status=400)
    try:
        ctx = Context.objects.get(pk=ctx_id, owner=request.user)
    except Context.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    ctx.name = name
    ctx.save()
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def safe_context_order(request):
    """Save the order of categories within contexts."""
    context_orders = request.data.get("context_orders", {})
    for ctx_id, cat_ids in context_orders.items():
        for idx, cat_id in enumerate(cat_ids):
            CategoryContextPlacement.objects.filter(
                context_id=ctx_id, category_id=cat_id, context__owner=request.user
            ).update(order_index=idx)
    return Response({"status": "ok"})


# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
#  PUBLIC / ADOPTION
# ─────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_public_context(request):
    """Toggle is_public flag on a context owned by the current user."""
    context_id = request.data.get("id")
    ctx = get_object_or_404(Context, id=context_id, owner=request.user)
    ctx.is_public = not ctx.is_public
    ctx.save()
    return Response({"is_public": ctx.is_public})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_all_public_contexts(request):
    """Get all public contexts from all users, with adoption status and contributor info."""
    ctxs = Context.objects.filter(is_public=True).select_related('owner')
    adopted_ids = set(UserContextAdoption.objects.filter(user=request.user).values_list('context_id', flat=True))

    # Pre-fetch contributor info for all public contexts
    from django.contrib.auth import get_user_model
    User = get_user_model()
    ctx_ids = [ctx.id for ctx in ctxs]

    # Projects linked to each context
    project_placements = ProjectContextPlacement.objects.filter(context_id__in=ctx_ids).select_related('project')
    ctx_projects = {}
    for pp in project_placements:
        ctx_projects.setdefault(pp.context_id, []).append({"id": pp.project.id, "name": pp.project.name})

    # Users who adopted each context
    adoptions = UserContextAdoption.objects.filter(context_id__in=ctx_ids).select_related('user')
    ctx_adopters = {}
    for a in adoptions:
        ctx_adopters.setdefault(a.context_id, []).append({"id": a.user.id, "username": a.user.username})

    data = ContextSerializer(ctxs, many=True).data
    for c in data:
        c['is_adopted'] = c['id'] in adopted_ids
        c['is_own'] = c['owner_id'] == request.user.id
        c['included_projects'] = ctx_projects.get(c['id'], [])
        c['contributing_users'] = [
            {"id": c['owner_id'], "username": c['owner_username'], "is_owner": True}
        ] + [
            {**u, "is_owner": False} for u in ctx_adopters.get(c['id'], [])
        ]
    return Response({"contexts": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def adopt_context(request, context_id):
    """Adopt a context from another user."""
    ctx = get_object_or_404(Context, id=context_id)
    if ctx.owner == request.user:
        return Response({"error": "Cannot adopt your own context"}, status=400)
    UserContextAdoption.objects.get_or_create(user=request.user, context=ctx)
    return Response({"adopted": True})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def drop_context(request, context_id):
    """Drop (unadopt) a context."""
    UserContextAdoption.objects.filter(user=request.user, context_id=context_id).delete()
    return Response({"dropped": True})


# ─────────────────────────────────────────────
#  IDEA ↔ CONTEXT PLACEMENT
# ─────────────────────────────────────────────

def _get_accessible_context(user, context_id):
    """Return a Context the user owns or has adopted. None if not accessible."""
    ctx = Context.objects.filter(id=context_id).first()
    if ctx is None:
        return None
    if ctx.owner == user:
        return ctx
    if UserContextAdoption.objects.filter(user=user, context=ctx).exists():
        return ctx
    return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_idea_to_context(request):
    """Link an existing idea to a context. Creates an IdeaContextPlacement."""
    idea_id = request.data.get("idea_id")
    context_id = request.data.get("context_id")
    idea = Idea.objects.filter(id=idea_id, owner=request.user).first()
    if not idea:
        return Response({"error": "Idea not found"}, status=404)
    ctx = _get_accessible_context(request.user, context_id)
    if not ctx:
        return Response({"error": "Context not found"}, status=404)
    placement, created = IdeaContextPlacement.objects.get_or_create(
        idea=idea, context=ctx,
        defaults={"order_index": IdeaContextPlacement.objects.filter(context=ctx).count()},
    )
    return Response({"status": "assigned", "created": created})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_idea_from_context(request):
    """Remove an idea from a context. Deletes the IdeaContextPlacement."""
    idea_id = request.data.get("idea_id")
    context_id = request.data.get("context_id")
    deleted, _ = IdeaContextPlacement.objects.filter(
        idea_id=idea_id, idea__owner=request.user, context_id=context_id
    ).delete()
    if not deleted:
        return Response({"error": "Not found"}, status=404)
    return Response({"status": "removed"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_context_idea_order(request):
    """Save the order of ideas within a context."""
    context_id = request.data.get("context_id")
    idea_ids = request.data.get("idea_ids", [])
    ctx = _get_accessible_context(request.user, context_id)
    if not ctx:
        return Response({"error": "Context not found"}, status=404)
    for idx, idea_id in enumerate(idea_ids):
        IdeaContextPlacement.objects.filter(context=ctx, idea_id=idea_id).update(order_index=idx)
    return Response({"status": "ok"})


# ─────────────────────────────────────────────
#  PROJECT ↔ CONTEXT PLACEMENT
# ─────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_project_to_context(request):
    """Link a project to a context."""
    project_id = request.data.get("project_id")
    context_id = request.data.get("context_id")
    from django.db.models import Q
    project = Project.objects.filter(
        Q(owner=request.user) | Q(members=request.user), pk=project_id
    ).first()
    if not project:
        return Response({"error": "Project not found"}, status=404)
    ctx = _get_accessible_context(request.user, context_id)
    if not ctx:
        return Response({"error": "Context not found"}, status=404)
    placement, created = ProjectContextPlacement.objects.get_or_create(
        project=project, context=ctx,
    )
    return Response({"status": "assigned", "created": created})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_project_from_context(request):
    """Remove a project from a context."""
    project_id = request.data.get("project_id")
    context_id = request.data.get("context_id")
    deleted, _ = ProjectContextPlacement.objects.filter(
        project_id=project_id, context_id=context_id,
    ).delete()
    if not deleted:
        return Response({"error": "Not found"}, status=404)
    return Response({"status": "removed"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_context_projects(request, context_id):
    """Return projects linked to a context that the current user is a member of."""
    from django.db.models import Q
    ctx = _get_accessible_context(request.user, context_id)
    if not ctx:
        return Response({"error": "Context not found"}, status=404)
    project_ids = ProjectContextPlacement.objects.filter(context=ctx).values_list('project_id', flat=True)
    projects = Project.objects.filter(
        Q(owner=request.user) | Q(members=request.user),
        pk__in=project_ids,
    ).distinct()
    data = [{"id": p.id, "name": p.name} for p in projects]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project_contexts(request, project_id):
    """Return public contexts that a specific project is linked to."""
    from django.db.models import Q
    project = Project.objects.filter(
        Q(owner=request.user) | Q(members=request.user), pk=project_id
    ).first()
    if not project:
        return Response({"error": "Project not found"}, status=404)
    context_ids = ProjectContextPlacement.objects.filter(project=project).values_list('context_id', flat=True)
    linked_contexts = Context.objects.filter(pk__in=context_ids).select_related('owner')
    data = ContextSerializer(linked_contexts, many=True).data
    return Response(data)
