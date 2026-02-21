from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models import Formation


# ═══════════════════════════════════════════════════════
#  FORMATION CRUD
# ═══════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_formations(request):
    """List all formations for the current user (lightweight — no full state blob)."""
    formations = Formation.objects.filter(owner=request.user)
    data = [
        {
            "id": f.id,
            "name": f.name,
            "updated_at": f.updated_at.isoformat(),
            "created_at": f.created_at.isoformat(),
        }
        for f in formations
    ]
    return Response({"formations": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_formation(request):
    """Create a new formation with the given name and state."""
    name = request.data.get("name", "").strip() or "Unnamed Formation"
    state = request.data.get("state", {})
    f = Formation.objects.create(owner=request.user, name=name, state=state)
    return Response({
        "id": f.id,
        "name": f.name,
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
