from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models import Formation, Context, UserContextAdoption, UserShortcuts


# ═══════════════════════════════════════════════════════
#  FORMATION CRUD  (scoped to a context)
# ═══════════════════════════════════════════════════════

def _ensure_context_access(request, context_id):
    """Return the context if the user owns it or has adopted it; 404 otherwise."""
    ctx = Context.objects.filter(pk=context_id).first()
    if ctx is None:
        from django.http import Http404
        raise Http404
    if ctx.owner == request.user:
        return ctx
    if UserContextAdoption.objects.filter(user=request.user, context=ctx).exists():
        return ctx
    from django.http import Http404
    raise Http404


def _get_accessible_formation(user, formation_id):
    """Return a Formation the user owns or that belongs to an accessible context."""
    f = Formation.objects.filter(pk=formation_id).select_related('context').first()
    if f is None:
        return None
    if f.owner == user:
        return f
    # Allow if user is a member of the formation's context
    if f.context:
        if f.context.owner == user:
            return f
        if UserContextAdoption.objects.filter(user=user, context=f.context).exists():
            return f
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_formations(request, context_id):
    """List all formations for a given context (lightweight — no full state blob)."""
    ctx = _ensure_context_access(request, context_id)
    formations = Formation.objects.filter(context=ctx)
    data = [
        {
            "id": f.id,
            "name": f.name,
            "is_default": f.is_default,
            "updated_at": f.updated_at.isoformat(),
            "created_at": f.created_at.isoformat(),
        }
        for f in formations
    ]
    return Response({"formations": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_formation(request, context_id):
    """Create a new formation within a context."""
    ctx = _ensure_context_access(request, context_id)
    name = request.data.get("name", "").strip() or "Unnamed Formation"
    state = request.data.get("state", {})
    f = Formation.objects.create(owner=request.user, context=ctx, name=name, state=state)
    return Response({
        "id": f.id,
        "name": f.name,
        "is_default": f.is_default,
        "state": f.state,
        "updated_at": f.updated_at.isoformat(),
        "created_at": f.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_formation(request, formation_id):
    """Get a single formation with its full state."""
    f = _get_accessible_formation(request.user, formation_id)
    if not f:
        return Response({"error": "Not found"}, status=404)
    return Response({
        "id": f.id,
        "name": f.name,
        "is_default": f.is_default,
        "state": f.state,
        "updated_at": f.updated_at.isoformat(),
        "created_at": f.created_at.isoformat(),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_formation(request, formation_id):
    """Update a formation's name and/or state."""
    f = _get_accessible_formation(request.user, formation_id)
    if not f:
        return Response({"error": "Not found"}, status=404)
    name = request.data.get("name")
    state = request.data.get("state")
    if name is not None:
        f.name = name.strip() or f.name
    if state is not None:
        f.state = state
    f.save()
    return Response({
        "id": f.id,
        "name": f.name,
        "is_default": f.is_default,
        "state": f.state,
        "updated_at": f.updated_at.isoformat(),
    })


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_formation(request, formation_id):
    """Delete a formation."""
    f = _get_accessible_formation(request.user, formation_id)
    if not f:
        return Response({"error": "Not found"}, status=404)
    f.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_default_formation(request, formation_id):
    """Toggle a formation as the default within its context. Only one per context."""
    f = _get_accessible_formation(request.user, formation_id)
    if not f:
        return Response({"error": "Not found"}, status=404)
    if f.is_default:
        f.is_default = False
        f.save()
    else:
        # Clear any existing default in the same context
        Formation.objects.filter(context=f.context, is_default=True).update(is_default=False)
        f.is_default = True
        f.save()
    return Response({
        "id": f.id,
        "name": f.name,
        "is_default": f.is_default,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_default_formation(request, context_id):
    """Get the default formation for a context (if any) with full state."""
    ctx = _ensure_context_access(request, context_id)
    f = Formation.objects.filter(context=ctx, is_default=True).first()
    if not f:
        return Response({"formation": None})
    return Response({
        "formation": {
            "id": f.id,
            "name": f.name,
            "is_default": f.is_default,
            "state": f.state,
        }
    })


# ═══════════════════════════════════════════════════════
#  DEFAULT CONTEXT
# ═══════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_default_context(request, context_id):
    """Toggle a context as the user's default. Stored per-user in UserShortcuts."""
    ctx = _ensure_context_access(request, context_id)
    prefs, _ = UserShortcuts.objects.get_or_create(user=request.user)
    if prefs.default_context_id == ctx.id:
        # Already the default → un-set
        prefs.default_context = None
        prefs.save(update_fields=['default_context'])
        return Response({"id": ctx.id, "name": ctx.name, "is_default": False})
    else:
        prefs.default_context = ctx
        prefs.save(update_fields=['default_context'])
        return Response({"id": ctx.id, "name": ctx.name, "is_default": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_default_context(request):
    """Get the user's default context (if any). Per-user from UserShortcuts."""
    prefs = UserShortcuts.objects.filter(user=request.user).select_related('default_context').first()
    ctx = prefs.default_context if prefs else None
    if not ctx:
        return Response({"context": None})
    from ..models import CategoryContextPlacement, Legend
    from .serializers import ContextSerializer
    d = ContextSerializer(ctx).data
    d["adopted"] = ctx.owner != request.user
    d["is_default"] = True
    cat_placements = CategoryContextPlacement.objects.filter(context=ctx).order_by("order_index")
    d["category_ids"] = [p.category_id for p in cat_placements]
    d["legend_ids"] = list(Legend.objects.filter(context=ctx).values_list('id', flat=True))
    return Response({"context": d})
