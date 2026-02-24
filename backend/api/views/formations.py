from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models import Formation, Context


# ═══════════════════════════════════════════════════════
#  FORMATION CRUD  (scoped to a context)
# ═══════════════════════════════════════════════════════

def _ensure_context_access(request, context_id):
    """Return the context if the user owns it; 404 otherwise."""
    return get_object_or_404(Context, id=context_id, owner=request.user)


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
    f = get_object_or_404(Formation, id=formation_id, owner=request.user)
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
    f = get_object_or_404(Formation, id=formation_id, owner=request.user)
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
    f = get_object_or_404(Formation, id=formation_id, owner=request.user)
    f.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_default_formation(request, formation_id):
    """Toggle a formation as the default within its context. Only one per context."""
    f = get_object_or_404(Formation, id=formation_id, owner=request.user)
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
    """Toggle a context as the user's default. Only one can be default at a time."""
    ctx = _ensure_context_access(request, context_id)
    if ctx.is_default:
        ctx.is_default = False
        ctx.save()
    else:
        Context.objects.filter(owner=request.user, is_default=True).update(is_default=False)
        ctx.is_default = True
        ctx.save()
    return Response({
        "id": ctx.id,
        "name": ctx.name,
        "is_default": ctx.is_default,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_default_context(request):
    """Get the user's default context (if any)."""
    ctx = Context.objects.filter(owner=request.user, is_default=True).first()
    if not ctx:
        return Response({"context": None})
    from ..models import CategoryContextPlacement, Legend
    from .serializers import ContextSerializer
    d = ContextSerializer(ctx).data
    d["adopted"] = False
    d["is_default"] = ctx.is_default
    cat_placements = CategoryContextPlacement.objects.filter(context=ctx).order_by("order_index")
    d["category_ids"] = [p.category_id for p in cat_placements]
    d["legend_ids"] = list(Legend.objects.filter(context=ctx).values_list('id', flat=True))
    return Response({"context": d})
